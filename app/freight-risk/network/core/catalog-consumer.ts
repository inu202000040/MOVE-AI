import { ROUTE_IDS } from "../../../contracts/routes";

export const NETWORK_CATALOG_COUNTS = {
  routes: 13,
  routeWaypoints: 297,
  ports: 57,
  uniquePortSeries: 56,
  chokepoints: 11,
  weather: 82,
} as const;

export const NETWORK_ROUTE_WAYPOINT_COUNTS = {
  KAUI: 17,
  KCI: 6,
  KJI: 8,
  KLEI: 28,
  KLWI: 11,
  KMDI: 40,
  KMEI: 30,
  KNEI: 52,
  KSAI: 25,
  KSEI: 12,
  KUEI: 28,
  KUWI: 10,
  KWAI: 30,
} as const satisfies Readonly<Record<(typeof ROUTE_IDS)[number], number>>;

export const NETWORK_CATALOG_SCHEMA_VERSION = "network-catalog-seam/v1" as const;
export const NETWORK_CATALOG_IDENTITY_SCHEMA_VERSION =
  "network-catalog-seam-identity/v1" as const;
export const NETWORK_ORIGIN_WEATHER_ENTITY_ID = "BUSAN" as const;

export const NETWORK_CHOKEPOINT_IDS = [
  "bab-el-mandeb",
  "cape-good-hope",
  "dover-strait",
  "gibraltar-strait",
  "hormuz-strait",
  "korea-strait",
  "luzon-strait",
  "malacca-strait",
  "panama-canal",
  "suez-canal",
  "taiwan-strait",
] as const;

export type Coordinate = readonly [longitude: number, latitude: number];

export interface NetworkRouteRecord {
  readonly id: string;
  readonly primaryPortId: string;
  readonly waypointCoordinates: readonly Coordinate[];
}

export interface NetworkPortRecord {
  readonly id: string;
  readonly routeId: string;
  readonly longitude: number;
  readonly latitude: number;
  readonly upstreamPortWatchId: string;
  readonly primary: boolean;
}

export interface NetworkChokepointRecord {
  readonly id: string;
  readonly longitude: number;
  readonly latitude: number;
  readonly upstreamPortWatchId: string;
  readonly corridorCoordinates: readonly Coordinate[];
  readonly gateHalfWidthKm: number;
}

export type NetworkWeatherKind = "port" | "chokepoint" | "route";

export interface NetworkWeatherRecord {
  readonly id: string;
  readonly kind: NetworkWeatherKind;
  readonly entityId: string;
  readonly longitude: number;
  readonly latitude: number;
}

export interface NetworkCatalogSeam {
  readonly schemaVersion: typeof NETWORK_CATALOG_SCHEMA_VERSION;
  readonly capturedAt: string;
  readonly timezone: "Asia/Seoul";
  readonly referenceManifestSha256: string;
  readonly routes: readonly NetworkRouteRecord[];
  readonly ports: readonly NetworkPortRecord[];
  readonly chokepoints: readonly NetworkChokepointRecord[];
  readonly weather: readonly NetworkWeatherRecord[];
}

export interface NetworkCatalogIdentity {
  readonly schemaVersion: typeof NETWORK_CATALOG_IDENTITY_SCHEMA_VERSION;
  readonly catalogSeamSha256: string;
  readonly byteSize: number;
  readonly routeCount: number;
  readonly routeWaypointCount: number;
  readonly portCount: number;
  readonly uniquePortSeriesCount: number;
  readonly chokepointCount: number;
  readonly weatherCount: number;
  readonly referenceManifestSha256: string;
}

export type CatalogValidationIssue =
  | "CATALOG_BYTES_INVALID"
  | "CATALOG_DIGEST_MISMATCH"
  | "CATALOG_STRUCTURE_INVALID"
  | "IDENTITY_INVALID"
  | "BYTE_SIZE_MISMATCH"
  | "COUNT_MISMATCH"
  | "REFERENCE_MANIFEST_MISMATCH";

