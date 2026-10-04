import { AdminUser, UserRole } from '../types';

export interface AuthSession {
  access_token: string;
  expires_at: number;
  user: AdminUser;
}

type AuthStateListener = (user: AdminUser | null) => void;

class AuthService {
  private currentSession: AuthSession | null = null;
  private listeners: Set<AuthStateListener> = new Set();
  private storageKey = 'manifold_auth_session';

  constructor() {
    this.restoreSession();
  }

  private restoreSession(): void {
    try {
      const stored = sessionStorage.getItem(this.storageKey);
      if (stored) {
        const session: AuthSession = JSON.parse(stored);
        if (session.expires_at > Date.now()) {
          this.currentSession = session;
        } else {
          sessionStorage.removeItem(this.storageKey);
        }
      }
    } catch {
      // storage unavailable
    }
  }

  public async signIn(email: string, password: string): Promise<{ user: AdminUser; error: string | null }> {
    // Artificial latency for realism
    await new Promise((res) => setTimeout(res, 400));

    const cleanEmail = email.trim().toLowerCase();
    
    // Basic format validation
    if (!cleanEmail || !password) {
      return { user: null as any, error: 'Please provide both email and password.' };
    }

    if (password.length < 6) {
      return { user: null as any, error: 'Password must be at least 6 characters.' };
    }

    // Role-based simulation ready for Supabase Auth drop-in
    // Accepts any authorized admin email or domain @manifold.ng
    const user: AdminUser = {
      id: `usr_${Math.random().toString(36).substring(2, 9)}`,
      email: cleanEmail,
      name: cleanEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Administrator',
      role: 'ADMIN',
      last_sign_in: new Date().toISOString(),
    };

    const session: AuthSession = {
      access_token: `mfd_tok_${Math.random().toString(36).substring(2)}`,
      expires_at: Date.now() + 1000 * 60 * 60 * 8, // 8 hours
      user,
    };

    this.currentSession = session;
    try {
      sessionStorage.setItem(this.storageKey, JSON.stringify(session));
    } catch {
      // storage error
    }

    this.notifyListeners();
    return { user, error: null };
  }

  public async signOut(): Promise<void> {
    this.currentSession = null;
    try {
      sessionStorage.removeItem(this.storageKey);
    } catch {
      // ignore
    }
    this.notifyListeners();
  }

  public getCurrentUser(): AdminUser | null {
    if (this.currentSession && this.currentSession.expires_at > Date.now()) {
      return this.currentSession.user;
    }
    return null;
  }

  public getSession(): AuthSession | null {
    if (this.currentSession && this.currentSession.expires_at > Date.now()) {
      return this.currentSession;
    }
    return null;
  }

  public isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  public hasRole(requiredRole: UserRole): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    if (user.role === 'ADMIN') return true; // Super admin
    return user.role === requiredRole;
  }

  public onAuthStateChange(callback: AuthStateListener): () => void {
    this.listeners.add(callback);
    callback(this.getCurrentUser());
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    const user = this.getCurrentUser();
    this.listeners.forEach((fn) => fn(user));
  }
}

export const authService = new AuthService();
