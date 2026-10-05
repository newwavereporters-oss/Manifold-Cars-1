import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY = 'manifold_supabase_credentials';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

export function getSupabaseConfig(): SupabaseConfig {
  let url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  let anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  // Also check browser localStorage override so the admin can configure it live
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.url && parsed.anonKey) {
        url = parsed.url.trim();
        anonKey = parsed.anonKey.trim();
      }
    }
  } catch (e) {
    // ignore
  }

  const isConfigured = Boolean(
    url &&
    anonKey &&
    url.startsWith('https://') &&
    url.includes('.supabase.co')
  );

  return {
    url,
    anonKey,
    isConfigured,
  };
}

export function setSupabaseConfig(url: string, anonKey: string): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() })
    );
    // Refresh client instance
    initSupabaseClient();
  } catch (e) {
    console.warn('Failed to save Supabase credentials', e);
  }
}

export function clearSupabaseConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    supabaseInstance = null;
  } catch (e) {
    // ignore
  }
}

let supabaseInstance: SupabaseClient | null = null;

function initSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.isConfigured) {
    supabaseInstance = null;
    return null;
  }

  try {
    supabaseInstance = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    return supabaseInstance;
  } catch (e) {
    console.error('Failed to initialize Supabase client:', e);
    supabaseInstance = null;
    return null;
  }
}

// Initial load
initSupabaseClient();

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseInstance) {
    return initSupabaseClient();
  }
  return supabaseInstance;
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig().isConfigured;
}

export async function testSupabaseConnection(
  testUrl?: string,
  testKey?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const url = testUrl || getSupabaseConfig().url;
    const key = testKey || getSupabaseConfig().anonKey;

    if (!url || !key) {
      return { success: false, message: 'Please enter both Supabase Project URL and Anon Public Key.' };
    }

    if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
      return {
        success: false,
        message: 'Invalid Supabase URL. It should look like: https://xyzcompany.supabase.co',
      };
    }

    const testClient = createClient(url, key);
    // Ping with a lightweight query (e.g. check table or auth health)
    const { error } = await testClient.from('cars').select('id').limit(1);

    if (error && error.code !== 'PGRST116') {
      // If table doesn't exist yet, connection itself is still verified!
      if (error.message.includes('relation "public.cars" does not exist') || error.code === '42P01') {
        return {
          success: true,
          message: 'Connection successful! (Note: The "cars" table has not been created yet; run the SQL schema script provided below).',
        };
      }
      return {
        success: false,
        message: `Supabase responded with: ${error.message}`,
      };
    }

    return {
      success: true,
      message: 'Successfully connected to Supabase database!',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Failed to connect to Supabase.',
    };
  }
}
