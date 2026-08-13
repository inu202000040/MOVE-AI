import newsPolicyArtifact from "../generated/news-policy-v18.json";
import { assertNewsPolicyV18 } from "../artifacts/decoders";
import type { GatewayResultV1 } from "../../contracts/gateway";
import type { RouteId } from "../../contracts/routes";
import {
  type NewsArticleV1,
  type NewsDataV1,
  type NewsQueryV1,
} from "./domains";
import { decodeNewsResultV1, type NewsStateV1 } from "./method-decoders";
import { assertAllowedProviderUrlV1, assertAllowedRedirectV1 } from "./provider-policy";
import { gatewaySuccess, gatewayUnavailable } from "./result";

assertNewsPolicyV18(newsPolicyArtifact);

type FetchV1 = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

interface RouteNewsProfileV1 {
  readonly routeNameKo: string;
  readonly destinationQuery: string;
  readonly matchTerms: readonly string[];
  readonly portTerms: readonly string[];
  readonly localQuery: string | null;
}

interface RawCandidateV1 {
  readonly provider: string;
  readonly title: string;
  readonly summary: string;
  readonly url: string;
  readonly publishedAt: string;
}

interface ProviderResultV1 {
  readonly provider: string;
  readonly resultCode: string;
  readonly elapsedMs: number;
  readonly candidates: readonly RawCandidateV1[];
}

interface ScoredCandidateV1 {
  readonly article: Omit<NewsArticleV1, "id">;
  readonly routeScore: number;
  readonly encounter: number;
}

export interface LiveNewsDependenciesV1 {
  readonly fetchImpl?: FetchV1;
  readonly now?: Date;
}

const CONTAINER_QUERY = "container shipping OR container freight OR liner shipping OR ocean freight OR sea freight";
const MARITIME_TERMS = ["container", "shipping", "freight", "ocean", "liner", "port", "vessel", "carrier", "terminal", "teu"];
const UP_TERMS = ["surge", "rise", "rises", "rate hike", "rate increase", "freight increase", "disruption", "strike", "congestion", "attack", "tariff", "closure", "surcharge", "omission"];
const DOWN_TERMS = ["fall", "falls", "drop", "drops", "decline", "declines", "ease", "eases", "reopen", "capacity increase", "new service", "capacity addition"];
const SIGNALS = [
  { label: "운임·할증료", score: 10, terms: ["freight rate", "spot rate", "contract rate", "gri", "fak", "pss", "surcharge", "rate hike", "rate increase"] },
  { label: "선복·결항", score: 7, terms: ["blank sailing", "capacity", "service suspension", "port omission", "booking suspension", "new service"] },
  { label: "운항·항만 차질", score: 7, terms: ["congestion", "closure", "strike", "delay", "rerout", "diversion", "disruption", "canal restriction"] },
  { label: "연료·운항비", score: 6, terms: ["bunker", "fuel", "brent", "baf", "emissions surcharge", "insurance", "war risk"] },
  { label: "컨테이너 장비", score: 6, terms: ["equipment", "empty container", "reefer", "chassis shortage"] },
  { label: "수요 변화", score: 3, terms: ["demand", "peak season", "trade volume", "booking"] },
  { label: "통상정책", score: 4, terms: ["tariff", "sanction", "customs", "restriction", "ban"] },
] as const;

function profileFor(route: RouteId): RouteNewsProfileV1 {
  return newsPolicyArtifact.profiles[route];
}

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gu, "$1")
    .replace(/&#(\d+);/gu, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/giu, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function plainText(value: string, maximum: number): string {
  return decodeEntities(value)
    .replace(/<[^>]*>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maximum);
}

function publicUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.username || parsed.password) return null;
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(?:utm_.+|cmpid|fbclid|gclid|guccounter|mc_cid|mc_eid|ocid|ref|ref_src|source)$/iu.test(key)) {
        parsed.searchParams.delete(key);
      }
    }
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./u, "");
    return parsed.toString();
  } catch {
    return null;
  }
}

function timestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const compact = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/u.exec(value);
  const normalized = compact
    ? `${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}Z`
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/u.test(value)
      ? `${value}Z`
      : value;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function abortableSignal(signal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("PROVIDER_TIMEOUT")), timeoutMs);
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    },
  };
}

