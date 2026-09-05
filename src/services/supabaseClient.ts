import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nxhcumxhelebenklkaps.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_6rL3iQumn72IxTLvKYEmyg_swNWGmz7';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'builder-nutrition-beta-auth-v1',
  },
});
