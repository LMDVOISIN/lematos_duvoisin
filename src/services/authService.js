import { supabase } from '../lib/supabase';
import { buildAppRedirectUrl, isNativeIOSApp, redirectToExternalUrl } from '../utils/nativeRuntime';
import { NativeAppleSignIn, isNativeAppleSignInAvailable } from '../plugins/nativeAppleSignIn';
import { translateAuthErrorMessage } from '../utils/translateAuthErrorMessage';

/**
 * Service d'authentification
 * Correspond à la table Supabase auth.users
 * Gère l'authentification utilisateur, la gestion de session et OAuth
 */

/**
 * Fonction utilitaire pour vérifier si l'erreur est liée au schéma
 */
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
    return schemaErrorPatterns?.some(pattern => pattern?.test(error?.message));
  }
  
  return false;
}

async function fetchAuthSettings() {
  const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { data: null, error: { message: 'Configuration Supabase manquante.' } };
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      method: 'GET',
      headers: {
        apikey: supabaseAnonKey
      }
    });

    if (!response?.ok) {
      return {
        data: null,
        error: { message: `Impossible de recuperer les settings Auth (${response?.status}).` }
      };
    }

    const data = await response?.json();
    return { data, error: null };
  } catch (error) {
    return { data: null, error: { message: error?.message || 'Erreur reseau Auth settings.' } };
  }
}

function localizeAuthError(error, fallbackMessage) {
  if (!error) return error;
  return {
    ...error,
    message: translateAuthErrorMessage(error?.message, fallbackMessage)
  };
}

function localizeNativeAppleSignInError(error) {
  if (!error) {
    return { message: "Connexion Apple impossible pour le moment." };
  }

  const rawMessage = String(error?.message || '');
  const normalizedMessage = rawMessage.toLowerCase();

  if (error?.code === 'CANCELED' || normalizedMessage.includes('cancel')) {
    return { ...error, message: "Connexion Apple annulee." };
  }

  if (normalizedMessage.includes('audience') || normalizedMessage.includes('client id')) {
    return {
      ...error,
      message:
        "La configuration Apple iOS est incomplete. Ajoutez l'identifiant iOS fr.lematosduvoisin.app dans Supabase > Authentication > Providers > Apple > Client IDs."
    };
  }

  if (normalizedMessage.includes('nonce')) {
    return {
      ...error,
      message: "La verification de securite Apple a echoue. Merci de reessayer."
    };
  }

  if (normalizedMessage.includes('identity token')) {
    return {
      ...error,
      message: "Apple n'a pas retourne de jeton valide. Merci de reessayer."
    };
  }

  if (normalizedMessage.includes('plugin unavailable') || normalizedMessage.includes('module')) {
    return {
      ...error,
      message:
        "Le module natif Sign in with Apple n'est pas charge dans cette build iOS. Recompilez l'application apres synchronisation iOS."
    };
  }

  return {
    ...error,
    message: translateAuthErrorMessage(rawMessage, "Connexion Apple impossible pour le moment.")
  };
}

async function updateAppleUserMetadata(credential) {
  const givenName = String(credential?.givenName || '')?.trim();
  const familyName = String(credential?.familyName || '')?.trim();
  const fullName = String(
    credential?.fullName || [givenName, familyName]?.filter(Boolean)?.join(' ')
  )?.trim();

  if (!givenName && !familyName && !fullName) return;

  try {
    await supabase?.auth?.updateUser({
      data: {
        ...(fullName ? { full_name: fullName } : {}),
        ...(givenName ? { given_name: givenName } : {}),
        ...(familyName ? { family_name: familyName } : {})
      }
    });
  } catch (error) {
    console.warn("Impossible d'enregistrer le nom Apple dans les metadonnees utilisateur.", error);
  }
}

async function waitForAuthenticatedSession(attempts = 6, delayMs = 250) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const { data, error } = await supabase?.auth?.getSession();
      if (!error && data?.session) {
        return data.session;
      }
    } catch (_error) {
      // Ignore transient reads while the native session settles.
    }

    if (index < attempts - 1) {
      await new Promise((resolve) => {
        setTimeout(resolve, delayMs);
      });
    }
  }

  return null;
}

