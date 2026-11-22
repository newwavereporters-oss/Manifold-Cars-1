export type RouteScope = 'public' | 'dealer' | 'admin';

export interface ParsedRouteResult {
  normalizedRoute: string;
  pathname: string;
  queryString: string;
  scope: RouteScope;
  isKnownRoute: boolean;
  slug: string | null;
  dealerSlug: string | null;
  editingCarId: string | null;
  dealerEditingCarId: string | null;
}

const KNOWN_PUBLIC_EXACT = new Set([
  '/',
  '/car-marketplace',
  '/marketplace',
  '/cars',
  '/dealers',
  '/car-hunt',
  '/reviews',
  '/sell-a-car',
  '/services',
  '/about',
]);

const RESERVED_ROOT_SEGMENTS = new Set([
  'api',
  'assets',
  'admin',
  'dealer',
  'dealers',
  'cars',
  'car-marketplace',
  'marketplace',
  'car-hunt',
  'reviews',
  'sell-a-car',
  'services',
  'about',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
]);

const KNOWN_ADMIN_PREFIXES = [
  '/admin/cars',
  '/admin/enquiries',
  '/admin/inspections',
  '/admin/media',
  '/admin/brands',
  '/admin/models',
  '/admin/types',
  '/admin/dealers',
  '/admin/dealer-management',
  '/admin/sales',
  '/admin/commissions',
  '/admin/commission-rules',
  '/admin/market-intelligence',
  '/admin/intelligence',
  '/admin/ai-control',
  '/admin/ai',
  '/admin/players',
  '/admin/game-players',
  '/admin/moderation',
  '/admin/billboards',
  '/admin/missions',
  '/admin/settings',
  '/admin/dashboard',
  '/admin/login',
];

const KNOWN_DEALER_EXACT = new Set([
  '/dealer',
  '/dealer/dashboard',
  '/dealer/sign-in',
  '/dealer/register',
  '/dealer/offer',
  '/dealer/business-information',
  '/dealer/enquiries',
  '/dealer/business-profile',
  '/dealer/profile',
  '/dealer/onboarding-success',
  '/dealer/cars',
  '/dealer/cars/new',
]);

/**
 * Strips duplicate slashes and trailing slashes (except root '/') from a pathname.
 */
export function normalizePathname(rawPathname: string): string {
  const pathOnly = (rawPathname || '/').split('?')[0].split('#')[0] || '/';
  const collapsed = pathOnly.replace(/\/{2,}/g, '/');
  if (collapsed.length > 1 && collapsed.endsWith('/')) {
    return collapsed.slice(0, -1);
  }
  return collapsed || '/';
}

/**
 * Normalizes window location (including legacy `#/...` hash URLs and trailing slashes)
 * into clean History API path + query URLs.
 */
export function normalizeBrowserLocation(
  pathname: string,
  search: string,
  hash: string
): { cleanUrl: string; changed: boolean } {
  const trimmedHash = (hash || '').trim();

  // Convert legacy /#/route?foo=bar -> /route?foo=bar
  if (trimmedHash.startsWith('#/')) {
    const hashBody = trimmedHash.slice(1); // starts with '/'
    const [hashPathRaw, hashQuery] = hashBody.split('?');
    const cleanPath = normalizePathname(hashPathRaw);
    const mergedSearch = hashQuery
      ? `?${hashQuery}`
      : search && search.startsWith('?')
      ? search
      : '';
    const cleanUrl = `${cleanPath}${mergedSearch}`;
    const currentFull = `${pathname || '/'}${search || ''}${hash || ''}`;
    return { cleanUrl, changed: cleanUrl !== currentFull };
  }

  const cleanPath = normalizePathname(pathname || '/');
  const cleanSearch = search || '';
  const cleanUrl = `${cleanPath}${cleanSearch}`;
  const current = `${pathname || '/'}${cleanSearch}`;
  return {
    cleanUrl,
    changed: cleanUrl !== current,
  };
}

/**
 * Resolves any clean URL (with optional query string) into MANIFOLD's route model
 * with explicit 404 detection for unmatched routes in public, dealer, and admin scopes.
 */
