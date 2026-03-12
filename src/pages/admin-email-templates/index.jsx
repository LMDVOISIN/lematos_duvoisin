import React, { useEffect, useMemo, useState } from 'react';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { sendTestEmail, retryFailedEmails } from '../../services/emailService';

const AdminEmailTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [emailQueue, setEmailQueue] = useState([]);
  const [activeTab, setActiveTab] = useState('modeles'); // modeles | file | historique
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchEmailQueue();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      let data = null;
      let error = null;

      ({ data, error } = await supabase
        ?.from('email_templates')
        ?.select('*')
        ?.order('key', { ascending: true }));

      // Compat schema: some environments use `template_key` instead of `key`.
      if (error && /column\s+email_templates\.key\s+does not exist/i.test(String(error?.message || ''))) {
        ({ data, error } = await supabase
          ?.from('email_templates')
          ?.select('*')
          ?.order('template_key', { ascending: true }));
      }

      if (error) throw error;

      const normalized = (data || [])?.map((row) => ({
        ...row,
        key: row?.key || row?.template_key || ''
      }));

      setTemplates(normalized);
    } catch (error) {
      console.error('Erreur lors du chargement des modeles de courriels :', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmailQueue = async () => {
    try {
      const { data, error } = await supabase
        ?.from('email_queue')
        ?.select('*')
        ?.order('created_at', { ascending: false })
        ?.limit(200);

      if (error) throw error;
      setEmailQueue(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement de la file de courriels :', error);
      setEmailQueue([]);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail || !selectedTemplate) return;

    try {
      setSending(true);
      const result = await sendTestEmail(testEmail, selectedTemplate?.key);

      if (result?.success) {
        alert(`Courriel d'essai envoye a ${testEmail}`);
        setTestEmail('');
        fetchEmailQueue();
      } else {
        alert(`Erreur: ${result?.error}`);
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi du courriel d\'essai :', error);
      alert(`Erreur: ${error?.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleRetryFailed = async () => {
    try {
      setRetrying(true);
      const results = await retryFailedEmails();
      alert(`Reessai termine: ${results?.success} reussis, ${results?.failed} echoues`);
      fetchEmailQueue();
    } catch (error) {
      console.error('Erreur lors de la relance des echecs de courriels :', error);
      alert(`Erreur: ${error?.message}`);
    } finally {
      setRetrying(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (Number.isNaN(date?.getTime())) return '-';

    return date?.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const normalizeQueueStatus = (status) => {
    const raw = String(status || '')?.toLowerCase();
    if (['sent', 'delivered', 'opened', 'clicked', 'success']?.includes(raw)) return 'sent';
    if (['failed', 'error', 'bounced', 'complained', 'suppressed']?.includes(raw)) return 'failed';
    return 'pending';
  };

  const getStatusBadge = (status) => {
    const normalized = normalizeQueueStatus(status);
    const styles = {
      sent: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800'
    };
    return styles?.[normalized] || 'bg-gray-100 text-gray-800';
  };

  const getTemplateCategory = (key) => {
    if (key?.startsWith('annonce_')) return 'Annonces';
    if (key?.startsWith('demande_')) return 'Demandes';
    if (key?.startsWith('reservation_')) return 'Réservations';
    if (key?.startsWith('message_') || key?.startsWith('new_message')) return 'Messages';
    if (key?.startsWith('payment_')) return 'Paiements';
    if (key?.startsWith('documents_')) return 'Documents';
    if (key?.startsWith('reminder_')) return 'Rappels';
    if (key?.startsWith('notifications_') || key?.includes('digest')) return 'Recapitulatifs';
    if (key?.startsWith('rental_')) return 'Locations';
    if (key?.startsWith('internal_')) return 'Internes';
    if (key?.startsWith('test_')) return 'Essais';
    if (key?.includes('owner_') && (key?.includes('penalties') || key?.includes('banned'))) return 'Moderation';
    if (key?.includes('cancellations_')) return 'Annulations';
    return 'Autres';
  };

  const groupedTemplates = useMemo(() => {
    return templates?.reduce((acc, template) => {
      const category = getTemplateCategory(template?.key);
      if (!acc?.[category]) acc[category] = [];
      acc?.[category]?.push(template);
      return acc;
    }, {});
  }, [templates]);

  const queueItems = useMemo(() => {
    return emailQueue?.filter((email) => {
      const status = normalizeQueueStatus(email?.status);
      return status === 'pending' || status === 'failed';
    }) || [];
  }, [emailQueue]);

  const getEmailError = (email) => email?.last_error || email?.error_message || null;

  const queueStats = useMemo(() => {
    return {
      total: emailQueue?.length,
      sent: emailQueue?.filter((e) => normalizeQueueStatus(e?.status) === 'sent')?.length,
      failed: emailQueue?.filter((e) => normalizeQueueStatus(e?.status) === 'failed')?.length,
      pending: emailQueue?.filter((e) => normalizeQueueStatus(e?.status) === 'pending')?.length,
      actionable: queueItems?.length
    };
  }, [emailQueue, queueItems]);

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
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Systeme de courriels</h1>
          <p className="text-muted-foreground">Gerez les modeles de courriels et consultez l'historique d'envoi</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-elevation-1 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Icon name="Mail" size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Modeles</p>
                <p className="text-2xl font-bold text-foreground">{templates?.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-elevation-1 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Icon name="CheckCircle" size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Envoyes</p>
                <p className="text-2xl font-bold text-foreground">{queueStats?.sent}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-elevation-1 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Icon name="XCircle" size={20} className="text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Echoues</p>
                <p className="text-2xl font-bold text-foreground">{queueStats?.failed}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-elevation-1 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Icon name="Clock" size={20} className="text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">En attente</p>
                <p className="text-2xl font-bold text-foreground">{queueStats?.pending}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-elevation-1 mb-6">
          <div className="border-b border-border">
            <div className="flex gap-4 px-6">
              <button
                onClick={() => setActiveTab('modeles')}
                className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'modeles' ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Modeles ({templates?.length})
              </button>
              <button
                onClick={() => setActiveTab('file')}
                className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'file' ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                File d'attente ({queueStats?.actionable})
              </button>
              <button
                onClick={() => setActiveTab('historique')}
                className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'historique' ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Historique ({queueStats?.total})
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'modeles' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                  {loading ? (
                    <div className="text-sm text-muted-foreground">Chargement des modeles...</div>
                  ) : (
                    Object.entries(groupedTemplates || {})?.map(([category, categoryTemplates]) => (
                      <div key={category}>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-2">{category}</h3>
                        <div className="space-y-1">
                          {categoryTemplates?.map((template) => (
                            <button
                              key={template?.key}
                              onClick={() => setSelectedTemplate(template)}
                              className={`w-full text-left p-3 rounded-md transition-colors ${
                                selectedTemplate?.key === template?.key
                                  ? 'bg-blue-50 border border-blue-200'
                                  : 'hover:bg-surface border border-transparent'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <Icon name="Mail" size={16} className="text-blue-600 mt-1" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground">{template?.key}</p>
                                  <p className="text-xs text-muted-foreground mt-1 truncate">{template?.subject}</p>
                                  {!template?.enabled && (
                                    <span className="inline-block mt-1 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
                                      Desactive
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="lg:col-span-2 lg:sticky lg:top-24 self-start">
                  {selectedTemplate ? (
                    <div className="space-y-4 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">
                      <div className="bg-surface rounded-lg p-4">
                        <h2 className="text-lg font-semibold text-foreground mb-2">{selectedTemplate?.key}</h2>
                        <p className="text-sm text-muted-foreground mb-4">Categorie : {getTemplateCategory(selectedTemplate?.key)}</p>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded ${
                            selectedTemplate?.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {selectedTemplate?.enabled ? 'Actif' : 'Desactive'}
                          </span>
                        </div>
                      </div>

                      <div className="bg-surface rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-foreground mb-2">Sujet</h3>
                        <p className="text-sm text-foreground">{selectedTemplate?.subject}</p>
                      </div>

                      <div className="bg-surface rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-foreground mb-2">Apercu du HTML</h3>
                        <div
                          className="border border-border rounded-md p-4 bg-white max-h-96 overflow-y-auto"
                          dangerouslySetInnerHTML={{ __html: selectedTemplate?.body_html }}
                        />
                      </div>

                      <div className="bg-surface rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-foreground mb-3">Envoyer un courriel d'essai</h3>
                        <div className="flex gap-3">
                          <Input
                            type="email"
                            placeholder="adresse@exemple.fr"
                            value={testEmail}
                            onChange={(event) => setTestEmail(event?.target?.value || '')}
                            className="flex-1"
                          />
                          <Button iconName="Send" onClick={handleSendTest} disabled={!testEmail || sending}>
                            {sending ? 'Envoi...' : 'Envoyer'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-surface rounded-lg p-12 text-center lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
                      <Icon name="Mail" size={48} className="text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">Sélectionnez un modèle pour voir l'aperçu</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'file' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Courriels en attente / en echec</h3>
                  <Button variant="outline" iconName="RefreshCw" onClick={handleRetryFailed} disabled={retrying || queueStats?.failed === 0}>
                    {retrying ? 'Reessai...' : `Reessayer les echecs (${queueStats?.failed})`}
                  </Button>
                </div>

                <div className="space-y-2">
                  {queueItems?.map((email) => (
                    <div key={email?.id} className="bg-surface rounded-lg p-4 border border-border">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs px-2 py-1 rounded ${getStatusBadge(email?.status)}`}>
                              {email?.status}
                            </span>
                            <span className="text-sm font-medium text-foreground">{email?.template_key}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">Destinataire: {email?.recipient_email}</p>
                          <p className="text-xs text-muted-foreground mt-1">Cree: {formatDate(email?.created_at)}</p>
                          {getEmailError(email) && (
                            <p className="text-xs text-red-600 mt-2">{getEmailError(email)}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Tentatives: {email?.attempts}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {queueItems?.length === 0 && (
                    <div className="text-center py-12">
                      <Icon name="CheckCircle" size={48} className="text-green-600 mx-auto mb-4" />
                      <p className="text-muted-foreground">Aucun courriel en attente ou en echec</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'historique' && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">Historique d'envoi</h3>
                <div className="space-y-2">
                  {emailQueue?.slice(0, 100)?.map((email) => (
                    <div key={email?.id} className="bg-surface rounded-lg p-4 border border-border">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs px-2 py-1 rounded ${getStatusBadge(email?.status)}`}>
                              {email?.status}
                            </span>
                            <span className="text-sm font-medium text-foreground">{email?.template_key}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">Destinataire: {email?.recipient_email}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {email?.sent_at ? `Envoye: ${formatDate(email?.sent_at)}` : `Cree: ${formatDate(email?.created_at)}`}
                          </p>
                          {getEmailError(email) && (
                            <p className="text-xs text-red-600 mt-2">{getEmailError(email)}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Tentatives: {email?.attempts}</p>
                          {email?.message_id && (
                            <p className="text-xs text-muted-foreground mt-1">ID: {String(email?.message_id)?.substring(0, 8)}...</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AdminEmailTemplates;



