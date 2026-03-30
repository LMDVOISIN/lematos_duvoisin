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
import { isAdminVerificationScenario } from '../../utils/adminVerificationContext';

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

const QUICK_RULES = ['Avant le départ', 'PDF, JPG, PNG', '5 Mo max'];

const VerificationIdentiteLocation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const fileInputRef = useRef(null);
  const checkoutSyncTriggeredRef = useRef(false);
  const isVerificationIdentityScenario = isAdminVerificationScenario('booking_identity_after_payment');

  const searchParams = useMemo(() => new URLSearchParams(location?.search || ''), [location?.search]);
  const reservationId = normalizeReservationId(searchParams?.get('reservationId'));
  const stripeStatusFromQuery = String(searchParams?.get('paymentStatus') || searchParams?.get('stripeStatus') || '')?.toLowerCase();
  const stripeSessionIdFromQuery = String(searchParams?.get('checkoutSessionId') || searchParams?.get('session_id') || '')?.trim();

  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [reservation, setReservation] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [uploadingIdentity, setUploadingIdentity] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [verificationIdentityStatus, setVerificationIdentityStatus] = useState('');

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

      if (isVerificationIdentityScenario) {
        setDocuments([{
          id: 'verification-identity-pending',
          type: 'identity',
          status: 'pending',
          uploadDate: new Date().toISOString()
        }]);
        setReservation({
          id: reservationId || 'verification-reservation',
          annonce: {
            titre: 'Annonce de verification admin'
          },
          start_date: '2026-04-02T10:00:00.000Z',
          end_date: '2026-04-03T18:00:00.000Z'
        });
        return;
      }

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
    if (!stripeSessionIdFromQuery || stripeSessionIdFromQuery?.includes('{CHECKOUT_SESSION_ID}')) return;
    if (checkoutSyncTriggeredRef.current) return;

    checkoutSyncTriggeredRef.current = true;
    let isMounted = true;

    const syncStripeCheckout = async () => {
      const { data, error } = await supabase.functions.invoke('manage-reservation-deposit-strategy-b', {
        body: {
          action: 'sync_checkout',
          reservationId: reservationId || null,
          sessionId: stripeSessionIdFromQuery
        }
      });

      if (error) {
        console.error("Erreur de confirmation paiement depuis verification-identite-location:", error);
        return;
      }

      const syncedReservationId = normalizeReservationId(data?.reservationId || reservationId);
      if (!syncedReservationId) {
        console.error("Aucune réservation créée n'a été renvoyée après le paiement.");
        return;
      }

      const { data: syncedReservation } = await reservationService?.getReservationById(syncedReservationId);
      if (!isMounted) return;
      if (syncedReservation) {
        setReservation(syncedReservation);
      }

      const nextSearchParams = new URLSearchParams(location?.search || '');
      nextSearchParams.set('reservationId', syncedReservationId);
      nextSearchParams.delete('paymentStatus');
      nextSearchParams.delete('checkoutSessionId');
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
    stripeSessionIdFromQuery,
    stripeStatusFromQuery,
    user?.id,
    reservationId
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
  const identityStatusMeta = useMemo(() => {
    if (identityApproved) {
      return {
        badge: 'Validée',
        title: 'Parfait, vous pouvez continuer',
        description: 'Votre pièce est validée.',
        helper: 'La remise est débloquée.',
        icon: 'CheckCircle2',
        cardClassName: 'border-[#9fd9b8] bg-[#effcf5] text-[#14644a]',
        iconClassName: 'bg-[#daf6e8] text-[#14644a]'
      };
    }

    if (identityPending) {
      return {
        badge: 'En cours',
        title: 'On vérifie votre pièce',
        description: 'Votre document est bien reçu.',
        helper: "La remise s'ouvrira dès validation.",
        icon: 'Clock3',
        cardClassName: 'border-[#ffd89c] bg-[#fff8e8] text-[#9b5d00]',
        iconClassName: 'bg-[#ffefc8] text-[#9b5d00]'
      };
    }

    if (identityRejected) {
      return {
        badge: 'À refaire',
        title: 'Votre pièce est à renvoyer',
        description: 'Le document doit être remplacé.',
        helper: latestIdentityDocument?.rejectionReason || 'Photo plus nette ou bon format.',
        icon: 'AlertTriangle',
        cardClassName: 'border-[#fecaca] bg-[#fff1f2] text-[#b42318]',
        iconClassName: 'bg-[#ffe0e4] text-[#b42318]'
      };
    }

    return {
      badge: 'À déposer',
      title: "Déposez votre pièce d'identité",
      description: 'CNI ou passeport bien lisible.',
      helper: 'Une fois validée, la remise se débloque.',
      icon: 'Upload',
      cardClassName: 'border-[#bfe4ff] bg-[#eef8ff] text-[#0f5c7a]',
      iconClassName: 'bg-white text-[#0f5c7a]'
    };
  }, [identityApproved, identityPending, identityRejected, latestIdentityDocument?.rejectionReason]);

  const verificationSteps = useMemo(() => ([
    {
      title: 'Paiement confirmé',
      description: 'OK',
      icon: 'CheckCircle2',
      state: 'done'
    },
    {
      title: 'Pièce',
      description: identityApproved ? 'OK' : identityPending ? 'En cours' : identityRejected ? 'À refaire' : 'À déposer',
      icon: 'IdCard',
      state: identityApproved ? 'done' : identityRejected ? 'warning' : 'active'
    },
    {
      title: 'Remise',
      description: identityApproved ? 'OK' : 'Attente',
      icon: 'PartyPopper',
      state: identityApproved ? 'done' : 'upcoming'
    }
  ]), [identityApproved, identityPending, identityRejected]);

  const getStepTone = (state) => {
    switch (state) {
      case 'done':
        return {
          wrapperClassName: 'border-[#b8e6cf] bg-[#f4fdf8]',
          iconClassName: 'bg-[#daf6e8] text-[#14644a]',
          textClassName: 'text-[#14644a]'
        };
      case 'warning':
        return {
          wrapperClassName: 'border-[#fecaca] bg-[#fff5f6]',
          iconClassName: 'bg-[#ffe0e4] text-[#b42318]',
          textClassName: 'text-[#b42318]'
        };
      case 'active':
        return {
          wrapperClassName: 'border-[#9fdaf6] bg-[#eefaff]',
          iconClassName: 'bg-white text-[#0f5c7a]',
          textClassName: 'text-[#0f5c7a]'
        };
      default:
        return {
          wrapperClassName: 'border-[#dbe8f3] bg-[#f8fbff]',
          iconClassName: 'bg-white text-slate-400',
          textClassName: 'text-slate-500'
        };
    }
  };

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

  const handleVerificationIdentityUpload = () => {
    if (!isVerificationIdentityScenario) return;

    setVerificationIdentityStatus("Pièce d'identité de vérification déposée et approuvée.");
    setDocuments([{
      id: 'verification-identity-approved',
      type: 'identity',
      status: 'approved',
      uploadDate: new Date().toISOString()
    }]);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col bg-surface">
        <Header />
        <main className="flex-1 py-8">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_24px_60px_-42px_rgba(15,77,122,0.45)] backdrop-blur">
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

      <main className="relative flex-1 overflow-hidden py-8 md:py-12">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top_left,_rgba(255,244,179,0.45),_transparent_42%),radial-gradient(circle_at_top_right,_rgba(166,227,191,0.28),_transparent_32%),radial-gradient(circle_at_center,_rgba(159,218,246,0.28),_transparent_45%)]" />
        <div className="container mx-auto px-4 max-w-5xl space-y-6">
          {loadError && (
            <div className="rounded-[24px] border border-warning/20 bg-[#fff8ea] p-4 text-sm text-foreground shadow-[0_16px_34px_-28px_rgba(217,119,6,0.45)]">
              {loadError}
            </div>
          )}

          {isVerificationIdentityScenario ? (
            <div className="rounded-[24px] border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-4 shadow-[0_18px_32px_-26px_rgba(5,150,105,0.45)]">
              <div className="flex items-start gap-3">
                <Icon name="ShieldCheck" size={20} className="mt-0.5 text-success" />
                <div className="space-y-2">
                  <p className="font-medium text-foreground">Mode de vérification admin</p>
                  <p className="text-sm text-muted-foreground">
                    Déposez une CNI de vérification pour valider le passage post-paiement.
                  </p>
                  <Button type="button" size="sm" onClick={handleVerificationIdentityUpload}>
                    Déposer une CNI de vérification
                  </Button>
                  {verificationIdentityStatus ? (
                    <p className="text-sm font-medium text-success" data-testid="verification-identity-status">
                      {verificationIdentityStatus}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <div className="relative overflow-hidden rounded-[34px] border border-white/80 bg-white/90 p-6 shadow-[0_28px_70px_-52px_rgba(8,43,82,0.7)] backdrop-blur md:p-8">
            <div aria-hidden="true" className="absolute -left-4 top-10 h-24 w-24 rounded-full bg-[#fff1b8]/70 blur-2xl" />
            <div aria-hidden="true" className="absolute right-10 top-6 h-20 w-20 rounded-full bg-[#ddf4ff] blur-2xl" />

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={handleUploadIdentity}
            />

            <div className="relative grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/90 bg-[#f8fdff] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#0f7081] shadow-sm">
                  <Icon name="Sparkles" size={14} />
                  Paiement confirmé
                </span>

                <h1 className="mt-4 font-heading text-3xl font-semibold text-slate-900 md:text-5xl">
                  {identityStatusMeta?.title}
                </h1>
                <p className="mt-3 text-lg text-slate-600">
                  {identityStatusMeta?.description}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {QUICK_RULES?.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center rounded-full border border-[#d9ebf7] bg-[#f7fbff] px-3 py-1.5 text-xs font-semibold text-slate-600"
                    >
                      {item}
                    </span>
                  ))}
                  <span className="inline-flex items-center rounded-full border border-[#dff3e7] bg-[#f3fcf7] px-3 py-1.5 text-xs font-semibold text-[#14644a]">
                    Visible uniquement par la plateforme
                  </span>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  {identityApproved ? (
                    <Button
                      type="button"
                      size="lg"
                      className="rounded-full bg-[#0f4d7a] px-6 text-base font-semibold shadow-[0_16px_28px_-18px_rgba(15,77,122,0.75)]"
                      onClick={handleContinue}
                      iconName="ArrowRight"
                    >
                      Continuer
                    </Button>
                  ) : identityPending ? (
                    <Button
                      type="button"
                      size="lg"
                      className="rounded-full bg-[#0f4d7a] px-6 text-base font-semibold shadow-[0_16px_28px_-18px_rgba(15,77,122,0.75)]"
                      onClick={() => loadContext()}
                      iconName="RefreshCw"
                    >
                      Actualiser le statut
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="lg"
                      className="rounded-full bg-gradient-to-r from-[#0f4d7a] via-[#13698f] to-[#17a2b8] px-6 text-base font-semibold text-white shadow-[0_18px_34px_-20px_rgba(15,77,122,0.85)] hover:bg-gradient-to-r hover:from-[#0f4d7a] hover:via-[#13698f] hover:to-[#17a2b8]"
                      onClick={() => fileInputRef?.current?.click()}
                      loading={uploadingIdentity}
                      iconName="Upload"
                    >
                      Téléverser ma pièce
                    </Button>
                  )}

                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="rounded-full border-white/90 bg-white/90 px-6 text-base font-semibold text-slate-700 shadow-[0_16px_30px_-24px_rgba(15,77,122,0.4)] hover:border-[#9fdaf6] hover:bg-white hover:text-[#0f5c7a]"
                    onClick={() => navigate('/profil-documents-utilisateur')}
                  >
                    Mes documents
                  </Button>
                </div>

                <p className="mt-4 text-sm font-medium text-slate-500">
                  {identityStatusMeta?.helper}
                </p>

                {!identityApproved ? (
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    Sans validation à temps, la remise peut rester bloquée.
                  </p>
                ) : null}

                {uploadError && (
                  <p className="mt-3 text-xs font-medium text-destructive">{uploadError}</p>
                )}
              </div>

              <div className={`rounded-[28px] border p-5 shadow-[0_18px_34px_-28px_rgba(15,77,122,0.4)] ${identityStatusMeta?.cardClassName}`}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-[18px] shadow-sm ${identityStatusMeta?.iconClassName}`}>
                    <Icon name={identityStatusMeta?.icon} size={22} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-80">Etape en cours</p>
                    <p className="font-heading text-2xl font-semibold text-slate-900">{identityStatusMeta?.badge}</p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  {verificationSteps?.map((step) => {
                    const tone = getStepTone(step?.state);

                    return (
                      <div
                        key={step?.title}
                        className={`rounded-[22px] border px-3 py-4 text-center ${tone?.wrapperClassName}`}
                      >
                        <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-2xl ${tone?.iconClassName}`}>
                          <Icon name={step?.icon} size={18} />
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{step?.title}</p>
                        <p className={`text-xs font-medium ${tone?.textClassName}`}>{step?.description}</p>
                      </div>
                    );
                  })}
                </div>

                {reservation ? (
                  <div className="mt-5 rounded-[22px] border border-white/80 bg-white/80 p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0f7081]">
                      Réservation concernée
                    </p>
                    <p className="mt-2 line-clamp-2 font-heading text-lg font-semibold text-slate-900">
                      {reservation?.annonce?.titre || 'Location'}
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Début</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{toDateLabel(reservation?.start_date)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Fin</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{toDateLabel(reservation?.end_date)}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <p className="px-2 text-center text-xs text-slate-500">
            <a href="/cgu" className="text-primary hover:underline" target="_blank" rel="noreferrer">CGU</a>
            {' · '}
            <a href="/cgv" className="text-primary hover:underline" target="_blank" rel="noreferrer">CGV</a>
            {' · '}
            <a href="/politique-confidentialite" className="text-primary hover:underline" target="_blank" rel="noreferrer">
              Confidentialité
            </a>
          </p>

          <div className="hidden bg-white rounded-lg shadow-elevation-2 p-6 space-y-4">
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
              peut conserver les éléments utiles au dossier, déposer un signalement et coopérer avec les autorités compétentes.
              Des recours civils et pénaux peuvent être engagés.
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