export function parseManifoldRoute(rawInput: string): ParsedRouteResult {
  const safeRaw = (rawInput || '/').trim() || '/';
  const qIndex = safeRaw.indexOf('?');
  const rawPath = qIndex >= 0 ? safeRaw.slice(0, qIndex) : safeRaw;
  const queryString = qIndex >= 0 ? safeRaw.slice(qIndex) : '';
  const pathname = normalizePathname(rawPath);

  // 1. Admin routes
  if (pathname === '/admin') {
    return {
      normalizedRoute: '/admin',
      pathname,
      queryString,
      scope: 'admin',
      isKnownRoute: true,
      slug: null,
      dealerSlug: null,
      editingCarId: null,
      dealerEditingCarId: null,
    };
  }

  if (pathname.startsWith('/admin/')) {
    if (pathname.startsWith('/admin/cars/') && pathname.endsWith('/edit')) {
      const id = pathname.slice('/admin/cars/'.length, -'/edit'.length).trim();
      if (id && !id.includes('/')) {
        return {
          normalizedRoute: '/admin/cars/:id/edit',
          pathname,
          queryString,
          scope: 'admin',
          isKnownRoute: true,
          slug: null,
          dealerSlug: null,
          editingCarId: id,
          dealerEditingCarId: null,
        };
      }
    }

    const matchesKnownAdmin = KNOWN_ADMIN_PREFIXES.some(
      (prefix) => pathname === prefix || (prefix === '/admin/cars' && pathname === '/admin/cars/new')
    );

    return {
      normalizedRoute: pathname,
      pathname,
      queryString,
      scope: 'admin',
      isKnownRoute: matchesKnownAdmin,
      slug: null,
      dealerSlug: null,
      editingCarId: null,
      dealerEditingCarId: null,
    };
  }

  // 2. Dealer routes
  if (pathname === '/dealer' || pathname.startsWith('/dealer/')) {
    if (pathname.startsWith('/dealer/cars/') && pathname.endsWith('/edit')) {
      const id = pathname.slice('/dealer/cars/'.length, -'/edit'.length).trim();
      if (id && !id.includes('/')) {
        return {
          normalizedRoute: '/dealer/cars/:id/edit',
          pathname,
          queryString,
          scope: 'dealer',
          isKnownRoute: true,
          slug: null,
          dealerSlug: null,
          editingCarId: null,
          dealerEditingCarId: id,
        };
      }
    }

    const isKnownDealer = KNOWN_DEALER_EXACT.has(pathname);
    const normalizedDealerRoute = pathname === '/dealer' ? '/dealer/dashboard' : pathname;

    return {
      normalizedRoute: normalizedDealerRoute,
      pathname,
      queryString,
      scope: 'dealer',
      isKnownRoute: isKnownDealer,
      slug: null,
      dealerSlug: null,
      editingCarId: null,
      dealerEditingCarId: null,
    };
  }

  // 3. Public Vehicle Detail Route (/cars/:slug)
  if (pathname.startsWith('/cars/')) {
    const slug = pathname.slice('/cars/'.length).trim();
    if (slug && !slug.includes('/')) {
      return {
        normalizedRoute: '/cars/:slug',
        pathname,
        queryString,
        scope: 'public',
        isKnownRoute: true,
        slug: decodeURIComponent(slug),
        dealerSlug: null,
        editingCarId: null,
        dealerEditingCarId: null,
      };
    }
    return {
      normalizedRoute: pathname,
      pathname,
      queryString,
      scope: 'public',
      isKnownRoute: false,
      slug: null,
      dealerSlug: null,
      editingCarId: null,
      dealerEditingCarId: null,
    };
  }

  // 4. Canonical Public Routes
  if (KNOWN_PUBLIC_EXACT.has(pathname)) {
    const canonical = pathname === '/marketplace' ? '/car-marketplace' : pathname;
    return {
      normalizedRoute: canonical,
      pathname,
      queryString,
      scope: 'public',
      isKnownRoute: true,
      slug: null,
      dealerSlug: null,
      editingCarId: null,
      dealerEditingCarId: null,
    };
  }

  // 5. Public Dealer Showroom Permalink Route (/:dealerSlug)
  const singleSegment = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  if (
    singleSegment &&
    !singleSegment.includes('/') &&
    !singleSegment.includes('.') &&
    !RESERVED_ROOT_SEGMENTS.has(singleSegment.toLowerCase())
  ) {
    return {
      normalizedRoute: '/:dealerSlug',
      pathname,
      queryString,
      scope: 'public',
      isKnownRoute: true,
      slug: null,
      dealerSlug: decodeURIComponent(singleSegment),
      editingCarId: null,
      dealerEditingCarId: null,
    };
  }

  // 6. Unmatched 404 route
  return {
    normalizedRoute: pathname,
    pathname,
    queryString,
    scope: 'public',
    isKnownRoute: false,
    slug: null,
    dealerSlug: null,
    editingCarId: null,
    dealerEditingCarId: null,
  };
}
