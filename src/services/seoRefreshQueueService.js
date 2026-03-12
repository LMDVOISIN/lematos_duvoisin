import { supabase } from '../lib/supabase';

const DEFAULT_DEDUPE_KEY = 'seo_refresh_annonces';
const SEO_REFRESH_REQUEST_TYPE = 'seo_refresh_annonces';
const FAILURE_RESOLUTION_STATUS = {
  resolved: 'resolved',
  unresolved: 'unresolved',
};

const toTimestamp = (value) => {
  if (!value) return 0;
  const parsed = new Date(value)?.getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildFailureResolutionRows = ({ failedRows = [], doneRows = [] } = {}) => {
  const doneByAnnonce = new Map();

  (doneRows || []).forEach((row) => {
    const annonceId = Number(row?.annonce_id);
    if (!Number.isFinite(annonceId) || annonceId <= 0) return;
    const key = String(annonceId);
    if (!doneByAnnonce.has(key)) {
      doneByAnnonce.set(key, []);
    }
    doneByAnnonce.get(key)?.push(row);
  });

  doneByAnnonce.forEach((rows) => {
    rows.sort((a, b) => toTimestamp(a?.processed_at || a?.created_at) - toTimestamp(b?.processed_at || b?.created_at));
  });

  return (failedRows || []).map((failedRow) => {
    const annonceId = Number(failedRow?.annonce_id);
    const key = Number.isFinite(annonceId) && annonceId > 0 ? String(annonceId) : null;
    const failedAt = toTimestamp(failedRow?.processed_at || failedRow?.created_at);
    const resolutionRow = key
      ? (doneByAnnonce.get(key) || []).find((doneRow) => toTimestamp(doneRow?.processed_at || doneRow?.created_at) > failedAt)
      : null;

    return {
      ...failedRow,
      resolution_status: resolutionRow ? FAILURE_RESOLUTION_STATUS.resolved : FAILURE_RESOLUTION_STATUS.unresolved,
      resolved_at: resolutionRow?.processed_at || resolutionRow?.created_at || null,
      resolution_request_id: resolutionRow?.id || null,
    };
  });
};

const buildUnresolvedFailureRows = ({ failedRows = [], doneRows = [] } = {}) => (
  buildFailureResolutionRows({ failedRows, doneRows })
    .filter((row) => row?.resolution_status === FAILURE_RESOLUTION_STATUS.unresolved)
    .sort((a, b) => toTimestamp(b?.created_at) - toTimestamp(a?.created_at))
);

const seoRefreshQueueService = {
  queueAnnonceSeoRefresh: async ({ annonceId = null, reason = 'annonce_approved', source = 'admin_moderation', payload = {} } = {}) => {
    try {
      const normalizedAnnonceId = Number(annonceId);
      const hasAnnonceId = Number.isFinite(normalizedAnnonceId) && normalizedAnnonceId > 0;

      const row = {
        request_type: SEO_REFRESH_REQUEST_TYPE,
        target: 'annonces',
        source,
        status: 'pending',
        reason,
        dedupe_key: DEFAULT_DEDUPE_KEY,
        payload: {
          ...(payload && typeof payload === 'object' ? payload : {}),
          requested_from: source,
          requested_reason: reason,
        },
        updated_at: new Date()?.toISOString(),
      };

      if (hasAnnonceId) {
        row.annonce_id = normalizedAnnonceId;
      }

      const { data, error } = await supabase
        ?.from('seo_refresh_requests')
        ?.insert(row)
        ?.select('id, status, created_at')
        ?.single();

      if (error) {
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Erreur queue SEO refresh annonces:', error);
      return { data: null, error };
    }
  },

  getAdminQueueSummary: async () => {
    try {
      const statuses = ['pending', 'processing', 'done'];
      const [latestRes, failedRes, doneRes, ...countResults] = await Promise.all([
        supabase
          ?.from('seo_refresh_requests')
          ?.select('id, status, source, reason, annonce_id, created_at, started_at, processed_at, error_message')
          ?.eq('request_type', SEO_REFRESH_REQUEST_TYPE)
          ?.order('created_at', { ascending: false })
          ?.limit(8),
        supabase
          ?.from('seo_refresh_requests')
          ?.select('id, annonce_id, created_at, processed_at')
          ?.eq('request_type', SEO_REFRESH_REQUEST_TYPE)
          ?.eq('status', 'failed'),
        supabase
          ?.from('seo_refresh_requests')
          ?.select('id, annonce_id, created_at, processed_at')
          ?.eq('request_type', SEO_REFRESH_REQUEST_TYPE)
          ?.eq('status', 'done'),
        ...statuses.map((status) =>
          supabase
            ?.from('seo_refresh_requests')
            ?.select('id', { count: 'exact', head: true })
            ?.eq('request_type', SEO_REFRESH_REQUEST_TYPE)
            ?.eq('status', status)
        )
      ]);

      const counts = statuses.reduce((acc, status, index) => {
        const result = countResults?.[index];
        acc[status] = Number(result?.count || 0);
        return acc;
      }, {});

      const firstError = latestRes?.error || failedRes?.error || doneRes?.error;
      if (firstError) {
        return { data: null, error: firstError };
      }

      const unresolvedRows = buildUnresolvedFailureRows({
        failedRows: Array.isArray(failedRes?.data) ? failedRes.data : [],
        doneRows: Array.isArray(doneRes?.data) ? doneRes.data : [],
      });
      counts.failed = unresolvedRows.length;

      return {
        data: {
          counts,
          latest: Array.isArray(latestRes?.data) ? latestRes.data : []
        },
        error: null
      };
    } catch (error) {
      console.error('Erreur chargement queue SEO refresh admin:', error);
      return { data: null, error };
    }
  }
  ,

  getAdminFailureResolutionView: async ({ maxFailedRows = 200, maxDoneRows = 1000, latestRows = 12 } = {}) => {
    try {
      const [failedRes, doneRes] = await Promise.all([
        supabase
          ?.from('seo_refresh_requests')
          ?.select('id, status, source, reason, annonce_id, created_at, processed_at, error_message')
          ?.eq('request_type', SEO_REFRESH_REQUEST_TYPE)
          ?.eq('status', 'failed')
          ?.order('created_at', { ascending: false })
          ?.limit(maxFailedRows),
        supabase
          ?.from('seo_refresh_requests')
          ?.select('id, annonce_id, created_at, processed_at')
          ?.eq('request_type', SEO_REFRESH_REQUEST_TYPE)
          ?.eq('status', 'done')
          ?.order('created_at', { ascending: false })
          ?.limit(maxDoneRows),
      ]);

      if (failedRes?.error) {
        return { data: null, error: failedRes.error };
      }

      if (doneRes?.error) {
        return { data: null, error: doneRes.error };
      }

      const resolutionRows = buildUnresolvedFailureRows({
        failedRows: Array.isArray(failedRes?.data) ? failedRes.data : [],
        doneRows: Array.isArray(doneRes?.data) ? doneRes.data : [],
      });

      return {
        data: {
          counts: {
            unresolved: resolutionRows.length,
          },
          latest: resolutionRows.slice(0, Math.max(0, latestRows)),
        },
        error: null,
      };
    } catch (error) {
      console.error('Erreur chargement vue resolution echecs SEO:', error);
      return { data: null, error };
    }
  }
};

export default seoRefreshQueueService;
