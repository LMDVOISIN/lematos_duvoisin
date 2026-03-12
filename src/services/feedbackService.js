import { supabase } from '../lib/supabase';

/**
 * Feedback service
 * Supports legacy table names and optional columns.
 */

const FEEDBACK_TABLES = ['feedback', 'feedbacks'];

const STATUS_CANDIDATES = {
  new: ['new', 'Nouveau', 'pending'],
  in_progress: ['in_progress', 'En cours', 'processing'],
  processed: ['processed', 'Traite', 'Trait\u00e9', 'published', 'archived', 'done']
};

function isSchemaError(error) {
  if (!error) return false;
  if (error?.code && typeof error?.code === 'string') {
    const errorClass = error?.code?.substring(0, 2);
    if (errorClass === '42' || errorClass === '08') return true;
  }
  if (error?.message) {
    const schemaErrorPatterns = [
      /relation.*does not exist/i,
      /column.*does not exist/i,
      /function.*does not exist/i,
      /syntax error/i,
    ];
    return schemaErrorPatterns?.some((pattern) => pattern?.test(error?.message));
  }
  return false;
}

function isMissingTableError(error) {
  if (!error) return false;
  if (error?.code === '42P01' || error?.code === 'PGRST205') return true;
  const text = `${error?.message || ''} ${error?.details || ''}`?.toLowerCase();
  return /relation.*does not exist/.test(text) || /table.*not found/.test(text);
}

function isMissingColumnError(error) {
  if (!error) return false;
  if (error?.code === '42703' || error?.code === 'PGRST204') return true;
  const text = `${error?.message || ''} ${error?.details || ''}`?.toLowerCase();
  return /column.*does not exist/.test(text) || /could not find the '.*' column/.test(text);
}

function isConstraintError(error) {
  if (!error) return false;
  if (error?.code === '23514') return true;
  const text = `${error?.message || ''} ${error?.details || ''}`?.toLowerCase();
  return /check constraint/.test(text) || /invalid input value/.test(text);
}

function extractMissingColumn(error) {
  if (!error) return null;
  const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  const patterns = [
    /column\s+"?([a-z0-9_]+)"?\s+of\s+relation/iu,
    /column\s+"?([a-z0-9_]+)"?\s+does not exist/iu,
    /could not find the '([a-z0-9_]+)' column/iu,
  ];
  for (const pattern of patterns) {
    const match = text?.match(pattern);
    if (match?.[1]) return match?.[1];
  }
  return null;
}

function sanitizeText(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value)?.trim();
  return normalized || null;
}

function normalizeStatusValue(status) {
  const normalized = String(status || '')
    ?.trim()
    ?.toLowerCase()
    ?.normalize('NFD')
    ?.replace(/[\u0300-\u036f]/g, '');

  if (['new', 'nouveau', 'pending']?.includes(normalized)) return 'new';
  if (['in_progress', 'in progress', 'encours', 'en cours', 'processing']?.includes(normalized)) return 'in_progress';
  if (['processed', 'traite', 'published', 'archived', 'done']?.includes(normalized)) return 'processed';

  return 'new';
}

function getStatusCandidates(status) {
  const normalized = normalizeStatusValue(status);
  return STATUS_CANDIDATES?.[normalized] || STATUS_CANDIDATES?.new;
}

function removeNullishValues(payload) {
  return Object?.entries(payload || {})?.reduce((acc, [key, value]) => {
    if (value !== undefined && value !== null) acc[key] = value;
    return acc;
  }, {});
}

async function getCurrentUserId() {
  try {
    const { data, error } = await supabase?.auth?.getUser();
    if (error) return null;
    return data?.user?.id || null;
  } catch {
    return null;
  }
}

async function executeWithFeedbackTable(operation) {
  let lastError = null;

  for (const table of FEEDBACK_TABLES) {
    const result = await operation(table);
    if (!result?.error) return { ...result, table };

    if (isMissingTableError(result?.error)) {
      lastError = result?.error;
      continue;
    }

    return { ...result, table };
  }

  return { data: null, error: lastError || new Error('Aucune table feedback disponible'), table: null };
}

async function insertWithColumnFallback(table, payload) {
  const mutablePayload = { ...(payload || {}) };
  const maxAttempts = Object?.keys(mutablePayload)?.length + 2;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { data, error } = await supabase
      ?.from(table)
      ?.insert(mutablePayload)
      ?.select()
      ?.single();

    if (!error) return { data, error: null };
    if (!isMissingColumnError(error)) return { data: null, error };

    const missingColumn = extractMissingColumn(error);
    if (!missingColumn || !(missingColumn in mutablePayload)) return { data: null, error };

    delete mutablePayload?.[missingColumn];
  }

  return { data: null, error: new Error('Echec insertion feedback: colonnes incompatibles') };
}

async function updateWithColumnFallback(table, id, payload, options = {}) {
  const { requiredColumns = [] } = options;
  const mutablePayload = { ...(payload || {}) };
  const maxAttempts = Object?.keys(mutablePayload)?.length + 2;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { error } = await supabase?.from(table)?.update(mutablePayload)?.eq('id', id);

    if (!error) return { error: null };
    if (!isMissingColumnError(error)) return { error };

    const missingColumn = extractMissingColumn(error);
    if (!missingColumn || !(missingColumn in mutablePayload)) return { error };
    if (requiredColumns?.includes(missingColumn)) return { error };

    delete mutablePayload?.[missingColumn];
    if (Object?.keys(mutablePayload)?.length === 0) return { error: null };
  }

  return { error: new Error('Echec mise ? jour feedback: colonnes incompatibles') };
}

