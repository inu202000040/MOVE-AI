import { fixtureDataGateway } from "../../data/runtime/fixture-gateway";
import { invalidRequestResponse, jsonResponse } from "../../data/runtime/http";
import { parsePortQuery } from "../../data/runtime/queries";

export async function GET(request: Request): Promise<Response> {
  try {
    const parsed = parsePortQuery(new URL(request.url).searchParams);
    const result = parsed.kind === "summary"
      ? await fixtureDataGateway.portSummary(request.signal)
      : await fixtureDataGateway.portDetail(parsed.query, request.signal);
    return jsonResponse(result, { cacheControl: "public, max-age=60, s-maxage=600, stale-while-revalidate=3600" });
  } catch (error) {
    return invalidRequestResponse(error);
  }
}
