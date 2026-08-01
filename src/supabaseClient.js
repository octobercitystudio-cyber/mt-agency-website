import { createClient } from '@supabase/supabase-js';
import { hostingerClient } from './lib/hostingerClient';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const useHostinger = import.meta.env.VITE_DATA_PROVIDER === 'hostinger';

export const supabase = useHostinger
  ? hostingerClient
  : createClient(supabaseUrl, supabaseAnonKey);

export const dataProvider = useHostinger ? 'hostinger' : 'supabase';