async function fetchText(
  fetchImpl: FetchV1,
  value: URL,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<string> {
  const url = assertAllowedProviderUrlV1(value);
  const linked = abortableSignal(signal, timeoutMs);
  try {
    let current = url;
    for (let redirectCount = 0; redirectCount <= 2; redirectCount += 1) {
      const response = await fetchImpl(current, {
        headers: { "User-Agent": "Mozilla/5.0 compatible GLOVIS-FreightRisk/1.1" },
        redirect: "manual",
        signal: linked.signal,
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (location === null || redirectCount === 2) throw new Error("PROVIDER_REDIRECT_INVALID");
        current = assertAllowedRedirectV1(current, new URL(location, current));
        continue;
      }
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      return await response.text();
    }
    throw new Error("PROVIDER_REDIRECT_INVALID");
  } finally {
    linked.cleanup();
  }
}

function xmlValue(block: string, tag: string): string {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "iu").exec(block);
  return match ? plainText(match[1], tag === "description" ? 900 : 500) : "";
}

function rssCandidates(xml: string, provider: string): readonly RawCandidateV1[] {
  const candidates: RawCandidateV1[] = [];
  for (const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/giu)) {
    const item = match[1];
    const title = xmlValue(item, "title");
    const url = publicUrl(xmlValue(item, "link"));
    const publishedAt = timestamp(xmlValue(item, "pubDate"));
    if (!title || url === null || publishedAt === null) continue;
    candidates.push({ provider: xmlValue(item, "source") || provider, title, summary: xmlValue(item, "description"), url, publishedAt });
  }
  return candidates;
}

function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function wordPressCandidates(value: unknown, provider: string): readonly RawCandidateV1[] {
  if (!Array.isArray(value)) throw new Error("WORDPRESS_BODY_INVALID");
  const candidates: RawCandidateV1[] = [];
  for (const item of value) {
    if (!isObject(item)) continue;
    const titleRoot = isObject(item.title) ? item.title : null;
    const excerptRoot = isObject(item.excerpt) ? item.excerpt : null;
    const title = plainText(typeof titleRoot?.rendered === "string" ? titleRoot.rendered : "", 300);
    const summary = plainText(typeof excerptRoot?.rendered === "string" ? excerptRoot.rendered : "", 900);
    const url = publicUrl(item.link);
    const publishedAt = timestamp(item.date_gmt);
    if (!title || url === null || publishedAt === null) continue;
    candidates.push({ provider, title, summary, url, publishedAt });
  }
  return candidates;
}

function gdeltCandidates(value: unknown): readonly RawCandidateV1[] {
  if (!isObject(value) || !Array.isArray(value.articles)) throw new Error("GDELT_BODY_INVALID");
  const candidates: RawCandidateV1[] = [];
  for (const item of value.articles) {
    if (!isObject(item)) continue;
    const title = plainText(typeof item.title === "string" ? item.title : "", 300);
    const url = publicUrl(item.url);
    const publishedAt = timestamp(item.seendate);
    const source = typeof item.domain === "string" && item.domain ? item.domain : "GDELT";
    if (!title || url === null || publishedAt === null) continue;
    candidates.push({ provider: source, title, summary: "", url, publishedAt });
  }
  return candidates;
}

async function providerAttempt(
  provider: string,
  from: string,
  to: string,
  run: () => Promise<readonly RawCandidateV1[]>,
): Promise<ProviderResultV1> {
  const start = performance.now();
  try {
    const candidates = await run();
    return { provider, resultCode: candidates.length > 0 ? "OK" : "EMPTY", elapsedMs: Math.round(performance.now() - start), candidates };
  } catch (error) {
    const resultCode = error instanceof Error && error.name === "AbortError" ? "TIMEOUT_OR_ABORT" : "PROVIDER_ERROR";
    return { provider, resultCode, elapsedMs: Math.round(performance.now() - start), candidates: [] };
  }
}

function includesAny(text: string, terms: readonly string[]): boolean {
  return terms.some((term) => text.includes(term.toLowerCase()));
}

function countHits(text: string, terms: readonly string[]): number {
  return terms.reduce((count, term) => count + Number(text.includes(term.toLowerCase())), 0);
}

