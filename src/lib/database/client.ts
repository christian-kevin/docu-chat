import { createClient, SupabaseClient } from '@supabase/supabase-js'

const API_TIMEOUT_MS = 10000;

function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => {
    clearTimeout(timeoutId);
  });
}

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
      return 'https://placeholder.supabase.co';
    }
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
  }
  return url;
}

function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
      return 'placeholder-key';
    }
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  }
  return key;
}

function getAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
      return 'placeholder-key';
    }
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
  }
  return key;
}

let supabaseAdminInstance: SupabaseClient | null = null;
let supabaseClientInstance: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createClient(
      getSupabaseUrl(),
      getServiceRoleKey(),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          fetch: fetchWithTimeout,
        },
      }
    );
  }
  return supabaseAdminInstance;
}

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClientInstance) {
    supabaseClientInstance = createClient(
      getSupabaseUrl(),
      getAnonKey(),
      {
        global: {
          fetch: fetchWithTimeout,
        },
      }
    );
  }
  return supabaseClientInstance;
}

export const supabaseAdmin = getSupabaseAdmin();
export const supabaseClient = getSupabaseClient();