async function ensureAppleProfileExists(user, credential) {
  const userId = user?.id;
  if (!userId) return;

  try {
    const { data: existingProfile, error: existingProfileError } = await supabase
      ?.from('profiles')
      ?.select('id')
      ?.eq('id', userId)
      ?.maybeSingle();

    if (existingProfileError && existingProfileError?.code !== 'PGRST116') {
      console.warn('Verification du profil Apple impossible :', existingProfileError);
      return;
    }

    if (existingProfile?.id) return;

    const givenName = String(credential?.givenName || '')?.trim();
    const familyName = String(credential?.familyName || '')?.trim();
    const fullName = String(
      credential?.fullName || [givenName, familyName]?.filter(Boolean)?.join(' ')
    )?.trim();
    const email = String(user?.email || credential?.email || '')?.trim() || null;
    const pseudoFallback = String(
      user?.user_metadata?.pseudo
      || fullName
      || (email ? email?.split('@')?.[0] : '')
      || 'membre'
    )?.trim();
    const timestamp = new Date()?.toISOString();
    const basePayload = {
      id: userId,
      pseudo: pseudoFallback,
      email,
      phone: null,
      address: null,
      city: null,
      postal_code: null,
      avatar_url: null,
      is_admin: false,
      first_name: givenName || null,
      last_name: familyName || null,
      created_at: timestamp,
      updated_at: timestamp
    };

    let { error: insertError } = await supabase?.from('profiles')?.insert(basePayload);

    if (
      insertError &&
      isSchemaError(insertError) &&
      /column.*(first_name|last_name).*does not exist/i.test(String(insertError?.message || ''))
    ) {
      const { first_name, last_name, ...legacyPayload } = basePayload;
      ({ error: insertError } = await supabase?.from('profiles')?.insert(legacyPayload));
    }

    if (insertError && insertError?.code !== '23505') {
      console.warn("Creation de secours du profil Apple impossible :", insertError);
    }
  } catch (error) {
    console.warn("Creation de secours du profil Apple impossible :", error);
  }
}

async function signInWithAppleNatively() {
  if (!isNativeIOSApp()) {
    return {
      data: null,
      error: { message: "Connexion Apple native indisponible sur cette plateforme." }
    };
  }

  if (!(await isNativeAppleSignInAvailable())) {
    return {
      data: null,
      error: localizeNativeAppleSignInError({
        message: 'Native Apple Sign In plugin unavailable.'
      })
    };
  }

  try {
    const credential = await NativeAppleSignIn.signIn();
    const { data, error } = await supabase?.auth?.signInWithIdToken({
      provider: 'apple',
      token: credential?.identityToken,
      nonce: credential?.nonce
    });

    if (error) {
      return {
        data: null,
        error: localizeNativeAppleSignInError(error)
      };
    }

    const settledSession = data?.session || (await waitForAuthenticatedSession());

    if (!settledSession?.user) {
      return {
        data: null,
        error: localizeNativeAppleSignInError({
          message: "La session Apple n'a pas pu etre finalisee."
        })
      };
    }

    await updateAppleUserMetadata(credential);
    await ensureAppleProfileExists(settledSession?.user, credential);

    return {
      data: {
        ...(data || {}),
        session: settledSession,
        completedInApp: true,
        provider: 'apple'
      },
      error: null
    };
  } catch (error) {
    console.error('Erreur de connexion Apple native :', error);
    return {
      data: null,
      error: localizeNativeAppleSignInError(error)
    };
  }
}

