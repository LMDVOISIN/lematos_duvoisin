import { supabase } from '../lib/supabase';
import { sendEmail } from './emailService';
import { construireSlugAnnonce, construireUrlAnnonce, construireUrlAnnonceAbsolue } from '../utils/listingUrl';
import avisService from './avisService';
import notificationService from './notificationService';
import { buildPromotionSharePayload, getSocialPromotionNetworks } from './socialPromotionService';

/**
 * Service annonce
 * Maps to 'annonces' table
 * Gère les annonces d'équipement (offres et demandes)
 */

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_TIMEOUT_MS = 7000;

const toTrimmedText = (value) => String(value || '')?.trim();

const parseCoordinate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const shouldRecomputeAnnonceSlug = (payload = {}) => (
  ['titre', 'title', 'ville', 'city']?.some((key) => Object.prototype.hasOwnProperty.call(payload, key))
);

const hasValidCoordinates = (latitude, longitude) => {
  const lat = parseCoordinate(latitude);
  const lng = parseCoordinate(longitude);
  if (lat === null || lng === null) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

const buildAnnonceGeocodeQueryCandidates = (payload = {}) => {
  const address = toTrimmedText(payload?.address || payload?.adresse);
  const postalCode = toTrimmedText(payload?.postal_code || payload?.code_postal);
  const city = toTrimmedText(payload?.city || payload?.ville);
  const cityLine = [postalCode, city]?.filter(Boolean)?.join(' ');

  const queryCandidates = [
    [address, cityLine, 'France']?.filter(Boolean)?.join(', '),
    [cityLine, 'France']?.filter(Boolean)?.join(', '),
    [city, 'France']?.filter(Boolean)?.join(', '),
    [postalCode, 'France']?.filter(Boolean)?.join(', ')
  ]?.filter(Boolean);

  return [...new Set(queryCandidates)];
};

const payloadTouchesLocation = (payload = {}) => {
  const watchedKeys = [
    'address',
    'adresse',
    'city',
    'ville',
    'postal_code',
    'code_postal',
    'latitude',
    'longitude'
  ];

  return watchedKeys?.some((key) => Object.prototype.hasOwnProperty.call(payload, key));
};

const geocodeAnnoncePayloadLocation = async (payload = {}) => {
  const queryCandidates = buildAnnonceGeocodeQueryCandidates(payload);
  if (!queryCandidates?.length) return null;

  for (const query of queryCandidates) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);

    try {
      const searchParams = new URLSearchParams({
        format: 'jsonv2',
        limit: '1',
        countrycodes: 'fr',
        q: query
      });

      const response = await fetch(`${NOMINATIM_SEARCH_URL}?${searchParams?.toString()}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'fr'
        },
        signal: controller.signal
      });

      if (!response?.ok) continue;

      const payloadData = await response?.json();
      const firstMatch = Array.isArray(payloadData) ? payloadData?.[0] : null;
      const latitude = parseCoordinate(firstMatch?.lat);
      const longitude = parseCoordinate(firstMatch?.lon);

      if (!hasValidCoordinates(latitude, longitude)) continue;
      return { latitude, longitude };
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.warn('[annonceService] Geocodage adresse impossible:', error?.message || error);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return null;
};

const enrichAnnoncePayloadWithCoordinates = async (payload = {}, options = {}) => {
  const requireLocationTouch = Boolean(options?.requireLocationTouch);
  const context = options?.context || 'annonce_mutation';
  const hasLatitudeKey = Object.prototype.hasOwnProperty.call(payload, 'latitude');
  const hasLongitudeKey = Object.prototype.hasOwnProperty.call(payload, 'longitude');

  const nextPayload = { ...payload };
  const latitude = parseCoordinate(nextPayload?.latitude);
  const longitude = parseCoordinate(nextPayload?.longitude);

  if (hasValidCoordinates(latitude, longitude)) {
    if (hasLatitudeKey) nextPayload.latitude = latitude;
    if (hasLongitudeKey) nextPayload.longitude = longitude;
    return nextPayload;
  }

  if (requireLocationTouch && !payloadTouchesLocation(nextPayload)) {
    return nextPayload;
  }

  const hasLocationText = Boolean(
    toTrimmedText(nextPayload?.address || nextPayload?.adresse)
    || toTrimmedText(nextPayload?.city || nextPayload?.ville)
    || toTrimmedText(nextPayload?.postal_code || nextPayload?.code_postal)
  );

  if (!hasLocationText) {
    if (hasLatitudeKey) nextPayload.latitude = latitude;
    if (hasLongitudeKey) nextPayload.longitude = longitude;
    return nextPayload;
  }

  const geocodedCoordinates = await geocodeAnnoncePayloadLocation(nextPayload);
  if (!geocodedCoordinates) {
    if (hasLatitudeKey) nextPayload.latitude = latitude;
    if (hasLongitudeKey) nextPayload.longitude = longitude;
    console.warn(`[annonceService] Coordonnees introuvables via geocodage (${context})`);
    return nextPayload;
  }

  nextPayload.latitude = geocodedCoordinates?.latitude;
  nextPayload.longitude = geocodedCoordinates?.longitude;
  return nextPayload;
};

function isSchemaError(error) {
  if (!error) return false;
  if (error?.code && typeof error?.code === 'string') {
    const errorClass = error?.code?.substring(0, 2);
    if (errorClass === '42' || errorClass === '08') return true;
  }
  if (error?.message) {
    const schemaErrorPatterns = [
      /relation.*does not exist/i,
      /column.*does not exist/i,
      /function.*does not exist/i,
      /syntax error/i,
      /schema cache/i,
      /could not find .* column .* in the schema cache/i,
    ];
    return schemaErrorPatterns?.some(pattern => pattern?.test(error?.message));
  }
  return false;
}

function extractMissingColumnName(error) {
  const message = String(error?.message || '');
  const patterns = [
    /column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i,
    /colonne\s+"?([a-zA-Z0-9_]+)"?\s+n['â€™]existe pas/i,
    /could not find the\s+['"]?([a-zA-Z0-9_]+)['"]?\s+column/i,
  ];

  for (const pattern of patterns) {
    const match = message?.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

async function runAnnonceMutationWithSchemaFallback({ label, payload, mutate }) {
  let nextPayload = { ...payload };
  let attempts = 0;

  while (attempts < 12) {
    const { data, error } = await mutate(nextPayload);
    if (!error) return { data, error: null };

    if (!isSchemaError(error)) return { data: null, error };

    const missingColumn = extractMissingColumnName(error);
    const canStripColumn = Boolean(
      missingColumn && Object.prototype.hasOwnProperty.call(nextPayload, missingColumn)
    );

    if (!canStripColumn) {
      console.error(`Erreur de schema dans ${label}:`, error?.message);
      throw error;
    }

    delete nextPayload[missingColumn];
    attempts += 1;
    console.warn(`[annonceService] Colonne absente ignoree dans ${label}: ${missingColumn}`);
  }

  return {
    data: null,
    error: {
      code: 'ANNONCE_SCHEMA_MISMATCH',
      message: "Schema de la table 'annonces' incomplet. Appliquez les migrations."
    }
  };
}

function parseEmailList(value) {
  return String(value || '')
    .split(/[;,]/)
    .map((item) => item?.trim())
    .filter(Boolean);
}

function getModerationRecipientEmailsFromEnv() {
  const env = import.meta?.env || {};
  const candidates = [
    env?.VITE_MODERATOR_EMAILS,
    env?.VITE_ADMIN_MODERATION_EMAILS,
    env?.VITE_MODERATION_INBOX,
    // Fallback hardcoded pour eviter de bloquer les alertes moderation
    'contact@lematosduvoisin.fr'
  ];

  return [...new Set(candidates.flatMap(parseEmailList))];
}

function deriveModerationStatusFromStatut(statut) {
  const normalized = String(statut || '')?.toLowerCase();
  if (normalized === 'publiee' || normalized === 'published') return 'approved';
  if (normalized === 'refusee' || normalized === 'rejected') return 'rejected';
  if (normalized === 'en_attente' || normalized === 'pending') return 'pending';
  return null;
}

function isUniqueViolation(error) {
  return String(error?.code || '') === '23505';
}

function isAnnonceSubmissionTokenConflict(error) {
  if (!isUniqueViolation(error)) return false;

  const diagnostic = [
    error?.constraint,
    error?.message,
    error?.details,
    error?.hint
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return diagnostic?.includes('annonces_owner_client_submission_token_uidx')
    || diagnostic?.includes('client_submission_token');
}

async function findAnnonceBySubmissionToken(ownerId, token) {
  if (!ownerId || !token) return null;

  const { data, error } = await supabase
    ?.from('annonces')
    ?.select('*')
    ?.eq('owner_id', ownerId)
    ?.eq('client_submission_token', token)
    ?.maybeSingle();

  if (error && error?.code !== 'PGRST116') {
    console.warn('Recherche annonce par token de soumission impossible:', error?.message || error);
    return null;
  }

  return data || null;
}

async function sendAnnonceSubmissionEmails({ annonce, ownerId }) {
  if (!annonce || !ownerId) return;

  const { data: ownerProfile } = await supabase
    ?.from('profiles')
    ?.select('pseudo, email')
    ?.eq('id', ownerId)
    ?.single();

  if (ownerProfile?.email) {
    const ownerResult = await sendEmail({
      to: ownerProfile?.email,
      templateKey: 'annonce_created_owner',
      variables: {
        owner_name: ownerProfile?.pseudo || 'Utilisateur',
        annonce_title: annonce?.titre,
        annonce_url: construireUrlAnnonceAbsolue(annonce, window.location?.origin)
      }
    });

    if (!ownerResult?.success) {
      console.warn("Echec d'envoi e-mail propriétaire (soumission annonce):", ownerResult?.error);
    }
  }

  const { data: admins } = await supabase
    ?.from('profiles')
    ?.select('email, pseudo')
    ?.eq('is_admin', true);

  const adminEmails = (admins || [])
    .map((admin) => admin?.email)
    .filter(Boolean);
  const moderationRecipients = [...new Set([
    ...adminEmails,
    ...getModerationRecipientEmailsFromEnv()
  ])];

  if (moderationRecipients?.length > 0) {
    for (const moderationEmail of moderationRecipients) {
      const adminResult = await sendEmail({
        to: moderationEmail,
        templateKey: 'annonce_moderation_alert',
        variables: {
          annonce_title: annonce?.titre,
          owner_name: ownerProfile?.pseudo || 'Utilisateur',
          owner_email: ownerProfile?.email,
          category: annonce?.categorie || 'Non specifiee',
          price: annonce?.prix_jour || '0',
          admin_url: `${window.location?.origin}/administration-moderation`
        }
      });

      if (!adminResult?.success) {
        console.warn("Echec d'envoi e-mail moderateur (soumission annonce):", adminResult?.error, moderationEmail);
      }
    }
  }
}

const annonceService = {
  /**
   * Récupérer toutes les annonces avec filtres
   */
  getAnnonces: async (filters = {}) => {
    try {
      let query = supabase?.from('annonces')?.select('*');

      // Appliquer les filtres
      if (filters?.type) query = query?.eq('type', filters?.type);
      if (filters?.categorie) query = query?.eq('categorie', filters?.categorie);
      if (filters?.ville) query = query?.ilike('ville', `%${filters?.ville}%`);
      if (filters?.city) query = query?.ilike('city', `%${filters?.city}%`);
      if (filters?.statut) query = query?.eq('statut', filters?.statut);
      if (filters?.published !== undefined) query = query?.eq('published', filters?.published);
      if (filters?.is_public !== undefined) query = query?.eq('is_public', filters?.is_public);
      if (filters?.owner_id) query = query?.eq('owner_id', filters?.owner_id);
      
      // Price range
      if (filters?.prix_min) query = query?.gte('prix_jour', filters?.prix_min);
      if (filters?.prix_max) query = query?.lte('prix_jour', filters?.prix_max);

      // Recherche
      if (filters?.search) {
        query = query?.or(`titre.ilike.%${filters?.search}%,description.ilike.%${filters?.search}%`);
      }

      // Tri
      const orderBy = filters?.orderBy || 'created_at';
      const ascending = filters?.ascending !== undefined ? filters?.ascending : false;
      query = query?.order(orderBy, { ascending });

      // Pagination
      if (filters?.limit) query = query?.limit(filters?.limit);
      if (filters?.offset) query = query?.range(filters?.offset, filters?.offset + (filters?.limit || 10) - 1);

      const { data, error, count } = await query;

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null, count: 0 };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getAnnonces:', error?.message);
          throw error;
        }
        return { data: null, error, count: 0 };
      }

      // Récupérer les profils propriétaires séparément pour éviter les problèmes de relation FK
      if (data && data?.length > 0) {
        const ownerIds = [...new Set(data?.map(a => a?.owner_id || a?.user_id)?.filter(Boolean))];
        if (ownerIds?.length > 0) {
          const { data: profiles } = await supabase?.from('profiles')?.select('id, pseudo, avatar_url')?.in('id', ownerIds);
          const profileMap = {};
          profiles?.forEach(p => { profileMap[p?.id] = p; });
          data?.forEach(annonce => {
            const ownerId = annonce?.owner_id || annonce?.user_id;
            annonce.owner = profileMap?.[ownerId] || null;
          });
        }
      }

      return { data, error: null, count };
    } catch (error) {
      console.error('Erreur lors de la récupération des annonces :', error);
      throw error;
    }
  },

  /**
   * Récupérer une annonce par identifiant
   */
  getAnnonceById: async (id) => {
    try {
      const { data, error } = await supabase?.from('annonces')?.select('*')?.eq('id', id)?.maybeSingle();

      if (error) {
        if (error?.code === 'PGRST116') return { data: null, error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getAnnonceById:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      // Récupérer le profil propriétaire séparément
      if (data) {
        const ownerId = data?.owner_id || data?.user_id;
        if (ownerId) {
          const [{ data: profile }, { data: ownerRatingSummary, error: ownerRatingError }] = await Promise.all([
            supabase?.from('profiles')?.select('id, pseudo, avatar_url, phone, email')?.eq('id', ownerId)?.maybeSingle(),
            avisService?.getUserRatingSummary(ownerId, { role: 'owner' })
          ]);

          if (ownerRatingError) {
            console.warn('[annonceService] Impossible de calculer la note propriétaire:', ownerRatingError?.message || ownerRatingError);
          }

          const reviewCount = Number(ownerRatingSummary?.reviewCount || 0);
          const averageRating = Number(ownerRatingSummary?.averageRating);
          const roundedRating =
            reviewCount > 0 && Number.isFinite(averageRating)
              ? Math.round(averageRating * 10) / 10
              : null;

          data.owner = profile ? {
            ...profile,
            review_count: reviewCount,
            nombre_avis: reviewCount,
            rating: roundedRating,
            note_moyenne: roundedRating
          } : null;
        }
      }

      return { data, error: null };
    } catch (error) {
      console.error("Erreur lors de la récupération de l'annonce par identifiant :", error);
      throw error;
    }
  },

  /**
   * Récupérer une annonce par slug
   */
  getAnnonceBySlug: async (slug) => {
    try {
      const { data, error } = await supabase?.from('annonces')?.select('*')?.eq('slug', slug)?.maybeSingle();

      if (error) {
        if (error?.code === 'PGRST116') return { data: null, error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getAnnonceBySlug:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      // Récupérer le profil propriétaire séparément
      if (data) {
        const ownerId = data?.owner_id || data?.user_id;
        if (ownerId) {
          const [{ data: profile }, { data: ownerRatingSummary, error: ownerRatingError }] = await Promise.all([
            supabase?.from('profiles')?.select('id, pseudo, avatar_url, phone, email')?.eq('id', ownerId)?.maybeSingle(),
            avisService?.getUserRatingSummary(ownerId, { role: 'owner' })
          ]);

          if (ownerRatingError) {
            console.warn('[annonceService] Impossible de calculer la note propriétaire (slug):', ownerRatingError?.message || ownerRatingError);
          }

          const reviewCount = Number(ownerRatingSummary?.reviewCount || 0);
          const averageRating = Number(ownerRatingSummary?.averageRating);
          const roundedRating =
            reviewCount > 0 && Number.isFinite(averageRating)
              ? Math.round(averageRating * 10) / 10
              : null;

          data.owner = profile ? {
            ...profile,
            review_count: reviewCount,
            nombre_avis: reviewCount,
            rating: roundedRating,
            note_moyenne: roundedRating
          } : null;
        }
      }

      return { data, error: null };
    } catch (error) {
      console.error('Récupérer une annonce par slug error:', error);
      throw error;
    }
  },

  /**
   * Créer une nouvelle annonce
   */
  createAnnonce: async (annonceData) => {
    try {
      const { data: { user } } = await supabase?.auth?.getUser();
      if (!user) return { data: null, error: { message: 'User not authenticated' } };
      const submissionToken = String(annonceData?.client_submission_token || '')?.trim();

      let dataToInsert = {
        ...annonceData,
        ...(submissionToken ? { client_submission_token: submissionToken } : {}),
        owner_id: user?.id,
        slug: construireSlugAnnonce(annonceData),
        statut: annonceData?.statut || 'en_attente',
        published: typeof annonceData?.published === 'boolean' ? annonceData?.published : false,
        created_at: new Date()?.toISOString()
      };
      dataToInsert = await enrichAnnoncePayloadWithCoordinates(dataToInsert, {
        context: 'createAnnonce'
      });

      const { data, error } = await runAnnonceMutationWithSchemaFallback({
        label: 'createAnnonce',
        payload: dataToInsert,
        mutate: (payload) =>
          supabase?.from('annonces')?.insert(payload)?.select()?.single()
      });

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans createAnnonce:', error?.message);
          throw error;
        }
        if (submissionToken && isAnnonceSubmissionTokenConflict(error)) {
          const existingAnnonce = await findAnnonceBySubmissionToken(user?.id, submissionToken);
          if (existingAnnonce) {
            console.warn('[annonceService] Creation annonce dedupliquee via client_submission_token');
            return { data: existingAnnonce, error: null };
          }
        }
        return { data: null, error };
      }

      // Envoyer un e-mail au propriétaire : annonce créée
      const { data: ownerProfile } = await supabase?.from('profiles')?.select('pseudo, email')?.eq('id', user?.id)?.single();
      if (ownerProfile?.email) {
        await sendEmail({
          to: ownerProfile?.email,
          templateKey: 'annonce_created_owner',
          variables: {
            owner_name: ownerProfile?.pseudo || 'Utilisateur',
            annonce_title: data?.titre,
            annonce_url: construireUrlAnnonceAbsolue(data, window.location?.origin)
          }
        });
      }

      // Envoyer un e-mail à l'équipe de modération
      const { data: admins } = await supabase?.from('profiles')?.select('email, pseudo')?.eq('is_admin', true);
      if (admins && admins?.length > 0) {
        for (const admin of admins) {
          await sendEmail({
            to: admin?.email,
            templateKey: 'annonce_moderation_alert',
            variables: {
              annonce_title: data?.titre,
              owner_name: ownerProfile?.pseudo || 'Utilisateur',
              owner_email: ownerProfile?.email,
              category: data?.categorie || 'Non spécifiée',
              price: data?.prix_jour || '0',
              admin_url: `${window.location?.origin}/administration-moderation`
            }
          });
        }
      }

      const hasAdminRecipient = (admins || [])?.some((admin) => Boolean(admin?.email));
      if (!hasAdminRecipient) {
        for (const moderationEmail of getModerationRecipientEmailsFromEnv()) {
          await sendEmail({
            to: moderationEmail,
            templateKey: 'annonce_moderation_alert',
            variables: {
              annonce_title: data?.titre,
              owner_name: ownerProfile?.pseudo || 'Utilisateur',
              owner_email: ownerProfile?.email,
              category: data?.categorie || 'Non specifiee',
              price: data?.prix_jour || '0',
              admin_url: `${window.location?.origin}/administration-moderation`
            }
          });
        }
      }

      return { data, error: null };
    } catch (error) {
      console.error("Erreur lors de la création de l'annonce :", error);
      throw error;
    }
  },

  /**
   * Mettre à jour une annonce
   */
  updateAnnonce: async (id, updates) => {
    try {
      const { data: { user } } = await supabase?.auth?.getUser();
      if (!user) return { data: null, error: { message: 'User not authenticated' } };

      let dataToUpdate = {
        ...updates,
        updated_at: new Date()?.toISOString()
      };

      if (shouldRecomputeAnnonceSlug(updates)) {
        const { data: currentAnnonce } = await supabase
          ?.from('annonces')
          ?.select('id, titre, ville, city')
          ?.eq('id', id)
          ?.eq('owner_id', user?.id)
          ?.maybeSingle();

        const slugSource = {
          titre: updates?.titre ?? updates?.title ?? currentAnnonce?.titre,
          title: updates?.title ?? updates?.titre ?? currentAnnonce?.title ?? currentAnnonce?.titre,
          ville: updates?.ville ?? updates?.city ?? currentAnnonce?.ville ?? currentAnnonce?.city,
          city: updates?.city ?? updates?.ville ?? currentAnnonce?.city ?? currentAnnonce?.ville
        };

        dataToUpdate.slug = construireSlugAnnonce(slugSource);
      }

      dataToUpdate = await enrichAnnoncePayloadWithCoordinates(dataToUpdate, {
        requireLocationTouch: true,
        context: 'updateAnnonce'
      });

      const { data, error } = await runAnnonceMutationWithSchemaFallback({
        label: 'updateAnnonce',
        payload: dataToUpdate,
        mutate: (payload) =>
          supabase
            ?.from('annonces')
            ?.update(payload)
            ?.eq('id', id)
            ?.eq('owner_id', user?.id)
            ?.select()
            ?.maybeSingle()
      });

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans updateAnnonce:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      if (!data) {
        return {
          data: null,
          error: {
            code: 'ANNONCE_UPDATE_NOT_FOUND',
            message: "Annonce introuvable ou non autorisée pour la mise ? jour."
          }
        };
      }

      if (String(updates?.statut || '')?.toLowerCase() === 'en_attente') {
        await sendAnnonceSubmissionEmails({ annonce: data, ownerId: user?.id });
      }

      return { data, error: null };
    } catch (error) {
      console.error('Mettre à jour une annonce error:', error);
      throw error;
    }
  },

  /**
   * Supprimer une annonce
   */
  deleteAnnonce: async (id) => {
    try {
      const { data: { user } } = await supabase?.auth?.getUser();
      if (!user) return { error: { message: 'User not authenticated' } };

      const { error } = await supabase?.from('annonces')?.delete()?.eq('id', id)?.eq('owner_id', user?.id);

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans deleteAnnonce:', error?.message);
          throw error;
        }
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Supprimer une annonce error:', error);
      throw error;
    }
  },

  /**
   * Publier une annonce
   */
  publishAnnonce: async (id) => {
    try {
      const { data, error } = await supabase?.from('annonces')?.update({ 
          published: true, 
          published_at: new Date()?.toISOString(),
          updated_at: new Date()?.toISOString()
        })?.eq('id', id)?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans publishAnnonce:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Publier une annonce error:', error);
      throw error;
    }
  },

  /**
   * Mettre à jour le statut de modération
   */
  updateModerationStatus: async (id, status, reason = null) => {
    try {
      const { data, error } = await runAnnonceMutationWithSchemaFallback({
        label: 'updateModerationStatus',
        payload: {
          moderation_status: status,
          moderation_reason: reason,
          updated_at: new Date()?.toISOString()
        },
        mutate: (payload) =>
          supabase?.from('annonces')?.update(payload)?.eq('id', id)?.select()?.single()
      });

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans updateModerationStatus:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Mettre à jour le statut de modération error:', error);
      throw error;
    }
  },

  /**
   * Mettre à jour une annonce status (admin moderation)
   */
  updateAnnonceStatus: async (id, newStatus, moderationReason = null) => {
    try {
      const moderationStatus = deriveModerationStatusFromStatut(newStatus);
      const updateData = {
        statut: newStatus,
        published: newStatus === 'publiee',
        moderation_reason: moderationReason,
        updated_at: new Date()?.toISOString(),
        ...(moderationStatus ? { moderation_status: moderationStatus } : {})
      };

      const { data, error } = await runAnnonceMutationWithSchemaFallback({
        label: 'updateAnnonceStatus',
        payload: updateData,
        mutate: (payload) =>
          supabase?.from('annonces')?.update(payload)?.eq('id', id)?.select()?.single()
      });

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans updateAnnonceStatus:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      // Récupérer l'e-mail du propriétaire
      const { data: ownerProfile } = await supabase?.from('profiles')?.select('email, pseudo')?.eq('id', data?.owner_id)?.single();

      if (ownerProfile?.email) {
        // Envoyer l'e-mail approprié selon le statut
        if (newStatus === 'publiee') {
          await sendEmail({
            to: ownerProfile?.email,
            templateKey: 'annonce_published_owner',
            variables: {
              owner_name: ownerProfile?.pseudo || 'Utilisateur',
              annonce_title: data?.titre,
              annonce_url: construireUrlAnnonceAbsolue(data, window.location?.origin)
            }
          });
        } else if (newStatus === 'refusee') {
          await sendEmail({
            to: ownerProfile?.email,
            templateKey: 'annonce_rejected_owner',
            variables: {
              owner_name: ownerProfile?.pseudo || 'Utilisateur',
              annonce_title: data?.titre,
              rejection_reason: moderationReason || 'Non spécifiée',
              annonce_edit_url: `${window.location?.origin}/creer-annonce?edit=${data?.id}`
            }
          });
        }
      }

      if (newStatus === 'publiee' && data?.owner_id) {
        try {
          const promotionSharePayload = buildPromotionSharePayload(data, window.location?.origin);

          await notificationService?.createNotification(
            data?.owner_id,
            notificationService?.TYPES?.ANNONCE_APPROVED || 'annonce_approved',
            {
              promotion_ready: true,
              annonce_id: data?.id,
              annonce_title: data?.titre || data?.title || 'Votre annonce',
              image_url: promotionSharePayload?.imageUrl,
              share_url: promotionSharePayload?.url,
              share_title: promotionSharePayload?.title,
              share_description: promotionSharePayload?.description,
              actionLink: construireUrlAnnonce(data),
              actionLabel: "Voir l'annonce",
              social_networks: getSocialPromotionNetworks()?.map((network) => network?.id)
            },
            {
              title: 'Annonce validee',
              message: 'Votre annonce est en ligne. Partagez-la sur vos reseaux pour augmenter sa visibilite.'
            }
          );
        } catch (notificationError) {
          console.warn('Annonce validee mais notification de promotion impossible:', notificationError?.message || notificationError);
        }
      }

      if (newStatus === 'refusee' && data?.owner_id) {
        try {
          await notificationService?.createNotification(
            data?.owner_id,
            notificationService?.TYPES?.ANNONCE_REJECTED || 'annonce_rejected',
            {
              annonce_id: data?.id,
              annonce_title: data?.titre || data?.title || 'Votre annonce',
              actionLink: `/creer-annonce?edit=${data?.id}`,
              actionLabel: "Corriger l'annonce",
              message: moderationReason || "Votre annonce n'a pas pu etre validee."
            },
            {
              title: 'Annonce refusee',
              message: moderationReason || "Votre annonce n'a pas pu etre validee."
            }
          );
        } catch (notificationError) {
          console.warn('Annonce refusee mais notification utilisateur impossible:', notificationError?.message || notificationError);
        }
      }

      return { data, error: null };
    } catch (error) {
      console.error('Mettre à jour une annonce status error:', error);
      throw error;
    }
  },

  /**
   * Récupérer les annonces de l'utilisateur
   */
  getUserAnnonces: async (userId) => {
    try {
      const { data, error } = await supabase?.from('annonces')?.select('*')?.eq('owner_id', userId)?.order('created_at', { ascending: false });

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getUserAnnonces:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Erreur lors de la récupération des annonces utilisateur :', error);
      throw error;
    }
  },

  /**
   * Ajouter des dates indisponibles
   */
  addUnavailableDates: async (id, dates) => {
    try {
      const { data: annonce } = await annonceService?.getAnnonceById(id);
      const currentDates = annonce?.unavailable_dates || [];
      const updatedDates = [...new Set([...currentDates, ...dates])];

      const { data, error } = await supabase?.from('annonces')?.update({ 
          unavailable_dates: updatedDates,
          updated_at: new Date()?.toISOString()
        })?.eq('id', id)?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans addUnavailableDates:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Ajouter des dates indisponibles error:', error);
      throw error;
    }
  },

  /**
   * Rechercher des annonces par localisation (latitude/longitude)
   */
  searchByLocation: async (lat, lng, radiusKm = 10) => {
    try {
      // Utilisation du calcul de distance PostGIS (si disponible)
      const { data, error } = await supabase?.rpc('search_annonces_by_location', {
        search_lat: lat,
        search_lng: lng,
        radius_km: radiusKm
      });

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans searchByLocation:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Erreur de recherche par localisation :', error);
      throw error;
    }
  }
};

export default annonceService;







