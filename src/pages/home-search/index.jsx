import React, { Suspense, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Header from '../../components/navigation/Header';
import SearchBar from './components/SearchBar';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import geolocationService from '../../services/geolocationService';
import { supabase } from '../../lib/supabase';
import avisService from '../../services/avisService';
import normaliserAnnonce from '../../utils/annonceNormalizer';
import { trackAnalyticsEvent } from '../../utils/analyticsTracking';
import demandeService from '../../services/demandeService';
import categoryService from '../../services/categoryService';
import { construireUrlAnnonce } from '../../utils/listingUrl';

const normalizeCategoryValue = (value) =>
  String(value || '')
    ?.toLowerCase()
    ?.normalize('NFD')
    ?.replace(/[\u0300-\u036f]/g, '')
    ?.replace(/[^a-z0-9]+/g, ' ')
    ?.trim();

const isCategoryMatch = (itemCategory, targetCategory) => {
  const normalizedItemCategory = normalizeCategoryValue(itemCategory);
  const normalizedTargetCategory = normalizeCategoryValue(targetCategory);

  if (!normalizedTargetCategory) return true;
  if (!normalizedItemCategory) return false;

  return (
    normalizedItemCategory === normalizedTargetCategory ||
    normalizedItemCategory?.includes(normalizedTargetCategory) ||
    normalizedTargetCategory?.includes(normalizedItemCategory)
  );
};

const normalizeTextValue = (value) =>
  String(value || '')
    ?.toLowerCase()
    ?.normalize('NFD')
    ?.replace(/[\u0300-\u036f]/g, '')
    ?.replace(/[^a-z0-9]+/g, ' ')
    ?.trim();

const SITE_NAME = 'Le Matos Du Voisin';
const SITE_ORIGIN = 'https://www.lematosduvoisin.fr';
const HOME_CANONICAL_URL = `${SITE_ORIGIN}/`;
const DEFAULT_SOCIAL_IMAGE = '/assets/images/android-chrome-192x192-1771179342850.png';
const HOME_SEO_TITLE = 'Location de matériel entre voisins | Le Matos Du Voisin';
const HOME_SEO_DESCRIPTION =
  'Louez ou proposez du matériel entre voisins partout en France. Recherche locale, réservation rapide, paiement sécurisé et location simplifiée.';
const HOME_FAQ_ITEMS = [
  {
    question: 'Comment louer du matériel entre voisins sur Le Matos Du Voisin ?',
    answer:
      "Recherchez un équipement par objet, catégorie ou ville, consultez l'annonce, choisissez vos dates puis confirmez votre réservation avec le paiement sécurisé. Les créneaux ouverts sont réservés instantanément."
  },
  {
    question: 'Quels types de matériel peut-on trouver sur la plateforme ?',
    answer:
      'Vous pouvez trouver du matériel de bricolage, jardinage, camping, sport, cuisine, photo/vidéo, musique et bien d\'autres équipements du quotidien proposés par des particuliers.'
  },
  {
    question: 'Le paiement et la réservation sont-ils sécurisés ?',
    answer:
      'Oui, la plateforme met en avant un paiement sécurisé, une réservation claire et un cadre de location entre voisins pour réduire les risques et faciliter les échanges.'
  },
  {
    question: 'Puis-je publier une annonce de location de matériel gratuitement ?',
    answer:
      'Vous pouvez créer une annonce depuis votre espace en quelques étapes, ajouter des photos, définir votre prix journalier et préciser votre ville pour apparaître dans la recherche locale.'
  }
];
const EquipmentGrid = React.lazy(() => import('./components/EquipmentGrid'));

const getHomeOffersRenderBatchSize = () => {
  if (typeof window === 'undefined') return 12;

  const viewportWidth = Number(window?.innerWidth || 1024);
  if (viewportWidth < 768) return 8;
  if (viewportWidth < 1280) return 12;
  return 16;
};

const computeHomeAverageRating = (items = []) => {
  const ratings = (items || [])
    ?.map((item) => Number(item?.rating || item?.note_moyenne || 0))
    ?.filter((value) => Number.isFinite(value) && value > 0);

  if (!ratings?.length) return 0;
  return ratings?.reduce((sum, value) => sum + value, 0) / ratings?.length;
};

const isSchemaColumnError = (error) => {
  if (!error) return false;
  const code = String(error?.code || '');
  if (code === '42703' || code === 'PGRST204') return true;
  const message = String(error?.message || '')?.toLowerCase();
  return message?.includes('column') && message?.includes('does not exist');
};

const HOME_MIXED_FEED_LIMIT = 8;

const CATEGORY_ICON_MAP = {
  Bricolage: 'Wrench',
  Jardinage: 'Leaf',
  Sport: 'Bike',
  'Sports & Bien-être': 'Bike',
  Camping: 'Tent',
  Musique: 'Music',
  'Photo/Video': 'Camera',
  'Photo / Video': 'Camera',
  'Hi-Tech': 'Smartphone',
  'Maison & Mobilier': 'Home',
  'Auto & Moto': 'Car',
  'Fêtes & Événements': 'PartyPopper',
  'Enfants & Bébés': 'Baby',
  'Électroménager': 'ChefHat',
  Cuisine: 'ChefHat',
  Electromenager: 'Package'
};

const normalizeCategoryOption = (category = {}) => {
  const label = String(
    category?.label ||
    category?.nom ||
    category?.name ||
    category?.title ||
    category?.categorie ||
    category?.category ||
    category?.slug ||
    ''
  )?.trim();
  const value = String(category?.value || category?.slug || label)?.trim();

  if (!label || !value) return null;

  return {
    id: String(category?.id || value),
    label,
    value
  };
};

const dedupeCategoryOptions = (options = []) => {
  const seen = new Set();
  const uniqueOptions = [];

  for (const option of options || []) {
    const normalized = normalizeCategoryOption(option);
    if (!normalized) continue;

    const key = String(normalized?.value)?.toLowerCase();
    if (seen?.has(key)) continue;

    seen?.add(key);
    uniqueOptions?.push(normalized);
  }

  return uniqueOptions;
};

const buildCategoryShortcutsFromAnnonces = (items = []) =>
  dedupeCategoryOptions(
    (items || [])?.map((item) => ({
      label: item?.category || item?.categorie,
      value: item?.slug_category || item?.categorySlug || item?.category || item?.categorie
    }))
  );

const toTimestamp = (value) => {
  const time = new Date(value || 0)?.getTime();
  return Number.isFinite(time) ? time : 0;
};

const formatFeedDate = (value) => {
  if (!value) return 'Date non renseignée';

  const date = new Date(value);
  if (Number.isNaN(date?.getTime())) return 'Date non renseignée';

  return date?.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const enrichOfferWithDistance = (offer, visitorLocation) => {
  if (!visitorLocation) return offer;
  return geolocationService?.addDistanceInfo?.(offer, visitorLocation) || offer;
};

const sanitizeAnnonceMediaFields = (annonce = {}) => ({
  ...annonce,
  photos: Array.isArray(annonce?.photos)
    ? annonce?.photos?.filter((photo) => typeof photo === 'string')
    : [],
  images: Array.isArray(annonce?.images)
    ? annonce?.images
        ?.map((image) => {
          if (typeof image === 'string') return image;
          if (image && typeof image === 'object') return image?.url || image?.path || null;
          return null;
        })
        ?.filter(Boolean)
    : annonce?.images,
  image: typeof annonce?.image === 'string' ? annonce?.image : null,
  image_url: typeof annonce?.image_url === 'string' ? annonce?.image_url : null,
  photo_principale: typeof annonce?.photo_principale === 'string' ? annonce?.photo_principale : null
});

const normalizeHomeAnnonces = (rows = [], ownerProfiles = {}) =>
  (rows || [])
    ?.map((row) => {
      try {
        return normaliserAnnonce(row, { ownerProfiles });
      } catch (normalizeError) {
        console.warn(
          'Normalisation annonce degradee sur accueil:',
          row?.id,
          normalizeError?.message || normalizeError
        );

        try {
          return normaliserAnnonce(sanitizeAnnonceMediaFields(row), { ownerProfiles });
        } catch (fallbackError) {
          console.warn(
            'Normalisation annonce ignoree sur accueil:',
            row?.id,
            fallbackError?.message || fallbackError
          );
          return null;
        }
      }
    })
    ?.filter(Boolean);

const buildMixedDiscoveryFeed = ({ offers = [], demandes = [], visitorLocation = null, limit = HOME_MIXED_FEED_LIMIT } = {}) => {
  const offerItems = (offers || [])?.map((offer) => {
    const enrichedOffer = enrichOfferWithDistance(offer, visitorLocation);
    return {
      id: `offre-${offer?.id}`,
      kind: 'offre',
      createdAt: enrichedOffer?.createdAt || enrichedOffer?.created_at || null,
      createdAtTs: toTimestamp(enrichedOffer?.createdAt || enrichedOffer?.created_at),
      distance: Number.isFinite(Number(enrichedOffer?.distance)) ? Number(enrichedOffer?.distance) : null,
      distanceText: enrichedOffer?.distanceText || null,
      payload: enrichedOffer
    };
  });

  const demandeItems = (demandes || [])?.map((demande) => ({
    id: `demande-${demande?.id}`,
    kind: 'demande',
    createdAt: demande?.created_at || null,
    createdAtTs: toTimestamp(demande?.created_at),
    distance: null,
    distanceText: null,
    payload: demande
  }));

  const combined = [...(offerItems || []), ...(demandeItems || [])];

  combined?.sort((a, b) => {
    const aHasDistance = Number.isFinite(a?.distance);
    const bHasDistance = Number.isFinite(b?.distance);

    if (visitorLocation && aHasDistance && bHasDistance) {
      if (a?.distance !== b?.distance) return a?.distance - b?.distance;
      return b?.createdAtTs - a?.createdAtTs;
    }

    if (visitorLocation && aHasDistance !== bHasDistance) {
      return aHasDistance ? -1 : 1;
    }

    return b?.createdAtTs - a?.createdAtTs;
  });

  return combined?.slice(0, limit);
};

const computeShouldDisplayStats = (nextStats = {}) =>
  Number(nextStats?.activeUsers || 0) > 100
  && Number(nextStats?.availableAnnonces || 0) > 500
  && Number(nextStats?.successfulRentals || 0) > 500
  && Number(nextStats?.averageRating || 0) > 4;

const HomeSearch = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('offres');
  const [userLocation, setUserLocation] = useState(null);
  const [geolocating, setGeolocating] = useState(false);
  const [annonces, setAnnonces] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [displayedEquipment, setDisplayedEquipment] = useState([]);
  const [visibleOffersCount, setVisibleOffersCount] = useState(() => getHomeOffersRenderBatchSize());
  const [displayedDemandes, setDisplayedDemandes] = useState([]);
  const [homeDemandes, setHomeDemandes] = useState([]);
  const [loadingDemandes, setLoadingDemandes] = useState(false);
  const [loadingHomeDemandes, setLoadingHomeDemandes] = useState(false);
  const [homeFeedLocationMode, setHomeFeedLocationMode] = useState('pending');
  const [annoncesLoadError, setAnnoncesLoadError] = useState('');
  const [statisticsLoadError, setStatisticsLoadError] = useState('');
  const [homeDemandesLoadError, setHomeDemandesLoadError] = useState('');
  const [statistics, setStatistics] = useState({
    activeUsers: 0,
    availableAnnonces: 0,
    successfulRentals: 0,
    averageRating: 0,
    shouldDisplay: false
  });
  const [searchParams, setSearchParams] = useState({
    searchType: 'offres',
    text: '',
    category: '',
    location: ''
  });
  const [filters, setFiltres] = useState({
    priceMin: '',
    priceMax: '',
    startDate: '',
    endDate: '',
    distance: '10'
  });

  const updateStatistics = (partial = {}) => {
    setStatistics((previous) => {
      const nextStats = {
        ...(previous || {}),
        ...(partial || {})
      };
      return {
        ...nextStats,
        averageRating: Math.round(Number(nextStats?.averageRating || 0) * 10) / 10,
        shouldDisplay: computeShouldDisplayStats(nextStats)
      };
    });
  };

  const filterOffers = (source, params) => {
    let filtered = [...(source || [])];

    if (params?.text) {
      const searchText = normalizeTextValue(params?.text);
      filtered = filtered?.filter((item) => {
        const title = normalizeTextValue(item?.title || item?.titre);
        const description = normalizeTextValue(item?.description);
        return title?.includes(searchText) || description?.includes(searchText);
      });
    }

    if (params?.category) {
      filtered = filtered?.filter((item) =>
        isCategoryMatch(item?.category || item?.categorie, params?.category)
      );
    }

    if (params?.location) {
      const searchLocation = normalizeTextValue(params?.location);
      filtered = filtered?.filter((item) =>
        normalizeTextValue(item?.location || item?.ville)?.includes(searchLocation)
      );
    }

    return filtered;
  };

  const filterDemandes = (source, params) => {
    let filtered = [...(source || [])];

    if (params?.text) {
      const searchText = normalizeTextValue(params?.text);
      filtered = filtered?.filter((demande) => {
        const title = normalizeTextValue(demande?.titre);
        const description = normalizeTextValue(demande?.description);
        return title?.includes(searchText) || description?.includes(searchText);
      });
    }

    if (params?.category) {
      filtered = filtered?.filter((demande) =>
        isCategoryMatch(demande?.categorie_slug || demande?.category, params?.category)
      );
    }

    if (params?.location) {
      const searchLocation = normalizeTextValue(params?.location);
      filtered = filtered?.filter((demande) =>
        normalizeTextValue(demande?.ville)?.includes(searchLocation)
      );
    }

    return filtered;
  };

  const handleSearch = async (params) => {
    const nextParams = {
      searchType: params?.searchType || 'offres',
      text: params?.text || '',
      category: params?.category || '',
      location: params?.location || ''
    };

    trackAnalyticsEvent('search', {
      search_term: [nextParams?.text, nextParams?.category, nextParams?.location]
        ?.filter(Boolean)
        ?.join(' | ') || 'recherche',
      search_type: nextParams?.searchType,
      item_category: nextParams?.category || undefined,
      location_query: nextParams?.location || undefined
    });

    setSearchParams(nextParams);
    setSelectedCategory('');
    setActiveTab(nextParams?.searchType);

    if (nextParams?.searchType === 'demandes') {
      const query = new URLSearchParams();
      if (nextParams?.text) query?.set('text', nextParams?.text);
      if (nextParams?.category) query?.set('categorie', nextParams?.category);
      if (nextParams?.location) query?.set('ville', nextParams?.location);

      const suffix = query?.toString();
      navigate(`/demandes-publiques${suffix ? `?${suffix}` : ''}`);
      return;
    }

    setLoading(true);
    setDisplayedEquipment(filterOffers(annonces, nextParams));

    if (nextParams?.searchType === 'tout') {
      setLoadingDemandes(true);
      try {
        const { data } = await demandeService?.getDemandes({ statut: 'open' });
        setDisplayedDemandes(filterDemandes(data || [], nextParams));
      } catch (error) {
        console.error('Erreur de recherche des demandes:', error);
        setDisplayedDemandes([]);
      } finally {
        setLoadingDemandes(false);
      }
    } else {
      setDisplayedDemandes([]);
    }

    setLoading(false);
  };

  const handleFilterChange = (newFiltres) => {
    setFiltres(newFiltres);
  };

  const handleCategorySelect = (categoryName) => {
    const isSameCategory = selectedCategory === categoryName;
    const nextCategory = isSameCategory ? '' : categoryName;

    trackAnalyticsEvent('select_content', {
      content_type: 'category_filter',
      item_category: categoryName || undefined,
      action: isSameCategory ? 'clear' : 'apply',
      page_location: typeof window !== 'undefined' ? window.location?.href : undefined
    });

    setSelectedCategory(nextCategory);
    setActiveTab('offres');
    setDisplayedDemandes([]);

    if (!nextCategory) {
      setDisplayedEquipment(annonces);
      return;
    }

    const filtered = annonces?.filter((item) => {
      const itemCategory = item?.category || item?.categorie;
      return isCategoryMatch(itemCategory, nextCategory);
    });

    setDisplayedEquipment(filtered);
  };

  const clearCategoryFilter = () => {
    trackAnalyticsEvent('select_content', {
      content_type: 'category_filter',
      action: 'clear',
      page_location: typeof window !== 'undefined' ? window.location?.href : undefined
    });

    setSelectedCategory('');
    setActiveTab('offres');
    setDisplayedDemandes([]);
    setDisplayedEquipment(annonces);
  };

  useEffect(() => {
    loadCategories();
    loadAnnonces();
    loadHomeDemandes();
    resolveVisitorLocationForHomeFeed();
    loadStatistics();
  }, []);

  useEffect(() => {
    setVisibleOffersCount(getHomeOffersRenderBatchSize());
  }, [displayedEquipment]);

  useEffect(() => {
    const params = new URLSearchParams(location?.search || '');
    const categoryFromUrl = params?.get('categorie') || params?.get('category') || '';

    if (!categoryFromUrl) {
      setSelectedCategory('');
      setActiveTab('offres');
      setDisplayedDemandes([]);
      setDisplayedEquipment(annonces);
      return;
    }

    const filtered = (annonces || [])?.filter((item) =>
      isCategoryMatch(item?.category || item?.categorie, categoryFromUrl)
    );

    setSelectedCategory(categoryFromUrl);
    setActiveTab('offres');
    setDisplayedDemandes([]);
    setDisplayedEquipment(filtered);
  }, [location?.search, annonces]);

  const loadAnnonces = async () => {
    try {
      setLoading(true);
      setAnnoncesLoadError('');
      const { data, error } = await supabase
        ?.from('annonces')
        ?.select('*')
        ?.or('statut.eq.publiee,published.eq.true')
        ?.order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }

      const safeRows = Array.isArray(data) ? data : [];
      let transformedData = normalizeHomeAnnonces(safeRows);
      let profileMap = {};

      if (safeRows?.length > 0) {
        const ownerIds = [...new Set(safeRows?.map((a) => a?.owner_id || a?.user_id)?.filter(Boolean))];
        if (ownerIds?.length > 0) {
          try {
            const [{ data: profiles, error: profilesError }, { data: ownerRatingsMap, error: ownerRatingsError }] = await Promise.all([
              supabase
                ?.from('profiles')
                ?.select('id, pseudo, avatar_url')
                ?.in('id', ownerIds),
              avisService?.getUsersRatingSummaries(ownerIds, { role: 'owner' })
            ]);

            if (profilesError) {
              console.warn('Impossible de charger les profils propriétaires pour home-search:', profilesError?.message || profilesError);
            }

            if (ownerRatingsError) {
              console.warn('Impossible de charger les notes propriétaires pour home-search:', ownerRatingsError?.message || ownerRatingsError);
            }

            profiles?.forEach((profile) => {
              const summary = ownerRatingsMap?.[String(profile?.id)] || ownerRatingsMap?.[profile?.id] || null;
              const reviewCount = Number(summary?.reviewCount || 0);
              const averageRating = Number(summary?.averageRating);
              const roundedRating =
                reviewCount > 0 && Number.isFinite(averageRating)
                  ? Math.round(averageRating * 10) / 10
                  : null;

              profileMap[profile?.id] = {
                ...profile,
                review_count: reviewCount,
                nombre_avis: reviewCount,
                rating: roundedRating,
                note_moyenne: roundedRating
              };
            });

            if (Object.keys(profileMap)?.length > 0) {
              transformedData = normalizeHomeAnnonces(safeRows, profileMap);
            }
          } catch (profileLoadError) {
            console.warn(
              'Enrichissement accueil degrade, affichage des annonces sans profils enrichis:',
              profileLoadError?.message || profileLoadError
            );
          }
        }
      }

      const visiblePublicAnnonces = (transformedData || [])?.filter(
        (item) => !Boolean(item?.temporarily_disabled ?? item?.temporarilyDisabled)
      );

      setAnnonces(visiblePublicAnnonces);
      setDisplayedEquipment(visiblePublicAnnonces);
      updateStatistics({
        availableAnnonces: visiblePublicAnnonces?.length || 0,
        averageRating: computeHomeAverageRating(visiblePublicAnnonces)
      });
    } catch (error) {
      console.error('Load annonces error:', error);
      setAnnoncesLoadError("Impossible de charger les annonces publiques pour le moment.");
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await categoryService?.getCategories();

      if (error) {
        console.error('Erreur de chargement des categories accueil:', error);
        setAvailableCategories([]);
        return;
      }

      setAvailableCategories(dedupeCategoryOptions(data || []));
    } catch (error) {
      console.error('Erreur de chargement des categories accueil:', error);
      setAvailableCategories([]);
    }
  };

  const loadHomeDemandes = async () => {
    try {
      setLoadingHomeDemandes(true);
      setHomeDemandesLoadError('');
      const { data, error } = await demandeService?.getDemandes({ statut: 'open', limit: 24 });

      if (error) {
        console.error('Erreur de chargement des demandes accueil:', error);
        setHomeDemandes([]);
        setHomeDemandesLoadError('Impossible de charger les demandes publiques pour le moment.');
        return;
      }

      setHomeDemandes(data || []);
    } catch (error) {
      console.error('Load home demandes error:', error);
      setHomeDemandes([]);
      setHomeDemandesLoadError('Impossible de charger les demandes publiques pour le moment.');
    } finally {
      setLoadingHomeDemandes(false);
    }
  };

  const resolveVisitorLocationForHomeFeed = async () => {
    try {
      if (!geolocationService?.isGeolocationAvailable?.()) {
        setHomeFeedLocationMode('unsupported');
        return;
      }

      const position = await geolocationService?.getCurrentPosition();
      setUserLocation(position);
      setHomeFeedLocationMode('granted');
    } catch (error) {
      const message = String(error?.message || '')?.toLowerCase();
      if (message?.includes('refuse') || message?.includes('denied') || message?.includes('autorisation')) {
        setHomeFeedLocationMode('denied');
      } else {
        setHomeFeedLocationMode('error');
      }
    }
  };

  const loadStatistics = async () => {
    try {
      setStatisticsLoadError('');
      let usersCount = 0;
      let usersError = null;
      ({
        count: usersCount,
        error: usersError
      } = await supabase
        ?.from('profiles')
        ?.select('*', { count: 'exact', head: true })
        ?.is('deleted_at', null));

      if (usersError && isSchemaColumnError(usersError)) {
        ({ count: usersCount, error: usersError } = await supabase
          ?.from('profiles')
          ?.select('*', { count: 'exact', head: true }));
      } else if (usersError) {
        // Some environments return an opaque error when filtering on a missing column.
        const retryProfiles = await supabase
          ?.from('profiles')
          ?.select('*', { count: 'exact', head: true });

        if (!retryProfiles?.error) {
          usersCount = retryProfiles?.count || 0;
          usersError = null;
        }
      }

      let activeUsers = 0;
      if (usersError) {
        let altUsersCount = 0;
        let altUsersError = null;
        ({
          count: altUsersCount,
          error: altUsersError
        } = await supabase
          ?.from('user_profiles')
          ?.select('*', { count: 'exact', head: true })
          ?.is('deleted_at', null));

        if (altUsersError && isSchemaColumnError(altUsersError)) {
          ({ count: altUsersCount, error: altUsersError } = await supabase
            ?.from('user_profiles')
            ?.select('*', { count: 'exact', head: true }));
        }

        activeUsers = altUsersCount || 0;
      } else {
        activeUsers = usersCount || 0;
      }

      const { count: reservationsCount } = await supabase
        ?.from('reservations')
        ?.select('*', { count: 'exact', head: true })
        ?.eq('status', 'completed');

      const successfulRentals = reservationsCount || 0;

      updateStatistics({
        activeUsers,
        successfulRentals
      });
    } catch (error) {
      console.error('Load statistics error:', error);
      setStatisticsLoadError("Impossible de charger les statistiques publiques pour le moment.");
    }
  };

  const handleAroundMe = async () => {
    try {
      trackAnalyticsEvent('geolocation_search_start', {
        radius_km: Number.parseFloat(filters?.distance) || 10
      });

      setGeolocating(true);
      const position = await geolocationService?.getCurrentPosition();
      setUserLocation(position);

      const maxDistance = parseFloat(filters?.distance) || 10;
      const filtered = geolocationService?.filterByDistance(annonces, position, maxDistance);
      const lat = Number(position?.latitude ?? position?.lat);
      const lng = Number(position?.longitude ?? position?.lng);

      setDisplayedEquipment(filtered);
      setGeolocating(false);

      trackAnalyticsEvent('geolocation_search_success', {
        radius_km: maxDistance,
        results_count: filtered?.length || 0,
        latitude: Number.isFinite(lat) ? Number(lat?.toFixed(4)) : undefined,
        longitude: Number.isFinite(lng) ? Number(lng?.toFixed(4)) : undefined
      });

      alert(`${filtered?.length} annonces trouvees dans un rayon de ${maxDistance} km`);
    } catch (error) {
      console.error('Geolocation error:', error);
      trackAnalyticsEvent('geolocation_search_error', {
        error_message: String(error?.message || 'geolocation_error')?.slice(0, 120)
      });
      alert(error?.message || 'Erreur de geolocalisation. Verifiez les autorisations de votre navigateur.');
      setGeolocating(false);
    }
  };

  const formatCount = (value) => Number(value ?? 0)?.toLocaleString('fr-FR');
  const formatRating = (value) => (value > 0 ? Number(value)?.toFixed(1) : '0');
  const offersRenderBatchSize = getHomeOffersRenderBatchSize();
  const visibleOffersTargetCount = Math.min(displayedEquipment?.length || 0, visibleOffersCount);
  const visibleEquipment = (displayedEquipment || [])?.slice(0, visibleOffersTargetCount);
  const remainingOffersCount = Math.max((displayedEquipment?.length || 0) - visibleOffersTargetCount, 0);

  const handleShowMoreOffers = () => {
    setVisibleOffersCount((previousCount) =>
      Math.min(displayedEquipment?.length || 0, previousCount + getHomeOffersRenderBatchSize())
    );
  };

  const annoncesCount = statistics?.availableAnnonces ?? annonces?.length ?? 0;
  const distinctListingOwnersCount = [...new Set(
    (annonces || [])
      ?.map((item) => item?.ownerId || item?.owner_id || item?.user_id)
      ?.filter(Boolean)
      ?.map((value) => String(value))
  )]?.length;
  const activeUsersCount = Math.max(
    Number(statistics?.activeUsers ?? 0),
    Number(distinctListingOwnersCount || 0)
  );
  const successfulRentalsCount = statistics?.successfulRentals ?? 0;
  const averageRatingValue = statistics?.averageRating ?? 0;
  const isPublicListingsUnavailable = Boolean(annoncesLoadError) && (annonces?.length || 0) === 0;
  const isPublicStatsUnavailable = Boolean(statisticsLoadError) && !statistics?.shouldDisplay && annoncesCount === 0;
  const displayMetricValue = (value, unavailable = false) => (unavailable ? '—' : value);

  const heroMetrics = [
    {
      label: 'Annonces actives',
      value: displayMetricValue(formatCount(annoncesCount), isPublicListingsUnavailable),
      icon: 'Package'
    },
    {
      label: 'Membres actifs',
      value: displayMetricValue(formatCount(activeUsersCount), isPublicStatsUnavailable),
      icon: 'Users'
    },
    {
      label: 'Locations realisees',
      value: displayMetricValue(formatCount(successfulRentalsCount), isPublicStatsUnavailable),
      icon: 'CalendarCheck'
    }
  ];

  const trustMetrics = [
    {
      label: 'Utilisateurs actifs',
      value: formatCount(activeUsersCount),
      icon: 'Users'
    },
    {
      label: 'Annonces disponibles',
      value: formatCount(annoncesCount),
      icon: 'Package'
    },
    {
      label: 'Locations reussies',
      value: formatCount(successfulRentalsCount),
      icon: 'BadgeCheck'
    },
    {
      label: 'Note moyenne',
      value: `${formatRating(averageRatingValue)}/5`,
      icon: 'Star'
    }
  ];

  const quickCatégories = availableCategories?.length > 0
    ? availableCategories
    : buildCategoryShortcutsFromAnnonces(annonces);
  const categoryShortcutList =
    quickCatégories?.length > 0
      ? quickCatégories
      : dedupeCategoryOptions([
          { label: 'Bricolage', value: 'bricolage' },
          { label: 'Jardinage', value: 'jardinage' },
          { label: 'Camping', value: 'camping' },
          { label: 'Sport', value: 'sport' },
          { label: 'Cuisine', value: 'cuisine' }
        ]);

  const mixedDiscoveryItems = buildMixedDiscoveryFeed({
    offers: annonces,
    demandes: homeDemandes,
    visitorLocation: userLocation,
    limit: HOME_MIXED_FEED_LIMIT
  });
  const isPublicDiscoveryUnavailable =
    (mixedDiscoveryItems?.length || 0) === 0 && (Boolean(annoncesLoadError) || Boolean(homeDemandesLoadError));
  const hasNearbySortedItems = (mixedDiscoveryItems || [])?.some((item) => Number.isFinite(item?.distance));
  const hasVisitorLocationForFeed = Boolean(userLocation) && hasNearbySortedItems;
  const isHomeFeedLocationPending = homeFeedLocationMode === 'pending';
  const homeFeedTitle = hasVisitorLocationForFeed
    ? 'Dernieres annonces pres de vous'
    : 'Dernières annonces publiées';
  const homeFeedSubtitle = hasVisitorLocationForFeed
    ? 'Offres et demandes confondues, avec priorite ? la proximite quand elle est disponible.'
    : "Offres et demandes confondues, triees par date de creation (si la localisation n'est pas partagee).";

  const totalSearchResults =
    activeTab === 'tout'
      ? (displayedEquipment?.length || 0) + (displayedDemandes?.length || 0)
      : displayedEquipment?.length || 0;

  const browserOrigin =
    typeof window !== 'undefined' ? (window?.location?.origin || SITE_ORIGIN) : SITE_ORIGIN;
  const socialImageUrl = `${browserOrigin}${DEFAULT_SOCIAL_IMAGE}`;

  const organizationStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_ORIGIN}/#organization`,
    name: SITE_NAME,
    url: SITE_ORIGIN,
    logo: socialImageUrl,
    description: HOME_SEO_DESCRIPTION
  };

  const websiteStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_ORIGIN}/#website`,
    url: SITE_ORIGIN,
    name: SITE_NAME,
    inLanguage: 'fr-FR',
    description: HOME_SEO_DESCRIPTION
  };

  const faqStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: HOME_FAQ_ITEMS?.map((item) => ({
      '@type': 'Question',
      name: item?.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item?.answer
      }
    }))
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f2f8ff]">
      <Helmet>
        <html lang="fr" />
        <title>{HOME_SEO_TITLE}</title>
        <meta name="description" content={HOME_SEO_DESCRIPTION} />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <link rel="canonical" href={HOME_CANONICAL_URL} />

        <meta property="og:locale" content="fr_FR" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:title" content={HOME_SEO_TITLE} />
        <meta property="og:description" content={HOME_SEO_DESCRIPTION} />
        <meta property="og:url" content={HOME_CANONICAL_URL} />
        <meta property="og:image" content={socialImageUrl} />
        <meta property="og:image:alt" content={`${SITE_NAME} - plateforme de location de matériel entre voisins`} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={HOME_SEO_TITLE} />
        <meta name="twitter:description" content={HOME_SEO_DESCRIPTION} />
        <meta name="twitter:image" content={socialImageUrl} />

        <script type="application/ld+json">
          {JSON.stringify(organizationStructuredData)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(websiteStructuredData)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(faqStructuredData)}
        </script>
      </Helmet>

      <Header />

      <main className="main-content">
        <section className="relative overflow-hidden bg-gradient-to-br from-[#082b52] via-[#0f4d7a] to-[#0d7b88] pb-14 pt-14 md:pb-18 md:pt-18">
          <div className="pointer-events-none absolute -left-16 top-0 h-64 w-64 rounded-full bg-[#22d3ee]/20 blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-10 h-72 w-72 rounded-full bg-[#3b82f6]/25 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-[#67e8f9]/20 blur-2xl" />

          <div className="container relative mx-auto px-4">
            <div className="mb-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#7dd3fc]">
                  <Icon name="Sparkles" size={14} />
                  Plateforme locale de location
                </span>

                <h1 className="mt-4 max-w-2xl text-balance text-4xl font-bold leading-tight text-white md:text-5xl">
                  Louez et partagez vos equipements entre voisins, en quelques clics.
                </h1>
                <p className="mt-5 max-w-2xl text-base text-slate-200 md:text-lg">
                  Trouvez rapidement le bon matériel près de chez vous, au bon prix, avec une expérience claire
                  et rassurante.
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-slate-100">
                    <Icon name="ShieldCheck" size={14} />
                    Paiement sécurisé
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-slate-100">
                    <Icon name="Clock3" size={14} />
                    Réservation rapide
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-slate-100">
                    <Icon name="MapPin" size={14} />
                    Ultra local
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-slate-100">
                    <Icon name="Shield" size={14} />
                    Remboursement garanti
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-300">
                  Remboursement minimum garanti en cas de vol ou deterioration (selon conditions).
                </p>

              </div>

              <div className="rounded-3xl border border-white/20 bg-white/10 p-5 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.9)] backdrop-blur md:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#bae6fd]">Activite locale</p>
                <div className="mt-4 space-y-3">
                  {heroMetrics?.map((metric) => (
                    <div
                      key={metric?.label}
                      className="flex items-center justify-between rounded-xl border border-white/15 bg-white/10 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-[#67e8f9]">
                          <Icon name={metric?.icon} size={16} />
                        </span>
                        <span className="text-sm text-slate-200">{metric?.label}</span>
                      </div>
                      <span className="font-heading text-lg font-semibold text-white">{metric?.value}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-white/20 bg-gradient-to-r from-[#0f172a]/45 to-[#1d4ed8]/30 p-4">
                  <p className="text-xs uppercase tracking-[0.1em] text-slate-300">Satisfaction moyenne</p>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-2xl font-bold text-white">
                      {isPublicStatsUnavailable ? '—' : `${formatRating(averageRatingValue)}/5`}
                    </p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-[#fde68a]">
                      <Icon name="Star" size={14} className="fill-[#fde68a] text-[#fde68a]" />
                      Communauté vérifiée
                    </span>
                  </div>
                </div>

                {(annoncesLoadError || statisticsLoadError) && (
                  <div className="mt-4 rounded-2xl border border-amber-200/60 bg-amber-50/90 p-4 text-sm text-amber-900">
                    {annoncesLoadError || statisticsLoadError}
                  </div>
                )}
              </div>
            </div>

            <SearchBar
              onSearch={handleSearch}
              onAroundMe={handleAroundMe}
              geolocating={geolocating}
              categories={categoryShortcutList}
            />

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">Catégories:</span>
              {categoryShortcutList?.map((categoryOption) => (
                <button
                  key={categoryOption?.value}
                  type="button"
                  onClick={() => handleCategorySelect(categoryOption?.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                    selectedCategory === categoryOption?.value
                      ? 'border-[#22d3ee] bg-[#0f7081]/70 text-white'
                      : 'border-white/25 bg-white/10 text-slate-200 hover:border-[#22d3ee]/60 hover:bg-white/20'
                  }`}
                >
                  {categoryOption?.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {statistics?.shouldDisplay && (
          <section className="bg-[#eef6ff] py-10">
            <div className="container mx-auto px-4">
              <div className="rounded-3xl border border-[#17a2b8]/20 bg-gradient-to-r from-[#e9f7ff] via-[#f5fbff] to-[#edf7ff] p-6 shadow-elevation-1 md:p-8">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#0f7081]">Confiance</p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">Une communaute qui grandit chaque jour</h2>
                  </div>
                  <span className="hidden rounded-full border border-[#17a2b8]/30 bg-white px-3 py-1 text-xs font-medium text-[#0f7081] md:inline-flex">
                    Donnees en temps reel
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {trustMetrics?.map((metric) => (
                    <div key={metric?.label} className="rounded-2xl border border-slate-200 bg-[#f8fbff] p-4">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#ecfeff] text-[#0f7081]">
                        <Icon name={metric?.icon} size={18} />
                      </span>
                      <p className="mt-3 text-2xl font-bold text-slate-900">{metric?.value}</p>
                      <p className="text-sm text-slate-500">{metric?.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <section id="dernieres-annonces-locales" className="bg-[#f4f9ff] py-14 md:py-16">
          <div className="container mx-auto px-4">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="inline-flex rounded-full border border-[#17a2b8]/25 bg-[#ecfeff] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#0f7081]">
                  {hasVisitorLocationForFeed ? 'Pres de vous' : 'Dernieres publications'}
                </span>
                <h2 className="mt-3 text-3xl font-bold text-slate-900">{homeFeedTitle}</h2>
                <p className="mt-2 max-w-3xl text-slate-600">{homeFeedSubtitle}</p>
                {isHomeFeedLocationPending && (
                  <p className="mt-2 text-sm text-slate-500">
                    Detection de votre localisation en cours pour prioriser les offres proches...
                  </p>
                )}
                {hasVisitorLocationForFeed && (
                  <p className="mt-2 text-sm text-slate-500">
                    Les demandes sont triees par date (la table demandes ne stocke pas encore de coordonnees GPS).
                  </p>
                )}
              </div>
              <Link
                to="/demandes-publiques"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-[#17a2b8] hover:text-[#0f7081]"
              >
                Voir les demandes publiques
                <Icon name="ArrowRight" size={16} />
              </Link>
            </div>

            {loading && loadingHomeDemandes && (annonces?.length || 0) === 0 && (homeDemandes?.length || 0) === 0 ? (
              <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white/80 py-12">
                <Icon name="Loader" size={28} className="animate-spin text-[#17a2b8]" />
              </div>
            ) : isPublicDiscoveryUnavailable ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-8 text-center">
                <p className="font-medium text-amber-900">
                  Les contenus publics n&apos;ont pas pu être rechargés après ce retour externe.
                </p>
                <p className="mt-2 text-sm text-amber-800">
                  Fermez puis rouvrez l&apos;application, ou revenez directement dans l&apos;app via le deep link mobile.
                </p>
              </div>
            ) : mixedDiscoveryItems?.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-8 text-center">
                <p className="text-slate-700 font-medium">Aucune annonce recente a afficher pour le moment.</p>
                <p className="mt-2 text-sm text-slate-500">Les nouvelles offres et demandes apparaitront ici automatiquement.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                {mixedDiscoveryItems?.map((feedItem) => {
                  if (feedItem?.kind === 'offre') {
                    const offer = feedItem?.payload;
                    return (
                      <Link
                        key={feedItem?.id}
                        to={construireUrlAnnonce(offer)}
                        className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-elevation-1 transition-all hover:-translate-y-1 hover:border-[#17a2b8]/45 hover:shadow-elevation-2"
                      >
                        <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                          <img
                            src={offer?.image || offer?.photos?.[0] || '/assets/images/no_image.png'}
                            alt={offer?.imageAlt || offer?.title || offer?.titre || "Image de l'annonce"}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                            decoding="async"
                            onError={(event) => {
                              event.currentTarget.onerror = null;
                              event.currentTarget.src = '/assets/images/no_image.png';
                            }}
                          />
                          <div className="absolute left-3 top-3 flex flex-col gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#1d4ed8] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                              <Icon name="Package" size={12} />
                              Offre
                            </span>
                            {feedItem?.distanceText && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-[#0f7081]">
                                <Icon name="MapPin" size={12} />
                                {feedItem?.distanceText}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="p-4">
                          <h3 className="line-clamp-2 text-base font-semibold text-slate-900 group-hover:text-[#0f7081]">
                            {offer?.title || offer?.titre}
                          </h3>
                          <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                            {offer?.description || 'Offre de location disponible sur la plateforme.'}
                          </p>
                          <div className="mt-4 space-y-2 text-sm text-slate-600">
                            <div className="flex items-center gap-2">
                              <Icon name="MapPin" size={14} />
                              <span className="truncate">{offer?.location || offer?.ville || 'Ville non renseignée'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-2">
                                <Icon name="Clock3" size={14} />
                                {formatFeedDate(feedItem?.createdAt)}
                              </span>
                              <span className="font-semibold text-slate-900">
                                {Number(offer?.dailyPrice || 0)?.toFixed(2)} EUR/j
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  }

                  const demande = feedItem?.payload;
                  const categoryLabel = demande?.categorie_slug || demande?.category || 'Demande';
                  return (
                    <article
                      key={feedItem?.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-elevation-1"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#0f7081] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                          <Icon name="MessageSquare" size={12} />
                          Demande
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#f8fafc] px-2.5 py-1 text-xs font-medium text-slate-600">
                          <Icon name={CATEGORY_ICON_MAP?.[categoryLabel] || 'Tag'} size={12} />
                          {categoryLabel}
                        </span>
                      </div>
                      <h3 className="mt-3 line-clamp-2 text-base font-semibold text-slate-900">
                        {demande?.titre || 'Demande de matériel'}
                      </h3>
                      <p className="mt-2 line-clamp-3 text-sm text-slate-600">
                        {demande?.description || 'Un voisin recherche ce matériel.'}
                      </p>
                      <div className="mt-4 space-y-2 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <Icon name="MapPin" size={14} />
                          <span className="truncate">{demande?.ville || 'Ville non renseignée'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-2">
                            <Icon name="Clock3" size={14} />
                            {formatFeedDate(feedItem?.createdAt)}
                          </span>
                          <span className="font-semibold text-slate-900">
                            {demande?.prix_max ? `Max ${demande?.prix_max} EUR/j` : 'Budget non précisé'}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="bg-gradient-to-b from-[#edf6ff] via-[#f2f9ff] to-[#e8f3ff] py-14 md:py-16">
          <div className="container mx-auto px-4">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="inline-flex rounded-full border border-[#17a2b8]/25 bg-[#ecfeff] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#0f7081]">
                  Résultats
                </span>
                <h2 className="mt-3 text-3xl font-bold text-slate-900">
                  {activeTab === 'tout' ? 'Résultats offres et demandes' : 'Dernières offres'}
                </h2>
                <p className="mt-2 text-slate-600">
                  {totalSearchResults} résultat(s) affiché(s)
                  {selectedCategory ? ` dans "${selectedCategory}"` : ''}.
                </p>
              </div>

              {selectedCategory && (
                <Button
                  variant="outline"
                  className="rounded-xl border-slate-300 bg-white text-slate-700 hover:border-[#17a2b8] hover:text-[#0f7081]"
                  iconName="X"
                  onClick={clearCategoryFilter}
                >
                  Retirer le filtre
                </Button>
              )}
            </div>

            <div className={activeTab === 'tout' ? 'space-y-10' : ''}>
              <div>
                {activeTab === 'tout' && (
                  <h3 className="mb-4 text-xl font-semibold text-slate-900">
                    Offres ({displayedEquipment?.length || 0})
                  </h3>
                )}
                <Suspense
                  fallback={(
                    <div className="flex items-center justify-center rounded-2xl bg-white/70 py-10">
                      <Icon name="Loader" size={28} className="animate-spin text-[#17a2b8]" />
                    </div>
                  )}
                >
                  <EquipmentGrid equipment={visibleEquipment} loading={loading} userLocation={userLocation} />
                </Suspense>

                {!loading && remainingOffersCount > 0 && (
                  <div className="mt-6 flex flex-col items-center gap-3">
                    <Button
                      variant="outline"
                      className="rounded-xl border-slate-300 bg-white text-slate-700 hover:border-[#17a2b8] hover:text-[#0f7081]"
                      iconName="ChevronDown"
                      onClick={handleShowMoreOffers}
                    >
                      Afficher {Math.min(remainingOffersCount, offersRenderBatchSize)} offre(s) de plus
                    </Button>
                    <p className="text-sm text-slate-500">
                      {visibleOffersTargetCount} sur {displayedEquipment?.length || 0} offre(s) affichée(s)
                    </p>
                  </div>
                )}
              </div>

              {activeTab === 'tout' && (
                <div>
                  <h3 className="mb-4 text-xl font-semibold text-slate-900">
                    Demandes ({displayedDemandes?.length || 0})
                  </h3>

                  {loadingDemandes ? (
                    <div className="flex items-center justify-center rounded-2xl bg-white/80 py-10">
                      <Icon name="Loader" size={28} className="animate-spin text-[#17a2b8]" />
                    </div>
                  ) : displayedDemandes?.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white/80 p-8 text-center">
                      <p className="text-slate-600">Aucune demande ne correspond à votre recherche.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {displayedDemandes?.map((demande) => (
                        <article key={demande?.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-elevation-1">
                          <span className="inline-flex items-center rounded-full bg-[#0f7081] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                            Demande
                          </span>
                          <h4 className="mt-3 line-clamp-2 text-lg font-semibold text-slate-900">
                            {demande?.titre}
                          </h4>
                          <p className="mt-2 line-clamp-3 text-sm text-slate-600">
                            {demande?.description}
                          </p>
                          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                            <span className="inline-flex items-center gap-1">
                              <Icon name="MapPin" size={14} />
                              {demande?.ville || 'Ville non renseignée'}
                            </span>
                            {demande?.prix_max ? <span>Max {demande?.prix_max}€/j</span> : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-gradient-to-r from-[#0a365f] via-[#0f4d7a] to-[#0d7b88] py-16 md:py-20">
          <div className="pointer-events-none absolute -left-8 top-6 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute right-8 bottom-2 h-48 w-48 rounded-full bg-[#22d3ee]/25 blur-3xl" />

          <div className="container relative mx-auto px-4 text-center">
            <h2 className="text-balance text-3xl font-bold text-white md:text-4xl">
              Gagnez de l'argent en louant vos objets inutilisés
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-white/90 md:text-lg">
              Vos équipements dorment dans votre garage ? Transformez-les en revenu complémentaire et rendez service
              à votre quartier.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="border-0 bg-white text-[#0f4d7a] hover:bg-slate-100"
                iconName="Plus"
                onClick={() => (window.location.href = '/creer-annonce')}
              >
                Créer une annonce
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/45 bg-transparent text-white hover:bg-white/10"
                iconName="ArrowRight"
                iconPosition="right"
                onClick={() => (window.location.href = '/creer-demande')}
              >
                Créer une demande
              </Button>
            </div>
          </div>
        </section>

        <section className="bg-[#f1f7ff] py-14 md:py-16">
          <div className="container mx-auto px-4">
            <div className="mb-10 text-center">
              <span className="inline-flex rounded-full border border-[#17a2b8]/25 bg-[#ecfeff] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#0f7081]">
                Simple et rapide
              </span>
              <h2 className="mt-3 text-3xl font-bold text-slate-900">Comment ça marche ?</h2>
              <p className="mt-2 text-slate-600">Louez en 3 étapes claires.</p>
            </div>

            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-[#f8fbff] to-[#eef6ff] p-6 text-center shadow-elevation-1">
                <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-xl bg-[#ecfeff] text-[#0f7081]">
                  <Icon name="Search" size={28} />
                </span>
                <span className="mx-auto mt-4 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#17a2b8] px-2 text-xs font-bold text-white">
                  1
                </span>
                <h3 className="mt-3 text-xl font-semibold text-slate-900">Rechercher</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Trouvez l'équipement adapté à votre besoin en filtrant par catégorie ou localisation.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-[#f8fbff] to-[#eef6ff] p-6 text-center shadow-elevation-1">
                <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-xl bg-[#ecfeff] text-[#0f7081]">
                  <Icon name="CalendarDays" size={28} />
                </span>
                <span className="mx-auto mt-4 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#17a2b8] px-2 text-xs font-bold text-white">
                  2
                </span>
                <h3 className="mt-3 text-xl font-semibold text-slate-900">Réserver</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Choisissez vos dates et confirmez la réservation instantanément par paiement sécurisé.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-[#f8fbff] to-[#eef6ff] p-6 text-center shadow-elevation-1">
                <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-xl bg-[#ecfeff] text-[#0f7081]">
                  <Icon name="ThumbsUp" size={28} />
                </span>
                <span className="mx-auto mt-4 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#17a2b8] px-2 text-xs font-bold text-white">
                  3
                </span>
                <h3 className="mt-3 text-xl font-semibold text-slate-900">Profiter</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Récupérez le matériel, utilisez-le sereinement, puis notez votre expérience.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-14 md:py-16">
          <div className="container mx-auto px-4">
            <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
              <div>
                <span className="inline-flex rounded-full border border-[#17a2b8]/20 bg-[#ecfeff] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#0f7081]">
                  SEO utile pour les visiteurs
                </span>
                <h2 className="mt-3 text-3xl font-bold text-slate-900">Questions fréquentes sur la location de matériel entre voisins</h2>
                <p className="mt-3 max-w-3xl text-slate-600">
                  Le Matos Du Voisin facilite la location de matériel entre particuliers partout en France.
                  Vous pouvez publier une annonce, rechercher un équipement près de chez vous et envoyer une
                  réservation en quelques clics.
                </p>

                <div className="mt-6 space-y-3">
                  {HOME_FAQ_ITEMS.map((faq, index) => (
                    <details
                      key={faq?.question}
                      className="group rounded-2xl border border-slate-200 bg-[#f8fbff] p-4 open:border-[#17a2b8]/35 open:bg-white"
                    >
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-left">
                        <span className="font-semibold text-slate-900">{faq?.question}</span>
                        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ecfeff] text-[#0f7081]">
                          <Icon name="ChevronDown" size={14} className="transition-transform group-open:rotate-180" />
                        </span>
                      </summary>
                      <p className="mt-3 text-sm leading-relaxed text-slate-600">{faq?.answer}</p>
                    </details>
                  ))}
                </div>
              </div>

              <aside className="rounded-3xl border border-slate-200 bg-gradient-to-b from-[#f8fbff] to-white p-6 shadow-elevation-1">
                <h3 className="text-xl font-semibold text-slate-900">Explorer la plateforme</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Accédez rapidement aux catégories disponibles et aux parcours les plus utiles.
                </p>

                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Catégories</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {categoryShortcutList?.map((categoryOption) => (
                      <Link
                        key={`seo-link-${categoryOption?.value}`}
                        to={`/accueil-recherche?categorie=${encodeURIComponent(categoryOption?.value)}`}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-[#17a2b8]/45 hover:text-[#0f7081]"
                      >
                        {categoryOption?.label}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actions rapides</p>
                  <Link
                    to="/creer-annonce"
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 hover:border-[#17a2b8]/45 hover:text-[#0f7081]"
                  >
                    Publier une annonce de location
                    <Icon name="ArrowRight" size={16} />
                  </Link>
                  <Link
                    to="/creer-demande"
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 hover:border-[#17a2b8]/45 hover:text-[#0f7081]"
                  >
                    Publier une demande de matériel
                    <Icon name="ArrowRight" size={16} />
                  </Link>
                </div>

                <div className="mt-5 rounded-2xl border border-[#17a2b8]/20 bg-[#ecfeff] p-4">
                  <p className="text-sm font-semibold text-slate-900">Recherche locale en France</p>
                  <p className="mt-1 text-sm text-slate-600">
                    La plateforme met en avant des annonces par ville et categorie pour vous aider a trouver
                    rapidement du matériel disponible près de chez vous.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default HomeSearch;



