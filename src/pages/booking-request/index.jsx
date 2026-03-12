import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { differenceInDays, startOfDay } from 'date-fns';
import toast from 'react-hot-toast';

import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Button from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import Icon from '../../components/AppIcon';
import DateRangePicker from './components/DateRangePicker';
import PricingBreakdown from './components/PricingBreakdown';
import BookingSummary from './components/BookingSummary';
import { useAuth } from '../../contexts/AuthContext';
import annonceService from '../../services/annonceService';
import reservationService from '../../services/reservationService';
import storageService from '../../services/storageService';
import { storeAuthRedirectPath } from '../../utils/authRedirect';
import {
  CAUTION_MODE_CB,
  getCautionModeLabel,
  normalizeCautionMode
} from '../../utils/cautionMode';
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

const parsePrefilledDate = (value) => {
  if (!value) return null;

  const parsedDate = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsedDate?.getTime())) return null;

  return startOfDay(parsedDate);
};

const BOOKING_REQUEST_DRAFT_STORAGE_KEY_PREFIX = 'booking_request_draft_v1';

const canUseSessionStorage = () => typeof window !== 'undefined' && Boolean(window?.sessionStorage);

const buildBookingDraftStorageKey = (bookingId) => {
  if (!bookingId) return null;
  return `${BOOKING_REQUEST_DRAFT_STORAGE_KEY_PREFIX}:${bookingId}`;
};

const defaultBookingFormData = (startDate, endDate) => ({
  startDate,
  endDate: startDate ? endDate : null,
  insuranceOptIn: false,
  cautionMode: CAUTION_MODE_CB,
  acceptCGU: false
});

const hasDraftContent = (draft) => {
  return Boolean(
    draft?.startDate
      || draft?.endDate
      || draft?.insuranceOptIn
      || draft?.cautionMode
      || draft?.acceptCGU
  );
};

const saveBookingDraft = (bookingId, formData) => {
  if (!canUseSessionStorage()) return;

  const storageKey = buildBookingDraftStorageKey(bookingId);
  if (!storageKey) return;

  const serializedDraft = {
    startDate: formData?.startDate ? formData?.startDate?.toISOString() : null,
    endDate: formData?.endDate ? formData?.endDate?.toISOString() : null,
    insuranceOptIn: Boolean(formData?.insuranceOptIn),
    cautionMode: normalizeCautionMode(formData?.cautionMode),
    acceptCGU: Boolean(formData?.acceptCGU)
  };

  try {
    if (!hasDraftContent(serializedDraft)) {
      window.sessionStorage.removeItem(storageKey);
      return;
    }

    window.sessionStorage.setItem(storageKey, JSON.stringify(serializedDraft));
  } catch (error) {
    console.warn('Impossible de sauvegarder le brouillon de reservation:', error);
  }
};

const loadBookingDraft = (bookingId) => {
  if (!canUseSessionStorage()) return null;

  const storageKey = buildBookingDraftStorageKey(bookingId);
  if (!storageKey) return null;

  try {
    const rawDraft = window.sessionStorage.getItem(storageKey);
    if (!rawDraft) return null;

    const parsedDraft = JSON.parse(rawDraft);
    if (!parsedDraft || typeof parsedDraft !== 'object') return null;

    const startDate = parsePrefilledDate(parsedDraft?.startDate);
    const endDate = parsePrefilledDate(parsedDraft?.endDate);

    return {
      startDate,
      endDate: startDate ? (endDate || startDate) : null,
      insuranceOptIn: Boolean(parsedDraft?.insuranceOptIn),
      cautionMode: normalizeCautionMode(parsedDraft?.cautionMode),
      acceptCGU: Boolean(parsedDraft?.acceptCGU)
    };
  } catch (error) {
    console.warn('Impossible de restaurer le brouillon de reservation:', error);
    return null;
  }
};

const clearBookingDraft = (bookingId) => {
  if (!canUseSessionStorage()) return;

  const storageKey = buildBookingDraftStorageKey(bookingId);
  if (!storageKey) return;

  try {
    window.sessionStorage.removeItem(storageKey);
  } catch (error) {
    console.warn('Impossible de nettoyer le brouillon de reservation:', error);
  }
};

