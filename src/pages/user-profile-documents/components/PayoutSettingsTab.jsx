import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';
import payoutAccountService from '../../../services/payoutAccountService';
import stripeTokenService from '../../../services/stripeTokenService';
import {
  clearStoredTestPayoutSimulation,
  getStoredTestPayoutSimulation,
} from '../../../utils/testPayoutSimulation';
import NativePayoutActivationForm from './NativePayoutActivationForm';

const STATUS_CONFIGS = {
  not_connected: {
    label: 'Non connecté',
    icon: 'AlertCircle',
    color: 'text-muted-foreground bg-muted',
    description: "Aucun compte de versement actif n'est encore relié à votre profil.",
  },
  activation_required: {
    label: 'Activation à terminer',
    icon: 'Wallet',
    color: 'text-warning bg-warning/10',
    description: 'Quelques informations manquent encore avant de recevoir vos virements.',
  },
  pending_review: {
    label: 'Vérification en cours',
    icon: 'Clock3',
    color: 'text-[#17a2b8] bg-[#17a2b8]/10',
    description: 'Vos informations ont bien été transmises. La vérification est en cours.',
  },
  attention_required: {
    label: 'Action requise',
    icon: 'AlertTriangle',
    color: 'text-warning bg-warning/10',
    description: 'Des informations complémentaires sont encore attendues pour débloquer les virements.',
  },
  connected: {
    label: 'Connecté',
    icon: 'CheckCircle',
    color: 'text-success bg-success/10',
    description: 'Vos coordonnées de versement sont actives et peuvent recevoir vos virements.',
  },
};

const BENEFITS = [
  {
    icon: 'Shield',
    title: 'Paiements sécurisés',
    description: "La plateforme garde vos paiements jusqu'au moment où le versement doit partir.",
  },
  {
    icon: 'Zap',
    title: 'Virements rapides',
    description: 'Votre argent part dès que la location devient éligible au versement.',
  },
  {
    icon: 'BarChart',
    title: 'Suivi simple',
    description: 'Vous voyez ici si vos versements sont prêts, en attente ou bloqués.',
  },
  {
    icon: 'Lock',
    title: 'Infos limitées',
    description: 'Vous renseignez seulement les informations utiles pour recevoir vos virements.',
  },
];

const buildEffectivePayoutState = ({
  payoutState,
  simulatedTestPayout,
  user,
  userProfile,
}) => {
  if (payoutState?.status?.code === 'connected' || !simulatedTestPayout) {
    return payoutState;
  }

  return {
    ...(payoutState || {}),
    accountId: payoutState?.accountId || `test_payout_${String(user?.id || 'local').slice(0, 12)}`,
    displayName:
      payoutState?.displayName
      || simulatedTestPayout?.displayName
      || userProfile?.pseudo
      || user?.email
      || null,
    email:
      payoutState?.email
      || simulatedTestPayout?.email
      || user?.email
      || userProfile?.email
      || null,
    detailsSubmitted: true,
    bankAccount: {
      ...(payoutState?.bankAccount || {}),
      bankName: payoutState?.bankAccount?.bankName || simulatedTestPayout?.bankName,
      last4: payoutState?.bankAccount?.last4 || simulatedTestPayout?.last4,
      country: payoutState?.bankAccount?.country || 'FR',
      currency: payoutState?.bankAccount?.currency || 'EUR',
      status: payoutState?.bankAccount?.status || 'validated',
    },
    requirementSummary: payoutState?.requirementSummary || {
      currentlyDueCount: 0,
      pastDueCount: 0,
      pendingVerificationCount: 0,
    },
    status: {
      code: 'connected',
      description: 'Mode test : vos versements sont simulés localement sur cet appareil.',
    },
  };
};

