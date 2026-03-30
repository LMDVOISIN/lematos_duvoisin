import { supabase } from '../lib/supabase';
import authService from './authService';
import profileService from './profileService';
import {
  clearDedicatedAdminSessionMarker,
  clearRememberedPreAdminSession,
  isDedicatedAdminSessionActive,
  markDedicatedAdminSessionActive,
  readRememberedPreAdminSession,
  rememberPreAdminSession
} from '../utils/adminSessionBridge';

const DEFAULT_ADMIN_ERROR_MESSAGE = "Impossible d'activer l'accès administrateur.";

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

const wait = (delayMs) => new Promise((resolve) => {
  setTimeout(resolve, delayMs);
});

async function waitForAdminProfile(userId, options = {}) {
  const attempts = Number(options?.attempts || 8);
  const delayMs = Number(options?.delayMs || 150);

  if (!userId) {
    return {
      data: null,
      error: {
        message: "Session administrateur invalide."
      }
    };
  }

  let lastError = null;

  for (let attemptIndex = 0; attemptIndex < attempts; attemptIndex += 1) {
    const { data, error } = await profileService?.getProfile(userId);

    if (!error && data?.is_admin === true) {
      return { data, error: null };
    }

    if (error) {
      lastError = error;
    }

    if (attemptIndex < attempts - 1) {
      // Leave a short gap for the profile trigger / update to settle.
      await wait(delayMs);
    }
  }

  return {
    data: null,
    error: lastError || {
      message: "Le profil administrateur n'est pas disponible."
    }
  };
}

async function callGrantAdminAccessFunction(password) {
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

  let response = null;

  try {
    response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`
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
        message: payload?.error || payload?.message || DEFAULT_ADMIN_ERROR_MESSAGE,
        status: Number(response?.status || 0) || null
      }
    };
  }

  const data = payload || {};
  const adminEmail = String(data?.admin_email || data?.adminEmail || '').trim().toLowerCase();

  if (data?.ok !== true || !adminEmail) {
    return {
      data: null,
      error: {
        message: data?.error || "Impossible de préparer la session administrateur.",
        status: 500
      }
    };
  }

  return {
    data: {
      ...data,
      adminEmail
    },
    error: null
  };
}

async function restorePreviousSessionOrSignOut(options = {}) {
  const forceSignOut = options?.forceSignOut === true;
  const previousSession = readRememberedPreAdminSession();
  const dedicatedSessionActive = isDedicatedAdminSessionActive();

  clearRememberedPreAdminSession();
  clearDedicatedAdminSessionMarker();

  if (previousSession?.accessToken && previousSession?.refreshToken) {
    const { data, error } = await supabase?.auth?.setSession({
      access_token: previousSession.accessToken,
      refresh_token: previousSession.refreshToken
    });

    if (!error) {
      return {
        data: {
          restored: true,
          session: data?.session || null
        },
        error: null
      };
    }

    console.warn('Restauration session utilisateur impossible après sortie admin:', error);
  }

  if (!forceSignOut && !dedicatedSessionActive && !previousSession) {
    return {
      data: {
        restored: false,
        signedOut: false
      },
      error: null
    };
  }

  const { error } = await authService?.signOut();
  if (error) {
    return { data: null, error };
  }

  return {
    data: {
      restored: false,
      signedOut: true
    },
    error: null
  };
}

const adminService = {
  validateAdminPassword: async (password) => {
    try {
      const normalizedPassword = String(password || '').trim();

      if (!normalizedPassword) {
        return {
          data: null,
          error: {
            message: 'Mot de passe admin requis.'
          }
        };
      }

      return await callGrantAdminAccessFunction(normalizedPassword);
    } catch (error) {
      console.error('Validate admin password error:', error);
      return {
        data: null,
        error: {
          message: error?.message || DEFAULT_ADMIN_ERROR_MESSAGE
        }
      };
    }
  },

  openDedicatedAdminSession: async (password, options = {}) => {
    const normalizedPassword = String(password || '').trim();

    if (!normalizedPassword) {
      return {
        data: null,
        error: {
          message: 'Mot de passe admin requis.'
        }
      };
    }

    try {
      const { data: validationData, error: validationError } = await adminService.validateAdminPassword(normalizedPassword);
      if (validationError) {
        clearRememberedPreAdminSession();
        clearDedicatedAdminSessionMarker();
        return { data: null, error: validationError };
      }

      if (options?.preserveCurrentSession) {
        const { data: sessionData } = await supabase?.auth?.getSession();
        const currentSession = sessionData?.session || null;

        if (currentSession?.access_token && currentSession?.refresh_token) {
          rememberPreAdminSession(currentSession);
        } else {
          clearRememberedPreAdminSession();
        }
      } else {
        clearRememberedPreAdminSession();
      }

      const { data: signInData, error: signInError } = await authService?.signIn(validationData?.adminEmail, normalizedPassword);
      if (signInError) {
        clearRememberedPreAdminSession();
        clearDedicatedAdminSessionMarker();
        return { data: null, error: signInError };
      }

      const signedInUser = signInData?.user || signInData?.session?.user || null;
      const { data: adminProfile, error: adminProfileError } = await waitForAdminProfile(signedInUser?.id);

      if (adminProfileError) {
        await restorePreviousSessionOrSignOut({ forceSignOut: true });
        return { data: null, error: adminProfileError };
      }

      markDedicatedAdminSessionActive();

      return {
        data: {
          adminEmail: validationData?.adminEmail,
          user: signedInUser,
          session: signInData?.session || null,
          profile: adminProfile
        },
        error: null
      };
    } catch (error) {
      console.error('Open dedicated admin session error:', error);
      clearRememberedPreAdminSession();
      clearDedicatedAdminSessionMarker();
      return {
        data: null,
        error: {
          message: error?.message || DEFAULT_ADMIN_ERROR_MESSAGE
        }
      };
    }
  },

  closeDedicatedAdminSession: async () => {
    try {
      return await restorePreviousSessionOrSignOut();
    } catch (error) {
      console.error('Close dedicated admin session error:', error);
      return {
        data: null,
        error: {
          message: error?.message || "Impossible de fermer la session administrateur."
        }
      };
    }
  }
};

export default adminService;
