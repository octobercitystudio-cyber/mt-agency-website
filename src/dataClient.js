import { emitClientAction, createClientRequestRecorder, successfulClientAction } from './lib/clientAnalytics';
import { requestWithBookingConfirmation } from './lib/bookingConfirmation';
import { hostingerClient } from './lib/hostingerClient';
// Preview data is development-only; customers never download the demo database.
const { demoClient, isDemoModeActive } = import.meta.env.DEV
  ? await import('./lib/demoDataClient')
  : { demoClient: null, isDemoModeActive: () => false };

const recordClientRequest = createClientRequestRecorder(emitClientAction);

// Production always uses the same-origin Hostinger API. Local preview remains
// isolated in the browser and never connects to an external database.
export const dataClient = new Proxy({}, {
  get(_target, property) {
    const client = isDemoModeActive() ? demoClient : hostingerClient;
    const value = client[property];
    if (property === 'request') return async (path, options) => {
      const result = await requestWithBookingConfirmation(value.bind(client), path, options);
      if (!isDemoModeActive()) {
        try {
          if (result?.error && successfulClientAction(path, options, { data: {} })) emitClientAction(path === '/registration/complete' ? 'registration_failed' : 'action_failed');
          recordClientRequest(path, options, result);
        } catch { /* Tracking cannot interrupt a request. */ }
      }
      return result;
    };
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export const dataProvider = 'hostinger';
