import React, { useEffect, useMemo, useState } from 'react';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { Link } from 'react-router-dom';
import ReportDetailModal from './components/ReportDetailModal';
import { supabase } from '../../lib/supabase';

const STATUS_OPTIONS = [
  { value: 'tous', label: 'Tous les statuts' },
  { value: 'Nouveau', label: 'Nouveau' },
  { value: 'En cours', label: 'En cours' },
  { value: 'Traite', label: 'Traite' },
  { value: 'Rejete', label: 'Rejete' }
];

const TYPE_OPTIONS = [
  { value: 'tous', label: 'Tous les types' },
  { value: 'Annonce inappropriee', label: 'Annonce inappropriee' },
  { value: 'Contenu illegal', label: 'Contenu illegal' },
  { value: 'Arnaque', label: 'Arnaque' },
  { value: 'Utilisateur suspect', label: 'Utilisateur suspect' },
  { value: 'Autre', label: 'Autre' }
];

const STATUS_LABELS = {
  nouveau: 'Nouveau',
  new: 'Nouveau',
  pending: 'Nouveau',
  open: 'Nouveau',
  en_cours: 'En cours',
  in_progress: 'En cours',
  processing: 'En cours',
  review: 'En cours',
  traite: 'Traite',
  treated: 'Traite',
  resolved: 'Traite',
  done: 'Traite',
  closed: 'Traite',
  rejete: 'Rejete',
  rejected: 'Rejete',
  refused: 'Rejete'
};

const TYPE_LABELS = {
  annonce_inappropriee: 'Annonce inappropriee',
  inappropriate_listing: 'Annonce inappropriee',
  listing: 'Annonce inappropriee',
  contenu_illegal: 'Contenu illegal',
  illegal_content: 'Contenu illegal',
  scam: 'Arnaque',
  fraude: 'Arnaque',
  utilisateur_suspect: 'Utilisateur suspect',
  suspicious_user: 'Utilisateur suspect',
  user: 'Utilisateur suspect',
  autre: 'Autre',
  other: 'Autre'
};

const REPORT_TABLE_CANDIDATES = ['reports', 'signalements'];

const normalizeKey = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');

const normalizeStatus = (value) => {
  if (!value) return 'Nouveau';
  const normalized = normalizeKey(value);
  return STATUS_LABELS?.[normalized] || String(value);
};

const normalizeType = (value) => {
  if (!value) return 'Autre';
  const normalized = normalizeKey(value);
  return TYPE_LABELS?.[normalized] || String(value);
};

const extractEvidence = (row) => {
  if (Array.isArray(row?.evidence)) return row?.evidence;
  if (Array.isArray(row?.evidence_urls)) return row?.evidence_urls;
  if (Array.isArray(row?.attachments)) return row?.attachments;
  return [];
};

const normalizeReport = (row, index) => {
  const createdAt = row?.submissionDate || row?.submitted_at || row?.created_at || row?.date || null;

  return {
    ...row,
    id: row?.id || row?.report_id || row?.uuid || `report-${index}`,
    type: normalizeType(row?.type || row?.report_type || row?.category),
    status: normalizeStatus(row?.status || row?.state),
    reporterPseudo:
      row?.reporterPseudo ||
      row?.reporter_pseudo ||
      row?.reporter_name ||
      row?.reporter_email ||
      row?.reporter_id ||
      'Inconnu',
    reportedContent:
      row?.reportedContent ||
      row?.reported_content ||
      row?.content_title ||
      row?.annonce_title ||
      row?.listing_title ||
      null,
    reportedUser:
      row?.reportedUser ||
      row?.reported_user ||
      row?.reported_pseudo ||
      row?.target_user ||
      row?.target_user_pseudo ||
      row?.reported_user_id ||
      '-',
    submissionDate: createdAt,
    description: row?.description || row?.reason || row?.details || row?.message || '-',
    evidence: extractEvidence(row)
  };
};

const relationNotFound = (error) => {
  if (!error?.message) return false;
  return /relation.*does not exist/i.test(error?.message) || /could not find the table/i.test(error?.message);
};

const missingCreatedAtColumn = (error) => {
  if (!error?.message) return false;
  return /column\\s+.*created_at.*does not exist/i.test(error?.message);
};

