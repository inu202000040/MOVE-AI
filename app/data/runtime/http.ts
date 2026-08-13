import type { GatewayResultV1 } from "../../contracts/gateway";
import { GATEWAY_SCHEMA_VERSION } from "../../contracts/gateway";
import { InvalidRequestError } from "./queries";

export function jsonResponse<TData, TState extends string>(
  result: GatewayResultV1<TData, TState>,
  options: { readonly status?: number; readonly cacheControl: string },
): Response {
  return Response.json(result, {
    status: options.status ?? 200,
    headers: { "Cache-Control": options.cacheControl },
  });
}

export function invalidRequestResponse(error: unknown): Response {
  const message = error instanceof InvalidRequestError
    ? error.message
    : error instanceof Error && /UNKNOWN_(?:PORT|CHOKEPOINT)_ID/u.test(error.message)
      ? "알 수 없는 ID입니다."
      : "요청 형식이 올바르지 않습니다.";
  return Response.json(
    {
      schemaVersion: GATEWAY_SCHEMA_VERSION,
      state: "UNAVAILABLE",
      data: null,
      meta: {
        mode: "unavailable",
        source: "request-validator",
        sourceUrl: null,
        asOf: null,
        fetchedAt: new Date(0).toISOString(),
        unit: null,
        isEstimate: false,
        attribution: "MOVE AI",
        warnings: [],
        provider: null,
        cache: { hit: false, stale: false, ageSeconds: null },
      },
      error: {
        code: "INVALID_REQUEST",
        message,
        retryable: false,
        upstreamStatus: null,
        details: { reasonCode: "QUERY_OR_BODY_INVALID" },
      },
    },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}

export async function parseJsonBody(request: Request, maximumBytes: number): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) > maximumBytes) {
    throw new InvalidRequestError("요청 본문이 허용 크기를 초과했습니다.");
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > maximumBytes) throw new InvalidRequestError("요청 본문이 허용 크기를 초과했습니다.");
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new InvalidRequestError("JSON 본문이 올바르지 않습니다.");
  }
}
