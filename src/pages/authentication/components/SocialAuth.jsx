import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
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

const AppleLogo = ({ className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M16.365 12.449c.023 2.432 2.136 3.24 2.16 3.25-.018.057-.338 1.151-1.111 2.283-.668.976-1.361 1.948-2.452 1.968-1.073.02-1.417-.636-2.643-.636-1.226 0-1.609.616-2.624.656-1.053.039-1.855-1.056-2.529-2.028-1.377-1.991-2.43-5.63-1.015-8.086.702-1.219 1.957-1.99 3.32-2.01 1.033-.02 2.008.693 2.64.693.632 0 1.819-.857 3.064-.732.522.022 1.986.211 2.926 1.585-.076.047-1.754 1.025-1.736 3.057Z"
      fill="currentColor"
    />
    <path
      d="M14.36 6.501c.56-.677.938-1.619.835-2.56-.806.033-1.781.538-2.359 1.214-.519.603-.973 1.564-.852 2.486.899.069 1.818-.463 2.376-1.14Z"
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
  },
  apple: {
    label: 'Apple',
    className: 'border-slate-950 bg-slate-950 text-white hover:bg-black',
    logoWrapperClassName: 'bg-white/12 text-white',
    logoClassName: 'h-5 w-5'
  }
};

const renderProviderLogo = (provider, className) => {
  switch (provider) {
    case 'google':
      return <GoogleLogo className={className} />;
    case 'facebook':
      return <FacebookLogo className={className} />;
    case 'apple':
      return <AppleLogo className={className} />;
    default:
      return null;
  }
};

const SocialAuth = () => {
  const location = useLocation();
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
    <div className="space-y-3 md:space-y-4">
      {hasSocialProviders && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="rounded-full border border-slate-200 bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              ou continuer avec
            </span>
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
          <div className="space-y-3 rounded-[22px] border border-slate-200/80 bg-white/82 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
            {isAppleEnabled ? (
              <div className="space-y-2">
                <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Option équivalente requise
                </p>
                <button
                  type="button"
                  onClick={() => handleSocialLogin('apple')}
                  disabled={isAnyProviderLoading}
                  data-testid="auth-social-apple-primary"
                  className={`group relative flex min-h-[58px] w-full items-center justify-center gap-3 rounded-2xl border px-4 py-3 text-center shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 ${SOCIAL_PROVIDER_CONFIG?.apple?.className || ''}`}
                  aria-label="Se connecter avec Apple"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${SOCIAL_PROVIDER_CONFIG?.apple?.logoWrapperClassName || ''}`}
                  >
                    {renderProviderLogo('apple', SOCIAL_PROVIDER_CONFIG?.apple?.logoClassName)}
                  </span>

                  <span className="min-w-0 text-sm font-semibold leading-5 sm:text-[15px]">
                    Continuer avec Apple
                  </span>

                  {loading?.apple ? (
                    <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-white/18">
                      <Icon name="Loader2" size={12} className="animate-spin" />
                    </span>
                  ) : null}
                </button>
              </div>
            ) : null}

            {secondaryProviders?.length > 0 ? (
              <div className="space-y-2">
                <p className="text-center text-xs text-slate-500">
                  Apple permet de partager uniquement le nom et l'e-mail, avec masquage possible.
                </p>
                <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Autres connexions
                </p>
                <div className={`grid gap-2 ${secondaryProviders?.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
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
          <p className="text-center text-xs text-muted-foreground">
            Connexion rapide avec votre compte existant. Apple est affiché en premier comme option équivalente.
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
