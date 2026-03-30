import { supabase } from '../lib/supabase';

const buildFunctionUrl = (functionName) => {
  const supabaseUrl = String(
    import.meta.env?.VITE_SUPABASE_URL
    || import.meta.env?.NEXT_PUBLIC_SUPABASE_URL
    || ''
  ).trim().replace(/\/$/, '');

  if (!supabaseUrl || !functionName) return null;
  return `${supabaseUrl}/functions/v1/${functionName}`;
};

const readResponsePayload = async (response) => {
  if (!response) return null;

  try {
    return await response.clone().json();
  } catch {
    try {
      const text = await response.clone().text();
      return text ? { message: text } : null;
    } catch {
      return null;
    }
  }
};

const getFreshAccessToken = async () => {
  const nowSec = Math.floor(Date.now() / 1000);
  const minTtlSec = 90;

  let session = null;
  if (supabase?.auth?.getSession) {
    const { data } = await supabase.auth.getSession();
    session = data?.session || null;
  }

  const currentToken = session?.access_token || null;
  const expiresAt = Number(session?.expires_at || 0) || 0;
  const shouldRefresh = !currentToken || !expiresAt || (expiresAt - nowSec) <= minTtlSec;

  if (!shouldRefresh) {
    return currentToken;
  }

  if (supabase?.auth?.refreshSession) {
    const { data: refreshedData } = await supabase.auth.refreshSession();
    const refreshedToken = refreshedData?.session?.access_token || null;
    if (refreshedToken) return refreshedToken;
  }

  return currentToken;
};

const invokeProtectedFunction = async (functionName, body = {}) => {
  try {
    const functionUrl = buildFunctionUrl(functionName);
    const supabaseAnonKey = String(
      import.meta.env?.VITE_SUPABASE_ANON_KEY
      || import.meta.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY
      || ''
    ).trim();

    if (!functionUrl || !supabaseAnonKey) {
      return {
        data: null,
        error: {
          message: 'Configuration Supabase Functions manquante.',
          status: 500
        }
      };
    }

    const userAccessToken = await getFreshAccessToken();
    if (!userAccessToken) {
      return {
        data: null,
        error: {
          message: 'Session expirée. Veuillez vous reconnecter.',
          status: 401
        }
      };
    }

    let response = null;
    try {
      response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'x-ldv-user-jwt': userAccessToken
        },
        body: JSON.stringify(body || {})
      });
    } catch (networkError) {
      return {
        data: null,
        error: {
          message: networkError?.message || 'Impossible de joindre la fonction backend.',
          status: null
        }
      };
    }

    const payload = await readResponsePayload(response);
    if (!response?.ok) {
      return {
        data: payload || null,
        error: {
          message: payload?.error || payload?.message || payload?.verification?.overallMessage || 'La vérification a échoué.',
          status: Number(response?.status || 0) || null
        }
      };
    }

    return { data: payload || null, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        message: error?.message || 'Impossible de lancer la vérification.'
      }
    };
  }
};

const adminTestVerificationService = {
  async getCatalogContext() {
    return invokeProtectedFunction('run-admin-test-verification', {
      action: 'catalog_context'
    });
  },

  async runVerification({ verificationId, referenceScenarioId, includePauseResume = true }) {
    return invokeProtectedFunction('run-admin-test-verification', {
      action: 'run',
      verificationId,
      referenceScenarioId,
      includePauseResume
    });
  },

  async runAllTesterPairs({ includePauseResume = true } = {}) {
    return invokeProtectedFunction('run-admin-test-verification', {
      action: 'run_all_pairs',
      verificationId: 'testing_pairs_backend_all',
      includePauseResume
    });
  }
};

export default adminTestVerificationService;
