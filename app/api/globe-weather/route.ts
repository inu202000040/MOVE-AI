import { fixtureDataGateway } from "../../data/runtime/fixture-gateway";
import { invalidRequestResponse, jsonResponse } from "../../data/runtime/http";
import { parseEmptyQuery } from "../../data/runtime/queries";

export async function GET(request: Request): Promise<Response> {
  try {
    const result = await fixtureDataGateway.weather(parseEmptyQuery(new URL(request.url).searchParams), request.signal);
    return jsonResponse(result, { cacheControl: "no-store" });
  } catch (error) {
    return invalidRequestResponse(error);
  }
}
