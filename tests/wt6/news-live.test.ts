import assert from "node:assert/strict";
import test from "node:test";

import { fetchLiveNewsV1 } from "../../app/data/runtime/news-live";

const query = { route: "KNEI", asOf: "latest", providerVersion: 18, retry: 0 } as const;
const now = new Date("2026-08-13T09:00:00Z");

function fakeFetch(input: string | URL | Request): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : input.toString());
  if (url.hostname === "api.gdeltproject.org") {
    return Promise.resolve(Response.json({ articles: [{
      url: "https://example.com/europe-rate-rise",
      title: "Europe container freight rates rise after Rotterdam congestion",
      seendate: "20260812T120000Z",
      domain: "example.com",
    }] }));
  }
  if (url.hostname === "news.google.com") {
    return Promise.resolve(new Response(`<?xml version="1.0"?><rss><channel><item><title>Hamburg port congestion delays container shipping</title><link>https://example.org/hamburg-delay</link><pubDate>Tue, 11 Aug 2026 10:00:00 GMT</pubDate><description>Terminal congestion and service delays affect North Europe freight.</description><source>Example Wire</source></item></channel></rss>`));
  }
  if (url.hostname === "www.bing.com") return Promise.resolve(new Response("<?xml version=\"1.0\"?><rss><channel></channel></rss>"));
  if (url.hostname === "container-news.com") {
    return Promise.resolve(Response.json([{ date_gmt: "2026-08-10T08:00:00", link: "https://container-news.com/antwerp-surcharge", title: { rendered: "Carrier adds Antwerp congestion surcharge" }, excerpt: { rendered: "Container carriers announced a surcharge after terminal congestion." } }]));
  }
  if (url.hostname === "gcaptain.com") return Promise.resolve(Response.json([]));
  return Promise.reject(new Error(`Unexpected provider ${url.hostname}`));
}

test("live news fan-out returns validated route-scoped articles in deterministic order", async () => {
  const result = await fetchLiveNewsV1(query, undefined, { fetchImpl: fakeFetch, now });
  assert.equal(result.state, "LIVE");
  assert.equal(result.meta.mode, "live");
  assert.equal(result.data?.routeId, "KNEI");
  assert.equal(result.data?.articles.length, 3);
  assert.deepEqual(result.data?.articles.map(({ id }) => id), ["1", "2", "3"]);
  assert.equal(result.data?.stats.successfulProviders, 3);
  assert.equal(result.data?.attempts.length, 5);
  assert.ok(result.data?.articles.every(({ provenance, relevance, url }) => provenance === "LIVE_SEARCH" && relevance === "ROUTE" && url.startsWith("https://")));
});

test("live news fails closed when providers return no relevant article", async () => {
  const emptyFetch = () => Promise.resolve(Response.json([]));
  const result = await fetchLiveNewsV1(query, undefined, { fetchImpl: emptyFetch, now });
  assert.equal(result.state, "UNAVAILABLE");
  assert.equal(result.data, null);
  assert.equal(result.error?.code, "NO_VALID_DATA");
});
