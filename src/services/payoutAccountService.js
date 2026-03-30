import { supabase } from '../lib/supabase';

function normalizePayoutErrorMessage(message = '') {
  const rawMessage = String(message || '').trim();
  if (!rawMessage) return 'Erreur du service de versement.';

  if (/test bank account number/i.test(rawMessage)) {
    return "Le site est encore en mode test. Utilisez l'IBAN de test proposé sur la page.";
  }

  if (/valid phone number/i.test(rawMessage)) {
    return "Le numéro de téléphone n'est pas dans un format accepté. Essayez par exemple 06 12 34 56 78.";
  }

  if (/business_type[\s\S]*account token/i.test(rawMessage) || /account token[\s\S]*business_type/i.test(rawMessage)) {
    return "Les informations de versement ont bien été saisies, mais leur enregistrement a été refusé une première fois par le service de paiement. Rechargez la page puis réessayez.";
  }

  if (/account tokens?/i.test(rawMessage)) {
    return "Le mode natif des versements n'est pas encore complètement actif sur cette configuration.";
  }

  return rawMessage;
}

function buildFunctionUrl(functionName) {
  const supabaseUrl = String(
    import.meta.env?.VITE_SUPABASE_URL
    || import.meta.env?.NEXT_PUBLIC_SUPABASE_URL
    || ''
  ).trim().replace(/\/$/, '');

  if (!supabaseUrl || !functionName) return null;
  return `${supabaseUrl}/functions/v1/${functionName}`;
}

async function readResponsePayload(response) {
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
}

async function getFreshAccessToken() {
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
}

async function invokePayoutFunction(functionName, body = {}) {
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
          message: 'Configuration du service de versement manquante.',
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
          message: networkError?.message || 'Impossible de joindre le service de versement.',
          status: null
        }
      };
    }

    const payload = await readResponsePayload(response);
    if (!response?.ok) {
      return {
        data: null,
        error: {
          message: normalizePayoutErrorMessage(payload?.error || payload?.message || 'Erreur du service de versement.'),
          status: Number(response?.status || 0) || null
        }
      };
    }

    return {
      data: payload || {},
      error: null
    };
  } catch (error) {
      return {
        data: null,
        error: {
          message: normalizePayoutErrorMessage(error?.message || 'Erreur du service de versement.')
        }
      };
    }
}

const payoutAccountService = {
  getStatus: async () => {
    return await invokePayoutFunction('manage-payout-account', {
      action: 'status'
    });
  },

  saveNativeDetails: async ({
    accountTokenId = null,
    bankAccountTokenId = null,
    profile = null,
    tosAccepted = false
  } = {}) => {
    return await invokePayoutFunction('manage-payout-account', {
      action: 'native_submit',
      accountTokenId,
      bankAccountTokenId,
      profile,
      tosAccepted
    });
  },

  createActivationLink: async ({ returnUrl, refreshUrl } = {}) => {
    return await invokePayoutFunction('manage-payout-account', {
      action: 'activate',
      returnUrl,
      refreshUrl
    });
  },

  openManagement: async ({ returnUrl, refreshUrl } = {}) => {
    return await invokePayoutFunction('manage-payout-account', {
      action: 'manage',
      returnUrl,
      refreshUrl
    });
  }
};

export default payoutAccountService;
