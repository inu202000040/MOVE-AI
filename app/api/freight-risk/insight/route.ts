import { fixtureDataGateway } from "../../../data/runtime/fixture-gateway";
import { invalidRequestResponse, jsonResponse, parseJsonBody } from "../../../data/runtime/http";
import { decodeInsightRequestV1 } from "../../../data/runtime/domains";

export async function POST(request: Request): Promise<Response> {
  try {
    const result = await fixtureDataGateway.insight(decodeInsightRequestV1(await parseJsonBody(request, 256 * 1024)), request.signal);
    return jsonResponse(result, { cacheControl: "no-store" });
  } catch (error) {
    return invalidRequestResponse(error);
  }
}
