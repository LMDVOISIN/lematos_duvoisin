import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { openExternalWindow } from '../../utils/nativeRuntime';

const STATUS_CONFIGS = {
  not_connected: {
    label: 'Non connecte',
    icon: 'AlertCircle',
    color: 'text-muted-foreground bg-muted',
    description: 'Aucun compte de paiement actif detecte sur votre profil.'
  },
  connected: {
    label: 'Connecte',
    icon: 'CheckCircle',
    color: 'text-success bg-success/10',
    description: 'Un compte Stripe est reference sur votre profil et peut recevoir des virements.'
  }
};

const StripeConnectOnboarding = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [opening, setOpening] = useState(false);

  const onboardingUrl = import.meta.env?.VITE_STRIPE_CONNECT_ONBOARDING_URL || '';
  const stripeStatus = userProfile?.stripe_account_id ? 'connected' : 'not_connected';
  const statusConfig = STATUS_CONFIGS?.[stripeStatus] || STATUS_CONFIGS?.not_connected;

  const userData = useMemo(() => ({
    pseudonym: userProfile?.pseudo || user?.user_metadata?.pseudo || null,
    email: user?.email || userProfile?.email || null,
    stripeAccountId: userProfile?.stripe_account_id || null
  }), [user, userProfile]);

  const onboardingSteps = [
    {
      number: 1,
      title: 'Vérifier votre identité',
      description: "Fournissez vos informations personnelles et une pièce d'identité valide",
      icon: 'User',
      completed: stripeStatus === 'connected'
    },
    {
      number: 2,
      title: 'Ajouter vos coordonnees bancaires',
      description: 'Renseignez votre IBAN pour recevoir les paiements',
      icon: 'CreditCard',
      completed: stripeStatus === 'connected'
    },
    {
      number: 3,
      title: 'Recevoir vos virements',
      description: 'Le statut devient connecte une fois le compte Stripe lie a votre profil',
      icon: 'DollarSign',
      completed: stripeStatus === 'connected'
    }
  ];

  const benefits = [
    {
      icon: 'Shield',
      title: 'Paiements sécurisés',
      description: "Les paiements sont traités par Stripe une fois l'intégration activée."
    },
    {
      icon: 'Zap',
      title: 'Virements rapides',
      description: 'Recevez vos paiements selon les délais de versement Stripe.'
    },
    {
      icon: 'BarChart',
      title: 'Suivi en temps réel',
      description: 'Consultez les virements depuis votre dashboard Stripe Express.'
    },
    {
      icon: 'Lock',
      title: 'Protection des données',
      description: 'Les données bancaires sont gérées par Stripe.'
    },
    {
      icon: 'ShieldCheck',
      title: 'Remboursement garanti',
      description: "Remboursement minimum garanti en cas de vol ou détérioration (selon conditions)."
    }
  ];

  const handleCreateStripeAccount = async () => {
    if (!user) {
      toast?.error('Veuillez vous connecter pour activer les paiements.');
      navigate('/authentification');
      return;
    }

    if (!onboardingUrl) {
      toast?.error("Lien d'onboarding Stripe non configure sur cette instance.");
      return;
    }

    try {
      setOpening(true);
      await openExternalWindow(onboardingUrl);
      toast?.success("Ouverture de l'onboarding Stripe. Le statut sera mis à jour après liaison réelle du compte.");
    } finally {
      setOpening(false);
    }
  };

  const handleAccessDashboard = () => {
    void openExternalWindow('https://dashboard.stripe.com');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-surface">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-6 md:py-8">
          <div className="bg-white rounded-lg shadow-elevation-1 p-6">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Icon name="Loader2" size={20} className="animate-spin" />
              <span>Chargement du profil...</span>
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
            <h1 className="text-2xl font-bold text-foreground mb-2">Activation des paiements</h1>
            <p className="text-muted-foreground mb-4">Vous devez etre connecte pour consulter le statut de votre compte de paiement.</p>
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
          <a href="/tableau-bord-utilisateur" className="hover:text-[#17a2b8] transition-colors">Tableau de bord</a>
          <Icon name="ChevronRight" size={14} />
          <span className="text-foreground">Activation des paiements</span>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Activation des paiements</h1>
          <p className="text-muted-foreground">Statut detecte depuis votre profil utilisateur (champ Stripe reel).</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-elevation-1 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-foreground mb-2">Statut de votre compte</h2>
                  <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${statusConfig?.color}`}>
                    <Icon name={statusConfig?.icon} size={16} />
                    {statusConfig?.label}
                  </span>
                  <p className="text-sm text-muted-foreground mt-3">{statusConfig?.description}</p>
                </div>
              </div>

              <div className="bg-surface rounded-lg p-4 space-y-1 text-sm mb-4">
                <p><span className="text-muted-foreground">Pseudo:</span> <span className="text-foreground font-medium">{userData?.pseudonym || '-'}</span></p>
                <p><span className="text-muted-foreground">Email:</span> <span className="text-foreground font-medium">{userData?.email || '-'}</span></p>
                <p><span className="text-muted-foreground">Stripe account ID:</span> <span className="text-foreground font-medium">{userData?.stripeAccountId || 'Aucun'}</span></p>
              </div>

              {stripeStatus === 'not_connected' && (
                <div className="space-y-4">
                  <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                    <div className="flex gap-3">
                      <Icon name="AlertTriangle" size={20} className="text-warning flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-foreground mb-1">Onboarding non relie automatiquement</p>
                        <p className="text-sm text-muted-foreground">
                          Le bouton ci-dessous ne fonctionne que si un lien d'onboarding Stripe est configure cote application (`VITE_STRIPE_CONNECT_ONBOARDING_URL`).
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="lg"
                    iconName="ExternalLink"
                    onClick={handleCreateStripeAccount}
                    loading={opening}
                    disabled={!onboardingUrl}
                    className="bg-[#635bff] hover:bg-[#0a2540] disabled:opacity-50"
                  >
                    Activer mes paiements
                  </Button>
                </div>
              )}

              {stripeStatus === 'connected' && (
                <div className="mt-6 space-y-4">
                  <div className="bg-success/10 border border-success/20 rounded-lg p-4">
                    <div className="flex gap-3">
                      <Icon name="CheckCircle" size={20} className="text-success flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-foreground mb-1">Compte reference sur votre profil</p>
                        <p className="text-sm text-muted-foreground">
                          Vous pouvez publier vos annonces. Le suivi fin du statut Stripe (vérification, restrictions) n'est pas encore détaillé sur cette page.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button variant="outline" iconName="ExternalLink" onClick={handleAccessDashboard}>
                      Gérer mes paiements
                    </Button>
                    <Button variant="default" iconName="Plus" onClick={() => navigate('/creer-annonce')}>
                      Creer une annonce
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {stripeStatus !== 'connected' && (
              <div className="bg-white rounded-lg shadow-elevation-1 p-6">
                <h2 className="text-xl font-semibold text-foreground mb-6">Etapes de l'inscription</h2>
                <div className="space-y-6">
                  {onboardingSteps?.map((step) => (
                    <div key={step?.number} className="flex gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${step?.completed ? 'bg-success text-white' : 'bg-surface text-muted-foreground'}`}>
                        {step?.completed ? <Icon name="Check" size={20} /> : <Icon name={step?.icon} size={20} />}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground mb-1">{step?.number}. {step?.title}</h3>
                        <p className="text-sm text-muted-foreground">{step?.description}</p>
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
                  <p className="font-medium text-foreground mb-1">Information importante</p>
                  <p className="text-sm text-muted-foreground">
                    Cette page n'invente plus de statut Stripe: elle affiche uniquement ce qui est present sur votre profil.
                    L'activation automatique complete (creation de compte + retour Stripe + synchronisation statut) doit encore etre finalisée.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-elevation-1 p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Icon name="Star" size={18} />
                Pourquoi notre service de paiement ?
              </h3>
              <div className="space-y-4">
                {benefits?.map((benefit, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="w-10 h-10 bg-[#17a2b8]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon name={benefit?.icon} size={18} className="text-[#17a2b8]" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm mb-1">{benefit?.title}</p>
                      <p className="text-xs text-muted-foreground">{benefit?.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-elevation-1 p-6">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Icon name="HelpCircle" size={18} />
                Besoin d'aide ?
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Si vous rencontrez des difficultés, contactez le support ou revenez plus tard après configuration de l'onboarding Stripe.
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



