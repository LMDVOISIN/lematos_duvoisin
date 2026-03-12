import React, { useState } from 'react';
import Image from '../../../components/AppImage';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const PhotoGallery = ({ images = [] }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const galleryControlClassName = "h-12 w-12 rounded-full border border-white/70 bg-slate-950/72 text-white shadow-[0_10px_30px_rgba(15,23,42,0.35)] backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-slate-950/88 focus-visible:ring-2 focus-visible:ring-white";

  const handlePrevious = () => {
    setSelectedIndex((prev) => (prev === 0 ? images?.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setSelectedIndex((prev) => (prev === images?.length - 1 ? 0 : prev + 1));
  };

  const handleThumbnailClick = (index) => {
    setSelectedIndex(index);
  };

  const handleZoomToggle = () => {
    setIsZoomed(!isZoomed);
  };

  if (!images || images?.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="w-full h-96 flex items-center justify-center bg-muted">
          <Icon name="Image" size={48} className="text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Main Image */}
      <div className="relative w-full h-96 lg:h-[500px] bg-muted group">
        <Image
          src={images?.[selectedIndex]?.url}
          alt={images?.[selectedIndex]?.alt || "Photo de l'annonce"}
          className="w-full h-full object-cover"
          loading="eager"
          fetchPriority="high"
          decoding="async"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = '/assets/images/no_image.png';
          }}
        />
        
        {/* Navigation Arrows */}
        {images?.length > 1 && (
          <>
            <Button
              variant="secondary"
              size="icon"
              onClick={handlePrevious}
              aria-label="Photo précédente"
              className={`absolute left-4 top-1/2 -translate-y-1/2 ${galleryControlClassName}`}
            >
              <Icon name="ChevronLeft" size={26} strokeWidth={2.5} />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={handleNext}
              aria-label="Photo suivante"
              className={`absolute right-4 top-1/2 -translate-y-1/2 ${galleryControlClassName}`}
            >
              <Icon name="ChevronRight" size={26} strokeWidth={2.5} />
            </Button>
          </>
        )}

        {/* Zoom Button */}
        <Button
          variant="secondary"
          size="icon"
          onClick={handleZoomToggle}
          aria-label={isZoomed ? "Réduire l'image" : "Agrandir l'image"}
          className={`absolute bottom-4 right-4 ${galleryControlClassName}`}
        >
          <Icon name={isZoomed ? "ZoomOut" : "ZoomIn"} size={22} strokeWidth={2.5} />
        </Button>

        {/* Image Counter */}
        <div className="absolute bottom-4 left-4 px-3 py-1 bg-black/60 text-white text-sm rounded-full">
          {selectedIndex + 1} / {images?.length}
        </div>
      </div>
      {/* Thumbnail Carousel */}
      {images?.length > 1 && (
        <div className="p-4 bg-surface">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {images?.map((image, index) => (
              <button
                key={index}
                onClick={() => handleThumbnailClick(index)}
                className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                  index === selectedIndex
                    ? 'border-[#17a2b8] shadow-md scale-105'
                    : 'border-transparent hover:border-border'
                }`}
              >
                <Image
                  src={image?.url}
                  alt={image?.alt || `Miniature ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  fetchPriority="low"
                  decoding="async"
                />
              </button>
            ))}
          </div>
        </div>
      )}
      {/* Zoom Modal */}
      {isZoomed && (
        <div 
          className="fixed inset-0 z-[1030] bg-black/90 flex items-center justify-center p-4"
          onClick={handleZoomToggle}
        >
          <Button
            variant="secondary"
            size="icon"
            onClick={handleZoomToggle}
            aria-label="Fermer l'agrandissement"
            className={`absolute top-4 right-4 z-10 ${galleryControlClassName}`}
          >
            <Icon name="X" size={24} strokeWidth={2.5} />
          </Button>
          <div className="max-w-7xl max-h-full">
            <Image
              src={images?.[selectedIndex]?.url}
              alt={images?.[selectedIndex]?.alt || "Photo de l'annonce"}
              className="max-w-full max-h-[90vh] object-contain"
              loading="eager"
              decoding="async"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoGallery;
