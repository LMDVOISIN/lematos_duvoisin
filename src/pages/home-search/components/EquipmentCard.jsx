import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';
import { construireUrlAnnonce } from '../../../utils/listingUrl';
import { buildListingAnalyticsItem, trackAnalyticsEvent } from '../../../utils/analyticsTracking';

const SUPABASE_PUBLIC_OBJECT_SEGMENT = '/storage/v1/object/public/';
const SUPABASE_RENDER_IMAGE_SEGMENT = '/storage/v1/render/image/public/';

const buildOptimizedSupabaseImageUrl = (url, options = {}) => {
  const raw = String(url || '').trim();
  if (!raw || !/^https?:\/\//i.test(raw)) return raw;

  try {
    const parsed = new URL(raw);
    if (!parsed.pathname.includes(SUPABASE_PUBLIC_OBJECT_SEGMENT)) {
      return raw;
    }

    parsed.pathname = parsed.pathname.replace(
      SUPABASE_PUBLIC_OBJECT_SEGMENT,
      SUPABASE_RENDER_IMAGE_SEGMENT
    );

    const { width, height, quality = 72, resize = 'cover' } = options;
    if (width) parsed.searchParams.set('width', String(width));
    if (height) parsed.searchParams.set('height', String(height));
    if (quality) parsed.searchParams.set('quality', String(quality));
    if (resize) parsed.searchParams.set('resize', resize);

    return parsed.toString();
  } catch (_) {
    return raw;
  }
};

const EquipmentCard = ({ equipment, userLocation }) => {
  const navigate = useNavigate();
  const [isFavorite, setIsFavorite] = useState(equipment?.isFavorite || false);
  const analyticsItem = buildListingAnalyticsItem(equipment);
  const rawImageUrl = equipment?.image || equipment?.photos?.[0] || '/assets/images/no_image.png';
  const fallbackImageUrl = '/assets/images/no_image.png';
  const imageSrc360 = buildOptimizedSupabaseImageUrl(rawImageUrl, { width: 360, height: 270, quality: 68 });
  const imageSrc640 = buildOptimizedSupabaseImageUrl(rawImageUrl, { width: 640, height: 480, quality: 72 });
  const imageSrc960 = buildOptimizedSupabaseImageUrl(rawImageUrl, { width: 960, height: 720, quality: 76 });
  const hasOptimizedVariants = Boolean(
    rawImageUrl
    && imageSrc360
    && imageSrc640
    && imageSrc960
    && (imageSrc360 !== rawImageUrl || imageSrc640 !== rawImageUrl || imageSrc960 !== rawImageUrl)
  );
  const imageSrcSet = hasOptimizedVariants
    ? `${imageSrc360} 360w, ${imageSrc640} 640w, ${imageSrc960} 960w`
    : undefined;
  const listingReviewCount = Math.max(0, Number(equipment?.reviewCount || 0));
  const hasListingRating = listingReviewCount > 0 && Number.isFinite(Number(equipment?.rating));
  const ownerReviewCount = Math.max(0, Number(equipment?.ownerReviewCount || equipment?.owner?.review_count || 0));
  const ownerRating = Number(equipment?.ownerRating ?? equipment?.owner?.rating);
  const hasOwnerRating = ownerReviewCount > 0 && Number.isFinite(ownerRating);

  const handleOpenDetails = () => {
    if (!equipment?.id) return;
    trackAnalyticsEvent('select_item', {
      item_list_name: 'home_search_results',
      item_list_id: 'home_search_results',
      items: analyticsItem ? [analyticsItem] : undefined
    });
    navigate(construireUrlAnnonce(equipment));
  };

  const handleToggleFavorite = (event) => {
    event?.stopPropagation();
    setIsFavorite(!isFavorite);
  };

  const handleBooking = (event) => {
    event?.stopPropagation();
    if (!equipment?.id) return;
    trackAnalyticsEvent('begin_checkout', {
      checkout_step: 'booking_request_from_card',
      items: analyticsItem ? [analyticsItem] : undefined,
      value: analyticsItem?.price,
      currency: 'EUR'
    });
    navigate(`/traitement-paiement?annonceId=${equipment?.id}`);
  };

  const handleCardKeyDown = (event) => {
    if (event?.key === 'Enter' || event?.key === ' ') {
      event?.preventDefault();
      handleOpenDetails();
    }
  };

  return (
    <div
      className="bg-white rounded-lg border border-border overflow-hidden hover:shadow-elevation-2 transition-shadow group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onClick={handleOpenDetails}
      onKeyDown={handleCardKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Voir l'annonce ${equipment?.title || equipment?.titre || ''}`}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={imageSrc640 || rawImageUrl}
          srcSet={imageSrcSet}
          sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 28vw, (min-width: 768px) 44vw, 94vw"
          alt={equipment?.imageAlt || equipment?.titre || "Image de l'annonce"}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = fallbackImageUrl;
            if (e.target.srcset !== undefined) {
              e.target.srcset = '';
            }
          }}
        />

        <div className="absolute left-3 top-3 flex flex-col gap-2">
          <span className="inline-flex items-center rounded-full bg-[#1d4ed8] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            Offre
          </span>
          {equipment?.distanceText && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-white">
              <Icon name="MapPin" size={12} />
              {equipment?.distanceText}
            </span>
          )}
        </div>

        {/* Favorite Button */}
        <button
          type="button"
          onClick={handleToggleFavorite}
          className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-white rounded-full transition-colors"
          aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          <Icon
            name="Heart"
            size={18}
            className={isFavorite ? 'fill-error text-error' : 'text-muted-foreground'}
          />
        </button>

        {/* Availability Badge */}
        {equipment?.availability === 'limited' && (
          <div className="absolute bottom-3 left-3 bg-warning text-warning-foreground px-3 py-1 rounded-full text-xs font-medium">
            Disponibilité limitée
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h3 className="font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
          {equipment?.title || equipment?.titre}
        </h3>

        {/* Location */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
          <Icon name="MapPin" size={14} />
          <span>{equipment?.location || equipment?.ville}</span>
        </div>

        {/* Rating */}
        {hasListingRating && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1">
              <Icon name="Star" size={14} className="fill-warning text-warning" />
              <span className="text-sm font-medium text-foreground">{equipment?.rating}</span>
            </div>
            <span className="text-xs text-muted-foreground">({listingReviewCount} avis)</span>
          </div>
        )}

        {/* Propriétaire */}
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
          {equipment?.ownerAvatarUrl ? (
            <img
              src={equipment?.ownerAvatarUrl}
              alt={equipment?.ownerPseudonym}
              className="w-8 h-8 rounded-full object-cover"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div
            className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary"
            style={{ display: equipment?.ownerAvatarUrl ? 'none' : 'flex' }}
          >
            {equipment?.ownerInitials || 'AN'}
          </div>
          <div className="min-w-0">
            <span className="block text-sm text-muted-foreground truncate">{equipment?.ownerPseudonym || 'Propriétaire'}</span>
            {hasOwnerRating ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Icon name="Star" size={12} className="fill-warning text-warning" />
                <span className="font-medium text-foreground">{Math.round(ownerRating * 10) / 10}</span>
                <span>({ownerReviewCount} avis)</span>
              </span>
            ) : null}
          </div>
        </div>

        {/* Price */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-bold text-foreground">
              {equipment?.dailyPrice > 0 ? equipment?.dailyPrice?.toFixed(2) : '0.00'}
            </span>
            <span className="text-sm text-muted-foreground">/jour</span>
          </div>
          <Button variant="primary" size="sm" iconName="Calendar" onClick={handleBooking}>
            Réserver
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EquipmentCard;