const authService = {
  /**
   * Inscription d'un nouvel utilisateur
   * Creates user in auth.users and profile in profiles table
   */
  signUp: async (email, password, metadata = {}) => {
    try {
      const firstName =
        String(metadata?.first_name || metadata?.prenom || metadata?.given_name || '')?.trim() || null;
      const lastName =
        String(metadata?.last_name || metadata?.nom || metadata?.family_name || '')?.trim() || null;

      // Étape 1 : créer l'utilisateur d'authentification
      const { data: authData, error: authError } = await supabase?.auth?.signUp({
        email,
        password,
        options: {
          data: metadata, // Will be stored in auth.users.raw_user_meta_data
          emailRedirectTo: buildAppRedirectUrl('/auth/retour')
        }
      });

      if (authError) {
        if (isSchemaError(authError)) {
          console.error('Erreur de schéma dans signUp:', authError?.message);
          throw authError;
        }
        return {
          data: null,
          error: localizeAuthError(authError, "Impossible de créer le compte pour le moment.")
        };
      }

      // Étape 2 : créer le profil dans la table profiles
      if (authData?.user) {
        const baseProfilePayload = {
          id: authData?.user?.id,
          pseudo: metadata?.pseudo || metadata?.pseudonym || email?.split('@')?.[0],
          email: email,
          phone: metadata?.phone || null,
          address: metadata?.address || metadata?.postal_address || metadata?.adresse || null,
          city: metadata?.city || metadata?.ville || null,
          postal_code: metadata?.postal_code || metadata?.code_postal || null,
          first_name: firstName,
          last_name: lastName,
          created_at: new Date()?.toISOString(),
          updated_at: new Date()?.toISOString()
        };

        let { error: profileError } = await supabase?.from('profiles')?.insert(baseProfilePayload);

        if (
          profileError &&
          isSchemaError(profileError) &&
          /column.*(first_name|last_name).*does not exist/i.test(String(profileError?.message || ''))
        ) {
          const { first_name, last_name, ...legacyCompatiblePayload } = baseProfilePayload;
          ({ error: profileError } = await supabase?.from('profiles')?.insert(legacyCompatiblePayload));
        }

        if (profileError && profileError?.code !== '23505') { // Ignorer l'erreur de clé dupliquée
          console.error('Erreur de création du profil :', profileError);
          // Ne pas faire échouer l'inscription si la création du profil échoue - il pourra être créé plus tard
        }
      }

      return { data: authData, error: null };
    } catch (error) {
      console.error("Erreur d'inscription :", error);
      throw error;
    }
  },

  /**
   * Connexion avec e-mail et mot de passe
   */
  signIn: async (email, password) => {
    try {
      const { data, error } = await supabase?.auth?.signInWithPassword({
        email,
        password
      });

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans signIn:', error?.message);
          throw error;
        }
        return {
          data: null,
          error: localizeAuthError(error, 'Connexion impossible. Merci de réessayer.')
        };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Erreur de connexion :', error);
      throw error;
    }
  },

  /**
   * Déconnecter l'utilisateur courant
   */
  signOut: async () => {
    try {
      const { error } = await supabase?.auth?.signOut();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans signOut:', error?.message);
          throw error;
        }
        return {
          error: localizeAuthError(error, 'Déconnexion impossible. Merci de réessayer.')
        };
      }

      return { error: null };
    } catch (error) {
      console.error('Erreur de déconnexion :', error);
      throw error;
    }
  },

  /**
   * Supprimer le compte courant (via edge function server-side)
   */
  deleteCurrentAccount: async () => {
    try {
      const { data, error } = await supabase?.functions?.invoke('delete-account', {
        body: {}
      });

      if (error) {
        let serverCode = null;
        let serverMessage = null;

        try {
          const response = error?.context;
          if (response && typeof response?.clone === 'function') {
            const payload = await response.clone().json();
            serverCode = payload?.code || null;
            serverMessage = payload?.error || null;
          }
        } catch (_parseError) {
          // Ignore parse errors and fallback to generic Supabase function error message.
        }

        return {
          data: null,
          error: {
            ...(localizeAuthError(error, 'Impossible de supprimer le compte pour le moment.') || {}),
            ...(serverCode ? { code: serverCode } : {}),
            ...(serverMessage ? { message: serverMessage } : {})
          }
        };
      }

      if (data?.error) {
        return {
          data: null,
          error: {
            code: data?.code || null,
            message: String(data?.error || 'Suppression du compte impossible.')
          }
        };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Erreur de suppression de compte :', error);
      return {
        data: null,
        error: { message: 'Erreur reseau lors de la suppression du compte.' }
      };
    }
  },

  /**
   * Récupérer la session courante
   */
  getSession: async () => {
    try {
      const { data, error } = await supabase?.auth?.getSession();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getSession:', error?.message);
          throw error;
        }
        return {
          data: null,
          error: localizeAuthError(error, 'Impossible de vérifier votre session.')
        };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Erreur lors de la récupération de session :', error);
      throw error;
    }
  },

  /**
   * Récupérer l'utilisateur authentifié courant
   */
  getCurrentUser: async () => {
    try {
      const { data: { user }, error } = await supabase?.auth?.getUser();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getCurrentUser:', error?.message);
          throw error;
        }
        return {
          user: null,
          error: localizeAuthError(error, "Impossible d'identifier l'utilisateur.")
        };
      }

      return { user, error: null };
    } catch (error) {
      console.error("Erreur lors de la récupération de l'utilisateur courant :", error);
      throw error;
    }
  },

  /**
   * Réinitialiser le mot de passe - envoie un e-mail de réinitialisation
   */
  resetPassword: async (email) => {
    try {
      const { data, error } = await supabase?.auth?.resetPasswordForEmail(email, {
        redirectTo: buildAppRedirectUrl('/reinitialiser-mot-de-passe')
      });

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans resetPassword:', error?.message);
          throw error;
        }
        return {
          data: null,
          error: localizeAuthError(error, "Impossible d'envoyer l'e-mail de réinitialisation.")
        };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Erreur de réinitialisation du mot de passe :', error);
      throw error;
    }
  },

  /**
   * Update password (when user is logged in)
   */
  updatePassword: async (newPassword) => {
    try {
      const { data, error } = await supabase?.auth?.updateUser({
        password: newPassword
      });

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans updatePassword:', error?.message);
          throw error;
        }
        return {
          data: null,
          error: localizeAuthError(error, 'Impossible de modifier le mot de passe.')
        };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Erreur de mise à jour du mot de passe :', error);
      throw error;
    }
  },

  /**
   * Mettre à jour les métadonnées utilisateur
   */
  updateUserMetadata: async (metadata) => {
    try {
      const { data, error } = await supabase?.auth?.updateUser({
        data: metadata
      });

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans updateUserMetadata:', error?.message);
          throw error;
        }
        return {
          data: null,
          error: localizeAuthError(error, 'Impossible de mettre à jour les informations du compte.')
        };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Erreur de mise à jour des métadonnées utilisateur :', error);
      throw error;
    }
  },

  /**
   * Écouter les changements d'état d'authentification
   */
  onAuthStateChange: (callback) => {
    const { data: { subscription } } = supabase?.auth?.onAuthStateChange(callback);
    return subscription;
  },

  /**
   * Retourne les fournisseurs OAuth actives cote Supabase
   */
  getEnabledOAuthProviders: async () => {
    const { data, error } = await fetchAuthSettings();

    if (error || !data) {
      return {
        data: null,
        error: error || { message: 'Impossible de recuperer les fournisseurs OAuth.' }
      };
    }

    const external = data?.external || {};
    return {
      data: {
        google: Boolean(external?.google),
        facebook: Boolean(external?.facebook),
        apple: Boolean(external?.apple)
      },
      error: null
    };
  },

  /**
   * Connexion via un fournisseur OAuth (Google, Facebook, etc.)
   */
  signInWithOAuth: async (provider) => {
    try {
      if (provider === 'apple' && isNativeIOSApp()) {
        return await signInWithAppleNatively();
      }

      const redirectTo = buildAppRedirectUrl('/auth/retour');
      const { data, error } = await supabase?.auth?.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true
        }
      });

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans signInWithOAuth:', error?.message);
          throw error;
        }
        return {
          data: null,
          error: localizeAuthError(error, "Connexion avec ce fournisseur impossible.")
        };
      }

      if (!data?.url) {
        return {
          data: null,
          error: { message: "Aucune URL de redirection n'a ete fournie par le fournisseur." }
        };
      }

      await redirectToExternalUrl(data.url);
      return { data, error: null };
    } catch (error) {
      console.error('Erreur de connexion OAuth :', error);
      throw error;
    }
  }
};

export default authService;




