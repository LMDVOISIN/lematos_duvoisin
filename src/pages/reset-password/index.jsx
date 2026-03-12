import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
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
                'Lien invalide ou expiré. Merci de refaire une demande.'
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
                'Impossible de valider le lien de réinitialisation.'
              )
            );
            setRecoveryValid(false);
            setInitializing(false);
          }
          return;
        }

        if (!session) {
          if (isMounted) {
            setError('Lien invalide ou expiré. Merci de refaire une demande.');
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
      setError('Le mot de passe doit contenir au moins 8 caractères.');
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
            'Impossible de mettre à jour le mot de passe.'
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
      setError('Erreur inattendue lors de la mise à jour du mot de passe.');
      setSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Réinitialiser le mot de passe - Le Matos Du Voisin</title>
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-[#e9f4ff] via-[#f2f8ff] to-[#e7f5ff] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card rounded-xl shadow-elevation-3 border border-border p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <img
              src="/assets/images/android-chrome-192x192-1771179342850.png"
              alt="Le Matos Du Voisin"
              className="w-10 h-10 object-contain"
            />
            <h1 className="text-xl font-semibold text-foreground">Nouveau mot de passe</h1>
          </div>

          {initializing && (
            <div className="text-center py-8">
              <Icon name="Loader2" size={28} className="animate-spin mx-auto text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Validation du lien en cours...</p>
            </div>
          )}

          {!initializing && success && (
            <div className="text-center py-6">
              <Icon name="CheckCircle" size={34} className="mx-auto text-success mb-3" />
              <p className="font-medium text-foreground mb-1">Mot de passe mis à jour</p>
              <p className="text-sm text-muted-foreground">Redirection vers la connexion...</p>
            </div>
          )}

          {!initializing && !success && !recoveryValid && (
            <div className="space-y-4">
              <p className="text-sm text-error">{error}</p>
              <Button
                variant="default"
                fullWidth
                onClick={() => navigate('/authentification')}
              >
                Retour à la connexion
              </Button>
            </div>
          )}

          {!initializing && !success && recoveryValid && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Saisissez votre nouveau mot de passe.
              </p>

              <Input
                label="Nouveau mot de passe"
                type="password"
                value={password}
                onChange={(e) => setPassword(e?.target?.value)}
                placeholder="Minimum 8 caractères"
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

              {error && <p className="text-sm text-error">{error}</p>}

              <Button
                type="submit"
                variant="default"
                fullWidth
                loading={submitting}
                iconName="Lock"
                iconPosition="right"
              >
                Mettre à jour le mot de passe
              </Button>

              <div className="text-center">
                <Link to="/authentification" className="text-sm text-primary hover:underline">
                  Retour à la connexion
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

export default ResetPassword;
