import assert from "node:assert/strict";
import test from "node:test";
import { GET as chokepointDataGet } from "../../app/api/globe-chokepoint-data/route";
import { GET as chokepointTrafficGet } from "../../app/api/globe-chokepoint-traffic/route";
import { GET as portDataGet } from "../../app/api/globe-port-data/route";
import { GET as portTrafficGet } from "../../app/api/globe-port-traffic/route";
import { GET as globeSignalsGet } from "../../app/api/globe-signals/route";
import { SameOriginHttpDataGateway, type SameOriginFetchV1 } from "../../app/data/runtime/data-gateway.client";

type RouteHandler = (request: Request) => Promise<Response>;

async function call(handler: RouteHandler, url: string): Promise<{ readonly response: Response; readonly body: unknown }> {
  const response = await handler(new Request(url));
  return { response, body: await response.json() };
}

test("safe aliases preserve the existing port and chokepoint route contracts", async () => {
  const cases = [
    [portDataGet, portTrafficGet, "/api/globe-port-data", "/api/globe-port-traffic"],
    [portDataGet, portTrafficGet, "/api/globe-port-data?id=KUWI-LAX&days=90", "/api/globe-port-traffic?id=KUWI-LAX&days=90"],
    [chokepointDataGet, chokepointTrafficGet, "/api/globe-chokepoint-data", "/api/globe-chokepoint-traffic"],
    [chokepointDataGet, chokepointTrafficGet, "/api/globe-chokepoint-data?id=korea-strait", "/api/globe-chokepoint-traffic?id=korea-strait"],
    [globeSignalsGet, portTrafficGet, "/api/globe-signals?scope=p", "/api/globe-port-traffic"],
    [globeSignalsGet, portTrafficGet, "/api/globe-signals?scope=p&id=KUWI-LAX&days=90", "/api/globe-port-traffic?id=KUWI-LAX&days=90"],
    [globeSignalsGet, chokepointTrafficGet, "/api/globe-signals?scope=c", "/api/globe-chokepoint-traffic"],
    [globeSignalsGet, chokepointTrafficGet, "/api/globe-signals?scope=c&id=korea-strait", "/api/globe-chokepoint-traffic?id=korea-strait"],
  ] as const;

  for (const [aliasHandler, legacyHandler, aliasPath, legacyPath] of cases) {
    const aliasResult = await call(aliasHandler, `http://localhost${aliasPath}`);
    const legacyResult = await call(legacyHandler, `http://localhost${legacyPath}`);
    assert.equal(aliasResult.response.status, legacyResult.response.status, aliasPath);
    assert.equal(aliasResult.response.headers.get("cache-control"), legacyResult.response.headers.get("cache-control"), aliasPath);
    assert.deepEqual(aliasResult.body, legacyResult.body, aliasPath);
  }
});

test("safe aliases expose complete stale fixtures including KUWI-LAX 90-day detail", async () => {
  const portSummary = await call(portDataGet, "http://localhost/api/globe-port-data");
  assert.equal(portSummary.response.status, 200);
  assert.equal((portSummary.body as { readonly state: string }).state, "STALE");
  assert.equal(
    Object.keys((portSummary.body as { readonly data: { readonly summaries: object } }).data.summaries).length,
    57,
  );

  const portDetail = await call(portDataGet, "http://localhost/api/globe-port-data?id=KUWI-LAX&days=90");
  const detailData = (portDetail.body as {
    readonly state: string;
    readonly data: { readonly detail: { readonly portId: string; readonly points: readonly unknown[] } };
  });
  assert.equal(detailData.state, "STALE");
  assert.equal(detailData.data.detail.portId, "KUWI-LAX");
  assert.equal(detailData.data.detail.points.length, 90);

  const chokepointSummary = await call(chokepointDataGet, "http://localhost/api/globe-chokepoint-data");
  assert.equal(chokepointSummary.response.status, 200);
  assert.equal((chokepointSummary.body as { readonly state: string }).state, "STALE");
  assert.equal(
    Object.keys((chokepointSummary.body as { readonly data: { readonly summaries: object } }).data.summaries).length,
    11,
  );
});

test("same-origin client requests only blocker-safe aliases for traffic-backed data", async () => {
  const observed: string[] = [];
  const fetchSameOrigin: SameOriginFetchV1 = async (input, init) => {
    observed.push(input);
    const request = new Request(`http://localhost${input}`, init);
    if (input.startsWith("/api/globe-signals")) return globeSignalsGet(request);
    return Response.json({}, { status: 404 });
  };
  const gateway = new SameOriginHttpDataGateway(fetchSameOrigin);

  assert.equal((await gateway.portSummary()).state, "STALE");
  assert.equal((await gateway.portDetail({ id: "KUWI-LAX", days: 90 })).data?.detail?.points.length, 90);
  assert.equal((await gateway.chokeSummary()).state, "STALE");
  assert.equal((await gateway.chokeDetail({ id: "korea-strait" })).state, "STALE");

  assert.deepEqual(observed, [
    "/api/globe-signals?scope=p",
    "/api/globe-signals?scope=p&id=KUWI-LAX&days=90",
    "/api/globe-signals?scope=c",
    "/api/globe-signals?scope=c&id=korea-strait",
  ]);
  assert.equal(observed.some((path) => path.includes("traffic")), false);
});

test("same-origin client invokes browser fetch with the global receiver", async () => {
  const browserLikeFetch: SameOriginFetchV1 = function (
    this: typeof globalThis,
    input,
    init,
  ) {
    assert.equal(this, globalThis);
    const request = new Request(`http://localhost${input}`, init);
    return globeSignalsGet(request);
  };
  const gateway = new SameOriginHttpDataGateway(browserLikeFetch);
  assert.equal((await gateway.portSummary()).state, "STALE");
});
