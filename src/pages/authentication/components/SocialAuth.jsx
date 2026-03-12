import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import authService from '../../../services/authService';
import {
  clearAuthRedirectPath,
  resolveAuthRedirectPath,
  storeAuthRedirectPath
} from '../../../utils/authRedirect';

const SocialAuth = () => {
  const location = useLocation();
  const [loading, setLoading] = useState({ google: false, facebook: false });
  const [error, setError] = useState(null);
  const [enabledProviders, setEnabledProviders] = useState({ google: true, facebook: true });

  useEffect(() => {
    let isMounted = true;

    const loadEnabledProviders = async () => {
      const { data, error: providersError } = await authService?.getEnabledOAuthProviders();
      if (!isMounted || providersError || !data) return;
      setEnabledProviders(data);
    };

    loadEnabledProviders();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSocialLogin = async (provider) => {
    const normalizedProvider = provider?.toLowerCase();

    if (!enabledProviders?.[normalizedProvider]) {
      setError(`${provider} n'est pas active dans Supabase.`);
      return;
    }

    setError(null);
    setLoading((prev) => ({ ...prev, [normalizedProvider]: true }));

    try {
      const redirectAfterAuth = resolveAuthRedirectPath(location, '/accueil-recherche');
      storeAuthRedirectPath(redirectAfterAuth);

      const { error: oauthError } = await authService?.signInWithOAuth(normalizedProvider);

      if (oauthError) {
        clearAuthRedirectPath();
        console.error(`Erreur de connexion ${provider}:`, oauthError);
        if (oauthError?.message?.toLowerCase()?.includes('unsupported provider')) {
          setError(
            `${provider} n'est pas active dans Supabase. Activez ce fournisseur dans Authentication > Providers.`
          );
        } else {
          setError(`Impossible de se connecter avec ${provider}. Verifiez la configuration du fournisseur.`);
        }
        setLoading((prev) => ({ ...prev, [normalizedProvider]: false }));
      }
      // If successful, user will be redirected to OAuth provider
      // After authorization, they'll be redirected back to /auth/retour
    } catch (err) {
      clearAuthRedirectPath();
      console.error(`Erreur OAuth ${provider}:`, err);
      setError(`Une erreur est survenue lors de la connexion avec ${provider}.`);
      setLoading((prev) => ({ ...prev, [normalizedProvider]: false }));
    }
  };

  const hasSocialProviders = enabledProviders?.google || enabledProviders?.facebook;

  return (
    <div className="space-y-3 md:space-y-4">
      {hasSocialProviders && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-card text-muted-foreground">ou</span>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {hasSocialProviders ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {enabledProviders?.google && (
              <Button
                variant="outline"
                size="default"
                onClick={() => handleSocialLogin('google')}
                loading={loading?.google}
                disabled={loading?.google || loading?.facebook}
                iconName="Mail"
                iconPosition="left"
                className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                Se connecter avec Google
              </Button>
            )}

            {enabledProviders?.facebook && (
              <Button
                variant="outline"
                size="default"
                onClick={() => handleSocialLogin('facebook')}
                loading={loading?.facebook}
                disabled={loading?.google || loading?.facebook}
                iconName="Facebook"
                iconPosition="left"
                className="border-[#1877F2] bg-[#1877F2] text-white hover:bg-[#166FE5]"
              >
                Se connecter avec Facebook
              </Button>
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            En vous connectant avec un reseau social, un profil sera automatiquement cree.
          </p>
        </>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          Connexion sociale indisponible pour le moment.
        </p>
      )}
    </div>
  );
};

export default SocialAuth;
