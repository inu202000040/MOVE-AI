"use client";

import { useEffect, useState } from "react";

import { useFreightRiskRoute } from "../../components/shell";
import { DashboardApp } from "./DashboardApp";
import {
  UNAVAILABLE_DASHBOARD_GATEWAY,
  UNAVAILABLE_REPRESENTATIVE_SOURCE,
  bindRepresentativeSource,
  type DashboardDataGatewayV1,
  type DashboardRepresentativeSourceV1,
  type RepresentativeSelectionV1,
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
  const [representative, setRepresentative] = useState<RepresentativeSelectionV1 | null>(null);

  useEffect(
    () => bindRepresentativeSource(representativeSource, routeId, setRepresentative),
    [representativeSource, routeId],
  );

  return (
    <DashboardApp
      gateway={gateway}
      representative={representative}
      routeId={routeId}
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