function scoreCandidate(
  candidate: RawCandidateV1,
  profile: RouteNewsProfileV1,
  from: string,
  to: string,
  encounter: number,
): ScoredCandidateV1 | null {
  const publishedDate = candidate.publishedAt.slice(0, 10);
  if (publishedDate < from || publishedDate > to) return null;
  const text = `${candidate.title} ${candidate.summary}`.normalize("NFKC").toLowerCase();
  const routeHits = countHits(text, profile.matchTerms);
  const portHits = countHits(text, profile.portTerms);
  if (routeHits === 0 || !includesAny(text, MARITIME_TERMS)) return null;
  const signalEntries = SIGNALS.filter(({ terms }) => includesAny(text, terms));
  if (signalEntries.length === 0) return null;
  const impactSignals = signalEntries.map(({ label }) => label);
  const impactScore = signalEntries.reduce((sum, entry) => sum + entry.score, 0);
  const hasUp = includesAny(text, UP_TERMS);
  const hasDown = includesAny(text, DOWN_TERMS);
  const directionCode = hasUp && hasDown ? "MIXED" : hasUp ? "UP" : hasDown ? "DOWN" : "NEUTRAL";
  const direction = directionCode === "UP" ? "상승 압력" : directionCode === "DOWN" ? "하락 압력" : directionCode === "MIXED" ? "혼합 신호" : "방향 불확실";
  const directRate = impactSignals.includes("운임·할증료");
  const severe = includesAny(text, ["booking suspension", "port closure", "terminal closure", "forced reroute", "port omission"]);
  const grade = directRate || severe ? "S" : impactScore >= 6 ? "A" : "B";
  const gradeLabel = grade === "S" ? "S 직접 가격·운항" : grade === "A" ? "A 직접 운영 영향" : "B 시장 참고";
  const factor = impactSignals.includes("통상정책") ? "통상" : impactSignals.includes("운항·항만 차질") ? "항만" : impactSignals.includes("선복·결항") ? "선복" : "시장동향";
  const summary = candidate.summary || `${profile.routeNameKo} 항로와 관련된 ${impactSignals.join("·")} 신호가 확인된 공개 기사입니다.`;
  return {
    article: {
      title: candidate.title,
      summary,
      originalTitle: candidate.title,
      source: candidate.provider,
      publishedAt: candidate.publishedAt,
      effectiveAt: null,
      url: candidate.url,
      direction,
      directionCode,
      factor,
      relevance: "ROUTE",
      impactScore,
      impactSignals,
      grade,
      gradeLabel,
      reason: `항로 키워드 ${routeHits}개, 항만 키워드 ${portHits}개와 ${impactSignals.length}개 운임 영향 신호가 일치했습니다.`,
      isBoundary: false,
      provenance: "LIVE_SEARCH",
    },
    routeScore: impactScore * 10 + routeHits * 2 + portHits * 3 + 1,
    encounter,
  };
}

function deduplicate(candidates: readonly ScoredCandidateV1[]): readonly ScoredCandidateV1[] {
  const urls = new Set<string>();
  const titles = new Set<string>();
  return candidates.filter(({ article }) => {
    const title = article.originalTitle.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (urls.has(article.url) || titles.has(title)) return false;
    urls.add(article.url);
    titles.add(title);
    return true;
  });
}

function windowFor(query: NewsQueryV1, now: Date) {
  const to = query.asOf === "latest" ? now.toISOString().slice(0, 10) : query.asOf;
  const days = query.retry === 0 ? 30 : 90;
  const start = new Date(`${to}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { from: start.toISOString().slice(0, 10), to, days } as const;
}

function providerTasks(
  query: NewsQueryV1,
  profile: RouteNewsProfileV1,
  from: string,
  to: string,
  fetchImpl: FetchV1,
  signal?: AbortSignal,
): readonly Promise<ProviderResultV1>[] {
  const broadQuery = `${profile.destinationQuery} AND (container OR liner OR port) AND (freight OR shipping OR congestion OR service OR surcharge)`;
  const gdeltTerms = profile.matchTerms.slice(0, 8).map((term) => term.includes(" ") ? `"${term}"` : term).join(" OR ");
  const gdeltQuery = `(${gdeltTerms}) AND (${CONTAINER_QUERY})`;
  const wordpressSearch = `${profile.matchTerms.slice(0, 4).join(" ")} container freight`;

  const gdelt = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  gdelt.search = new URLSearchParams({ query: gdeltQuery, mode: "artlist", maxrecords: "100", format: "json", sort: "datedesc", startdatetime: `${from.replaceAll("-", "")}000000`, enddatetime: `${to.replaceAll("-", "")}235959` }).toString();
  const google = new URL("https://news.google.com/rss/search");
  google.search = new URLSearchParams({ q: broadQuery, hl: "en-US", gl: "US", ceid: "US:en" }).toString();
  const bing = new URL("https://www.bing.com/news/search");
  bing.search = new URLSearchParams({ format: "RSS", q: broadQuery }).toString();

  const wordpress = (host: "container-news.com" | "gcaptain.com", provider: string) => {
    const url = new URL(`https://${host}/wp-json/wp/v2/posts`);
    url.search = new URLSearchParams({ after: `${from}T00:00:00Z`, before: `${to}T23:59:59Z`, per_page: "50", order: "desc", orderby: "date", search: wordpressSearch, _fields: "date_gmt,link,title,excerpt" }).toString();
    return providerAttempt(provider, from, to, async () => wordPressCandidates(JSON.parse(await fetchText(fetchImpl, url, 7_000, signal)), provider));
  };

  return [
    providerAttempt("GDELT", from, to, async () => gdeltCandidates(JSON.parse(await fetchText(fetchImpl, gdelt, 10_000, signal)))),
    providerAttempt("Google News", from, to, async () => rssCandidates(await fetchText(fetchImpl, google, 8_000, signal), "Google News")),
    providerAttempt("Bing News", from, to, async () => rssCandidates(await fetchText(fetchImpl, bing, 5_000, signal), "Bing News")),
    wordpress("container-news.com", "Container News"),
    wordpress("gcaptain.com", "gCaptain"),
  ];
}