const AdminSignalements = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('tous');
  const [typeFilter, setTypeFilter] = useState('tous');
  const [selectedReport, setSelectedReport] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [activeSource, setActiveSource] = useState('');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setFetchError('');

      let loaded = false;
      let lastError = null;

      for (const tableName of REPORT_TABLE_CANDIDATES) {
        let { data, error } = await supabase
          ?.from(tableName)
          ?.select('*')
          ?.order('created_at', { ascending: false })
          ?.limit(500);

        if (error && missingCreatedAtColumn(error)) {
          ({ data, error } = await supabase?.from(tableName)?.select('*')?.limit(500));
        }

        if (!error) {
          const normalized = (data || [])?.map((row, index) => normalizeReport(row, index));
          setReports(normalized);
          setActiveSource(tableName);
          loaded = true;
          break;
        }

        if (!relationNotFound(error)) {
          lastError = error;
          break;
        }

        lastError = error;
      }

      if (!loaded) {
        setReports([]);
        setActiveSource('');
        if (lastError && relationNotFound(lastError)) {
          setFetchError('');
        } else if (lastError) {
          setFetchError(lastError?.message || 'Impossible de charger les signalements');
        } else {
          setFetchError('');
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des signalements :', error);
      setReports([]);
      setFetchError(error?.message || 'Impossible de charger les signalements');
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = useMemo(() => {
    return reports?.filter((report) => {
      const matchesStatus = statusFilter === 'tous' || report?.status === statusFilter;
      const matchesType = typeFilter === 'tous' || report?.type === typeFilter;
      return matchesStatus && matchesType;
    });
  }, [reports, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    return {
      total: reports?.length,
      nouveau: reports?.filter((report) => report?.status === 'Nouveau')?.length,
      enCours: reports?.filter((report) => report?.status === 'En cours')?.length,
      traite: reports?.filter((report) => report?.status === 'Traite')?.length
    };
  }, [reports]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Nouveau':
        return 'bg-blue-100 text-blue-800';
      case 'En cours':
        return 'bg-yellow-100 text-yellow-800';
      case 'Traite':
        return 'bg-green-100 text-green-800';
      case 'Rejete':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'Annonce inappropriee':
        return 'FileX';
      case 'Contenu illegal':
        return 'ShieldAlert';
      case 'Arnaque':
        return 'AlertTriangle';
      case 'Utilisateur suspect':
        return 'UserX';
      default:
        return 'Flag';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (Number.isNaN(date?.getTime())) return '-';

    return date?.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleViewDetails = (report) => {
    setSelectedReport(report);
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedReport(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <main className="flex-1 container mx-auto px-4 pt-20 pb-6 md:pt-24 md:pb-8 max-w-7xl">
        <div className="mb-6">
          <Link to="/administration-tableau-bord" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
            <Icon name="ArrowLeft" size={16} />
            Retour au tableau de bord
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-elevation-1 p-6 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Gestion des signalements</h1>
          <p className="text-muted-foreground mt-2">
            Moderez les signalements des utilisateurs et prenez les mesures appropriees.
          </p>
          {activeSource && (
            <p className="text-xs text-muted-foreground mt-2">Source de donnees: {activeSource}</p>
          )}
        </div>

        {fetchError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-2">
              <Icon name="AlertCircle" size={16} className="mt-0.5" />
              <p className="text-sm">{fetchError}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-elevation-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-foreground">{stats?.total}</p>
              </div>
              <Icon name="Flag" size={24} className="text-blue-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-elevation-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Nouveaux</p>
                <p className="text-2xl font-bold text-blue-600">{stats?.nouveau}</p>
              </div>
              <Icon name="AlertCircle" size={24} className="text-blue-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-elevation-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En cours</p>
                <p className="text-2xl font-bold text-yellow-600">{stats?.enCours}</p>
              </div>
              <Icon name="Clock" size={24} className="text-yellow-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-elevation-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Traites</p>
                <p className="text-2xl font-bold text-green-600">{stats?.traite}</p>
              </div>
              <Icon name="CheckCircle" size={24} className="text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-elevation-1 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Filtrer par statut"
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
            />
            <Select
              label="Filtrer par type"
              options={TYPE_OPTIONS}
              value={typeFilter}
              onChange={setTypeFilter}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-elevation-2 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Type</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Signale par</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Concernant</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Statut</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-muted-foreground">
                      Chargement des signalements...
                    </td>
                  </tr>
                ) : filteredReports?.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-muted-foreground">
                      Aucun signalement trouve
                    </td>
                  </tr>
                ) : (
                  filteredReports?.map((report) => (
                    <tr key={report?.id} className="hover:bg-surface transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Icon name={getTypeIcon(report?.type)} size={18} className="text-error" />
                          <span className="text-sm font-medium text-foreground">{report?.type}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-foreground">{report?.reporterPseudo}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          {report?.reportedContent && (
                            <p className="text-foreground font-medium">{report?.reportedContent}</p>
                          )}
                          <p className="text-muted-foreground">Utilisateur: {report?.reportedUser}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-muted-foreground">{formatDate(report?.submissionDate)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(report?.status)}`}>
                          {report?.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(report)}
                          >
                            <Icon name="Eye" size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <Footer />

      {showDetailModal && selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default AdminSignalements;

