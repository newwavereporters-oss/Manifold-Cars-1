import { supabase, isSupabaseConfigured, getSupabaseConfig } from '../lib/supabase';
import { extractYouTubeVideoId, getYouTubeThumbnailUrl } from '../utils/youtube';
import {
  buildVehicleModelTitle,
  generateUuid,
  normalizeVehicleCondition,
} from '../utils/carMedia';
import { isVerifiedManifoldStorageImageUrl } from '../utils/vehicleImageUrl';
import { resolveDealerApprovalState } from './dealerOnboardingService';
import { categoryService } from './categoryService';
import { brandService } from './brandService';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const OPTIONAL_CAR_SCHEMA_COLUMNS = new Set([
  'variant',
  'trim',
  'previous_price',
  'original_price',
  'views_count',
  'horsepower',
  'engine',
  'seats',
  'doors',
  'youtube_url',
  'youtube_video_id',
  'youtube_thumbnail_url',
  'gallery_image_1_url',
  'gallery_image_2_url',
]);

export function getDealerListingBlockReason(
  accountStatus: unknown,
  isVerified?: boolean | null,
  dealerStatus?: unknown
): string | null {
  const resolved = resolveDealerApprovalState(accountStatus, isVerified, dealerStatus);
  if (resolved.isApproved) return null;

  if (resolved.accountStatus === 'suspended') {
    return 'Your dealership account is currently suspended. Please contact MANIFOLD dealer support.';
  }
  if (resolved.approvalStatus === 'disapproved') {
    return 'Your dealership account is not currently approved for vehicle listing. You still have full access to your dashboard, and listing will unlock once an administrator approves your account.';
  }
  return 'Your dealership account is pending admin approval. You can access your dashboard and profile now, and vehicle listing will unlock once an administrator approves your account.';
}

export interface DealerCarFormInput {
  submissionId?: string;
  brand_id?: string;
  make: string;
  model: string;
  trim?: string;
  year: number;
  type_id?: string;
  body_type: string;
  condition: string;
  mileage: number;
  fuel_type: string;
  transmission: string;
  drive_type: string;
  engine?: string;
  horsepower?: number | null;
  exterior_color: string;
  interior_color: string;
  seats?: number;
  doors?: number;
  price: number;
  previous_price?: number | null;
  location: string;
  state?: string;
  description: string;
  youtube_url?: string;
  youtube_title?: string;
  youtube_description?: string;
  gallery_image_1_url?: string;
  gallery_image_2_url?: string;
}

export interface DealerCarRecord {
  id: string;
  slug: string;
  title: string;
  year: number;
  brand_id?: string | null;
  make: string;
  model: string;
  trim?: string;
  type_id?: string | null;
  body_type: string;
  condition: string;
  price: number;
  previous_price?: number | null;
  currency: string;
  mileage: number;
  transmission: string;
  fuel_type: string;
  drive_type: string;
  engine?: string;
  horsepower?: number | null;
  exterior_color: string;
  interior_color: string;
  seats?: number;
  doors?: number;
  location: string;
  state: string;
  description: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'RESERVED' | 'SOLD' | 'ARCHIVED';
  is_verified: boolean;
  is_featured: boolean;
  dealer_id: string;
  created_at: string;
  updated_at: string;
  youtube_url?: string;
  youtube_video_id?: string;
  youtube_thumbnail_url?: string;
  gallery_image_1_url?: string;
  gallery_image_2_url?: string;
}

export interface DealerVehicleWriteErrorDetails {
  table: string;
  operation: 'insert' | 'update' | 'verify';
  code?: string;
  message: string;
  details?: string;
  hint?: string;
  status?: number;
  authUserId?: string;
  dealerId?: string;
  payloadKeys?: string[];
}

export interface DealerVehicleMutationResult {
  car: DealerCarRecord | null;
  createdCarId?: string | null;
  error: string | null;
  errorDetails?: DealerVehicleWriteErrorDetails | null;
  partialMediaError?: string | null;
}

interface SupabaseLikeError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
}

