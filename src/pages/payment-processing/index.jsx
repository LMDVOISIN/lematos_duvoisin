import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

import Button from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import Icon from '../../components/AppIcon';
import CostBreakdown from './components/CostBreakdown';
import {
  ActionCard,
  ActionHero,
  ActionPageShell
} from '../../components/page/ActionPageLayout';
import annonceService from '../../services/annonceService';
import reservationService from '../../services/reservationService';
import storageService from '../../services/storageService';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { storeAuthRedirectPath } from '../../utils/authRedirect';
import {
  isAdminVerificationScenario
} from '../../utils/adminVerificationContext';
import {
  CAUTION_MODE_CB,
  getCautionModeLabel
} from '../../utils/cautionMode';
import { buildAppRedirectUrl, redirectToExternalUrl } from '../../utils/nativeRuntime';
import {
  SAME_DAY_RESERVATION_BLOCKED_MESSAGE,
  getEarliestReservationStartDate,
  isReservationStartDateAllowed,
  toReservationDateOnly
} from '../../utils/reservationDateRules';
import { formatTimeRange } from '../../utils/timeSlots';

const PENDING_PAYMENT_CONTEXT_STORAGE_KEY = 'pending_payment_checkout_context_v1';

const startOfLocalDay = (value = new Date()) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date?.getTime())) return null;
  date?.setHours(0, 0, 0, 0);
  return date;
};

const computeRentalDays = (startDate, endDate) => {
  const normalizedStart = startOfLocalDay(startDate);
  const normalizedEnd = startOfLocalDay(endDate);
  if (!normalizedStart || !normalizedEnd) return 0;
  const diff = Math.round((normalizedEnd - normalizedStart) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
};

const buildDefaultRentalWindow = () => {
  const startDate = startOfLocalDay(new Date());
  if (startDate) startDate?.setDate(startDate?.getDate() + 1);
  const endDate = startDate ? new Date(startDate) : startOfLocalDay(new Date());
  if (endDate) endDate?.setDate(endDate?.getDate() + 1);
  return { startDate, endDate };
};

const computeCheckoutAmounts = ({
  equipmentTotal = 0
} = {}) => {
  const normalizedEquipmentTotal = Math.max(0, Number(equipmentTotal) || 0);

  return {
    insuranceAmount: 0,
    totalAmount: normalizedEquipmentTotal
  };
};

const toDateOrNull = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date?.getTime()) ? null : date;
};

const normalizeReservationId = (value) => {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(raw) ? raw : null;
};

const normalizeOptionalIdentifier = (value) => {
  if (value == null) return null;
  const raw = String(value).trim();
  return raw || null;
};

const extractMissingColumnName = (error) => {
  const source = `${String(error?.message || '')} ${String(error?.details || '')}`;
  const patterns = [
    /Could not find the '([^']+)' column/i,
    /column \"([^\"]+)\" does not exist/i,
    /column ([a-zA-Z0-9_.]+) does not exist/i
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) {
      const normalized = String(match[1])?.trim()?.replace(/^\"+|\"+$/g, '');
      const parts = normalized?.split('.') || [];
      return parts?.[parts?.length - 1] || normalized;
    }
  }

  return null;
};

const updateReservationWithSchemaFallback = async (reservationId, payload) => {
  if (!reservationId || !payload || typeof payload !== 'object') return null;

  const mutablePayload = { ...payload };
  let attempts = 0;

  while (attempts < 10) {
    const { error } = await supabase
      ?.from('reservations')
      ?.update(mutablePayload)
      ?.eq('id', reservationId)
      ?.in('status', ['pending', 'accepted']);

    if (!error) return null;

    const missingColumn = extractMissingColumnName(error);
    if (!missingColumn || !Object.prototype.hasOwnProperty.call(mutablePayload, missingColumn)) {
      return error;
    }

    delete mutablePayload[missingColumn];
    attempts += 1;
    console.warn(`[payment-processing] colonne absente ignoree dans reservations.update: ${missingColumn}`);
  }

  return { message: 'Impossible de mettre à jour la réservation (schéma incomplet).' };
};

const normalizeStateBookingData = (stateEquipment, stateBookingDetails) => {
  if (!stateEquipment || !stateBookingDetails) return null;

  return {
    equipment: stateEquipment,
    bookingDetails: {
      ...stateBookingDetails,
      startDate: toDateOrNull(stateBookingDetails?.startDate),
      endDate: toDateOrNull(stateBookingDetails?.endDate),
      insuranceSelected: false,
      insuranceAmount: 0,
      cautionMode: CAUTION_MODE_CB
    }
  };
};

const normalizeFromReservation = (reservation) => {
  if (!reservation) return null;

  const annoncePhotos = Array?.isArray(reservation?.annonce?.photos) ? reservation?.annonce?.photos : [];
  const resolvedPhotos = storageService?.getAnnoncePhotoUrls(annoncePhotos);
  const firstPhoto = resolvedPhotos?.[0] || annoncePhotos?.[0] || '/assets/images/no_image.png';

  const startDate = toDateOrNull(reservation?.start_date);
  const endDate = toDateOrNull(reservation?.end_date);
  const rentalDays = startDate && endDate
    ? computeRentalDays(startDate, endDate)
    : 0;

  const dailyPrice = Number(reservation?.annonce?.prix_jour ?? 0) || 0;
  const rentalAmountFromDaily = dailyPrice > 0 && rentalDays > 0
    ? dailyPrice * rentalDays
    : 0;
  const reservationTotalAmount = Number(reservation?.total_price ?? 0) || 0;
  const totalAmount = reservationTotalAmount > 0
    ? reservationTotalAmount
    : rentalAmountFromDaily;
  const equipmentTotal = rentalAmountFromDaily > 0
    ? rentalAmountFromDaily
    : totalAmount;
  const cautionAmount = Number(reservation?.annonce?.caution ?? reservation?.caution_amount ?? 0) || 0;
  const cautionMode = CAUTION_MODE_CB;

  return {
    equipment: {
      id: reservation?.annonce_id,
      title: reservation?.annonce?.titre || 'Annonce',
      category: reservation?.annonce?.categorie || reservation?.annonce?.category || '-',
      dailyPrice,
      cautionMode,
      images: [{ url: firstPhoto, alt: reservation?.annonce?.titre || 'Photo annonce' }],
      owner: {
        id: reservation?.owner_id || null,
        pseudonym: reservation?.owner?.pseudo || 'Propriétaire',
        avatar: reservation?.owner?.avatar_url || '/assets/images/no_image.png',
        avatarAlt: `Avatar de ${reservation?.owner?.pseudo || 'propriétaire'}`,
        rating: null,
        reviewCount: null
      },
      pickupTimeStart: reservation?.pickup_time_start || reservation?.annonce?.pickup_time_start || null,
      pickupTimeEnd: reservation?.pickup_time_end || reservation?.annonce?.pickup_time_end || null,
      returnTimeStart: reservation?.return_time_start || reservation?.annonce?.return_time_start || null,
      returnTimeEnd: reservation?.return_time_end || reservation?.annonce?.return_time_end || null
    },
    bookingDetails: {
      reservationId: reservation?.id,
      proposalId: normalizeOptionalIdentifier(reservation?.proposal_id),
      startDate,
      endDate,
      rentalDays,
      equipmentTotal,
      platformCommission: 0,
      totalAmount,
      insuranceSelected: false,
      insuranceAmount: 0,
      cautionAmount,
      cautionMode,
      ownerId: reservation?.owner_id || null,
      message: reservation?.message || '',
      pickupTimeStart: reservation?.pickup_time_start || reservation?.annonce?.pickup_time_start || null,
      pickupTimeEnd: reservation?.pickup_time_end || reservation?.annonce?.pickup_time_end || null,
      returnTimeStart: reservation?.return_time_start || reservation?.annonce?.return_time_start || null,
      returnTimeEnd: reservation?.return_time_end || reservation?.annonce?.return_time_end || null
    }
  };
};

