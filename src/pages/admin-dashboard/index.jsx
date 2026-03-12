import React, { useEffect, useState } from 'react';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Link, useNavigate } from 'react-router-dom';
import { clearAdminAccess } from '../../utils/adminAccessGate';
import seoRefreshQueueService from '../../services/seoRefreshQueueService';
import platformAnalyticsService from '../../services/platformAnalyticsService';

const SEO_QUEUE_STATUS_META = {
  pending: { label: 'En attente', color: 'text-amber-700 bg-amber-100', icon: 'Clock' },
  processing: { label: 'En cours', color: 'text-blue-700 bg-blue-100', icon: 'Loader2' },
  failed: { label: 'Echec', color: 'text-red-700 bg-red-100', icon: 'AlertTriangle' },
  done: { label: 'Termine', color: 'text-green-700 bg-green-100', icon: 'CheckCircle2' }
};

const SEO_FAILURE_RESOLUTION_META = {
  unresolved: { label: 'Non resolu', color: 'text-red-700 bg-red-100', icon: 'AlertOctagon' }
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date?.getTime())) return '-';
  return date?.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date?.getTime())) return '-';
  return date?.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const formatCurrency = (value) => {
  const number = Number(value || 0);
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  })?.format(Number.isFinite(number) ? number : 0);
};

const formatPercent = (value) => {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0%';
  return `${number?.toFixed(2)}%`;
};

const clampPercent = (value) => {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, number));
};

const toSafeNumber = (value) => {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
};

const formatIntegerWithSpaces = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const number = Math.max(0, Math.round(toSafeNumber(value)));
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0
  })
    ?.format(number)
    ?.replace(/[\u202F\u00A0]/g, ' ');
};

const parseIntegerInput = (rawValue) => {
  const digitsOnly = String(rawValue || '')
    ?.replace(/\s+/g, '')
    ?.replace(/[^\d]/g, '');

  if (!digitsOnly) return null;
  const parsed = Number(digitsOnly);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const getYearProgressRate = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
  const totalMs = end?.getTime() - start?.getTime();
  if (!Number.isFinite(totalMs) || totalMs <= 0) return 0;
  const elapsedMs = now?.getTime() - start?.getTime();
  const rate = elapsedMs / totalMs;
  return Math.max(0, Math.min(1, rate));
};