const BookingRequest = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const preselectedDatesFromLocation = location?.state?.preselectedBookingDates || {};
  const prefilledStartDate = parsePrefilledDate(preselectedDatesFromLocation?.startDate);
  const prefilledEndDate = parsePrefilledDate(preselectedDatesFromLocation?.endDate);
  const hasPrefilledDates = Boolean(prefilledStartDate || prefilledEndDate);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [equipmentLoading, setEquipmentLoading] = useState(true);
  const [equipmentError, setEquipmentError] = useState('');
  const [annonce, setAnnonce] = useState(null);
  const [unavailableDates, setUnavailableDates] = useState([]);

  const [formData, setFormData] = useState(() => {
    const defaults = defaultBookingFormData(prefilledStartDate, prefilledEndDate);
    const savedDraft = loadBookingDraft(id);

    if (!savedDraft) return defaults;

    return {
      ...defaults,
      ...savedDraft,
      startDate: savedDraft?.startDate || defaults?.startDate,
      endDate: savedDraft?.startDate
        ? (savedDraft?.endDate || savedDraft?.startDate)
        : defaults?.endDate
    };
  });

  useEffect(() => {
    saveBookingDraft(id, formData);
  }, [id, formData]);

  useEffect(() => {
    let isMounted = true;

    const loadBookingContext = async () => {
      if (!id) {
        setEquipmentError("Annonce introuvable.");
        setEquipmentLoading(false);
        return;
      }

      try {
        setEquipmentLoading(true);
        setEquipmentError('');

        const [{ data: annonceData, error: annonceError }, { data: reservationsData, error: reservationsError }] = await Promise.all([
          annonceService?.getAnnonceById(id),
          reservationService?.getReservationsByAnnonce(id)
        ]);

        if (annonceError) throw annonceError;
        if (reservationsError) throw reservationsError;

        if (!annonceData) {
          if (!isMounted) return;
          setAnnonce(null);
          setUnavailableDates([]);
          setEquipmentError("Annonce introuvable.");
          return;
        }

        const annonceOwnerId = String(annonceData?.owner_id || annonceData?.user_id || '')?.trim();
        const currentUserId = String(user?.id || '')?.trim();
        if (annonceOwnerId && currentUserId && annonceOwnerId === currentUserId) {
          if (!isMounted) return;
          setAnnonce(null);
          setUnavailableDates([]);
          setEquipmentError('Vous ne pouvez pas reserver votre propre annonce.');
          return;
        }

        const reservationBlockedDates = (reservationsData || [])
          ?.filter((reservation) => BLOCKING_STATUSES?.has(String(reservation?.status || '')?.toLowerCase()))
          ?.flatMap((reservation) => expandReservationDates(reservation?.start_date, reservation?.end_date));
        const listingBlockedDates = Array.isArray(annonceData?.unavailable_dates)
          ? annonceData?.unavailable_dates
          : [];
        const blockedDates = [...listingBlockedDates, ...(reservationBlockedDates || [])];

        if (!isMounted) return;
        setAnnonce(annonceData);
        setUnavailableDates(blockedDates);
      } catch (error) {
        console.error('Erreur de chargement reservation:', error);
        if (!isMounted) return;
        setAnnonce(null);
        setUnavailableDates([]);
        setEquipmentError(error?.message || "Impossible de charger cette annonce.");
      } finally {
        if (isMounted) setEquipmentLoading(false);
      }
    };

    loadBookingContext();

    return () => {
      isMounted = false;
    };
  }, [id, user?.id]);

  const equipment = useMemo(() => {
    if (!annonce) return null;

    const photoPaths = Array?.isArray(annonce?.photos)
      ? annonce?.photos
      : Array?.isArray(annonce?.images)
        ? annonce?.images
        : [];
    const resolvedPhotos = storageService?.getAnnoncePhotoUrls(photoPaths);
    const firstPhoto = resolvedPhotos?.[0] || photoPaths?.[0] || '/assets/images/no_image.png';
    const ownerRatingValue = Number(annonce?.owner?.rating ?? annonce?.owner?.note_moyenne);
    const ownerReviewCount = Number(annonce?.owner?.review_count ?? annonce?.owner?.nombre_avis ?? 0);

    return {
      id: annonce?.id,
      title: annonce?.titre || annonce?.title || 'Annonce sans titre',
      category: annonce?.categorie || annonce?.category || 'Non classe',
      dailyPrice: Number(annonce?.prix_jour ?? annonce?.dailyPrice ?? 0) || 0,
      cautionAmount: Number(annonce?.caution ?? annonce?.cautionAmount ?? 0) || 0,
      images: [{ url: firstPhoto, alt: annonce?.titre || annonce?.title || "Photo de l'annonce" }],
      owner: {
        pseudonym: annonce?.owner?.pseudo || 'Propriétaire',
        avatar: annonce?.owner?.avatar_url || '/assets/images/no_image.png',
        avatarAlt: `Avatar de ${annonce?.owner?.pseudo || 'propriétaire'}`,
        rating: ownerReviewCount > 0 && Number.isFinite(ownerRatingValue)
          ? Math.round(ownerRatingValue * 10) / 10
          : null,
        reviewCount: ownerReviewCount > 0 ? ownerReviewCount : 0
      },
      unavailableDates,
      pickupDays: Array.isArray(annonce?.pickup_days) ? annonce?.pickup_days : [],
      returnDays: Array.isArray(annonce?.return_days) ? annonce?.return_days : [],
      pickupTimeStart: annonce?.pickup_time_start || null,
      pickupTimeEnd: annonce?.pickup_time_end || null,
      returnTimeStart: annonce?.return_time_start || null,
      returnTimeEnd: annonce?.return_time_end || null
    };
  }, [annonce, unavailableDates]);

  const rentalDays = formData?.startDate && formData?.endDate
    ? differenceInDays(formData?.endDate, formData?.startDate) + 1
    : 0;
  const earliestStartDate = getEarliestReservationStartDate();
  const cautionMode = CAUTION_MODE_CB;
  const effectiveInsuranceSelected = false;

  const equipmentTotal = rentalDays * Number(equipment?.dailyPrice || 0);
  const insuranceAmount = 0;
  const totalAmount = equipmentTotal + insuranceAmount;

  const handleDateChange = (startDate, endDate) => {
    setFormData((prev) => ({ ...prev, startDate, endDate }));
    if (errors?.dates) setErrors((prev) => ({ ...prev, dates: '' }));
  };

  const handleCGUChange = (e) => {
    setFormData((prev) => ({ ...prev, acceptCGU: e?.target?.checked }));
    if (errors?.acceptCGU) setErrors((prev) => ({ ...prev, acceptCGU: '' }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData?.startDate || !formData?.endDate) {
      newErrors.dates = 'Veuillez sélectionner les dates de location';
    } else if (formData?.endDate < formData?.startDate) {
      newErrors.dates = 'La date de fin doit être égale ou postérieure à la date de début';
    } else if (!isReservationStartDateAllowed(formData?.startDate)) {
      newErrors.dates = SAME_DAY_RESERVATION_BLOCKED_MESSAGE;
    } else {
      const blockedDateSet = buildBlockedDateSet(equipment?.unavailableDates || []);
      if (rangeContainsBlockedDate(formData?.startDate, formData?.endDate, blockedDateSet)) {
        newErrors.dates = 'Cette période inclut au moins une date indisponible pour cette annonce';
      } else {
        const pickupWeekdays = normalizeScheduleWeekdays(equipment?.pickupDays || []);
        if (!isDateAllowedByWeekdays(formData?.startDate, pickupWeekdays)) {
          newErrors.dates = 'Le jour de début ne correspond pas aux jours de récupération autorisés';
        } else {
          const returnWeekdays = normalizeScheduleWeekdays(equipment?.returnDays || equipment?.pickupDays || []);
          if (!isDateAllowedByWeekdays(formData?.endDate, returnWeekdays)) {
            newErrors.dates = 'Le jour de fin ne correspond pas aux jours de restitution autorisés';
          }
        }
      }
    }

    if (!formData?.acceptCGU) {
      newErrors.acceptCGU = "Vous devez accepter les conditions générales d'utilisation";
    }

    setErrors(newErrors);
    return Object.keys(newErrors)?.length === 0;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();

    if (!equipment) return;
    if (!validateForm()) return;

    if (!user) {
      saveBookingDraft(id, formData);
      const redirectAfterAuth = `${location?.pathname || `/demande-reservation/${id}`}${location?.search || ''}${location?.hash || ''}`;
      storeAuthRedirectPath(redirectAfterAuth);
      toast?.error('Veuillez vous connecter pour réserver cet équipement.');
      navigate('/authentification', {
        state: {
          from: redirectAfterAuth
        }
      });
      return;
    }

    clearBookingDraft(id);
    setLoading(true);

    try {
      const ownerId = annonce?.owner_id || annonce?.user_id || null;
      if (!ownerId) {
        throw new Error("Impossible d'identifier le propriétaire de cette annonce.");
      }
      if (String(ownerId) === String(user?.id || '')) {
        throw new Error('Vous ne pouvez pas louer votre propre annonce.');
      }
      if (!isReservationStartDateAllowed(formData?.startDate)) {
        throw new Error(SAME_DAY_RESERVATION_BLOCKED_MESSAGE);
      }

      const normalizedStartDate = toReservationDateOnly(formData?.startDate);
      const normalizedEndDate = toReservationDateOnly(formData?.endDate);
      if (!normalizedStartDate || !normalizedEndDate) {
        throw new Error('Dates de reservation invalides.');
      }

      const paymentParams = new URLSearchParams({
        annonceId: String(equipment?.id || ''),
        startDate: normalizedStartDate,
        endDate: normalizedEndDate
      });

      navigate(`/traitement-paiement?${paymentParams?.toString()}`, {
        state: {
          equipment,
          bookingDetails: {
            annonceId: equipment?.id,
            ownerId,
            reservationId: null,
            startDate: formData?.startDate,
            endDate: formData?.endDate,
            rentalDays,
            equipmentTotal,
            insuranceSelected: effectiveInsuranceSelected,
            insuranceAmount,
            totalAmount,
            cautionAmount: equipment?.cautionAmount,
            cautionMode,
            pickupTimeStart: equipment?.pickupTimeStart || null,
            pickupTimeEnd: equipment?.pickupTimeEnd || null,
            returnTimeStart: equipment?.returnTimeStart || null,
            returnTimeEnd: equipment?.returnTimeEnd || null
          }
        }
      });
    } catch (submitError) {
      console.error('Erreur preparation paiement:', submitError);
      toast?.error(submitError?.message || 'Impossible de preparer le paiement.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <main className="flex-1 py-8 md:py-12">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="mb-6 md:mb-8">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <Icon name="ArrowLeft" size={20} />
              <span>Retour</span>
            </button>
            <h1 className="text-h2 md:text-h1 font-heading text-foreground">
              Reservation instantanee
            </h1>
            <p className="text-muted-foreground mt-2">
              Choisissez vos dates et passez au paiement pour confirmer la reservation
            </p>
          </div>

          {equipmentLoading && (
            <div className="bg-white rounded-lg shadow-elevation-2 p-6 mb-6">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Icon name="Loader2" size={20} className="animate-spin" />
                <span>Chargement des informations de l'annonce...</span>
              </div>
            </div>
          )}

          {!equipmentLoading && equipmentError && (
            <div className="bg-white rounded-lg shadow-elevation-2 p-6 mb-6">
              <div className="flex items-start gap-3 text-destructive">
                <Icon name="AlertCircle" size={20} className="mt-0.5" />
                <div>
                  <p className="font-medium">{equipmentError}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Retournez à la recherche puis réessayez depuis une annonce existante.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!equipmentLoading && equipment && (
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-lg shadow-elevation-2 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Icon name="Calendar" size={24} className="text-primary" />
                      <h2 className="text-h4 font-heading text-foreground">
                        Période de location
                      </h2>
                    </div>
                    {hasPrefilledDates && (
                      <div className="mb-4 p-3 rounded-md border border-primary/15 bg-primary/5">
                        <p className="text-sm font-medium text-foreground">
                          Dates présélectionnées depuis l'annonce
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Vous pouvez les confirmer ou les modifier ci-dessous.
                        </p>
                      </div>
                    )}
                    <DateRangePicker
                      startDate={formData?.startDate}
                      endDate={formData?.endDate}
                      onChange={handleDateChange}
                      unavailableDates={equipment?.unavailableDates || []}
                      allowedStartWeekdays={equipment?.pickupDays || []}
                      allowedEndWeekdays={equipment?.returnDays || []}
                      minDate={earliestStartDate}
                    />

                    {errors?.dates && (
                      <p className="text-sm text-destructive mt-2">{errors?.dates}</p>
                    )}
                    {rentalDays > 0 && (
                      <div className="mt-4 p-3 bg-accent/10 rounded-md">
                        <p className="text-sm text-accent-foreground">
                          <Icon name="Info" size={16} className="inline mr-1" />
                          Durée de location : <strong>{rentalDays} jour{rentalDays > 1 ? 's' : ''}</strong>
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-lg shadow-elevation-2 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Icon name="Calculator" size={24} className="text-primary" />
                      <h2 className="text-h4 font-heading text-foreground">
                        Prix de location
                      </h2>
                    </div>
                    <PricingBreakdown
                      rentalDays={rentalDays}
                      equipmentTotal={equipmentTotal}
                      insuranceSelected={effectiveInsuranceSelected}
                      insuranceAmount={insuranceAmount}
                      totalAmount={totalAmount}
                    />

                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-sm text-muted-foreground">
                        Le paiement inclut la location. La caution est garantie uniquement par empreinte CB.
                      </p>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-elevation-2 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Icon name="Shield" size={24} className="text-warning" />
                      <h2 className="text-h4 font-heading text-foreground">
                        Garantie par empreinte CB
                      </h2>
                    </div>
                    <div className="space-y-2 mb-4">
                      <p className="text-xs text-muted-foreground">
                        Mode unique appliqué sur la plateforme: <strong>{getCautionModeLabel(CAUTION_MODE_CB)}</strong>.
                      </p>
                    </div>
                    <div className="flex items-start gap-3 p-4 bg-warning/10 rounded-md">
                      <Icon name="AlertCircle" size={20} className="text-warning flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-foreground mb-2">
                          Montant : {Number(equipment?.cautionAmount || 0)?.toFixed(2)} EUR
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>c'est une garantie de bonne restitution</strong>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Cette empreinte CB garantit la caution sans être débitée au paiement de la location. Sa clôture suit le workflow officiel de fin de location, d'état des lieux et de modération si besoin.
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Après paiement, le locataire devra déposer une pièce d'identité valide avant la remise du matériel. Sans dépôt à temps, la réservation peut être annulée, 1 jour conservé et le reste remboursé.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-elevation-2 p-6">
                    <Checkbox
                      id="cgu"
                      checked={formData?.acceptCGU}
                      onChange={handleCGUChange}
                      label="J'accepte les conditions générales d'utilisation"
                      description={(
                        <span>
                          En cochant cette case, vous acceptez nos{' '}
                          <a href="/cgu" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            conditions générales d'utilisation
                          </a>
                          {' '}et notre{' '}
                          <a href="/politique-confidentialite" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            politique de confidentialité
                          </a>
                          .
                        </span>
                      )}
                      error={errors?.acceptCGU}
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    fullWidth
                    loading={loading}
                    disabled={!formData?.startDate || !formData?.endDate || !formData?.acceptCGU}
                    className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    <Icon name="CreditCard" size={20} className="mr-2" />
                    Passer au paiement
                  </Button>
                </div>

                <div className="lg:col-span-1">
                  <div className="sticky top-24">
                    <BookingSummary
                      equipment={equipment}
                      startDate={formData?.startDate}
                      endDate={formData?.endDate}
                      rentalDays={rentalDays}
                      insuranceSelected={effectiveInsuranceSelected}
                      insuranceAmount={insuranceAmount}
                      totalAmount={totalAmount}
                    />
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default BookingRequest;

