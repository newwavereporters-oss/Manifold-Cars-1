import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY = 'manifold_supabase_credentials';

function getCredentials() {
  const envUrl = (
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
    ''
  ).trim();
  const envKey = (
    (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY)) ||
    (typeof process !== 'undefined' && (process.env?.VITE_SUPABASE_PUBLISHABLE_KEY || process.env?.VITE_SUPABASE_ANON_KEY)) ||
    ''
  ).trim();

  let localUrl = '';
  let localKey = '';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      localUrl = (parsed.url || '').trim();
      localKey = (parsed.anonKey || parsed.publishableKey || '').trim();
    }
  } catch {
    // ignore
  }

  const url = envUrl || localUrl;
  const key = envKey || localKey;

  const isConfigured = Boolean(
    url &&
    key &&
    url.startsWith('https://')
  );

  return { url, key, isConfigured };
}

const creds = getCredentials();

export const isSupabaseConfigured = creds.isConfigured;
export const checkIsSupabaseConfigured = (): boolean => getCredentials().isConfigured;
export const supabaseUrl = creds.url;
export const supabasePublishableKey = creds.key;

export function getSupabaseConfig() {
  const c = getCredentials();
  return {
    url: c.url,
    anonKey: c.key,
    publishableKey: c.key,
    isConfigured: c.isConfigured,
  };
}

// Initialize the single authoritative Supabase client
// If credentials are not yet injected, fallback to a placeholder host to prevent React bundle crashes,
// but any network call will return a clear connection error.
export const supabase: SupabaseClient = createClient(
  creds.isConfigured ? creds.url : 'https://placeholder.supabase.co',
  creds.isConfigured ? creds.key : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'manifold_auth_token',
    },
  }
);

export function getSupabaseClient(): SupabaseClient {
  return supabase;
}

export function setSupabaseConfig(url: string, publishableKey: string): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ url: url.trim(), publishableKey: publishableKey.trim(), anonKey: publishableKey.trim() })
    );
    window.location.reload();
  } catch (e) {
    console.warn('Failed to save Supabase credentials', e);
  }
}

export function clearSupabaseConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  } catch (e) {
    // ignore
  }
}

export async function testSupabaseConnection(
  testUrl?: string,
  testKey?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const url = testUrl || creds.url;
    const key = testKey || creds.key;

    if (!url || !key) {
      return {
        success: false,
        message: 'Please enter both Supabase URL and Publishable / Anon Key.',
      };
    }

    if (!url.startsWith('https://')) {
      return {
        success: false,
        message: 'Invalid Supabase URL. Must begin with https://',
      };
    }

    const testClient = createClient(url, key);
    const { error } = await testClient.from('cars').select('id').limit(1);

    if (error && error.code !== 'PGRST116') {
      if (
        error.message.includes('relation "public.cars" does not exist') ||
        error.code === '42P01'
      ) {
        return {
          success: true,
          message:
            'Connected to Supabase! (Note: The "cars" table does not exist yet. Run the schema SQL script in your Supabase SQL editor).',
        };
      }
      return {
        success: false,
        message: `Supabase returned error: ${error.message}`,
      };
    }

    return {
      success: true,
      message: 'Successfully connected to live Supabase database!',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Failed to connect to Supabase.',
    };
  }
}
