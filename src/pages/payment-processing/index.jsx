import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Button from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import Icon from '../../components/AppIcon';
import CostBreakdown from './components/CostBreakdown';
import annonceService from '../../services/annonceService';
import reservationService from '../../services/reservationService';
import storageService from '../../services/storageService';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { storeAuthRedirectPath } from '../../utils/authRedirect';
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

  return { message: 'Impossible de mettre a jour la reservation (schema incomplet).' };
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

const normalizeFromAnnonce = ({ annonce, startDate, endDate }) => {
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
      reservationId: params?.get('reservationId'),
      stripeStatus: params?.get('stripeStatus'),
      stripeSessionId: params?.get('session_id')
    };
  }, [location?.search]);

  const annonceIdFromQuery = paymentQueryParams?.annonceId;
  const startDateFromQuery = paymentQueryParams?.startDate;
  const endDateFromQuery = paymentQueryParams?.endDate;
  const reservationIdFromQuery = paymentQueryParams?.reservationId;
  const stripeStatusFromQuery = paymentQueryParams?.stripeStatus;
  const stripeSessionIdFromQuery = paymentQueryParams?.stripeSessionId;

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

        const fromState = normalizeStateBookingData(location?.state?.equipment, location?.state?.bookingDetails);
        if (fromState) {
          if (!isMounted) return;
          setPageData(fromState);
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
          setPageData(normalizeFromAnnonce({ annonce, startDate, endDate }));
          return;
        }

        const fromSessionStorage = loadPendingPaymentContext();
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
    location?.state,
    reservationIdFromQuery,
    startDateFromQuery,
    user?.id
  ]);

  useEffect(() => {
    if (!stripeStatusFromQuery) return;

    if (stripeStatusFromQuery === 'success') {
      if (!reservationIdFromQuery || !stripeSessionIdFromQuery || stripeSessionIdFromQuery?.includes('{CHECKOUT_SESSION_ID}')) {
        toast?.success('Paiement Stripe terminé.');
      }
      return;
    }

    if (stripeStatusFromQuery === 'cancel') {
      toast?.('Paiement annulé sur Stripe.');
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
        cancellation_reason: 'Paiement annulé sur Stripe',
        cancelled_at: new Date()?.toISOString(),
        updated_at: new Date()?.toISOString()
      });

      if (updateError) {
        console.warn('Impossible d\'annuler automatiquement la réservation après retour Stripe cancel:', updateError?.message || updateError);
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

        const ensuredReservationId = await ensureReservationId();
        const safeReservationId = normalizeReservationId(ensuredReservationId);
        if (!safeReservationId) {
          throw new Error('Paiement confirmé, mais la réservation locale est introuvable.');
        }
        if (isMounted) {
          setLastSyncedReservationId(safeReservationId);
        }

        const invokeResult = await invokeEdgeFunctionWithUserJwt('manage-reservation-deposit-strategy-b', {
          action: 'sync_checkout',
          reservationId: safeReservationId,
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
              : (error?.message || 'Paiement termine, mais la synchronisation backend a echoue.')
          );
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
        console.error('Erreur sync checkout/caution:', syncError);
        const errorMessage = syncError?.message || 'Paiement termine, mais la synchronisation backend a echoue.';

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

  const equipment = pageData?.equipment || null;
  const bookingDetails = pageData?.bookingDetails || null;

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
  const checkoutSyncCompleted = ['authorized', 'captured', 'released', 'not_required', 'synced']?.includes(checkoutSyncStatus);
  const stripePaymentAlreadyConfirmed = stripeStatusFromQuery === 'success' && checkoutSyncCompleted;
  const identityTransitionReservationId = normalizeReservationId(
    lastSyncedReservationId || reservationIdFromQuery || computedBookingDetails?.reservationId || null
  );

  const redirectToIdentityVerification = useCallback((reason = 'payment') => {
    if (!identityTransitionReservationId) return false;
    identityRedirectTriggeredRef.current = true;

    const transitionParams = new URLSearchParams();
    transitionParams.set('from', reason);
    transitionParams.set('reservationId', identityTransitionReservationId);

    clearPendingPaymentContext();
    navigate(`/verification-identite-location?${transitionParams.toString()}`, {
      replace: true,
      state: {
        paymentSuccess: true,
        reservationId: identityTransitionReservationId
      }
    });
    return true;
  }, [identityTransitionReservationId, navigate]);

  useEffect(() => {
    if (stripeStatusFromQuery !== 'success') return;
    if (!identityTransitionReservationId) return;
    if (identityRedirectTriggeredRef.current) return;

    const redirectReason = stripePaymentAlreadyConfirmed ? 'payment' : 'payment_fallback';
    redirectToIdentityVerification(redirectReason);
  }, [
    identityTransitionReservationId,
    redirectToIdentityVerification,
    stripePaymentAlreadyConfirmed,
    stripeStatusFromQuery
  ]);

  const handleCGUChange = (event) => {
    setAcceptCGU(Boolean(event?.target?.checked));
  };

  const ensureReservationId = async () => {
    const normalizedCurrentUserId = String(user?.id || '')?.trim();
    const normalizedOwnerId = String(computedBookingDetails?.ownerId || equipment?.owner?.id || '')?.trim();
    if (normalizedCurrentUserId && normalizedOwnerId && normalizedCurrentUserId === normalizedOwnerId) {
      throw new Error('Vous ne pouvez pas louer votre propre annonce.');
    }

    if (!isReservationStartDateAllowed(computedBookingDetails?.startDate)) {
      throw new Error(SAME_DAY_RESERVATION_BLOCKED_MESSAGE);
    }

    const existingReservationId = normalizeReservationId(
      computedBookingDetails?.reservationId || reservationIdFromQuery || null
    );
    if (existingReservationId) {
      const normalizedTotalPrice = Math.max(0, Number(computedBookingDetails?.totalAmount || 0) || 0);
      const normalizedCautionAmount = Math.max(0, Number(computedBookingDetails?.cautionAmount || 0) || 0);
      if (normalizedTotalPrice > 0) {
        const updateError = await updateReservationWithSchemaFallback(existingReservationId, {
          total_price: normalizedTotalPrice,
          insurance_selected: false,
          insurance_amount: 0,
          caution_amount: normalizedCautionAmount,
          caution_mode: CAUTION_MODE_CB,
          pickup_time_start: computedBookingDetails?.pickupTimeStart || equipment?.pickupTimeStart || null,
          pickup_time_end: computedBookingDetails?.pickupTimeEnd || equipment?.pickupTimeEnd || null,
          return_time_start: computedBookingDetails?.returnTimeStart || equipment?.returnTimeStart || null,
          return_time_end: computedBookingDetails?.returnTimeEnd || equipment?.returnTimeEnd || null,
          deposit_status: 'pending',
          updated_at: new Date()?.toISOString()
        });

        if (updateError) {
          console.warn('Impossible de réaligner total_price avant paiement:', updateError?.message || updateError);
        }
      }
      return existingReservationId;
    }

    const ownerId = computedBookingDetails?.ownerId || equipment?.owner?.id || null;
    if (!ownerId) {
      throw new Error("Impossible d'identifier le propriétaire pour creer la reservation.");
    }

    const { data: createdReservation, error: reservationError } = await reservationService?.createReservation({
      annonce_id: equipment?.id,
      owner_id: ownerId,
      start_date: toReservationDateOnly(computedBookingDetails?.startDate),
      end_date: toReservationDateOnly(computedBookingDetails?.endDate),
      total_price: Number(computedBookingDetails?.totalAmount || 0),
      insurance_selected: false,
      insurance_amount: 0,
      caution_amount: Number(computedBookingDetails?.cautionAmount || 0),
      caution_mode: CAUTION_MODE_CB,
      pickup_time_start: computedBookingDetails?.pickupTimeStart || equipment?.pickupTimeStart || null,
      pickup_time_end: computedBookingDetails?.pickupTimeEnd || equipment?.pickupTimeEnd || null,
      return_time_start: computedBookingDetails?.returnTimeStart || equipment?.returnTimeStart || null,
      return_time_end: computedBookingDetails?.returnTimeEnd || equipment?.returnTimeEnd || null,
      deposit_status: 'pending'
    });

    if (reservationError) {
      throw reservationError;
    }
    if (!createdReservation?.id) {
      throw new Error('Réservation créée sans identifiant.');
    }

    setPageData((previous) => ({
      ...(previous || {}),
      bookingDetails: {
        ...(previous?.bookingDetails || {}),
        reservationId: createdReservation.id,
        ownerId,
        insuranceSelected: false,
        insuranceAmount: 0,
        cautionMode: CAUTION_MODE_CB
      }
    }));

    return createdReservation.id;
  };

  const handlePayment = async () => {
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
      toast?.error("Configuration Stripe test absente (VITE_STRIPE_PUBLISHABLE_KEY).");
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

      const ensuredReservationId = await ensureReservationId();
      const safeReservationId = normalizeReservationId(ensuredReservationId);
      if (!safeReservationId) {
        throw new Error('Impossible de finaliser la réservation avant redirection Stripe.');
      }

      const successReturnParams = new URLSearchParams();
      successReturnParams.set('from', 'payment');
      successReturnParams.set('reservationId', safeReservationId);
      const successReturnBaseUrl = buildAppRedirectUrl(
        `/verification-identite-location?${successReturnParams.toString()}`
      );

      const cancelReturnParams = new URLSearchParams();
      if (equipment?.id != null) {
        cancelReturnParams.set('annonceId', String(equipment?.id));
      }
      const returnStartDate = toReservationDateOnly(computedBookingDetails?.startDate);
      const returnEndDate = toReservationDateOnly(computedBookingDetails?.endDate);
      if (returnStartDate) {
        cancelReturnParams.set('startDate', returnStartDate);
      }
      if (returnEndDate) {
        cancelReturnParams.set('endDate', returnEndDate);
      }
      cancelReturnParams.set('reservationId', safeReservationId);
      const cancelReturnBaseUrl = buildAppRedirectUrl(
        `/traitement-paiement?${cancelReturnParams.toString()}`
      );

      const requestBody = {
        returnBaseUrl: successReturnBaseUrl,
        cancelReturnBaseUrl,
        reservationId: safeReservationId,
        equipment: {
          id: equipment?.id || null,
          title: equipment?.title || 'Reservation',
          dailyPrice: Number(equipment?.dailyPrice || 0) || 0
        },
        bookingDetails: {
          startDate: toReservationDateOnly(computedBookingDetails?.startDate),
          endDate: toReservationDateOnly(computedBookingDetails?.endDate),
          rentalDays: Number(computedBookingDetails?.rentalDays || 0) || 0,
          insuranceSelected: false,
          insuranceAmount: 0,
          totalAmount: Number(computedBookingDetails?.totalAmount || 0) || 0,
          cautionAmount: Number(computedBookingDetails?.cautionAmount || 0) || 0,
          cautionMode: CAUTION_MODE_CB
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
            : (error?.message || 'Impossible de lancer le paiement Stripe.')
        );
      }

      if (!data?.url) {
        throw new Error('Session Stripe créée sans URL de redirection.');
      }

      await redirectToExternalUrl(data.url);
      return;
    } catch (error) {
      console.error('Erreur lancement paiement Stripe:', error);
      toast?.error(error?.message || 'Impossible de lancer le paiement Stripe.');
    } finally {
      setLoading(false);
    }
  };

  if (contextLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-surface">
        <Header />
        <main className="flex-1 py-8 md:py-12">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="bg-white rounded-lg shadow-elevation-2 p-6">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Icon name="Loader2" size={20} className="animate-spin" />
                <span>Chargement du récapitulatif de paiement...</span>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!equipment || !computedBookingDetails) {
    return (
      <div className="min-h-screen flex flex-col bg-surface">
        <Header />
        <main className="flex-1 py-8 md:py-12">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="bg-white rounded-lg shadow-elevation-2 p-6 space-y-4">
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
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <main className="flex-1 py-8 md:py-12">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="mb-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon name="ArrowLeft" size={20} />
              <span>Retour</span>
            </button>
          </div>

          {stripeStatusFromQuery === 'success' && (
            <div className="bg-success/10 border border-success/20 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <Icon name="CheckCircle" size={20} className="text-success flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground mb-1">Paiement Stripe terminé</p>
                  <p className="text-sm text-muted-foreground">
                    {checkoutSyncState?.message || 'Synchronisation backend en cours...'}
                    {stripeSessionIdFromQuery ? ` Session: ${stripeSessionIdFromQuery}` : ''}
                  </p>
                  {stripePaymentAlreadyConfirmed && (
                    <p className="text-sm text-foreground mt-1">
                      Redirection vers la vérification d'identité...
                    </p>
                  )}
                  {stripeStatusFromQuery === 'success' && identityTransitionReservationId && (
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-lg shadow-elevation-2 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Icon name="FileText" size={24} className="text-primary" />
                  <h2 className="text-h4 font-heading text-foreground">
                    Récapitulatif de la réservation
                  </h2>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-4 pb-4 border-b border-border">
                    <img
                      src={equipment?.images?.[0]?.url || '/assets/images/no_image.png'}
                      alt={equipment?.images?.[0]?.alt || 'Photo annonce'}
                      className="w-24 h-24 object-cover rounded-md"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{equipment?.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{equipment?.category}</p>
                      <p className="text-sm font-medium text-primary mt-2">
                        {Number(equipment?.dailyPrice || 0)?.toFixed(2)} EUR / jour
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border overflow-x-auto">
                    <div className="flex items-center justify-between gap-6 min-w-max text-sm">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Icon name="Calendar" size={18} className="text-primary" />
                        <span className="text-foreground font-medium">Période de location</span>
                        <span className="text-muted-foreground">
                          Du {computedBookingDetails?.startDate ? format(computedBookingDetails?.startDate, 'dd MMMM yyyy', { locale: fr }) : '-'}
                        </span>
                        <span className="text-muted-foreground">
                          Au {computedBookingDetails?.endDate ? format(computedBookingDetails?.endDate, 'dd MMMM yyyy', { locale: fr }) : '-'}
                        </span>
                        <span className="text-foreground font-medium">
                          {computedBookingDetails?.rentalDays || 0} jour{(computedBookingDetails?.rentalDays || 0) > 1 ? 's' : ''}
                        </span>
                        {pickupWindow && (
                          <span className="text-muted-foreground">
                            Prise: {pickupWindow}
                          </span>
                        )}
                        {returnWindow && (
                          <span className="text-muted-foreground">
                            Restitution: {returnWindow}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 whitespace-nowrap">
                        <img
                          src={equipment?.owner?.avatar || '/assets/images/no_image.png'}
                          alt={equipment?.owner?.avatarAlt || 'Avatar propriétaire'}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <span className="text-muted-foreground">Propriétaire</span>
                        <span className="font-medium text-foreground">{equipment?.owner?.pseudonym || 'Propriétaire'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-elevation-2 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Icon name="Shield" size={24} className="text-warning" />
                  <h3 className="text-h5 font-heading text-foreground">Garantie par empreinte CB</h3>
                </div>
                <div className="space-y-4">
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
              </div>

            </div>

            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-4">
                <div className="bg-white rounded-lg shadow-elevation-2 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Icon name="Shield" size={24} className="text-success" />
                    <h3 className="text-h5 font-heading text-foreground">
                      Paiement sécurisé
                    </h3>
                  </div>
                  <CostBreakdown bookingDetails={computedBookingDetails} />
                </div>

                <div className="bg-white rounded-lg shadow-elevation-2 p-6">
                  <div className="space-y-4">
                    <div>
                      <Checkbox
                        id="cgu"
                        checked={acceptCGU}
                        onChange={handleCGUChange}
                        label="J'accepte les conditions generales d'utilisation"
                        description={(
                          <span>
                            En cochant cette case, vous acceptez nos{' '}
                            <a href="/cgu" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                              conditions generales d'utilisation
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

                    <div className="border-t border-border pt-4 space-y-4">
                      {stripeCheckoutEnabled ? (
                        <>
                          <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/15 rounded-md">
                            <Icon name="ExternalLink" size={18} className="text-primary flex-shrink-0 mt-0.5" />
                            <div className="text-sm">
                              <p className="font-medium text-foreground">Paiement CB via Stripe (mode test)</p>
                              <p className="text-muted-foreground mt-1">
                                Redirection vers Stripe pour payer la location. La caution reste en empreinte CB non débitée.
                              </p>
                              <p className="text-xs text-muted-foreground mt-2">
                                Exemple carte test Stripe: 4242 4242 4242 4242, date future, CVC libre.
                              </p>
                            </div>
                          </div>

                          <Button
                            type="button"
                            size="lg"
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
                        </>
                      ) : (
                        <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-md">
                          <Icon name="AlertTriangle" size={18} className="text-warning flex-shrink-0 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-medium text-foreground">Paiement Stripe indisponible</p>
                            <p className="text-muted-foreground mt-1">
                              Configuration Stripe manquante sur cette instance.
                            </p>
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PaymentProcessing;





