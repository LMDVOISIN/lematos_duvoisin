import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import { ActionCard } from '../../components/page/ActionPageLayout';
import { supabase } from '../../lib/supabase';
import { translateAuthErrorMessage } from '../../utils/translateAuthErrorMessage';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [initializing, setInitializing] = useState(true);
  const [recoveryValid, setRecoveryValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const validateRecoverySession = async () => {
      try {
        const hashParams = new URLSearchParams(window.location.hash?.replace(/^#/, ''));
        const hashError = hashParams?.get('error_description') || hashParams?.get('error');

        if (hashError) {
          if (isMounted) {
            setError(
              translateAuthErrorMessage(
                decodeURIComponent(hashError),
                'Lien invalide ou expire. Merci de refaire une demande.'
              )
            );
            setRecoveryValid(false);
            setInitializing(false);
          }
          return;
        }

        const { data: { session }, error: sessionError } = await supabase?.auth?.getSession();

        if (sessionError) {
          if (isMounted) {
            setError(
              translateAuthErrorMessage(
                sessionError?.message,
                'Impossible de valider le lien de reinitialisation.'
              )
            );
            setRecoveryValid(false);
            setInitializing(false);
          }
          return;
        }

        if (!session) {
          if (isMounted) {
            setError('Lien invalide ou expire. Merci de refaire une demande.');
            setRecoveryValid(false);
            setInitializing(false);
          }
          return;
        }

        if (isMounted) {
          setRecoveryValid(true);
          setInitializing(false);
        }
      } catch (err) {
        if (isMounted) {
          setError('Erreur inattendue lors de la validation du lien.');
          setRecoveryValid(false);
          setInitializing(false);
        }
      }
    };

    validateRecoverySession();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');

    if (!password || password?.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setSubmitting(true);

    try {
      const { error: updateError } = await supabase?.auth?.updateUser({ password });
      if (updateError) {
        setError(
          translateAuthErrorMessage(
            updateError?.message,
            'Impossible de mettre a jour le mot de passe.'
          )
        );
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      setSubmitting(false);
      setTimeout(() => {
        navigate('/authentification', { replace: true });
      }, 1600);
    } catch (err) {
      setError('Erreur inattendue lors de la mise a jour du mot de passe.');
      setSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Reinitialiser le mot de passe - Le Matos Du Voisin</title>
      </Helmet>

      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#eef8ff_0%,#f7fbff_100%)] px-4 py-8">
        <div className="w-full max-w-3xl">
          <ActionCard className="overflow-hidden rounded-[32px] border-white/80 bg-white/94 p-0">
            <div className="grid gap-0 md:grid-cols-[minmax(0,0.95fr)_minmax(320px,420px)]">
              <div className="bg-[linear-gradient(135deg,rgba(255,249,226,0.95),rgba(237,250,255,0.92))] p-6 md:p-8">
                <Link to="/authentification" className="inline-flex items-center gap-3 rounded-full border border-white/70 bg-white/85 px-4 py-2 shadow-sm">
                  <img
                    src="/assets/images/android-chrome-192x192-1771179342850.png"
                    alt="Logo Le Matos Du Voisin"
                    className="h-10 w-10 object-contain"
                  />
                  <span className="text-sm font-semibold text-slate-950">Le Matos Du Voisin</span>
                </Link>

                <div className="mt-6 space-y-3">
                  <div className="inline-flex rounded-full border border-white/70 bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#0f7081]">
                    Nouveau mot de passe
                  </div>
                  <h1 className="text-3xl font-semibold leading-tight text-slate-950 md:text-4xl">
                    Une seule chose a faire: choisir un nouveau mot de passe
                  </h1>
                  <p className="max-w-md text-sm text-slate-600 md:text-base">
                    Verifiez le lien, entrez le nouveau mot de passe, puis retour a la connexion.
                  </p>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3 md:grid-cols-1">
                  {[
                    ['1. Ouvrir', 'Lien valide'],
                    ['2. Choisir', 'Nouveau mot de passe'],
                    ['3. Revenir', 'Connexion']
                  ]?.map(([title, helper]) => (
                    <div key={title} className="rounded-3xl border border-white/80 bg-white/88 p-4 shadow-sm">
                      <p className="text-sm font-semibold text-slate-950">{title}</p>
                      <p className="mt-1 text-sm text-slate-600">{helper}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 md:p-8">
                {initializing ? (
                  <div className="py-10 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                      <Icon name="Loader2" size={24} className="animate-spin" />
                    </div>
                    <p className="text-base font-semibold text-slate-950">Verification du lien</p>
                    <p className="mt-1 text-sm text-slate-600">Un instant...</p>
                  </div>
                ) : null}

                {!initializing && success ? (
                  <div className="py-8 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                      <Icon name="CheckCircle" size={28} />
                    </div>
                    <p className="text-base font-semibold text-slate-950">Mot de passe mis a jour</p>
                    <p className="mt-1 text-sm text-slate-600">Redirection vers la connexion...</p>
                  </div>
                ) : null}

                {!initializing && !success && !recoveryValid ? (
                  <div className="space-y-4 py-4">
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4">
                      <p className="text-sm font-medium text-rose-800">{error}</p>
                    </div>
                    <Button variant="default" fullWidth onClick={() => navigate('/authentification')}>
                      Retour a la connexion
                    </Button>
                  </div>
                ) : null}

                {!initializing && !success && recoveryValid ? (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Action</p>
                      <h2 className="mt-1 text-2xl font-semibold text-slate-950">Choisir un nouveau mot de passe</h2>
                    </div>

                    <Input
                      label="Nouveau mot de passe"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e?.target?.value)}
                      placeholder="Minimum 8 caracteres"
                      required
                    />

                    <Input
                      label="Confirmer le mot de passe"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e?.target?.value)}
                      placeholder="Retapez le mot de passe"
                      required
                    />

                    {error ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4">
                        <p className="text-sm font-medium text-rose-800">{error}</p>
                      </div>
                    ) : null}

                    <Button
                      type="submit"
                      variant="default"
                      fullWidth
                      loading={submitting}
                      iconName="Lock"
                      iconPosition="right"
                    >
                      Mettre a jour le mot de passe
                    </Button>

                    <div className="text-center">
                      <Link to="/authentification" className="text-sm text-primary hover:underline">
                        Retour a la connexion
                      </Link>
                    </div>
                  </form>
                ) : null}
              </div>
            </div>
          </ActionCard>
        </div>
      </div>
    </>
  );
};

export default ResetPassword;
