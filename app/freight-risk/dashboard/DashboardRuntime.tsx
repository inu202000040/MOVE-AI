"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { useFreightRiskRoute } from "../../components/shell";
import {
  createSameOriginDataGatewayV1,
  type SnapshotGatewayResultV1,
} from "../../data/runtime/data-gateway.client";
import { DashboardApp } from "./DashboardApp";
import {
  MODELS_REPRESENTATIVE_SOURCE,
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
    (notify: () => void) => subscribeRepresentativeSource(representativeSource, routeId, notify),
    [representativeSource, routeId],
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

export default function DashboardRuntime({
  initialSnapshotResult,
}: {
  readonly initialSnapshotResult: SnapshotGatewayResultV1;
}) {
  const gateway = useMemo(
    () => createSameOriginDataGatewayV1(globalThis.fetch, () => initialSnapshotResult),
    [initialSnapshotResult],
  );
  return (
    <DashboardRuntimeWithDependencies
      gateway={gateway}
      representativeSource={MODELS_REPRESENTATIVE_SOURCE}
    />
  );
}
