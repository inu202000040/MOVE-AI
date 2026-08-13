export const ROUTE_IDS = [
  "KUWI",
  "KUEI",
  "KNEI",
  "KMDI",
  "KMEI",
  "KAUI",
  "KLEI",
  "KLWI",
  "KSAI",
  "KWAI",
  "KCI",
  "KJI",
  "KSEI",
] as const;

export type RouteId = (typeof ROUTE_IDS)[number];

export const DEFAULT_ROUTE_ID: RouteId = "KNEI";

export const ROUTE_LABELS: Readonly<Record<RouteId, string>> = {
  KUWI: "북미서안",
  KUEI: "북미동안",
  KNEI: "유럽",
  KMDI: "지중해",
  KMEI: "중동",
  KAUI: "호주",
  KLEI: "남미동안",
  KLWI: "남미서안",
  KSAI: "남아프리카",
  KWAI: "서아프리카",
  KCI: "중국",
  KJI: "일본",
  KSEI: "동남아",
};

const ROUTE_ID_SET: ReadonlySet<string> = new Set(ROUTE_IDS);

export function isRouteId(value: unknown): value is RouteId {
  return typeof value === "string" && ROUTE_ID_SET.has(value);
}

export const PAGE_PATHS = {
  landing: "/",
  dashboard: "/freight-risk/dashboard",
  models: "/freight-risk/models",
  network: "/freight-risk/network",
  allocation: "/freight-risk/allocation",
} as const;

export type PageId = keyof typeof PAGE_PATHS;
export type PagePath = (typeof PAGE_PATHS)[PageId];
