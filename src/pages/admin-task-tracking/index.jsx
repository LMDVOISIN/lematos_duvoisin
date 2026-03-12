import React, { useEffect, useMemo, useState } from 'react';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const TASK_DEFINITIONS = [
  {
    id: 'check_owner_no_response',
    name: 'Validation propriétaire (désactivée)',
    description: 'Désactivée : réservations instantanées sans attente de réponse propriétaire',
    fallback: 'Clock'
  },
  {
    id: 'check_missing_documents',
    name: 'Contrôle CNI post-paiement',
    description: 'Annule les réservations payées sans CNI à temps (1 jour facturé, reste remboursé)',
    fallback: 'FileText'
  },
  {
    id: 'release_deposits',
    name: 'Libération des cautions',
    description: 'Libération automatique des cautions',
    fallback: 'DollarSign'
  },
  {
    id: 'send_daily_digest',
    name: 'Notifications quotidiennes',
    description: 'Envoi du digest des notifications non lues',
    fallback: 'Mail'
  },
  {
    id: 'cancel_unpaid_reservations',
    name: 'Annulations impayées',
    description: 'Annulation des réservations non payées (si payment_deadline est configuré)',
    fallback: 'XCircle'
  },
  {
    id: 'process_strikes',
    name: "Émission d'avertissements",
    description: 'Traitement des sanctions automatiques',
    fallback: 'AlertTriangle'
  }
];

function normalizeRunStatus(status) {
  const raw = String(status || '')?.toLowerCase();
  if (raw === 'success' || raw === 'completed' || raw === 'done') return 'success';
  if (raw === 'error' || raw === 'failed') return 'error';
  if (raw === 'running') return 'running';
  return 'unknown';
}

function getTaskStatusFromRuns(runs) {
  if (!runs?.length) return 'paused';

  const latest = runs?.[0];
  const latestStatus = normalizeRunStatus(latest?.status);
  if (latestStatus === 'error') return 'error';
  if (latestStatus === 'running') return 'active';

  const latestDate = new Date(latest?.created_at || latest?.executed_at || 0);
  const hoursSinceLatest = (Date.now() - latestDate?.getTime()) / (1000 * 60 * 60);

  if (Number.isFinite(hoursSinceLatest) && hoursSinceLatest > 72) return 'paused';
  return 'active';
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date?.getTime())) return '-';

  return date?.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getStatusBadge(status) {
  const badges = {
    active: { label: 'Actif', color: 'bg-success/10 text-success', icon: 'CheckCircle' },
    paused: { label: 'En pause', color: 'bg-warning/10 text-warning', icon: 'Pause' },
    error: { label: 'Erreur', color: 'bg-error/10 text-error', icon: 'AlertCircle' }
  };

  return badges?.[status] || badges?.paused;
}

