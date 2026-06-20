import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Accept either of Supabase's two key formats:
 *   - New: `sb_publishable_…`
 *   - Legacy: JWT starting with `eyJ…`
 * Both work as the `supabaseKey` arg in `createClient` (v2.45+).
 */
function isValidKey(key: string | undefined): boolean {
  if (!key) return false;
  if (key.startsWith('sb_publishable_')) return key.length > 20;
  if (key.startsWith('eyJ')) return key.length > 20;
  if (key === 'your-anon-public-key') return false;
  return key.length > 20;
}

export const SUPABASE_CONFIGURED = Boolean(
  URL &&
    KEY &&
    URL !== 'https://your-project-ref.supabase.co' &&
    isValidKey(KEY) &&
    /^https?:\/\/.+\.supabase\.co\/?$/.test(URL ?? ''),
);

let _client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (!SUPABASE_CONFIGURED) return null;
  if (!_client) {
    _client = createClient(URL!, KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return _client;
}