export type NetworkCatalogValidation =
  | {
      readonly compatible: true;
      readonly catalog: NetworkCatalogSeam;
      readonly identity: NetworkCatalogIdentity;
    }
  | {
      readonly compatible: false;
      readonly issues: readonly CatalogValidationIssue[];
    };

export interface NetworkCatalogHandoff {
  readonly catalogBytes: Uint8Array;
  readonly identity: unknown;
  readonly producerByteSize: unknown;
  readonly referenceManifestBytes: Uint8Array;
}

const CATALOG_ROOT_KEYS = [
  "schemaVersion",
  "capturedAt",
  "timezone",
  "referenceManifestSha256",
  "routes",
  "ports",
  "chokepoints",
  "weather",
] as const;
const ROUTE_KEYS = ["id", "primaryPortId", "waypointCoordinates"] as const;
const PORT_KEYS = [
  "id",
  "routeId",
  "longitude",
  "latitude",
  "upstreamPortWatchId",
  "primary",
] as const;
const CHOKEPOINT_KEYS = [
  "id",
  "longitude",
  "latitude",
  "upstreamPortWatchId",
  "corridorCoordinates",
  "gateHalfWidthKm",
] as const;
const WEATHER_KEYS = [
  "id",
  "kind",
  "entityId",
  "longitude",
  "latitude",
] as const;
const IDENTITY_KEYS = [
  "schemaVersion",
  "catalogSeamSha256",
  "byteSize",
  "routeCount",
  "routeWaypointCount",
  "portCount",
  "uniquePortSeriesCount",
  "chokepointCount",
  "weatherCount",
  "referenceManifestSha256",
] as const;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key, index) => key === keys[index]);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

function isFiniteCoordinate(longitude: unknown, latitude: unknown): boolean {
  return (
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90
  );
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function parseCoordinate(value: unknown): Coordinate | null {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !isFiniteCoordinate(value[0], value[1])
  ) {
    return null;
  }
  return [value[0], value[1]];
}

function parseRoute(value: unknown): NetworkRouteRecord | null {
  if (!isRecord(value) || !hasExactKeys(value, ROUTE_KEYS)) {
    return null;
  }
  if (
    !isIdentifier(value.id) ||
    !isIdentifier(value.primaryPortId) ||
    !Array.isArray(value.waypointCoordinates) ||
    value.waypointCoordinates.length < 2
  ) {
    return null;
  }
  const waypointCoordinates = value.waypointCoordinates.map(parseCoordinate);
  if (waypointCoordinates.some((coordinate) => coordinate === null)) {
    return null;
  }
  return {
    id: value.id,
    primaryPortId: value.primaryPortId,
    waypointCoordinates: waypointCoordinates.filter(
      (coordinate): coordinate is Coordinate => coordinate !== null,
    ),
  };
}

function parsePort(value: unknown): NetworkPortRecord | null {
  if (!isRecord(value) || !hasExactKeys(value, PORT_KEYS)) {
    return null;
  }
  const longitude = value.longitude;
  const latitude = value.latitude;
  if (
    !isIdentifier(value.id) ||
    !isIdentifier(value.routeId) ||
    !isIdentifier(value.upstreamPortWatchId) ||
    typeof value.primary !== "boolean" ||
    !isFiniteCoordinate(longitude, latitude) ||
    typeof longitude !== "number" ||
    typeof latitude !== "number"
  ) {
    return null;
  }
  return {
    id: value.id,
    routeId: value.routeId,
    longitude,
    latitude,
    upstreamPortWatchId: value.upstreamPortWatchId,
    primary: value.primary,
  };
}

