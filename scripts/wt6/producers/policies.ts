import { ROUTE_IDS } from "../../../app/contracts/routes";
import { sortedRecord, sortCodeUnits } from "../canonical";
import {
  assertExactCount,
  nullableNumber,
  nullableScalar,
  nullableString,
  requireInteger,
  requireString,
} from "../schema";
import type { TableRecord } from "../xlsx";

function terms(value: string | null): readonly string[] {
  if (!value) return [];
  return value
    .split("|")
    .map((term) => term.trim())
    .filter(Boolean);
}

export function produceNewsPolicy(input: {
  readonly generatedAt: string;
  readonly profiles: readonly TableRecord[];
  readonly providers: readonly TableRecord[];
}) {
  assertExactCount(input.profiles.length, 13, "news route profiles");
  const profileEntries = input.profiles.map((profile) => {
    const routeCode = requireString(profile, "route_code");
    if (!(ROUTE_IDS as readonly string[]).includes(routeCode)) {
      throw new Error(`Unknown news route ${routeCode}`);
    }
    const primaryLookbackDays = requireInteger(profile, "primary_lookback_days");
    const fallbackLookbackDays = requireInteger(profile, "fallback_lookback_days");
    if (primaryLookbackDays !== 30 || fallbackLookbackDays !== 90) {
      throw new Error(`News window mismatch for ${routeCode}`);
    }
    return [
      routeCode,
      {
        routeCode,
        routeNameKo: requireString(profile, "route_name_ko"),
        destinationQuery: requireString(profile, "destination_query"),
        operationalQuery: requireString(profile, "operational_query"),
        matchTerms: terms(requireString(profile, "match_terms")),
        portTerms: terms(requireString(profile, "port_terms")),
        localQuery: nullableString(profile, "local_query"),
        primaryLookbackDays,
        fallbackLookbackDays,
      },
    ] as const;
  });

  const providers = input.providers
    .map((provider) => ({
      category: requireString(provider, "category"),
      order: requireInteger(provider, "order"),
      provider: requireString(provider, "provider"),
      execution: requireString(provider, "execution"),
      endpoint: requireString(provider, "endpoint"),
      authentication: requireString(provider, "auth"),
      unit: requireString(provider, "unit"),
      notes: requireString(provider, "notes"),
    }))
    .sort((left, right) =>
      sortCodeUnits(left.category, right.category) || left.order - right.order,
    );

  return {
    schemaVersion: "move-ai/news-policy/v18",
    generatedAt: input.generatedAt,
    providerVersion: 18,
    execution: "parallel fan-out; deterministic final ranking",
    maxDisplayedArticles: 5,
    profiles: sortedRecord(profileEntries),
    providers,
  };
}

export function produceInsightPolicy(generatedAt: string) {
  return {
    schemaVersion: "move-ai/insight-policy/v1",
    generatedAt,
    engines: ["GEMINI", "RULE_FALLBACK"],
    forbiddenEngines: ["OPENAI"],
    gemini: {
      keyOrder: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
      modelCandidates: ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"],
      totalTimeoutMs: 25_000,
      maxOutputTokens: 2_048,
      thinkingBudget: 1_024,
      advanceCandidateStatus: 404,
    },
    fallback: {
      dominantTiePriority: ["UP", "FLAT", "DOWN"],
      high: { maxIntervalWidthPct: 20, minSelectedAgreement: 0.7, minCoveragePct: 85 },
      medium: { maxIntervalWidthPct: 35, minSelectedAgreement: 0.5 },
      factorLimitPerDirection: 2,
    },
  };
}

const RUNTIME_PROVIDER_CATEGORIES = [
  "FX",
  "BRENT",
  "BUNKER",
  "HARPEX",
  "NEWS",
  "TRANSLATION",
  "WEATHER",
  "MARINE",
  "VISIBILITY",
  "INSIGHT",
] as const;