const normalizeFromAnnonce = ({ annonce, startDate, endDate, proposalId = null }) => {
  if (!annonce) return null;

  const photoPaths = Array?.isArray(annonce?.photos)
    ? annonce?.photos
    : Array?.isArray(annonce?.images)
      ? annonce?.images
      : [];
  const resolvedPhotos = storageService?.getAnnoncePhotoUrls(photoPaths);
  const firstPhoto = resolvedPhotos?.[0] || photoPaths?.[0] || '/assets/images/no_image.png';

  const normalizedStartDate = startOfLocalDay(startDate) || startOfLocalDay(new Date());
  const normalizedEndDate = startOfLocalDay(endDate) || normalizedStartDate;
  const rentalDays = computeRentalDays(normalizedStartDate, normalizedEndDate);
  const dailyPrice = Number(annonce?.prix_jour ?? annonce?.dailyPrice ?? 0) || 0;
  const ownerId = annonce?.owner_id || annonce?.user_id || annonce?.owner?.id || annonce?.profiles?.id || null;
  const equipmentTotal = dailyPrice * rentalDays;
  const amounts = computeCheckoutAmounts({
    equipmentTotal,
    rentalDays,
    insuranceSelected: false
  });
  const cautionMode = CAUTION_MODE_CB;

  return {
    equipment: {
      id: annonce?.id,
      title: annonce?.titre || annonce?.title || 'Annonce',
      category: annonce?.categorie || annonce?.category || '-',
      dailyPrice,
      cautionMode,
      images: [{ url: firstPhoto, alt: annonce?.titre || annonce?.title || 'Photo annonce' }],
      owner: {
        id: ownerId,
        pseudonym: annonce?.owner?.pseudo || annonce?.profiles?.pseudo || 'Propriétaire',
        avatar: annonce?.owner?.avatar_url || annonce?.profiles?.avatar_url || '/assets/images/no_image.png',
        avatarAlt: `Avatar de ${annonce?.owner?.pseudo || annonce?.profiles?.pseudo || 'propriétaire'}`,
        rating: null,
        reviewCount: null
      },
      pickupTimeStart: annonce?.pickup_time_start || null,
      pickupTimeEnd: annonce?.pickup_time_end || null,
      returnTimeStart: annonce?.return_time_start || null,
      returnTimeEnd: annonce?.return_time_end || null
    },
    bookingDetails: {
      reservationId: null,
      proposalId: normalizeOptionalIdentifier(proposalId),
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      rentalDays,
      equipmentTotal,
      platformCommission: 0,
      totalAmount: amounts?.totalAmount,
      insuranceSelected: false,
      insuranceAmount: amounts?.insuranceAmount || 0,
      cautionAmount: Number(annonce?.caution ?? annonce?.cautionAmount ?? 0) || 0,
      cautionMode,
      ownerId,
      pickupTimeStart: annonce?.pickup_time_start || null,
      pickupTimeEnd: annonce?.pickup_time_end || null,
      returnTimeStart: annonce?.return_time_start || null,
      returnTimeEnd: annonce?.return_time_end || null
    }
  };
};

const savePendingPaymentContext = (pageData) => {
  if (typeof window === 'undefined' || !window?.sessionStorage || !pageData) return;

  try {
    window.sessionStorage.setItem(
      PENDING_PAYMENT_CONTEXT_STORAGE_KEY,
      JSON.stringify({
        pageData,
        savedAt: new Date().toISOString()
      })
    );
  } catch (error) {
    console.warn('Impossible de sauvegarder le contexte de paiement localement:', error);
  }
};

const loadPendingPaymentContext = () => {
  if (typeof window === 'undefined' || !window?.sessionStorage) return null;

  try {
    const raw = window.sessionStorage.getItem(PENDING_PAYMENT_CONTEXT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const pageData = normalizeStateBookingData(parsed?.pageData?.equipment, parsed?.pageData?.bookingDetails);
    return pageData || null;
  } catch (error) {
    console.warn('Impossible de relire le contexte de paiement local:', error);
    return null;
  }
};

const clearPendingPaymentContext = () => {
  if (typeof window === 'undefined' || !window?.sessionStorage) return;
  try {
    window.sessionStorage.removeItem(PENDING_PAYMENT_CONTEXT_STORAGE_KEY);
  } catch (error) {
    console.warn('Impossible de nettoyer le contexte de paiement local:', error);
  }
};

const buildFunctionUrl = (functionName) => {
  const supabaseUrl = String(import.meta.env?.VITE_SUPABASE_URL || '')?.trim()?.replace(/\/$/, '');
  if (!supabaseUrl || !functionName) return null;
  return `${supabaseUrl}/functions/v1/${functionName}`;
};

const buildCanonicalPaymentUrlIfNeeded = () => {
  if (typeof window === 'undefined') return null;
  const host = String(window.location?.hostname || '').toLowerCase();
  const params = new URLSearchParams(window.location?.search || '');
  if (params.get('ldv_verify') === '1') return null;
  if (host !== 'lematosduvoisin.fr') return null;
  const pathname = window.location?.pathname || '/traitement-paiement';
  const search = window.location?.search || '';
  const hash = window.location?.hash || '';
  return `https://www.lematosduvoisin.fr${pathname}${search}${hash}`;
};

const readResponsePayload = async (response) => {
  if (!response) return null;
  try {
    return await response.clone().json();
  } catch {
    try {
      const text = await response.clone().text();
      if (!text) return null;
      return { message: text };
    } catch {
      return null;
    }
  }
};

const getFreshAccessToken = async () => {
  const nowSec = Math.floor(Date.now() / 1000);
  const minTtlSec = 90;

  let session = null;
  if (supabase?.auth?.getSession) {
    const { data } = await supabase.auth.getSession();
    session = data?.session || null;
  }

  const currentToken = session?.access_token || null;
  const expiresAt = Number(session?.expires_at || 0) || 0;
  const shouldRefresh = !currentToken || !expiresAt || (expiresAt - nowSec) <= minTtlSec;

  if (!shouldRefresh) {
    return currentToken;
  }

  if (supabase?.auth?.refreshSession) {
    const { data: refreshedData } = await supabase.auth.refreshSession();
    const refreshedToken = refreshedData?.session?.access_token || null;
    if (refreshedToken) return refreshedToken;
  }

  return currentToken;
};

const invokeEdgeFunctionWithUserJwt = async (functionName, body, options = {}) => {
  const functionUrl = buildFunctionUrl(functionName);
  const supabaseAnonKey = String(import.meta.env?.VITE_SUPABASE_ANON_KEY || '')?.trim();

  if (!functionUrl || !supabaseAnonKey) {
    return {
      data: null,
      error: {
        message: 'Configuration Supabase Functions manquante (URL/anon key).',
        status: 500
      }
    };
  }

  const userAccessToken = options?.userAccessToken || await getFreshAccessToken();
  if (!userAccessToken) {
    return {
      data: null,
      error: {
        message: 'Session expirée. Veuillez vous reconnecter.',
        status: 401
      }
    };
  }

  let response = null;
  try {
    response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'x-ldv-user-jwt': userAccessToken
      },
      body: JSON.stringify(body || {})
    });
  } catch (networkError) {
    return {
      data: null,
      error: {
        message: networkError?.message || 'Impossible de joindre la fonction backend.',
        status: null
      }
    };
  }

  const payload = await readResponsePayload(response);
  if (!response?.ok) {
    return {
      data: null,
      error: {
        message: payload?.error || payload?.message || 'Edge Function returned a non-2xx status code',
        status: Number(response?.status || 0) || null
      }
    };
  }

  return {
    data: payload || {},
    error: null
  };
};

