import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Image from '../../../components/AppImage';
import CameraCaptureModal from '../../../pages/create-listing/components/CameraCaptureModal';

const AfterPhotosSection = ({
  photos,
  canUpload,
  onPhotoAdd,
  onPhotoDelete,
  session,
  currentUserRole,
  ownerLabel,
  renterLabel,
  canConfirmPresence,
  onConfirmPresence,
  confirmPresenceLoading,
  canFinalizePhotos,
  onFinalizePhotos,
  finalizePhotosLoading,
  caméraLockedReason,
  isPhaseClosed,
  attestationText,
  presenceButtonId = null,
  highlightPresenceButton = false
}) => {
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);

  const handleCameraCapture = (file, previewUrl) => {
    onPhotoAdd?.({
      file,
      previewUrl,
      timestamp: new Date()?.toISOString()
    });
  };

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

  const ownerPresenceConfirmed = Boolean(session?.owner_presence_confirmed_at);
  const renterPresenceConfirmed = Boolean(session?.renter_presence_confirmed_at);
  const ownerPhotosFinalized = Boolean(session?.owner_photos_finalized_at);
  const renterPhotosFinalized = Boolean(session?.renter_photos_finalized_at);
  const currentUserHasConfirmedPresence = currentUserRole === 'owner' ? ownerPresenceConfirmed : currentUserRole === 'renter' ? renterPresenceConfirmed : false;
  const currentUserHasFinalizedPhotos = currentUserRole === 'owner' ? ownerPhotosFinalized : currentUserRole === 'renter' ? renterPhotosFinalized : false;

  return (
    <div className="bg-white rounded-lg shadow-elevation-1 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-[#17a2b8]/10 rounded-lg">
            <Icon name="Camera" size={20} className="text-[#17a2b8]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Photos après restitution</h2>
            <p className="text-xs text-muted-foreground">Ajoutées par le locataire</p>
          </div>
        </div>
        <div className="px-2 py-1 bg-[#17a2b8]/10 rounded-full text-xs font-medium text-[#17a2b8]">
          {photos?.length} photo{photos?.length > 1 ? 's' : ''}
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-border bg-surface p-3">
        <div className="flex items-start gap-2">
          <Icon name="ShieldCheck" size={16} className="text-[#17a2b8] mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Présence contradictoire requise (fin)</p>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between rounded border border-border bg-white px-2 py-1">
                <span>{ownerLabel || 'Propriétaire'}</span>
                <span className={ownerPresenceConfirmed ? 'text-success font-medium' : 'text-muted-foreground'}>
                  {ownerPresenceConfirmed ? 'Présent confirmé' : 'En attente'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded border border-border bg-white px-2 py-1">
                <span>{renterLabel || 'Locataire'}</span>
                <span className={renterPresenceConfirmed ? 'text-success font-medium' : 'text-muted-foreground'}>
                  {renterPresenceConfirmed ? 'Présent confirmé' : 'En attente'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded border border-border bg-white px-2 py-1">
                <span>Finalisation propriétaire</span>
                <span className={ownerPhotosFinalized ? 'text-success font-medium' : 'text-muted-foreground'}>
                  {ownerPhotosFinalized ? 'Validée' : 'En attente'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded border border-border bg-white px-2 py-1">
                <span>Finalisation locataire</span>
                <span className={renterPhotosFinalized ? 'text-success font-medium' : 'text-muted-foreground'}>
                  {renterPhotosFinalized ? 'Validée' : 'En attente'}
                </span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {canConfirmPresence && (
                <Button
                  id={presenceButtonId || undefined}
                  variant="outline"
                  size="sm"
                  iconName={confirmPresenceLoading ? 'Loader2' : 'ShieldCheck'}
                  onClick={onConfirmPresence}
                  disabled={confirmPresenceLoading}
                  className={highlightPresenceButton ? 'ring-2 ring-[#17a2b8] ring-offset-2 animate-pulse' : ''}
                >
                  {confirmPresenceLoading ? 'Confirmation...' : 'Confirmer ma présence'}
                </Button>
              )}
              {!canConfirmPresence && currentUserHasConfirmedPresence && (
                <div className="text-xs text-success font-medium px-2 py-1 rounded bg-success/10">
                  Presence confirmée
                </div>
              )}

              {canFinalizePhotos && (
                <Button
                  variant="outline"
                  size="sm"
                  iconName={finalizePhotosLoading ? 'Loader2' : 'Check'}
                  onClick={onFinalizePhotos}
                  disabled={finalizePhotosLoading}
                >
                  {finalizePhotosLoading ? 'Finalisation...' : 'Finaliser mes photos'}
                </Button>
              )}
              {!canFinalizePhotos && currentUserHasFinalizedPhotos && (
                <div className="text-xs text-success font-medium px-2 py-1 rounded bg-success/10">
                  Vos photos sont finalisées
                </div>
              )}
              {isPhaseClosed && (
                <div className="text-xs text-[#17a2b8] font-medium px-2 py-1 rounded bg-[#17a2b8]/10">
                  Phase clôturée (preuves figées)
                </div>
              )}
            </div>

            {caméraLockedReason && !canUpload && (
              <p className="mt-2 text-xs text-muted-foreground">{caméraLockedReason}</p>
            )}
            {attestationText && canConfirmPresence && (
              <p className="mt-2 text-[11px] text-muted-foreground">{attestationText}</p>
            )}
          </div>
        </div>
      </div>

      {canUpload && (
        <div className="mb-4 border-2 border-dashed border-border rounded-lg p-4 text-center">
          <Icon name="Camera" size={32} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-3">
            Capture en direct uniquement (import de fichiers désactivé dans ce module)
          </p>
          <Button variant="outline" size="sm" iconName="Camera" onClick={() => setIsCameraModalOpen(true)}>
            Prendre une photo
          </Button>
        </div>
      )}

      {photos?.length === 0 ? (
        <div className="text-center py-8">
          <Icon name="ImageOff" size={48} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {canUpload ? 'Aucune photo après restitution' : 'En attente des photos de restitution'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {photos?.map((photo) => (
            <div key={photo?.id} className="border border-border rounded-lg overflow-hidden">
              <div className="aspect-video relative">
                <Image src={photo?.url} alt="Photo après restitution" className="w-full h-full object-cover" />
                {canUpload && (
                  <button
                    onClick={() => onPhotoDelete?.(photo?.id)}
                    className="absolute top-2 right-2 p-2 bg-error text-white rounded-full hover:bg-error/90 transition-colors"
                  >
                    <Icon name="Trash2" size={16} />
                  </button>
                )}
              </div>
              <div className="p-3 bg-surface space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon name="Clock" size={12} />
                  <span>{formatTimestamp(photo?.timestamp)}</span>
                </div>
                {photo?.gpsCoordinates && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon name="MapPin" size={12} />
                    <span>{photo?.gpsCoordinates}</span>
                  </div>
                )}
                {photo?.uploadedBy && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon name="User" size={12} />
                    <span>{photo?.uploadedBy}</span>
                  </div>
                )}
                {photo?.comment && (
                  <div className="mt-2 p-2 bg-white rounded border border-border">
                    <p className="text-xs text-foreground">{photo?.comment}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  );
};

export default AfterPhotosSection;
