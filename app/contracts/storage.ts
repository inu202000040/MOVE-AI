export const STORAGE_KEYS = {
  route: "move-ai:route:v1",
  representativePrefix: "move-ai:representative:v1:",
  tuningPrefix: "move-ai:tuning:v1:",
  routeNewsPrefix: "move-ai:route-news:v1:",
  forecastInsightPrefix: "move-ai:forecast-insight:v1:",
} as const;

export interface StoredPayloadBaseV1<
  TSchemaVersion extends string,
  TDomainIdentity,
> {
  readonly schemaVersion: TSchemaVersion;
  readonly savedAt: string;
  readonly domainIdentity: TDomainIdentity;
}
