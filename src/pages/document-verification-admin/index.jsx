import React, { useEffect, useMemo, useState } from 'react';

import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import userProfileDocumentService from '../../services/userProfileDocumentService';
import DocumentDetailModal from './components/DocumentDetailModal';
import RejectDocumentModal from './components/RejectDocumentModal';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tous' },
  { value: 'pending', label: 'En attente' },
  { value: 'approved', label: 'Valides' },
  { value: 'rejected', label: 'Refuses' }
];

const STATUS_BADGE_CLASSES = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-100 text-rose-700 border-rose-200'
};

const formatDateTime = (value) => {
  if (!value) return 'Non renseigne';

  const date = new Date(value);
  if (Number.isNaN(date?.getTime())) return 'Non renseigne';

  return date?.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const DocumentVerificationAdmin = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [pageError, setPageError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [rejectingDocument, setRejectingDocument] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const loadDocuments = async ({ background = false } = {}) => {
    try {
      if (background) setRefreshing(true);
      else setLoading(true);

      setPageError('');
      const { data, error } = await userProfileDocumentService?.listDocumentsForAdmin();

      if (error) {
        throw error;
      }

      setDocuments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erreur de chargement admin des documents:', error);
      setPageError(error?.message || 'Impossible de charger les documents a verifier.');
      setDocuments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const counts = useMemo(() => {
    return (documents || [])?.reduce(
      (accumulator, document) => {
        accumulator.all += 1;
        accumulator[document?.status] = Number(accumulator?.[document?.status] || 0) + 1;
        return accumulator;
      },
      { all: 0, pending: 0, approved: 0, rejected: 0 }
    );
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const normalizedSearch = String(searchTerm || '').trim().toLowerCase();

    return (documents || [])?.filter((document) => {
      if (statusFilter !== 'all' && document?.status !== statusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        document?.userPseudo,
        document?.userEmail,
        document?.fileName,
        document?.documentTypeLabel,
        document?.documentType
      ]
        ?.map((value) => String(value || '').toLowerCase())
        ?.join(' ');

      return haystack?.includes(normalizedSearch);
    });
  }, [documents, searchTerm, statusFilter]);

  const syncReviewedDocument = (row) => {
    if (!row) return;

    setDocuments((previous) =>
      (previous || [])?.map((document) => (
        document?.id === row?.id
          ? {
              ...document,
              status: row?.status || document?.status,
              approvedDate: row?.approved_at || null,
              rejectedDate: row?.status === 'rejected' ? (row?.updated_at || null) : null,
              rejectionReason: row?.rejection_reason || null
            }
          : document
      ))
    );

    setSelectedDocument((previous) => (
      previous?.id === row?.id
        ? {
            ...previous,
            status: row?.status || previous?.status,
            approvedDate: row?.approved_at || null,
            rejectedDate: row?.status === 'rejected' ? (row?.updated_at || null) : null,
            rejectionReason: row?.rejection_reason || null
          }
        : previous
    ));
  };

  const handleLoadPreview = async (document) => {
    if (!document?.storagePath) {
      setPreviewUrl('');
      setPreviewError('Document introuvable dans le stockage.');
      return;
    }

    try {
      setPreviewLoading(true);
      setPreviewError('');

      const { data, error } = await userProfileDocumentService?.getSignedDocumentUrl(document?.storagePath);
      if (error) throw error;

      if (!data) {
        setPreviewUrl('');
        setPreviewError("Impossible de generer l'URL du document.");
        return;
      }

      setPreviewUrl(data);
    } catch (error) {
      console.error("Erreur de chargement de l'aperçu document:", error);
      setPreviewUrl('');
      setPreviewError(error?.message || "Impossible d'ouvrir ce document.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleOpenDetail = async (document) => {
    setSelectedDocument(document);
    setPreviewUrl('');
    setPreviewError('');
    await handleLoadPreview(document);
  };

  const handleApprove = async (document) => {
    try {
      setActionLoading(document?.id || 'approve');
      const { data, error } = await userProfileDocumentService?.reviewDocument(document?.id, {
        status: 'approved'
      });

      if (error) throw error;
      syncReviewedDocument(data);
      setRejectingDocument(null);
    } catch (error) {
      console.error('Erreur validation document:', error);
      alert(error?.message || 'Impossible de valider ce document.');
    } finally {
      setActionLoading('');
    }
  };

  const handleReject = async (reason) => {
    if (!rejectingDocument?.id) return;

    try {
      setActionLoading(rejectingDocument?.id);
      const { data, error } = await userProfileDocumentService?.reviewDocument(rejectingDocument?.id, {
        status: 'rejected',
        rejectionReason: reason
      });

      if (error) throw error;
      syncReviewedDocument(data);
      setRejectingDocument(null);
    } catch (error) {
      console.error('Erreur refus document:', error);
      alert(error?.message || 'Impossible de refuser ce document.');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div className="min-h-screen bg-[#eef6ff]">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_-35px_rgba(15,23,42,0.32)] md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0f7081]">
                Administration
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-900">
                Verification des pieces d'identite
              </h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-600">
                Cette page est l'outil de validation plateforme. Le proprietaire ne voit jamais le document.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              iconName="RefreshCw"
              loading={refreshing}
              onClick={() => loadDocuments({ background: true })}
            >
              Rafraichir
            </Button>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {STATUS_OPTIONS?.map((option) => (
              <button
                key={option?.value}
                type="button"
                onClick={() => setStatusFilter(option?.value)}
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  statusFilter === option?.value
                    ? 'border-[#17a2b8] bg-[#17a2b8]/10 shadow-sm'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                }`}
              >
                <p className="text-sm font-medium text-slate-600">{option?.label}</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {counts?.[option?.value] || 0}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event?.target?.value || '')}
              placeholder="Rechercher par utilisateur, email ou fichier"
            />

            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS?.map((option) => (
                <Button
                  key={option?.value}
                  type="button"
                  size="sm"
                  variant={statusFilter === option?.value ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(option?.value)}
                >
                  {option?.label}
                </Button>
              ))}
            </div>
          </div>

          {pageError ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {pageError}
            </div>
          ) : null}

          <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200">
            <div className="hidden grid-cols-[1.1fr_1fr_0.9fr_0.9fr_0.8fr_auto] gap-4 bg-slate-50 px-5 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 lg:grid">
              <span>Utilisateur</span>
              <span>Document</span>
              <span>Fichier</span>
              <span>Depose le</span>
              <span>Statut</span>
              <span className="text-right">Actions</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-3 px-6 py-16 text-slate-500">
                <Icon name="Loader" size={24} className="animate-spin" />
                <span>Chargement des documents...</span>
              </div>
            ) : filteredDocuments?.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <Icon name="FolderSearch" size={42} className="mx-auto text-slate-400" />
                <p className="mt-4 text-lg font-medium text-slate-900">
                  Aucun document a afficher
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Change le filtre ou attends le prochain depot utilisateur.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredDocuments?.map((document) => (
                  <div
                    key={document?.id}
                    className="grid gap-4 px-5 py-5 lg:grid-cols-[1.1fr_1fr_0.9fr_0.9fr_0.8fr_auto] lg:items-center"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{document?.userPseudo || 'Utilisateur'}</p>
                      <p className="mt-1 text-sm text-slate-500">{document?.userEmail || 'Email non renseigne'}</p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-900">{document?.documentTypeLabel || 'Document'}</p>
                      <p className="mt-1 text-sm text-slate-500">{document?.documentType || 'Type non renseigne'}</p>
                    </div>

                    <div>
                      <p className="break-all text-sm text-slate-700">{document?.fileName || 'Nom non renseigne'}</p>
                    </div>

                    <div className="text-sm text-slate-600">
                      {formatDateTime(document?.uploadDate)}
                    </div>

                    <div>
                      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_BADGE_CLASSES?.[document?.status] || STATUS_BADGE_CLASSES?.pending}`}>
                        <Icon
                          name={document?.status === 'approved' ? 'BadgeCheck' : document?.status === 'rejected' ? 'CircleX' : 'Clock3'}
                          size={14}
                        />
                        {document?.status === 'approved' ? 'Valide' : document?.status === 'rejected' ? 'Refuse' : 'En attente'}
                      </span>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        iconName="Eye"
                        onClick={() => handleOpenDetail(document)}
                      >
                        Voir
                      </Button>

                      {document?.status !== 'approved' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="success"
                          iconName="BadgeCheck"
                          loading={actionLoading === document?.id}
                          onClick={() => handleApprove(document)}
                        >
                          Valider
                        </Button>
                      ) : null}

                      {document?.status !== 'rejected' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          iconName="CircleX"
                          loading={actionLoading === document?.id}
                          onClick={() => setRejectingDocument(document)}
                        >
                          Refuser
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />

      <DocumentDetailModal
        open={Boolean(selectedDocument)}
        document={selectedDocument}
        previewUrl={previewUrl}
        previewLoading={previewLoading}
        previewError={previewError}
        actionLoading={actionLoading === selectedDocument?.id}
        onClose={() => {
          setSelectedDocument(null);
          setPreviewUrl('');
          setPreviewError('');
        }}
        onLoadPreview={handleLoadPreview}
        onApprove={handleApprove}
        onReject={(document) => setRejectingDocument(document)}
      />

      <RejectDocumentModal
        open={Boolean(rejectingDocument)}
        document={rejectingDocument}
        loading={actionLoading === rejectingDocument?.id}
        onClose={() => setRejectingDocument(null)}
        onConfirm={handleReject}
      />
    </div>
  );
};

export default DocumentVerificationAdmin;
