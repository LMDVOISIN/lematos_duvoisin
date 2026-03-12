import { supabase } from '../lib/supabase';
import { PLATFORM_COMMISSION_RATE } from '../utils/pricingPolicy';

const ANALYTICS_TABLE = 'platform_analytics_events';
const LISTINGS_TABLE = 'annonces';
const RESERVATIONS_TABLE = 'reservations';
const PAGE_SIZE = 1000;
const LIVE_LISTING_STATUSES = new Set(['publiee', 'published']);
const LIVE_MODERATION_STATUSES = new Set(['approved', 'validated', 'accepted']);
const PAID_RESERVATION_STATUSES = new Set(['paid', 'active', 'ongoing', 'completed']);
const DAYS_PER_YEAR = 365;

const toIso = (date) => {
  try {
    return new Date(date)?.toISOString();
  } catch (_) {
    return new Date().toISOString();
  }
};

const countBy = (rows = [], keyGetter) => {
  const map = new Map();
  (rows || []).forEach((row) => {
    const key = keyGetter(row);
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
};

const topEntries = (map, limit = 5) =>
  [...(map?.entries?.() || [])]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));

const sameHost = (host) => {
  if (typeof window === 'undefined') return false;
  const currentHost = String(window.location?.hostname || '').toLowerCase();
  return String(host || '').toLowerCase() === currentHost;
};

const normalizePagePath = (value) => {
  const raw = String(value || '').trim();
  return raw || '/';
};

const normalizeReferrerLabel = (host) => {
  const raw = String(host || '').trim();
  if (!raw) return 'Direct';
  if (sameHost(raw)) return 'Interne';
  return raw;
};

const toSafeNumber = (value) => {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
};

const lower = (value) => String(value || '').trim().toLowerCase();

const extractMissingColumnName = (error) => {
  const message = String(error?.message || '');
  const details = String(error?.details || '');
  const source = `${message} ${details}`;
  const patterns = [
    /Could not find the '([^']+)' column/i,
    /column "([^"]+)" does not exist/i,
    /column ([a-zA-Z0-9_.]+) does not exist/i
  ];

  for (const pattern of patterns) {
    const match = source?.match(pattern);
    if (match?.[1]) {
      const normalized = String(match[1])?.trim()?.replace(/^"+|"+$/g, '');
      const parts = normalized?.split('.') || [];
      return parts?.[parts?.length - 1] || normalized;
    }
  }

  return null;
};

const removeColumnFromSelect = (selectClause, columnName) => {
  if (!selectClause || !columnName) return selectClause;
  const normalizedTarget = String(columnName)?.trim()?.toLowerCase();

  return String(selectClause)
    ?.split(',')
    ?.map((part) => String(part || '').trim())
    ?.filter((part) => part && part?.toLowerCase() !== normalizedTarget)
    ?.join(', ');
};

const hasSelectColumn = (selectClause, columnName) =>
  String(selectClause || '')
    ?.split(',')
    ?.map((part) => String(part || '').trim().toLowerCase())
    ?.includes(String(columnName || '').trim().toLowerCase());

const safeCount = async (queryPromise) => {
  const res = await queryPromise;
  return { count: Number(res?.count || 0), error: res?.error || null };
};

const loadRows = async (fromIso, limit = 5000) =>
  supabase
    ?.from(ANALYTICS_TABLE)
    ?.select('event_name, page_path, page_type, session_id, visitor_id, referrer_host, created_at')
    ?.gte('created_at', fromIso)
    ?.order('created_at', { ascending: false })
    ?.limit(limit);

const loadRowsPaginated = async (buildPageQuery, { maxPages = 50 } = {}) => {
  const rows = [];

  for (let page = 0; page < Math.max(1, maxPages); page += 1) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await buildPageQuery(from, to);

    if (error) return { data: null, error };

    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);

    if (batch?.length < PAGE_SIZE) {
      return { data: rows, error: null };
    }
  }

  return { data: rows, error: null };
};

const isLiveListing = (listing) => {
  const listingStatus = lower(listing?.statut);
  const moderationStatus = lower(listing?.moderation_status);
  return Boolean(listing?.published)
    || LIVE_LISTING_STATUSES?.has(listingStatus)
    || LIVE_MODERATION_STATUSES?.has(moderationStatus);
};

const getPaidAtDate = (reservation) => {
  const paidAt = reservation?.paid_at || reservation?.tenant_payment_paid_at;
  if (!paidAt) return null;

  const date = new Date(paidAt);
  if (Number.isNaN(date?.getTime())) return null;
  return date;
};

const isReservationPaidFallback = (reservation) => {
  const status = lower(reservation?.status);
  return PAID_RESERVATION_STATUSES?.has(status);
};