async function getAllFeedbackFromTable(table, filters = {}) {
  const requestedLimit = Number(filters?.limit);

  let query = supabase?.from(table)?.select('*');

  if (filters?.page_path) query = query?.eq('page_path', filters?.page_path);
  if (filters?.status) query = query?.eq('status', filters?.status);

  query = query?.order('created_at', { ascending: false });

  if (Number?.isFinite(requestedLimit) && requestedLimit > 0) {
    query = query?.limit(requestedLimit);
  }

  const firstTry = await query;
  if (!firstTry?.error || !isMissingColumnError(firstTry?.error)) {
    return firstTry;
  }

  let fallbackQuery = supabase?.from(table)?.select('*');
  if (Number?.isFinite(requestedLimit) && requestedLimit > 0) {
    fallbackQuery = fallbackQuery?.limit(requestedLimit);
  }
  return fallbackQuery;
}

const feedbackService = {
  /**
   * Submit feedback (public or authenticated user)
   */
  submitFeedback: async (message, pageInfo = {}) => {
    try {
      const sanitizedMessage = sanitizeText(message);
      if (!sanitizedMessage) {
        return { data: null, error: new Error('Le message est obligatoire') };
      }

      const runtimePageUrl = typeof window !== 'undefined' ? window?.location?.href : null;
      const runtimePagePath = typeof window !== 'undefined' ? window?.location?.pathname : null;
      const runtimePageTitle = typeof document !== 'undefined' ? document?.title : null;
      const runtimeReferrer = typeof document !== 'undefined' ? document?.referrer : null;
      const runtimeUserAgent = typeof navigator !== 'undefined' ? navigator?.userAgent : null;
      const currentUserId = pageInfo?.userId || await getCurrentUserId();

      const payload = removeNullishValues({
        message: sanitizedMessage,
        email: sanitizeText(pageInfo?.email),
        page_url: sanitizeText(pageInfo?.pageUrl) || sanitizeText(runtimePageUrl),
        page_path: sanitizeText(pageInfo?.pagePath) || sanitizeText(runtimePagePath),
        page_title: sanitizeText(pageInfo?.pageTitle) || sanitizeText(runtimePageTitle),
        referrer: sanitizeText(pageInfo?.referrer) || sanitizeText(runtimeReferrer),
        user_agent: sanitizeText(pageInfo?.userAgent) || sanitizeText(runtimeUserAgent),
        status: normalizeStatusValue(pageInfo?.status),
        user_id: sanitizeText(currentUserId),
        created_at: new Date()?.toISOString()
      });

      if (!payload?.page_url) {
        payload.page_url = payload?.page_path || 'unknown';
      }

      const { data, error } = await executeWithFeedbackTable((table) =>
        insertWithColumnFallback(table, payload)
      );

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schema dans submitFeedback:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Erreur lors de l\'envoi d\'un avis :', error);
      throw error;
    }
  },

  /**
   * Get all feedback rows (admin)
   */
  getAllFeedback: async (filters = {}) => {
    try {
      const { data, error } = await executeWithFeedbackTable((table) =>
        getAllFeedbackFromTable(table, filters)
      );

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isMissingTableError(error)) return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schema dans getAllFeedback:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data: Array?.isArray(data) ? data : [], error: null };
    } catch (error) {
      console.error('Erreur lors de la recuperation des retours :', error);
      throw error;
    }
  },

  /**
   * Update feedback status (admin)
   */
  updateFeedbackStatus: async (id, status) => {
    try {
      const statusCandidates = getStatusCandidates(status);
      let lastError = null;

      for (const candidate of statusCandidates) {
        const { error } = await executeWithFeedbackTable((table) =>
          updateWithColumnFallback(
            table,
            id,
            {
              status: candidate,
              updated_at: new Date()?.toISOString()
            },
            { requiredColumns: ['status'] }
          )
        );

        if (!error) {
          return { data: { id, status: candidate }, error: null };
        }

        if (isConstraintError(error)) {
          lastError = error;
          continue;
        }

        if (isSchemaError(error)) {
          console.error('Erreur de schema dans updateFeedbackStatus:', error?.message);
          throw error;
        }

        return { data: null, error };
      }

      return { data: null, error: lastError || new Error('Impossible de mettre a jour le statut') };
    } catch (error) {
      console.error('Erreur lors de la mise ? jour du statut feedback :', error);
      throw error;
    }
  },

  /**
   * Delete feedback row (admin)
   */
  deleteFeedback: async (id) => {
    try {
      const { error } = await executeWithFeedbackTable((table) =>
        supabase?.from(table)?.delete()?.eq('id', id)
      );

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schema dans deleteFeedback:', error?.message);
          throw error;
        }
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Erreur lors de la suppression d\'un retour :', error);
      throw error;
    }
  }
};

export default feedbackService;

