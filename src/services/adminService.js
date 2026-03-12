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

const adminService = {
  grantCurrentUserAdminAccess: async (password) => {
    try {
      const functionUrl = buildFunctionUrl('grant-admin-access');
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
          body: JSON.stringify({
            password: String(password || '').trim()
          })
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
          data: null,
          error: {
            message: payload?.error || payload?.message || "Impossible d'activer l'acces administrateur.",
            status: Number(response?.status || 0) || null
          }
        };
      }

      const data = payload || {};
      if (data?.ok !== true) {
        return {
          data: null,
          error: {
            message: data?.error || "Impossible d'activer l'acces administrateur.",
            status: 500
          }
        };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Grant admin access error:', error);
      return {
        data: null,
        error: {
          message: error?.message || "Impossible d'activer l'acces administrateur."
        }
      };
    }
  }
};

export default adminService;
