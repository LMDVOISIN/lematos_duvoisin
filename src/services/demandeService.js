import { supabase } from '../lib/supabase';
import { sendEmail } from './emailService';
import notificationService from './notificationService';

/**
 * Demande Service
 * Maps to 'demandes' table
 * Handles user requests/demands for equipment
 */

const OPTIONAL_DEMANDE_COLUMNS = new Set(['code_postal', 'moderation_status', 'categorie_slug', 'library_image_id']);

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
      /could not find .* column .* in the schema cache/i
    ];
    return schemaErrorPatterns?.some((pattern) => pattern?.test(error?.message));
  }
  return false;
}

function extractMissingColumnName(error) {
  const message = String(error?.message || '');
  const patterns = [
    /column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i,
    /colonne\s+"?([a-zA-Z0-9_]+)"?\s+n['’]existe pas/i,
    /could not find the\s+['"]?([a-zA-Z0-9_]+)['"]?\s+column/i
  ];

  for (const pattern of patterns) {
    const match = message?.match(pattern);
    if (match?.[1]) return match?.[1];
  }

  return null;
}

function isDemandesProfilesRelationshipError(error) {
  const message = String(error?.message || '');
  const details = String(error?.details || '');
  if (error?.code !== 'PGRST200') return false;

  return /relationship between 'demandes' and 'profiles'/i?.test(message)
    || /relationship between 'demandes' and 'profiles'/i?.test(details);
}

async function attachProfilesToDemandes(demandes, { includeContact = false } = {}) {
  const rows = Array.isArray(demandes) ? demandes : [];
  if (rows?.length === 0) return rows;

  const profileIds = Array.from(new Set(rows?.map((row) => row?.user_id)?.filter(Boolean)));
  if (profileIds?.length === 0) return rows;

  const profileSelect = includeContact
    ? 'id, pseudo, avatar_url, email, phone'
    : 'id, pseudo, avatar_url';

  const { data: profiles, error } = await supabase
    ?.from('profiles')
    ?.select(profileSelect)
    ?.in('id', profileIds);

  if (error) {
    console.warn('Impossible de charger les profils rattaches aux demandes:', error?.message || error);
    return rows;
  }

  const profileById = {};
  (profiles || [])?.forEach((profile) => {
    if (profile?.id) profileById[profile?.id] = profile;
  });

  return rows?.map((row) => ({
    ...row,
    user: profileById?.[row?.user_id] || row?.user || null
  }));
}

async function attachLibraryImagesToDemandes(demandes) {
  const rows = Array.isArray(demandes) ? demandes : [];
  if (rows?.length === 0) return rows;

  const imageIds = Array.from(
    new Set(
      rows
        ?.map((row) => row?.library_image_id)
        ?.filter((value) => value !== null && value !== undefined && value !== '')
    )
  );

  if (imageIds?.length === 0) return rows;

  const { data: images, error } = await supabase
    ?.from('demande_object_images')
    ?.select(`
      id,
      title,
      alt_text,
      public_url,
      storage_path,
      category:categories(id, nom, slug),
      subcategory:subcategories(id, category_id, name, nom, slug)
    `)
    ?.in('id', imageIds);

  if (error) {
    console.warn("Impossible de charger les images rattachees aux demandes:", error?.message || error);
    return rows;
  }

  const imageById = {};
  (images || [])?.forEach((image) => {
    if (image?.id) {
      imageById[image.id] = {
        ...image,
        categoryLabel: image?.category?.nom || image?.category?.slug || '',
        subcategoryLabel: image?.subcategory?.nom || image?.subcategory?.name || image?.subcategory?.slug || ''
      };
    }
  });

  return rows?.map((row) => ({
    ...row,
    library_image: imageById?.[row?.library_image_id] || row?.library_image || null
  }));
}

async function attachLibraryImageToDemande(demande) {
  if (!demande) return null;

  const hydratedRows = await attachLibraryImagesToDemandes([demande]);
  return hydratedRows?.[0] || demande;
}

const toTrimmedText = (value) => String(value || '')?.trim();

const normalizePostalCode = (value) =>
  String(value || '')
    ?.replace(/\D/g, '')
    ?.slice(0, 5);

const normalizeInteger = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const normalizeIdentifier = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const normalizeDate = (value) => {
  const trimmedValue = toTrimmedText(value);
  return trimmedValue || null;
};

const parseEmailList = (value) =>
  String(value || '')
    .split(/[;,]/)
    .map((item) => item?.trim())
    .filter(Boolean);

const getModerationRecipientEmailsFromEnv = () => {
  const env = import.meta?.env || {};
  const candidates = [
    env?.VITE_DEMANDE_MODERATOR_EMAILS,
    env?.VITE_MODERATOR_EMAILS,
    env?.VITE_ADMIN_MODERATION_EMAILS,
    env?.VITE_MODERATION_INBOX,
    'contact@lematosduvoisin.fr'
  ];

  return [...new Set(candidates?.flatMap(parseEmailList))];
};

const getAppOrigin = () => {
  if (typeof window === 'undefined') return '';
  return window.location?.origin || '';
};

const buildAppUrl = (path = '') => {
  const origin = getAppOrigin();
  return origin ? `${origin}${path}` : path;
};

const getDemandeCategoryLabel = (demande = {}) =>
  toTrimmedText(demande?.categorie_slug || demande?.categorie) || 'Non specifiee';

const removeUndefinedFields = (payload = {}) =>
  Object.fromEntries(
    Object.entries(payload)?.filter(([, value]) => value !== undefined)
  );

const sanitizeDemandePayload = (payload = {}) => {
  const nextPayload = { ...payload };

  if (
    Object.prototype.hasOwnProperty.call(nextPayload, 'categorie_slug')
    && !Object.prototype.hasOwnProperty.call(nextPayload, 'categorie')
  ) {
    nextPayload.categorie = nextPayload?.categorie_slug;
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, 'titre')) {
    nextPayload.titre = toTrimmedText(nextPayload?.titre) || null;
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, 'description')) {
    nextPayload.description = toTrimmedText(nextPayload?.description) || null;
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, 'categorie_slug')) {
    nextPayload.categorie_slug = toTrimmedText(nextPayload?.categorie_slug) || null;
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, 'categorie')) {
    nextPayload.categorie = toTrimmedText(nextPayload?.categorie) || null;
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, 'ville')) {
    nextPayload.ville = toTrimmedText(nextPayload?.ville) || null;
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, 'code_postal')) {
    nextPayload.code_postal = normalizePostalCode(nextPayload?.code_postal) || null;
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, 'rayon_km')) {
    nextPayload.rayon_km = normalizeInteger(nextPayload?.rayon_km);
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, 'moderation_status')) {
    nextPayload.moderation_status = toTrimmedText(nextPayload?.moderation_status)?.toLowerCase() || null;
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, 'library_image_id')) {
    nextPayload.library_image_id = normalizeIdentifier(nextPayload?.library_image_id);
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, 'prix_max')) {
    nextPayload.prix_max = normalizeNumber(nextPayload?.prix_max);
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, 'dispo_de')) {
    nextPayload.dispo_de = normalizeDate(nextPayload?.dispo_de);
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, 'dispo_a')) {
    nextPayload.dispo_a = normalizeDate(nextPayload?.dispo_a);
  }

  return removeUndefinedFields(nextPayload);
};

