import React, { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Image from '../../components/AppImage';
import CameraCaptureModal from '../create-listing/components/CameraCaptureModal';

const PhotosEtatDesLieux = () => {
  const { reservationId } = useParams();
  const [activeSection, setActiveSection] = useState('before');
  const [beforePhotos, setBeforePhotos] = useState([]);
  const [afterPhotos, setAfterPhotos] = useState([]);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [caméraTarget, setCameraTarget] = useState('before');
  const [comments, setComments] = useState({ before: '', after: '' });
  const [comparisonMode, setComparisonMode] = useState(false);
  const beforeFileInputRef = useRef(null);
  const afterFileInputRef = useRef(null);

  const handleFileSelect = (e, type) => {
    const files = Array.from(e?.target?.files || []);
    const newPhotos = files?.map((file) => ({
      id: Math.random()?.toString(36)?.substr(2, 9),
      file,
      preview: URL.createObjectURL(file),
      timestamp: new Date()?.toISOString(),
      type
    }));

    if (type === 'before') {
      setBeforePhotos([...beforePhotos, ...newPhotos]);
    } else {
      setAfterPhotos([...afterPhotos, ...newPhotos]);
    }
  };

  const handleCameraCapture = (file, previewUrl) => {
    const newPhoto = {
      id: Math.random()?.toString(36)?.substr(2, 9),
      file,
      preview: previewUrl,
      timestamp: new Date()?.toISOString(),
      type: caméraTarget
    };

    if (caméraTarget === 'before') {
      setBeforePhotos([...beforePhotos, newPhoto]);
    } else {
      setAfterPhotos([...afterPhotos, newPhoto]);
    }
  };

  const handleDeletePhoto = (photoId, type) => {
    if (type === 'before') {
      setBeforePhotos(beforePhotos?.filter((p) => p?.id !== photoId));
    } else {
      setAfterPhotos(afterPhotos?.filter((p) => p?.id !== photoId));
    }
  };

  const openCamera = (type) => {
    setCameraTarget(type);
    setIsCameraModalOpen(true);
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

  const handleSubmit = () => {
    console.log('Submitting photos:', {
      reservationId,
      beforePhotos,
      afterPhotos,
      comments
    });
    alert('Photos d\'état des lieux enregistrées avec succès');
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-6 md:py-8">
        {/* En-tête de page */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Photos d'état des lieux</h1>
          <p className="text-muted-foreground">Réservation #{reservationId}</p>
        </div>

        {/* Bascule de mode d'affichage */}
        <div className="flex gap-3 mb-6">
          <Button
            variant={!comparisonMode ? 'default' : 'outline'}
            onClick={() => setComparisonMode(false)}
            iconName="Upload"
            className={!comparisonMode ? 'bg-[#17a2b8] hover:bg-[#138496]' : ''}
          >
            Mode ajout de photos
          </Button>
          <Button
            variant={comparisonMode ? 'default' : 'outline'}
            onClick={() => setComparisonMode(true)}
            iconName="Columns"
            className={comparisonMode ? 'bg-[#17a2b8] hover:bg-[#138496]' : ''}
            disabled={beforePhotos?.length === 0 && afterPhotos?.length === 0}
          >
            Comparaison Avant/Après
          </Button>
        </div>

        {!comparisonMode ? (
          <>
            {/* Section Tabs */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setActiveSection('before')}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  activeSection === 'before'
                    ? 'bg-[#17a2b8] text-white' :'bg-white text-muted-foreground hover:bg-surface'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon name="Camera" size={18} />
                  <span>Photos avant location</span>
                  {beforePhotos?.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                      {beforePhotos?.length}
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={() => setActiveSection('after')}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  activeSection === 'after' ?'bg-[#17a2b8] text-white' :'bg-white text-muted-foreground hover:bg-surface'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon name="Camera" size={18} />
                  <span>Photos après restitution</span>
                  {afterPhotos?.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                      {afterPhotos?.length}
                    </span>
                  )}
                </div>
              </button>
            </div>

            {/* Section de téléversement */}
            <div className="bg-white rounded-lg shadow-elevation-1 p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  {activeSection === 'before' ? 'Photos avant location' : 'Photos après restitution'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {activeSection === 'before'
                    ? 'Le propriétaire doit prendre des photos de l\'équipement avant la location' :'Le locataire doit prendre des photos de l\'équipement lors de la restitution'}
                </p>
              </div>

              {/* Zone de téléversement */}
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center mb-6">
                <Icon name="Upload" size={48} className="mx-auto text-muted-foreground mb-4" />
                <p className="text-foreground font-medium mb-2">Ajouter des photos</p>
                <p className="text-sm text-muted-foreground mb-4">Glissez-déposez ou utilisez les boutons ci-dessous</p>
                <div className="flex gap-3 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    iconName="Image"
                    onClick={() => {
                      if (activeSection === 'before') {
                        beforeFileInputRef?.current?.click();
                      } else {
                        afterFileInputRef?.current?.click();
                      }
                    }}
                  >
                    Sélectionner des photos
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    iconName="Camera"
                    onClick={() => openCamera(activeSection)}
                    className="bg-[#17a2b8] hover:bg-[#138496]"
                  >
                    Prendre une photo
                  </Button>
                </div>
                <input
                  ref={beforeFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFileSelect(e, 'before')}
                  className="hidden"
                />
                <input
                  ref={afterFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFileSelect(e, 'after')}
                  className="hidden"
                />
              </div>

              {/* Photo Grid */}
              {(activeSection === 'before' ? beforePhotos : afterPhotos)?.length > 0 && (
                <div className="mb-6">
                  <p className="text-sm font-medium text-foreground mb-3">
                    {(activeSection === 'before' ? beforePhotos : afterPhotos)?.length} photo(s) ajoutée(s)
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {(activeSection === 'before' ? beforePhotos : afterPhotos)?.map((photo) => (
                      <div key={photo?.id} className="relative group">
                        <div className="aspect-square rounded-lg overflow-hidden border border-border">
                          <Image
                            src={photo?.preview}
                            alt={`Photo ${activeSection === 'before' ? 'avant' : 'après'}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                          {formatTimestamp(photo?.timestamp)}
                        </div>
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <button
                            onClick={() => handleDeletePhoto(photo?.id, activeSection)}
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

              {/* Comments Section */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Commentaires sur l'état de l'équipement
                </label>
                <textarea
                  value={comments?.[activeSection]}
                  onChange={(e) => setComments({ ...comments, [activeSection]: e?.target?.value })}
                  placeholder="Ajoutez des notes sur l'état de l'équipement, les défauts constatés, etc."
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                />
              </div>
            </div>
          </>
        ) : (
          /* Comparison View */
          <div className="bg-white rounded-lg shadow-elevation-1 p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">Comparaison Avant / Après</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Before Column */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-[#17a2b8]"></div>
                  <h3 className="font-semibold text-foreground">Avant location</h3>
                  <span className="text-sm text-muted-foreground">({beforePhotos?.length} photos)</span>
                </div>
                <div className="space-y-4">
                  {beforePhotos?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Icon name="ImageOff" size={48} className="mx-auto mb-2" />
                      <p className="text-sm">Aucune photo avant location</p>
                    </div>
                  ) : (
                    beforePhotos?.map((photo) => (
                      <div key={photo?.id} className="border border-border rounded-lg overflow-hidden">
                        <Image
                          src={photo?.preview}
                          alt="Photo avant location"
                          className="w-full aspect-video object-cover"
                        />
                        <div className="p-2 bg-surface">
                          <p className="text-xs text-muted-foreground">{formatTimestamp(photo?.timestamp)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* After Column */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-success"></div>
                  <h3 className="font-semibold text-foreground">Après restitution</h3>
                  <span className="text-sm text-muted-foreground">({afterPhotos?.length} photos)</span>
                </div>
                <div className="space-y-4">
                  {afterPhotos?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Icon name="ImageOff" size={48} className="mx-auto mb-2" />
                      <p className="text-sm">Aucune photo après restitution</p>
                    </div>
                  ) : (
                    afterPhotos?.map((photo) => (
                      <div key={photo?.id} className="border border-border rounded-lg overflow-hidden">
                        <Image
                          src={photo?.preview}
                          alt="Photo après restitution"
                          className="w-full aspect-video object-cover"
                        />
                        <div className="p-2 bg-surface">
                          <p className="text-xs text-muted-foreground">{formatTimestamp(photo?.timestamp)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" iconName="X">
            Annuler
          </Button>
          <Button
            variant="default"
            iconName="Save"
            onClick={handleSubmit}
            className="bg-[#17a2b8] hover:bg-[#138496]"
            disabled={beforePhotos?.length === 0 && afterPhotos?.length === 0}
          >
            Enregistrer les photos
          </Button>
        </div>
      </main>

      <Footer />

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  );
};

export default PhotosEtatDesLieux;


