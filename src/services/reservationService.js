import { supabase } from '../lib/supabase';
import { sendEmail } from './emailService';
import notificationService from './notificationService';
import reservationPhotoCleanupService from './reservationPhotoCleanupService';
import { computeOwnerNetEstimate } from '../utils/pricingPolicy';
import {
  SAME_DAY_RESERVATION_BLOCKED_MESSAGE,
  isReservationStartDateAllowed,
  toReservationDateOnly
} from '../utils/reservationDateRules';
import {
  buildBlockedDateSet,
  isDateAllowedByWeekdays,
  normalizeDateToLocalDay,
  normalizeScheduleWeekdays,
  rangeContainsBlockedDate
} from '../utils/availabilityRules';
import {
  AVAILABILITY_HOLD_RESERVATION_STATUSES,
  CHAT_ELIGIBLE_RESERVATION_STATUSES as CHAT_ELIGIBLE_RESERVATION_STATUS_SET,
  CURRENT_RESERVATION_STATUSES,
  isReservationPaymentConfirmed
} from '../utils/reservationStatus';

/**
 * Reservation Service
 * Maps to 'reservations' table
 * Handles booking requests, status management, payments, and document tracking
 */

function isSchemaError(error) {
  if (!error) return false;
  if (error?.code && typeof error?.code === 'string') {
    if (error?.code === 'PGRST204') return true;
    const errorClass = error?.code?.substring(0, 2);
    if (errorClass === '42' || errorClass === '08') return true;
  }
  if (error?.message) {
    const schemaErrorPatterns = [
      /relation.*does not exist/i,
      /column.*does not exist/i,
      /could not find the '.*' column .*schema cache/i,
      /function.*does not exist/i,
      /syntax error/i,
    ];
    return schemaErrorPatterns?.some(pattern => pattern?.test(error?.message));
  }
  return false;
}

function isReservationsProfilesRelationshipError(error) {
  const message = String(error?.message || '');
  const details = String(error?.details || '');
  if (error?.code !== 'PGRST200') return false;

  return /relationship between 'reservations' and 'profiles'/i?.test(message)
    || /relationship between 'reservations' and 'profiles'/i?.test(details);
}

function extractMissingColumnName(error) {
  const message = String(error?.message || '');
  const details = String(error?.details || '');
  const source = `${message} ${details}`;
  const patterns = [
    /Could not find the '([^']+)' column/i,
    /column "([^"]+)" does not exist/i,
    /column ([a-zA-Z0-9_.]+) does not exist/i
  ];

  for (const pattern of patterns) {
    const match = source?.match(pattern);
    if (match?.[1]) {
      const normalized = String(match[1])?.trim()?.replace(/^"+|"+$/g, '');
      const parts = normalized?.split('.') || [];
      return parts?.[parts?.length - 1] || normalized;
    }
  }

  return null;
}

function removeColumnFromSelect(selectClause, columnName) {
  if (!selectClause || !columnName) return selectClause;
  const normalizedTarget = String(columnName)?.trim()?.toLowerCase();

  return String(selectClause)
    ?.split(',')
    ?.map((part) => String(part || '')?.trim())
    ?.filter((part) => part && part?.toLowerCase() !== normalizedTarget)
    ?.join(', ');
}

function isSelfReservationConstraintError(error) {
  const source = `${String(error?.message || '')} ${String(error?.details || '')} ${String(error?.hint || '')}`?.toLowerCase();
  if (String(error?.code || '') !== '23514') return false;
  return source?.includes('reservations_owner_renter_distinct_check')
    || (source?.includes('owner_id') && source?.includes('renter_id'));
}

function normalizeId(value) {
  if (!value) return null;
  return String(value)?.trim() || null;
}

async function resolveAnnonceOwnerId(annonceId) {
  if (!annonceId) return { ownerId: null, error: null };

  // Primary shape: annonces.owner_id
  let ownerLookup = await supabase
    ?.from('annonces')
    ?.select('owner_id')
    ?.eq('id', annonceId)
    ?.maybeSingle();

  if (!ownerLookup?.error) {
    return { ownerId: ownerLookup?.data?.owner_id || null, error: null };
  }

  // Legacy fallback: annonces.user_id
  const missingColumn = extractMissingColumnName(ownerLookup?.error);
  if (missingColumn === 'owner_id') {
    ownerLookup = await supabase
      ?.from('annonces')
      ?.select('user_id')
      ?.eq('id', annonceId)
      ?.maybeSingle();

    if (!ownerLookup?.error) {
      return { ownerId: ownerLookup?.data?.user_id || null, error: null };
    }
  }

  return { ownerId: null, error: ownerLookup?.error || null };
}

