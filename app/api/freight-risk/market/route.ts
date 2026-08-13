import { fixtureDataGateway } from "../../../data/runtime/fixture-gateway";
import { invalidRequestResponse, jsonResponse } from "../../../data/runtime/http";
import { parseMarketQuery } from "../../../data/runtime/queries";

export async function GET(request: Request): Promise<Response> {
  try {
    const result = await fixtureDataGateway.market(parseMarketQuery(new URL(request.url).searchParams), request.signal);
    return jsonResponse(result, { cacheControl: result.state === "UNAVAILABLE" ? "no-store" : "public, max-age=900, s-maxage=3600, stale-while-revalidate=86400" });
  } catch (error) {
    return invalidRequestResponse(error);
  }
}
