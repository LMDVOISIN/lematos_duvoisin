import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { storeAuthRedirectPath } from '../../utils/authRedirect';
import userProfileDocumentService from '../../services/userProfileDocumentService';
import reservationService from '../../services/reservationService';
import { supabase } from '../../lib/supabase';

const normalizeReservationId = (value) => {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(raw) ? raw : null;
};

const toDateLabel = (value) => {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date?.getTime())) return '-';
  return date.toLocaleString('fr-FR');
};

const VerificationIdentiteLocation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const fileInputRef = useRef(null);
  const checkoutSyncTriggeredRef = useRef(false);

  const searchParams = useMemo(() => new URLSearchParams(location?.search || ''), [location?.search]);
  const reservationId = normalizeReservationId(searchParams?.get('reservationId'));
  const stripeStatusFromQuery = String(searchParams?.get('stripeStatus') || '')?.toLowerCase();
  const stripeSessionIdFromQuery = String(searchParams?.get('session_id') || '')?.trim();

  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [reservation, setReservation] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [uploadingIdentity, setUploadingIdentity] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated) return;

    const redirectAfterAuth = `${location?.pathname || '/verification-identite-location'}${location?.search || ''}${location?.hash || ''}`;
    storeAuthRedirectPath(redirectAfterAuth);
    navigate('/authentification', {
      replace: true,
      state: { from: redirectAfterAuth }
    });
  }, [
    authLoading,
    isAuthenticated,
    location?.hash,
    location?.pathname,
    location?.search,
    navigate
  ]);

  const loadContext = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setLoadError('');

      const [docsResult, reservationResult] = await Promise.all([
        userProfileDocumentService?.listUserDocuments(user?.id),
        reservationId ? reservationService?.getReservationById(reservationId) : Promise.resolve({ data: null, error: null })
      ]);

      if (docsResult?.error) {
        throw docsResult?.error;
      }

      const mappedDocuments = (docsResult?.data || [])?.map((row) => (
        userProfileDocumentService?.mapRowToUiDocument(row)
      ));
      setDocuments(Array.isArray(mappedDocuments) ? mappedDocuments : []);

      if (reservationResult?.error) {
        console.warn('Reservation context not loaded on identity transition page:', reservationResult?.error?.message || reservationResult?.error);
      } else {
        setReservation(reservationResult?.data || null);
      }
    } catch (error) {
      console.error("Erreur chargement vérification identité :", error);
      setLoadError(error?.message || "Impossible de charger la vérification d'identité.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContext();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, reservationId]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !user?.id) return;
    if (stripeStatusFromQuery !== 'success') return;
    if (!reservationId) return;
    if (!stripeSessionIdFromQuery || stripeSessionIdFromQuery?.includes('{CHECKOUT_SESSION_ID}')) return;
    if (checkoutSyncTriggeredRef.current) return;

    checkoutSyncTriggeredRef.current = true;
    let isMounted = true;

    const syncStripeCheckout = async () => {
      const { error } = await supabase.functions.invoke('manage-reservation-deposit-strategy-b', {
        body: {
          action: 'sync_checkout',
          reservationId,
          sessionId: stripeSessionIdFromQuery
        }
      });

      if (error) {
        console.error('Erreur sync checkout depuis vérification-identite-location:', error);
        return;
      }

      if (!isMounted) return;

      const nextSearchParams = new URLSearchParams(location?.search || '');
      nextSearchParams.delete('stripeStatus');
      nextSearchParams.delete('session_id');
      const nextSearch = nextSearchParams.toString();
      navigate(
        `${location?.pathname || '/verification-identite-location'}${nextSearch ? `?${nextSearch}` : ''}${location?.hash || ''}`,
        { replace: true }
      );
    };

    syncStripeCheckout();

    return () => {
      isMounted = false;
    };
  }, [
    authLoading,
    isAuthenticated,
    location?.hash,
    location?.pathname,
    location?.search,
    navigate,
    reservationId,
    stripeSessionIdFromQuery,
    stripeStatusFromQuery,
    user?.id
  ]);

  const identityDocuments = useMemo(() => (
    (documents || [])
      ?.filter((doc) => doc?.type === 'identity')
      ?.sort((a, b) => new Date(b?.uploadDate || 0) - new Date(a?.uploadDate || 0))
  ), [documents]);

  const latestIdentityDocument = identityDocuments?.[0] || null;
  const identityApproved = identityDocuments?.some((doc) => doc?.status === 'approved');
  const identityPending = !identityApproved && identityDocuments?.some((doc) => doc?.status === 'pending');
  const identityRejected = !identityApproved && latestIdentityDocument?.status === 'rejected';

  const handleUploadIdentity = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file || !user?.id) return;

    setUploadError('');
    setUploadingIdentity(true);

    try {
      const { error } = await userProfileDocumentService?.uploadUserDocument(user?.id, 'identity', file);
      if (error) throw error;
      await loadContext();
    } catch (error) {
      console.error("Erreur upload pièce d'identité :", error);
      setUploadError(error?.message || "Impossible de téléverser la pièce d'identité.");
    } finally {
      setUploadingIdentity(false);
      if (fileInputRef?.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleContinue = () => {
    if (!identityApproved) {
      window.alert("La vérification de votre pièce d'identité doit être approuvée avant de continuer.");
      return;
    }

    navigate('/mes-reservations', {
      state: {
        reservationId: reservationId || null,
        identityVerificationCompleted: true
      }
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col bg-surface">
        <Header />
        <main className="flex-1 py-8">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="bg-white rounded-lg shadow-elevation-2 p-6">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Icon name="Loader2" size={20} className="animate-spin" />
                <span>Chargement de la vérification d'identité...</span>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <main className="flex-1 py-8 md:py-12">
        <div className="container mx-auto px-4 max-w-5xl space-y-6">
          <div className="bg-success/10 border border-success/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Icon name="CheckCircle" size={20} className="text-success flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Paiement enregistré</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Dernière étape avant remise du matériel : vérification de votre pièce d'identité.
                </p>
              </div>
            </div>
          </div>

          {loadError && (
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 text-sm text-foreground">
              {loadError}
            </div>
          )}

          <div className="bg-white rounded-lg shadow-elevation-2 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Icon name="IdCard" size={24} className="text-primary" />
              <h1 className="text-xl md:text-2xl font-semibold text-foreground">
                Vérification d'identité obligatoire
              </h1>
            </div>

            <p className="text-sm text-muted-foreground">
              Pour protéger les loueurs et prévenir la fraude, la remise du matériel est bloquée tant que la pièce
              d'identité du locataire n'est pas vérifiée.
            </p>

            <div className="rounded-lg border border-warning/20 bg-warning/10 p-4">
              <p className="text-sm font-medium text-foreground">À déposer avant le début de la location</p>
              <p className="text-xs text-muted-foreground mt-1">
                Si aucune pièce d'identité n'est déposée à temps, la réservation peut être annulée, 1 jour de location conservé et le reste remboursé.
              </p>
            </div>

            {reservation && (
              <div className="p-4 rounded-lg border border-border bg-surface">
                <p className="text-sm text-foreground font-medium">
                  Réservation concernée: {reservation?.annonce?.titre || 'Location'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Début: {toDateLabel(reservation?.start_date)} | Fin: {toDateLabel(reservation?.end_date)}
                </p>
              </div>
            )}

            <div className="p-4 rounded-lg border border-border bg-surface">
              <p className="text-sm font-medium text-foreground mb-2">Statut actuel de votre pièce d'identité</p>

              {identityApproved && (
                <div className="flex items-start gap-2 text-success">
                  <Icon name="CheckCircle2" size={18} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Identité approuvée</p>
                    <p className="text-xs text-muted-foreground">
                      Validation enregistrée. Vous pouvez continuer vers la remise.
                    </p>
                  </div>
                </div>
              )}

              {identityPending && (
                <div className="flex items-start gap-2 text-warning">
                  <Icon name="Clock3" size={18} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Vérification en attente</p>
                    <p className="text-xs text-muted-foreground">
                      Votre pièce a bien été reçue. La remise reste bloquée jusqu'à validation.
                    </p>
                  </div>
                </div>
              )}

              {identityRejected && (
                <div className="flex items-start gap-2 text-destructive">
                  <Icon name="AlertTriangle" size={18} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Document refusé</p>
                    <p className="text-xs text-muted-foreground">
                      Motif: {latestIdentityDocument?.rejectionReason || 'Format ou lisibilité insuffisante.'}
                    </p>
                  </div>
                </div>
              )}

              {!identityApproved && !identityPending && !identityRejected && (
                <div className="flex items-start gap-2 text-muted-foreground">
                  <Icon name="Info" size={18} className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Aucune pièce d'identité déposée</p>
                    <p className="text-xs">Déposez votre CNI ou passeport pour débloquer la remise.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
              <p className="text-sm font-medium text-foreground mb-1">Déposer une pièce d'identité</p>
              <p className="text-xs text-muted-foreground mb-3">
                Formats acceptés: PDF, JPG, PNG. Taille max: 5 Mo.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={handleUploadIdentity}
              />

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => fileInputRef?.current?.click()}
                  loading={uploadingIdentity}
                  iconName="Upload"
                >
                  Téléverser ma pièce d'identité
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/profil-documents-utilisateur')}
                >
                  Gérer tous mes documents
                </Button>
              </div>

              {uploadError && (
                <p className="text-xs text-destructive mt-3">{uploadError}</p>
              )}
            </div>

            <div className="border-t border-border pt-4 flex flex-wrap gap-3">
              <Button type="button" onClick={handleContinue} disabled={!identityApproved} iconName="ArrowRight">
                Continuer vers mes réservations
              </Button>
              <Button type="button" variant="ghost" onClick={() => loadContext()} iconName="RefreshCw">
                Actualiser le statut
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-elevation-2 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Pourquoi cette vérification est demandée</h2>
            <p className="text-sm text-muted-foreground">
              Cette vérification limite les impayés, la non-restitution et les comptes frauduleux. Elle fait partie
              des mesures de sécurisation contractuelle de la plateforme. La caution est gérée par empreinte CB
              (autorisation bancaire non débitée au paiement de la location).
            </p>
            <p className="text-sm text-muted-foreground">
              Selon la banque du locataire, cette empreinte peut apparaître comme un débit en attente ou un montant
              bloqué, sans être encaissé tant qu'aucune capture n'est décidée.
            </p>

            <h3 className="text-base font-semibold text-foreground">Conséquences en cas de fraude</h3>
            <p className="text-sm text-muted-foreground">
              En cas de non-restitution, fausse déclaration, opposition bancaire abusive ou usurpation, la plateforme
              peut conserver les preuves techniques, déposer un signalement et cooperer avec les autorités compétentes.
              Des recours civils et pénaux peuvent etre engages.
            </p>

            <h3 className="text-base font-semibold text-foreground">Mesures de protection des données</h3>
            <p className="text-sm text-muted-foreground">
              Documents stockés sur un espace sécurisé, accès strictement limité, journalisation des actions,
              conservation encadrée et suppression selon la politique de confidentialité. La pièce d'identité n'est
              jamais communiquée au propriétaire ni à des tiers externes à la plateforme, sauf obligation légale ou
              fraude établie pour enclencher la procédure officielle.
            </p>

            <div className="text-xs text-muted-foreground">
              En poursuivant, vous confirmez avoir pris connaissance des
              {' '}
              <a href="/cgu" className="text-primary hover:underline" target="_blank" rel="noreferrer">CGU</a>
              {', '}
              <a href="/cgv" className="text-primary hover:underline" target="_blank" rel="noreferrer">CGV</a>
              {' '}et de la
              {' '}
              <a href="/politique-confidentialite" className="text-primary hover:underline" target="_blank" rel="noreferrer">
                politique de confidentialité
              </a>
              .
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default VerificationIdentiteLocation;

