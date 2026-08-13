export class ProviderTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Provider attempt exceeded ${timeoutMs}ms`);
    this.name = "ProviderTimeoutError";
  }
}

export class ProviderHttpError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfter: string | null = null,
  ) {
    super(`Provider returned HTTP ${status}`);
    this.name = "ProviderHttpError";
  }
}

export class ProviderValidationError extends Error {
  constructor(message = "Provider payload failed validation") {
    super(message);
    this.name = "ProviderValidationError";
  }
}

export interface TimerApiV1 {
  set(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clear(handle: ReturnType<typeof setTimeout>): void;
}

export const systemTimerApiV1: TimerApiV1 = {
  set: (callback, delayMs) => setTimeout(callback, delayMs),
  clear: (handle) => clearTimeout(handle),
};

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}

export async function withAttemptTimeoutV1<T>(input: {
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
  readonly timer?: TimerApiV1;
  readonly operation: (signal: AbortSignal) => Promise<T>;
}): Promise<T> {
  if (!Number.isInteger(input.timeoutMs) || input.timeoutMs <= 0) throw new Error("Invalid provider timeout");
  if (input.signal?.aborted) throw abortReason(input.signal);
  const timer = input.timer ?? systemTimerApiV1;
  const controller = new AbortController();
  let rejectBoundary: ((reason: unknown) => void) | null = null;
  const boundary = new Promise<never>((_resolve, reject) => {
    rejectBoundary = reject;
  });
  const onParentAbort = () => {
    const reason = input.signal ? abortReason(input.signal) : new DOMException("Aborted", "AbortError");
    controller.abort(reason);
    rejectBoundary?.(reason);
  };
  input.signal?.addEventListener("abort", onParentAbort, { once: true });
  const handle = timer.set(() => {
    const error = new ProviderTimeoutError(input.timeoutMs);
    controller.abort(error);
    rejectBoundary?.(error);
  }, input.timeoutMs);
  try {
    return await Promise.race([input.operation(controller.signal), boundary]);
  } finally {
    timer.clear(handle);
    input.signal?.removeEventListener("abort", onParentAbort);
  }
}

export function parseRetryAfterMsV1(
  value: string | null,
  nowMs: number,
  maximumMs = 30_000,
): number | null {
  if (value === null || !Number.isFinite(nowMs) || maximumMs < 0) return null;
  const seconds = Number(value.trim());
  let delayMs: number;
  if (Number.isFinite(seconds) && seconds >= 0) {
    delayMs = Math.round(seconds * 1_000);
  } else {
    const date = Date.parse(value);
    if (!Number.isFinite(date)) return null;
    delayMs = Math.max(0, date - nowMs);
  }
  return Math.min(delayMs, maximumMs);
}

export async function abortableDelayV1(
  delayMs: number,
  signal?: AbortSignal,
  timer: TimerApiV1 = systemTimerApiV1,
): Promise<void> {
  if (signal?.aborted) throw abortReason(signal);
  if (delayMs <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      timer.clear(handle);
      signal?.removeEventListener("abort", onAbort);
      reject(signal ? abortReason(signal) : new DOMException("Aborted", "AbortError"));
    };
    const handle = timer.set(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export interface RetryPolicyV1 {
  readonly attemptTimeoutMs: number;
  readonly maximumAttempts: number;
  readonly retryStatuses?: readonly number[];
  readonly backoffMs?: readonly number[];
  readonly baseBackoffMs?: number;
  readonly maximumBackoffMs?: number;
  readonly maximumRetryAfterMs?: number;
  readonly retryNetworkFailures?: boolean;
}

export function isRetryableProviderFailureV1(
  error: unknown,
  policy: RetryPolicyV1,
): boolean {
  if (error instanceof ProviderValidationError) return false;
  if (error instanceof ProviderTimeoutError) return policy.retryNetworkFailures !== false;
  if (error instanceof ProviderHttpError) {
    if (policy.retryStatuses) return policy.retryStatuses.includes(error.status);
    return error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500;
  }
  return error instanceof TypeError && policy.retryNetworkFailures !== false;
}

function retryDelayMs(
  error: unknown,
  failedAttempt: number,
  policy: RetryPolicyV1,
  nowMs: number,
  random: () => number,
): number {
  if (error instanceof ProviderHttpError && error.status === 429) {
    const retryAfter = parseRetryAfterMsV1(
      error.retryAfter,
      nowMs,
      policy.maximumRetryAfterMs ?? 30_000,
    );
    if (retryAfter !== null) return retryAfter;
  }
  const exact = policy.backoffMs?.[failedAttempt - 1];
  if (exact !== undefined) return exact;
  const base = policy.baseBackoffMs ?? 250;
  const maximum = policy.maximumBackoffMs ?? 5_000;
  const jitter = 0.75 + Math.min(1, Math.max(0, random())) * 0.5;
  return Math.min(maximum, Math.round(base * 2 ** (failedAttempt - 1) * jitter));
}

export async function runProviderWithRetryV1<T>(input: {
  readonly policy: RetryPolicyV1;
  readonly signal?: AbortSignal;
  readonly timer?: TimerApiV1;
  readonly now?: () => number;
  readonly random?: () => number;
  readonly operation: (signal: AbortSignal, attempt: number) => Promise<T>;
}): Promise<T> {
  const { policy } = input;
  if (!Number.isInteger(policy.maximumAttempts) || policy.maximumAttempts < 1) {
    throw new Error("Invalid maximum provider attempts");
  }
  const timer = input.timer ?? systemTimerApiV1;
  const now = input.now ?? Date.now;
  const random = input.random ?? Math.random;
  let lastError: unknown = new Error("Provider was not attempted");
  for (let attempt = 1; attempt <= policy.maximumAttempts; attempt += 1) {
    if (input.signal?.aborted) throw abortReason(input.signal);
    try {
      return await withAttemptTimeoutV1({
        timeoutMs: policy.attemptTimeoutMs,
        signal: input.signal,
        timer,
        operation: (attemptSignal) => input.operation(attemptSignal, attempt),
      });
    } catch (error) {
      lastError = error;
      if (
        attempt >= policy.maximumAttempts ||
        input.signal?.aborted ||
        !isRetryableProviderFailureV1(error, policy)
      ) {
        throw error;
      }
      await abortableDelayV1(retryDelayMs(error, attempt, policy, now(), random), input.signal, timer);
    }
  }
  throw lastError;
}

export type FetchLikeV1 = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export async function fetchJsonUnknownV1(input: {
  readonly url: URL;
  readonly signal: AbortSignal;
  readonly fetcher?: FetchLikeV1;
  readonly init?: Omit<RequestInit, "signal">;
}): Promise<unknown> {
  const response = await (input.fetcher ?? fetch)(input.url, {
    ...input.init,
    signal: input.signal,
  });
  if (!response.ok) {
    throw new ProviderHttpError(response.status, response.headers.get("retry-after"));
  }
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderValidationError("Provider response is not valid JSON");
  }
}