export function extractMissingOptionalColumnFromError(
  error: SupabaseLikeError | null | undefined,
  payload: Record<string, unknown>
): string | null {
  if (!error) return null;
  const code = (error.code || '').toUpperCase();
  const msg = error.message || '';
  const details = error.details || '';
  const combined = `${msg} ${details}`;

  const isMissingColCode =
    code === 'PGRST204' ||
    code === '42703' ||
    /could not find the ['"][a-z0-9_]+['"] column/i.test(combined) ||
    /column ['"]?[a-z0-9_.]+['"]? (of relation ['"]?[a-z0-9_]+['"]? )?does not exist/i.test(combined);

  if (!isMissingColCode) return null;

  const pgrstMatch = combined.match(/could not find the ['"]([a-z0-9_]+)['"] column/i);
  if (pgrstMatch?.[1] && OPTIONAL_CAR_SCHEMA_COLUMNS.has(pgrstMatch[1]) && pgrstMatch[1] in payload) {
    return pgrstMatch[1];
  }

  const pgMatch = combined.match(/column (?:[a-z0-9_]+\.)?['"]?([a-z0-9_]+)['"]? (?:of relation ['"]?[a-z0-9_]+['"]? )?does not exist/i);
  if (pgMatch?.[1] && OPTIONAL_CAR_SCHEMA_COLUMNS.has(pgMatch[1]) && pgMatch[1] in payload) {
    return pgMatch[1];
  }

  return null;
}

export function formatDealerSupabaseWriteError(
  error: SupabaseLikeError,
  context: {
    table: string;
    operation: 'insert' | 'update' | 'verify';
    authUserId?: string;
    dealerId?: string;
    payloadKeys?: string[];
    httpStatus?: number;
  }
): { userMessage: string; errorDetails: DealerVehicleWriteErrorDetails } {
  const code = error.code || undefined;
  const rawMessage = error.message || 'Unknown database error';
  const details = error.details || undefined;
  const hint = error.hint || undefined;
  const status = error.status ?? context.httpStatus;

  const errorDetails: DealerVehicleWriteErrorDetails = {
    table: context.table,
    operation: context.operation,
    code,
    message: rawMessage,
    details,
    hint,
    status,
    authUserId: context.authUserId,
    dealerId: context.dealerId,
    payloadKeys: context.payloadKeys,
  };

  let userMessage: string;
  if (code === '42501') {
    userMessage =
      'You do not currently have permission to save this vehicle. Please verify your dealership account is active and approved.';
  } else if (code === '22P02' || code === '23502' || code === '23514') {
    userMessage =
      'One or more vehicle details are invalid or incomplete. Please check your entries and try again.';
  } else if (code === '23503') {
    userMessage =
      'One of the selected vehicle options is no longer available. Please refresh the page and try again.';
  } else if (code === '23505') {
    userMessage =
      'This vehicle listing already exists. Please refresh your vehicle list before trying again.';
  } else if (code === 'PGRST204' || code === '42703') {
    userMessage =
      'Unable to save vehicle right now. Please try again or contact MANIFOLD support.';
  } else {
    userMessage =
      context.operation === 'update'
        ? 'Unable to update vehicle right now. Please try again.'
        : 'Unable to save vehicle right now. Please try again.';
  }

  return { userMessage, errorDetails };
}

class DealerVehicleService {
  private async resolveBrandUuid(brandIdOrName?: string | null, makeName?: string | null): Promise<string | null> {
    const raw = (brandIdOrName || '').trim();
    if (raw && UUID_REGEX.test(raw)) return raw;

    const candidates = [raw, (makeName || '').trim()].filter(Boolean);
    for (const candidate of candidates) {
      const cleaned = candidate.replace(/^__legacy__:/, '').trim();
      if (!cleaned) continue;
      if (UUID_REGEX.test(cleaned)) return cleaned;

      const byName = await brandService.getBrandByName(cleaned);
      if (byName && UUID_REGEX.test(byName.id)) return byName.id;

      const bySlug = await brandService.getBrandBySlug(cleaned);
      if (bySlug && UUID_REGEX.test(bySlug.id)) return bySlug.id;
    }

    return null;
  }

  /**
   * Fetches only vehicles belonging to the authenticated dealer
   * Database RLS and application filter guarantee dealer isolation
   */
  public async getDealerCars(dealerId: string): Promise<DealerCarRecord[]> {
    if (!isSupabaseConfigured || !dealerId) return [];

    try {
      const { data, error } = await supabase
        .from('cars')
        .select(`
          *,
          car_media (id, youtube_url, youtube_video_id, youtube_thumbnail_url, title),
          car_images (id, image_url, position)
        `)
        .eq('dealer_id', dealerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[dealerVehicleService.getDealerCars] Query failed:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          dealerId,
        });
        return [];
      }

      return (data || []).map((row: any) => this.mapRowToRecord(row));
    } catch (err) {
      console.error('[dealerVehicleService.getDealerCars] Unexpected error:', err);
      return [];
    }
  }

  /**
   * Fetches a specific vehicle for editing, verifying dealer ownership
   */
  public async getDealerCarById(carId: string, dealerId: string): Promise<DealerCarRecord | null> {
    if (!isSupabaseConfigured || !carId || !dealerId) return null;

    try {
      const { data, error } = await supabase
        .from('cars')
        .select(`
          *,
          car_media (id, youtube_url, youtube_video_id, youtube_thumbnail_url, title, description),
          car_images (id, image_url, position)
        `)
        .eq('id', carId)
        .eq('dealer_id', dealerId)
        .maybeSingle();

      if (error) {
        console.error('[dealerVehicleService.getDealerCarById] Query failed:', {
          code: error.code,
          message: error.message,
          details: error.details,
          carId,
          dealerId,
        });
        return null;
      }

      if (!data) return null;
      return this.mapRowToRecord(data);
    } catch (err) {
      console.error('[dealerVehicleService.getDealerCarById] Unexpected error:', err);
      return null;
    }
  }

  /**
   * Creates a new vehicle record owned by the authenticated dealer
   * Status is set directly: 'DRAFT' or 'PUBLISHED' (auto-approved)
   * The client CANNOT self-set 'is_verified=true' or 'is_featured=true'
   */
  public async createDealerCar(
    input: DealerCarFormInput,
    dealerId: string,
    isDraft: boolean
  ): Promise<DealerVehicleMutationResult> {
    if (!isSupabaseConfigured) {
      return {
        car: null,
        error: 'Vehicle listing service is currently unavailable. Please try again later.',
      };
    }

    if (!dealerId) {
      return { car: null, error: 'Dealership authorization context missing.' };
    }

    try {
      // Authoritative security check: resolve current auth session
      const { data: sessionResult, error: sessionError } = await supabase.auth.getSession();
      let authUser = sessionResult?.session?.user ?? null;
      if (!authUser) {
        const { data: userResult } = await supabase.auth.getUser();
        authUser = userResult?.user ?? null;
      }

      if (sessionError || !authUser) {
        return {
          car: null,
          error: 'Authentication session expired or missing. Please sign in again to list vehicles.',
        };
      }

      // Prevent admin users without a dealer account from listing vehicles
      const { data: adminRow } = await supabase
        .from('admin_users')
        .select('role')
        .eq('user_id', authUser.id)
        .eq('status', 'active')
        .maybeSingle();

      const { data: dealerAcc, error: dealerAccErr } = await supabase
        .from('dealer_accounts')
        .select('dealer_id, account_status')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (adminRow && !dealerAcc) {
        return { car: null, error: 'Vehicle listing is available to MANIFOLD dealer accounts.' };
      }

      if (dealerAccErr || !dealerAcc?.dealer_id) {
        console.error('[dealerVehicleService.createDealerCar] Dealer account lookup failed:', {
          authUserId: authUser.id,
          error: dealerAccErr,
        });
        return {
          car: null,
          error: dealerAccErr
            ? 'Unable to verify your dealership account right now. Please try again.'
            : 'A registered dealership account is required to list vehicles.',
        };
      }

      const authoritativeDealerId = String(dealerAcc.dealer_id);
      if (authoritativeDealerId !== String(dealerId)) {
        return { car: null, error: 'Dealership authorization mismatch.' };
      }

      // Enforce Admin Approval Gate (dashboard login is allowed when unapproved, car listing is NOT)
      let dealerVerified: boolean | null = null;
      let dealerStatusCol: unknown = undefined;
      const { data: dealerRow, error: dealerRowErr } = await supabase
        .from('dealers')
        .select('*')
        .eq('id', authoritativeDealerId)
        .maybeSingle();

      if (dealerRowErr) {
        console.warn('[dealerVehicleService.createDealerCar] Dealers row read warning:', dealerRowErr);
      }

      if (dealerRow) {
        if (typeof (dealerRow as any).is_verified === 'boolean') {
          dealerVerified = (dealerRow as any).is_verified;
        } else if (typeof (dealerRow as any).verified_partner === 'boolean') {
          dealerVerified = (dealerRow as any).verified_partner;
        }
        if ((dealerRow as any).dealer_status !== undefined && (dealerRow as any).dealer_status !== null) {
          dealerStatusCol = (dealerRow as any).dealer_status;
        }
      }

      const blockReason = getDealerListingBlockReason(
        dealerAcc.account_status,
        dealerVerified,
        dealerStatusCol
      );
      if (blockReason) {
        return { car: null, error: blockReason };
      }

      const makeClean = (input.make || '').trim();
      const modelClean = (input.model || '').trim();
      const numericPrice = Number(input.price) || 0;
      const numericMileage = Math.max(0, Number(input.mileage) || 0);

      if (!isDraft) {
        if (!makeClean || makeClean.toLowerCase() === 'vehicle') {
          return { car: null, error: 'Vehicle Brand / Make is required before submitting.' };
        }
        if (!modelClean || modelClean.toLowerCase() === 'model') {
          return { car: null, error: 'Vehicle Model is required before submitting.' };
        }
        if (numericPrice <= 0) {
          return { car: null, error: 'A valid positive retail price (NGN) is required.' };
        }
      }

      const id =
        input.submissionId && UUID_REGEX.test(input.submissionId.trim())
          ? input.submissionId.trim()
          : generateUuid();
      const title = buildVehicleModelTitle(makeClean || 'Vehicle', modelClean || 'Model');
      const slugBase = `${input.year || ''}-${title}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'vehicle';
      const slug = `${slugBase}-${id.slice(0, 8)}`;

      const rawYoutubeUrl = (input.youtube_url || '').trim();
      const vidId = rawYoutubeUrl ? extractYouTubeVideoId(rawYoutubeUrl) || '' : '';
      if (rawYoutubeUrl && !vidId) {
        return {
          car: null,
          error: 'The YouTube URL provided is invalid. Clear the field (video is optional) or paste a valid YouTube link.',
        };
      }
      const thumb = vidId ? getYouTubeThumbnailUrl(vidId) : '';

      // Auto-approved listing: publishing sets status directly to 'PUBLISHED'
      const status: DealerCarRecord['status'] = isDraft ? 'DRAFT' : 'PUBLISHED';

      const [resolvedBrandId, resolvedTypeId] = await Promise.all([
        this.resolveBrandUuid(input.brand_id, makeClean),
        categoryService.resolveTypeId(input.type_id, input.body_type),
      ]);

      const normalizedCondition = normalizeVehicleCondition(input.condition);
      const image1 = (input.gallery_image_1_url || '').trim() || null;
      const image2 = (input.gallery_image_2_url || '').trim() || null;
      const configuredUrl = getSupabaseConfig().url || null;
      if (
        (image1 && !isVerifiedManifoldStorageImageUrl(image1, configuredUrl)) ||
        (image2 && !isVerifiedManifoldStorageImageUrl(image2, configuredUrl))
      ) {
        return {
          car: null,
          error:
            'Vehicle photos must be uploaded or imported through the MANIFOLD image verifier before saving.',
        };
      }

      const basePayload: Record<string, unknown> = {
        id,
        slug,
        title,
        brand_id: resolvedBrandId,
        make: makeClean || 'Vehicle',
        model: modelClean || 'Model',
        variant: input.trim?.trim() || null,
        trim: input.trim?.trim() || null,
        type_id: resolvedTypeId,
        body_type: (input.body_type || '').trim() || 'SUV',
        year: Number(input.year) || 2024,
        price: numericPrice,
        previous_price: input.previous_price ? Number(input.previous_price) : null,
        original_price: input.previous_price ? Number(input.previous_price) : null,
        currency: 'NGN',
        mileage: numericMileage,
        condition: normalizedCondition,
        fuel_type: input.fuel_type || 'Petrol',
        transmission: input.transmission || 'Automatic',
        drive_type: input.drive_type || 'AWD',
        engine: input.engine?.trim() || null,
        horsepower: input.horsepower ? Number(input.horsepower) : null,
        exterior_color: input.exterior_color?.trim() || 'Black',
        interior_color: input.interior_color?.trim() || 'Black Leather',
        seats: Number(input.seats) || 5,
        doors: Number(input.doors) || 4,
        location: input.location?.trim() || 'Lagos',
        state: input.state?.trim() || 'Lagos',
        description: input.description?.trim() || '',

        // Auto-approved live status; verification & featured flags remain admin-controlled
        status,
        is_verified: false,
        is_featured: false,
        views_count: 0,
        dealer_id: authoritativeDealerId,

        // Optional video & denormalized image URLs on cars table
        youtube_url: rawYoutubeUrl || null,
        youtube_video_id: vidId || null,
        youtube_thumbnail_url: thumb || null,
        gallery_image_1_url: image1,
        gallery_image_2_url: image2,
      };

      const candidatePayload = { ...basePayload };
      let insertedRow: any = null;
      let carError: SupabaseLikeError | null = null;
      let httpStatus: number | undefined = undefined;

      for (let attempt = 0; attempt <= 6; attempt += 1) {
        const res = await supabase
          .from('cars')
          .insert(candidatePayload)
          .select('*')
          .single();

        insertedRow = res.data;
        carError = res.error as SupabaseLikeError | null;
        httpStatus = res.status;

        if (!carError) break;

        const missingCol = extractMissingOptionalColumnFromError(carError, candidatePayload);
        if (missingCol) {
          console.warn(
            `[dealerVehicleService.createDealerCar] Stripping unsupported optional column "${missingCol}" and retrying insert:`,
            carError.message
          );
          delete candidatePayload[missingCol];
          continue;
        }
        break;
      }

      // Idempotent guard: if submissionId UUID already exists for this exact dealer, return existing owned row
      if (carError && carError.code === '23505' && input.submissionId) {
        const existingOwned = await this.getDealerCarById(id, authoritativeDealerId);
        if (existingOwned) {
          return {
            car: existingOwned,
            createdCarId: existingOwned.id,
            error: null,
          };
        }
      }

      if (carError) {
        const { userMessage, errorDetails } = formatDealerSupabaseWriteError(carError, {
          table: 'cars',
          operation: 'insert',
          authUserId: authUser.id,
          dealerId: authoritativeDealerId,
          payloadKeys: Object.keys(candidatePayload),
          httpStatus,
        });
        console.error('[dealerVehicleService.createDealerCar] Insert failed:', errorDetails);
        return {
          car: null,
          error: userMessage,
          errorDetails,
        };
      }

      // Secondary media & gallery image associations (non-fatal if public.cars row was already created)
      const mediaWarnings: string[] = [];

      if (rawYoutubeUrl && vidId) {
        const { error: mediaErr } = await supabase.from('car_media').insert({
          id: generateUuid(),
          car_id: id,
          media_type: 'youtube_video',
          video_type: 'walkaround',
          title: input.youtube_title?.trim() || `${title} Walkaround Review`,
          youtube_url: rawYoutubeUrl,
          youtube_video_id: vidId,
          youtube_thumbnail_url: thumb,
          description: input.youtube_description || input.description || '',
          is_primary: true,
          status: 'published',
          sort_order: 1,
        });
        if (mediaErr) {
          console.error('[dealerVehicleService.createDealerCar] car_media insert failed:', {
            carId: id,
            code: mediaErr.code,
            message: mediaErr.message,
            details: mediaErr.details,
          });
          mediaWarnings.push('Video details could not be attached');
        }
      }

      if (image1) {
        const { error: img1Err } = await supabase.from('car_images').insert({
          id: generateUuid(),
          car_id: id,
          image_url: image1,
          position: 1,
          is_primary: true,
        });
        if (img1Err) {
          console.error('[dealerVehicleService.createDealerCar] car_images #1 insert failed:', {
            carId: id,
            code: img1Err.code,
            message: img1Err.message,
            details: img1Err.details,
          });
          mediaWarnings.push('Primary photo could not be attached');
        }
      }

      if (image2) {
        const { error: img2Err } = await supabase.from('car_images').insert({
          id: generateUuid(),
          car_id: id,
          image_url: image2,
          position: 2,
          is_primary: false,
        });
        if (img2Err) {
          console.error('[dealerVehicleService.createDealerCar] car_images #2 insert failed:', {
            carId: id,
            code: img2Err.code,
            message: img2Err.message,
            details: img2Err.details,
          });
          mediaWarnings.push('Secondary photo could not be attached');
        }
      }

      const fetched = await this.getDealerCarById(id, authoritativeDealerId);
      const confirmedCar = fetched || (insertedRow?.id ? this.mapRowToRecord(insertedRow) : null);

      if (!confirmedCar?.id) {
        const verifyDetails: DealerVehicleWriteErrorDetails = {
          table: 'cars',
          operation: 'verify',
          message: 'Vehicle insert did not return a confirmed database record on verification read.',
          authUserId: authUser.id,
          dealerId: authoritativeDealerId,
        };
        console.error('[dealerVehicleService.createDealerCar] Post-insert confirmation failed:', verifyDetails);
        return {
          car: null,
          error:
            'Unable to confirm your vehicle submission. Please check your vehicle list before retrying.',
          errorDetails: verifyDetails,
        };
      }

      return {
        car: confirmedCar,
        createdCarId: confirmedCar.id,
        error: null,
        partialMediaError: mediaWarnings.length > 0 ? mediaWarnings.join(' | ') : null,
      };
    } catch (err: any) {
      console.error('[dealerVehicleService.createDealerCar] Unexpected exception:', err);
      return {
        car: null,
        error: 'Unexpected error while saving the vehicle. Please try again.',
      };
    }
  }

  /**
   * Updates an existing vehicle record owned by the authenticated dealer
   * Prevents manipulation of protected fields (dealer_id, is_verified, is_featured, published_at)
   */
  public async updateDealerCar(
    carId: string,
    input: DealerCarFormInput,
    dealerId: string,
    isDraft: boolean
  ): Promise<DealerVehicleMutationResult> {
    if (!isSupabaseConfigured) {
      return {
        car: null,
        error: 'Vehicle listing service is currently unavailable. Please try again later.',
      };
    }

    if (!dealerId || !carId) {
      return { car: null, error: 'Invalid car update request.' };
    }

    try {
      const { data: sessionResult } = await supabase.auth.getSession();
      let authUser = sessionResult?.session?.user ?? null;
      if (!authUser) {
        const { data: userResult } = await supabase.auth.getUser();
        authUser = userResult?.user ?? null;
      }

      if (!authUser) {
        return { car: null, error: 'Authentication required. Please sign in again.' };
      }

      const { data: dealerAcc, error: dealerAccErr } = await supabase
        .from('dealer_accounts')
        .select('dealer_id, account_status')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (dealerAccErr || !dealerAcc?.dealer_id) {
        return { car: null, error: 'Registered dealership account required.' };
      }

      const authoritativeDealerId = String(dealerAcc.dealer_id);
      if (authoritativeDealerId !== String(dealerId)) {
        return { car: null, error: 'Dealership authorization mismatch.' };
      }

      // First verify ownership
      const existing = await this.getDealerCarById(carId, authoritativeDealerId);
      if (!existing) {
        return { car: null, error: 'Vehicle not found or you do not have permission to modify it.' };
      }

      // Prevent unapproved/disapproved dealers from submitting a vehicle for review
      if (!isDraft) {
        let dealerVerified: boolean | null = null;
        let dealerStatusCol: unknown = undefined;
        const { data: dealerRow } = await supabase
          .from('dealers')
          .select('*')
          .eq('id', authoritativeDealerId)
          .maybeSingle();

        if (dealerRow) {
          if (typeof (dealerRow as any).is_verified === 'boolean') {
            dealerVerified = (dealerRow as any).is_verified;
          } else if (typeof (dealerRow as any).verified_partner === 'boolean') {
            dealerVerified = (dealerRow as any).verified_partner;
          }
          if ((dealerRow as any).dealer_status !== undefined && (dealerRow as any).dealer_status !== null) {
            dealerStatusCol = (dealerRow as any).dealer_status;
          }
        }

        const blockReason = getDealerListingBlockReason(
          dealerAcc.account_status ?? 'pending',
          dealerVerified,
          dealerStatusCol
        );
        if (blockReason) {
          return { car: null, error: blockReason };
        }
      }

      const makeClean = (input.make || '').trim();
      const modelClean = (input.model || '').trim();
      const title = buildVehicleModelTitle(makeClean || 'Vehicle', modelClean || 'Model');
      const rawYoutubeUrl = (input.youtube_url || '').trim();
      const vidId = rawYoutubeUrl ? extractYouTubeVideoId(rawYoutubeUrl) || '' : '';
      if (rawYoutubeUrl && !vidId) {
        return {
          car: null,
          error: 'The YouTube URL provided is invalid. Clear the field (video is optional) or paste a valid YouTube link.',
        };
      }
      const thumb = vidId ? getYouTubeThumbnailUrl(vidId) : '';

      // Publishing sets status directly to 'PUBLISHED'; already-published cars remain 'PUBLISHED' when saving edits
      let nextStatus: DealerCarRecord['status'] = isDraft ? 'DRAFT' : 'PUBLISHED';
      if (existing.status === 'PUBLISHED' && isDraft) {
        nextStatus = 'PUBLISHED';
      }

      const [resolvedBrandId, resolvedTypeId] = await Promise.all([
        this.resolveBrandUuid(input.brand_id, makeClean),
        categoryService.resolveTypeId(input.type_id, input.body_type),
      ]);

      const image1 = input.gallery_image_1_url !== undefined ? (input.gallery_image_1_url || '').trim() || null : undefined;
      const image2 = input.gallery_image_2_url !== undefined ? (input.gallery_image_2_url || '').trim() || null : undefined;
      const configuredUrl = getSupabaseConfig().url || null;
      if (
        (image1 && !isVerifiedManifoldStorageImageUrl(image1, configuredUrl)) ||
        (image2 && !isVerifiedManifoldStorageImageUrl(image2, configuredUrl))
      ) {
        return {
          car: null,
          error:
            'Vehicle photos must be uploaded or imported through the MANIFOLD image verifier before saving.',
        };
      }

      const baseUpdates: Record<string, unknown> = {
        title,
        brand_id: resolvedBrandId,
        make: makeClean || 'Vehicle',
        model: modelClean || 'Model',
        variant: input.trim?.trim() || null,
        trim: input.trim?.trim() || null,
        type_id: resolvedTypeId,
        body_type: input.body_type || 'SUV',
        year: Number(input.year) || 2024,
        price: Number(input.price) || 0,
        previous_price: input.previous_price ? Number(input.previous_price) : null,
        original_price: input.previous_price ? Number(input.previous_price) : null,
        mileage: Math.max(0, Number(input.mileage) || 0),
        condition: normalizeVehicleCondition(input.condition),
        fuel_type: input.fuel_type || 'Petrol',
        transmission: input.transmission || 'Automatic',
        drive_type: input.drive_type || 'AWD',
        engine: input.engine?.trim() || null,
        horsepower: input.horsepower ? Number(input.horsepower) : null,
        exterior_color: input.exterior_color?.trim() || 'Black',
        interior_color: input.interior_color?.trim() || 'Black Leather',
        seats: Number(input.seats) || 5,
        doors: Number(input.doors) || 4,
        location: input.location?.trim() || 'Lagos',
        state: input.state?.trim() || 'Lagos',
        description: input.description?.trim() || '',

        status: nextStatus,
        updated_at: new Date().toISOString(),

        youtube_url: rawYoutubeUrl || null,
        youtube_video_id: vidId || null,
        youtube_thumbnail_url: thumb || null,
        ...(image1 !== undefined ? { gallery_image_1_url: image1 } : {}),
        ...(image2 !== undefined ? { gallery_image_2_url: image2 } : {}),
      };

      const candidateUpdates = { ...baseUpdates };
      let updatedRow: any = null;
      let carError: SupabaseLikeError | null = null;
      let httpStatus: number | undefined = undefined;

      for (let attempt = 0; attempt <= 6; attempt += 1) {
        const res = await supabase
          .from('cars')
          .update(candidateUpdates)
          .eq('id', carId)
          .eq('dealer_id', authoritativeDealerId)
          .select('*')
          .single();

        updatedRow = res.data;
        carError = res.error as SupabaseLikeError | null;
        httpStatus = res.status;

        if (!carError) break;

        const missingCol = extractMissingOptionalColumnFromError(carError, candidateUpdates);
        if (missingCol) {
          console.warn(
            `[dealerVehicleService.updateDealerCar] Stripping unsupported optional column "${missingCol}" and retrying update:`,
            carError.message
          );
          delete candidateUpdates[missingCol];
          continue;
        }
        break;
      }

      if (carError) {
        const { userMessage, errorDetails } = formatDealerSupabaseWriteError(carError, {
          table: 'cars',
          operation: 'update',
          authUserId: authUser.id,
          dealerId: authoritativeDealerId,
          payloadKeys: Object.keys(candidateUpdates),
          httpStatus,
        });
        console.error('[dealerVehicleService.updateDealerCar] Update failed:', errorDetails);
        return {
          car: null,
          error: userMessage,
          errorDetails,
        };
      }

      const mediaWarnings: string[] = [];

      // Update car_media cleanly (replace when provided, or remove stale youtube_video if cleared)
      const { error: delMediaErr } = await supabase
        .from('car_media')
        .delete()
        .eq('car_id', carId)
        .eq('media_type', 'youtube_video');

      if (delMediaErr) {
        console.warn('[dealerVehicleService.updateDealerCar] car_media delete note:', delMediaErr);
      }

      if (rawYoutubeUrl && vidId) {
        const { error: insMediaErr } = await supabase.from('car_media').insert({
          id: generateUuid(),
          car_id: carId,
          media_type: 'youtube_video',
          video_type: 'walkaround',
          title: input.youtube_title?.trim() || `${title} Walkaround Review`,
          youtube_url: rawYoutubeUrl,
          youtube_video_id: vidId,
          youtube_thumbnail_url: thumb,
          description: input.youtube_description || input.description || '',
          is_primary: true,
          status: 'published',
          sort_order: 1,
        });
        if (insMediaErr) {
          console.error('[dealerVehicleService.updateDealerCar] car_media insert failed:', insMediaErr);
          mediaWarnings.push('Video details could not be attached');
        }
      }

      // Update car_images (Position 1 & 2)
      if (image1 !== undefined) {
        await supabase.from('car_images').delete().eq('car_id', carId).eq('position', 1);
        if (image1) {
          const { error: img1Err } = await supabase.from('car_images').insert({
            id: generateUuid(),
            car_id: carId,
            image_url: image1,
            position: 1,
            is_primary: true,
          });
          if (img1Err) {
            console.error('[dealerVehicleService.updateDealerCar] car_images #1 insert failed:', img1Err);
            mediaWarnings.push('Primary photo could not be attached');
          }
        }
      }

      if (image2 !== undefined) {
        await supabase.from('car_images').delete().eq('car_id', carId).eq('position', 2);
        if (image2) {
          const { error: img2Err } = await supabase.from('car_images').insert({
            id: generateUuid(),
            car_id: carId,
            image_url: image2,
            position: 2,
            is_primary: false,
          });
          if (img2Err) {
            console.error('[dealerVehicleService.updateDealerCar] car_images #2 insert failed:', img2Err);
            mediaWarnings.push('Secondary photo could not be attached');
          }
        }
      }

      const refreshed = await this.getDealerCarById(carId, authoritativeDealerId);
      const confirmedCar = refreshed || (updatedRow?.id ? this.mapRowToRecord(updatedRow) : null);

      if (!confirmedCar?.id) {
        return {
          car: null,
          error: 'Unable to confirm your vehicle update. Please refresh your vehicle list and check.',
        };
      }

      return {
        car: confirmedCar,
        createdCarId: confirmedCar.id,
        error: null,
        partialMediaError: mediaWarnings.length > 0 ? mediaWarnings.join(' | ') : null,
      };
    } catch (err: any) {
      console.error('[dealerVehicleService.updateDealerCar] Unexpected exception:', err);
      return {
        car: null,
        error: 'Unexpected error while updating the vehicle. Please try again.',
      };
    }
  }

  private mapRowToRecord(row: any): DealerCarRecord {
    let vidUrl = row.youtube_url;
    let vidId = row.youtube_video_id;
    let thumb = row.youtube_thumbnail_url;

    if (Array.isArray(row.car_media) && row.car_media.length > 0) {
      const primaryMedia = row.car_media.find((m: any) => m.is_primary) || row.car_media[0];
      if (primaryMedia) {
        vidUrl = primaryMedia.youtube_url || vidUrl;
        vidId = primaryMedia.youtube_video_id || vidId;
        thumb = primaryMedia.youtube_thumbnail_url || thumb;
      }
    }

    let img1 = row.gallery_image_1_url;
    let img2 = row.gallery_image_2_url;
    if (Array.isArray(row.car_images) && row.car_images.length > 0) {
      const found1 = row.car_images.find((i: any) => i.position === 1);
      const found2 = row.car_images.find((i: any) => i.position === 2);
      if (found1?.image_url) img1 = found1.image_url;
      if (found2?.image_url) img2 = found2.image_url;
    }

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      year: Number(row.year) || 2024,
      brand_id: row.brand_id ?? null,
      make: row.make,
      model: row.model,
      trim: row.trim || row.variant || undefined,
      type_id: row.type_id ?? null,
      body_type: row.body_type || 'SUV',
      condition: row.condition || 'Foreign Used',
      price: Number(row.price) || 0,
      previous_price: row.previous_price ? Number(row.previous_price) : null,
      currency: row.currency || 'NGN',
      mileage: Number(row.mileage) || 0,
      transmission: row.transmission || 'Automatic',
      fuel_type: row.fuel_type || 'Petrol',
      drive_type: row.drive_type || 'AWD',
      engine: row.engine || undefined,
      horsepower: row.horsepower ? Number(row.horsepower) : null,
      exterior_color: row.exterior_color || 'Black',
      interior_color: row.interior_color || 'Black',
      seats: Number(row.seats) || 5,
      doors: Number(row.doors) || 4,
      location: row.location || 'Lagos',
      state: row.state || 'Lagos',
      description: row.description || '',
      status: row.status || 'DRAFT',
      is_verified: Boolean(row.is_verified),
      is_featured: Boolean(row.is_featured),
      dealer_id: row.dealer_id,
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || new Date().toISOString(),
      youtube_url: vidUrl,
      youtube_video_id: vidId,
      youtube_thumbnail_url: thumb,
      gallery_image_1_url: img1,
      gallery_image_2_url: img2,
    };
  }
}

export const dealerVehicleService = new DealerVehicleService();
