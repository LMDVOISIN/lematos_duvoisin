import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '../../lib/supabase';
import Icon from '../../components/AppIcon';
import { consumeAuthRedirectPath } from '../../utils/authRedirect';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('chargement'); // chargement, succes, erreur
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        const hashParams = new URLSearchParams(window.location.hash?.replace(/^#/, ''));
        const flowType = hashParams?.get('type');
        if (flowType === 'recovery') {
          navigate(`/reinitialiser-mot-de-passe${window.location.hash || ''}`, { replace: true });
          return;
        }

        // Recuperer la session depuis l'URL
        const { data: { session }, error } = await supabase?.auth?.getSession();

        if (error) {
          console.error('Erreur de rappel OAuth :', error);
          setStatus('erreur');
          setErrorMessage(error?.message || 'Erreur lors de l\'authentification');
          
          // Redirection vers la page d'authentification apr?s 3 secondes
          setTimeout(() => {
            navigate('/authentification');
          }, 3000);
          return;
        }

        if (session) {
          setStatus('succes');
          
          // Attendre un instant pour afficher le succes, puis rediriger
          setTimeout(() => {
            const redirectAfterAuth = consumeAuthRedirectPath('/accueil-recherche');
            navigate(redirectAfterAuth, { replace: true });
          }, 1500);
        } else {
          setStatus('erreur');
          setErrorMessage('Aucune session trouvée');
          
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

  return (
    <>
      <Helmet>
        <title>Authentification en cours - Le Matos Du Voisin</title>
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-[#e9f4ff] via-[#f2f8ff] to-[#e7f5ff] flex items-center justify-center p-4">
        <div className="bg-card rounded-xl shadow-elevation-3 border border-border p-8 max-w-md w-full text-center">
          {status === 'chargement' && (
            <>
              <div className="flex justify-center mb-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Authentification en cours...
              </h2>
              <p className="text-sm text-muted-foreground">
                Veuillez patienter pendant que nous finalisons votre connexion
              </p>
            </>
          )}

          {status === 'succes' && (
            <>
              <div className="flex justify-center mb-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-success/10">
                  <Icon name="CheckCircle" size={32} color="var(--color-success)" />
                </div>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Connexion réussie !
              </h2>
              <p className="text-sm text-muted-foreground">
                Redirection en cours...
              </p>
            </>
          )}

          {status === 'erreur' && (
            <>
              <div className="flex justify-center mb-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10">
                  <Icon name="XCircle" size={32} color="var(--color-destructive)" />
                </div>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Erreur d'authentification
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                {errorMessage}
              </p>
              <p className="text-xs text-muted-foreground">
                Redirection vers la page de connexion...
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default AuthCallback;