async function resolveAnnonceAvailabilityRules(annonceId) {
  if (!annonceId) return { data: {}, error: null };

  let effectiveSelect = 'unavailable_dates, pickup_days, return_days';
  let attempts = 0;

  while (attempts < 4) {
    const { data, error } = await supabase
      ?.from('annonces')
      ?.select(effectiveSelect)
      ?.eq('id', annonceId)
      ?.maybeSingle();

    if (!error) {
      return { data: data || {}, error: null };
    }

    if (error?.code === 'PGRST116') {
      return { data: {}, error: null };
    }

    if (!isSchemaError(error)) {
      return { data: null, error };
    }

    const missingColumn = extractMissingColumnName(error);
    if (!missingColumn || !effectiveSelect?.toLowerCase()?.includes(String(missingColumn)?.toLowerCase())) {
      console.warn('resolveAnnonceAvailabilityRules schema degrade:', error?.message || error);
      return { data: {}, error: null };
    }

    effectiveSelect = removeColumnFromSelect(effectiveSelect, missingColumn);
    attempts += 1;
  }

  return { data: {}, error: null };
}

const ONGOING_RESERVATION_STATUSES = Array.from(CURRENT_RESERVATION_STATUSES);
const CHAT_ELIGIBLE_RESERVATION_STATUSES = Array.from(CHAT_ELIGIBLE_RESERVATION_STATUS_SET);
const AVAILABILITY_HOLD_STATUSES = Array.from(AVAILABILITY_HOLD_RESERVATION_STATUSES);
const PAYMENT_DEADLINE_MINUTES = 30;

function getIsoDateOnly(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date?.getTime())) return null;
  return date?.toISOString()?.slice(0, 10);
}

function getReservationFunctionUnavailableMessage(functionName) {
  if (functionName === 'adjust-renter-reservation' || functionName === 'adjust-owner-reservation') {
    return "Le service de modification de réservation est momentanément indisponible. Réessayez dans un instant.";
  }

  return "Le service de réservation est momentanément indisponible. Réessayez dans un instant.";
}

function filterVisibleUserReservations(rows = [], filters = {}) {
  const reservations = Array.isArray(rows) ? rows : [];
  if (filters?.includePending === true) return reservations;

  return reservations?.filter((reservation) => {
    const status = String(reservation?.status || '')?.trim()?.toLowerCase();
    if (!['pending', 'accepted']?.includes(status)) return true;
    return isReservationPaymentConfirmed(reservation);
  });
}

