import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://grip-api-proxy.gaonkaradarsh38.workers.dev';
const SUPABASE_ANON_KEY = 'sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem'; // This is safe to expose in the frontend for RLS databases

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
