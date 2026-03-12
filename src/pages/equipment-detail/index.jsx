import React, { Suspense, useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import PhotoGallery from './components/PhotoGallery';
import OwnerProfile from './components/OwnerProfile';
import AvailabilityCalendar from './components/AvailabilityCalendar';
import SimilarListings from './components/SimilarListings';
import ShareButtons from './components/ShareButtons';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import ReportModal from '../../components/ReportModal';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import annonceService from '../../services/annonceService';
import messageService from '../../services/messageService';
import reservationService from '../../services/reservationService';
import normaliserAnnonce from '../../utils/annonceNormalizer';
import { buildListingAnalyticsItem, trackAnalyticsEvent } from '../../utils/analyticsTracking';
import { construireUrlAnnonce, construireUrlAnnonceAbsolue } from '../../utils/listingUrl';
import { shareContent } from '../../utils/nativeRuntime';
import { storeAuthRedirectPath } from '../../utils/authRedirect';
import {
  SAME_DAY_RESERVATION_BLOCKED_MESSAGE,
  getEarliestReservationStartDate,
  isReservationStartDateAllowed,
  toReservationDateOnly
} from '../../utils/reservationDateRules';
import {
  buildBlockedDateSet,
  isDateAllowedByWeekdays,
  normalizeScheduleWeekdays,
  rangeContainsBlockedDate
} from '../../utils/availabilityRules';
import { formatTimeRange } from '../../utils/timeSlots';

const SITE_NAME = 'Le Matos Du Voisin';
const DEFAULT_SOCIAL_IMAGE = '/assets/images/android-chrome-192x192-1771179342850.png';
const DEFAULT_SOCIAL_IMAGE_WIDTH = 1200;
const DEFAULT_SOCIAL_IMAGE_HEIGHT = 630;
const DEFAULT_SEO_DESCRIPTION = 'Location de matériel entre voisins en toute sécurité.';
const LocationMap = React.lazy(() => import('./components/LocationMap'));
const BLOCKING_STATUSES = new Set(['accepted', 'paid', 'active', 'ongoing']);

const expandReservationDates = (startDateValue, endDateValue) => {
  const startDate = new Date(startDateValue);
  const endDate = new Date(endDateValue);
  if (Number.isNaN(startDate?.getTime()) || Number.isNaN(endDate?.getTime())) return [];

  const current = new Date(startDate);
  const dates = [];
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

const nettoyerTexteSeo = (value = '') =>
  String(value || '')
    ?.replace(/<[^>]*>/g, ' ')
    ?.replace(/&nbsp;/gi, ' ')
    ?.replace(/\s+/g, ' ')
    ?.trim();

const tronquerTexte = (value = '', maxLength = 160) => {
  const text = nettoyerTexteSeo(value);
  if (!text) return '';
  if (text?.length <= maxLength) return text;
  return `${text?.slice(0, Math.max(0, maxLength - 3))?.trimEnd()}...`;
};

const versUrlAbsolue = (value, origin = '') => {
  if (!value) return '';
  const text = String(value)?.trim();
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  if (text?.startsWith('//')) return `https:${text}`;
  if (!origin) return text;
  if (text?.startsWith('/')) return `${origin}${text}`;
  return `${origin}/${text?.replace(/^\/+/, '')}`;
};

const parseSeoCoordinate = (value) => {
  if (value == null) return null;
  const raw = String(value)?.trim();
  if (!raw) return null;
  const numeric = Number(raw?.replace(',', '.'));
  if (!Number.isFinite(numeric)) return null;
  return numeric;
};

const parsePositiveInteger = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.round(numeric);
};

const estAnnoncePubliquementIndexable = (row = {}) => {
  const statut = String(row?.statut || row?.status || '')?.toLowerCase();
  const moderationStatus = row?.moderation_status == null
    ? null
    : String(row?.moderation_status || '')?.toLowerCase();
  const isPublished =
    row?.published === true
    || row?.is_public === true
    || statut === 'publiee'
    || statut === 'published'
    || statut === 'active';
  const moderationApproved =
    moderationStatus == null
    || moderationStatus === 'approved'
    || moderationStatus === 'approuvee'
    || moderationStatus === 'approuve';

  return Boolean(
    row?.id
    && row?.is_draft !== true
    && row?.temporarily_disabled !== true
    && moderationApproved
    && isPublished
  );
};

const lireSpecification = (specifications = [], label = '') => {
  const spec = (specifications || [])?.find((item) => item?.label === label);
  const value = spec?.value ? String(spec?.value)?.trim() : '';
  const normalizedValue = value
    ?.normalize('NFD')
    ?.replace(/[\u0300-\u036f]/g, '')
    ?.toLowerCase();
  if (!normalizedValue || normalizedValue === 'non specifie' || normalizedValue === 'non specifiee') {
    return null;
  }
  return value;
};

const mapEtatVersSchema = (etat = '') => {
  const normalized = String(etat || '')?.toLowerCase();
  if (!normalized) return undefined;
  if (normalized?.includes('neuf')) return 'https://schema.org/NewCondition';
  if (normalized?.includes('occasion') || normalized?.includes('bon')) {
    return 'https://schema.org/UsedCondition';
  }
  return undefined;
};

const construireDescriptionSeoAnnonce = (equipment = null) => {
  if (!equipment) return DEFAULT_SEO_DESCRIPTION;

  const city = equipment?.ville || equipment?.city || equipment?.location || '';
  const dailyPrice = Number(equipment?.dailyPrice || 0);
  const priceFragment = dailyPrice > 0 ? `${dailyPrice?.toFixed(2)} EUR / jour` : '';
  const description = nettoyerTexteSeo(equipment?.description || '');

  const parts = [
    equipment?.title ? `Location ${equipment?.title}` : null,
    city || null,
    priceFragment || null,
    description || null
  ]?.filter(Boolean);

  return tronquerTexte(parts?.join(' - '), 160) || DEFAULT_SEO_DESCRIPTION;
};

const EquipmentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [isFavorite, setIsFavorite] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [equipment, setEquipment] = useState(null);
  const [error, setError] = useState(null);
  const trackedViewItemRef = useRef(null);
  const [canContactOwner, setCanContactOwner] = useState(false);
  const [selectedStartDate, setSelectedStartDate] = useState(null);
  const [selectedEndDate, setSelectedEndDate] = useState(null);

  // Fetch annonce data
  useEffect(() => {
    const fetchAnnonce = async () => {
      if (!id) {
        setError('ID manquant');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [
          { data, error: fetchError },
          { data: reservationsData, error: reservationsError }
        ] = await Promise.all([
          annonceService?.getAnnonceById(id),
          reservationService?.getReservationsByAnnonce(id)
        ]);

        if (fetchError) {
          console.error('Erreur lors du chargement de annonce:', fetchError);
          setError('Erreur lors du chargement de l\'annonce');
          setEquipment(null);
        } else if (!data) {
          setError('Annonce introuvable');
          setEquipment(null);
        } else {
          const annonceNormalisee = normaliserAnnonce(data);
          if (reservationsError) {
            console.warn('Chargement reservations indisponibles degrade:', reservationsError?.message || reservationsError);
          }
          const reservationBlockedDates = (reservationsData || [])
            ?.filter((reservation) => BLOCKING_STATUSES?.has(String(reservation?.status || '')?.toLowerCase()))
            ?.flatMap((reservation) => expandReservationDates(reservation?.start_date, reservation?.end_date));
          const listingBlockedDates = Array.isArray(annonceNormalisee?.unavailable_dates)
            ? annonceNormalisee?.unavailable_dates
            : [];
          const blockedDates = [...listingBlockedDates, ...(reservationBlockedDates || [])];
          const title = annonceNormalisee?.titre;
          const rulesText = data?.rental_rules || data?.regles_location || '';
          const ownerCreatedAt =
            annonceNormalisee?.owner?.created_at ||
            annonceNormalisee?.createdAt;
          const photoUrls = annonceNormalisee?.photos || [];
          const listingReviewCount = Math.max(0, Number(annonceNormalisee?.reviewCount || 0));
          const listingRatingValue = Number(annonceNormalisee?.rating);
          const listingRating =
            listingReviewCount > 0 && Number.isFinite(listingRatingValue)
              ? Math.round(listingRatingValue * 10) / 10
              : null;
          const ownerReviewCountCandidate = [
            annonceNormalisee?.owner?.review_count,
            annonceNormalisee?.owner?.nombre_avis,
            data?.owner?.review_count,
            data?.owner?.nombre_avis,
            data?.profiles?.review_count,
            data?.profiles?.nombre_avis
          ]
            ?.map((value) => Number(value))
            ?.find((value) => Number.isFinite(value) && value >= 0);
          const ownerReviewCount = Number.isFinite(ownerReviewCountCandidate)
            ? ownerReviewCountCandidate
            : 0;
          const ownerRatingCandidate = [
            annonceNormalisee?.owner?.rating,
            annonceNormalisee?.owner?.note_moyenne,
            data?.owner?.rating,
            data?.owner?.note_moyenne,
            data?.profiles?.rating,
            data?.profiles?.note_moyenne
          ]
            ?.map((value) => Number(value))
            ?.find((value) => Number.isFinite(value) && value > 0);
          const ownerRating =
            ownerReviewCount > 0 && Number.isFinite(ownerRatingCandidate)
              ? Math.round(ownerRatingCandidate * 10) / 10
              : null;
          // Transform data to match component structure
          const specifications = [
            { label: 'Etat', value: data?.condition || data?.etat },
            { label: 'Marque', value: data?.brand || data?.marque },
            { label: 'Modele', value: data?.model || data?.modele },
          ]
            ?.map((spec) => ({
              ...spec,
              value: spec?.value ? String(spec?.value)?.trim() : ''
            }))
            ?.filter((spec) => lireSpecification([spec], spec?.label));

          const transformedData = {
            id: data?.id,
            isPublicIndexable: estAnnoncePubliquementIndexable(data),
            title,
            category: annonceNormalisee?.categorie || 'Non catégorisé',
            location: annonceNormalisee?.location,
            ville: annonceNormalisee?.ville,
            city: annonceNormalisee?.city,
            address: annonceNormalisee?.address || null,
            latitude: annonceNormalisee?.latitude,
            longitude: annonceNormalisee?.longitude,
            dailyPrice: Number(annonceNormalisee?.prix_jour || 0),
            cautionAmount: Number(annonceNormalisee?.caution || 0),
            rating: listingRating,
            reviewCount: listingReviewCount,
            description: annonceNormalisee?.description || 'Aucune description fournie.',
            specifications,
            rules: rulesText ? rulesText?.split('\n')?.map((rule) => rule?.trim())?.filter(Boolean) : [
              "Retour de l'équipement propre et en bon état",
              'Prévenir immédiatement en cas de problème technique',
              'Respecter les consignes de sécurité du fabricant',
              'Empreinte CB gérée au moment de réserver (garantie caution)'
            ],
            images: photoUrls?.map((url, index) => ({
              url,
              alt: `${title} - Photo ${index + 1}`
            })),
            owner: {
              id: annonceNormalisee?.owner?.id || annonceNormalisee?.owner_id || null,
              pseudonym: annonceNormalisee?.owner?.pseudo || 'Utilisateur',
              initials: annonceNormalisee?.ownerInitials || 'U',
              rating: ownerRating,
              reviewCount: ownerReviewCount,
              responseTime: '< 2 heures',
              memberSince: ownerCreatedAt
                ? new Date(ownerCreatedAt)?.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                : 'Récemment',
              avatar: annonceNormalisee?.owner?.avatar_url || null
            },
            blockedDates,
            pickupDays: Array.isArray(annonceNormalisee?.pickup_days) ? annonceNormalisee?.pickup_days : [],
            returnDays: Array.isArray(annonceNormalisee?.return_days) ? annonceNormalisee?.return_days : [],
            pickupTimeStart: annonceNormalisee?.pickup_time_start || null,
            pickupTimeEnd: annonceNormalisee?.pickup_time_end || null,
            returnTimeStart: annonceNormalisee?.return_time_start || null,
            returnTimeEnd: annonceNormalisee?.return_time_end || null
          };

          setEquipment(transformedData);
          setError(null);
        }
      } catch (err) {
        console.error('Exception fetching annonce:', err);
        setError('Erreur lors du chargement de l\'annonce');
        setEquipment(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAnnonce();
  }, [id]);

  useEffect(() => {
    if (!equipment?.id) return;

    const canonicalPath = construireUrlAnnonce({
      id: equipment?.id,
      titre: equipment?.title,
      title: equipment?.title,
      ville: equipment?.ville,
      city: equipment?.city
    });

    if (location?.pathname !== canonicalPath) {
      navigate(canonicalPath, { replace: true });
    }
  }, [equipment, location?.pathname, navigate]);

  useEffect(() => {
    if (!equipment?.id) return;

    const trackedKey = String(equipment?.id);
    if (trackedViewItemRef.current === trackedKey) return;
    trackedViewItemRef.current = trackedKey;

    const analyticsItem = buildListingAnalyticsItem(equipment);
    trackAnalyticsEvent('view_item', {
      currency: 'EUR',
      value: analyticsItem?.price,
      items: analyticsItem ? [analyticsItem] : undefined
    });
  }, [equipment]);

  useEffect(() => {
    let active = true;

    const checkContactEligibility = async () => {
      const ownerId = equipment?.owner?.id;
      const currentUserId = user?.id;

      if (!currentUserId || !ownerId || String(currentUserId) === String(ownerId)) {
        if (active) setCanContactOwner(false);
        return;
      }

      try {
        const { data: hasLink, error: linkError } =
          await reservationService?.hasChatEligibleReservationLinkBetweenUsers({
            userId: currentUserId,
            otherUserId: ownerId,
            annonceId: equipment?.id
          });

        if (linkError) {
          console.error('Erreur vérification lien réservation pour contact:', linkError);
        }

        if (active) {
          setCanContactOwner(Boolean(hasLink));
        }
      } catch (linkCheckError) {
        console.error('Erreur controle affichage bouton contacter:', linkCheckError);
        if (active) setCanContactOwner(false);
      }
    };

    checkContactEligibility();

    return () => {
      active = false;
    };
  }, [equipment?.id, equipment?.owner?.id, user?.id]);

  useEffect(() => {
    setSelectedStartDate(null);
    setSelectedEndDate(null);
  }, [equipment?.id]);

  const handleFavoriteToggle = () => {
    setIsFavorite(!isFavorite);
  };

  const handleContact = async () => {
    if (!canContactOwner) {
      toast?.error("Le contact direct est disponible uniquement lorsqu'une réservation active existe avec ce propriétaire");
      return;
    }

    const analyticsItem = buildListingAnalyticsItem(equipment);
    trackAnalyticsEvent('generate_lead', {
      lead_type: 'contact_owner',
      page_type: 'equipment_detail',
      items: analyticsItem ? [analyticsItem] : undefined
    });

    if (!equipment?.id) return;

    if (!user?.id) {
      toast?.error('Connectez-vous pour contacter le propriétaire');
      navigate('/authentification', {
        state: {
          redirectTo: `${location?.pathname || ''}${location?.search || ''}`
        }
      });
      return;
    }

    const ownerId = equipment?.owner?.id;
    if (!ownerId) {
      toast?.error('Messagerie indisponible pour cette annonce');
      return;
    }

    if (ownerId === user?.id) {
      toast?.error('Vous ne pouvez pas vous contacter vous-même');
      return;
    }

    try {
      const participantIds = [...new Set([user?.id, ownerId]?.filter(Boolean))];
      const { data: conversation, error: conversationError } =
        await messageService?.getOrCreateConversation(equipment?.id, participantIds);

      if (conversationError) {
        throw conversationError;
      }

      const params = new URLSearchParams();
      params?.set('tab', 'messages');
      if (conversation?.id) {
        params?.set('conversation', String(conversation?.id));
      }

      navigate(`/tableau-bord-utilisateur?${params?.toString()}`);
    } catch (contactError) {
      console.error('Erreur ouverture messagerie:', contactError);
      toast?.error("Impossible d'ouvrir la messagerie pour le moment");
      navigate('/tableau-bord-utilisateur?tab=messages');
    }
  };

  const handleBookingDateChange = (startDate, endDate) => {
    setSelectedStartDate(startDate || null);
    setSelectedEndDate(endDate || null);
  };

  const handleBooking = () => {
    if (!equipment?.id) return;
    if (user?.id && equipment?.owner?.id && String(user?.id) === String(equipment?.owner?.id)) {
      toast?.error('Vous ne pouvez pas louer votre propre annonce');
      return;
    }
    if (selectedStartDate && !isReservationStartDateAllowed(selectedStartDate)) {
      toast?.error(SAME_DAY_RESERVATION_BLOCKED_MESSAGE);
      return;
    }
    if (selectedStartDate && selectedEndDate) {
      const blockedDateSet = buildBlockedDateSet(equipment?.blockedDates || []);
      if (rangeContainsBlockedDate(selectedStartDate, selectedEndDate, blockedDateSet)) {
        toast?.error('Cette période inclut au moins une date indisponible.');
        return;
      }

      const pickupWeekdays = normalizeScheduleWeekdays(equipment?.pickupDays || []);
      if (!isDateAllowedByWeekdays(selectedStartDate, pickupWeekdays)) {
        toast?.error('Le jour de début ne correspond pas aux jours de récupération autorisés.');
        return;
      }

      const returnWeekdays = normalizeScheduleWeekdays(equipment?.returnDays || equipment?.pickupDays || []);
      if (!isDateAllowedByWeekdays(selectedEndDate, returnWeekdays)) {
        toast?.error('Le jour de fin ne correspond pas aux jours de restitution autorisés.');
        return;
      }
    }

    const hasPreselectedDates = Boolean(selectedStartDate && selectedEndDate);

    const analyticsItem = buildListingAnalyticsItem(equipment);
    trackAnalyticsEvent('begin_checkout', {
      checkout_step: 'booking_request_from_detail',
      items: analyticsItem ? [analyticsItem] : undefined,
      value: analyticsItem?.price,
      currency: 'EUR',
      has_preselected_dates: hasPreselectedDates
    });

    const paymentParams = new URLSearchParams();
    paymentParams?.set('annonceId', String(equipment?.id));
    const normalizedStartDate = toReservationDateOnly(selectedStartDate);
    const normalizedEndDate = toReservationDateOnly(selectedEndDate);
    if (normalizedStartDate) paymentParams?.set('startDate', normalizedStartDate);
    if (normalizedEndDate) paymentParams?.set('endDate', normalizedEndDate);
    const paymentPath = `/traitement-paiement?${paymentParams?.toString()}`;

    if (!user?.id) {
      storeAuthRedirectPath(paymentPath);
      toast?.error('Connectez-vous pour continuer votre réservation.');
      navigate('/authentification', {
        state: {
          from: paymentPath
        }
      });
      return;
    }

    navigate(paymentPath);
  };

  const handleShare = async () => {
    try {
      const handled = await shareContent({
        title: equipment?.title,
        text: `Découvrez cette annonce sur Le Matos du Voisin`,
        url: canonicalUrl || currentUrl || window?.location?.href
      });

      if (!handled) return;

      const analyticsItem = buildListingAnalyticsItem(equipment);
      trackAnalyticsEvent('share', {
        method: 'native_share',
        content_type: 'listing',
        item_id: equipment?.id ? String(equipment?.id) : undefined,
        items: analyticsItem ? [analyticsItem] : undefined
      });
    } catch (shareError) {
      if (shareError?.name !== 'AbortError') {
        console.error('Erreur partage natif:', shareError);
      }
    }
  };

  const montantCaution = Number(equipment?.cautionAmount || 0);
  const cautionActive = montantCaution > 0;
  const isOwnListing = Boolean(user?.id && equipment?.owner?.id && String(user?.id) === String(equipment?.owner?.id));
  const earliestStartDate = getEarliestReservationStartDate();
  const pickupWindow = formatTimeRange(equipment?.pickupTimeStart, equipment?.pickupTimeEnd);
  const returnWindow = formatTimeRange(equipment?.returnTimeStart, equipment?.returnTimeEnd);
  const origin = typeof window !== 'undefined' ? window?.location?.origin || '' : '';
  const currentUrl = typeof window !== 'undefined'
    ? `${window?.location?.origin || ''}${window?.location?.pathname || ''}`
    : '';
  const listingCity = equipment?.ville || equipment?.city || equipment?.location || '';
  const seoTitle = equipment?.title
    ? `Location ${equipment?.title}${listingCity ? ` - ${listingCity}` : ''} | ${SITE_NAME}`
    : loading
      ? `Chargement annonce | ${SITE_NAME}`
      : `Annonce introuvable | ${SITE_NAME}`;
  const seoDescription = equipment
    ? construireDescriptionSeoAnnonce(equipment)
    : (!loading && error
      ? 'Cette annonce est introuvable ou indisponible.'
      : DEFAULT_SEO_DESCRIPTION);
  const robotsContent = !loading && !equipment
    ? 'noindex, nofollow'
    : equipment?.isPublicIndexable === false
      ? 'noindex, nofollow'
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  const canonicalUrl = equipment?.id
    ? construireUrlAnnonceAbsolue({
        id: equipment?.id,
        titre: equipment?.title,
        title: equipment?.title,
        ville: equipment?.ville,
        city: equipment?.city
      }, origin)
    : currentUrl;
  const imageUrls = (equipment?.images || [])
    ?.map((image) => versUrlAbsolue(image?.url, origin))
    ?.filter(Boolean);
  const socialImageUrl = imageUrls?.[0] || versUrlAbsolue(DEFAULT_SOCIAL_IMAGE, origin);
  const socialImageAlt = equipment?.images?.[0]?.alt || equipment?.title || "Photo de l'annonce";
  const rawSocialImageWidth = parsePositiveInteger(equipment?.images?.[0]?.width);
  const rawSocialImageHeight = parsePositiveInteger(equipment?.images?.[0]?.height);
  const socialImageWidth = rawSocialImageWidth
    || (rawSocialImageHeight
      ? Math.round((rawSocialImageHeight * DEFAULT_SOCIAL_IMAGE_WIDTH) / DEFAULT_SOCIAL_IMAGE_HEIGHT)
      : DEFAULT_SOCIAL_IMAGE_WIDTH);
  const socialImageHeight = rawSocialImageHeight
    || (rawSocialImageWidth
      ? Math.round((rawSocialImageWidth * DEFAULT_SOCIAL_IMAGE_HEIGHT) / DEFAULT_SOCIAL_IMAGE_WIDTH)
      : DEFAULT_SOCIAL_IMAGE_HEIGHT);
  const specBrand = lireSpecification(equipment?.specifications, 'Marque');
  const specModel = lireSpecification(equipment?.specifications, 'Modele');
  const specEtat = lireSpecification(equipment?.specifications, 'Etat');
  const schemaCondition = mapEtatVersSchema(specEtat);
  const schemaLatitude = parseSeoCoordinate(equipment?.latitude);
  const schemaLongitude = parseSeoCoordinate(equipment?.longitude);
  const hasGeoCoords = schemaLatitude !== null
    && schemaLongitude !== null
    && Math.abs(schemaLatitude) <= 90
    && Math.abs(schemaLongitude) <= 180;
  const schemaLocationName = equipment?.location || listingCity || undefined;
  const schemaPrice = Number(equipment?.dailyPrice || 0);
  const schemaDescription = tronquerTexte(
    nettoyerTexteSeo(equipment?.description || ''),
    500
  ) || (equipment ? construireDescriptionSeoAnnonce(equipment) : undefined);
  const productStructuredData = equipment ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: equipment?.title || 'Annonce de location',
    description: schemaDescription,
    sku: String(equipment?.id),
    category: equipment?.category || undefined,
    brand: specBrand ? { '@type': 'Brand', name: specBrand } : undefined,
    model: specModel || undefined,
    itemCondition: schemaCondition,
    image: imageUrls?.length ? imageUrls : (socialImageUrl ? [socialImageUrl] : undefined),
    ...(schemaLocationName ? {
      areaServed: {
        '@type': 'Place',
        name: schemaLocationName
      }
    } : {}),
    ...(hasGeoCoords ? {
      availableAtOrFrom: {
        '@type': 'Place',
        name: schemaLocationName || listingCity || 'France',
        geo: {
          '@type': 'GeoCoordinates',
          latitude: schemaLatitude,
          longitude: schemaLongitude
        }
      }
    } : {}),
    offers: schemaPrice > 0 ? {
      '@type': 'Offer',
      url: canonicalUrl || currentUrl || undefined,
      priceCurrency: 'EUR',
      price: schemaPrice?.toFixed(2),
      availability: 'https://schema.org/InStock',
      businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut',
      itemCondition: schemaCondition,
      seller: {
        '@type': 'Person',
        name: equipment?.owner?.pseudonym || 'Utilisateur'
      },
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        priceCurrency: 'EUR',
        price: schemaPrice?.toFixed(2),
        unitCode: 'DAY'
      }
    } : undefined
  } : null;
  const breadcrumbStructuredData = equipment?.id ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Accueil',
        item: origin ? `${origin}/accueil-recherche` : '/accueil-recherche'
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Recherche',
        item: origin ? `${origin}/accueil-recherche` : '/accueil-recherche'
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: equipment?.title || 'Annonce',
        item: canonicalUrl || currentUrl || undefined
      }
    ]
  } : null;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#e9f4ff] via-[#f2f8ff] to-[#e7f5ff]">
      <Helmet>
        <html lang="fr" />
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <meta name="robots" content={robotsContent} />
        {canonicalUrl ? <link rel="canonical" href={canonicalUrl} /> : null}

        <meta property="og:locale" content="fr_FR" />
        <meta property="og:type" content={equipment ? 'product' : 'website'} />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        {canonicalUrl ? <meta property="og:url" content={canonicalUrl} /> : null}
        {socialImageUrl ? <meta property="og:image" content={socialImageUrl} /> : null}
        {socialImageUrl ? <meta property="og:image:width" content={String(socialImageWidth)} /> : null}
        {socialImageUrl ? <meta property="og:image:height" content={String(socialImageHeight)} /> : null}
        {socialImageAlt ? <meta property="og:image:alt" content={socialImageAlt} /> : null}
        {schemaPrice > 0 ? <meta property="product:price:amount" content={schemaPrice?.toFixed(2)} /> : null}
        {schemaPrice > 0 ? <meta property="product:price:currency" content="EUR" /> : null}

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        {socialImageUrl ? <meta name="twitter:image" content={socialImageUrl} /> : null}
        {socialImageAlt ? <meta name="twitter:image:alt" content={socialImageAlt} /> : null}

        {hasGeoCoords ? <meta name="geo.position" content={`${schemaLatitude};${schemaLongitude}`} /> : null}
        {hasGeoCoords ? <meta name="ICBM" content={`${schemaLatitude}, ${schemaLongitude}`} /> : null}

        {productStructuredData ? (
          <script type="application/ld+json">
            {JSON.stringify(productStructuredData)}
          </script>
        ) : null}
        {breadcrumbStructuredData ? (
          <script type="application/ld+json">
            {JSON.stringify(breadcrumbStructuredData)}
          </script>
        ) : null}
      </Helmet>
      <Header />
      
      {loading ?
      <main className="flex-1 pt-20 pb-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <Icon name="Loader2" size={48} className="animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Chargement de l'annonce...</p>
              </div>
            </div>
          </div>
        </main> :
      !equipment ?
      <main className="flex-1 pt-20 pb-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center py-20">
              <Icon name="AlertCircle" size={48} className="text-muted-foreground mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">Annonce introuvable</h2>
              <p className="text-muted-foreground mb-6">Cette annonce n'existe pas ou a été supprimée.</p>
              <Button onClick={() => navigate('/accueil-recherche')}>Retour à la recherche</Button>
            </div>
          </div>
        </main> :

      <main className="flex-1 pt-20 pb-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm mb-6">
              <Link to="/accueil-recherche" className="text-muted-foreground hover:text-foreground transition-colors">
                Accueil
              </Link>
              <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
              <Link to="/accueil-recherche" className="text-muted-foreground hover:text-foreground transition-colors">
                Recherche
              </Link>
              <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
              <span className="text-foreground font-medium">Détail de l'annonce</span>
            </nav>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Main Content */}
              <div className="lg:col-span-2 space-y-6">
                {/* Photo Gallery */}
                <PhotoGallery images={equipment?.images} />

                {/* Title and Actions */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 rounded-md text-xs font-semibold bg-[#28a745] text-white">
                          Offre
                        </span>
                        <span className="px-3 py-1 rounded-md text-xs font-semibold bg-[#17a2b8] text-white">
                          {equipment?.category}
                        </span>
                      </div>
                      <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
                        {equipment?.title}
                      </h1>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Icon name="MapPin" size={16} />
                          <span>{equipment?.location}</span>
                        </div>
                        {Number(equipment?.reviewCount || 0) > 0 && Number.isFinite(Number(equipment?.rating)) ? (
                          <div className="flex items-center gap-1">
                            <Icon name="Star" size={16} className="text-[#F59E0B] fill-[#F59E0B]" />
                            <span className="font-medium text-foreground">{equipment?.rating}</span>
                            <span>({equipment?.reviewCount} avis)</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Icon name="Star" size={16} className="text-muted-foreground" />
                            <span>Aucun avis</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                      variant="outline"
                      size="icon"
                      onClick={handleFavoriteToggle}
                      aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
                      
                        <Icon
                        name="Heart"
                        size={20}
                        className={isFavorite ? 'fill-error text-error' : ''} />
                      
                      </Button>
                      <Button
                      variant="outline"
                      size="icon"
                      onClick={handleShare}
                      aria-label="Partager">
                      
                        <Icon name="Share2" size={20} />
                      </Button>
                      <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowReportModal(true)}
                      aria-label="Signaler">
                      
                        <Icon name="Flag" size={20} />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Share Buttons */}
                <ShareButtons
                title={equipment?.title}
                description={equipment?.description}
                url={canonicalUrl || currentUrl}
                imageUrl={socialImageUrl}
                itemId={equipment?.id}
                itemCategory={equipment?.category} />
              

                {/* Description */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold text-foreground mb-4">Description</h2>
                  <p className="text-foreground leading-relaxed">
                    {equipment?.description}
                  </p>
                </div>

                {/* Specifications */}
                {equipment?.specifications?.length > 0 && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold text-foreground mb-4">Caractéristiques</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {equipment?.specifications?.map((spec, index) =>
                  <div key={index} className="flex justify-between items-center py-2 border-b border-border">
                        <span className="text-muted-foreground font-medium">{spec?.label}</span>
                        <span className="text-foreground font-semibold">{spec?.value}</span>
                      </div>
                  )}
                  </div>
                </div>
                )}

                {/* Rules */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold text-foreground mb-4">Règles de location</h2>
                  <ul className="space-y-3">
                    {equipment?.rules?.map((rule, index) =>
                  <li key={index} className="flex items-start gap-3">
                        <Icon name="CheckCircle" size={20} className="text-[#28a745] flex-shrink-0 mt-0.5" />
                        <span className="text-foreground">{rule}</span>
                      </li>
                  )}
                  </ul>
                </div>

                {/* Location Map */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold text-foreground mb-4">Localisation</h2>
                  <Suspense
                    fallback={
                      <div className="h-[320px] rounded-lg border border-border bg-slate-50 flex items-center justify-center text-sm text-muted-foreground">
                        Chargement de la carte...
                      </div>
                    }
                  >
                    <LocationMap
                      location={equipment?.location}
                      address={equipment?.address}
                      latitude={equipment?.latitude}
                      longitude={equipment?.longitude}
                    />
                  </Suspense>
                </div>
              </div>

              {/* Right Column - Booking Card */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-lg shadow-md p-6 sticky top-24 space-y-6">
                  {/* Pricing */}
                  <div className="border-b border-border pb-4">
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-3xl font-bold text-[#17a2b8]">{Number(equipment?.dailyPrice || 0)?.toFixed(2)} €</span>
                      <span className="text-muted-foreground">/ jour</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Icon name="Shield" size={16} className="text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {cautionActive ? (
                          <>Empreinte CB demandée (garantie caution) : <span className="font-semibold text-foreground">{montantCaution?.toFixed(2)} €</span></>
                        ) : (
                          <span className="font-semibold text-foreground">Aucune caution demandée</span>
                        )}
                      </span>
                    </div>
                    {cautionActive && (
                      <div className="mt-2 text-xs text-muted-foreground italic">
                        Empreinte bancaire temporaire (CB), gérée via le workflow officiel de fin de location et de caution.
                      </div>
                    )}
                  </div>

                  {/* Availability Calendar */}
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-3">Disponibilité</h3>
                    <AvailabilityCalendar
                      startDate={selectedStartDate}
                      endDate={selectedEndDate}
                      onChange={handleBookingDateChange}
                      unavailableDates={equipment?.blockedDates || []}
                      allowedStartWeekdays={equipment?.pickupDays || []}
                      allowedEndWeekdays={equipment?.returnDays || []}
                      minDate={earliestStartDate}
                    />
                    {(pickupWindow || returnWindow) && (
                      <div className="mt-3 text-xs text-muted-foreground space-y-1">
                        {pickupWindow && <p>Prise du matériel: {pickupWindow}</p>}
                        {returnWindow && <p>Restitution du matériel: {returnWindow}</p>}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Sélectionnez vos dates ci-dessus puis continuez.
                    </p>
                    <Button
                      variant="default"
                      size="lg"
                      fullWidth
                      onClick={handleBooking}
                      disabled={isOwnListing}
                      className="bg-accent hover:bg-accent/90 text-accent-foreground"
                    >
                      <Icon name="Calendar" size={20} className="mr-2" />
                      {isOwnListing ? 'Votre annonce' : 'Réserver maintenant'}
                    </Button>
                    {canContactOwner && (
                      <Button
                      variant="outline"
                      size="lg"
                      fullWidth
                      onClick={handleContact}>
                        
                        <Icon name="MessageSquare" size={18} className="mr-2" />
                        Contacter
                      </Button>
                    )}
                  </div>

                  {/* Profil du propriétaire */}
                  <div className="border-t border-border pt-4">
                    <OwnerProfile owner={equipment?.owner} />
                  </div>
                </div>
              </div>
            </div>

            {/* Similar Listings */}
            <div className="mt-12">
              <SimilarListings
                currentEquipmentId={equipment?.id}
                categoryId={equipment?.category}
                currentCity={equipment?.city || equipment?.ville || ''}
                currentDailyPrice={equipment?.dailyPrice}
              />
            </div>
          </div>
        </main>
      }

      <Footer />

      {/* Report Modal */}
      {showReportModal &&
      <ReportModal
        onClose={() => setShowReportModal(false)}
        reportType="listing"
        targetId={equipment?.id}
        targetName={equipment?.title} />

      }
    </div>);


};

export default EquipmentDetail;




