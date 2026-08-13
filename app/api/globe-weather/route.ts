import { fixtureDataGateway } from "../../data/runtime/fixture-gateway";
import { invalidRequestResponse, jsonResponse } from "../../data/runtime/http";
import { parseEmptyQuery } from "../../data/runtime/queries";

export async function GET(request: Request): Promise<Response> {
  try {
    parseEmptyQuery(new URL(request.url).searchParams);
    const result = await fixtureDataGateway.weather(request.signal);
    return jsonResponse(result, { cacheControl: "no-store" });
  } catch (error) {
    return invalidRequestResponse(error);
  }
}