function parseChokepoint(value: unknown): NetworkChokepointRecord | null {
  if (!isRecord(value) || !hasExactKeys(value, CHOKEPOINT_KEYS)) {
    return null;
  }
  const longitude = value.longitude;
  const latitude = value.latitude;
  const gateHalfWidthKm = value.gateHalfWidthKm;
  if (
    !isIdentifier(value.id) ||
    !isIdentifier(value.upstreamPortWatchId) ||
    !isFiniteCoordinate(longitude, latitude) ||
    typeof longitude !== "number" ||
    typeof latitude !== "number" ||
    !Array.isArray(value.corridorCoordinates) ||
    value.corridorCoordinates.length < 2 ||
    typeof gateHalfWidthKm !== "number" ||
    !Number.isFinite(gateHalfWidthKm) ||
    gateHalfWidthKm <= 0
  ) {
    return null;
  }
  const corridorCoordinates = value.corridorCoordinates.map(parseCoordinate);
  if (corridorCoordinates.some((coordinate) => coordinate === null)) return null;
  return {
    id: value.id,
    longitude,
    latitude,
    upstreamPortWatchId: value.upstreamPortWatchId,
    corridorCoordinates: corridorCoordinates.filter(
      (coordinate): coordinate is Coordinate => coordinate !== null,
    ),
    gateHalfWidthKm,
  };
}

function parseWeather(value: unknown): NetworkWeatherRecord | null {
  if (!isRecord(value) || !hasExactKeys(value, WEATHER_KEYS)) {
    return null;
  }
  const longitude = value.longitude;
  const latitude = value.latitude;
  if (
    !isIdentifier(value.id) ||
    !isIdentifier(value.entityId) ||
    (value.kind !== "port" &&
      value.kind !== "chokepoint" &&
      value.kind !== "route") ||
    !isFiniteCoordinate(longitude, latitude) ||
    typeof longitude !== "number" ||
    typeof latitude !== "number"
  ) {
    return null;
  }
  return {
    id: value.id,
    kind: value.kind,
    entityId: value.entityId,
    longitude,
    latitude,
  };
}

function isSortedUnique(records: readonly { readonly id: string }[]): boolean {
  return records.every(
    (record, index) => index === 0 || records[index - 1]!.id < record.id,
  );
}

function sameStringSet(actual: readonly string[], expected: readonly string[]): boolean {
  if (actual.length !== expected.length) {
    return false;
  }
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  return sortedActual.every((value, index) => value === sortedExpected[index]);
}

