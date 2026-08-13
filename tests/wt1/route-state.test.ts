import assert from "node:assert/strict";
import test from "node:test";

import { STORAGE_KEYS } from "../../app/contracts";
import {
  WORKSPACE_PAGE_IDS,
  buildWorkspaceHref,
  commitRouteChange,
  planRouteHydration,
  resolveRoute,
} from "../../app/components/shell";

test("resolves route with query, storage, and KNEI precedence", () => {
  assert.deepEqual(resolveRoute("KMEI", "KMDI"), {
    routeId: "KMEI",
    source: "query",
  });
  assert.deepEqual(resolveRoute("kmei", "KMDI"), {
    routeId: "KMDI",
    source: "storage",
  });
  assert.deepEqual(resolveRoute("invalid", "invalid"), {
    routeId: "KNEI",
    source: "default",
  });
});

test("plans one normalized hydration result without query-storage-default races", () => {
  assert.deepEqual(
    planRouteHydration(
      "http://localhost/freight-risk/dashboard?route=KMEI",
      "KMDI",
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
      "http://localhost/freight-risk/network?route=invalid",
      "KMDI",
    ),
    {
      routeId: "KMDI",
      source: "storage",
      normalizedHref:
        "http://localhost/freight-risk/network?route=KMDI",
      shouldPersist: false,
      shouldReplaceUrl: true,
    },
  );

  assert.deepEqual(
    planRouteHydration("http://localhost/freight-risk/models", null),
    {
      routeId: "KNEI",
      source: "default",
      normalizedHref: "http://localhost/freight-risk/models?route=KNEI",
      shouldPersist: true,
      shouldReplaceUrl: true,
    },
  );
});

test("builds every workspace link from canonical page paths with the route intact", () => {
  assert.deepEqual(
    WORKSPACE_PAGE_IDS.map((pageId) =>
      buildWorkspaceHref(pageId, "KUEI"),
    ),
    [
      "/freight-risk/dashboard?route=KUEI",
      "/freight-risk/models?route=KUEI",
      "/freight-risk/network?route=KUEI",
      "/freight-risk/allocation?route=KUEI",
    ],
  );
});

test("commits valid changes through canonical storage, URL, and route notification", () => {
  const effects: string[] = [];

  const result = commitRouteChange(
    "KSAI",
    "http://localhost/freight-risk/dashboard?route=KNEI&view=compact",
    {
      store: (key, value) => effects.push(`store:${key}:${value}`),
      replace: (href) => effects.push(`replace:${href}`),
      publish: (routeId) => effects.push(`publish:${routeId}`),
    },
  );

  assert.deepEqual(result, {
    accepted: true,
    routeId: "KSAI",
    href:
      "http://localhost/freight-risk/dashboard?route=KSAI&view=compact",
    failedEffects: [],
  });
  assert.deepEqual(effects, [
    `store:${STORAGE_KEYS.route}:KSAI`,
    "replace:http://localhost/freight-risk/dashboard?route=KSAI&view=compact",
    "publish:KSAI",
  ]);
});

test("rejects invalid candidates and keeps URL notification usable when storage fails", () => {
  let effectCount = 0;
  assert.deepEqual(
    commitRouteChange(
      "ksai",
      "http://localhost/freight-risk/dashboard?route=KNEI",
      {
        store: () => effectCount += 1,
        replace: () => effectCount += 1,
        publish: () => effectCount += 1,
      },
    ),
    {
      accepted: false,
      routeId: null,
      href: null,
      failedEffects: [],
    },
  );
  assert.equal(effectCount, 0);

  const effects: string[] = [];
  const result = commitRouteChange(
    "KCI",
    "http://localhost/freight-risk/allocation?route=KNEI",
    {
      store: () => {
        throw new Error("storage unavailable");
      },
      replace: (href) => effects.push(href),
      publish: (routeId) => effects.push(routeId),
    },
  );

  assert.deepEqual(result.failedEffects, ["storage"]);
  assert.deepEqual(effects, [
    "http://localhost/freight-risk/allocation?route=KCI",
    "KCI",
  ]);
});
