import { createClient } from '@supabase/supabase-js';

// These should be kept in your environment variables for security.
// For local development, you can put these in a .env.local file:
// NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
// NEXT_PUBLIC_SUPABASE_ANON_KEY=...

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://ytmuudbkuhkfqkzchtce.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
