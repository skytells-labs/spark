import Skytells, { SkytellsError } from "skytells";

export function getSkytellsClient(runtimeKey?: string) {
  const apiKey = runtimeKey?.trim() || process.env.SKYTELLS_API_KEY?.trim();
  const timeout = Number(process.env.SKYTELLS_TIMEOUT_MS || 120000);

  if (!apiKey) {
    return null;
  }

  return Skytells(apiKey, {
    runtime: "edge",
    timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : 120000,
    retry: {
      retries: 2,
      retryDelay: 700,
      retryOn: [429, 500, 502, 503, 504],
    },
  });
}

export function normalizeSkytellsError(error: unknown) {
  if (error instanceof SkytellsError) {
    return {
      message: error.message,
      errorId: error.errorId,
      status: error.httpStatus || 500,
      details:
        typeof error.details === "string"
          ? error.details
          : JSON.stringify(error.details ?? {}, null, 2),
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      errorId: "UNKNOWN_ERROR",
      status: 500,
      details: "",
    };
  }

  return {
    message: "Unexpected Skytells error.",
    errorId: "UNKNOWN_ERROR",
    status: 500,
    details: "",
  };
}