const PaymentProcessing = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const authRedirectTriggeredRef = useRef(false);
  const sessionGuardTriggeredRef = useRef(false);
  const checkoutSyncTriggeredRef = useRef(false);
  const identityRedirectTriggeredRef = useRef(false);

  const [loading, setLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState('');
  const [pageData, setPageData] = useState(null);
  const [acceptCGU, setAcceptCGU] = useState(false);
  const [checkoutSyncState, setCheckoutSyncState] = useState({
    status: 'idle',
    message: ''
  });
  const [lastSyncedReservationId, setLastSyncedReservationId] = useState(null);
  const stripeCheckoutEnabled = Boolean(import.meta.env?.VITE_STRIPE_PUBLISHABLE_KEY);

  const paymentQueryParams = useMemo(() => {
    const params = new URLSearchParams(location?.search || '');
    return {
      annonceId: params?.get('annonceId'),
      startDate: params?.get('startDate'),
      endDate: params?.get('endDate'),
      proposalId: params?.get('proposalId'),
      source: params?.get('from'),
      reservationId: params?.get('reservationId'),
      stripeStatus: params?.get('paymentStatus') || params?.get('stripeStatus'),
      stripeSessionId: params?.get('checkoutSessionId') || params?.get('session_id')
    };
  }, [location?.search]);

  const annonceIdFromQuery = paymentQueryParams?.annonceId;
  const startDateFromQuery = paymentQueryParams?.startDate;
  const endDateFromQuery = paymentQueryParams?.endDate;
  const proposalIdFromQuery = normalizeOptionalIdentifier(paymentQueryParams?.proposalId);
  const sourceFromQuery = paymentQueryParams?.source;
  const reservationIdFromQuery = paymentQueryParams?.reservationId;
  const stripeStatusFromQuery = paymentQueryParams?.stripeStatus;
  const stripeSessionIdFromQuery = paymentQueryParams?.stripeSessionId;
  const isVerificationPaymentScenario = isAdminVerificationScenario(
    'booking_payment_stripe',
    'owner_requester_proposals_to_payment'
  );
  const [verificationPaymentMessage, setVerificationPaymentMessage] = useState('');

  useEffect(() => {
    const canonicalUrl = buildCanonicalPaymentUrlIfNeeded();
    if (!canonicalUrl) return;
    window.location.replace(canonicalUrl);
  }, []);

  useEffect(() => {
    const canonicalUrl = buildCanonicalPaymentUrlIfNeeded();
    if (canonicalUrl) {
      window.location.replace(canonicalUrl);
      return;
    }

    if (authLoading) return;
    if (isAuthenticated) {
      authRedirectTriggeredRef.current = false;
      return;
    }
    if (authRedirectTriggeredRef.current) return;

    authRedirectTriggeredRef.current = true;
    const redirectAfterAuth = `${location?.pathname || '/traitement-paiement'}${location?.search || ''}${location?.hash || ''}`;
    storeAuthRedirectPath(redirectAfterAuth);
    toast?.error('Veuillez vous connecter pour accéder au paiement.');
    navigate('/authentification', {
      replace: true,
      state: { from: redirectAfterAuth }
    });
  }, [
    authLoading,
    isAuthenticated,
    location?.hash,
    location?.pathname,
    location?.search,
    navigate
  ]);

  useEffect(() => {
    const canonicalUrl = buildCanonicalPaymentUrlIfNeeded();
    if (canonicalUrl) return;
    if (authLoading || !isAuthenticated || !user?.id) return;
    if (sessionGuardTriggeredRef.current) return;

    sessionGuardTriggeredRef.current = true;
    let isMounted = true;

    const ensureUsableSession = async () => {
      const token = await getFreshAccessToken();
      if (!isMounted || token) return;

      const redirectAfterAuth = `${location?.pathname || '/traitement-paiement'}${location?.search || ''}${location?.hash || ''}`;
      storeAuthRedirectPath(redirectAfterAuth);
      toast?.error('Session expirée. Merci de vous reconnecter avant de payer.');
      navigate('/authentification', {
        replace: true,
        state: { from: redirectAfterAuth }
      });
    };

    ensureUsableSession();

    return () => {
      isMounted = false;
      sessionGuardTriggeredRef.current = false;
    };
  }, [
    authLoading,
    isAuthenticated,
    location?.hash,
    location?.pathname,
    location?.search,
    navigate,
    user?.id
  ]);

  useEffect(() => {
    let isMounted = true;
    if (authLoading || !isAuthenticated) {
      setContextLoading(authLoading);
      return () => {
        isMounted = false;
      };
    }

    const loadContext = async () => {
      try {
        setContextLoading(true);
        setContextError('');

        if (isVerificationPaymentScenario) {
          if (!isMounted) return;
          setPageData({
            equipment: {
              id: annonceIdFromQuery || 'verification-offer',
              title: 'Annonce de verification admin',
              category: 'Bricolage',
              dailyPrice: 19,
              cautionMode: CAUTION_MODE_CB,
              images: [{ url: '/assets/images/no_image.png', alt: 'Annonce de verification' }],
              owner: {
                id: 'verification-owner',
                pseudonym: 'atelier_verification',
                avatar: '/assets/images/no_image.png',
                avatarAlt: 'Avatar de verification'
              }
            },
            bookingDetails: {
              reservationId: reservationIdFromQuery || 'verification-reservation',
              proposalId: proposalIdFromQuery || 'verification-proposal',
              startDate: new Date('2026-04-02T12:00:00'),
              endDate: new Date('2026-04-03T12:00:00'),
              rentalDays: 2,
              equipmentTotal: 38,
              platformCommission: 0,
              totalAmount: 38,
              insuranceSelected: false,
              insuranceAmount: 0,
              cautionAmount: 250,
              cautionAuthorizedNow: 250,
              chargedAmount: 38,
              cautionMode: CAUTION_MODE_CB,
              ownerId: 'verification-owner'
            }
          });
          return;
        }

        const fromState = normalizeStateBookingData(location?.state?.equipment, location?.state?.bookingDetails);
        if (fromState) {
          if (!isMounted) return;
          setPageData(fromState);
          return;
        }

        const fromSessionStorage = loadPendingPaymentContext();
        const isPaymentReturn = Boolean(
          sourceFromQuery === 'payment'
          || stripeStatusFromQuery
          || (stripeSessionIdFromQuery && !stripeSessionIdFromQuery?.includes('{CHECKOUT_SESSION_ID}'))
        );

        if (isPaymentReturn && fromSessionStorage) {
          if (!isMounted) return;
          setPageData(fromSessionStorage);
          return;
        }

        if (reservationIdFromQuery) {
          const { data, error } = await reservationService?.getReservationById(reservationIdFromQuery);
          if (error) throw error;
          if (!data) {
            if (!isMounted) return;
            setPageData(null);
            setContextError('Réservation introuvable.');
            return;
          }

          if (user?.id && data?.renter_id && data?.renter_id !== user?.id) {
            if (!isMounted) return;
            setPageData(null);
            setContextError("Vous n'avez pas accès à cette réservation.");
            return;
          }

          if (!isMounted) return;
          setPageData(normalizeFromReservation(data));
          return;
        }

        if (annonceIdFromQuery) {
          const { data: annonce, error: annonceError } = await annonceService?.getAnnonceById(annonceIdFromQuery);
          if (annonceError) throw annonceError;
          if (!annonce) {
            if (!isMounted) return;
            setPageData(null);
            setContextError('Annonce introuvable.');
            return;
          }

          const queryStartDate = toDateOrNull(startDateFromQuery);
          const queryEndDate = toDateOrNull(endDateFromQuery);
          let startDate = queryStartDate;
          let endDate = queryEndDate;

          if (!startDate || !endDate) {
            const defaults = buildDefaultRentalWindow();
            startDate = defaults?.startDate;
            endDate = defaults?.endDate;
          }

          if (!isReservationStartDateAllowed(startDate)) {
            const minStartDate = getEarliestReservationStartDate();
            startDate = minStartDate;
            if (!endDate || endDate < minStartDate) {
              endDate = new Date(minStartDate);
            }
          }

          if (startDate && endDate && endDate < startDate) {
            endDate = new Date(startDate);
          }

          if (!isMounted) return;
          setPageData(normalizeFromAnnonce({
            annonce,
            startDate,
            endDate,
            proposalId: proposalIdFromQuery
          }));
          return;
        }

        if (fromSessionStorage) {
          if (!isMounted) return;
          setPageData(fromSessionStorage);
          return;
        }

        if (!isMounted) return;
        setPageData(null);
        setContextError('Aucune réservation à payer n\'a été trouvée.');
      } catch (error) {
        console.error('Erreur de chargement paiement:', error);
        if (!isMounted) return;
        setPageData(null);
        setContextError(error?.message || 'Impossible de charger cette page de paiement.');
      } finally {
        if (isMounted) setContextLoading(false);
      }
    };

    loadContext();

    return () => {
      isMounted = false;
    };
  }, [
    annonceIdFromQuery,
    authLoading,
    endDateFromQuery,
    isAuthenticated,
    isVerificationPaymentScenario,
    location?.state,
    proposalIdFromQuery,
    reservationIdFromQuery,
    sourceFromQuery,
    startDateFromQuery,
    stripeSessionIdFromQuery,
    stripeStatusFromQuery,
    user?.id
  ]);

  useEffect(() => {
    if (!stripeStatusFromQuery) return;

    if (stripeStatusFromQuery === 'success') {
      if (!reservationIdFromQuery || !stripeSessionIdFromQuery || stripeSessionIdFromQuery?.includes('{CHECKOUT_SESSION_ID}')) {
        toast?.success('Paiement confirmé.');
      }
      return;
    }

    if (stripeStatusFromQuery === 'cancel') {
      toast?.('Paiement annulé.');
    }
  }, [reservationIdFromQuery, stripeSessionIdFromQuery, stripeStatusFromQuery]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (stripeStatusFromQuery !== 'cancel') return;

    const cancellableReservationId = normalizeReservationId(reservationIdFromQuery);
    if (!cancellableReservationId) return;

    let isMounted = true;

    const cancelUnpaidReservationAndCleanUrl = async () => {
      const updateError = await updateReservationWithSchemaFallback(cancellableReservationId, {
        status: 'cancelled_tenant_no_payment',
        cancellation_reason: 'Paiement annulé',
        cancelled_at: new Date()?.toISOString(),
        updated_at: new Date()?.toISOString()
      });

      if (updateError) {
        console.warn("Impossible d'annuler automatiquement la réservation après retour paiement annulé:", updateError?.message || updateError);
        return;
      }

      if (!isMounted) return;
      setPageData((previous) => ({
        ...(previous || {}),
        bookingDetails: {
          ...(previous?.bookingDetails || {}),
          reservationId: null
        }
      }));

      const params = new URLSearchParams(location?.search || '');
      params?.delete('reservationId');
      const nextSearch = params?.toString();
      navigate(
        `${location?.pathname || '/traitement-paiement'}${nextSearch ? `?${nextSearch}` : ''}${location?.hash || ''}`,
        { replace: true }
      );
    };

    cancelUnpaidReservationAndCleanUrl();

    return () => {
      isMounted = false;
    };
  }, [
    authLoading,
    isAuthenticated,
    location?.hash,
    location?.pathname,
    location?.search,
    navigate,
    reservationIdFromQuery,
    stripeStatusFromQuery
  ]);

  const equipment = pageData?.equipment || null;
  const bookingDetails = pageData?.bookingDetails || null;
  const resolvedReservationIdForSync = normalizeReservationId(
    lastSyncedReservationId || reservationIdFromQuery || bookingDetails?.reservationId || null
  );

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (stripeStatusFromQuery !== 'success') return;
    if (!pageData) return;
    if (!stripeSessionIdFromQuery || stripeSessionIdFromQuery?.includes('{CHECKOUT_SESSION_ID}')) return;
    if (checkoutSyncTriggeredRef.current) return;

    checkoutSyncTriggeredRef.current = true;
    let isMounted = true;

    const syncStripeCheckout = async () => {
      try {
        setCheckoutSyncState({
          status: 'syncing',
          message: "Synchronisation du paiement de location et de l'empreinte CB en cours..."
        });

        const invokeResult = await invokeEdgeFunctionWithUserJwt('manage-reservation-deposit-strategy-b', {
          action: 'sync_checkout',
          ...(resolvedReservationIdForSync ? { reservationId: resolvedReservationIdForSync } : {}),
          sessionId: stripeSessionIdFromQuery
        });

        const { data, error } = invokeResult || {};
        if (error) {
          const normalizedStatus = Number(error?.status || 0) || null;
          const normalizedMessage = String(error?.message || '').toLowerCase();

          if (
            normalizedStatus === 401
            || normalizedMessage?.includes('invalid jwt')
            || normalizedMessage?.includes('authentification')
          ) {
            const redirectAfterAuth = `${location?.pathname || '/traitement-paiement'}${location?.search || ''}${location?.hash || ''}`;
            storeAuthRedirectPath(redirectAfterAuth);
            toast?.error('Session expiree. Merci de vous reconnecter pour finaliser la reservation.');
            navigate('/authentification', {
              replace: true,
              state: { from: redirectAfterAuth }
            });
            return;
          }

          throw new Error(
            normalizedStatus
              ? `${error?.message} (HTTP ${normalizedStatus})`
              : (error?.message || "Paiement confirmé, mais votre réservation n'a pas encore pu être mise à jour.")
          );
        }

        const syncedReservationId = normalizeReservationId(data?.reservationId);
        if (!syncedReservationId) {
          throw new Error("Paiement confirmé, mais la réservation créée côté serveur est introuvable.");
        }

        if (isMounted) {
          setLastSyncedReservationId(syncedReservationId);
          setPageData((previous) => ({
            ...(previous || {}),
            bookingDetails: {
              ...(previous?.bookingDetails || {}),
              reservationId: syncedReservationId
            }
          }));
        }

        const strategyStatus = String(data?.strategyStatus || '').toLowerCase();
        let message = 'Paiement confirmé et synchronisé.';

        if (strategyStatus === 'authorized') {
          message = 'Paiement confirmé. Empreinte CB autorisée (non débitée) et active pour la caution.';
        } else if (strategyStatus === 'captured') {
          message = 'Paiement confirmé. Caution capturée suite à décision de litige.';
        } else if (strategyStatus === 'released') {
          message = 'Paiement confirmé. Empreinte CB libérée.';
        } else if (strategyStatus === 'failed') {
          message = "Paiement confirmé. Synchronisation de l\'empreinte CB en échec, intervention requise.";
        } else if (strategyStatus === 'not_required') {
          message = 'Paiement confirmé. Aucune caution requise sur cette réservation.';
        }

        if (isMounted) {
          setCheckoutSyncState({
            status: strategyStatus || 'synced',
            message
          });
        }

        toast?.success(message);
      } catch (syncError) {
        console.error('Erreur confirmation paiement/caution:', syncError);
        const rawErrorMessage = String(syncError?.message || '').trim();
        const errorMessage = /stripe|paymentintent|checkout session|session stripe|charge stripe/i.test(rawErrorMessage)
          ? 'Paiement confirmé, mais la confirmation de votre réservation prend plus de temps que prévu. Notre équipe peut intervenir si besoin.'
          : (rawErrorMessage || "Paiement confirmé, mais votre réservation n'a pas encore pu être mise à jour.");

        if (isMounted) {
          setCheckoutSyncState({
            status: 'error',
            message: errorMessage
          });
        }

        toast?.error(errorMessage);
      }
    };

    syncStripeCheckout();

    return () => {
      isMounted = false;
    };
  }, [
    authLoading,
    isAuthenticated,
    location?.hash,
    location?.pathname,
    location?.search,
    navigate,
    pageData,
    resolvedReservationIdForSync,
    stripeSessionIdFromQuery,
    stripeStatusFromQuery
  ]);

  useEffect(() => {
    if (!stripeStatusFromQuery || !pageData) return;
    const checkoutSyncStatus = String(checkoutSyncState?.status || '')?.toLowerCase();
    const checkoutSyncCompleted = ['authorized', 'captured', 'released', 'not_required', 'synced']?.includes(checkoutSyncStatus);
    if (stripeStatusFromQuery === 'cancel') {
      clearPendingPaymentContext();
      return;
    }
    if (stripeStatusFromQuery === 'success' && checkoutSyncCompleted) {
      clearPendingPaymentContext();
    }
  }, [checkoutSyncState?.status, pageData, stripeStatusFromQuery]);

  useEffect(() => {
    if (!bookingDetails) return;
    setAcceptCGU(false);
  }, [
    bookingDetails?.equipmentTotal,
    bookingDetails?.rentalDays,
    bookingDetails?.reservationId
  ]);

  const computedBookingDetails = useMemo(() => {
    if (!bookingDetails) return null;

    const rentalDays = Number(
      bookingDetails?.rentalDays
      || computeRentalDays(bookingDetails?.startDate, bookingDetails?.endDate)
      || 0
    );
    const equipmentTotalFromDates = Number(equipment?.dailyPrice || 0) * rentalDays;
    const equipmentTotal = Number(
      bookingDetails?.equipmentTotal
      || equipmentTotalFromDates
      || 0
    );
    const cautionMode = CAUTION_MODE_CB;
    const insuranceAmount = 0;
    const cautionAuthorizedNow = Number(bookingDetails?.cautionAmount || 0) || 0;
    const totalAmount = Math.max(0, equipmentTotal);
    const chargedAmount = totalAmount;

    return {
      ...bookingDetails,
      rentalDays,
      equipmentTotal,
      insuranceSelected: false,
      insuranceAmount,
      cautionMode,
      cautionAuthorizedNow,
      totalAmount,
      chargedAmount
    };
  }, [bookingDetails, equipment?.dailyPrice]);
  const pickupWindow = formatTimeRange(
    computedBookingDetails?.pickupTimeStart || equipment?.pickupTimeStart,
    computedBookingDetails?.pickupTimeEnd || equipment?.pickupTimeEnd
  );
  const returnWindow = formatTimeRange(
    computedBookingDetails?.returnTimeStart || equipment?.returnTimeStart,
    computedBookingDetails?.returnTimeEnd || equipment?.returnTimeEnd
  );
  const checkoutSyncStatus = String(checkoutSyncState?.status || '')?.toLowerCase();
  const stripeSessionReadyForSync = Boolean(
    stripeSessionIdFromQuery && !stripeSessionIdFromQuery?.includes('{CHECKOUT_SESSION_ID}')
  );
  const checkoutSyncCompleted = ['authorized', 'captured', 'released', 'not_required', 'synced']?.includes(checkoutSyncStatus);
  const stripePaymentAlreadyConfirmed = stripeStatusFromQuery === 'success' && checkoutSyncCompleted;
  const hasStripeSuccess = stripeStatusFromQuery === 'success';
  const identityTransitionReservationId = normalizeReservationId(
    lastSyncedReservationId || resolvedReservationIdForSync || computedBookingDetails?.reservationId || null
  );

  const redirectToIdentityVerification = useCallback((reason = 'payment') => {
    if (!identityTransitionReservationId) return false;
    if (hasStripeSuccess && !stripePaymentAlreadyConfirmed && !stripeSessionReadyForSync) {
      return false;
    }
    identityRedirectTriggeredRef.current = true;

    const transitionParams = new URLSearchParams();
    transitionParams.set('from', reason);
    transitionParams.set('reservationId', identityTransitionReservationId);
    if (hasStripeSuccess) {
      transitionParams.set('paymentStatus', 'success');
      if (stripeSessionReadyForSync) {
        transitionParams.set('checkoutSessionId', stripeSessionIdFromQuery);
      }
    }

    clearPendingPaymentContext();
    navigate(`/verification-identite-location?${transitionParams.toString()}`, {
      replace: true,
      state: {
        paymentSuccess: true,
        reservationId: identityTransitionReservationId
      }
    });
    return true;
  }, [
    hasStripeSuccess,
    identityTransitionReservationId,
    navigate,
    stripePaymentAlreadyConfirmed,
    stripeSessionIdFromQuery,
    stripeSessionReadyForSync
  ]);

  useEffect(() => {
    if (stripeStatusFromQuery !== 'success') return;
    if (!identityTransitionReservationId) return;
    if (identityRedirectTriggeredRef.current) return;
    if (!stripePaymentAlreadyConfirmed) return;

    redirectToIdentityVerification('payment');
  }, [
    identityTransitionReservationId,
    redirectToIdentityVerification,
    stripePaymentAlreadyConfirmed,
    stripeStatusFromQuery
  ]);

  useEffect(() => {
    if (!hasStripeSuccess) return;
    if (identityTransitionReservationId) return;

    const timer = window.setTimeout(() => {
      navigate('/mes-reservations', {
        replace: true,
        state: { paymentSuccess: true, paymentFinalizing: true }
      });
    }, 4500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [hasStripeSuccess, identityTransitionReservationId, navigate]);

  const handleCGUChange = (event) => {
    setAcceptCGU(Boolean(event?.target?.checked));
  };

  const handlePayment = async () => {
    if (isVerificationPaymentScenario) {
      if (!acceptCGU) {
        toast?.error("Veuillez accepter les conditions générales d'utilisation.");
        return;
      }

      setVerificationPaymentMessage('Paiement Stripe de vérification confirmé. Empreinte CB enregistrée.');
      return;
    }

    if (!user?.id) {
      const redirectAfterAuth = `${location?.pathname || '/traitement-paiement'}${location?.search || ''}${location?.hash || ''}`;
      storeAuthRedirectPath(redirectAfterAuth);
      toast?.error('Veuillez vous connecter pour continuer le paiement.');
      navigate('/authentification', {
        state: { from: redirectAfterAuth }
      });
      return;
    }

    if (!equipment || !computedBookingDetails) {
      toast?.error('Contexte de paiement introuvable.');
      return;
    }

    if (!isReservationStartDateAllowed(computedBookingDetails?.startDate)) {
      toast?.error(SAME_DAY_RESERVATION_BLOCKED_MESSAGE);
      return;
    }

    if (!stripeCheckoutEnabled) {
      toast?.error("Le paiement n'est pas disponible pour le moment.");
      return;
    }

    if (!acceptCGU) {
      toast?.error("Vous devez accepter les conditions générales d'utilisation.");
      return;
    }

    setLoading(true);

    try {
      const preflightToken = await getFreshAccessToken();
      if (!preflightToken) {
        const canonicalUrl = buildCanonicalPaymentUrlIfNeeded();
        if (canonicalUrl) {
          window.location.replace(canonicalUrl);
          return;
        }

        const redirectAfterAuth = `${location?.pathname || '/traitement-paiement'}${location?.search || ''}${location?.hash || ''}`;
        storeAuthRedirectPath(redirectAfterAuth);
        toast?.error('Session expirée. Merci de vous reconnecter avant de payer.');
        navigate('/authentification', {
          state: { from: redirectAfterAuth }
        });
        return;
      }

      savePendingPaymentContext({ equipment, bookingDetails: computedBookingDetails });
      const existingReservationId = normalizeReservationId(
        computedBookingDetails?.reservationId || reservationIdFromQuery || null
      );

      const cancelReturnParams = new URLSearchParams();
      const successReturnParams = new URLSearchParams();
      if (equipment?.id != null) {
        successReturnParams.set('annonceId', String(equipment?.id));
        cancelReturnParams.set('annonceId', String(equipment?.id));
      }
      const returnStartDate = toReservationDateOnly(computedBookingDetails?.startDate);
      const returnEndDate = toReservationDateOnly(computedBookingDetails?.endDate);
      if (returnStartDate) {
        successReturnParams.set('startDate', returnStartDate);
        cancelReturnParams.set('startDate', returnStartDate);
      }
      if (returnEndDate) {
        successReturnParams.set('endDate', returnEndDate);
        cancelReturnParams.set('endDate', returnEndDate);
      }
      if (computedBookingDetails?.proposalId) {
        successReturnParams.set('proposalId', String(computedBookingDetails?.proposalId));
        cancelReturnParams.set('proposalId', String(computedBookingDetails?.proposalId));
      }
      successReturnParams.set('from', 'payment');
      const successReturnBaseUrl = buildAppRedirectUrl(
        `/traitement-paiement?${successReturnParams.toString()}`
      );
      const cancelReturnBaseUrl = buildAppRedirectUrl(
        `/traitement-paiement?${cancelReturnParams.toString()}`
      );

      const requestBody = {
        ...(existingReservationId ? { reservationId: existingReservationId } : {}),
        returnBaseUrl: successReturnBaseUrl,
        cancelReturnBaseUrl,
        equipment: {
          id: equipment?.id || null,
          title: equipment?.title || 'Reservation',
          dailyPrice: Number(equipment?.dailyPrice || 0) || 0
        },
        bookingDetails: {
          proposalId: computedBookingDetails?.proposalId || null,
          startDate: toReservationDateOnly(computedBookingDetails?.startDate),
          endDate: toReservationDateOnly(computedBookingDetails?.endDate),
          rentalDays: Number(computedBookingDetails?.rentalDays || 0) || 0,
          insuranceSelected: false,
          insuranceAmount: 0,
          totalAmount: Number(computedBookingDetails?.totalAmount || 0) || 0,
          cautionAmount: Number(computedBookingDetails?.cautionAmount || 0) || 0,
          cautionMode: CAUTION_MODE_CB,
          ownerId: computedBookingDetails?.ownerId || equipment?.owner?.id || null,
          pickupTimeStart: computedBookingDetails?.pickupTimeStart || equipment?.pickupTimeStart || null,
          pickupTimeEnd: computedBookingDetails?.pickupTimeEnd || equipment?.pickupTimeEnd || null,
          returnTimeStart: computedBookingDetails?.returnTimeStart || equipment?.returnTimeStart || null,
          returnTimeEnd: computedBookingDetails?.returnTimeEnd || equipment?.returnTimeEnd || null,
          message: computedBookingDetails?.message || ''
        }
      };

      const invokeResult = await invokeEdgeFunctionWithUserJwt('create-stripe-checkout-session', requestBody, {
        userAccessToken: preflightToken
      });

      const { data, error } = invokeResult || {};
      if (error) {
        const normalizedStatus = Number(error?.status || 0) || null;
        const normalizedMessage = String(error?.message || '').toLowerCase();

        if (
          normalizedStatus === 401
          || normalizedMessage?.includes('invalid jwt')
          || normalizedMessage?.includes('authentification')
        ) {
          const canonicalUrl = buildCanonicalPaymentUrlIfNeeded();
          if (canonicalUrl) {
            window.location.replace(canonicalUrl);
            return;
          }

          const redirectAfterAuth = `${location?.pathname || '/traitement-paiement'}${location?.search || ''}${location?.hash || ''}`;
          storeAuthRedirectPath(redirectAfterAuth);
          toast?.error('Session expirée. Merci de vous reconnecter avant de payer.');
          navigate('/authentification', {
            state: { from: redirectAfterAuth }
          });
          return;
        }

        throw new Error(
          normalizedStatus
            ? `${error?.message} (HTTP ${normalizedStatus})`
            : (error?.message || "Impossible de lancer le paiement.")
        );
      }

      const preparedReservationId = normalizeReservationId(data?.reservationId || existingReservationId);
      if (preparedReservationId) {
        setPageData((previous) => ({
          ...(previous || {}),
          bookingDetails: {
            ...(previous?.bookingDetails || {}),
            reservationId: preparedReservationId
          }
        }));
        savePendingPaymentContext({
          equipment,
          bookingDetails: {
            ...(computedBookingDetails || {}),
            reservationId: preparedReservationId
          }
        });
      }

      if (!data?.url) {
        throw new Error("Session de paiement créée sans URL de redirection.");
      }

      await redirectToExternalUrl(data.url);
      return;
    } catch (error) {
      console.error('Erreur lancement paiement:', error);
      toast?.error(error?.message || "Impossible de lancer le paiement.");
    } finally {
      setLoading(false);
    }
  };

  if (contextLoading) {
    return (
      <ActionPageShell
        maxWidth="max-w-5xl"
        hero={(
          <ActionHero
            eyebrow="Paiement"
            title="Vous confirmez votre réservation"
            subtitle="Le récapitulatif arrive ici avant le paiement."
            tone="sky"
          />
        )}
      >
        <ActionCard className="p-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Icon name="Loader2" size={20} className="animate-spin" />
            <span>Chargement du récapitulatif de paiement...</span>
          </div>
        </ActionCard>
      </ActionPageShell>
    );
  }

  if (!equipment || !computedBookingDetails) {
    return (
      <ActionPageShell
        maxWidth="max-w-5xl"
        hero={(
          <ActionHero
            eyebrow="Paiement"
            title="Impossible d'afficher le récapitulatif"
            subtitle="Le parcours a perdu son contexte. Revenez à la réservation pour repartir proprement."
            tone="warm"
          />
        )}
      >
        <ActionCard className="space-y-4 p-6">
          <div className="flex items-start gap-3 text-destructive">
            <Icon name="AlertCircle" size={20} className="mt-0.5" />
            <div>
              <p className="font-medium">{contextError || 'Impossible de préparer le paiement.'}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Revenez à la réservation puis relancez le parcours.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate('/accueil-recherche')}>
            Retour à la recherche
          </Button>
        </ActionCard>
      </ActionPageShell>
    );
  }

  return (
    <ActionPageShell
      maxWidth="max-w-6xl"
      hero={(
        <ActionHero
          eyebrow="Paiement"
          title="Verifiez le montant avant paiement"
          subtitle="Confirmez le recapitulatif puis lancez le paiement securise."
          pills={[
            { label: 'Recapitulatif', icon: 'ReceiptText' },
            { label: 'Conditions', icon: 'BadgeCheck' },
            { label: 'Paiement', icon: 'CreditCard' }
          ]}
          tone="sky"
        />
      )}
    >
      <div className="space-y-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-950"
        >
          <Icon name="ArrowLeft" size={18} />
          <span>Retour</span>
        </button>

          {isVerificationPaymentScenario ? (
            <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-start gap-3">
                <Icon name="ShieldCheck" size={20} className="mt-0.5 text-success" />
                <div>
                  <p className="font-medium text-foreground">Mode de vérification admin</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ce contexte valide le récapitulatif, le montant débité et l’empreinte CB de manière déterministe.
                  </p>
                  {verificationPaymentMessage ? (
                    <p className="mt-2 text-sm font-medium text-success" data-testid="verification-payment-status">
                      {verificationPaymentMessage}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {stripeStatusFromQuery === 'success' && (
            <div className="bg-success/10 border border-success/20 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <Icon name="CheckCircle" size={20} className="text-success flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground mb-1">Paiement confirmé</p>
                  <p className="text-sm text-muted-foreground">
                    {checkoutSyncState?.message || 'Votre reservation se finalise...'}
                  </p>
                  {stripePaymentAlreadyConfirmed && (
                    <p className="text-sm text-foreground mt-1">
                      Redirection vers la vérification d'identité...
                    </p>
                  )}
                  {stripeStatusFromQuery === 'success' && identityTransitionReservationId && (stripePaymentAlreadyConfirmed || stripeSessionReadyForSync) && (
                    <div className="mt-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => redirectToIdentityVerification('payment_manual')}
                      >
                        Continuer vers la vérification d'identité
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {stripeStatusFromQuery === 'cancel' && (
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <Icon name="AlertTriangle" size={20} className="text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground mb-1">Paiement annulé</p>
                  <p className="text-sm text-muted-foreground">
                    Vous pouvez relancer le paiement quand vous voulez.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:gap-5">
            <div className="space-y-4">
              <div className="bg-white rounded-lg shadow-elevation-2 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Icon name="FileText" size={24} className="text-primary" />
                  <h2 className="text-lg font-heading text-foreground">
                    Récapitulatif de la réservation
                  </h2>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                  <div className="flex gap-4">
                    <img
                      src={equipment?.images?.[0]?.url || '/assets/images/no_image.png'}
                      alt={equipment?.images?.[0]?.alt || 'Photo annonce'}
                      className="w-36 h-36 md:w-40 md:h-40 object-cover rounded-md"
                    />
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-foreground">{equipment?.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{equipment?.category}</p>
                      <p className="text-sm font-medium text-primary mt-2">
                        {Number(equipment?.dailyPrice || 0)?.toFixed(2)} EUR / jour
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs md:text-sm">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                          <Icon name="Calendar" size={16} className="text-primary" />
                          <span>Période de location</span>
                        </div>
                        <div className="mt-1 space-y-0.5 text-muted-foreground">
                          <p>
                            Du {computedBookingDetails?.startDate ? format(computedBookingDetails?.startDate, 'dd MMMM yyyy', { locale: fr }) : '-'}
                          </p>
                          <p>
                            Au {computedBookingDetails?.endDate ? format(computedBookingDetails?.endDate, 'dd MMMM yyyy', { locale: fr }) : '-'}
                          </p>
                          <p className="text-foreground font-medium">
                            {computedBookingDetails?.rentalDays || 0} jour{(computedBookingDetails?.rentalDays || 0) > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-foreground font-semibold text-xs">Horaires</p>
                        <div className="mt-1 space-y-0.5 text-muted-foreground">
                          {pickupWindow && <p>Prise: {pickupWindow}</p>}
                          {returnWindow && <p>Restitution: {returnWindow}</p>}
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-foreground font-semibold text-xs">Propriétaire</p>
                      <div className="mt-1 flex items-center gap-2">
                        <img
                          src={equipment?.owner?.avatar || '/assets/images/no_image.png'}
                          alt={equipment?.owner?.avatarAlt || 'Avatar propriétaire'}
                          className="w-7 h-7 rounded-full object-cover"
                        />
                        <span className="text-foreground font-medium">{equipment?.owner?.pseudonym || 'Propriétaire'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-elevation-2 p-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-3 sm:grid-cols-2 items-stretch">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#0f7081]">
                        Débité aujourd'hui
                      </p>
                      <p className="mt-2 text-base font-semibold text-foreground">
                        {Number(computedBookingDetails?.chargedAmount || 0)?.toFixed(2)} EUR
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Débité aujourd'hui, puis crédité au propriétaire après la fin de la location.
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                        Autorisé en garantie
                      </p>
                      <p className="mt-2 text-base font-semibold text-foreground">
                        {Number(computedBookingDetails?.cautionAuthorizedNow || computedBookingDetails?.cautionAmount || 0)?.toFixed(2)} EUR
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Empreinte CB non prélevée.
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-600">
                    Votre banque peut afficher l'empreinte comme montant bloqué ou opération en attente. Aucune capture sans litige valide.
                    Le montant débité est versé au propriétaire uniquement une fois la location terminée.
                  </div>
                </div>
  
                <div className="hidden space-y-4">
                  <div className="p-3 rounded-md border border-primary/20 bg-primary/5 text-sm text-muted-foreground">
                    Mode unique appliqué sur la plateforme : <strong>{getCautionModeLabel(CAUTION_MODE_CB)}</strong>.
                  </div>

                  <div className="p-3 rounded-md border border-warning/20 bg-warning/10">
                    <p className="text-sm font-medium text-foreground">
                      Empreinte CB (garantie)
                    </p>
                    <p className="text-lg font-semibold text-foreground mt-1">
                      {Number(computedBookingDetails?.cautionAmount || 0)?.toLocaleString('fr-FR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}{' '}EUR
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      L'empreinte CB est une autorisation bancaire de garantie : elle n'est pas débitée lors du paiement de la location.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Selon la banque, elle peut toutefois apparaître temporairement comme un montant bloqué ou une
                      opération en attente, sans prélèvement effectif, jusqu'à sa libération.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Après paiement, une vérification de pièce d'identité est requise avant remise du matériel.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Si aucune pièce n'est déposée à temps, la réservation peut être annulée, 1 jour conservé et le reste remboursé.
                    </p>
                    <p className="text-xs font-medium text-foreground mt-2">
                      {`Montant location en CB: ${Number(computedBookingDetails?.totalAmount || 0)?.toFixed(2)} EUR`}
                    </p>
                    <p className="text-xs font-medium text-foreground mt-1">
                      {`Montant caution en empreinte CB : ${Number(computedBookingDetails?.cautionAuthorizedNow || 0)?.toFixed(2)} EUR (autorisation uniquement, sans prélèvement)`}
                    </p>
                    <p className="text-xs font-medium text-foreground mt-1">
                      {`Total débité aujourd'hui en CB : ${Number(computedBookingDetails?.chargedAmount || 0)?.toFixed(2)} EUR (location uniquement)`}
                    </p>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-border bg-white p-3">
                  {hasStripeSuccess ? (
                    <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Paiement déjà confirmé. Vous pouvez continuer sans repasser par ce bouton.
                    </p>
                    <Button
                      type="button"
                      size="lg"
                      fullWidth
                      variant="outline"
                      onClick={() => navigate('/mes-reservations')}
                    >
                      Aller à Mes réservations
                    </Button>
                    {identityTransitionReservationId && (
                      <Button
                        type="button"
                        size="lg"
                        fullWidth
                        onClick={() => redirectToIdentityVerification('payment_manual')}
                      >
                        Continuer vers la vérification d'identité
                      </Button>
                    )}
                  </div>
                  ) : (
                  <div className="space-y-3">
                    <div>
                      <Checkbox
                        id="cgu"
                        checked={acceptCGU}
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
                      />
                    </div>

                    <div className="border-t border-border pt-3 space-y-3">
                      {stripeCheckoutEnabled ? (
                        <Button
                          type="button"
                          size="md"
                          fullWidth
                          loading={loading}
                          disabled={!acceptCGU || stripePaymentAlreadyConfirmed}
                          onClick={handlePayment}
                          className="bg-success hover:bg-success/90 text-success-foreground"
                        >
                          <Icon name={stripePaymentAlreadyConfirmed ? "CheckCircle2" : "Lock"} size={20} className="mr-2" />
                          {stripePaymentAlreadyConfirmed
                            ? 'Paiement déjà confirmé'
                            : `Payer la location en CB (test) ${Number(computedBookingDetails?.chargedAmount || 0)?.toFixed(2)} EUR`}
                        </Button>
                      ) : (
                        <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-md">
                          <Icon name="AlertTriangle" size={18} className="text-warning flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-medium text-foreground">Paiement indisponible</p>
                            <p className="text-muted-foreground mt-1">
                              Le paiement n'est pas disponible pour le moment.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ActionPageShell>
  );
};

export default PaymentProcessing;