export function decodeNetworkCatalogSeam(
  value: unknown,
): NetworkCatalogSeam | null {
  if (!isRecord(value) || !hasExactKeys(value, CATALOG_ROOT_KEYS)) {
    return null;
  }
  if (
    value.schemaVersion !== NETWORK_CATALOG_SCHEMA_VERSION ||
    typeof value.capturedAt !== "string" ||
    !Number.isFinite(Date.parse(value.capturedAt)) ||
    value.timezone !== "Asia/Seoul" ||
    typeof value.referenceManifestSha256 !== "string" ||
    !SHA256_PATTERN.test(value.referenceManifestSha256) ||
    !Array.isArray(value.routes) ||
    !Array.isArray(value.ports) ||
    !Array.isArray(value.chokepoints) ||
    !Array.isArray(value.weather)
  ) {
    return null;
  }

  const routes = value.routes.map(parseRoute);
  const ports = value.ports.map(parsePort);
  const chokepoints = value.chokepoints.map(parseChokepoint);
  const weather = value.weather.map(parseWeather);
  if (
    routes.some((record) => record === null) ||
    ports.some((record) => record === null) ||
    chokepoints.some((record) => record === null) ||
    weather.some((record) => record === null)
  ) {
    return null;
  }

  const parsedRoutes = routes.filter(
    (record): record is NetworkRouteRecord => record !== null,
  );
  const parsedPorts = ports.filter(
    (record): record is NetworkPortRecord => record !== null,
  );
  const parsedChokepoints = chokepoints.filter(
    (record): record is NetworkChokepointRecord => record !== null,
  );
  const parsedWeather = weather.filter(
    (record): record is NetworkWeatherRecord => record !== null,
  );

  if (
    parsedRoutes.length !== NETWORK_CATALOG_COUNTS.routes ||
    parsedPorts.length !== NETWORK_CATALOG_COUNTS.ports ||
    parsedChokepoints.length !== NETWORK_CATALOG_COUNTS.chokepoints ||
    parsedWeather.length !== NETWORK_CATALOG_COUNTS.weather ||
    parsedRoutes.reduce(
      (total, route) => total + route.waypointCoordinates.length,
      0,
    ) !== NETWORK_CATALOG_COUNTS.routeWaypoints ||
    !isSortedUnique(parsedRoutes) ||
    !isSortedUnique(parsedPorts) ||
    !isSortedUnique(parsedChokepoints) ||
    !isSortedUnique(parsedWeather) ||
    !sameStringSet(
      parsedRoutes.map((route) => route.id),
      ROUTE_IDS,
    ) ||
    parsedRoutes.some(
      (route) =>
        route.waypointCoordinates.length !==
        NETWORK_ROUTE_WAYPOINT_COUNTS[route.id as keyof typeof NETWORK_ROUTE_WAYPOINT_COUNTS],
    ) ||
    !sameStringSet(
      parsedChokepoints.map((chokepoint) => chokepoint.id),
      NETWORK_CHOKEPOINT_IDS,
    )
  ) {
    return null;
  }

  const routeIds = new Set(parsedRoutes.map((route) => route.id));
  const portIds = new Set(parsedPorts.map((port) => port.id));
  const chokepointIds = new Set(parsedChokepoints.map((item) => item.id));
  const uniquePortSeries = new Set(
    parsedPorts.map((port) => port.upstreamPortWatchId),
  );
  if (uniquePortSeries.size !== NETWORK_CATALOG_COUNTS.uniquePortSeries) {
    return null;
  }

  for (const route of parsedRoutes) {
    const primaryPorts = parsedPorts.filter(
      (port) => port.routeId === route.id && port.primary,
    );
    if (
      primaryPorts.length !== 1 ||
      primaryPorts[0]?.id !== route.primaryPortId
    ) {
      return null;
    }
  }
  if (parsedPorts.some((port) => !routeIds.has(port.routeId))) {
    return null;
  }
  if (
    parsedWeather.some((item) => {
      if (item.kind === "route") {
        return !routeIds.has(item.entityId);
      }
      if (item.kind === "port") {
        return (
          item.entityId !== NETWORK_ORIGIN_WEATHER_ENTITY_ID &&
          !portIds.has(item.entityId)
        );
      }
      return !chokepointIds.has(item.entityId);
    })
  ) {
    return null;
  }
  if (
    parsedWeather.some(
      (item) => item.id !== `${item.kind}:${item.entityId}`,
    )
  ) {
    return null;
  }
  const weatherKindCounts = parsedWeather.reduce(
    (counts, item) => ({ ...counts, [item.kind]: counts[item.kind] + 1 }),
    { port: 0, chokepoint: 0, route: 0 },
  );
  if (
    weatherKindCounts.port !== NETWORK_CATALOG_COUNTS.ports + 1 ||
    weatherKindCounts.chokepoint !== NETWORK_CATALOG_COUNTS.chokepoints ||
    weatherKindCounts.route !== NETWORK_CATALOG_COUNTS.routes
  ) {
    return null;
  }

  return {
    schemaVersion: NETWORK_CATALOG_SCHEMA_VERSION,
    capturedAt: value.capturedAt,
    timezone: "Asia/Seoul",
    referenceManifestSha256: value.referenceManifestSha256,
    routes: parsedRoutes,
    ports: parsedPorts,
    chokepoints: parsedChokepoints,
    weather: parsedWeather,
  };
}

