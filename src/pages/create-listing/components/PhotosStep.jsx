import React, { useRef, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Image from '../../../components/AppImage';
import CameraCaptureModal from './CameraCaptureModal';

const PhotosStep = ({ formData, updateFormData, errors }) => {
  const fileInputRef = useRef(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);

  const handleFileSelect = (e) => {
    const files = Array.from(e?.target?.files || []);
    const newPhotos = files?.map((file) => ({
      id: Math.random()?.toString(36)?.substr(2, 9),
      file,
      preview: URL.createObjectURL(file)
    }));
    updateFormData('photos', [...formData?.photos, ...newPhotos]);
  };

  const handleDragOver = (e) => {
    e?.preventDefault();
  };

  const handleDrop = (e) => {
    e?.preventDefault();
    const files = Array.from(e?.dataTransfer?.files || []);
    const imageFiles = files?.filter((file) => file?.type?.startsWith('image/'));
    const newPhotos = imageFiles?.map((file) => ({
      id: Math.random()?.toString(36)?.substr(2, 9),
      file,
      preview: URL.createObjectURL(file)
    }));
    updateFormData('photos', [...formData?.photos, ...newPhotos]);
  };

  const handleDelete = (photoId) => {
    const updatedPhotos = formData?.photos?.filter((p) => p?.id !== photoId);
    updateFormData('photos', updatedPhotos);
  };

  const handleCameraCapture = (file, previewUrl) => {
    const newPhoto = {
      id: Math.random()?.toString(36)?.substr(2, 9),
      file,
      preview: previewUrl
    };
    updateFormData('photos', [...formData?.photos, newPhoto]);
  };

  const handleReorder = (photoId, direction) => {
    const currentIndex = formData?.photos?.findIndex((p) => p?.id === photoId);
    if (currentIndex === -1) return;

    const newPhotos = [...formData?.photos];
    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= newPhotos?.length) return;

    [newPhotos[currentIndex], newPhotos[targetIndex]] = [newPhotos?.[targetIndex], newPhotos?.[currentIndex]];
    updateFormData('photos', newPhotos);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Photos de votre matériel</h2>
        <p className="text-sm text-muted-foreground">Ajoutez des photos de qualité pour attirer les locataires</p>
      </div>
      {/* Zone de téléversement */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef?.current?.click()}
        className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-[#17a2b8] hover:bg-surface transition-colors"
      >
        <Icon name="Upload" size={48} className="mx-auto text-muted-foreground mb-4" />
        <p className="text-foreground font-medium mb-2">Glissez-déposez vos photos ici</p>
        <p className="text-sm text-muted-foreground mb-2">
          Cliquez n&apos;importe où dans ce cadre pointillé pour sélectionner vos photos
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          Vous pouvez aussi glisser-déposer vos images directement ici
        </p>
        <div className="flex gap-3 justify-center" onClick={(e) => e?.stopPropagation()}>
          <Button
            variant="outline"
            size="sm"
            iconName="Camera"
            onClick={(e) => {
              e?.stopPropagation();
              setIsCameraModalOpen(true);
            }}
          >
            Prendre une photo
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
      {errors?.photos && (
        <p className="text-sm text-error">{errors?.photos}</p>
      )}
      {/* Photo Previews */}
      {formData?.photos?.length > 0 && (
        <div>
          <p className="text-sm font-medium text-foreground mb-3">
            {formData?.photos?.length} photo{formData?.photos?.length > 1 ? 's' : ''} ajoutée{formData?.photos?.length > 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {formData?.photos?.map((photo, index) => (
              <div key={photo?.id} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden border border-border">
                  <Image
                    src={photo?.preview}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                {index === 0 && (
                  <div className="absolute top-2 left-2 bg-[#17a2b8] text-white text-xs font-medium px-2 py-1 rounded">
                    Photo principale
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                  {index > 0 && (
                    <button
                      onClick={() => handleReorder(photo?.id, 'left')}
                      className="p-2 bg-white rounded-full hover:bg-surface transition-colors"
                    >
                      <Icon name="ChevronLeft" size={16} />
                    </button>
                  )}
                  {index < formData?.photos?.length - 1 && (
                    <button
                      onClick={() => handleReorder(photo?.id, 'right')}
                      className="p-2 bg-white rounded-full hover:bg-surface transition-colors"
                    >
                      <Icon name="ChevronRight" size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(photo?.id)}
                    className="p-2 bg-error text-white rounded-full hover:bg-error/90 transition-colors"
                  >
                    <Icon name="Trash2" size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={handleCameraCapture}
      />
      {/* Tips */}
      <div className="bg-[#17a2b8]/10 border border-[#17a2b8]/20 rounded-lg p-4">
        <div className="flex gap-2">
          <Icon name="Lightbulb" size={18} className="text-[#17a2b8] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground mb-2">Conseils pour de bonnes photos</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Prenez des photos dans un endroit bien éclairé</li>
              <li>• Montrez le matériel sous différents angles</li>
              <li>• Incluez les accessoires fournis</li>
              <li>• La première photo ser? la photo principale</li>
              <li>Un visuel À LOUER est généré automatiquement avec la ville, le code postal, le titre complet et le prix par jour</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotosStep;
