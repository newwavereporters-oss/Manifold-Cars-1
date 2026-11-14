import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const ADMIN_BILLBOARD_WHATSAPP_NUMBER = '08169664607';
export const ADMIN_BILLBOARD_WHATSAPP_E164 = '2348169664607';

export function getDealerBillboardUpgradeWhatsAppUrl(dealerName?: string): string {
  const cleanDealer = (dealerName || '').trim();
  const intro = cleanDealer
    ? `Hello Manifold Admin, I represent dealership "${cleanDealer}" and want to advertise more vehicles on the Game World Billboard.`
    : 'Hello Manifold Admin, I am a verified dealer and want to advertise more vehicles on the Game World Billboard.';
  return `https://wa.me/${ADMIN_BILLBOARD_WHATSAPP_E164}?text=${encodeURIComponent(intro)}`;
}

export interface GameBillboardItem {
  assignment_id: string;
  vehicle_id: string;
  dealer_id: string;
  dealer_name: string;
  dealer_city: string | null;
  slug: string;
  year: number;
  title: string;
  short_description: string;
  price: number;
  previous_price: number | null;
  image_url: string;
  location: string | null;
  priority_order: number;
}

export interface DealerBillboardAssignmentRow {
  id: string;
  dealer_id: string;
  vehicle_id: string;
  status: 'active' | 'paused' | 'removed' | 'expired';
  priority_order: number;
  updated_at: string;
  vehicle_title?: string;
  vehicle_year?: number;
  vehicle_slug?: string;
  vehicle_price?: number;
  vehicle_previous_price?: number | null;
  vehicle_image?: string | null;
  vehicle_status?: string;
}

export interface DealerBillboardState {
  dealer_id: string;
  plan_name: string;
  max_active_slots: number;
  active_slots_used: number;
  remaining_slots: number;
  upgrade_contact_whatsapp: string;
  assignments: DealerBillboardAssignmentRow[];
  schemaNotApplied?: boolean;
}

export interface AdminBillboardAssignmentRow {
  assignment_id: string;
  dealer_id: string;
  dealer_name: string;
  vehicle_id: string;
  vehicle_title: string;
  vehicle_slug: string;
  vehicle_status: string;
  price: number;
  previous_price: number | null;
  image_url: string;
  status: 'active' | 'paused' | 'removed' | 'expired';
  priority_order: number;
  assigned_at: string;
}

export interface AdminDealerQuotaRow {
  dealer_id: string;
  dealer_name: string;
  dealer_city: string;
  plan_name: string;
  max_active_slots: number;
  active_slots_used: number;
  notes?: string | null;
}

export interface AdminBillboardOverview {
  assignments: AdminBillboardAssignmentRow[];
  dealer_quotas: AdminDealerQuotaRow[];
  schemaNotApplied?: boolean;
}

function isMissingBillboardSchemaError(err: any): boolean {
  const msg = String(err?.message || err || '');
  return (
    err?.code === 'PGRST202' ||
    err?.code === 'PGRST205' ||
    err?.code === '42P01' ||
    err?.code === '42883' ||
    msg.includes('Could not find the function') ||
    msg.includes('does not exist')
  );
}

function formatPlanLabel(planCode: string | null | undefined, maxSlots: number): string {
  const code = (planCode || '').toLowerCase();
  if (code === 'featured_pro' || maxSlots > 1) {
    return `Featured Pro (${maxSlots} Slots)`;
  }
  return 'Standard Plan (1 Slot)';
}

