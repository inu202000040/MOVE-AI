import type {
  Coordinate,
  NetworkChokepointRecord,
  NetworkPortRecord,
  NetworkRouteRecord,
  NetworkWeatherRecord,
} from "./catalog-consumer";
import { splitAntimeridian } from "./geometry";

export type GeoJsonGeometry =
  | { readonly type: "Point"; readonly coordinates: Coordinate }
  | {
      readonly type: "MultiLineString";
      readonly coordinates: readonly (readonly Coordinate[])[];
    };

export interface GeoJsonFeature<
  TGeometry extends GeoJsonGeometry = GeoJsonGeometry,
  TProperties extends Readonly<Record<string, unknown>> = Readonly<
    Record<string, unknown>
  >,
> {
  readonly type: "Feature";
  readonly id: string;
  readonly geometry: TGeometry;
  readonly properties: TProperties;
}

export interface GeoJsonFeatureCollection<
  TFeature extends GeoJsonFeature = GeoJsonFeature,
> {
  readonly type: "FeatureCollection";
  readonly features: readonly TFeature[];
}

export type NetworkGeoJsonSourceId =
  | "network-globe-graticule"
  | "network-routes"
  | "network-connectors"
  | "network-chokepoint-corridors"
  | "network-chokepoint-gates"
  | "network-chokepoints"
  | "network-ports"
  | "network-weather";

export type NetworkGeoJsonSources = Readonly<
  Record<NetworkGeoJsonSourceId, GeoJsonFeatureCollection>
>;

export interface NetworkGeometryCatalog {
  readonly routes: readonly NetworkRouteRecord[];
  readonly ports: readonly NetworkPortRecord[];
  readonly chokepoints: readonly NetworkChokepointRecord[];
  readonly weather: readonly NetworkWeatherRecord[];
}

function emptyFeatureCollection(): GeoJsonFeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function point(longitude: number, latitude: number): GeoJsonGeometry {
  return { type: "Point", coordinates: [longitude, latitude] };
}

export function createGlobeGraticule(): GeoJsonFeatureCollection {
  const lines: Coordinate[][] = [];
  for (let longitude = -180; longitude < 180; longitude += 30) {
    const meridian: Coordinate[] = [];
    for (let latitude = -80; latitude <= 80; latitude += 2) {
      meridian.push([longitude, latitude]);
    }
    lines.push(meridian);
  }
  for (let latitude = -60; latitude <= 60; latitude += 20) {
    const parallel: Coordinate[] = [];
    for (let longitude = -180; longitude <= 180; longitude += 2) {
      parallel.push([longitude, latitude]);
    }
    lines.push(parallel);
  }
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: "globe-graticule",
        geometry: { type: "MultiLineString", coordinates: lines },
        properties: { id: "globe-graticule", decorative: true },
      },
    ],
  };
}

function routeFeature(
  route: NetworkRouteRecord,
): GeoJsonFeature {
  return {
    type: "Feature",
    id: route.id,
    geometry: {
      type: "MultiLineString",
      coordinates: splitAntimeridian(route.waypointCoordinates),
    },
    properties: {
      id: route.id,
      routeId: route.id,
      primaryPortId: route.primaryPortId,
    },
  };
}

function connectorFeature(
  port: NetworkPortRecord,
  primaryPort: NetworkPortRecord,
): GeoJsonFeature {
  return {
    type: "Feature",
    id: `connector:${port.id}`,
    geometry: {
      type: "MultiLineString",
      coordinates: splitAntimeridian([
        [primaryPort.longitude, primaryPort.latitude],
        [port.longitude, port.latitude],
      ]),
    },
    properties: {
      id: `connector:${port.id}`,
      routeId: port.routeId,
      primaryPortId: primaryPort.id,
      portId: port.id,
    },
  };
}

export function catalogToNetworkGeoJson(
  catalog: NetworkGeometryCatalog,
): NetworkGeoJsonSources {
  const primaryPortByRoute = new Map(
    catalog.ports
      .filter((port) => port.primary)
      .map((port) => [port.routeId, port]),
  );
  const connectors = catalog.ports
    .filter((port) => !port.primary)
    .map((port) => {
      const primaryPort = primaryPortByRoute.get(port.routeId);
      if (!primaryPort) {
        throw new Error(`Missing primary port for route ${port.routeId}`);
      }
      return connectorFeature(port, primaryPort);
    });

  return {
    "network-globe-graticule": createGlobeGraticule(),
    "network-routes": {
      type: "FeatureCollection",
      features: catalog.routes.map(routeFeature),
    },
    "network-connectors": {
      type: "FeatureCollection",
      features: connectors,
    },
    "network-chokepoint-corridors": emptyFeatureCollection(),
    "network-chokepoint-gates": emptyFeatureCollection(),
    "network-chokepoints": {
      type: "FeatureCollection",
      features: catalog.chokepoints.map((chokepoint) => ({
        type: "Feature",
        id: chokepoint.id,
        geometry: point(chokepoint.longitude, chokepoint.latitude),
        properties: {
          id: chokepoint.id,
          chokepointId: chokepoint.id,
          upstreamPortWatchId: chokepoint.upstreamPortWatchId,
        },
      })),
    },
    "network-ports": {
      type: "FeatureCollection",
      features: catalog.ports.map((port) => ({
        type: "Feature",
        id: port.id,
        geometry: point(port.longitude, port.latitude),
        properties: {
          id: port.id,
          portId: port.id,
          routeId: port.routeId,
          primary: port.primary,
          upstreamPortWatchId: port.upstreamPortWatchId,
        },
      })),
    },
    "network-weather": {
      type: "FeatureCollection",
      features: catalog.weather.map((weather) => ({
        type: "Feature",
        id: weather.id,
        geometry: point(weather.longitude, weather.latitude),
        properties: {
          id: weather.id,
          weatherId: weather.id,
          kind: weather.kind,
          entityId: weather.entityId,
          risk: "normal",
        },
      })),
    },
  };
}