export function produceRuntimeProviderPolicy(input: {
  readonly generatedAt: string;
  readonly providers: readonly TableRecord[];
}) {
  const allowedCategories = new Set<string>(RUNTIME_PROVIDER_CATEGORIES);
  const providers = input.providers
    .filter((row) => allowedCategories.has(requireString(row, "category")))
    .filter((row) => requireString(row, "provider") !== "OpenAI Responses")
    .map((row) => {
      const category = requireString(row, "category");
      const provider = requireString(row, "provider");
      const endpoint = requireString(row, "endpoint");
      if (provider !== "Rule fallback" && !endpoint.startsWith("https://")) {
        throw new Error(`Runtime provider ${provider} must use HTTPS`);
      }
      return {
        category,
        order: requireInteger(row, "order"),
        provider,
        execution: requireString(row, "execution"),
        endpoint,
        authentication: requireString(row, "auth"),
        unit: category === "HARPEX" ? "Index" : requireString(row, "unit"),
        notes: requireString(row, "notes"),
      };
    })
    .sort((left, right) =>
      sortCodeUnits(left.category, right.category) || left.order - right.order,
    );

  const insightProviders = providers
    .filter((provider) => provider.category === "INSIGHT")
    .map((provider) => provider.provider);
  if (insightProviders.join(",") !== "Gemini,Rule fallback") {
    throw new Error("Runtime insight provider allowlist must be Gemini then Rule fallback");
  }

  const allowedHosts = [...new Set(
    providers
      .filter((provider) => provider.endpoint.startsWith("https://"))
      .map((provider) => new URL(provider.endpoint).hostname),
  )].sort(sortCodeUnits);

  return {
    schemaVersion: "move-ai/runtime-provider-policy/v1",
    generatedAt: input.generatedAt,
    providers,
    allowedHosts,
    serverEnvironmentNames: [
      "MOVE_AI_DATA_MODE",
      "GEMINI_API_KEY",
      "GOOGLE_API_KEY",
      "GEMINI_INSIGHT_MODEL",
      "KCCI_ENGINE_URL",
      "KCCI_ENGINE_TOKEN",
      "KCCI_MAX_REQUEST_BYTES",
      "MET_NO_USER_AGENT",
    ],
    policies: {
      market: { attemptTimeoutMs: 7_000, maximumAttempts: 1 },
      news: { execution: "parallel", primaryWindowDays: 30, retryWindowDays: 90 },
      insight: { providerOrder: ["Gemini", "Rule fallback"], totalTimeoutMs: 25_000 },
      port: { chunkSize: 8, concurrency: 3, pageSize: 1_000, maximumPages: 50, attemptTimeoutMs: 12_000, maximumAttempts: 3, backoffMs: [350, 700] },
      chokepoint: { attemptTimeoutMs: 12_000, maximumAttempts: 1 },
      weather: {
        atmosphere: { concurrency: 8, attemptTimeoutMs: 20_000, maximumAttempts: 2, retryStatuses: [429] },
        marine: { chunkSize: 24, attemptTimeoutMs: 20_000, maximumAttempts: 1 },
        visibility: { attemptTimeoutMs: 25_000, maximumAttempts: 2, maximumStationDistanceKm: 75, maximumObservationAgeMinutes: 180, futureToleranceMinutes: 15 },
      },
      tuning: { totalTimeoutMs: 600_000, maximumAttempts: 1 },
    },
  };
}

export function produceTuningConfig(input: {
  readonly generatedAt: string;
  readonly parameters: readonly TableRecord[];
  readonly presets: readonly TableRecord[];
  readonly windows: readonly TableRecord[];
}) {
  assertExactCount(input.parameters.length, 33, "tuning parameters");
  assertExactCount(input.presets.length, 99, "tuning preset rows");
  assertExactCount(input.windows.length, 3, "tuning windows");
  const parametersByModel = new Map<string, TableRecord[]>();
  for (const row of input.parameters) {
    const id = requireString(row, "model_id");
    const values = parametersByModel.get(id);
    if (values) values.push(row);
    else parametersByModel.set(id, [row]);
  }
  const parameterCatalog = sortedRecord(
    [...parametersByModel].map(([modelId, rows]) => [
      modelId,
      rows
        .map((row) => ({
          key: requireString(row, "parameter_key"),
          labelKo: requireString(row, "label_ko"),
          descriptionKo: requireString(row, "description_ko"),
          inputType: requireString(row, "input_type"),
          minimum: nullableNumber(row, "minimum"),
          maximum: nullableNumber(row, "maximum"),
          step: nullableNumber(row, "step"),
          optionsJson: nullableString(row, "options_json"),
        }))
        .sort((left, right) => sortCodeUnits(left.key, right.key)),
    ] as const),
  );

  const presetCatalog = sortedRecord(
    [...new Set(input.presets.map((row) => requireString(row, "preset_id")))].map((presetId) => [
      presetId,
      sortedRecord(
        input.presets
          .filter((row) => requireString(row, "preset_id") === presetId)
          .map((row) => {
            const value = nullableScalar(row, "parameter_value");
            if (typeof value !== "string" && typeof value !== "number") {
              throw new Error("Tuning parameter value must be string or number");
            }
            return [
              `${requireString(row, "model_id")}.${requireString(row, "parameter_key")}`,
              value,
            ] as const;
          }),
      ),
    ] as const),
  );

  const trainingWindows = input.windows.map((window) => ({
    value: requireString(window, "value"),
    label: requireString(window, "label"),
    description: requireString(window, "description"),
  }));

  return {
    schemaVersion: "move-ai/tuning-config/v1",
    generatedAt: input.generatedAt,
    requestLimits: {
      minimumObservations: 108,
      maximumObservations: 10_000,
      minimumEvaluationOrigins: 36,
      maximumEvaluationOrigins: 52,
      timeoutMs: 600_000,
    },
    parameterCatalog,
    presetCatalog,
    trainingWindows,
  };
}