export const billboardService = {
  async getActiveBillboards(): Promise<GameBillboardItem[]> {
    if (!isSupabaseConfigured) return [];
    try {
      const { data, error } = await supabase.rpc('get_active_game_billboards');
      if (error) {
        if (isMissingBillboardSchemaError(error)) return [];
        console.warn('get_active_game_billboards failed:', error.message);
        return [];
      }
      if (!Array.isArray(data)) return [];
      return data
        .map((r: any): GameBillboardItem => ({
          assignment_id: String(r.assignmentId || r.assignment_id || ''),
          vehicle_id: String(r.vehicleId || r.vehicle_id || ''),
          dealer_id: String(r.dealerId || r.dealer_id || ''),
          dealer_name: String(r.dealerName || r.dealer_name || 'Verified Dealer'),
          dealer_city: r.dealerCity ?? r.dealer_city ?? null,
          slug: String(r.slug || ''),
          year: Number(r.year || 0),
          title: String(r.title || ''),
          short_description: String(r.description || r.short_description || ''),
          price: Number(r.price || 0),
          previous_price:
            r.previousPrice != null
              ? Number(r.previousPrice)
              : r.originalPrice != null
              ? Number(r.originalPrice)
              : r.previous_price != null
              ? Number(r.previous_price)
              : null,
          image_url: String(r.imageUrl || r.image_url || ''),
          location: r.location ?? null,
          priority_order: Number(r.displayOrder ?? r.priority_order ?? 100),
        }))
        .filter((item) => Boolean(item.vehicle_id && item.slug && item.title));
    } catch {
      return [];
    }
  },

  async getMyDealerBillboardState(): Promise<DealerBillboardState> {
    const emptyFallback: DealerBillboardState = {
      dealer_id: '',
      plan_name: 'Standard Plan (1 Slot)',
      max_active_slots: 1,
      active_slots_used: 0,
      remaining_slots: 1,
      upgrade_contact_whatsapp: ADMIN_BILLBOARD_WHATSAPP_NUMBER,
      assignments: [],
    };
    if (!isSupabaseConfigured) return emptyFallback;

    const { data, error } = await supabase.rpc('get_my_dealer_billboard_state');
    if (error) {
      if (isMissingBillboardSchemaError(error)) {
        return { ...emptyFallback, schemaNotApplied: true };
      }
      throw new Error(error.message);
    }
    const row = (data || {}) as any;
    const maxSlots = Number(row.maxActiveSlots ?? row.max_active_slots ?? 1);
    const activeUsed = Number(row.activeCount ?? row.active_slots_used ?? 0);
    const rawAssignments = Array.isArray(row.assignments) ? row.assignments : [];

    return {
      dealer_id: String(row.dealerId || row.dealer_id || ''),
      plan_name: formatPlanLabel(row.planCode || row.plan_name, maxSlots),
      max_active_slots: maxSlots,
      active_slots_used: activeUsed,
      remaining_slots: Math.max(0, maxSlots - activeUsed),
      upgrade_contact_whatsapp: ADMIN_BILLBOARD_WHATSAPP_NUMBER,
      assignments: rawAssignments.map((a: any): DealerBillboardAssignmentRow => ({
        id: String(a.id || ''),
        dealer_id: String(a.dealerId || a.dealer_id || ''),
        vehicle_id: String(a.vehicleListingId || a.vehicle_id || ''),
        status: a.status || 'active',
        priority_order: Number(a.displayOrder ?? a.priority_order ?? 100),
        updated_at: String(a.updatedAt || a.updated_at || ''),
        vehicle_title: a.vehicleTitle || a.vehicle_title,
        vehicle_year: a.vehicleYear || a.vehicle_year,
        vehicle_slug: a.vehicleSlug || a.vehicle_slug,
        vehicle_price: a.vehiclePrice != null ? Number(a.vehiclePrice) : undefined,
        vehicle_previous_price:
          a.vehiclePreviousPrice != null ? Number(a.vehiclePreviousPrice) : null,
        vehicle_image: a.vehicleImageUrl || a.vehicle_image || null,
        vehicle_status: a.vehicleStatus || a.vehicle_status,
      })),
    };
  },

  async assignVehicleToBillboard(
    vehicleId: string,
    replaceExisting = false
  ): Promise<{ success: boolean; alreadyActive?: boolean; errorCode?: string; message?: string }> {
    if (!isSupabaseConfigured) {
      return { success: false, message: 'Supabase is not configured in this environment.' };
    }
    const { data, error } = await supabase.rpc('assign_vehicle_to_game_billboard', {
      p_vehicle_id: vehicleId,
      p_replace_existing: replaceExisting,
    });
    if (error) {
      if (isMissingBillboardSchemaError(error)) {
        return {
          success: false,
          errorCode: 'SCHEMA_NOT_APPLIED',
          message: 'Run src/db/manifold-game-expansion-migration.sql in your Supabase SQL Editor first.',
        };
      }
      if (error.message.includes('BILLBOARD_SLOT_LIMIT_REACHED')) {
        return {
          success: false,
          errorCode: 'BILLBOARD_SLOT_LIMIT_REACHED',
          message:
            'Your dealership is currently using its 1 active Game Billboard slot. Replace your existing billboard vehicle or chat with Admin on WhatsApp (08169664607) to advertise more vehicles.',
        };
      }
      return { success: false, message: error.message };
    }
    const payload = (data || {}) as { success?: boolean; assignmentId?: string; alreadyActive?: boolean };
    return {
      success: Boolean(payload.success || payload.assignmentId || data),
      alreadyActive: Boolean(payload.alreadyActive),
    };
  },

  async removeMyBillboardSlot(assignmentId: string): Promise<{ success: boolean; message?: string }> {
    if (!isSupabaseConfigured) return { success: false, message: 'Supabase is not configured.' };
    const { error } = await supabase.rpc('remove_my_game_billboard_slot', {
      p_assignment_id: assignmentId,
    });
    if (error) return { success: false, message: error.message };
    return { success: true };
  },

  async adminGetBillboardOverview(): Promise<AdminBillboardOverview> {
    if (!isSupabaseConfigured) return { assignments: [], dealer_quotas: [] };
    const { data, error } = await supabase.rpc('admin_get_billboard_overview');
    if (error) {
      if (isMissingBillboardSchemaError(error)) {
        return { assignments: [], dealer_quotas: [], schemaNotApplied: true };
      }
      throw new Error(error.message);
    }
    const res = (data || {}) as any;
    const rawAssignments = Array.isArray(res.assignments) ? res.assignments : [];
    const rawDealers = Array.isArray(res.dealers || res.dealer_quotas)
      ? res.dealers || res.dealer_quotas
      : [];

    return {
      assignments: rawAssignments.map((r: any): AdminBillboardAssignmentRow => ({
        assignment_id: String(r.id || r.assignment_id || ''),
        dealer_id: String(r.dealerId || r.dealer_id || ''),
        dealer_name: String(r.dealerName || r.dealer_name || ''),
        vehicle_id: String(r.vehicleListingId || r.vehicle_id || ''),
        vehicle_title: String(r.vehicleTitle || r.vehicle_title || ''),
        vehicle_slug: String(r.vehicleSlug || r.vehicle_slug || ''),
        vehicle_status: String(r.vehicleStatus || r.vehicle_status || ''),
        price: Number(r.vehiclePrice ?? r.price ?? 0),
        previous_price: r.vehiclePreviousPrice != null ? Number(r.vehiclePreviousPrice) : null,
        image_url: String(r.vehicleImageUrl || r.image_url || ''),
        status: r.status || 'active',
        priority_order: Number(r.displayOrder ?? r.priority_order ?? 100),
        assigned_at: String(r.updatedAt || r.createdAt || r.assigned_at || ''),
      })),
      dealer_quotas: rawDealers.map((d: any): AdminDealerQuotaRow => {
        const maxSlots = Number(d.maxActiveSlots ?? d.max_active_slots ?? 1);
        return {
          dealer_id: String(d.dealerId || d.dealer_id || ''),
          dealer_name: String(d.dealerName || d.dealer_name || ''),
          dealer_city: String(d.dealerCity || d.dealer_city || ''),
          plan_name: formatPlanLabel(d.planCode || d.plan_name, maxSlots),
          max_active_slots: maxSlots,
          active_slots_used: Number(d.activeSlotsUsed ?? d.active_slots_used ?? 0),
          notes: d.notes ?? null,
        };
      }),
    };
  },

  async adminManageBillboardAssignment(
    assignmentId: string,
    status: 'active' | 'paused' | 'removed' | 'expired',
    displayOrder?: number | null
  ): Promise<void> {
    const { error } = await supabase.rpc('admin_manage_billboard_assignment', {
      p_assignment_id: assignmentId,
      p_status: status,
      p_display_order: displayOrder ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async adminSetDealerBillboardSlots(
    dealerId: string,
    maxActiveSlots: number,
    planCode?: string,
    notes?: string
  ): Promise<void> {
    const slots = Math.max(1, Math.min(25, Math.round(maxActiveSlots)));
    const { error } = await supabase.rpc('admin_set_dealer_billboard_slots', {
      p_dealer_id: dealerId,
      p_max_slots: slots,
      p_plan_code: planCode || (slots > 1 ? 'featured_pro' : 'standard'),
      p_notes: notes ?? null,
    });
    if (error) throw new Error(error.message);
  },
};
