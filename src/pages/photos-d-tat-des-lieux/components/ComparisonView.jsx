import React, { useMemo, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Image from '../../../components/AppImage';

const getCautionStatusConfig = (status) => {
  const key = String(status || 'pending')?.toLowerCase();
  const configs = {
    none: { label: 'Aucune caution', color: 'text-muted-foreground bg-surface' },
    pending: { label: 'En attente', color: 'text-muted-foreground bg-surface' },
    authorized: { label: 'Autorisée', color: 'text-success bg-success/10' },
    released: { label: 'Libérée', color: 'text-success bg-success/10' },
    held: { label: 'Retenue', color: 'text-warning bg-warning/10' },
    captured: { label: 'Capturée', color: 'text-warning bg-warning/10' }
  };
  return configs?.[key] || configs?.pending;
};

const getSettlementStatusConfig = (status) => {
  const key = String(status || 'pending_end_inspection')?.toLowerCase();
  const configs = {
    pending_end_inspection: { label: 'En attente de clôture', color: 'text-muted-foreground bg-surface' },
    hold_24h: { label: 'Fenêtre 24h ouverte', color: 'text-warning bg-warning/10' },
    disputed_pending_moderation: { label: 'Litige en modération', color: 'text-warning bg-warning/10' },
    released_no_dispute: { label: 'Versement libéré (sans litige)', color: 'text-success bg-success/10' },
    released_after_moderation: { label: 'Versement libéré (modération)', color: 'text-success bg-success/10' },
    captured_after_moderation: { label: 'Retenue confirmée (modération)', color: 'text-destructive bg-destructive/10' }
  };
  return configs?.[key] || configs?.pending_end_inspection;
};

const getDisputeStatusConfig = (status) => {
  const key = String(status || 'opened')?.toLowerCase();
  const configs = {
    opened: { label: 'Ouvert', color: 'text-warning bg-warning/10' },
    under_review: { label: 'En revue', color: 'text-warning bg-warning/10' },
    pending_information: { label: 'Infos demandées', color: 'text-warning bg-warning/10' },
    resolved_release: { label: 'Résolution : libération', color: 'text-success bg-success/10' },
    resolved_capture: { label: 'Résolution : retenue', color: 'text-destructive bg-destructive/10' },
    rejected: { label: 'Rejeté', color: 'text-muted-foreground bg-surface' },
    withdrawn: { label: 'Retiré', color: 'text-muted-foreground bg-surface' }
  };
  return configs?.[key] || configs?.opened;
};

const ComparisonView = ({
  beforePhotos,
  afterPhotos,
  cautionAmount = 0,
  cautionStatus = 'pending',
  canManageCaution = false,
  cautionActionLoading = false,
  onReleaseCaution,
  onCaptureCaution,
  onPartialCaptureCaution = null,
  settlement = null,
  disputes = [],
  currentUserId = null,
  currentUserRole = null,
  canOpenDispute = false,
  disputeOpening = false,
  onOpenDispute = null,
  manualCautionLockedReason = null,
  legalArbitrationScopeNote = null,
  contestWindowEndsAt = null,
  settlementPaymentHoldStatus = null
}) => {
  const [selectedBeforeIndex, setSelectedBeforeIndex] = useState(0);
  const [selectedAfterIndex, setSelectedAfterIndex] = useState(0);
  const [zoomedPhoto, setZoomedPhoto] = useState(null);
  const [selectedDisputePhotoIds, setSelectedDisputePhotoIds] = useState([]);
  const [disputeDescription, setDisputeDescription] = useState('');
  const [disputeTitle, setDisputeTitle] = useState('');

  const cautionStatusConfig = useMemo(() => getCautionStatusConfig(cautionStatus), [cautionStatus]);
  const settlementStatusConfig = useMemo(() => getSettlementStatusConfig(settlement?.status), [settlement?.status]);
  const hasCaution = Number(cautionAmount || 0) > 0;
  const partialCaptureSupported = typeof onPartialCaptureCaution === 'function';
  const canSubmitDispute = canOpenDispute && typeof onOpenDispute === 'function';
  const disputeDeadlineDate = contestWindowEndsAt ? new Date(contestWindowEndsAt) : null;
  const disputeWindowOpen = disputeDeadlineDate && disputeDeadlineDate?.getTime() > Date.now();
  const allPhotosForDispute = useMemo(() => ([
    ...(beforePhotos || [])?.map((photo) => ({ ...photo, phase: 'start', phaseLabel: 'Début' })),
    ...(afterPhotos || [])?.map((photo) => ({ ...photo, phase: 'end', phaseLabel: 'Fin' }))
  ]), [beforePhotos, afterPhotos]);
  const selectedDisputePhotoCount = selectedDisputePhotoIds?.length;
  const openDisputes = (disputes || [])?.filter((d) => ['opened', 'under_review', 'pending_information']?.includes(String(d?.status || '')?.toLowerCase()));
  const userOpenDispute = openDisputes?.find((d) => String(d?.opened_by_user_id || '') === String(currentUserId || ''));
  const canShowDisputeForm = canSubmitDispute && !userOpenDispute && Boolean(disputeWindowOpen);

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date?.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    if (Number.isNaN(date?.getTime())) return '-';
    return date?.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleZoom = (photo, type) => {
    setZoomedPhoto({ ...photo, type });
  };

  const toggleDisputePhoto = (photoId) => {
    const key = String(photoId || '');
    if (!key) return;
    setSelectedDisputePhotoIds((prev) => (
      prev?.includes(key) ? prev?.filter((id) => id !== key) : [...(prev || []), key]
    ));
  };

  const submitDispute = async () => {
    if (!canShowDisputeForm) return;

    const result = await onOpenDispute?.({
      selectedPhotoIds: selectedDisputePhotoIds,
      description: disputeDescription,
      title: disputeTitle
    });

    if (result?.ok) {
      setSelectedDisputePhotoIds([]);
      setDisputeDescription('');
      setDisputeTitle('');
    }
  };

  if (beforePhotos?.length === 0 && afterPhotos?.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-elevation-1 p-12 text-center">
        <Icon name="ImageOff" size={64} className="mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Aucune photo disponible pour la comparaison</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-elevation-1 p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Clôture et règlement final (mode officiel)</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Fenêtre de contestation de 24h après clôture de l'état des lieux de fin, puis traitement automatique / modération.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`px-2 py-1 rounded-full font-medium ${settlementStatusConfig?.color}`}>
              {settlementStatusConfig?.label}
            </span>
            {settlementPaymentHoldStatus && (
              <span className="px-2 py-1 rounded-full font-medium bg-surface text-muted-foreground">
                Paiement: {String(settlementPaymentHoldStatus).replaceAll('_', ' ')}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="text-muted-foreground mb-1">Fin de fenêtre de contestation</p>
            <p className="font-medium text-foreground">{formatDateTime(contestWindowEndsAt || settlement?.contest_window_ends_at)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {disputeWindowOpen ? 'La contestation est encore possible.' : 'La fenêtre est fermée ou non ouverte.'}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="text-muted-foreground mb-1">Portée de l'arbitrage interne</p>
            <p className="text-xs text-foreground">
              {legalArbitrationScopeNote || settlement?.legal_scope_note || "Règle d'arbitrage interne non disponible."}
            </p>
          </div>
        </div>

        {(disputes || [])?.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Litiges enregistrés</p>
            {(disputes || [])?.map((dispute) => {
              const disputeStatusConfig = getDisputeStatusConfig(dispute?.status);
              return (
                <div key={dispute?.id} className="rounded-lg border border-border p-3 bg-white">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${disputeStatusConfig?.color}`}>
                      {disputeStatusConfig?.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(dispute?.opened_at)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {String(dispute?.opened_by_role || '') === 'owner' ? 'Propriétaire' : 'Locataire'}
                    </span>
                  </div>
                  {dispute?.title && (
                    <p className="text-sm font-medium text-foreground">{dispute?.title}</p>
                  )}
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{dispute?.description}</p>
                  {Array?.isArray(dispute?.selected_photos) && dispute?.selected_photos?.length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Photos ciblées: {dispute?.selected_photos?.map((p) => `${p?.photo_phase || '?'}#${p?.photo_id_text || '?'}`)?.join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {canShowDisputeForm && (
          <div className="rounded-lg border border-warning/20 bg-warning/5 p-4 space-y-4">
            <div className="flex items-start gap-2">
              <Icon name="AlertTriangle" size={18} className="text-warning mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Ouvrir un litige (conditions strictes)</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Sélectionnez précisément les photos concernées et décrivez le problème. Les contestations vagues ou hors délai sont refusées.
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground mb-2">Photos concernées (obligatoire)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {allPhotosForDispute?.map((photo) => {
                  const checked = selectedDisputePhotoIds?.includes(String(photo?.id));
                  return (
                    <button
                      key={`${photo?.phase}-${photo?.id}`}
                      type="button"
                      onClick={() => toggleDisputePhoto(photo?.id)}
                      className={`text-left rounded-lg border overflow-hidden transition-all ${checked ? 'border-warning shadow-md' : 'border-border hover:border-warning/40'}`}
                    >
                      <div className="aspect-video relative">
                        <Image src={photo?.url} alt={`Photo ${photo?.phaseLabel}`} className="w-full h-full object-cover" />
                        <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/70 text-white text-[10px]">
                          {photo?.phaseLabel}
                        </div>
                        <div className={`absolute top-2 right-2 p-1 rounded-full ${checked ? 'bg-warning text-white' : 'bg-white/90 text-foreground'}`}>
                          <Icon name={checked ? 'Check' : 'Plus'} size={12} />
                        </div>
                      </div>
                      <div className="px-2 py-1 bg-white text-[10px] text-muted-foreground truncate">
                        {formatTimestamp(photo?.timestamp)}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {selectedDisputePhotoCount} photo{selectedDisputePhotoCount > 1 ? 's' : ''} sélectionnée{selectedDisputePhotoCount > 1 ? 's' : ''}
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-foreground">Titre (optionnel)</label>
              <input
                type="text"
                value={disputeTitle}
                onChange={(e) => setDisputeTitle(e?.target?.value)}
                maxLength={120}
                placeholder="Ex: Rayure sur flanc gauche"
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-foreground">Explication détaillée (obligatoire)</label>
              <textarea
                value={disputeDescription}
                onChange={(e) => setDisputeDescription(e?.target?.value)}
                rows={4}
                minLength={30}
                placeholder="Décrivez précisément le problème, les photos concernées, et l'écart constaté entre début et fin."
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white resize-y"
              />
              <div className="text-xs text-muted-foreground">
                {String(disputeDescription || '')?.trim()?.length} / 30 minimum
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Une fois un litige ouvert, le dossier est gelé pour modération interne.
              </p>
              <Button
                variant="warning"
                iconName={disputeOpening ? 'Loader2' : 'AlertTriangle'}
                disabled={disputeOpening || selectedDisputePhotoCount === 0 || String(disputeDescription || '')?.trim()?.length < 30}
                onClick={submitDispute}
              >
                {disputeOpening ? 'Ouverture...' : 'Ouvrir un litige'}
              </Button>
            </div>
          </div>
        )}

        {!canShowDisputeForm && (
          <div className="rounded-lg border border-border bg-surface p-3 text-sm text-muted-foreground">
            {userOpenDispute
              ? 'Vous avez déjà un litige en cours sur cette réservation. Suivez le traitement de modération.'
              : disputeWindowOpen
                ? 'La contestation est réservée aux participants et nécessite la clôture de la phase de fin avec des photos disponibles.'
                : "La fenêtre de contestation est fermée ou n'est pas encore ouverte."}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-elevation-1 overflow-hidden">
          <div className="bg-success/10 px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="Camera" size={18} className="text-success" />
                <h3 className="font-semibold text-foreground">Avant location</h3>
              </div>
              {beforePhotos?.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {selectedBeforeIndex + 1} / {beforePhotos?.length}
                </span>
              )}
            </div>
          </div>

          {beforePhotos?.length === 0 ? (
            <div className="aspect-video flex items-center justify-center bg-surface">
              <div className="text-center">
                <Icon name="ImageOff" size={48} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Aucune photo avant</p>
              </div>
            </div>
          ) : (
            <>
              <div className="aspect-video relative group">
                <Image
                  src={beforePhotos?.[selectedBeforeIndex]?.url}
                  alt="Photo avant location"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => handleZoom(beforePhotos?.[selectedBeforeIndex], 'before')}
                  className="absolute bottom-4 right-4 p-2 bg-white/90 hover:bg-white rounded-full shadow-lg transition-opacity opacity-0 group-hover:opacity-100"
                >
                  <Icon name="ZoomIn" size={20} />
                </button>
              </div>

              <div className="p-4 bg-surface space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon name="Clock" size={12} />
                  <span>{formatTimestamp(beforePhotos?.[selectedBeforeIndex]?.timestamp)}</span>
                </div>
                {beforePhotos?.[selectedBeforeIndex]?.uploadedBy && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon name="User" size={12} />
                    <span>{beforePhotos?.[selectedBeforeIndex]?.uploadedBy}</span>
                  </div>
                )}
                {beforePhotos?.[selectedBeforeIndex]?.comment && (
                  <div className="mt-2 p-2 bg-white rounded border border-border">
                    <p className="text-xs text-foreground">{beforePhotos?.[selectedBeforeIndex]?.comment}</p>
                  </div>
                )}
              </div>

              {beforePhotos?.length > 1 && (
                <div className="p-3 border-t border-border">
                  <div className="flex gap-2 overflow-x-auto">
                    {beforePhotos?.map((photo, index) => (
                      <button
                        key={photo?.id}
                        onClick={() => setSelectedBeforeIndex(index)}
                        className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                          index === selectedBeforeIndex
                            ? 'border-success shadow-md scale-105'
                            : 'border-transparent hover:border-border'
                        }`}
                      >
                        <Image src={photo?.url} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-elevation-1 overflow-hidden">
          <div className="bg-[#17a2b8]/10 px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="Camera" size={18} className="text-[#17a2b8]" />
                <h3 className="font-semibold text-foreground">Après restitution</h3>
              </div>
              {afterPhotos?.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {selectedAfterIndex + 1} / {afterPhotos?.length}
                </span>
              )}
            </div>
          </div>

          {afterPhotos?.length === 0 ? (
            <div className="aspect-video flex items-center justify-center bg-surface">
              <div className="text-center">
                <Icon name="ImageOff" size={48} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Aucune photo après</p>
              </div>
            </div>
          ) : (
            <>
              <div className="aspect-video relative group">
                <Image
                  src={afterPhotos?.[selectedAfterIndex]?.url}
                  alt="Photo après restitution"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => handleZoom(afterPhotos?.[selectedAfterIndex], 'after')}
                  className="absolute bottom-4 right-4 p-2 bg-white/90 hover:bg-white rounded-full shadow-lg transition-opacity opacity-0 group-hover:opacity-100"
                >
                  <Icon name="ZoomIn" size={20} />
                </button>
              </div>

              <div className="p-4 bg-surface space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon name="Clock" size={12} />
                  <span>{formatTimestamp(afterPhotos?.[selectedAfterIndex]?.timestamp)}</span>
                </div>
                {afterPhotos?.[selectedAfterIndex]?.uploadedBy && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon name="User" size={12} />
                    <span>{afterPhotos?.[selectedAfterIndex]?.uploadedBy}</span>
                  </div>
                )}
                {afterPhotos?.[selectedAfterIndex]?.comment && (
                  <div className="mt-2 p-2 bg-white rounded border border-border">
                    <p className="text-xs text-foreground">{afterPhotos?.[selectedAfterIndex]?.comment}</p>
                  </div>
                )}
              </div>

              {afterPhotos?.length > 1 && (
                <div className="p-3 border-t border-border">
                  <div className="flex gap-2 overflow-x-auto">
                    {afterPhotos?.map((photo, index) => (
                      <button
                        key={photo?.id}
                        onClick={() => setSelectedAfterIndex(index)}
                        className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                          index === selectedAfterIndex
                            ? 'border-[#17a2b8] shadow-md scale-105'
                            : 'border-transparent hover:border-border'
                        }`}
                      >
                        <Image src={photo?.url} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-elevation-1 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold text-foreground">Decision sur la caution</h3>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Montant:</span>
            <span className="font-semibold text-foreground">{Number(cautionAmount || 0)?.toFixed(2)} EUR</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${cautionStatusConfig?.color}`}>
              {cautionStatusConfig?.label}
            </span>
          </div>
        </div>

        {!hasCaution ? (
          <div className="bg-surface rounded-lg p-4 text-sm text-muted-foreground">
            Aucune empreinte CB a gerer pour cette reservation.
          </div>
        ) : (
          <>
            {!canManageCaution && (
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 mb-4 text-sm text-foreground">
                {manualCautionLockedReason || "Seul le propriétaire peut prendre une décision sur l'empreinte CB depuis cet écran."}
              </div>
            )}

            <div className="flex flex-col md:flex-row gap-4">
              <Button
                variant="success"
                iconName="CheckCircle"
                className="flex-1"
                disabled={!canManageCaution || cautionActionLoading || cautionStatus === 'released'}
                onClick={onReleaseCaution}
              >
                {"Libérer l'empreinte CB"}
              </Button>
              <Button
                variant="warning"
                iconName="AlertTriangle"
                className="flex-1"
                disabled={!canManageCaution || cautionActionLoading || !partialCaptureSupported}
                onClick={onPartialCaptureCaution || undefined}
              >
                Capturer partiellement
              </Button>
              <Button
                variant="danger"
                iconName="XCircle"
                className="flex-1"
                disabled={!canManageCaution || cautionActionLoading || cautionStatus === 'captured'}
                onClick={onCaptureCaution}
              >
                {"Capturer l'empreinte CB"}
              </Button>
            </div>

            {cautionActionLoading && (
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Icon name="Loader2" size={16} className="animate-spin" />
                <span>Mise à jour de l'empreinte CB...</span>
              </div>
            )}

            {!partialCaptureSupported && (
              <p className="mt-3 text-xs text-muted-foreground">
                La retenue partielle sera activee quand le montant de prelevement partiel sera pris en charge.
              </p>
            )}
          </>
        )}
      </div>

      {zoomedPhoto && (
        <div
          className="fixed inset-0 z-modal bg-black/90 flex items-center justify-center p-4"
          onClick={() => setZoomedPhoto(null)}
        >
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setZoomedPhoto(null)}
            className="absolute top-4 right-4 bg-white/90 hover:bg-white rounded-full shadow-lg z-10"
          >
            <Icon name="X" size={24} />
          </Button>
          <div className="max-w-7xl max-h-full">
            <Image
              src={zoomedPhoto?.url}
              alt={`Photo ${zoomedPhoto?.type}`}
              className="max-w-full max-h-[90vh] object-contain"
            />
            <div className="mt-4 text-center">
              <span className="inline-block px-4 py-2 bg-white/90 rounded-full text-sm font-medium">
                {zoomedPhoto?.type === 'before' ? 'Avant location' : 'Après restitution'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComparisonView;
