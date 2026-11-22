export interface DealerSlugCandidate {
  id: string;
  name?: string;
  businessName?: string;
  slug?: string | null;
  permalinkSlug?: string;
}

function getCandidateName(dealer: Partial<DealerSlugCandidate> | null | undefined): string {
  return String(dealer?.name || dealer?.businessName || '').trim();
}

/**
 * Converts a dealership business name into a clean single-segment URL slug.
 * Example: "Apex Luxury Motors" -> "apex-luxury-motors"
 */
export function slugifyBusinessName(name: string): string {
  const cleaned = (name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return cleaned || 'dealership';
}

/**
 * Assigns every dealership a clean, deterministic, collision-free `/<business-name>` permalink slug.
 * Primary owners of a name receive `/business-name`; exact name collisions receive a short
 * deterministic suffix so every dealer link remains unique.
 */
export function assignDealerPermalinkSlugs<T extends DealerSlugCandidate>(
  dealers: T[]
): Array<T & { permalinkSlug: string }> {
  const sortedByStableKey = [...dealers].sort((a, b) =>
    String(a.id).localeCompare(String(b.id))
  );

  const usedSlugs = new Set<string>();
  const slugById = new Map<string, string>();

  for (const dealer of sortedByStableKey) {
    const base = slugifyBusinessName(getCandidateName(dealer));
    let candidate = base;
    if (usedSlugs.has(candidate)) {
      const idSuffix = String(dealer.id || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 4);
      candidate = idSuffix ? `${base}-${idSuffix}` : `${base}-${usedSlugs.size + 1}`;
      let counter = 2;
      while (usedSlugs.has(candidate)) {
        candidate = `${base}-${counter}`;
        counter += 1;
      }
    }
    usedSlugs.add(candidate);
    slugById.set(String(dealer.id), candidate);
  }

  return dealers.map((dealer) => ({
    ...dealer,
    permalinkSlug: slugById.get(String(dealer.id)) || slugifyBusinessName(getCandidateName(dealer)),
  }));
}

export function getDealerPermalinkSlug(
  dealer: DealerSlugCandidate,
  allDealers?: DealerSlugCandidate[]
): string {
  if (allDealers && allDealers.length > 0) {
    const assigned = assignDealerPermalinkSlugs(allDealers);
    const match = assigned.find((d) => String(d.id) === String(dealer.id));
    if (match) return match.permalinkSlug;
  }
  return dealer.permalinkSlug || slugifyBusinessName(getCandidateName(dealer));
}

/**
 * Resolves a URL slug (e.g. "apex-luxury-motors", legacy "apex-luxury-motors-a1b2c3",
 * or decoded business name) to the matching dealership record.
 */
export function resolveDealerByPermalinkSlug<T extends DealerSlugCandidate>(
  requestedSlug: string,
  dealers: T[]
): (T & { permalinkSlug: string }) | null {
  let raw = (requestedSlug || '').trim().toLowerCase();
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // keep raw if malformed URI encoding
  }
  if (!raw || dealers.length === 0) return null;

  const normalized = slugifyBusinessName(raw);
  const withPermalinks = assignDealerPermalinkSlugs(dealers);

  // 1. Exact canonical permalink match
  const exactPermalink = withPermalinks.find(
    (d) => d.permalinkSlug.toLowerCase() === raw || d.permalinkSlug.toLowerCase() === normalized
  );
  if (exactPermalink) return exactPermalink;

  // 2. Stored DB slug match (supports legacy slugs with random suffixes)
  const storedSlugMatch = withPermalinks.find(
    (d) => d.slug && (d.slug.toLowerCase() === raw || d.slug.toLowerCase() === normalized)
  );
  if (storedSlugMatch) return storedSlugMatch;

  // 3. Slugified business name match
  const nameSlugMatch = withPermalinks.find((d) => {
    const candidateName = getCandidateName(d);
    return (
      slugifyBusinessName(candidateName) === normalized || candidateName.toLowerCase() === raw
    );
  });
  if (nameSlugMatch) return nameSlugMatch;

  return null;
}