export function decodeNetworkCatalogIdentity(
  value: unknown,
): NetworkCatalogIdentity | null {
  if (!isRecord(value) || !hasExactKeys(value, IDENTITY_KEYS)) {
    return null;
  }
  if (
    value.schemaVersion !== NETWORK_CATALOG_IDENTITY_SCHEMA_VERSION ||
    typeof value.catalogSeamSha256 !== "string" ||
    !SHA256_PATTERN.test(value.catalogSeamSha256) ||
    typeof value.referenceManifestSha256 !== "string" ||
    !SHA256_PATTERN.test(value.referenceManifestSha256) ||
    !isNonnegativeInteger(value.byteSize) ||
    !isNonnegativeInteger(value.routeCount) ||
    !isNonnegativeInteger(value.routeWaypointCount) ||
    !isNonnegativeInteger(value.portCount) ||
    !isNonnegativeInteger(value.uniquePortSeriesCount) ||
    !isNonnegativeInteger(value.chokepointCount) ||
    !isNonnegativeInteger(value.weatherCount)
  ) {
    return null;
  }
  return {
    schemaVersion: NETWORK_CATALOG_IDENTITY_SCHEMA_VERSION,
    catalogSeamSha256: value.catalogSeamSha256,
    byteSize: value.byteSize,
    routeCount: value.routeCount,
    routeWaypointCount: value.routeWaypointCount,
    portCount: value.portCount,
    uniquePortSeriesCount: value.uniquePortSeriesCount,
    chokepointCount: value.chokepointCount,
    weatherCount: value.weatherCount,
    referenceManifestSha256: value.referenceManifestSha256,
  };
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const exactBytes = Uint8Array.from(bytes);
  const digest = await crypto.subtle.digest("SHA-256", exactBytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function addIssue(
  issues: CatalogValidationIssue[],
  issue: CatalogValidationIssue,
): void {
  if (!issues.includes(issue)) {
    issues.push(issue);
  }
}

export async function validateNetworkCatalogHandoff(
  handoff: NetworkCatalogHandoff,
): Promise<NetworkCatalogValidation> {
  const issues: CatalogValidationIssue[] = [];
  const identity = decodeNetworkCatalogIdentity(handoff.identity);
  if (!identity) {
    return { compatible: false, issues: ["IDENTITY_INVALID"] };
  }

  if (
    typeof handoff.producerByteSize !== "number" ||
    !Number.isInteger(handoff.producerByteSize) ||
    handoff.producerByteSize < 0 ||
    handoff.catalogBytes.byteLength !== identity.byteSize ||
    handoff.catalogBytes.byteLength !== handoff.producerByteSize
  ) {
    addIssue(issues, "BYTE_SIZE_MISMATCH");
  }

  const [catalogDigest, manifestDigest] = await Promise.all([
    sha256Hex(handoff.catalogBytes),
    sha256Hex(handoff.referenceManifestBytes),
  ]);
  if (catalogDigest !== identity.catalogSeamSha256) {
    addIssue(issues, "CATALOG_DIGEST_MISMATCH");
  }

  let decoded: unknown;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      handoff.catalogBytes,
    );
    decoded = JSON.parse(text);
  } catch {
    addIssue(issues, "CATALOG_BYTES_INVALID");
  }
  const catalog = decodeNetworkCatalogSeam(decoded);
  if (!catalog) {
    addIssue(issues, "CATALOG_STRUCTURE_INVALID");
  }

  if (catalog) {
    if (
      identity.routeCount !== catalog.routes.length ||
      identity.routeWaypointCount !== catalog.routes.reduce(
        (total, route) => total + route.waypointCoordinates.length,
        0,
      ) ||
      identity.portCount !== catalog.ports.length ||
      identity.uniquePortSeriesCount !==
        new Set(catalog.ports.map((port) => port.upstreamPortWatchId)).size ||
      identity.chokepointCount !== catalog.chokepoints.length ||
      identity.weatherCount !== catalog.weather.length
    ) {
      addIssue(issues, "COUNT_MISMATCH");
    }
    if (
      catalog.referenceManifestSha256 !== manifestDigest ||
      identity.referenceManifestSha256 !== manifestDigest
    ) {
      addIssue(issues, "REFERENCE_MANIFEST_MISMATCH");
    }
  }

  if (issues.length > 0 || !catalog) {
    return { compatible: false, issues };
  }
  return { compatible: true, catalog, identity };
}
