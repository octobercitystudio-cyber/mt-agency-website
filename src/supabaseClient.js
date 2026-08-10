import { createClient } from '@supabase/supabase-js';
import { hostingerClient } from './lib/hostingerClient';
import { demoClient, isDemoModeActive } from './lib/demoDataClient';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const configuredProvider = String(import.meta.env.VITE_DATA_PROVIDER || 'hostinger').trim().toLowerCase();
const useHostinger = configuredProvider !== 'supabase';

if (!useHostinger && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error('Supabase was selected without VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Use Hostinger or provide both values.');
}

const productionClient = useHostinger
  ? hostingerClient
  : createClient(supabaseUrl, supabaseAnonKey);

// Every ERP screen keeps using the same Supabase-shaped API. In local preview
// the proxy switches it to an isolated browser database instead of touching
// the connected production provider.
export const supabase = new Proxy({}, {
  get(_target, property) {
    const client = isDemoModeActive() ? demoClient : productionClient;
    const value = client[property];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export const dataProvider = useHostinger ? 'hostinger' : 'supabase';