const runDemandeMutation = async (operation, payload = {}) => {
  const firstAttempt = await operation(payload);
  if (!firstAttempt?.error) return firstAttempt;

  const missingColumn = extractMissingColumnName(firstAttempt?.error);
  if (
    !missingColumn
    || !OPTIONAL_DEMANDE_COLUMNS?.has(missingColumn)
    || !Object.prototype.hasOwnProperty.call(payload, missingColumn)
  ) {
    return firstAttempt;
  }

  const retryPayload = { ...payload };
  delete retryPayload[missingColumn];

  console.warn(`[demandeService] Colonne optionnelle absente: ${missingColumn}. Nouvelle tentative sans ce champ.`);
  return operation(retryPayload);
};

async function getDemandeOwnerProfile(userId) {
  if (!userId) {
    return { pseudo: '', email: '' };
  }

  try {
    const { data, error } = await supabase
      ?.from('profiles')
      ?.select('pseudo, email')
      ?.eq('id', userId)
      ?.maybeSingle();

    if (error) {
      console.warn('Lecture profil demande impossible:', error?.message || error);
      return { pseudo: '', email: '' };
    }

    return {
      pseudo: data?.pseudo || '',
      email: data?.email || ''
    };
  } catch (error) {
    console.warn('Lecture profil demande impossible:', error?.message || error);
    return { pseudo: '', email: '' };
  }
}

