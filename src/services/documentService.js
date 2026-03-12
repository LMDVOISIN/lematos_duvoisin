import { supabase } from '../lib/supabase';

/**
 * Document Service
 * Maps to 'tenant_documents' and 'reservation_docs' tables
 * Handles document uploads and vérification
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

const documentService = {
  /**
   * Téléverser un document locataire
   */
  uploadDocument: async (renterId, reservationId, docType, fileUrl) => {
    try {
      const { data: { user } } = await supabase?.auth?.getUser();
      if (!user) return { data: null, error: { message: 'User not authenticated' } };

      const { data, error } = await supabase?.from('tenant_documents')?.insert({
          renter_id: renterId,
          reservation_id: reservationId,
          doc_type: docType,
          file_url: fileUrl,
          uploaded_at: new Date()?.toISOString()
        })?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans uploadDocument:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Erreur de téléversement de document :', error);
      throw error;
    }
  },

  /**
   * Get documents by reservation
   */
  getDocumentsByReservation: async (reservationId) => {
    try {
      const { data, error } = await supabase?.from('tenant_documents')?.select('*')?.eq('reservation_id', reservationId)?.order('uploaded_at', { ascending: false });

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getDocumentsByReservation:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get documents by reservation error:', error);
      throw error;
    }
  },

  /**
   * Validate document
   */
  validateDocument: async (documentId) => {
    try {
      const { data, error } = await supabase?.from('tenant_documents')?.update({
          is_validated: true,
          validated_at: new Date()?.toISOString()
        })?.eq('id', documentId)?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans validateDocument:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Validate document error:', error);
      throw error;
    }
  },

  /**
   * Get reservation docs status
   */
  getReservationDocs: async (reservationId) => {
    try {
      const { data, error } = await supabase?.from('reservation_docs')?.select('*')?.eq('reservation_id', reservationId)?.maybeSingle();

      if (error) {
        if (error?.code === 'PGRST116') return { data: null, error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getReservationDocs:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get reservation docs error:', error);
      throw error;
    }
  },

  /**
   * Update reservation docs status
   */
  updateReservationDocs: async (reservationId, updates) => {
    try {
      const dataToUpdate = {
        ...updates,
        updated_at: new Date()?.toISOString()
      };

      const { data, error } = await supabase?.from('reservation_docs')?.upsert(
          { reservation_id: reservationId, ...dataToUpdate },
          { onConflict: 'reservation_id' }
        )?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans updateReservationDocs:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Update reservation docs error:', error);
      throw error;
    }
  },

  /**
   * Document types
   */
  DOC_TYPES: {
    ID: 'id',
    RC: 'rc',
    ADDRESS: 'address',
    CONTRACT: 'contract',
    INVENTORY: 'inventory'
  }
};

export default documentService;
