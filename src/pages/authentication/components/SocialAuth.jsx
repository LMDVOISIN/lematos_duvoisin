import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import authService from '../../../services/authService';
import {
  clearAuthRedirectPath,
  resolveAuthRedirectPath,
  storeAuthRedirectPath
} from '../../../utils/authRedirect';

const INITIAL_LOADING_STATE = {
  google: false,
  facebook: false,
  apple: false
};

const INITIAL_PROVIDER_STATE = {
  google: true,
  facebook: true,
  apple: true
};

const GoogleLogo = ({ className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M21.805 12.23c0-.76-.068-1.49-.195-2.19H12v4.145h5.49a4.696 4.696 0 0 1-2.04 3.083v2.56h3.3c1.932-1.778 3.055-4.397 3.055-7.598Z"
      fill="#4285F4"
    />
    <path
      d="M12 22c2.76 0 5.074-.915 6.765-2.472l-3.3-2.56c-.915.615-2.085.98-3.465.98-2.66 0-4.914-1.798-5.72-4.215H2.865v2.64A10.205 10.205 0 0 0 12 22Z"
      fill="#34A853"
    />
    <path
      d="M6.28 13.733A6.13 6.13 0 0 1 5.96 11.9c0-.636.11-1.254.32-1.833V7.427H2.865A10.2 10.2 0 0 0 1.8 11.9c0 1.64.393 3.193 1.065 4.473l3.415-2.64Z"
      fill="#FBBC04"
    />
    <path
      d="M12 5.852c1.5 0 2.848.517 3.908 1.533l2.93-2.93C17.07 2.815 14.756 1.8 12 1.8a10.205 10.205 0 0 0-9.135 5.627l3.415 2.64C7.086 7.65 9.34 5.852 12 5.852Z"
      fill="#EA4335"
    />
  </svg>
);

const FacebookLogo = ({ className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.026 4.388 11.02 10.125 11.927v-8.437H7.078v-3.49h3.047V9.41c0-3.022 1.792-4.69 4.533-4.69 1.313 0 2.686.236 2.686.236v2.967h-1.514c-1.49 0-1.955.93-1.955 1.885v2.265h3.328l-.532 3.49h-2.796V24C19.612 23.093 24 18.1 24 12.073Z"
      fill="currentColor"
    />
  </svg>
);

const SOCIAL_PROVIDER_CONFIG = {
  google: {
    label: 'Google',
    className: 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
    logoWrapperClassName: 'bg-white text-slate-900',
    logoClassName: 'h-5 w-5'
  },
  facebook: {
    label: 'Facebook',
    className: 'border-[#cfe0ff] bg-[#f4f8ff] text-[#1664d9] hover:bg-[#ebf3ff]',
    logoWrapperClassName: 'bg-[#1877F2] text-white',
    logoClassName: 'h-5 w-5'
  }
};

const renderProviderLogo = (provider, className) => {
  switch (provider) {
    case 'google':
      return <GoogleLogo className={className} />;
    case 'facebook':
      return <FacebookLogo className={className} />;
    default:
      return null;
  }
};

const SocialAuth = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(INITIAL_LOADING_STATE);
  const [error, setError] = useState(null);
  const [enabledProviders, setEnabledProviders] = useState(INITIAL_PROVIDER_STATE);

  useEffect(() => {
    let isMounted = true;

    const loadEnabledProviders = async () => {
      const { data, error: providersError } = await authService?.getEnabledOAuthProviders();
      if (!isMounted) return;
      if (providersError || !data) {
        console.warn('Impossible de verifier les fournisseurs OAuth, utilisation du fallback local.', providersError);
        return;
      }
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

      const { data, error: oauthError } = await authService?.signInWithOAuth(normalizedProvider);

      if (oauthError) {
        clearAuthRedirectPath();
        console.error(`Erreur de connexion ${provider}:`, oauthError);
        if (oauthError?.message?.toLowerCase()?.includes('unsupported provider')) {
          setError(
            `${provider} n'est pas active dans Supabase. Activez ce fournisseur dans Authentication > Providers.`
          );
        } else {
          setError(
            oauthError?.message
            || `Impossible de se connecter avec ${provider}. Verifiez la configuration du fournisseur.`
          );
        }
        setLoading((prev) => ({ ...prev, [normalizedProvider]: false }));
        return;
      }

      if (data?.completedInApp) {
        clearAuthRedirectPath();
        setLoading((prev) => ({ ...prev, [normalizedProvider]: false }));
        navigate(redirectAfterAuth, { replace: true });
      }
    } catch (err) {
      clearAuthRedirectPath();
      console.error(`Erreur OAuth ${provider}:`, err);
      setError(`Une erreur est survenue lors de la connexion avec ${provider}.`);
      setLoading((prev) => ({ ...prev, [normalizedProvider]: false }));
    }
  };

  const hasSocialProviders =
    enabledProviders?.google || enabledProviders?.facebook || enabledProviders?.apple;
  const isAnyProviderLoading = Object.values(loading || {})?.some(Boolean);
  const secondaryProviders = ['google', 'facebook']?.filter((provider) => enabledProviders?.[provider]);
  const isAppleEnabled = Boolean(enabledProviders?.apple);

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {hasSocialProviders ? (
        <>
          <div className="space-y-4 rounded-[22px] border border-slate-200/80 bg-white/82 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
            {isAppleEnabled ? (
              <div className="space-y-2.5">
                <p className="hidden text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:block">
                  Sign in with Apple
                </p>
                <button
                  type="button"
                  onClick={() => handleSocialLogin('apple')}
                  disabled={isAnyProviderLoading}
                  data-testid="auth-social-apple-primary"
                  className="group relative mx-auto flex min-h-[58px] w-full max-w-[360px] items-center justify-center gap-3 rounded-2xl border border-black bg-black px-5 py-4 text-[15px] font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-900 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                  aria-label="Sign in with Apple"
                >
                  <Icon name="BrandApple" size={19} className="text-white" />
                  <span>Continuer avec Apple</span>

                  {loading?.apple ? (
                    <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/72">
                      <Icon name="Loader2" size={16} className="animate-spin text-white" />
                    </span>
                  ) : null}
                </button>
                <p className="text-center text-xs text-slate-500 sm:text-[13px]">
                  Nom, e-mail et option Masquer mon e-mail avec Apple.
                </p>
              </div>
            ) : null}

            {secondaryProviders?.length > 0 ? (
              <div className="space-y-2">
                <p className="hidden text-center text-xs text-slate-500 sm:block">
                  Vous pouvez aussi utiliser Google ou Facebook si vous preferez.
                </p>
                <p className="hidden text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:block">
                  Autres connexions
                </p>
                <div className={`grid gap-2 ${secondaryProviders?.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                  {secondaryProviders?.map((provider) => {
                    const providerConfig = SOCIAL_PROVIDER_CONFIG?.[provider] || {};
                    const isLoading = Boolean(loading?.[provider]);

                    return (
                      <button
                        key={provider}
                        type="button"
                        onClick={() => handleSocialLogin(provider)}
                        disabled={isAnyProviderLoading}
                        data-testid={`auth-social-${provider}`}
                        className={`group relative flex min-h-[58px] w-full items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 ${providerConfig?.className || ''}`}
                        aria-label={`Se connecter avec ${providerConfig?.label || provider}`}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${providerConfig?.logoWrapperClassName || ''}`}
                        >
                          {renderProviderLogo(provider, providerConfig?.logoClassName)}
                        </span>

                        <span className="min-w-0">
                          <span className="block text-[11px] font-semibold leading-4 sm:text-xs">
                            {providerConfig?.label}
                          </span>
                        </span>

                        {isLoading ? (
                          <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white/18">
                            <Icon name="Loader2" size={12} className="animate-spin" />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
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
