import { invalidRequestResponse, jsonResponse } from "../../data/runtime/http";
import { cacheControlForV1 } from "../../data/runtime/provider-policy";
import { parseEmptyQuery } from "../../data/runtime/queries";
import { liveWeatherGatewayV1 } from "./weather-service";

export async function GET(request: Request): Promise<Response> {
  try {
    parseEmptyQuery(new URL(request.url).searchParams);
    const result = await liveWeatherGatewayV1.weather(request.signal);
    return jsonResponse(result, {
      cacheControl: cacheControlForV1({ domain: "weather", state: result.state }),
    });
  } catch (error) {
    return invalidRequestResponse(error);
  }
}
