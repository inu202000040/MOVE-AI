import { GET as getChokepointSignals } from "../globe-chokepoint-traffic/route";
import { GET as getPortSignals } from "../globe-port-traffic/route";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope");
  url.searchParams.delete("scope");
  const delegatedRequest = new Request(url, {
    method: "GET",
    headers: request.headers,
    signal: request.signal,
  });
  if (scope === "p") return getPortSignals(delegatedRequest);
  if (scope === "c") return getChokepointSignals(delegatedRequest);
  return Response.json(
    { error: "scope must be p or c" },
    { status: 400, headers: { "cache-control": "no-store" } },
  );
}
