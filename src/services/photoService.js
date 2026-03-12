import { supabase } from '../lib/supabase';

/**
 * Service photo
 * Correspond à la table 'reservation_photos'
 * Gère les photos d'état des lieux des réservations
 */

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
    ];
    return schemaErrorPatterns?.some(pattern => pattern?.test(error?.message));
  }
  return false;
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

const photoService = {
  /**
   * Téléverser une photo de réservation
   */
  uploadPhoto: async (reservationId, phase, takenBy, photoUrl, kind = null) => {
    try {
      const nowIso = new Date()?.toISOString();
      const basePayload = {
        reservation_id: reservationId,
        phase,
        taken_by: takenBy,
        photo_url: photoUrl,
        kind,
        created_at: nowIso
      };

      const payloadVariants = [
        { ...basePayload, taken_at: nowIso },
        basePayload
      ];

      let lastError = null;

      for (const payload of payloadVariants) {
        const { data, error } = await supabase?.from('reservation_photos')?.insert(payload)?.select()?.single();

        if (!error) {
          return { data, error: null };
        }

        lastError = error;
        const missingColumn = extractMissingColumnName(error);
        if (missingColumn && missingColumn?.toLowerCase() === 'taken_at') {
          continue;
        }

        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans uploadPhoto:', error?.message);
          throw error;
        }

        return { data: null, error };
      }

      if (lastError) {
        if (isSchemaError(lastError)) {
          console.error('Erreur de schéma dans uploadPhoto:', lastError?.message);
          throw lastError;
        }
        return { data: null, error: lastError };
      }

      return { data: null, error: { message: 'Impossible de téléverser la photo.' } };
    } catch (error) {
      console.error('Erreur de téléversement de photo :', error);
      throw error;
    }
  },

  /**
   * Récupérer les photos par réservation
   */
  getPhotosByReservation: async (reservationId, phase = null) => {
    try {
      const sortColumns = ['taken_at', 'created_at'];
      let lastError = null;

      for (const sortColumn of sortColumns) {
        let query = supabase?.from('reservation_photos')?.select('*')?.eq('reservation_id', reservationId);
        if (phase) query = query?.eq('phase', phase);

        const { data, error } = await query?.order(sortColumn, { ascending: true });

        if (!error) {
          return { data, error: null };
        }

        lastError = error;
        if (error?.code === 'PGRST116') return { data: [], error: null };

        const missingColumn = extractMissingColumnName(error);
        if (missingColumn && missingColumn?.toLowerCase() === sortColumn?.toLowerCase()) {
          continue;
        }

        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getPhotosByReservation:', error?.message);
          throw error;
        }

        return { data: null, error };
      }

      if (lastError) {
        if (isSchemaError(lastError)) {
          console.error('Erreur de schéma dans getPhotosByReservation:', lastError?.message);
          throw lastError;
        }
        return { data: null, error: lastError };
      }

      return { data: [], error: null };
    } catch (error) {
      console.error('Récupérer les photos par réservation error:', error);
      throw error;
    }
  },

  /**
   * Supprimer une photo
   */
  deletePhoto: async (photoId) => {
    try {
      const { error } = await supabase?.from('reservation_photos')?.delete()?.eq('id', photoId);

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans deletePhoto:', error?.message);
          throw error;
        }
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Supprimer une photo error:', error);
      throw error;
    }
  },

  /**
   * Supprimer toutes les photos d'une reservation (lignes DB seulement)
   */
  deletePhotosByReservation: async (reservationId) => {
    try {
      const { error } = await supabase?.from('reservation_photos')?.delete()?.eq('reservation_id', reservationId);

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans deletePhotosByReservation:', error?.message);
          throw error;
        }
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Supprimer les photos de reservation error:', error);
      throw error;
    }
  },

  /**
   * Phases photo
   */
  PHASES: {
    START: 'start',
    END: 'end'
  },

  /**
   * Prises de vue
   */
  TAKERS: {
    OWNER: 'owner',
    RENTER: 'renter'
  }
};

export default photoService;


