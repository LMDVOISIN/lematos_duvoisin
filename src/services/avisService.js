import { supabase } from '../lib/supabase';

function isSchemaOrAccessError(error) {
  if (!error) return false;
  const code = String(error?.code || '');
  if (['42P01', '42703', 'PGRST204', 'PGRST205', '42501']?.includes(code)) return true;

  const text = `${error?.message || ''} ${error?.details || ''}`?.toLowerCase();
  return /relation.*does not exist/.test(text)
    || /column.*does not exist/.test(text)
    || /schema cache/.test(text)
    || /permission denied/.test(text)
    || /not authorized/.test(text);
}

function normalizeType(value) {
  return String(value || '')
    ?.trim()
    ?.toLowerCase()
    ?.normalize('NFD')
    ?.replace(/[\u0300-\u036f]/g, '');
}

function isOwnerReviewType(type) {
  const normalized = normalizeType(type);
  if (!normalized) return true;

  const ownerMarkers = ['owner', 'propriétaire', 'loueur', 'lessor', 'bailleur'];
  const renterMarkers = ['renter', 'locataire', 'tenant', 'borrower'];

  if (ownerMarkers?.some((marker) => normalized?.includes(marker))) return true;
  if (renterMarkers?.some((marker) => normalized?.includes(marker))) return false;
  return true;
}

function toValidRating(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric < 0 || numeric > 5) return null;
  return numeric;
}

const avisService = {
  getUsersRatingSummaries: async (userIds = [], options = {}) => {
    try {
      const uniqueUserIds = [...new Set((userIds || [])?.filter(Boolean)?.map((id) => String(id)))];
      if (uniqueUserIds?.length === 0) return { data: {}, error: null };

      const { role = 'all' } = options;

      const { data, error } = await supabase
        ?.from('avis')
        ?.select('reviewed_user_id, rating, type')
        ?.in('reviewed_user_id', uniqueUserIds)
        ?.not('rating', 'is', null);

      if (error) {
        if (isSchemaOrAccessError(error)) {
          console.warn('[avisService] Lecture avis bulk indisponible:', error?.message || error);
          return { data: {}, error: null };
        }
        return { data: null, error };
      }

      const summaries = {};
      for (const userId of uniqueUserIds) {
        summaries[userId] = { averageRating: null, reviewCount: 0 };
      }

      let rows = Array.isArray(data) ? data : [];
      if (role === 'owner') {
        rows = rows?.filter((row) => isOwnerReviewType(row?.type));
      }

      for (const row of rows) {
        const reviewedUserId = String(row?.reviewed_user_id || '');
        if (!reviewedUserId) continue;
        const rating = toValidRating(row?.rating);
        if (rating === null) continue;

        if (!summaries?.[reviewedUserId]) {
          summaries[reviewedUserId] = { averageRating: null, reviewCount: 0, _sum: 0 };
        }
        const current = summaries[reviewedUserId];
        current.reviewCount = Number(current?.reviewCount || 0) + 1;
        current._sum = Number(current?._sum || 0) + rating;
      }

      Object.keys(summaries || {})?.forEach((userId) => {
        const item = summaries?.[userId];
        const count = Number(item?.reviewCount || 0);
        const sum = Number(item?._sum || 0);
        summaries[userId] = {
          averageRating: count > 0 ? sum / count : null,
          reviewCount: count
        };
      });

      return { data: summaries, error: null };
    } catch (error) {
      console.error('Erreur calcul notes utilisateurs depuis avis (bulk):', error);
      return { data: null, error };
    }
  },

  /**
   * Computes user rating summary from the public.avis table.
   * We filter by reviewed_user_id, then optionally keep only owner-related review types.
   */
  getUserRatingSummary: async (userId, options = {}) => {
    try {
      if (!userId) return { data: null, error: null };
      const { data, error } = await avisService?.getUsersRatingSummaries([userId], options);
      if (error) return { data: null, error };
      return {
        data: data?.[String(userId)] || { averageRating: null, reviewCount: 0 },
        error: null
      };
    } catch (error) {
      console.error('Erreur calcul note utilisateur depuis avis:', error);
      return { data: null, error };
    }
  }
};

export default avisService;
