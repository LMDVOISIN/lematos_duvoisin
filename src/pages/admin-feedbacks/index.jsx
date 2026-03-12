import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import feedbackService from '../../services/feedbackService';

const LABEL_PROCESSED = 'Trait\u00e9';
const LABEL_PROCESSED_PLURAL = 'Trait\u00e9s';
const TOAST_STATUS_UPDATED = 'Statut mis \u00e0 jour';
const TOAST_STATUS_UPDATE_ERROR = 'Impossible de mettre \u00e0 jour le statut';
const TOAST_DELETED = 'Feedback supprim\u00e9';
const TITLE_DESCRIPTION = "Date/heure, URL d'origine, message, e-mail et statut";

const STATUS_META = {
  new: {
    label: 'Nouveau',
    color: 'bg-blue-100 text-blue-700'
  },
  in_progress: {
    label: 'En cours',
    color: 'bg-amber-100 text-amber-700'
  },
  processed: {
    label: LABEL_PROCESSED,
    color: 'bg-green-100 text-green-700'
  }
};

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'new', label: 'Nouveau' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'processed', label: LABEL_PROCESSED }
];

function normalizeText(value) {
  return String(value || '')
    ?.trim()
    ?.toLowerCase()
    ?.normalize('NFD')
    ?.replace(/[\u0300-\u036f]/g, '');
}

function normalizeStatusKey(status) {
  const normalized = normalizeText(status);

  if (['new', 'nouveau', 'pending']?.includes(normalized)) return 'new';
  if (['in_progress', 'in progress', 'encours', 'en cours', 'processing']?.includes(normalized)) return 'in_progress';
  if (['processed', 'traite', 'published', 'archived', 'done']?.includes(normalized)) return 'processed';

  return 'new';
}

function getStatusMeta(status) {
  const key = normalizeStatusKey(status);
  return {
    key,
    ...(STATUS_META?.[key] || STATUS_META?.new)
  };
}

function getFeedbackMessage(feedback) {
  return String(feedback?.message || feedback?.comment || '')?.trim();
}

function getFeedbackEmail(feedback) {
  return String(feedback?.email || feedback?.contact_email || feedback?.user_email || '')?.trim();
}

function getFeedbackOriginUrl(feedback) {
  return String(
    feedback?.page_url ||
    feedback?.source_url ||
    feedback?.url ||
    feedback?.page_path ||
    ''
  )?.trim();
}

function getFeedbackDate(feedback) {
  return feedback?.created_at || feedback?.date || feedback?.submitted_at || null;
}

function toDateTimestamp(value) {
  if (!value) return 0;
  const date = new Date(value);
  const timestamp = date?.getTime();
  return Number?.isFinite(timestamp) ? timestamp : 0;
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number?.isNaN(date?.getTime())) return '-';

  return date?.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