const PayoutSettingsTab = () => {
  const { user, userProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [statusLoading, setStatusLoading] = useState(true);
  const [payoutState, setPayoutState] = useState(null);
  const [showBankUpdateForm, setShowBankUpdateForm] = useState(false);
  const initialLoadUserIdRef = useRef(null);
  const isStripeTestMode = stripeTokenService?.isTestMode?.() === true;

  const activationQuery = String(searchParams.get('activation') || '').trim().toLowerCase();

  const clearActivationQuery = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('activation');
    setSearchParams(nextParams, { replace: true });
  };

  const loadPayoutState = async ({ silent = false, showToast = false } = {}) => {
    if (!user?.id) {
      setStatusLoading(false);
      return null;
    }

    if (!silent) {
      setStatusLoading(true);
    }

    const { data, error } = await payoutAccountService.getStatus();
    if (error) {
      if (!silent) {
        setPayoutState(null);
        setStatusLoading(false);
      }
      toast.error(error.message || 'Impossible de charger vos versements.');
      return null;
    }

    setPayoutState(data || null);
    await refreshProfile?.();

    if (showToast) {
      toast.success(
        data?.status?.code === 'connected'
          ? 'Vos versements sont maintenant actifs.'
          : 'Le statut de vos versements a bien été mis à jour.',
      );
    }

    if (!silent) {
      setStatusLoading(false);
    }

    return data || null;
  };

  useEffect(() => {
    if (!user?.id) {
      setStatusLoading(false);
      return;
    }

    if (initialLoadUserIdRef.current === user?.id) {
      return;
    }

    initialLoadUserIdRef.current = user?.id;
    void loadPayoutState();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !activationQuery) return;

    void (async () => {
      await loadPayoutState({ showToast: activationQuery === 'return' });
      clearActivationQuery();
    })();
  }, [activationQuery, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    if (payoutState?.status?.code === 'connected') {
      clearStoredTestPayoutSimulation(user.id);
    }
  }, [payoutState?.status?.code, user?.id]);

  const simulatedTestPayout = useMemo(
    () => (isStripeTestMode && user?.id ? getStoredTestPayoutSimulation(user.id) : null),
    [isStripeTestMode, user?.id],
  );

  const effectivePayoutState = useMemo(
    () => buildEffectivePayoutState({
      payoutState,
      simulatedTestPayout,
      user,
      userProfile,
    }),
    [payoutState, simulatedTestPayout, user, userProfile],
  );

  const effectiveStatusCode = effectivePayoutState?.status?.code
    || (userProfile?.stripe_account_id ? 'activation_required' : 'not_connected');
  const statusConfig = STATUS_CONFIGS[effectiveStatusCode] || STATUS_CONFIGS.not_connected;
  const requirementSummary = effectivePayoutState?.requirementSummary || {};

  const userData = useMemo(() => ({
    pseudonym: effectivePayoutState?.displayName || userProfile?.pseudo || user?.user_metadata?.pseudo || '-',
    email: effectivePayoutState?.email || user?.email || userProfile?.email || '-',
  }), [effectivePayoutState, user, userProfile]);

  const bankAccountSummary = useMemo(() => {
    const bank = effectivePayoutState?.bankAccount;
    if (!bank?.last4) return null;
    return [bank?.bankName, `•••• ${bank?.last4}`].filter(Boolean).join(' ');
  }, [effectivePayoutState]);

  const hasPendingRequirements = Number(requirementSummary.currentlyDueCount || 0) > 0
    || Number(requirementSummary.pastDueCount || 0) > 0
    || Number(requirementSummary.pendingVerificationCount || 0) > 0;

  const handleSaved = async (nextState) => {
    setPayoutState(nextState || null);
    setShowBankUpdateForm(false);
    await refreshProfile?.();
  };

  if (!user?.id) {
    return (
      <div className="bg-card rounded-xl p-6 shadow-elevation-2">
        <h3 className="text-lg font-semibold text-foreground mb-2">Coordonnées de versement</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Vous devez être connecté pour configurer vos versements.
        </p>
        <Button onClick={() => navigate('/authentification')}>Se connecter</Button>
      </div>
    );
  }

  if (statusLoading) {
    return (
      <div className="bg-card rounded-xl p-6 shadow-elevation-2">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Icon name="Loader2" size={20} className="animate-spin" />
          <span>Chargement de votre espace de versement...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 space-y-6">
        <div className="bg-card rounded-xl p-6 shadow-elevation-2">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <h3 className="text-lg md:text-xl font-semibold text-foreground mb-2">
                Statut de votre compte de versement
              </h3>
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${statusConfig.color}`}>
                <Icon name={statusConfig.icon} size={16} />
                {statusConfig.label}
              </span>
              <p className="text-sm text-muted-foreground mt-3">
                {effectivePayoutState?.status?.description || statusConfig.description}
              </p>
            </div>
          </div>

          <div className="bg-surface rounded-lg p-4 space-y-2 text-sm mb-4">
            <p><span className="text-muted-foreground">Pseudo :</span> <span className="text-foreground font-medium">{userData.pseudonym}</span></p>
            <p><span className="text-muted-foreground">Email :</span> <span className="text-foreground font-medium">{userData.email}</span></p>
            <p>
              <span className="text-muted-foreground">Compte bancaire :</span>{' '}
              <span className="text-foreground font-medium">{bankAccountSummary || 'Aucun RIB enregistré pour le moment'}</span>
            </p>
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

          {effectivePayoutState?.payoutRetry && Number(effectivePayoutState.payoutRetry.retriedPending || 0) > 0 && (
            <div className="bg-success/10 border border-success/20 rounded-lg p-4 mb-4">
              <div className="flex gap-3">
                <Icon name="CircleDollarSign" size={20} className="text-success flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground mb-1">Versements remis en route</p>
                  <p className="text-muted-foreground">
                    {effectivePayoutState.payoutRetry.retriedPending} versement(s) en attente ont été relancés après activation.
                  </p>
                </div>
              </div>
            </div>
          )}

          {effectiveStatusCode === 'connected' && !showBankUpdateForm && (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                iconName="Wallet"
                onClick={() => setShowBankUpdateForm(true)}
                className="bg-[#17a2b8] hover:bg-[#0f6070]"
              >
                Remplacer mon RIB
              </Button>
              <Button variant="default" iconName="Plus" onClick={() => navigate('/creer-annonce')}>
                Créer une annonce
              </Button>
            </div>
          )}
        </div>

        {(effectiveStatusCode !== 'connected' || showBankUpdateForm) && (
          <NativePayoutActivationForm
            user={user}
            userProfile={userProfile}
            payoutState={effectivePayoutState}
            onSaved={handleSaved}
          />
        )}

        <div className="hidden bg-[#17a2b8]/10 border border-[#17a2b8]/20 rounded-xl p-4">
          <div className="flex gap-3">
            <Icon name="Info" size={20} className="text-[#17a2b8] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground mb-1">Comment ça marche ?</p>
              <p className="text-sm text-muted-foreground">
                Vous enregistrez une fois le compte bancaire qui doit recevoir votre argent. Ensuite, la plateforme garde l'argent pendant la location puis envoie automatiquement votre net quand la réservation est éligible au versement.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-card rounded-xl p-6 shadow-elevation-2">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Icon name="Star" size={18} />
            Versements en bref
          </h3>
          <div className="space-y-4">
            {BENEFITS.map((benefit) => (
              <div key={benefit.title} className="flex gap-3">
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
      </div>
    </div>
  );
};

export default PayoutSettingsTab;

