import { supabase } from '../lib/supabase';

const ADMIN_BUSINESS_OBJECTIVES_TABLE = 'admin_business_objectives';
const DEFAULT_SCOPE = 'business_dashboard';

const EMPTY_OBJECTIVES = {
  listingCount: null,
  potentialPlatformRevenueAnnual: null,
  platformRevenueYtd: null
};

const toNullableInteger = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.round(parsed));
};

const normalizeObjectives = (payload = {}) => ({
  listingCount: toNullableInteger(payload?.listingCount),
  potentialPlatformRevenueAnnual: toNullableInteger(payload?.potentialPlatformRevenueAnnual),
  platformRevenueYtd: toNullableInteger(payload?.platformRevenueYtd)
});

const mapRowToObjectives = (row) => ({
  listingCount: toNullableInteger(row?.listing_count_target),
  potentialPlatformRevenueAnnual: toNullableInteger(row?.potential_platform_revenue_annual_target),
  platformRevenueYtd: toNullableInteger(row?.platform_revenue_ytd_target)
});

const buildMissingSchemaError = (error) => {
  const message = String(error?.message || '');
  const isSchemaMissing = /relation.*does not exist|could not find .* in the schema cache/i?.test(message);
  if (!isSchemaMissing) return error;

  return {
    ...error,
    message: "La configuration des objectifs admin est absente. Applique la migration Supabase correspondante."
  };
};

const adminBusinessObjectivesService = {
  EMPTY_OBJECTIVES,

  getObjectives: async () => {
    try {
      const { data, error } = await supabase
        ?.from(ADMIN_BUSINESS_OBJECTIVES_TABLE)
        ?.select('scope, listing_count_target, potential_platform_revenue_annual_target, platform_revenue_ytd_target, updated_at')
        ?.eq('scope', DEFAULT_SCOPE)
        ?.maybeSingle();

      if (error) {
        return { data: null, error: buildMissingSchemaError(error) };
      }

      if (!data) {
        return {
          data: {
            ...EMPTY_OBJECTIVES,
            updatedAt: null
          },
          error: null
        };
      }

      return {
        data: {
          ...mapRowToObjectives(data),
          updatedAt: data?.updated_at || null
        },
        error: null
      };
    } catch (error) {
      console.error('Erreur chargement objectifs business admin:', error);
      return { data: null, error: buildMissingSchemaError(error) };
    }
  },

  saveObjectives: async (payload = {}) => {
    try {
      const normalized = normalizeObjectives(payload);
      const { data: authData } = await supabase?.auth?.getUser();
      const currentUserId = authData?.user?.id || null;

      const { data, error } = await supabase
        ?.from(ADMIN_BUSINESS_OBJECTIVES_TABLE)
        ?.upsert({
          scope: DEFAULT_SCOPE,
          listing_count_target: normalized?.listingCount,
          potential_platform_revenue_annual_target: normalized?.potentialPlatformRevenueAnnual,
          platform_revenue_ytd_target: normalized?.platformRevenueYtd,
          updated_at: new Date()?.toISOString(),
          updated_by: currentUserId
        }, { onConflict: 'scope' })
        ?.select('scope, listing_count_target, potential_platform_revenue_annual_target, platform_revenue_ytd_target, updated_at')
        ?.single();

      if (error) {
        return { data: null, error: buildMissingSchemaError(error) };
      }

      return {
        data: {
          ...mapRowToObjectives(data),
          updatedAt: data?.updated_at || null
        },
        error: null
      };
    } catch (error) {
      console.error('Erreur sauvegarde objectifs business admin:', error);
      return { data: null, error: buildMissingSchemaError(error) };
    }
  }
};

export default adminBusinessObjectivesService;
