import React, { useEffect, useMemo, useState } from 'react';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'delivered', label: 'Delivres' },
  { value: 'pending', label: 'En attente' },
  { value: 'failed', label: 'Echecs' },
  { value: 'opened', label: 'Ouverts' }
];

const STATUS_BADGES = {
  delivered: { label: 'Delivre', color: 'bg-success/10 text-success' },
  pending: { label: 'En attente', color: 'bg-warning/10 text-warning' },
  failed: { label: 'Echec', color: 'bg-error/10 text-error' },
  opened: { label: 'Ouvert', color: 'bg-blue-100 text-blue-700' }
};

function normalizeStatus(status) {
  const raw = String(status || '')?.toLowerCase();
  if (raw === 'sent' || raw === 'delivered' || raw === 'success') return 'delivered';
  if (raw === 'opened' || raw === 'open' || raw === 'clicked') return 'opened';
  if (raw === 'failed' || raw === 'error' || raw === 'bounced' || raw === 'complained' || raw === 'suppressed') return 'failed';
  return 'pending';
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

function toCsvCell(value) {
  const text = String(value ?? '');
  return `"${text?.replace(/"/g, '""')}"`;
}

const AdminEmailTracking = () => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      setFetchError('');

      const { data, error } = await supabase
        ?.from('email_queue')
        ?.select('*')
        ?.order('created_at', { ascending: false })
        ?.limit(500);

      if (error) throw error;
      setEmails(Array?.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erreur de chargement des journaux e-mails:', error);
      setFetchError(error?.message || 'Impossible de charger les e-mails');
      setEmails([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredEmails = useMemo(() => {
    const query = String(searchQuery || '')?.trim()?.toLowerCase();

    return (emails || [])?.filter((email) => {
      const normalizedStatus = normalizeStatus(email?.status);
      const matchesStatus = statusFilter === 'all' || normalizedStatus === statusFilter;

      if (!matchesStatus) return false;
      if (!query) return true;

      const recipient = String(email?.recipient_email || email?.recipient || '')?.toLowerCase();
      const subject = String(email?.subject || '')?.toLowerCase();
      const templateKey = String(email?.template_key || email?.template || '')?.toLowerCase();
      const errorMessage = String(email?.last_error || email?.error_message || '')?.toLowerCase();

      return (
        recipient?.includes(query) ||
        subject?.includes(query) ||
        templateKey?.includes(query) ||
        errorMessage?.includes(query)
      );
    });
  }, [emails, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: emails?.length || 0,
      delivered: emails?.filter((email) => normalizeStatus(email?.status) === 'delivered')?.length || 0,
      pending: emails?.filter((email) => normalizeStatus(email?.status) === 'pending')?.length || 0,
      failed: emails?.filter((email) => normalizeStatus(email?.status) === 'failed')?.length || 0
    };
  }, [emails]);

  const handleExportCsv = () => {
    const headers = ['destinataire', 'sujet', 'template', 'statut', 'cree_le', 'envoye_le', 'erreur'];
    const lines = filteredEmails?.map((email) => [
      toCsvCell(email?.recipient_email || email?.recipient || ''),
      toCsvCell(email?.subject || ''),
      toCsvCell(email?.template_key || email?.template || ''),
      toCsvCell(normalizeStatus(email?.status)),
      toCsvCell(email?.created_at || ''),
      toCsvCell(email?.sent_at || ''),
      toCsvCell(email?.last_error || email?.error_message || '')
    ]?.join(','));

    const csvContent = [headers?.join(','), ...(lines || [])]?.join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `email-logs-${new Date()?.toISOString()?.slice(0, 10)}.csv`;
    document.body?.appendChild(link);
    link?.click();
    document.body?.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleShowDetails = (email) => {
    const details = [
      `Destinataire: ${email?.recipient_email || '-'}`,
      `Template: ${email?.template_key || '-'}`,
      `Statut: ${normalizeStatus(email?.status)}`,
      `Cree le: ${formatDate(email?.created_at)}`,
      `Envoye le: ${formatDate(email?.sent_at)}`,
        `Tentatives: ${email?.attempts ?? 0}`,
      `Erreur: ${email?.last_error || email?.error_message || '-'}`
    ]?.join('\n');

    window?.alert(details);
  };

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
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Suivi des e-mails</h1>
          <p className="text-muted-foreground">Gerez et suivez tous les e-mails envoyes par la plateforme</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-elevation-1 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                <Icon name="Mail" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.total}</p>
                <p className="text-xs text-muted-foreground">Total envoyes</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-elevation-1 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10 text-success">
                <Icon name="CheckCircle" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.delivered}</p>
                <p className="text-xs text-muted-foreground">Delivres</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-elevation-1 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10 text-warning">
                <Icon name="Clock" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.pending}</p>
                <p className="text-xs text-muted-foreground">En attente</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-elevation-1 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-error/10 text-error">
                <Icon name="XCircle" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.failed}</p>
                <p className="text-xs text-muted-foreground">Echecs</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-elevation-1 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Rechercher par destinataire, sujet ou template..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e?.target?.value || '')}
            />

            <Select
              options={STATUS_FILTER_OPTIONS}
              value={statusFilter}
              onChange={(value) => setStatusFilter(value || 'all')}
            />

            <Button variant="outline" iconName="Download" onClick={handleExportCsv}>
              Exporter les journaux
            </Button>
          </div>
        </div>

        {fetchError && (
          <div className="bg-error/10 border border-error/20 text-error rounded-lg px-4 py-3 mb-6 text-sm">
            {fetchError}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-elevation-1 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Destinataire
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Sujet
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Modele
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Envoye le
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-muted-foreground">
                      Chargement des e-mails...
                    </td>
                  </tr>
                ) : filteredEmails?.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-muted-foreground">
                      Aucun e-mail trouve pour ce filtre.
                    </td>
                  </tr>
                ) : (
                  filteredEmails?.map((email) => {
                    const normalizedStatus = normalizeStatus(email?.status);
                    const statusBadge = STATUS_BADGES?.[normalizedStatus] || STATUS_BADGES?.pending;

                    return (
                      <tr key={email?.id || `${email?.recipient_email}-${email?.created_at}`} className="hover:bg-surface transition-colors">
                        <td className="px-4 py-4 text-sm text-foreground">{email?.recipient_email || '-'}</td>
                        <td className="px-4 py-4 text-sm text-foreground">{email?.subject || '-'}</td>
                        <td className="px-4 py-4 text-sm text-muted-foreground">{email?.template_key || '-'}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusBadge?.color}`}>
                            {statusBadge?.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-muted-foreground">{formatDate(email?.sent_at || email?.created_at)}</td>
                        <td className="px-4 py-4">
                          <Button variant="ghost" size="xs" iconName="Eye" onClick={() => handleShowDetails(email)}>
                            Details
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AdminEmailTracking;

