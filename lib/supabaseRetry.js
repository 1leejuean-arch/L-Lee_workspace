export function isTemporaryAuthTimingError(error) {
  return error?.code === "PGRST303" || String(error?.message || "").toLowerCase().includes("jwt issued at future");
}

export async function queryWithTemporaryAuthRetry(query, { delayMs = 650, onRetry } = {}) {
  let result = await query();
  if (!result?.error || !isTemporaryAuthTimingError(result.error)) {
    return { result, retried: false };
  }

  onRetry?.(result.error);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  result = await query();
  return { result, retried: true };
}