function computeReservationRentalDays(startDateValue, endDateValue) {
  const startDate = new Date(startDateValue);
  const endDate = new Date(endDateValue);
  if (Number.isNaN(startDate?.getTime()) || Number.isNaN(endDate?.getTime())) return 0;

  const normalizedStart = new Date(startDate);
  const normalizedEnd = new Date(endDate);
  normalizedStart?.setHours(0, 0, 0, 0);
  normalizedEnd?.setHours(0, 0, 0, 0);

  const diff = Math.round((normalizedEnd - normalizedStart) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
}

function computeOwnerAmountEstimate(fullReservation) {
  const fallbackTotal = Math.max(0, Number(fullReservation?.total_price || 0) || 0);
  const dailyPrice = Math.max(0, Number(fullReservation?.annonce?.prix_jour || 0) || 0);
  const rentalDays = computeReservationRentalDays(fullReservation?.start_date, fullReservation?.end_date);
  const rentalAmount = dailyPrice > 0 && rentalDays > 0 ? (dailyPrice * rentalDays) : fallbackTotal;

  return computeOwnerNetEstimate({
    rentalAmount
  })?.ownerNetEstimate || 0;
}

async function attachProfilesToReservations(reservations, {
  includeOwner = false,
  includeRenter = false
} = {}) {
  const rows = Array?.isArray(reservations) ? reservations : [];
  if (rows?.length === 0) return rows;

  const profileIds = Array.from(
    new Set(
      rows
        ?.flatMap((row) => [
          includeOwner ? row?.owner_id : null,
          includeRenter ? row?.renter_id : null
        ])
        ?.filter(Boolean)
    )
  );

  if (profileIds?.length === 0) return rows;

  const { data: profiles, error } = await supabase
    ?.from('profiles')
    ?.select('id, pseudo, avatar_url, email, phone')
    ?.in('id', profileIds);

  if (error) {
    console.warn('Impossible de charger les profils rattaches aux reservations:', error?.message || error);
    return rows;
  }

  const profileById = {};
  (profiles || [])?.forEach((profile) => {
    if (profile?.id) profileById[profile?.id] = profile;
  });

  return rows?.map((row) => ({
    ...row,
    ...(includeOwner ? { owner: profileById?.[row?.owner_id] || row?.owner || null } : {}),
    ...(includeRenter ? { renter: profileById?.[row?.renter_id] || row?.renter || null } : {})
  }));
}

async function getReservationWithProfileFallback(id, annonceSelect) {
  let effectiveAnnonceSelect = annonceSelect;
  let attempts = 0;

  while (attempts < 6) {
    const withProfiles = await supabase?.from('reservations')?.select(`
        *,
        annonce:annonces(${effectiveAnnonceSelect}),
        renter:profiles!reservations_renter_id_fkey(pseudo, avatar_url, email, phone),
        owner:profiles!reservations_owner_id_fkey(pseudo, avatar_url, email, phone)
      `)?.eq('id', id)?.maybeSingle();

    if (!withProfiles?.error) {
      return { data: withProfiles?.data || null, error: null };
    }

    const missingPrimaryColumn = extractMissingColumnName(withProfiles?.error);
    if (missingPrimaryColumn && String(effectiveAnnonceSelect)?.toLowerCase()?.includes(String(missingPrimaryColumn)?.toLowerCase())) {
      effectiveAnnonceSelect = removeColumnFromSelect(effectiveAnnonceSelect, missingPrimaryColumn);
      attempts += 1;
      continue;
    }

    if (!isReservationsProfilesRelationshipError(withProfiles?.error)) {
      return { data: null, error: withProfiles?.error };
    }

    const fallback = await supabase?.from('reservations')?.select(`
        *,
        annonce:annonces(${effectiveAnnonceSelect})
      `)?.eq('id', id)?.maybeSingle();

    if (fallback?.error) {
      const missingFallbackColumn = extractMissingColumnName(fallback?.error);
      if (missingFallbackColumn && String(effectiveAnnonceSelect)?.toLowerCase()?.includes(String(missingFallbackColumn)?.toLowerCase())) {
        effectiveAnnonceSelect = removeColumnFromSelect(effectiveAnnonceSelect, missingFallbackColumn);
        attempts += 1;
        continue;
      }

      return { data: null, error: fallback?.error };
    }

    const hydrated = await attachProfilesToReservations(
      fallback?.data ? [fallback?.data] : [],
      { includeOwner: true, includeRenter: true }
    );

    return { data: hydrated?.[0] || fallback?.data || null, error: null };
  }

  return {
    data: null,
    error: { message: 'Impossible de charger la reservation (schema annonces incompatible).' }
  };
}

function buildFunctionUrl(functionName) {
  const supabaseUrl = String(
    import.meta.env?.VITE_SUPABASE_URL
    || import.meta.env?.NEXT_PUBLIC_SUPABASE_URL
    || ''
  ).trim().replace(/\/$/, '');
  if (!supabaseUrl || !functionName) return null;
  return `${supabaseUrl}/functions/v1/${functionName}`;
}

async function readFunctionResponsePayload(response) {
  if (!response) return null;

  try {
    return await response.clone().json();
  } catch {
    try {
      const text = await response.clone().text();
      return text ? { message: text } : null;
    } catch {
      return null;
    }
  }
}

async function getFreshAccessToken() {
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
}

async function invokeReservationFunctionWithUserJwt(functionName, body = {}) {
  try {
    const functionUrl = buildFunctionUrl(functionName);
    const supabaseAnonKey = String(
      import.meta.env?.VITE_SUPABASE_ANON_KEY
      || import.meta.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY
      || ''
    ).trim();

    if (!functionUrl || !supabaseAnonKey) {
      return {
        data: null,
        error: {
          message: 'Configuration Supabase Functions manquante.',
          status: 500
        }
      };
    }

    const userAccessToken = await getFreshAccessToken();
    if (!userAccessToken) {
      return {
        data: null,
        error: {
          message: 'Session expiree. Veuillez vous reconnecter.',
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
      const rawMessage = String(networkError?.message || '');
      const isFetchFailure = /failed to fetch|networkerror|load failed/i?.test(rawMessage);

      return {
        data: null,
        error: {
          message: isFetchFailure
            ? getReservationFunctionUnavailableMessage(functionName)
            : (networkError?.message || "Impossible de joindre le service de réservation."),
          status: null
        }
      };
    }

    const payload = await readFunctionResponsePayload(response);
    if (!response?.ok) {
      const isUnavailableStatus = [404, 502, 503, 504]?.includes(Number(response?.status || 0));

      return {
        data: null,
        error: {
          message: isUnavailableStatus
            ? getReservationFunctionUnavailableMessage(functionName)
            : (payload?.error || payload?.message || 'Erreur backend lors de la reservation.'),
          status: Number(response?.status || 0) || null
        }
      };
    }

    return {
      data: payload || {},
      error: null
    };
  } catch (error) {
    console.error('Invoke reservation function error:', error);
    return {
      data: null,
      error: {
        message: error?.message || 'Erreur backend lors de la reservation.'
      }
    };
  }
}

const reservationService = {
  /**
   * Create new reservation
   */
  createReservation: async (reservationData) => {
    void reservationData;
    return {
      data: null,
      error: {
        message: "La création directe de réservation côté client est désactivée. Une réservation n'est créée qu'après paiement confirmé."
      }
    };
  },

  /**
   * Get reservation by ID with related data
   */
  getReservationById: async (id) => {
    try {
      const { data, error } = await getReservationWithProfileFallback(
        id,
        'titre, photos, prix_jour, caution, caution_mode, owner_id, address, postal_code, city, pickup_time_start, pickup_time_end, return_time_start, return_time_end'
      );

      if (error) {
        if (error?.code === 'PGRST116') return { data: null, error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getReservationById:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get reservation by ID error:', error);
      throw error;
    }
  },

  /**
   * Get user's reservations (as renter)
   */
  getUserReservations: async (userId, filters = {}) => {
    try {
      let annonceSelect = 'titre, photos, prix_jour, address, postal_code, city, pickup_time_start, pickup_time_end, return_time_start, return_time_end';
      let attempts = 0;

      while (attempts < 3) {
        let query = supabase?.from('reservations')?.select(
          `
            *,
            annonce:annonces(${annonceSelect}),
            owner:profiles!reservations_owner_id_fkey(pseudo, avatar_url, email, phone)
          `
        )?.eq('renter_id', userId);

        if (filters?.status) query = query?.eq('status', filters?.status);
        query = query?.order('created_at', { ascending: false });

        const { data, error } = await query;
        if (!error) {
          return { data: filterVisibleUserReservations(data, filters), error: null };
        }

        const missingColumn = extractMissingColumnName(error);
        if (missingColumn && String(annonceSelect)?.toLowerCase()?.includes(String(missingColumn)?.toLowerCase())) {
          annonceSelect = removeColumnFromSelect(annonceSelect, missingColumn);
          attempts += 1;
          continue;
        }

        if (isReservationsProfilesRelationshipError(error)) {
          let fallbackQuery = supabase?.from('reservations')?.select(
            `
              *,
              annonce:annonces(${annonceSelect})
            `
          )?.eq('renter_id', userId);

          if (filters?.status) fallbackQuery = fallbackQuery?.eq('status', filters?.status);
          fallbackQuery = fallbackQuery?.order('created_at', { ascending: false });

          const { data: fallbackData, error: fallbackError } = await fallbackQuery;
          if (fallbackError) {
            const fallbackMissing = extractMissingColumnName(fallbackError);
            if (fallbackMissing && String(annonceSelect)?.toLowerCase()?.includes(String(fallbackMissing)?.toLowerCase())) {
              annonceSelect = removeColumnFromSelect(annonceSelect, fallbackMissing);
              attempts += 1;
              continue;
            }
            return { data: null, error: fallbackError };
          }

          const hydrated = await attachProfilesToReservations(fallbackData || [], { includeOwner: true });
          return { data: filterVisibleUserReservations(hydrated, filters), error: null };
        }

        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getUserReservations:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return {
        data: null,
        error: { message: 'Impossible de charger les reservations locataire.' }
      };
    } catch (error) {
      console.error('Get user reservations error:', error);
      throw error;
    }
  },

  getOwnerReservations: async (ownerId, filters = {}) => {
    try {
      let annonceSelect = 'titre, photos, prix_jour, caution, caution_mode, address, postal_code, city, pickup_time_start, pickup_time_end, return_time_start, return_time_end';
      let attempts = 0;

      while (attempts < 3) {
        let query = supabase?.from('reservations')?.select(
          `
            *,
            annonce:annonces(${annonceSelect}),
            renter:profiles!reservations_renter_id_fkey(pseudo, avatar_url, email, phone)
          `
        )?.eq('owner_id', ownerId);

        if (filters?.status) query = query?.eq('status', filters?.status);
        query = query?.order('created_at', { ascending: false });

        const { data, error } = await query;
        if (!error) {
          return { data: filterVisibleUserReservations(data, filters), error: null };
        }

        const missingColumn = extractMissingColumnName(error);
        if (missingColumn && String(annonceSelect)?.toLowerCase()?.includes(String(missingColumn)?.toLowerCase())) {
          annonceSelect = removeColumnFromSelect(annonceSelect, missingColumn);
          attempts += 1;
          continue;
        }

        if (isReservationsProfilesRelationshipError(error)) {
          let fallbackQuery = supabase?.from('reservations')?.select(
            `
              *,
              annonce:annonces(${annonceSelect})
            `
          )?.eq('owner_id', ownerId);

          if (filters?.status) fallbackQuery = fallbackQuery?.eq('status', filters?.status);
          fallbackQuery = fallbackQuery?.order('created_at', { ascending: false });

          const { data: fallbackData, error: fallbackError } = await fallbackQuery;
          if (fallbackError) {
            const fallbackMissing = extractMissingColumnName(fallbackError);
            if (fallbackMissing && String(annonceSelect)?.toLowerCase()?.includes(String(fallbackMissing)?.toLowerCase())) {
              annonceSelect = removeColumnFromSelect(annonceSelect, fallbackMissing);
              attempts += 1;
              continue;
            }
            return { data: null, error: fallbackError };
          }

          const hydrated = await attachProfilesToReservations(fallbackData || [], { includeRenter: true });
          return { data: filterVisibleUserReservations(hydrated, filters), error: null };
        }

        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getOwnerReservations:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return {
        data: null,
        error: { message: 'Impossible de charger les réservations propriétaire (schéma annonces incompatible).' }
      };
    } catch (error) {
      console.error('Get owner reservations error:', error);
      throw error;
    }
  },

  /**
   * Update reservation status
   */
  updateReservationStatus: async (id, newStatus, additionalData = {}) => {
    try {
      const normalizedStatus = String(newStatus || '')?.trim()?.toLowerCase();
      if (['pending', 'accepted']?.includes(normalizedStatus)) {
        return {
          data: null,
          error: {
            message: "Les statuts de prépaiement sont désactivés. Une réservation n'est créée qu'après paiement confirmé."
          }
        };
      }

      const updateData = {
        status: normalizedStatus,
        updated_at: new Date()?.toISOString(),
        ...additionalData
      };

      const { data, error } = await supabase?.from('reservations')?.update(updateData)?.eq('id', id)?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schema dans updateReservationStatus:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      // Get related data for emails
      const { data: fullReservation, error: fullReservationError } = await getReservationWithProfileFallback(
        id,
        'titre, prix_jour, caution, caution_mode'
      );
      if (fullReservationError) {
        console.warn('Impossible de charger les relations reservation/profils pour les emails:', fullReservationError?.message || fullReservationError);
      }

      if (!fullReservation) return { data, error: null };

      const startDate = new Date(fullReservation.start_date)?.toLocaleDateString('fr-FR');
      const endDate = new Date(fullReservation.end_date)?.toLocaleDateString('fr-FR');

      // Send emails based on status change
      if (normalizedStatus === 'accepted' || normalizedStatus === 'pending') {
        if (fullReservation?.renter?.email) {
          await sendEmail({
            to: fullReservation?.renter?.email,
            templateKey: 'reservation_accepted_renter',
            variables: {
              renter_name: fullReservation?.renter?.pseudo || 'Locataire',
              owner_name: fullReservation?.owner?.pseudo || 'Propriétaire',
              annonce_title: fullReservation?.annonce?.titre || 'Équipement',
              start_date: startDate,
              end_date: endDate,
              total_price: fullReservation?.total_price || '0',
              caution: fullReservation?.annonce?.caution || '0',
              reservation_url: `${window.location?.origin}/mes-reservations`
            }
          });
        }
      } else if (normalizedStatus === 'cancelled') {
        const cancellationReason = additionalData?.cancellation_reason || 'Non spécifiée';

        if (fullReservation?.renter?.email) {
          await sendEmail({
            to: fullReservation?.renter?.email,
            templateKey: 'reservation_cancelled_renter',
            variables: {
              renter_name: fullReservation?.renter?.pseudo || 'Locataire',
              annonce_title: fullReservation?.annonce?.titre || 'Équipement',
              cancellation_reason: cancellationReason,
              search_url: `${window.location?.origin}/accueil-recherche`
            }
          });
        }

        if (fullReservation?.owner?.email) {
          await sendEmail({
            to: fullReservation?.owner?.email,
            templateKey: 'reservation_cancelled_owner',
            variables: {
              owner_name: fullReservation?.owner?.pseudo || 'Propriétaire',
              renter_name: fullReservation?.renter?.pseudo || 'Locataire',
              annonce_title: fullReservation?.annonce?.titre || 'Équipement',
              start_date: startDate,
              end_date: endDate,
              annonce_url: `${window.location?.origin}/mes-reservations`,
              cancellation_reason: cancellationReason
            }
          });
        }
      } else if (normalizedStatus === 'paid') {
        if (fullReservation?.renter?.email) {
          await sendEmail({
            to: fullReservation?.renter?.email,
            templateKey: 'payment_confirmed_renter',
            variables: {
              renter_name: fullReservation?.renter?.pseudo || 'Locataire',
              annonce_title: fullReservation?.annonce?.titre || 'Équipement',
              amount: fullReservation?.total_price || '0',
              total_price: fullReservation?.total_price || '0',
              caution: fullReservation?.annonce?.caution || '0',
              reservation_url: `${window.location?.origin}/mes-reservations`
            }
          });
        }

        if (fullReservation?.owner?.email) {
          const ownerAmount = computeOwnerAmountEstimate(fullReservation)?.toFixed(2);
          await sendEmail({
            to: fullReservation?.owner?.email,
            templateKey: 'payment_confirmed_owner',
            variables: {
              owner_name: fullReservation?.owner?.pseudo || 'Propriétaire',
              renter_name: fullReservation?.renter?.pseudo || 'Locataire',
              annonce_title: fullReservation?.annonce?.titre || 'Équipement',
              amount: ownerAmount,
              total_price: fullReservation?.total_price || '0',
              owner_amount: ownerAmount,
              reservation_url: `${window.location?.origin}/mes-reservations`
            }
          });
        }
      } else if (normalizedStatus === 'completed') {
        if (fullReservation?.renter?.email) {
          await sendEmail({
            to: fullReservation?.renter?.email,
            templateKey: 'rental_completed_renter',
            variables: {
              renter_name: fullReservation?.renter?.pseudo || 'Locataire',
              annonce_title: fullReservation?.annonce?.titre || 'Équipement',
              caution: fullReservation?.annonce?.caution || '0',
              review_url: `${window.location?.origin}/mes-reservations`
            }
          });
        }

        if (fullReservation?.owner?.email) {
          const ownerAmount = computeOwnerAmountEstimate(fullReservation)?.toFixed(2);
          await sendEmail({
            to: fullReservation?.owner?.email,
            templateKey: 'rental_completed_owner',
            variables: {
              owner_name: fullReservation?.owner?.pseudo || 'Propriétaire',
              renter_name: fullReservation?.renter?.pseudo || 'Locataire',
              annonce_title: fullReservation?.annonce?.titre || 'Équipement',
              amount: ownerAmount,
              owner_amount: ownerAmount,
              review_url: `${window.location?.origin}/mes-reservations`
            }
          });
        }
      }

      return { data, error: null };
    } catch (error) {
      console.error('Update reservation status error:', error);
      throw error;
    }
  },

  /**
   * Accept reservation (owner action)
   */
  acceptReservation: async (id) => {
    void id;
    return {
      data: null,
      error: {
        message: "Le workflow de pré-acceptation propriétaire est désactivé. Le paiement confirmé crée directement la réservation."
      }
    };
  },

  /**
   * Cancel reservation
   */
  cancelReservation: async (id, reason, cancelledBy) => {
    return await reservationService?.updateReservationStatus(id, 'cancelled', {
      cancellation_reason: reason,
      cancelled_by: cancelledBy,
      cancelled_at: new Date()?.toISOString()
    });
  },

  adjustRenterReservation: async ({
    reservationId,
    action,
    reason = '',
    newStartDate = null,
    newEndDate = null
  } = {}) => {
    return await invokeReservationFunctionWithUserJwt('adjust-renter-reservation', {
      reservationId,
      action,
      reason,
      newStartDate,
      newEndDate
    });
  },

  createOwnerReservationAdjustmentCheckout: async ({
    reservationId,
    action,
    reason = '',
    newStartDate = null,
    newEndDate = null,
    returnBaseUrl,
    cancelReturnBaseUrl
  } = {}) => {
    return await invokeReservationFunctionWithUserJwt('adjust-owner-reservation', {
      reservationId,
      action,
      reason,
      newStartDate,
      newEndDate,
      returnBaseUrl,
      cancelReturnBaseUrl
    });
  },

  syncOwnerReservationAdjustmentCheckout: async ({
    reservationId,
    action,
    sessionId
  } = {}) => {
    return await invokeReservationFunctionWithUserJwt('adjust-owner-reservation', {
      reservationId,
      action,
      sessionId
    });
  },

  /**
   * Refuse reservation
   */
  refuseReservation: async (id, refusalReason) => {
    try {
      const { data, error } = await supabase?.from('reservations')?.update({
        status: 'cancelled',
        cancellation_reason: refusalReason,
        cancelled_at: new Date()?.toISOString()
      })?.eq('id', id)?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schema dans refuseReservation:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      const { data: fullReservation, error: fullReservationError } = await getReservationWithProfileFallback(
        id,
        'titre'
      );

      if (fullReservationError) {
        console.warn('Impossible de charger les relations reservation/profils pour les emails de refus:', fullReservationError?.message || fullReservationError);
      }

      if (fullReservation?.renter?.email) {
        await sendEmail({
          to: fullReservation?.renter?.email,
          templateKey: 'reservation_refused_renter',
          variables: {
            renter_name: fullReservation?.renter?.pseudo || 'Locataire',
            owner_name: fullReservation?.owner?.pseudo || 'Propriétaire',
            annonce_title: fullReservation?.annonce?.titre || 'Équipement',
            refusal_reason: refusalReason || 'Non spécifiée',
            search_url: `${window.location?.origin}/accueil-recherche`
          }
        });
      }

      return { data, error: null };
    } catch (error) {
      console.error('Refuse reservation error:', error);
      throw error;
    }
  },
  /**
   * Update payment information
   */
  updatePaymentInfo: async (id, paymentData) => {
    try {
      const { data, error } = await supabase?.from('reservations')?.update({
          ...paymentData,
          updated_at: new Date()?.toISOString()
        })?.eq('id', id)?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans updatePaymentInfo:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Update payment info error:', error);
      throw error;
    }
  },

  /**
   * Mark payment as completed
   */
  markPaymentCompleted: async (id, stripePaymentIntentId) => {
    try {
      const { data, error } = await supabase?.from('reservations')?.update({
          stripe_payment_intent_id: stripePaymentIntentId,
          stripe_payment_status: 'succeeded',
          paid_at: new Date()?.toISOString(),
          tenant_payment_paid_at: new Date()?.toISOString(),
          updated_at: new Date()?.toISOString()
        })?.eq('id', id)?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans markPaymentCompleted:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Mark payment completed error:', error);
      throw error;
    }
  },

  /**
   * Update deposit/caution status on reservation
   * Persists the owner's decision after state-of-repair photos review.
   */
  updateDepositStatus: async (id, depositStatus, options = {}) => {
    try {
      const normalizedDepositStatus = String(depositStatus || '')?.toLowerCase();

      if (['released', 'captured']?.includes(normalizedDepositStatus)) {
        const decision = normalizedDepositStatus === 'released' ? 'release' : 'capture';
        const { error: settleError } = await supabase.functions.invoke('manage-reservation-deposit-strategy-b', {
          body: {
            action: 'settle',
            reservationId: id,
            decision
          }
        });

        if (settleError) {
          const settleErrorMessage = String(settleError?.message || '');
          const isLegacyWithoutStrategy = /aucune strategie caution active/i?.test(settleErrorMessage)
            || /aucune empreinte active/i?.test(settleErrorMessage);

          if (!isLegacyWithoutStrategy) {
            throw settleError;
          }
        }
      }

      const updateData = {
        deposit_status: depositStatus,
        updated_at: new Date()?.toISOString()
      };

      if (depositStatus === 'released') {
        updateData.deposit_released_at = new Date()?.toISOString();
      }

      if (options?.clearReleaseTimestamp && depositStatus !== 'released') {
        updateData.deposit_released_at = null;
      }

      const { data, error } = await supabase?.from('reservations')?.update(updateData)?.eq('id', id)?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans updateDepositStatus:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      if (['released', 'captured']?.includes(normalizedDepositStatus)) {
        // Best-effort sync with official inspection settlement workflow (if enabled on this reservation).
        await supabase?.from('reservation_inspection_settlements')?.update({
          status: normalizedDepositStatus === 'released' ? 'released_after_moderation' : 'captured_after_moderation',
          payment_hold_status: normalizedDepositStatus === 'released' ? 'released' : 'captured',
          final_decision_at: new Date()?.toISOString(),
          payment_released_at: normalizedDepositStatus === 'released' ? new Date()?.toISOString() : null,
          updated_at: new Date()?.toISOString()
        })?.eq('reservation_id', id);

        await reservationPhotoCleanupService?.purgeReservationPhotosAfterPayment(id, {
          suppressErrors: true
        });
      }

      return { data, error: null };
    } catch (error) {
      console.error('Update deposit status error:', error);
      throw error;
    }
  },

  /**
   * Confirm one pickup-day checklist step.
   * Allowed steps:
   * - handover_completed
   * - rental_started
   */
  confirmPickupStep: async (id, step) => {
    try {
      const reservationId = normalizeId(id);
      const normalizedStep = String(step || '')?.trim()?.toLowerCase();

      if (!reservationId || !normalizedStep) {
        return { data: null, error: { message: 'Reservation ou etape invalide.' } };
      }

      const { data, error } = await supabase?.rpc('confirm_reservation_pickup_step', {
        p_reservation_id: reservationId,
        p_step: normalizedStep
      });

      if (error) {
        if (isSchemaError(error)) {
          return {
            data: null,
            error: { message: "Le workflow de demarrage n'est pas encore actif sur cette base." }
          };
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Confirm pickup step error:', error);
      throw error;
    }
  },

  /**
   * Update document upload status
   */
  updateDocumentStatus: async (id, documentType, uploaded = true) => {
    try {
      const fieldMap = {
        'id': { uploaded: 'tenant_id_uploaded_at', done: 'tenant_id_done_at' },
        'rc': { uploaded: 'tenant_rc_uploaded_at', done: 'tenant_rc_done_at' },
        'address': { uploaded: 'tenant_address_uploaded_at', done: 'tenant_address_done_at' }
      };

      const fields = fieldMap?.[documentType];
      if (!fields) return { data: null, error: { message: 'Invalid document type' } };

      const updateData = {
        [fields?.uploaded]: uploaded ? new Date()?.toISOString() : null,
        updated_at: new Date()?.toISOString()
      };

      const { data, error } = await supabase?.from('reservations')?.update(updateData)?.eq('id', id)?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans updateDocumentStatus:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Update document status error:', error);
      throw error;
    }
  },

  /**
   * Get reservations by annonce ID
   */
  getReservationsByAnnonce: async (annonceId) => {
    try {
      const { data, error } = await supabase?.from('reservations')?.select('*')?.eq('annonce_id', annonceId)?.order('start_date', { ascending: true });

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getReservationsByAnnonce:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get reservations by annonce error:', error);
      throw error;
    }
  },

  /**
   * Check availability for dates
   */
  checkAvailability: async (annonceId, startDate, endDate) => {
    try {
      const normalizedStartDate = toReservationDateOnly(startDate);
      const normalizedEndDate = toReservationDateOnly(endDate || startDate);
      if (!annonceId || !normalizedStartDate || !normalizedEndDate) {
        return { available: false, error: { message: 'Dates de disponibilite invalides.' } };
      }

      const { data, error } = await supabase
        ?.from('reservations')
        ?.select('id, start_date, end_date')
        ?.eq('annonce_id', annonceId)
        ?.in('status', AVAILABILITY_HOLD_STATUSES)
        ?.lte('start_date', normalizedEndDate)
        ?.gte('end_date', normalizedStartDate);

      if (error) {
        if (error?.code === 'PGRST116') return { available: true, error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans checkAvailability:', error?.message);
          throw error;
        }
        return { available: false, error };
      }

      return { available: data?.length === 0, conflictingReservations: data, error: null };
    } catch (error) {
      console.error('Check availability error:', error);
      throw error;
    }
  },

  /**
   * Check if a user currently has at least one ongoing reservation
   * (active status and today's date within reservation period).
   */
  userHasAnyOngoingReservation: async (userId) => {
    try {
      if (!userId) {
        return { data: false, error: null };
      }

      const normalizedUserId = String(userId);
      const todayIsoDate = getIsoDateOnly(new Date());
      if (!todayIsoDate) {
        return { data: false, error: null };
      }

      const { count, error } = await supabase
        ?.from('reservations')
        ?.select('id', { count: 'exact', head: true })
        ?.in('status', ONGOING_RESERVATION_STATUSES)
        ?.lte('start_date', todayIsoDate)
        ?.gte('end_date', todayIsoDate)
        ?.or(`owner_id.eq.${normalizedUserId},renter_id.eq.${normalizedUserId}`);

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schema dans userHasAnyOngoingReservation:', error?.message);
          throw error;
        }
        return { data: false, error };
      }

      return { data: Number(count || 0) > 0, error: null };
    } catch (error) {
      console.error('Check user ongoing reservations error:', error);
      throw error;
    }
  },

  /**
   * Check if two users currently have an ongoing reservation relationship.
   * Used to gate direct contact/messaging from listing page.
   */
  hasOngoingReservationLinkBetweenUsers: async ({ userId, otherUserId, annonceId = null } = {}) => {
    try {
      if (!userId || !otherUserId) {
        return { data: false, error: null };
      }

      const left = String(userId);
      const right = String(otherUserId);
      const todayIsoDate = getIsoDateOnly(new Date());
      if (!todayIsoDate) {
        return { data: false, error: null };
      }

      let query = supabase
        ?.from('reservations')
        ?.select('id', { count: 'exact', head: true })
        ?.in('status', ONGOING_RESERVATION_STATUSES)
        ?.lte('start_date', todayIsoDate)
        ?.gte('end_date', todayIsoDate)
        ?.or(`and(owner_id.eq.${left},renter_id.eq.${right}),and(owner_id.eq.${right},renter_id.eq.${left})`);

      if (annonceId !== null && annonceId !== undefined && annonceId !== '') {
        query = query?.eq('annonce_id', annonceId);
      }

      const { count, error } = await query;

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans hasOngoingReservationLinkBetweenUsers:', error?.message);
          throw error;
        }
        return { data: false, error };
      }

      return { data: Number(count || 0) > 0, error: null };
    } catch (error) {
      console.error('Check ongoing reservation link error:', error);
      throw error;
    }
  },

  /**
   * Check if two users have at least one reservation that is chat-eligible.
   * Unlike the "ongoing" check, this one does not require date overlap with today:
   * it allows contact as soon as reservation is confirmed/paid and until it is closed.
   */
  hasChatEligibleReservationLinkBetweenUsers: async ({ userId, otherUserId, annonceId = null } = {}) => {
    try {
      if (!userId || !otherUserId) {
        return { data: false, error: null };
      }

      const left = String(userId);
      const right = String(otherUserId);

      let query = supabase
        ?.from('reservations')
        ?.select('id', { count: 'exact', head: true })
        ?.in('status', CHAT_ELIGIBLE_RESERVATION_STATUSES)
        ?.or(`and(owner_id.eq.${left},renter_id.eq.${right}),and(owner_id.eq.${right},renter_id.eq.${left})`);

      if (annonceId !== null && annonceId !== undefined && annonceId !== '') {
        query = query?.eq('annonce_id', annonceId);
      }

      const { count, error } = await query;

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schema dans hasChatEligibleReservationLinkBetweenUsers:', error?.message);
          throw error;
        }
        return { data: false, error };
      }

      return { data: Number(count || 0) > 0, error: null };
    } catch (error) {
      console.error('Check chat-eligible reservation link error:', error);
      throw error;
    }
  }
};

export default reservationService;






