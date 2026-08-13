"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { useFreightRiskRoute } from "../../components/shell";
import { DashboardApp } from "./DashboardApp";
import {
  UNAVAILABLE_DASHBOARD_GATEWAY,
  UNAVAILABLE_REPRESENTATIVE_SOURCE,
  createRepresentativeSnapshotReader,
  requestDashboardSnapshot,
  subscribeRepresentativeSource,
  type DashboardDataGatewayV1,
  type DashboardRepresentativeSourceV1,
  type DashboardSnapshotSurfaceV1,
} from "./domain";

export interface DashboardRuntimeDependenciesV1 {
  readonly gateway: DashboardDataGatewayV1;
  readonly representativeSource: DashboardRepresentativeSourceV1;
}

export function DashboardRuntimeWithDependencies({
  gateway,
  representativeSource,
}: DashboardRuntimeDependenciesV1) {
  const { routeId } = useFreightRiskRoute();
  const [snapshot, setSnapshot] = useState<DashboardSnapshotSurfaceV1>({ status: "LOADING" });
  const readRepresentative = useMemo(
    () => createRepresentativeSnapshotReader(representativeSource, routeId),
    [representativeSource, routeId],
  );
  const subscribeRepresentative = useCallback(
    (notify: () => void) => subscribeRepresentativeSource(representativeSource, notify),
    [representativeSource],
  );
  const representative = useSyncExternalStore(
    subscribeRepresentative,
    readRepresentative,
    () => null,
  );

  useEffect(() => {
    const controller = new AbortController();
    setSnapshot({ status: "LOADING" });
    void requestDashboardSnapshot(gateway, controller.signal).then((ready) => {
      if (!controller.signal.aborted) {
        setSnapshot(ready ?? { status: "UNAVAILABLE", source: "snapshot validation failed" });
      }
    }).catch(() => {
      if (!controller.signal.aborted) {
        setSnapshot({ status: "UNAVAILABLE", source: "snapshot gateway unavailable" });
      }
    });
    return () => controller.abort();
  }, [gateway]);

  return (
    <DashboardApp
      gateway={gateway}
      representative={representative}
      routeId={routeId}
      snapshot={snapshot}
    />
  );
}

export default function DashboardRuntime() {
  return (
    <DashboardRuntimeWithDependencies
      gateway={UNAVAILABLE_DASHBOARD_GATEWAY}
      representativeSource={UNAVAILABLE_REPRESENTATIVE_SOURCE}
    />
  );
}