const AdminRetours = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadFeedbacks = async () => {
    try {
      setLoading(true);
      const { data, error } = await feedbackService?.getAllFeedback();
      if (error) throw error;
      setFeedbacks(Array?.isArray(data) ? data : []);
    } catch (error) {
      console.error('Feedback admin load error:', error);
      toast?.error(error?.message || 'Impossible de charger les retours');
      setFeedbacks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedbacks();
  }, []);

  const stats = useMemo(() => {
    const summary = {
      total: feedbacks?.length || 0,
      new: 0,
      in_progress: 0,
      processed: 0
    };

    feedbacks?.forEach((feedback) => {
      const key = normalizeStatusKey(feedback?.status);
      if (summary?.[key] !== undefined) {
        summary[key] += 1;
      }
    });

    return summary;
  }, [feedbacks]);

  const filteredFeedbacks = useMemo(() => {
    const normalizedSearch = normalizeText(searchQuery);

    return [...(feedbacks || [])]
      ?.filter((feedback) => {
        const statusKey = normalizeStatusKey(feedback?.status);
        if (statusFilter !== 'all' && statusKey !== statusFilter) return false;

        if (!normalizedSearch) return true;

        const message = normalizeText(getFeedbackMessage(feedback));
        const email = normalizeText(getFeedbackEmail(feedback));
        const url = normalizeText(getFeedbackOriginUrl(feedback));
        const statusLabel = normalizeText(getStatusMeta(feedback?.status)?.label);

        return (
          message?.includes(normalizedSearch) ||
          email?.includes(normalizedSearch) ||
          url?.includes(normalizedSearch) ||
          statusLabel?.includes(normalizedSearch)
        );
      })
      ?.sort((a, b) => toDateTimestamp(getFeedbackDate(b)) - toDateTimestamp(getFeedbackDate(a)));
  }, [feedbacks, searchQuery, statusFilter]);

  const handleStatusChange = async (feedback, nextStatus) => {
    if (!feedback?.id) {
      toast?.error('Impossible de modifier ce feedback (id manquant)');
      return;
    }

    try {
      setUpdatingId(feedback?.id);
      const { error } = await feedbackService?.updateFeedbackStatus(feedback?.id, nextStatus);
      if (error) throw error;

      setFeedbacks((prev) =>
        prev?.map((item) => (item?.id === feedback?.id ? { ...item, status: nextStatus } : item))
      );
      toast?.success(TOAST_STATUS_UPDATED);
      await loadFeedbacks();
    } catch (error) {
      console.error('Feedback status update error:', error);
      toast?.error(error?.message || TOAST_STATUS_UPDATE_ERROR);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (feedback) => {
    if (!feedback?.id) {
      toast?.error('Impossible de supprimer ce feedback (id manquant)');
      return;
    }

    const excerpt = getFeedbackMessage(feedback)?.slice(0, 120);
    const confirmed = window?.confirm(
      `Supprimer ce feedback ?\n\n${excerpt || '(message vide)'}`
    );

    if (!confirmed) return;

    try {
      setDeletingId(feedback?.id);
      const { error } = await feedbackService?.deleteFeedback(feedback?.id);
      if (error) throw error;

      setFeedbacks((prev) => prev?.filter((item) => item?.id !== feedback?.id));
      toast?.success(TOAST_DELETED);
    } catch (error) {
      console.error('Feedback delete error:', error);
      toast?.error(error?.message || 'Impossible de supprimer ce feedback');
    } finally {
      setDeletingId(null);
    }
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
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Voir les retours</h1>
          <p className="text-muted-foreground">{TITLE_DESCRIPTION}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-elevation-1 p-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-foreground">{stats?.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow-elevation-1 p-4">
            <p className="text-xs text-muted-foreground">Nouveaux</p>
            <p className="text-2xl font-bold text-blue-600">{stats?.new}</p>
          </div>
          <div className="bg-white rounded-lg shadow-elevation-1 p-4">
            <p className="text-xs text-muted-foreground">En cours</p>
            <p className="text-2xl font-bold text-amber-600">{stats?.in_progress}</p>
          </div>
          <div className="bg-white rounded-lg shadow-elevation-1 p-4">
            <p className="text-xs text-muted-foreground">{LABEL_PROCESSED_PLURAL}</p>
            <p className="text-2xl font-bold text-green-600">{stats?.processed}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-elevation-1 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Rechercher dans message, e-mail ou URL..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event?.target?.value || '')}
              iconName="Search"
            />

            <Select
              value={statusFilter}
              onChange={(value) => setStatusFilter(value || 'all')}
              options={STATUS_FILTER_OPTIONS}
              placeholder="Filtrer par statut"
            />

            <Button variant="outline" iconName="RefreshCw" onClick={loadFeedbacks} loading={loading}>
              Actualiser
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-lg shadow-elevation-1 p-10 text-center">
              <Icon name="Loader2" size={28} className="mx-auto text-muted-foreground animate-spin mb-3" />
              <p className="text-muted-foreground">Chargement des retours...</p>
            </div>
          ) : filteredFeedbacks?.length === 0 ? (
            <div className="bg-white rounded-lg shadow-elevation-1 p-10 text-center">
              <Icon name="MessageSquare" size={28} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Aucun retour pour ce filtre.</p>
            </div>
          ) : (
            filteredFeedbacks?.map((feedback) => {
              const status = getStatusMeta(feedback?.status);
              const message = getFeedbackMessage(feedback);
              const email = getFeedbackEmail(feedback);
              const originUrl = getFeedbackOriginUrl(feedback);
              const createdAt = getFeedbackDate(feedback);
              const isUpdating = updatingId === feedback?.id;
              const isDeleting = deletingId === feedback?.id;

              return (
                <div key={feedback?.id || `${originUrl}-${createdAt}`} className="bg-white rounded-lg shadow-elevation-1 p-6">
                  <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${status?.color}`}>
                        {status?.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(createdAt)}</span>
                    </div>
                  </div>

                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {message || '(message vide)'}
                  </p>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">URL d&apos;origine</p>
                      {originUrl ? (
                        /^https?:\/\//i.test(originUrl) ? (
                          <a
                            href={originUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-700 break-all"
                          >
                            {originUrl}
                          </a>
                        ) : (
                          <p className="text-sm text-foreground break-all">{originUrl}</p>
                        )
                      ) : (
                        <p className="text-sm text-muted-foreground">Non disponible</p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">E-mail</p>
                      <p className="text-sm text-foreground break-all">{email || 'Non fourni'}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    <Button
                      size="xs"
                      variant={status?.key === 'new' ? 'default' : 'outline'}
                      onClick={() => handleStatusChange(feedback, 'new')}
                      disabled={isUpdating || isDeleting}
                    >
                      Nouveau
                    </Button>
                    <Button
                      size="xs"
                      variant={status?.key === 'in_progress' ? 'default' : 'outline'}
                      onClick={() => handleStatusChange(feedback, 'in_progress')}
                      disabled={isUpdating || isDeleting}
                    >
                      En cours
                    </Button>
                    <Button
                      size="xs"
                      variant={status?.key === 'processed' ? 'default' : 'outline'}
                      onClick={() => handleStatusChange(feedback, 'processed')}
                      disabled={isUpdating || isDeleting}
                    >
                      {LABEL_PROCESSED}
                    </Button>
                    <Button
                      size="xs"
                      variant="danger"
                      iconName="Trash2"
                      onClick={() => handleDelete(feedback)}
                      loading={isDeleting}
                      disabled={isUpdating || isDeleting}
                    >
                      Supprimer
                    </Button>
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

export default AdminRetours;

