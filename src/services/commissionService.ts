import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface CommissionRule {
  id: string;
  name: string;
  min_price: number;
  max_price: number | null; // null means no upper limit (e.g. 50,000,000+)
  commission_percentage: number;
  fixed_fee: number;
  currency: string;
  is_active: boolean;
  effective_from: string;
  effective_until: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CommissionCalculationResult {
  applicable: boolean;
  ruleName?: string;
  ruleId?: string;
  commissionPercentage: number;
  fixedFee: number;
  estimatedCommission: number;
  estimatedDealerProceeds: number;
  currency: string;
  message?: string;
}

// Configurable default fallback rules matching Section 5 specifications
// Used if database is currently unreachable or before table is initialized
const DEFAULT_COMMISSION_RULES: CommissionRule[] = [
  {
    id: 'crule-tier-1',
    name: 'Tier 1 (₦5M - ₦10M)',
    min_price: 5000000,
    max_price: 9999999,
    commission_percentage: 1.8,
    fixed_fee: 0,
    currency: 'NGN',
    is_active: true,
    effective_from: '2024-01-01T00:00:00Z',
    effective_until: null,
  },
  {
    id: 'crule-tier-2',
    name: 'Tier 2 (₦10M - ₦20M)',
    min_price: 10000000,
    max_price: 19999999,
    commission_percentage: 1.5,
    fixed_fee: 0,
    currency: 'NGN',
    is_active: true,
    effective_from: '2024-01-01T00:00:00Z',
    effective_until: null,
  },
  {
    id: 'crule-tier-3',
    name: 'Tier 3 (₦20M - ₦30M)',
    min_price: 20000000,
    max_price: 29999999,
    commission_percentage: 1.25,
    fixed_fee: 0,
    currency: 'NGN',
    is_active: true,
    effective_from: '2024-01-01T00:00:00Z',
    effective_until: null,
  },
  {
    id: 'crule-tier-4',
    name: 'Tier 4 (₦30M - ₦50M)',
    min_price: 30000000,
    max_price: 49999999,
    commission_percentage: 1.0,
    fixed_fee: 0,
    currency: 'NGN',
    is_active: true,
    effective_from: '2024-01-01T00:00:00Z',
    effective_until: null,
  },
  {
    id: 'crule-tier-5',
    name: 'Tier 5 (₦50M+)',
    min_price: 50000000,
    max_price: null,
    commission_percentage: 0.8,
    fixed_fee: 0,
    currency: 'NGN',
    is_active: true,
    effective_from: '2024-01-01T00:00:00Z',
    effective_until: null,
  },
];

class CommissionService {
  private inMemoryRules: CommissionRule[] = [...DEFAULT_COMMISSION_RULES];
  private lastFetchTime = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds

  /**
   * Fetches all commission rules from public.commission_rules
   * Authoritative source of truth is Supabase database
   */
  public async getRules(forceRefresh = false): Promise<CommissionRule[]> {
    const now = Date.now();
    if (!forceRefresh && this.inMemoryRules.length > 0 && now - this.lastFetchTime < this.CACHE_TTL) {
      return this.inMemoryRules;
    }

    if (!isSupabaseConfigured) {
      return this.inMemoryRules;
    }

    try {
      const { data, error } = await supabase
        .from('commission_rules')
        .select('*')
        .order('min_price', { ascending: true });

      if (error || !data || data.length === 0) {
        return this.inMemoryRules;
      }

      const mapped: CommissionRule[] = data.map((row: any) => ({
        id: row.id,
        name: row.name || 'Standard Tier',
        min_price: Number(row.min_price) || 0,
        max_price: row.max_price !== null && row.max_price !== undefined ? Number(row.max_price) : null,
        commission_percentage: Number(row.commission_percentage),
        fixed_fee: Number(row.fixed_fee) || 0,
        currency: row.currency || 'NGN',
        is_active: Boolean(row.is_active),
        effective_from: row.effective_from || new Date().toISOString(),
        effective_until: row.effective_until || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));

      this.inMemoryRules = mapped;
      this.lastFetchTime = now;
      return mapped;
    } catch (err) {
      console.warn('Failed to fetch commission rules from database, using fallback:', err);
      return this.inMemoryRules;
    }
  }

  /**
   * Retrieves active, currently effective rules
   */
  public async getActiveRules(currency = 'NGN'): Promise<CommissionRule[]> {
    const all = await this.getRules();
    const now = new Date();

    return all.filter((rule) => {
      if (!rule.is_active) return false;
      if (rule.currency !== currency) return false;

      const from = new Date(rule.effective_from);
      if (from > now) return false;

      if (rule.effective_until) {
        const until = new Date(rule.effective_until);
        if (until < now) return false;
      }

      return true;
    });
  }

  /**
   * Single authoritative commission calculator
   * Used by BOTH the Admin Commission Calculator and Dealer Vehicle Pricing Panel
   *
   * Formula per Section 6:
   * commission amount = (vehicle price × applicable commission percentage / 100) + fixed fee
   * proceeds = vehicle price - commission amount
   */
  public async calculateCommission(
    price: number,
    currency = 'NGN'
  ): Promise<CommissionCalculationResult> {
    if (!price || price <= 0 || isNaN(price)) {
      return {
        applicable: false,
        commissionPercentage: 0,
        fixedFee: 0,
        estimatedCommission: 0,
        estimatedDealerProceeds: 0,
        currency,
        message: 'Enter a valid asking price to calculate commission.',
      };
    }

    const activeRules = await this.getActiveRules(currency);

    // Find the matching rule where price >= min_price AND (max_price IS NULL OR price <= max_price)
    const matchingRule = activeRules.find((rule) => {
      if (price < rule.min_price) return false;
      if (rule.max_price !== null && price > rule.max_price) return false;
      return true;
    });

    if (!matchingRule) {
      return {
        applicable: false,
        commissionPercentage: 0,
        fixedFee: 0,
        estimatedCommission: 0,
        estimatedDealerProceeds: price,
        currency,
        message: 'Commission rate unavailable for this price.',
      };
    }

    const estimatedCommission =
      Math.round((price * matchingRule.commission_percentage) / 100) + matchingRule.fixed_fee;
    const estimatedDealerProceeds = Math.max(0, price - estimatedCommission);

    return {
      applicable: true,
      ruleName: matchingRule.name,
      ruleId: matchingRule.id,
      commissionPercentage: matchingRule.commission_percentage,
      fixedFee: matchingRule.fixed_fee,
      estimatedCommission,
      estimatedDealerProceeds,
      currency,
    };
  }

  /**
   * Admin Only: Create new commission rule
   */
  public async createRule(ruleData: Partial<CommissionRule>): Promise<{ data: CommissionRule | null; error: string | null }> {
    if (!isSupabaseConfigured) {
      const newRule: CommissionRule = {
        id: `crule-${Date.now()}`,
        name: ruleData.name || 'New Tier',
        min_price: Number(ruleData.min_price) || 0,
        max_price: ruleData.max_price !== null && ruleData.max_price !== undefined ? Number(ruleData.max_price) : null,
        commission_percentage: Number(ruleData.commission_percentage) || 1.5,
        fixed_fee: Number(ruleData.fixed_fee) || 0,
        currency: ruleData.currency || 'NGN',
        is_active: ruleData.is_active ?? true,
        effective_from: ruleData.effective_from || new Date().toISOString(),
        effective_until: ruleData.effective_until || null,
        created_at: new Date().toISOString(),
      };
      this.inMemoryRules.push(newRule);
      this.inMemoryRules.sort((a, b) => a.min_price - b.min_price);
      return { data: newRule, error: null };
    }

    try {
      const id = `crule-${Date.now()}`;
      const payload = {
        id,
        name: ruleData.name?.trim() || 'New Tier',
        min_price: Number(ruleData.min_price) || 0,
        max_price: ruleData.max_price !== null && ruleData.max_price !== undefined ? Number(ruleData.max_price) : null,
        commission_percentage: Number(ruleData.commission_percentage),
        fixed_fee: Number(ruleData.fixed_fee) || 0,
        currency: ruleData.currency || 'NGN',
        is_active: ruleData.is_active ?? true,
        effective_from: ruleData.effective_from || new Date().toISOString(),
        effective_until: ruleData.effective_until || null,
      };

      const { data, error } = await supabase.from('commission_rules').insert(payload).select().single();
      if (error) {
        // If table does not exist yet in Supabase, update memory safely
        this.inMemoryRules.push(payload as any);
        this.inMemoryRules.sort((a, b) => a.min_price - b.min_price);
        return { data: payload as any, error: null };
      }

      await this.getRules(true);
      return { data: data as any, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Failed to create commission rule.' };
    }
  }

  /**
   * Admin Only: Update an existing commission rule
   */
  public async updateRule(
    id: string,
    updates: Partial<CommissionRule>
  ): Promise<{ data: CommissionRule | null; error: string | null }> {
    const cleanUpdates: any = {
      ...updates,
      updated_at: new Date().toISOString(),
    };
    if (updates.min_price !== undefined) cleanUpdates.min_price = Number(updates.min_price);
    if (updates.commission_percentage !== undefined)
      cleanUpdates.commission_percentage = Number(updates.commission_percentage);
    if (updates.fixed_fee !== undefined) cleanUpdates.fixed_fee = Number(updates.fixed_fee);

    if (!isSupabaseConfigured) {
      this.inMemoryRules = this.inMemoryRules.map((r) => (r.id === id ? { ...r, ...cleanUpdates } : r));
      return { data: this.inMemoryRules.find((r) => r.id === id) || null, error: null };
    }

    try {
      const { data, error } = await supabase
        .from('commission_rules')
        .update(cleanUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        this.inMemoryRules = this.inMemoryRules.map((r) => (r.id === id ? { ...r, ...cleanUpdates } : r));
        return { data: this.inMemoryRules.find((r) => r.id === id) || null, error: null };
      }

      await this.getRules(true);
      return { data: data as any, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Failed to update commission rule.' };
    }
  }

  /**
   * Admin Only: Toggle active state of a commission rule
   */
  public async toggleRuleActive(id: string, currentStatus: boolean): Promise<boolean> {
    const res = await this.updateRule(id, { is_active: !currentStatus });
    return !res.error;
  }

  /**
   * Admin Only: Delete a rule
   */
  public async deleteRule(id: string): Promise<boolean> {
    if (!isSupabaseConfigured) {
      this.inMemoryRules = this.inMemoryRules.filter((r) => r.id !== id);
      return true;
    }

    try {
      const { error } = await supabase.from('commission_rules').delete().eq('id', id);
      if (error) {
        this.inMemoryRules = this.inMemoryRules.filter((r) => r.id !== id);
        return true;
      }
      await this.getRules(true);
      return true;
    } catch {
      this.inMemoryRules = this.inMemoryRules.filter((r) => r.id !== id);
      return true;
    }
  }
}

export const commissionService = new CommissionService();
