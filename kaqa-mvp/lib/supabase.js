import { createClient } from '@supabase/supabase-js';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';

// Client-side (browser)
export const createBrowserClient = () =>
  createPagesBrowserClient();

// Server-side (API routes) — uses service role for full access
export const createServerClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
