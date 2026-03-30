import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import userProfileDocumentService from '../../../services/userProfileDocumentService';
import DocumentDetailModal from '../../document-verification-admin/components/DocumentDetailModal';
import RejectDocumentModal from '../../document-verification-admin/components/RejectDocumentModal';
import { supabase } from '../../../lib/supabase';

const getDocumentStatusConfig = (status) => {
  if (status === 'approved') {
    return {
      label: 'Valide',
      icon: 'BadgeCheck',
      color: 'bg-success/10 text-success'
    };
  }

  if (status === 'rejected') {
    return {
      label: 'Refuse',
      icon: 'CircleX',
      color: 'bg-error/10 text-error'
    };
  }

  return {
    label: 'En attente',
    icon: 'Clock3',
    color: 'bg-warning/10 text-warning'
  };
};

const getIdentitySummaryStatusConfig = (status) => {
  if (status === 'approved' || status === 'pending' || status === 'rejected') {
    return getDocumentStatusConfig(status);
  }

  return {
    label: 'Aucune',
    icon: 'FileX2',
    color: 'bg-surface text-muted-foreground'
  };
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date?.getTime())) return '-';
  return date?.toLocaleDateString('fr-FR');
};

const UserDetailModal = ({
  isOpen,
  onClose,
  user,
  initialTab = 'profile',
  onDocumentsChanged = null
}) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [reservations, setReservations] = useState([]);
  const [listings, setListings] = useState([]);
  const [strikes, setStrikes] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [rejectingDocument, setRejectingDocument] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab || 'profile');
  }, [initialTab, isOpen, user?.id]);

  useEffect(() => {
    if (user?.id && isOpen) {
      fetchUserData();
    }
  }, [isOpen, user?.id]);

  const fetchUserData = async () => {
    try {
      setLoading(true);

      const [
        reservationsResult,
        listingsResult,
        strikesResult,
        documentsResult
      ] = await Promise.all([
        supabase
          ?.from('reservations')
          ?.select(`
            id,
            status,
            start_date,
            end_date,
            annonce:annonce_id(titre)
          `)
          ?.or(`renter_id.eq.${user?.id},owner_id.eq.${user?.id}`)
          ?.order('created_at', { ascending: false })
          ?.limit(20),
        supabase
          ?.from('annonces')
          ?.select('id, titre, statut, published, created_at')
          ?.eq('owner_id', user?.id)
          ?.order('created_at', { ascending: false })
          ?.limit(20),
        supabase
          ?.from('user_sanctions')
          ?.select('id, type, reason, created_at, level')
          ?.eq('user_id', user?.id)
          ?.order('created_at', { ascending: false }),
        userProfileDocumentService?.listUserDocumentsForAdmin(user?.id)
      ]);

      setReservations(reservationsResult?.data || []);
      setListings(listingsResult?.data || []);
      setStrikes(strikesResult?.data || []);
      setDocuments(documentsResult?.data || []);
    } catch (error) {
      console.error('Erreur lors du chargement de user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profil', icon: 'User' },
    { id: 'reservations', label: 'Reservations', icon: 'Calendar' },
    { id: 'listings', label: 'Annonces', icon: 'Package' },
    { id: 'strikes', label: 'Avertissements', icon: 'AlertTriangle' },
    { id: 'documents', label: 'Documents', icon: 'FileText' }
  ];

  const getUserStatus = () => {
    if (user?.status) return user?.status;
    if (user?.banned_at) return 'banned';
    if (user?.suspended_at) return 'suspended';
    return 'active';
  };

  const strikeCount = Number(user?.strikeCount ?? user?.no_reply_strikes ?? strikes?.length ?? 0) || 0;
  const identitySummary = useMemo(
    () => userProfileDocumentService.buildIdentitySummary(documents),
    [documents]
  );

  if (!isOpen || !user) {
    return null;
  }

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
      console.error("Erreur de chargement de l'apercu document:", error);
      setPreviewUrl('');
      setPreviewError(error?.message || "Impossible d'ouvrir ce document.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleOpenDocument = async (document) => {
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
      await onDocumentsChanged?.(data);
    } catch (error) {
      console.error('Erreur validation document:', error);
      window.alert(error?.message || 'Impossible de valider ce document.');
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
      await onDocumentsChanged?.(data);
    } catch (error) {
      console.error('Erreur refus document:', error);
      window.alert(error?.message || 'Impossible de refuser ce document.');
    } finally {
      setActionLoading('');
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Pseudo</p>
                <p className="font-medium text-foreground">{user?.pseudo}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">E-mail</p>
                <p className="font-medium text-foreground">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Date d'inscription</p>
                <p className="font-medium text-foreground">
                  {formatDate(user?.created_at || user?.registrationDate)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Statut</p>
                <p className="font-medium text-foreground capitalize">{getUserStatus()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Reservations</p>
                <p className="font-medium text-foreground">{reservations?.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Annonces</p>
                <p className="font-medium text-foreground">{listings?.length}</p>
              </div>
            </div>
            {user?.is_tester ? (
              <div className="bg-[#17a2b8]/10 border border-[#17a2b8]/20 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Icon name="Beaker" size={16} className="text-[#17a2b8]" />
                  <span className="text-sm font-medium text-foreground">Utilisateur participant aux essais</span>
                </div>
              </div>
            ) : null}
          </div>
        );
      case 'reservations':
        return (
          <div className="space-y-3">
            {reservations?.map((reservation) => (
              <div key={reservation?.id} className="border border-border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{reservation?.annonce?.titre || `Reservation ${reservation?.id}`}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(reservation?.start_date)} - {formatDate(reservation?.end_date)}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    reservation?.status === 'completed' ? 'bg-success/10 text-success' : 'bg-[#17a2b8]/10 text-[#17a2b8]'
                  }`}>
                    {reservation?.status || 'inconnu'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        );
      case 'listings':
        return (
          <div className="space-y-3">
            {listings?.map((listing) => (
              <div key={listing?.id} className="border border-border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{listing?.titre || `Annonce ${listing?.id}`}</p>
                    <p className="text-xs text-muted-foreground">Creee le {formatDate(listing?.created_at)}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    listing?.published ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                  }`}>
                    {listing?.published ? 'Publiee' : (listing?.statut || 'Brouillon')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        );
      case 'strikes':
        return (
          <div className="space-y-3">
            {strikeCount === 0 ? (
              <div className="text-center py-8">
                <Icon name="CheckCircle" size={48} className="mx-auto text-success mb-2" />
                <p className="text-sm text-muted-foreground">Aucun avertissement</p>
              </div>
            ) : (
              strikes?.map((strike) => (
                <div key={strike?.id} className="border border-warning/20 bg-warning/5 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Icon name="AlertTriangle" size={16} className="text-warning mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{strike?.reason}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(strike?.created_at)} | {strike?.type}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
            {strikeCount >= 2 ? (
              <div className="bg-error/10 border border-error/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Icon name="AlertCircle" size={16} className="text-error mt-0.5" />
                  <p className="text-sm text-foreground">
                    Attention: {Math.max(0, 3 - strikeCount)} avertissement{Math.max(0, 3 - strikeCount) > 1 ? 's' : ''} avant bannissement automatique
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        );
      case 'documents':
        return (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Identite</p>
                <div className="mt-3 flex items-center gap-2">
                  <div className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getIdentitySummaryStatusConfig(identitySummary?.status)?.color}`}>
                    <Icon name={getIdentitySummaryStatusConfig(identitySummary?.status)?.icon} size={12} />
                    <span>{identitySummary?.label || 'Aucune'}</span>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Dernier depot</p>
                <p className="mt-3 text-sm font-medium text-foreground">{formatDate(identitySummary?.latestUploadedAt)}</p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Documents</p>
                <p className="mt-3 text-sm font-medium text-foreground">{documents?.length || 0}</p>
              </div>
            </div>

            {documents?.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-muted-foreground">
                Aucun document depose sur ce compte.
              </div>
            ) : (
              <div className="space-y-3">
                {(documents || [])?.map((document) => {
                  const statusConfig = getDocumentStatusConfig(document?.status);

                  return (
                    <div key={document?.id} className="rounded-lg border border-border p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-foreground">{document?.documentTypeLabel || 'Document'}</p>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${statusConfig?.color}`}>
                              <Icon name={statusConfig?.icon} size={12} />
                              {statusConfig?.label}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground break-all">{document?.fileName || 'Nom non renseigne'}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Depose le {formatDate(document?.uploadDate)}
                          </p>
                          {document?.rejectionReason ? (
                            <p className="mt-2 text-xs text-error">
                              Motif: {document?.rejectionReason}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            iconName="Eye"
                            onClick={() => handleOpenDocument(document)}
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
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white rounded-lg shadow-elevation-4 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <div className="border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img
                  src={user?.avatar_url || user?.avatar || '/assets/images/no_image.png'}
                  alt={user?.pseudo}
                  className="w-16 h-16 rounded-full object-cover"
                />
                <div>
                  <h2 className="text-xl font-semibold text-foreground">{user?.pseudo}</h2>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-surface rounded-md transition-colors"
              >
                <Icon name="X" size={20} />
              </button>
            </div>
          </div>

          <div className="border-b border-border overflow-x-auto">
            <div className="flex min-w-max">
              {tabs?.map((tab) => (
                <button
                  key={tab?.id}
                  onClick={() => setActiveTab(tab?.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === tab?.id
                      ? 'border-[#17a2b8] text-[#17a2b8] bg-[#17a2b8]/5'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-surface'
                  }`}
                >
                  <Icon name={tab?.icon} size={16} />
                  <span>{tab?.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : (
              renderTabContent()
            )}
          </div>

          <div className="bg-surface border-t border-border px-6 py-4 flex items-center justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Fermer
            </Button>
          </div>
        </div>
      </div>

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
    </>
  );
};

export default UserDetailModal;
