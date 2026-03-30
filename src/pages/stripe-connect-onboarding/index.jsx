import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import payoutAccountService from '../../services/payoutAccountService';
import { buildWebAppUrl, redirectToExternalUrl } from '../../utils/nativeRuntime';

const STATUS_CONFIGS = {
  not_connected: {
    label: 'Non connecté',
    icon: 'AlertCircle',
    color: 'text-muted-foreground bg-muted',
    description: "Aucun compte de versement actif n'est encore relié à votre profil."
  },
  activation_required: {
    label: 'Activation à terminer',
    icon: 'Wallet',
    color: 'text-warning bg-warning/10',
    description: 'Votre compte de versement existe déjà, mais certaines informations doivent encore être complétées.'
  },
  pending_review: {
    label: 'Vérification en cours',
    icon: 'Clock3',
    color: 'text-[#17a2b8] bg-[#17a2b8]/10',
    description: 'Vos informations ont été transmises et sont en cours de vérification.'
  },
  attention_required: {
    label: 'Action requise',
    icon: 'AlertTriangle',
    color: 'text-warning bg-warning/10',
    description: 'Le service de versement attend des informations complémentaires avant de débloquer vos virements.'
  },
  connected: {
    label: 'Connecté',
    icon: 'CheckCircle',
    color: 'text-success bg-success/10',
    description: 'Vos coordonnées de versement sont actives et peuvent recevoir vos virements.'
  }
};

