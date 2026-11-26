import { Router } from 'express';
import type { Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerEnv } from '../config/env.js';
import { getSupabaseClient } from '../lib/supabaseServer.js';
import { standardApiLimiter } from '../middleware/rateLimit.js';
import { extractSupabaseHost } from './world.js';
import { isApprovedVehicleImageUrl } from '../../src/utils/vehicleImageUrl.js';

const router = Router();

const PUBLIC_DEALER_SELECT_CANDIDATES = [
  'id, business_name, slug, city, state, is_verified, dealer_status, joined_year',
  'id, name, business_name, slug, city, state, is_verified, dealer_status, joined_year',
  'id, business_name, slug, city, state, is_verified, joined_year',
  'id, name, slug, city, state, is_verified, joined_year',
];
let resolvedServerCarDealerSelect: string | null = null;

export function sanitizePublicDealerPayload(raw: any): Record<string, any> | null {
  if (!raw || typeof raw !== 'object') return null;
  const {
    phone: _p,
    email: _e,
    address: _a,
    address_line_1: _a1,
    address_line_2: _a2,
    cac_registration_number: _cac,
    ...safeRest
  } = raw;
  return safeRest;
}

export function isPublicCarStatus(status: unknown): boolean {
  const upper = String(status || '').trim().toUpperCase();
  return upper === 'PUBLISHED';
}

function formatPgError(error: any): {
  error: string;
  code?: string;
  details?: string;
  hint?: string;
} {
  return {
    error: String(error?.message || 'Supabase query failed'),
    ...(error?.code ? { code: String(error.code) } : {}),
    ...(error?.details ? { details: String(error.details) } : {}),
    ...(error?.hint ? { hint: String(error.hint) } : {}),
  };
}

