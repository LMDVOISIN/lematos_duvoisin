import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Filter,
  Loader2,
  PlayCircle,
  Search,
  ShieldAlert,
  TimerReset,
  XCircle
} from 'lucide-react';

import Button from '../../../components/ui/Button';
import adminTestVerificationService from '../../../services/adminTestVerificationService';
import runBrowserVerification from '../../../utils/adminBrowserVerificationRunner';
import {
  buildAdminVerificationCatalog,
  getVerificationCategoryMeta,
  VERIFICATION_CATEGORY_ORDER
} from '../../../utils/adminVerificationCatalog';
import { downloadAdminTestVerificationPdf } from '../../../utils/adminTestVerificationPdf';

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString('fr-FR');
};

const formatDuration = (durationMs) => {
  if (!Number.isFinite(Number(durationMs))) return 'N/A';
  const totalMs = Math.max(0, Number(durationMs));
  if (totalMs < 1000) return `${totalMs} ms`;

  const totalSec = Math.round(totalMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;

  if (minutes <= 0) return `${seconds} s`;
  return `${minutes} min ${String(seconds).padStart(2, '0')} s`;
};

const getStatusMeta = (status) => {
  if (status === 'passed') {
    return {
      label: 'Réussi',
      className: 'border-green-200 bg-green-50 text-green-800',
      Icon: CheckCircle2
    };
  }

  if (status === 'warning') {
    return {
      label: 'Avec réserves',
      className: 'border-amber-200 bg-amber-50 text-amber-900',
      Icon: AlertTriangle
    };
  }

  if (status === 'failed') {
    return {
      label: 'Échec',
      className: 'border-red-200 bg-red-50 text-red-800',
      Icon: XCircle
    };
  }

  if (status === 'blocked') {
    return {
      label: 'Bloqué',
      className: 'border-slate-200 bg-slate-50 text-slate-600',
      Icon: AlertTriangle
    };
  }

  return {
    label: 'Jamais lancé',
    className: 'border-slate-200 bg-slate-50 text-slate-600',
    Icon: ClipboardCheck
  };
};

const buildCatalogBatchReport = (results = []) => {
  const normalizedResults = (results || []).filter(Boolean);
  const failed = normalizedResults.filter((item) => item?.overallStatus === 'failed').length;
  const warnings = normalizedResults.filter((item) => item?.overallStatus === 'warning').length;
  const passed = normalizedResults.filter((item) => item?.overallStatus === 'passed').length;
  const executedAt = new Date().toISOString();

  let overallStatus = 'passed';
  if (failed > 0) overallStatus = 'failed';
  else if (warnings > 0) overallStatus = 'warning';

  return {
    kind: 'batch',
    verificationId: 'catalog_run_all',
    title: 'Vérification complète du catalogue',
    category: 'catalog',
    categoryLabel: 'Catalogue complet',
    automationMode: 'catalog_batch',
    executedAt,
    durationMs: normalizedResults.reduce((accumulator, item) => accumulator + Number(item?.durationMs || 0), 0),
    overallStatus,
    overallMessage: failed > 0
      ? `${failed} parcours ont échoué sur ${normalizedResults.length}.`
      : warnings > 0
        ? `${warnings} parcours ont été validés avec réserves sur ${normalizedResults.length}.`
        : `Les ${normalizedResults.length} parcours exécutés ont été validés.`,
    summary: {
      total: normalizedResults.length,
      passed,
      warning: warnings,
      failed
    },
    items: normalizedResults
  };
};

const VerificationTab = () => {
  const [loading, setLoading] = useState(true);
  const [catalogItems, setCatalogItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [runningId, setRunningId] = useState('');
  const [runningAll, setRunningAll] = useState(false);
  const [activeReport, setActiveReport] = useState(null);
  const [resultsById, setResultsById] = useState({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.__ldvAdminVerificationActiveReport = activeReport;
  }, [activeReport]);

  useEffect(() => {
    let cancelled = false;

    const loadCatalog = async () => {
      setLoading(true);
      const { data, error } = await adminTestVerificationService.getCatalogContext();

      if (cancelled) return;

      if (error) {
        toast.error(error.message || 'Impossible de charger le catalogue de vérification.');
        setCatalogItems([]);
        setLoading(false);
        return;
      }

      const context = data?.context || {};
      setCatalogItems(buildAdminVerificationCatalog(context));
      setLoading(false);
    };

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const normalizedSearch = String(searchTerm || '').trim().toLowerCase();

    return catalogItems.filter((item) => {
      if (categoryFilter !== 'all' && item?.category !== categoryFilter) {
        return false;
      }

      if (!normalizedSearch) return true;

      const haystack = [
        item?.title,
        item?.categoryLabel,
        item?.scopeNote,
        item?.knownLimitationNote,
        item?.externalDependencyNote
      ].join(' ').toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [catalogItems, categoryFilter, searchTerm]);

  const runSingleItem = async (item) => {
    if (!item?.id) return null;

    if (!item?.isRunnable) {
      return {
        ok: false,
        verification: {
          kind: 'single',
          verificationId: item.id,
          title: item.title,
          category: item.category,
          categoryLabel: item.categoryLabel,
          automationMode: item.automationMode,
          executedAt: new Date().toISOString(),
          durationMs: 0,
          overallStatus: 'failed',
          overallMessage: item?.blockingReason || 'Parcours non exécutable dans le contexte courant.',
          coverage: {
            browserNavigation: item?.automationMode !== 'tester_pairs_batch',
            uiRendering: item?.automationMode !== 'tester_pairs_batch',
            backendFlow: item?.automationMode === 'tester_pairs_batch'
          },
          steps: []
        }
      };
    }

    if (item?.automationMode === 'tester_pairs_batch') {
      return adminTestVerificationService.runAllTesterPairs({
        includePauseResume: true
      });
    }

    if (item?.automationMode === 'tester_pair_backend') {
      return adminTestVerificationService.runVerification({
        verificationId: item?.id,
        referenceScenarioId: item?.referenceScenarioId,
        includePauseResume: true
      });
    }

    const browserResult = await runBrowserVerification(item);
    return {
      data: browserResult,
      error: browserResult?.ok === false
        ? {
          message: browserResult?.verification?.overallMessage || 'La vérification navigateur a échoué.'
        }
        : null
    };
  };

  const handleRunVerification = async (item) => {
    if (!item?.id) return;

    setRunningId(item.id);
    const { data, error } = await runSingleItem(item);
    setRunningId('');

    const verification = data?.verification || null;
    if (verification) {
      setResultsById((previous) => ({
        ...previous,
        [item.id]: verification
      }));
      setActiveReport(verification);
    }

    if (error) {
      toast.error(error.message || 'La vérification a échoué.');
      return;
    }

    toast.success('Vérification terminée.');
  };

  const handleRunAll = async () => {
    const runnableItems = filteredItems.filter((item) => item?.isRunnable && item?.excludeFromRunAll !== true);
    if (!runnableItems.length) {
      toast.error('Aucun parcours exécutable avec le filtre courant.');
      return;
    }

    setRunningAll(true);
    const collectedReports = [];

    for (const item of runnableItems) {
      setRunningId(item.id);
      // eslint-disable-next-line no-await-in-loop
      const { data, error } = await runSingleItem(item);
      const verification = data?.verification || null;

      if (verification) {
        collectedReports.push(verification);
        setResultsById((previous) => ({
          ...previous,
          [item.id]: verification
        }));
      } else if (error) {
        collectedReports.push({
          kind: 'single',
          verificationId: item.id,
          title: item.title,
          category: item.category,
          categoryLabel: item.categoryLabel,
          automationMode: item.automationMode,
          executedAt: new Date().toISOString(),
          durationMs: 0,
          overallStatus: 'failed',
          overallMessage: error.message || 'La vérification a échoué.',
          coverage: {
            browserNavigation: item?.automationMode !== 'tester_pairs_batch',
            uiRendering: item?.automationMode !== 'tester_pairs_batch',
            backendFlow: item?.automationMode === 'tester_pairs_batch'
          },
          steps: []
        });
      }
    }

    setRunningId('');
    setRunningAll(false);

    const batchReport = buildCatalogBatchReport(collectedReports);
    setActiveReport(batchReport);

    if (batchReport?.overallStatus === 'failed') {
      toast.error('La vérification globale a relevé des échecs.');
      return;
    }

    if (batchReport?.overallStatus === 'warning') {
      toast('La vérification globale est terminée avec réserves.', {
        icon: '⚠️'
      });
      return;
    }

    toast.success('La vérification globale est terminée.');
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Chargement du catalogue complet de vérification…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-blue-700" />
          <div className="space-y-2 text-sm text-blue-950">
            <p className="font-semibold">Catalogue complet de vérification</p>
            <p>
              Cet écran regroupe les parcours publics, compte, réservations, back-office, programme testeur et zones
              partielles. Chaque carte lance soit un contrôle navigateur sur les routes et affordances, soit une
              vérification backend dédiée.
            </p>
            <p>
              Le bouton global exécute tous les parcours filtrés en un clic puis génère un rapport PDF téléchargeable.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value || '')}
              placeholder="Rechercher un parcours, une catégorie ou une limitation"
              className="w-full border-0 bg-transparent text-sm outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              Catégorie
            </span>
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Toutes
            </button>
            {VERIFICATION_CATEGORY_ORDER.map((category) => {
              const meta = getVerificationCategoryMeta(category);
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setCategoryFilter(category)}
                  className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                    categoryFilter === category
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {meta.shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <p className="text-sm text-muted-foreground">
            {filteredItems.length} parcours affiché(s)
          </p>

          <Button
            variant="default"
            loading={runningAll}
            onClick={handleRunAll}
            data-testid="admin-verification-run-all"
          >
            Tout vérifier
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const lastResult = resultsById?.[item.id] || null;
            const statusMeta = getStatusMeta(
              !item?.isRunnable && !lastResult ? 'blocked' : lastResult?.overallStatus
            );
            const StatusIcon = statusMeta.Icon;
            const isRunning = runningId === item.id;

            return (
              <div key={item.id} className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        {item?.categoryShortLabel || item?.categoryLabel}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${statusMeta.className}`}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {statusMeta.label}
                      </span>
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                        {item?.automationMode === 'browser_smoke'
                          ? 'UI navigateur'
                          : item?.automationMode === 'tester_pairs_batch'
                            ? 'Backend batch'
                            : 'Backend'}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground">{item?.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{item?.scopeNote}</p>
                    </div>

                    {(item?.knownLimitationNote || item?.externalDependencyNote || item?.blockingReason) && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        {item?.blockingReason || item?.knownLimitationNote || item?.externalDependencyNote}
                      </div>
                    )}

                    {lastResult?.executedAt && (
                      <p className="text-sm text-muted-foreground">
                        Dernier lancement: {formatDateTime(lastResult.executedAt)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-start gap-2 lg:items-end">
                    <Button
                      variant="default"
                      loading={isRunning}
                      disabled={!item?.isRunnable || runningAll}
                      onClick={() => handleRunVerification(item)}
                      data-testid={`admin-verification-run-${item.id}`}
                    >
                      Lancer la vérification
                    </Button>
                    {lastResult && (
                      <button
                        type="button"
                        onClick={() => setActiveReport(lastResult)}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Ouvrir le dernier rapport
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {!filteredItems.length && (
            <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
              <p className="text-sm text-muted-foreground">Aucun parcours ne correspond au filtre courant.</p>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          {!activeReport ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
              <PlayCircle className="h-10 w-10 text-slate-300" />
              <p className="mt-4 font-medium text-foreground">Aucun rapport ouvert</p>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Lancez une vérification individuelle ou le catalogue complet pour afficher ici le rapport détaillé.
              </p>
            </div>
          ) : activeReport?.kind === 'batch' ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{activeReport?.categoryLabel || 'Batch'}</p>
                  <h3 className="mt-1 text-xl font-bold text-foreground">{activeReport?.title || 'Rapport global'}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{activeReport?.overallMessage}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => downloadAdminTestVerificationPdf(activeReport)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  PDF
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Exécution</p>
                  <p className="mt-2 text-sm text-foreground">{formatDateTime(activeReport?.executedAt)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Durée</p>
                  <p className="mt-2 text-sm text-foreground">{formatDuration(activeReport?.durationMs)}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
                  <p className="text-xs uppercase tracking-wide text-green-700">Réussis</p>
                  <p className="mt-2 text-2xl font-bold text-green-900" data-testid="admin-verification-summary-passed">
                    {Number(activeReport?.summary?.passed || 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                  <p className="text-xs uppercase tracking-wide text-amber-700">Réserves</p>
                  <p className="mt-2 text-2xl font-bold text-amber-900" data-testid="admin-verification-summary-warning">
                    {Number(activeReport?.summary?.warning || 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
                  <p className="text-xs uppercase tracking-wide text-red-700">Échecs</p>
                  <p className="mt-2 text-2xl font-bold text-red-900" data-testid="admin-verification-summary-failed">
                    {Number(activeReport?.summary?.failed || 0)}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">Résultats</p>
                {(activeReport?.items || []).map((item, index) => {
                  const itemStatus = getStatusMeta(item?.overallStatus);
                  const ItemIcon = itemStatus.Icon;
                  return (
                    <button
                      key={`${item?.verificationId || index}-${index}`}
                      type="button"
                      onClick={() => setActiveReport(item)}
                      className="w-full rounded-xl border border-slate-200 p-4 text-left transition hover:border-primary"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full ${item?.overallStatus === 'failed' ? 'bg-red-100 text-red-700' : item?.overallStatus === 'warning' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'}`}>
                            <ItemIcon className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="font-medium text-foreground">{item?.title || 'Parcours'}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{item?.overallMessage || 'N/A'}</p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDuration(item?.durationMs)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {activeReport?.categoryLabel || activeReport?.category || 'Parcours'}
                  </p>
                  <h3 className="mt-1 text-xl font-bold text-foreground">
                    {activeReport?.title || activeReport?.pair?.referenceTitle || 'Rapport'}
                  </h3>
                  {activeReport?.pair?.mirrorTitle && (
                    <p className="mt-1 text-sm text-muted-foreground">Miroir: {activeReport?.pair?.mirrorTitle}</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => downloadAdminTestVerificationPdf(activeReport)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  PDF
                </Button>
              </div>

              <div className={`rounded-2xl border p-4 ${
                activeReport?.overallStatus === 'passed'
                  ? 'border-green-200 bg-green-50'
                  : activeReport?.overallStatus === 'warning'
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-red-200 bg-red-50'
              }`}>
                <p className="font-semibold text-foreground">{getStatusMeta(activeReport?.overallStatus)?.label}</p>
                <p className="mt-2 text-sm text-foreground">{activeReport?.overallMessage || 'N/A'}</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Exécution</p>
                  <p className="mt-2 text-sm text-foreground">{formatDateTime(activeReport?.executedAt)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Durée</p>
                  <p className="mt-2 text-sm text-foreground">{formatDuration(activeReport?.durationMs)}</p>
                </div>
              </div>

              {activeReport?.scopeNote && (
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-foreground">Portée</p>
                  <p className="mt-2 text-sm text-muted-foreground">{activeReport.scopeNote}</p>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-foreground">Étapes exécutées</p>
                <div className="mt-3 space-y-3">
                  {(activeReport?.steps || []).map((step, index) => {
                    const stepStatus = getStatusMeta(step?.status);
                    const StepIcon = stepStatus.Icon;

                    return (
                      <div key={`${step?.key || index}-${index}`} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full ${step?.status === 'failed' ? 'bg-red-100 text-red-700' : step?.status === 'warning' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'}`}>
                              <StepIcon className="h-4 w-4" />
                            </span>
                            <div>
                              <p className="font-medium text-foreground">{step?.label || step?.key}</p>
                              <p className="mt-1 text-sm text-muted-foreground">{step?.message || 'N/A'}</p>
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <TimerReset className="h-3.5 w-3.5" />
                            {formatDuration(step?.durationMs)}
                          </span>
                        </div>

                        {step?.details && (
                          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                            {Object.entries(step.details).map(([key, value]) => (
                              <p key={key}>
                                <span className="font-semibold text-slate-900">{key}:</span>{' '}
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerificationTab;
