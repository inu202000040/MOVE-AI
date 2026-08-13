import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  MOVE_AI_ROUTE_CHANGE_EVENT,
  commitRouteChange,
} from "../../app/components/shell";
import {
  GATEWAY_SCHEMA_VERSION,
  STORAGE_KEYS,
  type DataGatewayV1,
  type PendingGatewayResultV1,
} from "../../app/contracts";
import {
  createGatewayBackedAllocationRepresentativeSource,
  publishAllocationRoute,
  readAllocationRepresentative,
} from "../../app/freight-risk/allocation";
import { KNEI_REPRESENTATIVE_SELECTION } from "../../app/freight-risk/allocation/fixture";
import { createValidatedAllocationSourceHarness } from "./fixtures/validated-source";

const gatewayMeta = {
  mode: "fixture",
  source: "forecast-snapshot-v3",
  sourceUrl: null,
  asOf: "2026-08-03",
  fetchedAt: "2026-08-13T00:00:00+09:00",
  unit: "USD/FEU",
  isEstimate: true,
  attribution: "approved model workbooks",
  warnings: [],
  provider: null,
  cache: { hit: true, stale: false, ageSeconds: 0 },
} as const;

function dataGateway(
  snapshot: DataGatewayV1["snapshot"],
): DataGatewayV1 {
  const unsupported = async (): Promise<PendingGatewayResultV1> => {
    throw new Error("unused gateway method");
  };
  return {
    snapshot,
    market: unsupported,
    news: unsupported,
    insight: unsupported,
    tuningHealth: unsupported,
    tuningRun: unsupported,
    portSummary: unsupported,
    portDetail: unsupported,
    chokeSummary: unsupported,
    chokeDetail: unsupported,
    weather: unsupported,
  };
}

const readySnapshot: PendingGatewayResultV1 = {
  schemaVersion: GATEWAY_SCHEMA_VERSION,
  state: "READY",
  data: { schemaVersion: "glovis-freight-risk/v3" },
  meta: gatewayMeta,
  error: null,
};

test("fails closed unless an injected source publishes the validated shared route", () => {
  const harness = createValidatedAllocationSourceHarness();
  const { source } = harness;

  assert.strictEqual(
    readAllocationRepresentative(source, "KNEI"),
    KNEI_REPRESENTATIVE_SELECTION,
  );
  assert.throws(() => readAllocationRepresentative(source, "KMEI"));
  let publications = 0;
  const unsubscribe = source.subscribe(() => {
    publications += 1;
  });
  harness.publish("KMEI");
  assert.equal(publications, 1);
  assert.throws(() => readAllocationRepresentative(source, "KNEI"));
  unsubscribe();
  harness.publish("KNEI");
  assert.equal(publications, 1);
  assert.throws(() =>
    readAllocationRepresentative(
      { ...source, read: () => ({ ...KNEI_REPRESENTATIVE_SELECTION, forecasts: [] }) },
      "KNEI",
    ),
  );
});