export async function fetchLiveNewsV1(
  query: NewsQueryV1,
  signal?: AbortSignal,
  dependencies: LiveNewsDependenciesV1 = {},
): Promise<GatewayResultV1<NewsDataV1, NewsStateV1>> {
  const fetchImpl = dependencies.fetchImpl ?? globalThis.fetch;
  const now = dependencies.now ?? new Date();
  const profile = profileFor(query.route);
  const { from, to, days } = windowFor(query, now);
  const results = await Promise.all(providerTasks(query, profile, from, to, fetchImpl, signal));
  const merged = results.flatMap(({ candidates }) => candidates);
  let encounter = 0;
  const filtered = merged.flatMap((candidate) => {
    const scored = scoreCandidate(candidate, profile, from, to, encounter);
    encounter += 1;
    return scored === null ? [] : [scored];
  }).toSorted((left, right) => right.routeScore - left.routeScore || Date.parse(right.article.publishedAt) - Date.parse(left.article.publishedAt) || left.encounter - right.encounter);
  const unique = deduplicate(filtered);
  const selected = unique.slice(0, 5).map(({ article }, index): NewsArticleV1 => ({ id: String(index + 1), ...article }));
  const fetchedAt = now.toISOString();
  if (selected.length === 0) {
    return decodeNewsResultV1(gatewayUnavailable({
      state: "UNAVAILABLE",
      code: "NO_VALID_DATA",
      message: "현재 항로와 운임 영향 조건을 모두 충족하는 공개 기사를 찾지 못했습니다.",
      reasonCode: merged.length === 0 ? "PROVIDER_TOTAL_FAILURE_OR_EMPTY" : "NO_ROUTE_IMPACT_MATCH",
      source: "news-policy-v18",
      fetchedAt,
      attribution: "GDELT, Google News, Bing News, Container News, gCaptain",
      retryable: true,
    }), query);
  }
  const directImpact = filtered.filter(({ article }) => article.grade === "S").length;
  const contextual = filtered.filter(({ article }) => article.grade === "A").length;
  const routeFallback = filtered.filter(({ article }) => article.grade === "B").length;
  const data: NewsDataV1 = {
    routeId: query.route,
    stage: "FILTERED",
    llmAnalyzed: false,
    window: { from, to, days },
    policy: { providerVersion: 18, retry: query.retry },
    stats: {
      fetchedCandidates: merged.length,
      filteredCandidates: filtered.length,
      duplicatesRemoved: filtered.length - unique.length,
      selectedArticles: selected.length,
      successfulProviders: results.filter(({ candidates }) => candidates.length > 0).length,
      candidateBreakdown: { directImpact, contextual, routeFallback },
    },
    articles: selected,
    attempts: results.map(({ provider, resultCode, elapsedMs }) => ({ provider, resultCode, elapsedMs, from, to })),
  };
  return decodeNewsResultV1(gatewaySuccess({
    state: "LIVE",
    data,
    mode: "live",
    source: "news-policy-v18",
    asOf: to,
    fetchedAt,
    unit: "articles",
    isEstimate: false,
    attribution: "GDELT, Google News, Bing News, Container News, gCaptain",
    warnings: results.filter(({ resultCode }) => resultCode !== "OK").map(({ provider, resultCode }) => `${provider}:${resultCode}`),
    provider: results.filter(({ candidates }) => candidates.length > 0).map(({ provider }) => provider).join(", "),
  }), query);
}
