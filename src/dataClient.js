import { hostingerClient } from './lib/hostingerClient';
import { demoClient, isDemoModeActive } from './lib/demoDataClient';

// Production always uses the same-origin Hostinger API. Local preview remains
// isolated in the browser and never connects to an external database.
export const dataClient = new Proxy({}, {
  get(_target, property) {
    const client = isDemoModeActive() ? demoClient : hostingerClient;
    const value = client[property];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export const dataProvider = 'hostinger';
