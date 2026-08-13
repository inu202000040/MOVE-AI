import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  MOVE_AI_ROUTE_CHANGE_EVENT,
  commitRouteChange,
} from "../../app/components/shell";
import { STORAGE_KEYS } from "../../app/contracts";
import {
  publishAllocationRoute,
  readAllocationRepresentative,
} from "../../app/freight-risk/allocation";
import { KNEI_REPRESENTATIVE_SELECTION } from "../../app/freight-risk/allocation/fixture";
import { createValidatedAllocationSourceHarness } from "./fixtures/validated-source";

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
  assert.doesNotMatch(allocationClient, /localStorage|history\.replaceState|CustomEvent/u);
  assert.doesNotMatch(allocationPage, /KNEI_REPRESENTATIVE_SELECTION|\.\/fixture/u);
  assert.doesNotMatch(allocationPage, /source=/u);
  assert.doesNotMatch(allocationCss, /:global\(body|body\s*>\s*nav/u);
  assert.doesNotMatch(allocationClient, /TAIL RISK BREAKDOWN|상승·하락 위험 분해/u);
  assert.doesNotMatch(worker, /toString\(|WORKER_FUNCTIONS/u);
});