async function listDemandeModerationRecipients() {
  try {
    const { data: admins, error } = await supabase
      ?.from('profiles')
      ?.select('email')
      ?.eq('is_admin', true);

    if (error) {
      console.warn('Chargement des admins demandes impossible:', error?.message || error);
    }

    const adminEmails = (admins || [])
      ?.map((admin) => admin?.email)
      ?.filter(Boolean);

    return [...new Set([
      ...adminEmails,
      ...getModerationRecipientEmailsFromEnv()
    ])];
  } catch (error) {
    console.warn('Chargement des destinataires demandes impossible:', error?.message || error);
    return getModerationRecipientEmailsFromEnv();
  }
}

async function sendDemandeSubmissionEmails({ demande, ownerId }) {
  if (!demande || !ownerId) return;

  const ownerProfile = await getDemandeOwnerProfile(ownerId);
  const demandeUrl = buildAppUrl('/mes-annonces#demandes');
  const adminUrl = buildAppUrl('/administration-moderation');

  if (ownerProfile?.email) {
    const ownerResult = await sendEmail({
      to: ownerProfile?.email,
      templateKey: 'demande_created_requester',
      variables: {
        user_name: ownerProfile?.pseudo || ownerProfile?.email || 'Utilisateur',
        demande_title: demande?.titre || 'Votre demande',
        demande_category: getDemandeCategoryLabel(demande),
        demande_city: demande?.ville || 'Non precisee',
        demande_url: demandeUrl
      }
    });

    if (!ownerResult?.success) {
      console.warn("Echec d'envoi e-mail demandeur (creation demande):", ownerResult?.error);
    }
  }

  const moderationRecipients = await listDemandeModerationRecipients();
  for (const recipientEmail of moderationRecipients) {
    const adminResult = await sendEmail({
      to: recipientEmail,
      templateKey: 'demande_moderation_alert',
      variables: {
        demande_title: demande?.titre || 'Demande sans titre',
        demande_category: getDemandeCategoryLabel(demande),
        demande_city: demande?.ville || 'Non precisee',
        user_name: ownerProfile?.pseudo || 'Utilisateur',
        user_email: ownerProfile?.email || '',
        admin_url: adminUrl
      }
    });

    if (!adminResult?.success) {
      console.warn("Echec d'envoi e-mail admin (moderation demande):", adminResult?.error, recipientEmail);
    }
  }
}

async function sendDemandeDecisionSideEffects({ demande, status }) {
  if (!demande?.user_id) return;

  const normalizedStatus = toTrimmedText(status)?.toLowerCase();
  if (!['approved', 'rejected']?.includes(normalizedStatus)) return;

  const ownerProfile = await getDemandeOwnerProfile(demande?.user_id);
  const demandesUrl = buildAppUrl('/mes-annonces#demandes');

  if (ownerProfile?.email) {
    const templateKey = normalizedStatus === 'approved'
      ? 'demande_approved_requester'
      : 'demande_rejected_requester';

    const emailResult = await sendEmail({
      to: ownerProfile?.email,
      templateKey,
      variables: {
        user_name: ownerProfile?.pseudo || ownerProfile?.email || 'Utilisateur',
        demande_title: demande?.titre || 'Votre demande',
        demande_category: getDemandeCategoryLabel(demande),
        demande_city: demande?.ville || 'Non precisee',
        demande_url: demandesUrl
      }
    });

    if (!emailResult?.success) {
      console.warn("Echec d'envoi e-mail decision demande:", emailResult?.error, ownerProfile?.email);
    }
  }

  try {
    if (normalizedStatus === 'approved') {
      await notificationService?.createNotification(
        demande?.user_id,
        notificationService?.TYPES?.DEMANDE_APPROVED || 'demande_approved',
        {
          demande_id: demande?.id,
          demande_title: demande?.titre || 'Votre demande',
          actionLink: '/mes-annonces#demandes',
          actionLabel: 'Voir mes annonces',
          message: 'Votre demande a ete validee et publiee.'
        },
        {
          title: 'Demande publiee',
          message: 'Votre demande a ete validee et publiee.'
        }
      );
    } else {
      await notificationService?.createNotification(
        demande?.user_id,
        notificationService?.TYPES?.DEMANDE_REJECTED || 'demande_rejected',
        {
          demande_id: demande?.id,
          demande_title: demande?.titre || 'Votre demande',
          actionLink: '/mes-annonces#demandes',
          actionLabel: 'Voir mes annonces',
          message: 'Votre demande n a pas ete validee par la moderation.'
        },
        {
          title: 'Demande refusee',
          message: 'Votre demande n a pas ete validee par la moderation.'
        }
      );
    }
  } catch (notificationError) {
    console.warn('Notification de decision demande impossible:', notificationError?.message || notificationError);
  }
}

