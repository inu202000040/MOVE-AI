import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  MOVE_AI_ROUTE_CHANGE_EVENT,
  buildWorkspaceHref,
  commitRouteChange,
  planRouteHydration,
} from "../../app/components/shell";
import { STORAGE_KEYS } from "../../app/contracts";

test("Dashboard route hydration follows valid query, storage fallback, then KNEI", () => {
  assert.deepEqual(
    planRouteHydration(
      "http://localhost/freight-risk/dashboard?route=KMEI",
      "KUEI",
    ),
    {
      routeId: "KMEI",
      source: "query",
      normalizedHref:
        "http://localhost/freight-risk/dashboard?route=KMEI",
      shouldPersist: true,
      shouldReplaceUrl: false,
    },
  );
  assert.deepEqual(
    planRouteHydration(
      "http://localhost/freight-risk/dashboard?route=invalid",
      "KUEI",
    ),
    {
      routeId: "KUEI",
      source: "storage",
      normalizedHref:
        "http://localhost/freight-risk/dashboard?route=KUEI",
      shouldPersist: false,
      shouldReplaceUrl: true,
    },
  );
  assert.deepEqual(
    planRouteHydration(
      "http://localhost/freight-risk/dashboard?route=invalid",
      "invalid",
    ),
    {
      routeId: "KNEI",
      source: "default",
      normalizedHref:
        "http://localhost/freight-risk/dashboard?route=KNEI",
      shouldPersist: true,
      shouldReplaceUrl: true,
    },
  );
});

test("Dashboard route changes publish the shared event and preserve navigation query", () => {
  const effects: string[] = [];
  const result = commitRouteChange(
    "KMDI",
    "http://localhost/freight-risk/dashboard?route=KNEI",
    {
      store: (key, value) => effects.push(`storage:${key}:${value}`),
      replace: (href) => effects.push(`url:${href}`),
      publish: (routeId) => effects.push(`${MOVE_AI_ROUTE_CHANGE_EVENT}:${routeId}`),
    },
  );

  assert.deepEqual(result, {
    accepted: true,
    routeId: "KMDI",
    href: "http://localhost/freight-risk/dashboard?route=KMDI",
    failedEffects: [],
  });
  assert.deepEqual(effects, [
    `storage:${STORAGE_KEYS.route}:KMDI`,
    "url:http://localhost/freight-risk/dashboard?route=KMDI",
    `${MOVE_AI_ROUTE_CHANGE_EVENT}:KMDI`,
  ]);
  assert.equal(
    buildWorkspaceHref("network", "KMDI"),
    "/freight-risk/network?route=KMDI",
  );

  let invalidEffectCount = 0;
  const invalid = commitRouteChange(
    "kmdi",
    "http://localhost/freight-risk/dashboard?route=KNEI",
    {
      store: () => invalidEffectCount += 1,
      replace: () => invalidEffectCount += 1,
      publish: () => invalidEffectCount += 1,
    },
  );
  assert.equal(invalid.accepted, false);
  assert.equal(invalidEffectCount, 0);
});

test("Dashboard consumes the cleared WT1 layout and route hook without a local owner", async () => {
  const appSource = await readFile(
    path.resolve("app/freight-risk/dashboard/DashboardApp.tsx"),
    "utf8",
  );
  const layoutSource = await readFile(
    path.resolve("app/freight-risk/layout.tsx"),
    "utf8",
  );
  const runtimeSource = await readFile(
    path.resolve("app/freight-risk/dashboard/DashboardRuntime.tsx"),
    "utf8",
  );

  assert.equal(runtimeSource.includes('import { useFreightRiskRoute } from "../../components/shell"'), true);
  assert.equal(runtimeSource.includes("const { routeId } = useFreightRiskRoute()"), true);
  assert.equal(appSource.includes("useState<RouteId>"), false);
  assert.equal(appSource.includes("routeFromLocation"), false);
  assert.equal(appSource.includes("window.history.replaceState"), false);
  assert.equal(appSource.includes("function RouteSelector"), false);
  assert.equal(appSource.includes('document.querySelector(".workspace-header-actions")'), true);
  assert.equal(appSource.includes('className="dashboard-context"'), false);
  assert.equal(layoutSource.includes("<WorkspaceShell>{children}</WorkspaceShell>"), true);
});
