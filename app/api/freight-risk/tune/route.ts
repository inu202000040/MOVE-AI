import { fixtureDataGateway } from "../../../data/runtime/fixture-gateway";
import { invalidRequestResponse, jsonResponse, parseJsonBody } from "../../../data/runtime/http";
import { parseEmptyQuery } from "../../../data/runtime/queries";
import { decodeTuneRequestV1 } from "../../../data/runtime/domains";

export async function GET(request: Request): Promise<Response> {
  try {
    parseEmptyQuery(new URL(request.url).searchParams);
    const result = await fixtureDataGateway.tuningHealth(request.signal);
    return jsonResponse(result, { status: 503, cacheControl: "no-store" });
  } catch (error) {
    return invalidRequestResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const result = await fixtureDataGateway.tuningRun(decodeTuneRequestV1(await parseJsonBody(request, 2 * 1024 * 1024)), request.signal);
    return jsonResponse(result, { status: 503, cacheControl: "no-store" });
  } catch (error) {
    return invalidRequestResponse(error);
  }
}
