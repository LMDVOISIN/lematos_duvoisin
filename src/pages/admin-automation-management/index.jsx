import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import automationService from '../../services/automationService';
import { supabase } from '../../lib/supabase';

const AdminAutomationManagement = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [jobRuns, setJobRuns] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [runningAutomation, setRunningAutomation] = useState(null);
  const [automationStats, setAutomationStats] = useState({});

  useEffect(() => {
    loadJobRuns();
    loadAutomationStats();
  }, []);

  const loadJobRuns = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        ?.from('job_runs')
        ?.select('*')
        ?.order('created_at', { ascending: false })
        ?.limit(50);

      if (error) throw error;
      setJobRuns(data || []);
      setLoading(false);
    } catch (err) {
      console.error('Erreur de chargement des exécutions :', err);
      setLoading(false);
    }
  };

  const loadAutomationStats = async () => {
    try {
      const { data, error } = await supabase
        ?.from('job_runs')
        ?.select('action, status')
        ?.gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)?.toISOString());

      if (error) throw error;

      const stats = {};
      data?.forEach(run => {
        if (!stats?.[run?.action]) {
          stats[run.action] = { success: 0, error: 0, total: 0 };
        }
        stats[run.action].total++;
        if (run?.status === 'success') stats[run.action].success++;
        if (run?.status === 'error') stats[run.action].error++;
      });

      setAutomationStats(stats);
    } catch (err) {
      console.error('Erreur de chargement des statistiques :', err);
    }
  };

  const handleManualTrigger = async (automationType) => {
    if (!window.confirm(`Exécuter manuellement l'automatisation "${automationType}" ?`)) return;

    try {
      setRunningAutomation(automationType);

      let result;
      switch (automationType) {
        case 'check_owner_no_response':
          result = await automationService?.checkOwnerNoResponse();
          break;
        case 'check_missing_documents':
          result = await automationService?.checkMissingDocuments();
          break;
        case 'cancel_unpaid_reservations':
          result = await automationService?.cancelUnpaidReservations();
          break;
        case 'release_deposits':
          result = await automationService?.releaseDeposits();
          break;
        case 'send_return_reminders':
          result = await automationService?.sendReturnReminders();
          break;
        case 'process_strikes':
          result = await automationService?.processStrikes();
          break;
        case 'clean_expired_holds':
          result = await automationService?.cleanExpiredHolds();
          break;
        case 'send_daily_digest':
          result = await automationService?.sendDailyDigest();
          break;
        default:
          throw new Error('Type d\'automatisation inconnu');
      }

      await automationService?.logRun(
        automationType,
        result?.success ? 'success' : 'error',
        result,
        result?.error
      );

      alert(`Automatisation exécutée avec succès. ${result?.processed || 0} éléments traités.`);
      loadJobRuns();
      loadAutomationStats();
    } catch (err) {
      console.error('Erreur de déclenchement manuel :', err);
      alert(`Erreur: ${err?.message}`);
    } finally {
      setRunningAutomation(null);
    }
  };

  const handleRunAll = async () => {
    if (!window.confirm('Exécuter toutes les automatisations ? Cela peut prendre plusieurs minutes.')) return;

    try {
      setRunningAutomation('all');
      const results = await automationService?.runAllAutomations();
      
      const summary = Object.entries(results)?.map(([key, value]) => `${key}: ${value?.processed || 0} traités`)?.join('\n');

      alert(`Toutes les automatisations exécutées:\n\n${summary}`);
      loadJobRuns();
      loadAutomationStats();
    } catch (err) {
      console.error("Erreur lors de l'exécution globale :", err);
      alert(`Erreur: ${err?.message}`);
    } finally {
      setRunningAutomation(null);
    }
  };

  const automations = [
    {
      id: 'check_owner_no_response',
      name: 'Validation propriétaire (désactivée)',
      description: 'Désactivée en mode réservation instantanée',
      icon: 'UserX',
      color: 'text-orange-600 bg-orange-100'
    },
    {
      id: 'check_missing_documents',
      name: 'Contrôle CNI post-paiement',
      description: 'Annule les réservations payées sans CNI à temps, facture 1 jour et rembourse le reste',
      icon: 'FileText',
      color: 'text-blue-600 bg-blue-100'
    },
    {
      id: 'cancel_unpaid_reservations',
      name: 'Annulation réservations impayées',
      description: 'Annule les réservations non payées après délai (si payment_deadline est configuré)',
      icon: 'XCircle',
      color: 'text-red-600 bg-red-100'
    },
    {
      id: 'release_deposits',
      name: 'Libération cautions',
      description: 'Libère les cautions 7 jours après restitution',
      icon: 'DollarSign',
      color: 'text-green-600 bg-green-100'
    },
    {
      id: 'send_return_reminders',
      name: 'Rappels de restitution',
      description: 'Envoie rappels 2 jours avant fin de location',
      icon: 'Bell',
      color: 'text-purple-600 bg-purple-100'
    },
    {
      id: 'process_strikes',
      name: 'Gestion des avertissements',
      description: 'Blocage automatique après 3 avertissements',
      icon: 'AlertTriangle',
      color: 'text-yellow-600 bg-yellow-100'
    },
    {
      id: 'clean_expired_holds',
      name: 'Nettoyage holds expirés',
      description: 'Annule les autorisations de caution expirées',
      icon: 'Trash2',
      color: 'text-gray-600 bg-gray-100'
    },
    {
      id: 'send_daily_digest',
      name: 'Récapitulatif quotidien',
      description: 'Envoie résumé notifications non lues',
      icon: 'Mail',
      color: 'text-indigo-600 bg-indigo-100'
    }
  ];

  const getStatusBadge = (status) => {
    const configs = {
      success: { label: 'Succès', color: 'bg-green-100 text-green-700', icon: 'CheckCircle' },
      error: { label: 'Erreur', color: 'bg-red-100 text-red-700', icon: 'XCircle' },
      running: { label: 'En cours', color: 'bg-blue-100 text-blue-700', icon: 'Loader' }
    };

    const config = configs?.[status] || configs?.success;

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config?.color}`}>
        <Icon name={config?.icon} className={`w-3.5 h-3.5 ${status === 'running' ? 'animate-spin' : ''}`} />
        {config?.label}
      </span>
    );
  };

  const filteredJobRuns = jobRuns?.filter(run => {
    if (filterStatus === 'all') return true;
    return run?.status === filterStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen app-page-gradient flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Icon name="Loader" className="w-8 h-8 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen app-page-gradient flex flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* En-tête */}
          <div className="mb-6">
            <button
              onClick={() => navigate('/administration-tableau-bord')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
            >
              <Icon name="ArrowLeft" className="w-5 h-5" />
              <span>Retour au tableau de bord</span>
            </button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Gestion des automatisations</h1>
                <p className="text-muted-foreground mt-2">Surveillance et contrôle des tâches automatisées</p>
              </div>
              <Button onClick={handleRunAll} disabled={runningAutomation !== null}>
                {runningAutomation === 'all' ? (
                  <>
                    <Icon name="Loader" className="w-5 h-5 animate-spin" />
                    Exécution...
                  </>
                ) : (
                  <>
                    <Icon name="Play" className="w-5 h-5" />
                    Exécuter tout
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Cartes d'automatisation */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {automations?.map(automation => {
              const stats = automationStats?.[automation?.id] || { success: 0, error: 0, total: 0 };
              const successRate = stats?.total > 0 ? ((stats?.success / stats?.total) * 100)?.toFixed(0) : 0;

              return (
                <div key={automation?.id} className="bg-white rounded-xl shadow-sm border border-border p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${automation?.color}`}>
                      <Icon name={automation?.icon} className="w-5 h-5" />
                    </div>
                    {stats?.total > 0 && (
                      <span className="text-xs font-medium text-muted-foreground">{successRate}% succès</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-foreground mb-1 text-sm">{automation?.name}</h3>
                  <p className="text-xs text-muted-foreground mb-4">{automation?.description}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                    <span>{stats?.total} exécutions (7j)</span>
                    {stats?.error > 0 && (
                      <span className="text-red-600">{stats?.error} erreurs</span>
                    )}
                  </div>
                  <Button
                    onClick={() => handleManualTrigger(automation?.id)}
                    disabled={runningAutomation !== null}
                    variant="outline"
                    className="w-full text-sm"
                  >
                    {runningAutomation === automation?.id ? (
                      <>
                        <Icon name="Loader" className="w-4 h-4 animate-spin" />
                        Exécution...
                      </>
                    ) : (
                      <>
                        <Icon name="Play" className="w-4 h-4" />
                        Exécuter
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Tableau des exécutions */}
          <div className="bg-white rounded-xl shadow-sm border border-border">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground">Historique des exécutions</h2>
                <Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e?.target?.value)}
                  className="w-48"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="success">Succès</option>
                  <option value="error">Erreurs</option>
                </Select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Résultat
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Erreur
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-border">
                  {filteredJobRuns?.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center">
                        <Icon name="Inbox" className="w-12 h-12 text-muted-foreground/60 mx-auto mb-3" />
                        <p className="text-muted-foreground">Aucune exécution trouvée</p>
                      </td>
                    </tr>
                  ) : (
                    filteredJobRuns?.map(run => (
                      <tr key={run?.id} className="hover:bg-surface">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-foreground">
                            {automations?.find(a => a?.id === run?.action)?.name || run?.action}
                          </div>
                          <div className="text-xs text-muted-foreground">{run?.dedupe_key}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(run?.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {new Date(run.created_at)?.toLocaleString('fr-FR')}
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground">
                          {run?.result ? (
                            <details className="cursor-pointer">
                              <summary className="text-primary hover:text-[#0d7b88]">
                                Voir détails
                              </summary>
                              <pre className="mt-2 text-xs bg-surface p-2 rounded overflow-auto max-w-md">
                                {JSON.stringify(JSON.parse(run?.result), null, 2)}
                              </pre>
                            </details>
                          ) : (
                            <span className="text-muted-foreground/70">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {run?.error_message ? (
                            <span className="text-red-600">{run?.error_message}</span>
                          ) : (
                            <span className="text-muted-foreground/70">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AdminAutomationManagement;