const getStartOfYear = () => {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
};

const platformAnalyticsService = {
  getAdminFrequentationSnapshot: async ({ days = 7, maxRows = 5000 } = {}) => {
    try {
      const now = new Date();
      const start7d = new Date(now);
      start7d.setDate(start7d.getDate() - Math.max(1, Number(days) || 7));
      const start24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const start7dIso = toIso(start7d);
      const start24hIso = toIso(start24h);

      const [
        pageViews24hRes,
        pageViews7dRes,
        engaged7dRes,
        rowsRes
      ] = await Promise.all([
        safeCount(
          supabase
            ?.from(ANALYTICS_TABLE)
            ?.select('id', { count: 'exact', head: true })
            ?.eq('event_name', 'page_view')
            ?.gte('created_at', start24hIso)
        ),
        safeCount(
          supabase
            ?.from(ANALYTICS_TABLE)
            ?.select('id', { count: 'exact', head: true })
            ?.eq('event_name', 'page_view')
            ?.gte('created_at', start7dIso)
        ),
        safeCount(
          supabase
            ?.from(ANALYTICS_TABLE)
            ?.select('id', { count: 'exact', head: true })
            ?.eq('event_name', 'page_engaged_15s')
            ?.gte('created_at', start7dIso)
        ),
        loadRows(start7dIso, maxRows)
      ]);

      if (pageViews24hRes?.error) return { data: null, error: pageViews24hRes.error };
      if (pageViews7dRes?.error) return { data: null, error: pageViews7dRes.error };
      if (engaged7dRes?.error) return { data: null, error: engaged7dRes.error };
      if (rowsRes?.error) return { data: null, error: rowsRes.error };

      const rows = Array.isArray(rowsRes?.data) ? rowsRes.data : [];
      const pageViewRows = rows.filter((row) => row?.event_name === 'page_view');
      const rows24h = pageViewRows.filter((row) => {
        const ts = new Date(row?.created_at || 0)?.getTime();
        return Number.isFinite(ts) && ts >= start24h.getTime();
      });

      const uniqueVisitorSet7d = new Set(pageViewRows.map((row) => row?.visitor_id).filter(Boolean));
      const uniqueSessionSet7d = new Set(pageViewRows.map((row) => row?.session_id).filter(Boolean));
      const uniqueVisitorSet24h = new Set(rows24h.map((row) => row?.visitor_id).filter(Boolean));
      const uniqueSessionSet24h = new Set(rows24h.map((row) => row?.session_id).filter(Boolean));

      const topPagesMap = countBy(pageViewRows, (row) => normalizePagePath(row?.page_path));
      const topReferrersMap = countBy(pageViewRows, (row) => normalizeReferrerLabel(row?.referrer_host));
      const pageTypesMap = countBy(pageViewRows, (row) => String(row?.page_type || '').trim() || 'other');

      const topReferrers = topEntries(topReferrersMap, 8).filter(
        (entry) => entry?.label !== 'Interne' && entry?.label !== 'Direct'
      );

      const pageViews7d = pageViews7dRes?.count || 0;
      const engaged7d = engaged7dRes?.count || 0;
      const engagementRate7d = pageViews7d > 0 ? Number(((engaged7d / pageViews7d) * 100).toFixed(1)) : 0;

      return {
        data: {
          generatedAt: new Date().toISOString(),
          sourceRowsLoaded: rows.length,
          periodDays: Math.max(1, Number(days) || 7),
          metrics: {
            pageViews24h: pageViews24hRes?.count || 0,
            pageViews7d,
            uniqueVisitors24h: uniqueVisitorSet24h.size,
            uniqueVisitors7d: uniqueVisitorSet7d.size,
            sessions24h: uniqueSessionSet24h.size,
            sessions7d: uniqueSessionSet7d.size,
            engagedViews7d: engaged7d,
            engagementRate7d
          },
          topPages: topEntries(topPagesMap, 6),
          topReferrers: topReferrers.slice(0, 6),
          topPageTypes: topEntries(pageTypesMap, 6)
        },
        error: null
      };
    } catch (error) {
      console.error('Erreur chargement snapshot frequentation plateforme:', error);
      return { data: null, error };
    }
  },

  getAdminBusinessSnapshot: async ({ maxPages = 50 } = {}) => {
    try {
      const startOfYear = getStartOfYear();
      const startOfYearIso = startOfYear?.toISOString();
      const currentYear = startOfYear?.getFullYear();

      let listingSelect = 'id, prix_jour, type, published, statut, moderation_status';
      let listingAttempts = 0;
      let listingsRows = [];

      while (listingAttempts < 6) {
        const rowsRes = await loadRowsPaginated(
          (from, to) => supabase
            ?.from(LISTINGS_TABLE)
            ?.select(listingSelect)
            ?.order('id', { ascending: true })
            ?.range(from, to),
          { maxPages }
        );

        if (!rowsRes?.error) {
          listingsRows = Array.isArray(rowsRes?.data) ? rowsRes.data : [];
          break;
        }

        const missingColumn = extractMissingColumnName(rowsRes?.error);
        if (!missingColumn || !String(listingSelect)?.toLowerCase()?.includes(String(missingColumn)?.toLowerCase())) {
          return { data: null, error: rowsRes?.error };
        }

        listingSelect = removeColumnFromSelect(listingSelect, missingColumn);
        listingAttempts += 1;
      }

      let reservationsSelect = 'id, total_price, paid_at, tenant_payment_paid_at, status, created_at';
      let reservationAttempts = 0;
      let reservationsRows = [];

      while (reservationAttempts < 8) {
        const hasPaidAt = hasSelectColumn(reservationsSelect, 'paid_at');
        const hasTenantPaidAt = hasSelectColumn(reservationsSelect, 'tenant_payment_paid_at');
        const hasCreatedAt = hasSelectColumn(reservationsSelect, 'created_at');

        const rowsRes = await loadRowsPaginated(
          (from, to) => {
            let query = supabase
              ?.from(RESERVATIONS_TABLE)
              ?.select(reservationsSelect)
              ?.order('id', { ascending: true })
              ?.range(from, to);

            if (hasPaidAt && hasTenantPaidAt) {
              query = query?.or(`paid_at.gte.${startOfYearIso},tenant_payment_paid_at.gte.${startOfYearIso}`);
            } else if (hasPaidAt) {
              query = query?.gte('paid_at', startOfYearIso);
            } else if (hasTenantPaidAt) {
              query = query?.gte('tenant_payment_paid_at', startOfYearIso);
            } else if (hasCreatedAt) {
              query = query?.gte('created_at', startOfYearIso);
            }

            return query;
          },
          { maxPages }
        );

        if (!rowsRes?.error) {
          reservationsRows = Array.isArray(rowsRes?.data) ? rowsRes.data : [];
          break;
        }

        const missingColumn = extractMissingColumnName(rowsRes?.error);
        if (!missingColumn || !String(reservationsSelect)?.toLowerCase()?.includes(String(missingColumn)?.toLowerCase())) {
          return { data: null, error: rowsRes?.error };
        }

        reservationsSelect = removeColumnFromSelect(reservationsSelect, missingColumn);
        reservationAttempts += 1;
      }

      const liveListings = (listingsRows || []).filter((row) => {
        const listingType = lower(row?.type);
        const isOffer = !listingType || listingType === 'offre';
        return isOffer && isLiveListing(row);
      });

      const totalDailyPrice = liveListings.reduce((sum, row) => sum + Math.max(0, toSafeNumber(row?.prix_jour)), 0);
      const potentialGrossAnnual = totalDailyPrice * DAYS_PER_YEAR;
      const potentialPlatformRevenueAnnual = potentialGrossAnnual * PLATFORM_COMMISSION_RATE;

      const ytdPaidGross = (reservationsRows || []).reduce((sum, row) => {
        const totalPrice = Math.max(0, toSafeNumber(row?.total_price));
        if (totalPrice <= 0) return sum;

        const paidAtDate = getPaidAtDate(row);
        if (paidAtDate) {
          return paidAtDate >= startOfYear ? sum + totalPrice : sum;
        }

        if (!isReservationPaidFallback(row)) return sum;

        const createdAt = new Date(row?.created_at || 0);
        if (Number.isNaN(createdAt?.getTime()) || createdAt < startOfYear) return sum;
        return sum + totalPrice;
      }, 0);

      const platformRevenueYtd = ytdPaidGross * PLATFORM_COMMISSION_RATE;
      const attainmentRateYtd = potentialPlatformRevenueAnnual > 0
        ? Number(((platformRevenueYtd / potentialPlatformRevenueAnnual) * 100).toFixed(2))
        : 0;

      return {
        data: {
          generatedAt: new Date().toISOString(),
          metrics: {
            year: currentYear,
            periodStartIso: startOfYearIso,
            listingCount: liveListings?.length || 0,
            potentialGrossAnnual,
            potentialPlatformRevenueAnnual,
            platformRevenueYtd,
            attainmentRateYtd
          }
        },
        error: null
      };
    } catch (error) {
      console.error('Erreur chargement snapshot business admin:', error);
      return { data: null, error };
    }
  }
};

export default platformAnalyticsService;