const StripeConnectOnboarding = () => {
  const { user, userProfile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [statusLoading, setStatusLoading] = useState(true);
  const [payoutState, setPayoutState] = useState(null);
  const [actionLoading, setActionLoading] = useState('');

  const autoRefreshHandledRef = useRef(false);
  const returnHandledRef = useRef(false);
  const initialLoadTriggeredRef = useRef(false);

  const searchParams = useMemo(() => new URLSearchParams(location.search || ''), [location.search]);
  const activationQuery = String(searchParams.get('activation') || '').trim().toLowerCase();

  const clearActivationQuery = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('activation');
    const nextSearch = nextParams.toString();
    navigate(
      {
        pathname: location.pathname || '/coordonnees-versement',
        search: nextSearch ? `?${nextSearch}` : ''
      },
      { replace: true }
    );
  };

  const loadPayoutState = async ({ silent = false, showToast = false } = {}) => {
    if (!user) return null;

    if (!silent) {
      setStatusLoading(true);
    }

    const { data, error } = await payoutAccountService.getStatus();
    if (error) {
      if (!silent) {
        setPayoutState(null);
      }
      toast.error(error.message || 'Impossible de charger vos coordonnées de versement.');
      if (!silent) {
        setStatusLoading(false);
      }
      return null;
    }

    setPayoutState(data || null);
    await refreshProfile?.();

    if (showToast) {
      if (data?.status?.code === 'connected') {
        toast.success('Vos versements sont maintenant actifs.');
      } else {
        toast.success('Le statut de vos versements a bien été mis à jour.');
      }
    }

    if (!silent) {
      setStatusLoading(false);
    }

    return data || null;
  };

  const openPayoutFlow = async (mode = 'activate') => {
    if (!user) {
      toast.error('Veuillez vous connecter pour activer vos versements.');
      navigate('/authentification');
      return;
    }

    setActionLoading(mode);

    const returnUrl = buildWebAppUrl('/coordonnees-versement?activation=return');
    const refreshUrl = buildWebAppUrl('/coordonnees-versement?activation=refresh');
    const runner = mode === 'manage'
      ? payoutAccountService.openManagement
      : payoutAccountService.createActivationLink;

    const { data, error } = await runner({
      returnUrl,
      refreshUrl
    });

    if (error) {
      setActionLoading('');
      toast.error(error.message || "Impossible d'ouvrir l'activation des versements.");
      return;
    }

    setPayoutState(data || null);
    await refreshProfile?.();

    if (!data.actionUrl) {
      setActionLoading('');
      toast.error("Aucun lien d'activation n'a été retourné.");
      return;
    }

    await redirectToExternalUrl(data.actionUrl);
    setActionLoading('');
  };

  useEffect(() => {
    if (authLoading || !user) return;
    if (initialLoadTriggeredRef.current) return;

    initialLoadTriggeredRef.current = true;
    void loadPayoutState();
  }, [authLoading, user]);

  useEffect(() => {
    if (!user || authLoading) return;

    if (activationQuery === 'refresh' && !autoRefreshHandledRef.current) {
      autoRefreshHandledRef.current = true;
      void openPayoutFlow('activate');
      return;
    }

    if (activationQuery === 'return' && !returnHandledRef.current) {
      returnHandledRef.current = true;
      void (async () => {
        await loadPayoutState({ showToast: true });
        clearActivationQuery();
      })();
    }
  }, [activationQuery, authLoading, user]);

  const effectiveStatusCode = payoutState?.status?.code
    || (userProfile?.stripe_account_id ? 'activation_required' : 'not_connected');
  const statusConfig = STATUS_CONFIGS[effectiveStatusCode] || STATUS_CONFIGS.not_connected;
  const requirementSummary = payoutState?.requirementSummary || {};
  const userData = useMemo(() => ({
    pseudonym: payoutState?.displayName || userProfile?.pseudo || user?.user_metadata?.pseudo || null,
    email: payoutState?.email || user?.email || userProfile?.email || null,
    payoutAccountId: payoutState?.accountId || userProfile?.stripe_account_id || null
  }), [payoutState, user, userProfile]);

  const onboardingSteps = [
    {
      number: 1,
      title: 'Créer votre espace de versement',
      description: "Liez votre profil à un espace sécurisé de versement.",
      icon: 'User',
      completed: Boolean(userData.payoutAccountId)
    },
    {
      number: 2,
      title: 'Renseigner votre identité et votre IBAN',
      description: 'Complétez les informations demandées pour recevoir vos virements.',
      icon: 'CreditCard',
      completed: Boolean(payoutState.detailsSubmitted)
    },
    {
      number: 3,
      title: 'Recevoir vos virements',
      description: 'Une fois le dossier validé, vos paiements peuvent être envoyés automatiquement.',
      icon: 'DollarSign',
      completed: Boolean(payoutState.payoutsEnabled)
    }
  ];

  const benefits = [
    {
      icon: 'Shield',
      title: 'Paiements sécurisés',
      description: "Les paiements sont traités par notre service de paiement sécurisé."
    },
    {
      icon: 'Zap',
      title: 'Virements rapides',
      description: 'Recevez vos paiements dès que la location est éligible au versement.'
    },
    {
      icon: 'BarChart',
      title: 'Suivi simplifié',
      description: 'Consultez le statut général de vos versements depuis votre espace.'
    },
    {
      icon: 'Lock',
      title: 'Coordonnées protégées',
      description: 'Vos coordonnées bancaires sont saisies hors de la plateforme.'
    },
    {
      icon: 'ShieldCheck',
      title: 'Blocages levés automatiquement',
      description: 'Les versements en attente repartent dès que votre compte est prêt.'
    }
  ];

  const hasPendingRequirements = Number(requirementSummary.currentlyDueCount || 0) > 0
    || Number(requirementSummary.pastDueCount || 0) > 0
    || Number(requirementSummary.pendingVerificationCount || 0) > 0;

  if (authLoading || statusLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-surface">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-6 md:py-8">
          <div className="bg-white rounded-lg shadow-elevation-1 p-6">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Icon name="Loader2" size={20} className="animate-spin" />
              <span>Chargement de votre espace de versement...</span>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-surface">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-6 md:py-8">
          <div className="bg-white rounded-lg shadow-elevation-1 p-6">
            <h1 className="text-2xl font-bold text-foreground mb-2">Coordonnées de versement</h1>
            <p className="text-muted-foreground mb-4">Vous devez être connecté pour activer vos versements.</p>
            <Button onClick={() => navigate('/authentification')}>
              Se connecter
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-6 md:py-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <a href="/profil-documents-utilisateurtab=settings" className="hover:text-[#17a2b8] transition-colors">Paramètres</a>
          <Icon name="ChevronRight" size={14} />
          <span className="text-foreground">Coordonnées de versement</span>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Coordonnées de versement</h1>
          <p className="text-muted-foreground">Activez votre espace de versement pour recevoir vos paiements automatiquement à la fin des locations.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-elevation-1 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-foreground mb-2">Statut de votre compte de versement</h2>
                  <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${statusConfig.color}`}>
                    <Icon name={statusConfig.icon} size={16} />
                    {statusConfig.label}
                  </span>
                  <p className="text-sm text-muted-foreground mt-3">
                    {payoutState.status.description || statusConfig.description}
                  </p>
                </div>
              </div>

              <div className="bg-surface rounded-lg p-4 space-y-1 text-sm mb-4">
                <p><span className="text-muted-foreground">Pseudo:</span> <span className="text-foreground font-medium">{userData.pseudonym || '-'}</span></p>
                <p><span className="text-muted-foreground">Email:</span> <span className="text-foreground font-medium">{userData.email || '-'}</span></p>
                <p><span className="text-muted-foreground">Identifiant de compte:</span> <span className="text-foreground font-medium">{userData.payoutAccountId || 'Aucun'}</span></p>
              </div>

              {hasPendingRequirements && (
                <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-4">
                  <div className="flex gap-3">
                    <Icon name="AlertTriangle" size={20} className="text-warning flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-foreground mb-1">Informations encore attendues</p>
                      <div className="space-y-1 text-muted-foreground">
                        {Number(requirementSummary.currentlyDueCount || 0) > 0 && (
                          <p>{requirementSummary.currentlyDueCount} information(s) à compléter.</p>
                        )}
                        {Number(requirementSummary.pendingVerificationCount || 0) > 0 && (
                          <p>{requirementSummary.pendingVerificationCount} vérification(s) en cours.</p>
                        )}
                        {Number(requirementSummary.pastDueCount || 0) > 0 && (
                          <p>{requirementSummary.pastDueCount} information(s) doivent être mises à jour.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {payoutState.payoutRetry && Number(payoutState.payoutRetry.retriedPending || 0) > 0 && (
                <div className="bg-success/10 border border-success/20 rounded-lg p-4 mb-4">
                  <div className="flex gap-3">
                    <Icon name="CircleDollarSign" size={20} className="text-success flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-foreground mb-1">Versements remis en route</p>
                      <p className="text-muted-foreground">
                        {payoutState.payoutRetry.retriedPending} versement(s) en attente ont été relancés après activation.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                {effectiveStatusCode === 'connected' ? (
                  <Button
                    size="lg"
                    iconName="Wallet"
                    onClick={() => openPayoutFlow('manage')}
                    loading={actionLoading === 'manage'}
                    className="bg-[#17a2b8] hover:bg-[#0f6070]"
                  >
                    Mettre à jour mes versements
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    iconName="ExternalLink"
                    onClick={() => openPayoutFlow('activate')}
                    loading={actionLoading === 'activate'}
                    className="bg-[#17a2b8] hover:bg-[#0f6070]"
                  >
                    {effectiveStatusCode === 'activation_required' || effectiveStatusCode === 'attention_required'
                      ? 'Compléter mes versements'
                      : 'Activer mes versements'}
                  </Button>
                )}

                {effectiveStatusCode === 'connected' && (
                  <Button variant="default" iconName="Plus" onClick={() => navigate('/creer-annonce')}>
                    Créer une annonce
                  </Button>
                )}
              </div>
            </div>

            {effectiveStatusCode !== 'connected' && (
              <div className="bg-white rounded-lg shadow-elevation-1 p-6">
                <h2 className="text-xl font-semibold text-foreground mb-6">Étapes d'activation</h2>
                <div className="space-y-6">
                  {onboardingSteps.map((step) => (
                    <div key={step.number} className="flex gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${step.completed ? 'bg-success text-white' : 'bg-surface text-muted-foreground'}`}>
                        {step.completed ? <Icon name="Check" size={20} /> : <Icon name={step.icon} size={20} />}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground mb-1">{step.number}. {step.title}</h3>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-[#17a2b8]/10 border border-[#17a2b8]/20 rounded-lg p-4">
              <div className="flex gap-3">
                <Icon name="Info" size={20} className="text-[#17a2b8] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground mb-1">Comment ça marche ?</p>
                  <p className="text-sm text-muted-foreground">
                    Vous activez vos coordonnées de versement une seule fois. Ensuite, la plateforme garde l'argent pendant la location,
                    puis envoie automatiquement votre net dès que la réservation est éligible au versement.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-elevation-1 p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Icon name="Star" size={18} />
                Pourquoi activer vos versements 
              </h3>
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="w-10 h-10 bg-[#17a2b8]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon name={benefit.icon} size={18} className="text-[#17a2b8]" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm mb-1">{benefit.title}</p>
                      <p className="text-xs text-muted-foreground">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-elevation-1 p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Icon name="HelpCircle" size={18} />
                Besoin d'aide 
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Si quelque chose bloque, revenez sur cette page puis recliquez sur le bouton d'activation.
                Le système recréera automatiquement un lien valide.
              </p>
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" iconName="Book">
                  Consulter la FAQ
                </Button>
                <Button variant="outline" size="sm" iconName="MessageSquare">
                  Contacter le support
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default StripeConnectOnboarding;

