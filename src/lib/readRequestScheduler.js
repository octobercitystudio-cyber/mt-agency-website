const DEFAULT_RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export const isRetryableReadError = (error) => {
  if (!error) return false;
  const status = Number(error.status || 0);
  return status === 0 || DEFAULT_RETRYABLE_STATUSES.has(status);
};

const defaultWait = (delayMs) => new Promise((resolve) => {
  globalThis.setTimeout(resolve, delayMs);
});

export function createReadRequestScheduler({
  maxConcurrent = 4,
  retries = 1,
  retryDelayMs = 350,
  wait = defaultWait,
} = {}) {
  const queue = [];
  let active = 0;

  const drain = () => {
    while (active < maxConcurrent && queue.length) {
      const item = queue.shift();
      active += 1;
      item.run().then(item.resolve, item.reject).finally(() => {
        active -= 1;
        drain();
      });
    }
  };

  const run = (request) => new Promise((resolve, reject) => {
    queue.push({
      resolve,
      reject,
      run: async () => {
        let attempt = 0;
        while (true) {
          try {
            return await request();
          } catch (error) {
            if (attempt >= retries || !isRetryableReadError(error)) throw error;
            attempt += 1;
            await wait(retryDelayMs * attempt);
          }
        }
      },
    });
    drain();
  });

  return { run };
}

export const sharedReadRequestScheduler = createReadRequestScheduler();