const demandeService = {
  /**
   * Create new demande
   */
  createDemande: async (demandeData) => {
    try {
      const { data: { user } } = await supabase?.auth?.getUser();
      if (!user) return { data: null, error: { message: 'User not authenticated' } };

      const normalizedPayload = sanitizeDemandePayload(demandeData);

      const { data, error } = await runDemandeMutation(
        (payload) => (
          supabase
            ?.from('demandes')
            ?.insert({
              ...payload,
              user_id: user?.id,
              statut: payload?.statut || 'open',
              created_at: new Date()?.toISOString()
            })
            ?.select()
            ?.single()
        ),
        normalizedPayload
      );

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schema dans createDemande:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      await sendDemandeSubmissionEmails({
        demande: data,
        ownerId: user?.id
      });

      const hydratedWithImages = await attachLibraryImageToDemande(data);
      return { data: hydratedWithImages, error: null };
    } catch (error) {
      console.error('Create demande error:', error);
      throw error;
    }
  },

  /**
   * Get all demandes with filters
   */
  getDemandes: async (filters = {}) => {
    try {
      const buildQuery = ({ includeProfile = true, skipModerationFilter = false } = {}) => {
        let query = includeProfile
          ? supabase?.from('demandes')?.select(`
              *,
              user:profiles!demandes_user_id_fkey(pseudo, avatar_url)
            `)
          : supabase?.from('demandes')?.select('*');

        if (filters?.statut) query = query?.eq('statut', filters?.statut);
        if (filters?.categorie_slug) query = query?.eq('categorie_slug', filters?.categorie_slug);
        if (filters?.ville) query = query?.ilike('ville', `%${filters?.ville}%`);
        if (filters?.user_id) query = query?.eq('user_id', filters?.user_id);
        if (!skipModerationFilter && filters?.moderation_status) {
          query = query?.eq('moderation_status', filters?.moderation_status);
        }

        query = query?.order('created_at', { ascending: false });

        if (filters?.limit) query = query?.limit(filters?.limit);

        return query;
      };

      let { data, error } = await buildQuery({ includeProfile: true });

      const missingColumn = extractMissingColumnName(error);
      if (
        error
        && missingColumn === 'moderation_status'
        && filters?.moderation_status
      ) {
        ({ data, error } = await buildQuery({
          includeProfile: true,
          skipModerationFilter: true
        }));
      }

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isDemandesProfilesRelationshipError(error)) {
          let { data: fallbackData, error: fallbackError } = await buildQuery({ includeProfile: false });
          const fallbackMissingColumn = extractMissingColumnName(fallbackError);
          if (
            fallbackError
            && fallbackMissingColumn === 'moderation_status'
            && filters?.moderation_status
          ) {
            ({ data: fallbackData, error: fallbackError } = await buildQuery({
              includeProfile: false,
              skipModerationFilter: true
            }));
          }

          if (fallbackError) return { data: null, error: fallbackError };
          const hydratedData = await attachProfilesToDemandes(fallbackData || [], {
            includeContact: false
          });
          const hydratedWithImages = await attachLibraryImagesToDemandes(hydratedData);
          return { data: hydratedWithImages, error: null };
        }
        if (isSchemaError(error)) {
          console.error('Erreur de schema dans getDemandes:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      const hydratedWithImages = await attachLibraryImageToDemande(data);
      return { data: hydratedWithImages, error: null };
    } catch (error) {
      console.error('Get demandes error:', error);
      throw error;
    }
  },

  /**
   * Get demande by ID
   */
  getDemandeById: async (id) => {
    try {
      const { data, error } = await supabase?.from('demandes')?.select(`
          *,
          user:profiles!demandes_user_id_fkey(pseudo, avatar_url, email, phone)
        `)?.eq('id', id)?.maybeSingle();

      if (error) {
        if (error?.code === 'PGRST116') return { data: null, error: null };
        if (isDemandesProfilesRelationshipError(error)) {
          const { data: fallbackData, error: fallbackError } = await supabase
            ?.from('demandes')
            ?.select('*')
            ?.eq('id', id)
            ?.maybeSingle();
          if (fallbackError) return { data: null, error: fallbackError };
          const hydratedData = await attachProfilesToDemandes(
            fallbackData ? [fallbackData] : [],
            { includeContact: true }
          );
          const hydratedWithImages = await attachLibraryImagesToDemandes(hydratedData);
          return { data: hydratedWithImages?.[0] || fallbackData || null, error: null };
        }
        if (isSchemaError(error)) {
          console.error('Erreur de schema dans getDemandeById:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      const hydratedWithImages = await attachLibraryImageToDemande(data);
      return { data: hydratedWithImages, error: null };
    } catch (error) {
      console.error('Get demande by ID error:', error);
      throw error;
    }
  },

  /**
   * Update demande
   */
  updateDemande: async (id, updates) => {
    try {
      const { data: { user } } = await supabase?.auth?.getUser();
      if (!user) return { data: null, error: { message: 'User not authenticated' } };

      const normalizedPayload = sanitizeDemandePayload(updates);

      const { data, error } = await runDemandeMutation(
        (payload) => (
          supabase
            ?.from('demandes')
            ?.update({
              ...payload,
              updated_at: new Date()?.toISOString()
            })
            ?.eq('id', id)
            ?.eq('user_id', user?.id)
            ?.select()
            ?.single()
        ),
        normalizedPayload
      );

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schema dans updateDemande:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      const hydratedWithImages = await attachLibraryImageToDemande(data);
      return { data: hydratedWithImages, error: null };
    } catch (error) {
      console.error('Update demande error:', error);
      throw error;
    }
  },

  reviewDemande: async (id, nextStatus) => {
    try {
      const normalizedStatus = toTrimmedText(nextStatus)?.toLowerCase();
      const statut =
        normalizedStatus === 'approved' ? 'open'
          : normalizedStatus === 'rejected' ? 'rejected'
            : 'open';

      const { data, error } = await runDemandeMutation(
        (payload) => (
          supabase
            ?.from('demandes')
            ?.update({
              ...payload,
              updated_at: new Date()?.toISOString()
            })
            ?.eq('id', id)
            ?.select()
            ?.single()
        ),
        {
          moderation_status: normalizedStatus || 'pending',
          statut
        }
      );

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schema dans reviewDemande:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      await sendDemandeDecisionSideEffects({
        demande: data,
        status: normalizedStatus
      });

      const hydratedWithImages = await attachLibraryImageToDemande(data);
      return { data: hydratedWithImages, error: null };
    } catch (error) {
      console.error('Review demande error:', error);
      throw error;
    }
  },

  /**
   * Close demande
   */
  closeDemande: async (id) => {
    try {
      const { data, error } = await supabase?.from('demandes')?.update({
          statut: 'closed',
          updated_at: new Date()?.toISOString()
        })?.eq('id', id)?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schema dans closeDemande:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      const hydratedWithImages = await attachLibraryImageToDemande(data);
      return { data: hydratedWithImages, error: null };
    } catch (error) {
      console.error('Close demande error:', error);
      throw error;
    }
  },

  /**
   * Delete demande
   */
  deleteDemande: async (id) => {
    try {
      const { data: { user } } = await supabase?.auth?.getUser();
      if (!user) return { error: { message: 'User not authenticated' } };

      const { error } = await supabase?.from('demandes')?.delete()?.eq('id', id)?.eq('user_id', user?.id);

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schema dans deleteDemande:', error?.message);
          throw error;
        }
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Delete demande error:', error);
      throw error;
    }
  },

  /**
   * Get user's demandes
   */
  getUserDemandes: async (userId) => {
    try {
      const { data, error } = await supabase?.from('demandes')?.select('*')?.eq('user_id', userId)?.order('created_at', { ascending: false });

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schema dans getUserDemandes:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      const hydratedWithImages = await attachLibraryImagesToDemandes(data || []);
      return { data: hydratedWithImages, error: null };
    } catch (error) {
      console.error('Get user demandes error:', error);
      throw error;
    }
  },

  getUserDemandeCount: async (userId) => {
    try {
      const { count, error } = await supabase
        ?.from('demandes')
        ?.select('id', { count: 'exact', head: true })
        ?.eq('user_id', userId);

      if (error) {
        if (error?.code === 'PGRST116') return { data: 0, error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schema dans getUserDemandeCount:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data: count ?? 0, error: null };
    } catch (error) {
      console.error('Get user demande count error:', error);
      throw error;
    }
  }
};

export default demandeService;
