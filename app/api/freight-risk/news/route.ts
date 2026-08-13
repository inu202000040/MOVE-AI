import { fixtureDataGateway } from "../../../data/runtime/fixture-gateway";
import { invalidRequestResponse, jsonResponse } from "../../../data/runtime/http";
import { fetchLiveNewsV1 } from "../../../data/runtime/news-live";
import { cacheControlForV1, parseServerDataModeV1 } from "../../../data/runtime/provider-policy";
import { parseNewsCompatibilityQuery } from "../../../data/runtime/queries";

export async function GET(request: Request): Promise<Response> {
  try {
    const query = parseNewsCompatibilityQuery(new URL(request.url).searchParams);
    const mode = parseServerDataModeV1(process.env.MOVE_AI_DATA_MODE);
    const result = mode === "fixture"
      ? await fixtureDataGateway.news(query, request.signal)
      : await fetchLiveNewsV1(query, request.signal);
    return jsonResponse(result, {
      cacheControl: cacheControlForV1({
        domain: "news",
        state: result.state,
        articleCount: result.data?.articles.length,
      }),
    });
  } catch (error) {
    return invalidRequestResponse(error);
  }
}
