import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { secureStorage } from './secureStorage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local.'
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    // There is no browser URL to read a session out of on native. Deep links
    // are handled explicitly in lib/auth.tsx instead, so leaving this on just
    // races that handler.
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

/**
 * Supabase's refresh timer is a JS interval, and JS is frozen while the app is
 * backgrounded, so without this the first request after a long background is
 * made with an expired token.
 */
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
