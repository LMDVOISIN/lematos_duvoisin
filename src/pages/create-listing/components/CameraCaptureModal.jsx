import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraDirection, CameraResultType, CameraSource } from '@capacitor/camera';

import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { isNativeApp } from '../../../utils/nativeRuntime';

const isNativeCameraExperience = () => isNativeApp();

const revokePreviewUrl = (preview) => {
  if (preview?.url && String(preview.url).startsWith('blob:')) {
    URL.revokeObjectURL(preview.url);
  }
};

const dataUrlToBlob = async (dataUrl) => {
  const response = await fetch(dataUrl);
  return response.blob();
};

const CameraCaptureModal = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen && !capturedImage) {
      void startCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setIsLoading(true);
    setError(null);

    if (isNativeCameraExperience()) {
      try {
        const photo = await Camera.getPhoto({
          quality: 90,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
          direction: CameraDirection.Rear,
          saveToGallery: false
        });

        if (!photo?.dataUrl) {
          throw new Error('Aucune photo n a ete retournee par la camera.');
        }

        const blob = await dataUrlToBlob(photo.dataUrl);
        setCapturedImage({ blob, url: photo.dataUrl });
      } catch (err) {
        const normalizedMessage = String(err?.message || '').toLowerCase();
        const isUserCancellation = normalizedMessage.includes('cancel');

        if (!isUserCancellation) {
          console.error('Camera access error:', err);
          setError('Impossible d acceder a la camera de votre appareil.');
        }
      } finally {
        setIsLoading(false);
      }

      return;
    }

    try {
      const mediaStream = await navigator?.mediaDevices?.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });

      setStream(mediaStream);
      if (videoRef?.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsLoading(false);
    } catch (err) {
      console.error('Camera access error:', err);
      let errorMessage = "Impossible d'acceder a la camera";

      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        errorMessage = "Acces a la camera refuse. Veuillez autoriser l'acces dans les parametres de votre navigateur.";
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        errorMessage = 'Aucune camera detectee sur cet appareil.';
      } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
        errorMessage = 'La camera est deja utilisee par une autre application.';
      }

      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream?.getTracks()?.forEach((track) => track?.stop());
      setStream(null);
    }
  };

  const handleCapture = () => {
    if (isNativeCameraExperience()) {
      void startCamera();
      return;
    }

    if (!videoRef?.current || !canvasRef?.current) return;

    const video = videoRef?.current;
    const canvas = canvasRef?.current;

    canvas.width = video?.videoWidth;
    canvas.height = video?.videoHeight;

    const context = canvas?.getContext('2d');
    context?.drawImage(video, 0, 0, canvas?.width, canvas?.height);

    canvas?.toBlob((blob) => {
      if (blob) {
        const imageUrl = URL.createObjectURL(blob);
        setCapturedImage({ blob, url: imageUrl });
        stopCamera();
      }
    }, 'image/jpeg', 0.95);
  };

  const handleRetake = () => {
    revokePreviewUrl(capturedImage);
    setCapturedImage(null);
    void startCamera();
  };

  const handleConfirm = () => {
    if (capturedImage) {
      const file = new File([capturedImage.blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture(file, capturedImage?.url);
      handleClose();
    }
  };

  const handleClose = () => {
    stopCamera();
    revokePreviewUrl(capturedImage);
    setCapturedImage(null);
    setError(null);
    setIsLoading(true);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-background rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Prendre une photo</h3>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-surface rounded-full transition-colors"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        <div className="flex-1 bg-black relative overflow-hidden">
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <Icon name="AlertCircle" size={48} className="text-error mb-4" />
              <p className="text-white text-lg mb-2">Erreur d acces camera</p>
              <p className="text-white/70 text-sm mb-4">{error}</p>
              <Button onClick={() => void startCamera()} variant="outline">
                Reessayer
              </Button>
            </div>
          ) : isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#17a2b8] border-t-transparent mb-4" />
              <p className="text-white">Chargement de la camera...</p>
            </div>
          ) : capturedImage ? (
            <img
              src={capturedImage?.url}
              alt="Captured"
              className="w-full h-full object-contain"
            />
          ) : isNativeCameraExperience() ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <Icon name="Camera" size={48} className="text-white" />
              <p className="text-white text-lg">La camera native de votre appareil va s ouvrir.</p>
              <p className="text-white/70 text-sm">Utilisez le bouton ci-dessous pour reprendre une photo.</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {!error && !isLoading && (
          <div className="p-4 border-t border-border">
            {capturedImage ? (
              <div className="flex gap-3 justify-center">
                <Button onClick={handleRetake} variant="outline" iconName="RotateCcw">
                  Reprendre
                </Button>
                <Button onClick={handleConfirm} iconName="Check">
                  Confirmer
                </Button>
              </div>
            ) : (
              <div className="flex justify-center">
                <Button
                  onClick={handleCapture}
                  size="lg"
                  className="rounded-full min-w-16 h-16 px-6"
                >
                  <Icon name="Camera" size={24} className="mr-2" />
                  {isNativeCameraExperience() ? 'Ouvrir la camera' : 'Capturer'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraCaptureModal;