export async function fetchPublicCarsFromSupabase(client: SupabaseClient): Promise<{
  ok: true;
  cars: any[];
} | {
  ok: false;
  status: number;
  payload: { error: string; code?: string; details?: string; hint?: string };
}> {
  // 1. Primary relational select with strictly safe non-PII dealer projection
  const candidates = resolvedServerCarDealerSelect
    ? [
        resolvedServerCarDealerSelect,
        ...PUBLIC_DEALER_SELECT_CANDIDATES.filter((c) => c !== resolvedServerCarDealerSelect),
      ]
    : PUBLIC_DEALER_SELECT_CANDIDATES;

  let primary: any = { data: null, error: null };
  for (const cols of candidates) {
    primary = await client
      .from('cars')
      .select(
        `
      *,
      car_media (*),
      car_images (*),
      dealers (${cols})
    `
      )
      .order('created_at', { ascending: false });
    if (!primary.error) {
      resolvedServerCarDealerSelect = cols;
      break;
    }
    if (primary.error?.code !== '42703') break;
  }

  let resolvedRows: any[] | null = null;
  if (!primary.error && Array.isArray(primary.data)) {
    resolvedRows = primary.data;
  } else {
    // 2. Decoupled fallback when relational FKs or joined tables fail (e.g. PGRST200)
    let fallbackCars = await client
      .from('cars')
      .select('*')
      .order('created_at', { ascending: false });

    if (fallbackCars.error && fallbackCars.error.code === '42703') {
      fallbackCars = await client.from('cars').select('*');
    }

    if (fallbackCars.error) {
      return {
        ok: false,
        status: 502,
        payload: formatPgError(fallbackCars.error),
      };
    }

    const baseRows = Array.isArray(fallbackCars.data) ? fallbackCars.data : [];
    const publicBase = baseRows.filter((r) => isPublicCarStatus(r?.status));
    const carIds = Array.from(new Set(publicBase.map((r) => String(r.id || '')).filter(Boolean)));
    const dealerIds = Array.from(
      new Set(publicBase.map((r) => String(r.dealer_id || '')).filter(Boolean))
    );

    const fetchSafeDealers = async () => {
      if (dealerIds.length === 0) return { data: [] };
      const dealerCandidates = resolvedServerCarDealerSelect
        ? [
            resolvedServerCarDealerSelect,
            ...PUBLIC_DEALER_SELECT_CANDIDATES.filter((c) => c !== resolvedServerCarDealerSelect),
          ]
        : PUBLIC_DEALER_SELECT_CANDIDATES;
      let res: any = { data: [] };
      for (const cols of dealerCandidates) {
        res = await client.from('dealers').select(cols).in('id', dealerIds);
        if (!res.error) {
          resolvedServerCarDealerSelect = cols;
          break;
        }
        if (res.error?.code !== '42703') break;
      }
      return res;
    };

    const [mediaSettled, imagesSettled, dealersSettled] = await Promise.allSettled([
      carIds.length > 0
        ? client.from('car_media').select('*').in('car_id', carIds)
        : Promise.resolve({ data: [] }),
      carIds.length > 0
        ? client.from('car_images').select('*').in('car_id', carIds)
        : Promise.resolve({ data: [] }),
      fetchSafeDealers(),
    ]);

    const mediaRows =
      mediaSettled.status === 'fulfilled' && Array.isArray((mediaSettled.value as any)?.data)
        ? (mediaSettled.value as any).data
        : [];
    const imageRows =
      imagesSettled.status === 'fulfilled' && Array.isArray((imagesSettled.value as any)?.data)
        ? (imagesSettled.value as any).data
        : [];
    const dealerRows =
      dealersSettled.status === 'fulfilled' && Array.isArray((dealersSettled.value as any)?.data)
        ? (dealersSettled.value as any).data
        : [];

    const mediaByCar = new Map<string, any[]>();
    mediaRows.forEach((m: any) => {
      const k = String(m.car_id || '');
      if (!k) return;
      const arr = mediaByCar.get(k) || [];
      arr.push(m);
      mediaByCar.set(k, arr);
    });

    const imagesByCar = new Map<string, any[]>();
    imageRows.forEach((img: any) => {
      const k = String(img.car_id || '');
      if (!k) return;
      const arr = imagesByCar.get(k) || [];
      arr.push(img);
      imagesByCar.set(k, arr);
    });

    const dealerById = new Map<string, Record<string, any>>();
    dealerRows.forEach((d: any) => {
      const safe = sanitizePublicDealerPayload(d);
      if (safe?.id) {
        dealerById.set(String(safe.id), safe);
      }
    });

    resolvedRows = publicBase.map((row) => ({
      ...row,
      car_media: mediaByCar.get(String(row.id)) || [],
      car_images: imagesByCar.get(String(row.id)) || [],
      dealers: row.dealer_id ? dealerById.get(String(row.dealer_id)) || null : null,
    }));
  }

  const configuredSupabaseUrl = getServerEnv().supabaseUrl || null;
  const sanitized = (resolvedRows || [])
    .filter((row) => isPublicCarStatus(row?.status))
    .map((row) => {
      const safeImg1 = isApprovedVehicleImageUrl(row?.gallery_image_1_url, configuredSupabaseUrl)
        ? row.gallery_image_1_url
        : null;
      const safeImg2 = isApprovedVehicleImageUrl(row?.gallery_image_2_url, configuredSupabaseUrl)
        ? row.gallery_image_2_url
        : null;
      const safeCarImages = Array.isArray(row?.car_images)
        ? row.car_images.filter((img: any) =>
            isApprovedVehicleImageUrl(img?.image_url, configuredSupabaseUrl)
          )
        : [];
      return {
        ...row,
        gallery_image_1_url: safeImg1,
        gallery_image_2_url: safeImg2,
        car_images: safeCarImages,
        dealers: sanitizePublicDealerPayload(row?.dealers),
      };
    });

  return { ok: true, cars: sanitized };
}

router.get('/', standardApiLimiter, async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');

  const env = getServerEnv();
  const client = getSupabaseClient();
  const supabaseHost = extractSupabaseHost(env.supabaseUrl);

  if (!client) {
    return res.status(503).json({
      error: 'Supabase is not configured on the API server.',
      code: 'SUPABASE_NOT_CONFIGURED',
      supabaseHost,
    });
  }

  const result = await fetchPublicCarsFromSupabase(client);
  if (!result.ok) {
    return res.status(result.status).json({
      ...result.payload,
      supabaseHost,
    });
  }

  return res.json({
    cars: result.cars,
    supabaseHost,
  });
});

router.get('/:slugOrId', standardApiLimiter, async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');

  const env = getServerEnv();
  const client = getSupabaseClient();
  const supabaseHost = extractSupabaseHost(env.supabaseUrl);
  const slugOrId = String(req.params.slugOrId || '').trim();

  if (!slugOrId) {
    return res.status(400).json({ error: 'Vehicle slug or ID is required.' });
  }

  if (!client) {
    return res.status(503).json({
      error: 'Supabase is not configured on the API server.',
      code: 'SUPABASE_NOT_CONFIGURED',
      supabaseHost,
    });
  }

  const result = await fetchPublicCarsFromSupabase(client);
  if (!result.ok) {
    return res.status(result.status).json({
      ...result.payload,
      supabaseHost,
    });
  }

  const match = result.cars.find(
    (c) => String(c.slug || '') === slugOrId || String(c.id || '') === slugOrId
  );

  if (!match) {
    return res.status(404).json({ error: 'Vehicle not found.', supabaseHost });
  }

  return res.json({ car: match, supabaseHost });
});

export const carsRouter = router;
