const RETRYABLE_HTTP_STATUSES = new Set([401, 408, 425, 429]);

export const isRetryableDashboardError = (error) => {
  if (!error) return false;
  const status = Number(error.status || 0);
  if (!status) return true;
  return RETRYABLE_HTTP_STATUSES.has(status) || status >= 500;
};

const defaultWait = (delayMs) => new Promise((resolve) => {
  window.setTimeout(resolve, delayMs);
});

export const requestDashboardModule = async (request, {
  retries = 1,
  delayMs = 450,
  shouldRetryResult = (result) => Boolean(result?.error),
  wait = defaultWait,
} = {}) => {
  let result = await request();
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const retryRequested = shouldRetryResult(result);
    const retryAllowed = result?.error
      ? isRetryableDashboardError(result.error)
      : retryRequested;
    if (!retryRequested || !retryAllowed) break;
    await wait(delayMs * (attempt + 1));
    result = await request();
  }
  return result;
};
