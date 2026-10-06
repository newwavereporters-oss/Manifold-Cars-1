import { AdminUser, UserRole } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

type AuthStateListener = (user: AdminUser | null) => void;

class AuthService {
  private currentUser: AdminUser | null = null;
  private listeners: Set<AuthStateListener> = new Set();
  private authSubscriptionInitialized = false;

  constructor() {
    this.initAuth();
  }

  private async initAuth(): Promise<void> {
    if (this.authSubscriptionInitialized) return;
    this.authSubscriptionInitialized = true;

    try {
      // 1. Check existing Supabase session on startup
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession();

      if (sessionErr || !session?.user) {
        this.currentUser = null;
        this.notifyListeners();
      } else {
        // 2. Verify admin authorization
        const admin = await this.verifyAdminAuthorization(session.user.id, session.user.email || '');
        if (admin) {
          this.currentUser = admin;
        } else {
          // Authenticated user is not an active MANIFOLD admin (e.g. dealer or client)
          this.currentUser = null;
        }
        this.notifyListeners();
      }

      // 3. Listen to live Supabase Auth state changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT' || !session?.user) {
          this.currentUser = null;
          this.notifyListeners();
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const admin = await this.verifyAdminAuthorization(session.user.id, session.user.email || '');
          if (admin) {
            this.currentUser = admin;
          } else {
            // User is authenticated in Supabase but not an admin
            this.currentUser = null;
          }
          this.notifyListeners();
        }
      });
    } catch (e) {
      console.warn('Supabase auth initialization notice:', e);
      this.currentUser = null;
      this.notifyListeners();
    }
  }

  /**
   * Section 2: ADMIN AUTHORIZATION
   * Checks public.admin_users for:
   * - user_id = auth.users.id (or email match)
   * - status = 'active'
   * - role = 'admin' / authorized role
   */
  private async verifyAdminAuthorization(
    userId: string,
    email: string
  ): Promise<AdminUser | null> {
    const cleanEmail = email.trim().toLowerCase();

    try {
      // 1. Query public.admin_users by authenticated user_id
      let { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      // 2. If not matched by user_id, check by authorized email
      if (!data && cleanEmail) {
        const emailQuery = await supabase
          .from('admin_users')
          .select('*')
          .ilike('email', cleanEmail)
          .eq('status', 'active')
          .maybeSingle();

        if (emailQuery.data) {
          data = emailQuery.data;
          // Associate user_id with auth.users.id
          if (!data.user_id || data.user_id !== userId) {
            await supabase
              .from('admin_users')
              .update({ user_id: userId })
              .eq('id', data.id);
          }
        }
      }

      if (error || !data) {
        return null;
      }

      // 3. Confirm status is active
      if (data.status !== 'active') {
        return null;
      }

      // 4. Confirm authorized admin role
      const rawRole = String(data.role || '').toLowerCase();
      const isAuthorizedRole = rawRole === 'admin' || rawRole === 'super_admin' || rawRole === 'administrator';
      if (!isAuthorizedRole) {
        return null;
      }

      const roleStr = rawRole === 'super_admin' ? 'SUPER_ADMIN' : 'ADMIN';

      return {
        id: data.id || userId,
        email: cleanEmail,
        name: data.name || 'MANIFOLD Administrator',
        role: roleStr as UserRole,
        last_sign_in: new Date().toISOString(),
      };
    } catch (e) {
      console.warn('Admin authorization verification failed:', e);
      return null;
    }
  }

  /**
   * Section 1: MANIFOLD ADMIN AUTHENTICATION
   * Uses real supabase.auth.signInWithPassword({ email, password })
   * Never compares passwords in frontend code.
   */
  public async signIn(
    email: string,
    password: string
  ): Promise<{ user: AdminUser | null; error: string | null }> {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      return { user: null, error: 'Please enter both email and password.' };
    }

    if (!isSupabaseConfigured) {
      return {
        user: null,
        error:
          'Supabase credentials are not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your environment, or configure them via the connection panel.',
      };
    }

    try {
      // 1. Authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (authError || !authData.user) {
        return {
          user: null,
          error: authError?.message || 'Invalid email or password.',
        };
      }

      // 2. Query public.admin_users to confirm active admin status
      const admin = await this.verifyAdminAuthorization(authData.user.id, cleanEmail);

      if (!admin) {
        // Immediately sign them out of Supabase Auth
        await supabase.auth.signOut();
        this.currentUser = null;
        this.notifyListeners();
        return {
          user: null,
          error: 'You are not authorized to access the MANIFOLD Admin Area.',
        };
      }

      this.currentUser = admin;
      this.notifyListeners();
      return { user: admin, error: null };
    } catch (err: any) {
      return {
        user: null,
        error: err.message || 'Authentication failed. Please verify your Supabase credentials.',
      };
    }
  }

  /**
   * Section 5: REAL SUPABASE LOGOUT
   */
  public async signOut(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Supabase signOut error:', e);
    }
    this.currentUser = null;
    this.notifyListeners();
  }

  public getCurrentUser(): AdminUser | null {
    return this.currentUser;
  }

  public isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  public hasRole(requiredRole: UserRole): boolean {
    if (!this.currentUser) return false;
    if (this.currentUser.role === 'ADMIN') return true;
    return this.currentUser.role === requiredRole;
  }

  public onAuthStateChange(callback: AuthStateListener): () => void {
    this.listeners.add(callback);
    callback(this.currentUser);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    const user = this.currentUser;
    this.listeners.forEach((fn) => {
      try {
        fn(user);
      } catch (e) {
        console.error('Auth state listener error:', e);
      }
    });
  }
}

export const authService = new AuthService();
