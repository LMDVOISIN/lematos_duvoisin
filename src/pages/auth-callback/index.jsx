import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabase';
import Icon from '../../components/AppIcon';
import { ActionCard } from '../../components/page/ActionPageLayout';
import { consumeAuthRedirectPath } from '../../utils/authRedirect';
import { isAdminVerificationScenario } from '../../utils/adminVerificationContext';

const CALLBACK_STATES = {
  chargement: {
    title: 'Connexion en cours',
    description: 'On termine la connexion et on vous remet sur la bonne page.',
    icon: 'Loader2',
    iconClassName: 'animate-spin',
    tone: 'sky'
  },
  succes: {
    title: 'Connexion reussie',
    description: 'Redirection en cours...',
    icon: 'CheckCircle',
    iconClassName: '',
    tone: 'emerald'
  },
  erreur: {
    title: "Erreur d'authentification",
    description: 'Retour vers la page de connexion...',
    icon: 'XCircle',
    iconClassName: '',
    tone: 'rose'
  }
};

const CALLBACK_TONE_STYLES = {
  sky: {
    wrapper: 'border-sky-200 bg-sky-50/85',
    badge: 'bg-white text-sky-700',
    icon: 'bg-white text-sky-700'
  },
  emerald: {
    wrapper: 'border-emerald-200 bg-emerald-50/85',
    badge: 'bg-white text-emerald-700',
    icon: 'bg-white text-emerald-700'
  },
  rose: {
    wrapper: 'border-rose-200 bg-rose-50/85',
    badge: 'bg-white text-rose-700',
    icon: 'bg-white text-rose-700'
  }
};

const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('chargement');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        if (isAdminVerificationScenario('account_oauth_callback')) {
          setStatus('succes');
          setErrorMessage('');
          return;
        }

        const hashParams = new URLSearchParams(window.location.hash?.replace(/^#/, ''));
        const flowType = hashParams?.get('type');
        if (flowType === 'recovery') {
          navigate(`/reinitialiser-mot-de-passe${window.location.hash || ''}`, { replace: true });
          return;
        }

        const { data: { session }, error } = await supabase?.auth?.getSession();

        if (error) {
          console.error('Erreur de rappel OAuth :', error);
          setStatus('erreur');
          setErrorMessage(error?.message || "Erreur lors de l'authentification");

          setTimeout(() => {
            navigate('/authentification');
          }, 3000);
          return;
        }

        if (session) {
          setStatus('succes');

          setTimeout(() => {
            const redirectAfterAuth = consumeAuthRedirectPath('/accueil-recherche');
            navigate(redirectAfterAuth, { replace: true });
          }, 1500);
        } else {
          setStatus('erreur');
          setErrorMessage('Aucune session trouvee');

          setTimeout(() => {
            navigate('/authentification');
          }, 3000);
        }
      } catch (err) {
        console.error('Erreur inattendue dans le retour OAuth :', err);
        setStatus('erreur');
        setErrorMessage('Une erreur inattendue est survenue');

        setTimeout(() => {
          navigate('/authentification');
        }, 3000);
      }
    };

    handleOAuthCallback();
  }, [navigate]);

  const statusMeta = CALLBACK_STATES?.[status] || CALLBACK_STATES.chargement;
  const toneStyles = CALLBACK_TONE_STYLES?.[statusMeta?.tone] || CALLBACK_TONE_STYLES.sky;
  const message =
    status === 'succes' && isAdminVerificationScenario('account_oauth_callback')
      ? 'Callback OAuth verifie en mode admin.'
      : status === 'erreur'
      ? errorMessage
      : statusMeta?.description;

  return (
    <>
      <Helmet>
        <title>Authentification en cours - Le Matos Du Voisin</title>
      </Helmet>

      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#eef8ff_0%,#f7fbff_100%)] px-4 py-8">
        <div className="w-full max-w-4xl">
          <ActionCard className="overflow-hidden rounded-[32px] border-white/80 bg-white/94 p-0">
            <div className="grid gap-0 md:grid-cols-[minmax(0,0.95fr)_minmax(320px,420px)]">
              <div className="bg-[linear-gradient(135deg,rgba(255,249,226,0.95),rgba(237,250,255,0.92))] p-6 md:p-8">
                <div className="inline-flex rounded-full border border-white/70 bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#0f7081]">
                  Authentification
                </div>
                <div className="mt-6 space-y-3">
                  <h1 className="text-2xl font-semibold leading-tight text-slate-950 md:text-4xl">
                    On verifie votre connexion puis on vous remet sur les rails
                  </h1>
                  <p className="max-w-md text-sm text-slate-600 md:text-base">
                    Rien a lire ici: on finalise la connexion, puis on vous redirige.
                  </p>
                </div>

                <div className="mt-6 hidden gap-3 md:grid md:grid-cols-1">
                  {[
                    ['1. Verifier', 'Session'],
                    ['2. Valider', 'Connexion'],
                    ['3. Repartir', 'Bonne page']
                  ]?.map(([title, helper]) => (
                    <div key={title} className="rounded-3xl border border-white/80 bg-white/88 p-4 shadow-sm">
                      <p className="text-sm font-semibold text-slate-950">{title}</p>
                      <p className="mt-1 text-sm text-slate-600">{helper}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 md:p-8">
                <div className={`rounded-[28px] border p-5 ${toneStyles?.wrapper}`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm ${toneStyles?.icon}`}>
                      <Icon name={statusMeta?.icon} size={28} className={statusMeta?.iconClassName} />
                    </div>
                    <div>
                      <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${toneStyles?.badge}`}>
                        Etat
                      </div>
                      <h2 className="mt-2 text-2xl font-semibold text-slate-950">{statusMeta?.title}</h2>
                    </div>
                  </div>

                  <p className="mt-4 text-sm text-slate-700">{message}</p>

                  {status === 'erreur' ? (
                    <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                      Redirection vers la connexion...
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </ActionCard>
        </div>
      </div>
    </>
  );
};

export default AuthCallback;