const AdminTaskTracking = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    loadTasks();
  }, []);

  const loadFallbackTasks = async (sourceError) => {
    try {
      const [
        { count: totalEmails, error: totalEmailError },
        { count: failedEmails, error: failedEmailError },
        { count: pendingReservations, error: pendingReservationsError },
        { count: completedReservations, error: completedReservationsError }
      ] = await Promise.all([
        supabase?.from('email_queue')?.select('*', { count: 'exact', head: true }),
        supabase?.from('email_queue')?.select('*', { count: 'exact', head: true })?.eq('status', 'failed'),
        supabase?.from('reservations')?.select('*', { count: 'exact', head: true })?.in('status', ['pending', 'accepted']),
        supabase?.from('reservations')?.select('*', { count: 'exact', head: true })?.eq('status', 'completed')
      ]);

      if (totalEmailError || failedEmailError || pendingReservationsError || completedReservationsError) {
        throw totalEmailError || failedEmailError || pendingReservationsError || completedReservationsError;
      }

      const total = Number(totalEmails || 0);
      const failed = Number(failedEmails || 0);
      const emailSuccessRate = total > 0 ? ((total - failed) / total) * 100 : 100;

      setTasks([
        {
          id: 'fallback-emails',
          name: 'Automatisation notifications',
          description: 'Statistiques calculees depuis email_queue',
          status: failed > 0 ? 'error' : 'active',
          lastRun: null,
          nextRun: null,
          successRate: Number(emailSuccessRate?.toFixed(1)),
          totalRuns: total,
          error: failed > 0 ? `${failed} echec(s) recents` : null,
          icon: 'Mail'
        },
        {
          id: 'fallback-reservations-pending',
          name: 'Réservations à payer',
          description: 'Volume actuel des reservations sans paiement finalise',
          status: 'active',
          lastRun: null,
          nextRun: null,
          successRate: 100,
          totalRuns: Number(pendingReservations || 0),
          error: null,
          icon: 'Clock'
        },
        {
          id: 'fallback-reservations-completed',
          name: 'Locations terminees',
          description: 'Volume actuel des reservations terminees',
          status: 'active',
          lastRun: null,
          nextRun: null,
          successRate: 100,
          totalRuns: Number(completedReservations || 0),
          error: null,
          icon: 'CheckCircle'
        }
      ]);

      // Fallback loaded successfully: keep UI usable without a blocking error banner.
      setFetchError('');
    } catch (fallbackError) {
      console.error('Erreur de fallback suivi taches:', fallbackError);
      setFetchError(sourceError?.message || fallbackError?.message || 'Impossible de charger les taches automatisees');
      setTasks([]);
    }
  };

  const loadTasks = async () => {
    try {
      setLoading(true);
      setFetchError('');

      const { data, error } = await supabase
        ?.from('job_runs')
        ?.select('*')
        ?.order('created_at', { ascending: false })
        ?.limit(500);

      if (error) {
        throw error;
      }

      const runs = Array?.isArray(data) ? data : [];

      const taskRows = TASK_DEFINITIONS?.map((definition) => {
        const runsForTask = runs?.filter((run) => run?.action === definition?.id);
        const successRuns = runsForTask?.filter((run) => normalizeRunStatus(run?.status) === 'success');
        const errorRuns = runsForTask?.filter((run) => normalizeRunStatus(run?.status) === 'error');
        const totalRuns = runsForTask?.length || 0;
        const successRate = totalRuns > 0 ? (successRuns?.length / totalRuns) * 100 : 0;
        const status = getTaskStatusFromRuns(runsForTask);

        return {
          id: definition?.id,
          name: definition?.name,
          description: definition?.description,
          status,
          lastRun: runsForTask?.[0]?.created_at || runsForTask?.[0]?.executed_at || null,
          nextRun: null,
          successRate: Number(successRate?.toFixed(1)),
          totalRuns,
          error: errorRuns?.[0]?.error_message || null,
          icon: definition?.fallback
        };
      });

      setTasks(taskRows);
    } catch (error) {
      console.error('Erreur de chargement du suivi des taches:', error);
      await loadFallbackTasks(error);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const active = tasks?.filter((task) => task?.status === 'active')?.length || 0;
    const paused = tasks?.filter((task) => task?.status === 'paused')?.length || 0;
    const errors = tasks?.filter((task) => task?.status === 'error')?.length || 0;

    const withRuns = tasks?.filter((task) => task?.totalRuns > 0) || [];
    const avgSuccessRate = withRuns?.length > 0
      ? withRuns?.reduce((sum, task) => sum + (task?.successRate || 0), 0) / withRuns?.length
      : 0;

    return {
      active,
      paused,
      errors,
      avgSuccessRate: Number(avgSuccessRate?.toFixed(1))
    };
  }, [tasks]);

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <main className="flex-1 container mx-auto px-4 pt-20 pb-6 md:pt-24 md:pb-8">
        <div className="mb-6">
          <Link to="/administration-tableau-bord" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
            <Icon name="ArrowLeft" size={16} />
            Retour au tableau de bord
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Suivi des taches</h1>
          <p className="text-muted-foreground">Surveillez les taches automatisees de la plateforme</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-elevation-1 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10 text-success">
                <Icon name="CheckCircle" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.active}</p>
                <p className="text-xs text-muted-foreground">Taches actives</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-elevation-1 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10 text-warning">
                <Icon name="Pause" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.paused}</p>
                <p className="text-xs text-muted-foreground">En pause</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-elevation-1 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-error/10 text-error">
                <Icon name="AlertCircle" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.errors}</p>
                <p className="text-xs text-muted-foreground">En erreur</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-elevation-1 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                <Icon name="Activity" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.avgSuccessRate}%</p>
                <p className="text-xs text-muted-foreground">Taux de succès</p>
              </div>
            </div>
          </div>
        </div>

        {fetchError && (
          <div className="bg-error/10 border border-error/20 text-error rounded-lg px-4 py-3 mb-6 text-sm">
            {fetchError}
          </div>
        )}

        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-lg shadow-elevation-1 p-8 text-center text-muted-foreground">
              Chargement des taches...
            </div>
          ) : tasks?.length === 0 ? (
            <div className="bg-white rounded-lg shadow-elevation-1 p-8 text-center text-muted-foreground">
              Aucune tache disponible.
            </div>
          ) : (
            tasks?.map((task) => {
              const statusBadge = getStatusBadge(task?.status);

              return (
                <div key={task?.id} className="bg-white rounded-lg shadow-elevation-1 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">{task?.name}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusBadge?.color}`}>
                          <Icon name={statusBadge?.icon} size={12} />
                          {statusBadge?.label}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{task?.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" iconName="RefreshCw" onClick={loadTasks}>
                        Actualiser
                      </Button>
                    </div>
                  </div>

                  {task?.error && (
                    <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-md">
                      <div className="flex items-center gap-2 text-error">
                        <Icon name="AlertTriangle" size={16} />
                        <span className="text-sm font-medium">{task?.error}</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Derniere execution</p>
                      <p className="text-sm font-medium text-foreground">{formatDate(task?.lastRun)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Prochaine exécution</p>
                      <p className="text-sm font-medium text-foreground">{formatDate(task?.nextRun)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Taux de succès</p>
                      <p className="text-sm font-medium text-foreground">{task?.successRate}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Total d'exécutions</p>
                      <p className="text-sm font-medium text-foreground">{task?.totalRuns}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AdminTaskTracking;