test("publishes representative data only after the canonical gateway snapshot is READY", async () => {
  const harness = createValidatedAllocationSourceHarness();
  const source = createGatewayBackedAllocationRepresentativeSource(
    dataGateway(async () => readySnapshot),
    harness.source,
  );
  assert.throws(() => readAllocationRepresentative(source, "KNEI"));
  let publications = 0;
  const unsubscribe = source.subscribe(() => {
    publications += 1;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(publications, 1);
  assert.strictEqual(
    readAllocationRepresentative(source, "KNEI"),
    KNEI_REPRESENTATIVE_SELECTION,
  );
  unsubscribe();
  assert.throws(() => readAllocationRepresentative(source, "KNEI"));
});

test("keeps unavailable, rejected, and late snapshot results fail-closed", async () => {
  const harness = createValidatedAllocationSourceHarness();
  const unavailable: PendingGatewayResultV1 = {
    schemaVersion: GATEWAY_SCHEMA_VERSION,
    state: "UNAVAILABLE",
    data: null,
    meta: { ...gatewayMeta, mode: "unavailable" },
    error: {
      code: "NO_DATA",
      message: "unavailable",
      retryable: false,
      upstreamStatus: null,
      details: { reasonCode: "NO_VALID_DATA" },
    },
  };
  const unavailableSource = createGatewayBackedAllocationRepresentativeSource(
    dataGateway(async () => unavailable),
    harness.source,
  );
  const stopUnavailable = unavailableSource.subscribe(() => undefined);
  await new Promise((resolve) => setImmediate(resolve));
  assert.throws(() => readAllocationRepresentative(unavailableSource, "KNEI"));
  stopUnavailable();

  let resolveLate!: (result: PendingGatewayResultV1) => void;
  const lateSource = createGatewayBackedAllocationRepresentativeSource(
    dataGateway(() => new Promise((resolve) => {
      resolveLate = resolve;
    })),
    harness.source,
  );
  let latePublications = 0;
  const stopLate = lateSource.subscribe(() => {
    latePublications += 1;
  });
  stopLate();
  resolveLate(readySnapshot);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(latePublications, 0);
  assert.throws(() => readAllocationRepresentative(lateSource, "KNEI"));
});

test("forwards a drawer route candidate through the complete WT1 transaction", () => {
  const effects: string[] = [];
  const changeRoute = (candidate: unknown): boolean => {
    const result = commitRouteChange(
      candidate,
      "http://127.0.0.1:3215/freight-risk/allocation?route=KNEI",
      {
        store(key, value) {
          effects.push(`storage:${key}:${value}`);
        },
        replace(href) {
          effects.push(`url:${href}`);
        },
        publish(routeId) {
          effects.push(`event:${MOVE_AI_ROUTE_CHANGE_EVENT}:${routeId}`);
        },
      },
    );
    return result.accepted;
  };

  assert.equal(publishAllocationRoute("KMEI", changeRoute), true);
  assert.deepEqual(effects, [
    `storage:${STORAGE_KEYS.route}:KMEI`,
    "url:http://127.0.0.1:3215/freight-risk/allocation?route=KMEI",
    `event:${MOVE_AI_ROUTE_CHANGE_EVENT}:KMEI`,
  ]);
  assert.equal(publishAllocationRoute("NOT-A-ROUTE", changeRoute), false);
  assert.equal(effects.length, 3);
});

test("keeps production ownership and visible inventory boundaries explicit", () => {
  const allocationClient = readFileSync(
    new URL("../../app/freight-risk/allocation/AllocationClient.tsx", import.meta.url),
    "utf8",
  );
  const allocationPage = readFileSync(
    new URL("../../app/freight-risk/allocation/page.tsx", import.meta.url),
    "utf8",
  );
  const allocationCss = readFileSync(
    new URL("../../app/freight-risk/allocation/allocation.module.css", import.meta.url),
    "utf8",
  );
  const worker = readFileSync(
    new URL("../../app/freight-risk/allocation/worker.ts", import.meta.url),
    "utf8",
  );

  assert.match(allocationClient, /useFreightRiskRoute\(\)/u);
  assert.match(allocationClient, /source = UNAVAILABLE_ALLOCATION_REPRESENTATIVE_SOURCE/u);
  assert.doesNotMatch(allocationClient, /data\/runtime\/data-gateway|createSameOriginDataGatewayV1/u);
  assert.doesNotMatch(allocationClient, /localStorage|history\.replaceState|CustomEvent/u);
  assert.doesNotMatch(allocationPage, /KNEI_REPRESENTATIVE_SELECTION|\.\/fixture/u);
  assert.doesNotMatch(allocationPage, /source=/u);
  assert.doesNotMatch(allocationCss, /:global\(body|body\s*>\s*nav/u);
  assert.doesNotMatch(allocationClient, /TAIL RISK BREAKDOWN|상승·하락 위험 분해/u);
  assert.doesNotMatch(worker, /toString\(|WORKER_FUNCTIONS/u);
});