const buildLinkedObjectives = ({ source, value, metrics }) => {
  const listingCount = Math.max(0, toSafeNumber(metrics?.listingCount));
  const potentialAnnual = Math.max(0, toSafeNumber(metrics?.potentialPlatformRevenueAnnual));
  const ytdRevenue = Math.max(0, toSafeNumber(metrics?.platformRevenueYtd));
  const potentialPerListing = listingCount > 0 ? (potentialAnnual / listingCount) : 0;
  const inferredYtdRate = potentialAnnual > 0 ? (ytdRevenue / potentialAnnual) : 0;
  const ytdRate = inferredYtdRate > 0 ? inferredYtdRate : getYearProgressRate();
  const normalizedValue = Math.max(0, toSafeNumber(value));

  if (source === 'listingCount') {
    const nextPotentialAnnual = normalizedValue * potentialPerListing;
    return {
      listingCount: Math.round(normalizedValue),
      potentialPlatformRevenueAnnual: nextPotentialAnnual,
      platformRevenueYtd: nextPotentialAnnual * ytdRate
    };
  }

  if (source === 'potentialPlatformRevenueAnnual') {
    const nextListingCount = potentialPerListing > 0 ? (normalizedValue / potentialPerListing) : 0;
    return {
      listingCount: Math.round(nextListingCount),
      potentialPlatformRevenueAnnual: normalizedValue,
      platformRevenueYtd: normalizedValue * ytdRate
    };
  }

  if (source === 'platformRevenueYtd') {
    const nextPotentialAnnual = ytdRate > 0 ? (normalizedValue / ytdRate) : 0;
    const nextListingCount = potentialPerListing > 0 ? (nextPotentialAnnual / potentialPerListing) : 0;
    return {
      listingCount: Math.round(nextListingCount),
      potentialPlatformRevenueAnnual: nextPotentialAnnual,
      platformRevenueYtd: normalizedValue
    };
  }

  return {
    listingCount: null,
    potentialPlatformRevenueAnnual: null,
    platformRevenueYtd: null
  };
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [opsLoading, setOpsLoading] = useState(true);
  const [opsError, setOpsError] = useState('');
  const [seoQueueSummary, setSeoQueueSummary] = useState(null);
  const [seoFailureResolution, setSeoFailureResolution] = useState(null);
  const [analyticsSnapshot, setAnalyticsSnapshot] = useState(null);
  const [businessSnapshot, setBusinessSnapshot] = useState(null);
  const [objectiveTargets, setObjectiveTargets] = useState({
    listingCount: null,
    potentialPlatformRevenueAnnual: null,
    platformRevenueYtd: null
  });

  const handleLogout = () => {
    clearAdminAccess();
    navigate('/admin', { replace: true });
  };

  const loadOperationalInsights = async () => {
    try {
      setOpsLoading(true);
      setOpsError('');

      const [queueRes, failureResolutionRes, analyticsRes, businessRes] = await Promise.all([
        seoRefreshQueueService?.getAdminQueueSummary?.(),
        seoRefreshQueueService?.getAdminFailureResolutionView?.(),
        platformAnalyticsService?.getAdminFrequentationSnapshot?.({ days: 7, maxRows: 5000 }),
        platformAnalyticsService?.getAdminBusinessSnapshot?.()
      ]);

      setSeoQueueSummary(queueRes?.error ? null : (queueRes?.data || null));
      setSeoFailureResolution(failureResolutionRes?.error ? null : (failureResolutionRes?.data || null));
      setAnalyticsSnapshot(analyticsRes?.error ? null : (analyticsRes?.data || null));
      setBusinessSnapshot(businessRes?.error ? null : (businessRes?.data || null));

      const errors = [
        queueRes?.error?.message,
        failureResolutionRes?.error?.message,
        analyticsRes?.error?.message,
        businessRes?.error?.message
      ]?.filter(Boolean);

      if (errors?.length > 0) {
        setOpsError(errors?.join(' | '));
      }
    } catch (error) {
      console.error('Erreur chargement dashboard admin (ops/analytics):', error);
      setOpsError(error?.message || 'Impossible de charger les indicateurs operations/analytics');
    } finally {
      setOpsLoading(false);
    }
  };

  useEffect(() => {
    loadOperationalInsights();
  }, []);

  const menuItems = [
    {
      id: 'email-tracking',
      label: 'Suivi des e-mails',
      icon: 'Mail',
      path: '/administration-suivi-courriels',
      color: 'text-blue-600'
    },
    {
      id: 'task-tracking',
      label: 'Suivi des taches',
      icon: 'CheckSquare',
      path: '/administration-suivi-taches',
      color: 'text-success'
    },
    {
      id: 'matching',
      label: 'Appariement automatique',
      icon: 'Zap',
      path: '/administration-appariement',
      color: 'text-warning'
    },
    {
      id: 'moderate-listings',
      label: 'Moderer les annonces',
      icon: 'FileCheck',
      path: '/administration-moderation',
      color: 'text-blue-600'
    },
    {
      id: 'signalements',
      label: 'Gérer les signalements',
      icon: 'Flag',
      path: '/administration-signalements',
      color: 'text-error'
    },
    {
      id: 'manage-categories',
      label: 'Gérer les catégories',
      icon: 'FolderOpen',
      path: '/administration-categories',
      color: 'text-blue-600'
    },
    {
      id: 'email-templates',
      label: "Gérer les modèles d'e-mails",
      subtitle: 'edition et essai',
      icon: 'FileText',
      path: '/administration-modeles-courriels',
      color: 'text-blue-600'
    },
    {
      id: 'footer-editor',
      label: 'Modifier le pied de page',
      icon: 'Layout',
      path: '/administration-editeur-pied-page',
      color: 'text-blue-600'
    },
    {
      id: 'legal-pages',
      label: 'Modifier les pages legales',
      icon: 'Scale',
      path: '/administration-pages-legales',
      color: 'text-blue-600'
    },
    {
      id: 'faq',
      label: 'Gérer la FAQ',
      icon: 'HelpCircle',
      path: '/administration-foire-questions',
      color: 'text-blue-600'
    },
    {
      id: 'rental-contract',
      label: 'Modifier le contrat de location',
      icon: 'FileSignature',
      path: '/administration-contrat-location',
      color: 'text-blue-600'
    },
    {
      id: 'retours',
      label: 'Voir les retours',
      icon: 'MessageSquare',
      path: '/administration-retours',
      color: 'text-blue-600'
    },
    {
      id: 'users',
      label: 'Gérer les utilisateurs',
      icon: 'Users',
      path: '/administration-gestion-utilisateurs',
      color: 'text-blue-600'
    },
    {
      id: 'notifications',
      label: 'Gérer les notifications',
      icon: 'Bell',
      path: '/administration-notifications',
      color: 'text-blue-600'
    },
    {
      id: 'moderate-requests',
      label: 'Moderer les demandes',
      icon: 'ClipboardCheck',
      path: '/administration-moderation-demandes',
      color: 'text-blue-600'
    },
    {
      id: 'inspection-disputes',
      label: "Litiges etat des lieux",
      subtitle: 'moderation cautions / photos',
      icon: 'Gavel',
      path: '/administration-litiges-etat-des-lieux',
      color: 'text-red-600'
    }
  ];

  const queueCounts = seoQueueSummary?.counts || {};
  const latestQueueEntries = Array.isArray(seoQueueSummary?.latest) ? seoQueueSummary.latest : [];
  const failureResolutionCounts = seoFailureResolution?.counts || {};
  const failureResolutionEntries = Array.isArray(seoFailureResolution?.latest) ? seoFailureResolution.latest : [];
  const analyticsMetrics = analyticsSnapshot?.metrics || {};
  const businessMetrics = businessSnapshot?.metrics || {};
  const queueStatusCards = [
    { key: 'pending', value: Number(queueCounts?.pending || 0) },
    { key: 'processing', value: Number(queueCounts?.processing || 0) },
    { key: 'failed', value: Number((failureResolutionCounts?.unresolved ?? queueCounts?.failed) || 0) },
    { key: 'done', value: Number(queueCounts?.done || 0) }
  ];

  const handleObjectiveInputChange = (field, rawValue) => {
    const normalized = String(rawValue || '').trim();
    if (!normalized) {
      setObjectiveTargets({
        listingCount: null,
        potentialPlatformRevenueAnnual: null,
        platformRevenueYtd: null
      });
      return;
    }

    const parsedValue = parseIntegerInput(normalized);
    if (parsedValue === null || parsedValue < 0) {
      return;
    }

    const linked = buildLinkedObjectives({
      source: field,
      value: parsedValue,
      metrics: businessMetrics
    });

    setObjectiveTargets(linked);
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-6 md:py-8 max-w-6xl">
        <div className="mb-6">
          <Link to="/accueil-recherche" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
            <Icon name="ArrowLeft" size={16} />
            Retour au site
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-elevation-1 p-6 mb-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Administration - Tableau de bord</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" iconName="RefreshCw" onClick={loadOperationalInsights} loading={opsLoading}>
                Actualiser stats
              </Button>
              <Button variant="danger" size="sm" onClick={handleLogout}>
                Se deconnecter
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground mt-2">Bienvenue sur l'espace d'administration.</p>
        </div>

        <div className="bg-white rounded-lg shadow-elevation-1 p-6 mb-6">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Recap annonces et CA potentiel plateforme</h2>
              <p className="text-sm text-muted-foreground">
                Basé sur les annonces publiées (commission plateforme 12%).
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs text-muted-foreground">
              <Icon name="CalendarClock" size={14} />
              {businessSnapshot?.generatedAt ? `MAJ ${formatDateTime(businessSnapshot.generatedAt)}` : 'MAJ en attente'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-border bg-surface px-4 py-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Annonces publiées</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{businessMetrics?.listingCount || 0}</p>
              <p className="mt-1 text-xs text-muted-foreground">Catalogues offres actives</p>
              <div className="mt-3">
                <Input
                  type="text"
                  inputMode="numeric"
                  label="Objectif"
                  value={formatIntegerWithSpaces(objectiveTargets?.listingCount)}
                  onChange={(event) => handleObjectiveInputChange('listingCount', event?.target?.value)}
                  placeholder="Ex: 50"
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface px-4 py-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">CA potentiel annuel plateforme</p>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {formatCurrency(businessMetrics?.potentialPlatformRevenueAnnual)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Projection sur {businessMetrics?.year || new Date()?.getFullYear()}
              </p>
              <div className="mt-3">
                <Input
                  type="text"
                  inputMode="numeric"
                  label="Objectif (EUR)"
                  value={formatIntegerWithSpaces(objectiveTargets?.potentialPlatformRevenueAnnual)}
                  onChange={(event) => handleObjectiveInputChange('potentialPlatformRevenueAnnual', event?.target?.value)}
                  placeholder="Ex: 50 000"
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface px-4 py-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">CA realise depuis debut d'annee</p>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {formatCurrency(businessMetrics?.platformRevenueYtd)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Depuis le {formatDate(businessMetrics?.periodStartIso)}
              </p>
              <div className="mt-3">
                <Input
                  type="text"
                  inputMode="numeric"
                  label="Objectif (EUR)"
                  value={formatIntegerWithSpaces(objectiveTargets?.platformRevenueYtd)}
                  onChange={(event) => handleObjectiveInputChange('platformRevenueYtd', event?.target?.value)}
                  placeholder="Ex: 10 000"
                />
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Saisis un objectif dans une case: les deux autres sont deduits automatiquement.
          </p>

          <div className="mt-4 rounded-lg border border-border bg-surface px-4 py-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm font-medium text-foreground">
                Atteinte du CA potentiel annuel
              </p>
              <p className="text-sm font-semibold text-foreground">
                {formatPercent(businessMetrics?.attainmentRateYtd)}
              </p>
            </div>
            <div className="mt-2 h-2 rounded-full bg-border overflow-hidden">
              <div
                className="h-full bg-[#17a2b8] transition-all"
                style={{ width: `${clampPercent(businessMetrics?.attainmentRateYtd)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {formatCurrency(businessMetrics?.platformRevenueYtd)} / {formatCurrency(businessMetrics?.potentialPlatformRevenueAnnual)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-elevation-1 p-6 mb-6">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Operations SEO et frequentation</h2>
              <p className="text-sm text-muted-foreground">
                Queue de refresh SEO annonces + suivi analytics first-party (24h / 7j)
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs text-muted-foreground">
              <Icon name="Clock" size={14} />
              {analyticsSnapshot?.generatedAt ? `MAJ ${formatDateTime(analyticsSnapshot.generatedAt)}` : 'MAJ en attente'}
            </div>
          </div>

          {opsError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {opsError}
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="RefreshCw" size={16} className="text-blue-600" />
                <h3 className="font-semibold text-foreground">Queue refresh SEO annonces</h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {queueStatusCards.map(({ key, value }) => {
                  const meta = SEO_QUEUE_STATUS_META?.[key] || SEO_QUEUE_STATUS_META.pending;
                  return (
                    <div key={key} className="rounded-lg border border-border bg-surface px-3 py-3">
                      <div className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${meta?.color}`}>
                        <Icon name={meta?.icon} size={12} className={key === 'processing' ? 'animate-spin' : ''} />
                        {meta?.label}
                      </div>
                      <p className="mt-2 text-xl font-bold text-foreground">{value}</p>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-surface border-b border-border gap-3">
                  <p className="text-sm font-medium text-foreground">Dernieres demandes</p>
                  <p className="text-xs text-muted-foreground">Traitees par ta tache planifiee locale</p>
                </div>
                {latestQueueEntries.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-muted-foreground">Aucune demande SEO enregistree pour le moment.</div>
                ) : (
                  <div className="divide-y divide-border">
                    {latestQueueEntries.map((entry) => {
                      const meta = SEO_QUEUE_STATUS_META?.[entry?.status] || SEO_QUEUE_STATUS_META.pending;
                      return (
                        <div key={entry?.id} className="px-3 py-3">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground">
                                #{entry?.id} · annonce {entry?.annonce_id || '-'}
                              </p>
                              <p className="text-xs text-muted-foreground break-all">
                                {entry?.source || '-'} · {entry?.reason || '-'}
                              </p>
                            </div>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${meta?.color}`}>
                              <Icon name={meta?.icon} size={11} className={entry?.status === 'processing' ? 'animate-spin' : ''} />
                              {meta?.label}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>Cree: {formatDateTime(entry?.created_at)}</span>
                            {entry?.processed_at ? <span>Traite: {formatDateTime(entry?.processed_at)}</span> : null}
                            {entry?.error_message ? <span className="text-red-600 break-all">Erreur: {entry?.error_message}</span> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="BarChart3" size={16} className="text-blue-600" />
                <h3 className="font-semibold text-foreground">Frequentation plateforme (analytics)</h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="rounded-lg border border-border bg-surface px-3 py-3">
                  <p className="text-xs text-muted-foreground">Pages vues 24h</p>
                  <p className="mt-1 text-xl font-bold text-foreground">{analyticsMetrics?.pageViews24h || 0}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface px-3 py-3">
                  <p className="text-xs text-muted-foreground">Visiteurs 24h</p>
                  <p className="mt-1 text-xl font-bold text-foreground">{analyticsMetrics?.uniqueVisitors24h || 0}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface px-3 py-3">
                  <p className="text-xs text-muted-foreground">Pages vues 7j</p>
                  <p className="mt-1 text-xl font-bold text-foreground">{analyticsMetrics?.pageViews7d || 0}</p>
                </div>
                <div className="rounded-lg border border-border bg-surface px-3 py-3">
                  <p className="text-xs text-muted-foreground">Sessions 7j</p>
                  <p className="mt-1 text-xl font-bold text-foreground">{analyticsMetrics?.sessions7d || 0}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Engagement (7j)</p>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Pages engagees &gt;= 15s</p>
                      <p className="text-lg font-semibold text-foreground">{analyticsMetrics?.engagedViews7d || 0}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Taux engagement</p>
                      <p className="text-lg font-semibold text-foreground">{analyticsMetrics?.engagementRate7d || 0}%</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Couverture (7j)</p>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Visiteurs</p>
                      <p className="text-lg font-semibold text-foreground">{analyticsMetrics?.uniqueVisitors7d || 0}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Sessions</p>
                      <p className="text-lg font-semibold text-foreground">{analyticsMetrics?.sessions7d || 0}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div className="flex items-center gap-2">
                <Icon name="AlertTriangle" size={16} className="text-red-600" />
                <h3 className="font-semibold text-foreground">Echecs SEO non resolus</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Les echecs deja resolus sont masques. La carte Echec ci-dessus reflète uniquement ce reliquat.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-surface px-3 py-3 mb-4">
              <div className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${SEO_FAILURE_RESOLUTION_META.unresolved.color}`}>
                <Icon name={SEO_FAILURE_RESOLUTION_META.unresolved.icon} size={12} />
                {SEO_FAILURE_RESOLUTION_META.unresolved.label}
              </div>
              <p className="mt-2 text-xl font-bold text-foreground">{Number(failureResolutionCounts?.unresolved || 0)}</p>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-surface border-b border-border gap-3">
                <p className="text-sm font-medium text-foreground">Echecs non resolus</p>
                <p className="text-xs text-muted-foreground">Seulement les echecs encore sans succes ulterieur.</p>
              </div>

              {failureResolutionEntries.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">Aucun echec SEO non resolu.</div>
              ) : (
                <div className="divide-y divide-border">
                  {failureResolutionEntries.map((entry) => {
                    return (
                      <div key={entry?.id} className="px-3 py-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              Echec #{entry?.id} · annonce {entry?.annonce_id || '-'}
                            </p>
                            <p className="text-xs text-muted-foreground break-all">
                              {entry?.source || '-'} · {entry?.reason || '-'}
                            </p>
                          </div>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${SEO_FAILURE_RESOLUTION_META.unresolved.color}`}>
                            <Icon name={SEO_FAILURE_RESOLUTION_META.unresolved.icon} size={11} />
                            {SEO_FAILURE_RESOLUTION_META.unresolved.label}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>Echec: {formatDateTime(entry?.processed_at || entry?.created_at)}</span>
                        </div>

                        {entry?.error_message ? (
                          <p className="mt-2 text-xs text-red-600 break-all">
                            Erreur: {entry?.error_message}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="px-3 py-2 bg-surface border-b border-border">
                    <p className="text-sm font-medium text-foreground">Top pages (7j)</p>
                  </div>
                  {(analyticsSnapshot?.topPages || []).length === 0 ? (
                    <div className="px-3 py-4 text-sm text-muted-foreground">Aucune donnee.</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {(analyticsSnapshot?.topPages || []).map((entry) => (
                        <div key={entry?.label} className="px-3 py-2 flex items-center justify-between gap-3">
                          <p className="text-sm text-foreground truncate">{entry?.label || '-'}</p>
                          <span className="text-xs font-medium text-muted-foreground">{entry?.count || 0}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="px-3 py-2 bg-surface border-b border-border">
                    <p className="text-sm font-medium text-foreground">Top referrers externes (7j)</p>
                  </div>
                  {(analyticsSnapshot?.topReferrers || []).length === 0 ? (
                    <div className="px-3 py-4 text-sm text-muted-foreground">Aucun referrer externe mesure.</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {(analyticsSnapshot?.topReferrers || []).map((entry) => (
                        <div key={entry?.label} className="px-3 py-2 flex items-center justify-between gap-3">
                          <p className="text-sm text-foreground truncate">{entry?.label || '-'}</p>
                          <span className="text-xs font-medium text-muted-foreground">{entry?.count || 0}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                Les stats respectent le consentement cookies analytics et s'alimentent automatiquement via GA4 + analytics first-party Supabase.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-elevation-1 p-6">
          <div className="space-y-2">
            {menuItems?.map((item) => (
              <Link
                key={item?.id}
                to={item?.path}
                className="flex items-center gap-3 px-4 py-3 rounded-md hover:bg-surface transition-colors group"
              >
                <div className={`${item?.color}`}>
                  <Icon name={item?.icon} size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-blue-600 group-hover:text-blue-700 font-medium">{item?.label}</p>
                  {item?.subtitle ? <p className="text-xs text-muted-foreground">{item?.subtitle}</p> : null}
                </div>
                <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AdminDashboard;


