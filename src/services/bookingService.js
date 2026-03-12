import { supabase } from '../lib/supabase';

/**
 * Booking Service
 * Maps to 'bookings' table
 * Handles payment processing, insurance, deposits, and transfers
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

const bookingService = {
  /**
   * Create new booking
   */
  createBooking: async (bookingData) => {
    try {
      const { data: { user } } = await supabase?.auth?.getUser();
      if (!user) return { data: null, error: { message: 'User not authenticated' } };

      const dataToInsert = {
        ...bookingData,
        renter_id: user?.id,
        status: 'pending',
        created_at: new Date()?.toISOString()
      };

      const { data, error } = await supabase?.from('bookings')?.insert(dataToInsert)?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans createBooking:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Create booking error:', error);
      throw error;
    }
  },

  /**
   * Get booking by ID
   */
  getBookingById: async (id) => {
    try {
      const { data, error } = await supabase?.from('bookings')?.select(`
          *,
          annonce:annonces(titre, photos, prix_jour),
          renter:profiles!bookings_renter_id_fkey(pseudo, avatar_url, email),
          owner:profiles!bookings_owner_id_fkey(pseudo, avatar_url, email)
        `)?.eq('id', id)?.maybeSingle();

      if (error) {
        if (error?.code === 'PGRST116') return { data: null, error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getBookingById:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get booking by ID error:', error);
      throw error;
    }
  },

  /**
   * Get user's bookings
   */
  getUserBookings: async (userId, filters = {}) => {
    try {
      let query = supabase?.from('bookings')?.select(`
          *,
          annonce:annonces(titre, photos, prix_jour)
        `)?.eq('renter_id', userId);

      if (filters?.status) query = query?.eq('status', filters?.status);
      
      query = query?.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getUserBookings:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get user bookings error:', error);
      throw error;
    }
  },

  /**
   * Get owner's bookings
   */
  getOwnerBookings: async (ownerId, filters = {}) => {
    try {
      let query = supabase?.from('bookings')?.select(`
          *,
          annonce:annonces(titre, photos, prix_jour),
          renter:profiles!bookings_renter_id_fkey(pseudo, avatar_url, email)
        `)?.eq('owner_id', ownerId);

      if (filters?.status) query = query?.eq('status', filters?.status);
      
      query = query?.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getOwnerBookings:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get owner bookings error:', error);
      throw error;
    }
  },

  /**
   * Update booking status
   */
  updateBookingStatus: async (id, status) => {
    try {
      const { data, error } = await supabase?.from('bookings')?.update({ status })?.eq('id', id)?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans updateBookingStatus:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Update booking status error:', error);
      throw error;
    }
  },

  /**
   * Mark booking as paid
   */
  markAsPaid: async (id, stripeCustomerId) => {
    try {
      const { data, error } = await supabase?.from('bookings')?.update({ 
          status: 'paid',
          stripe_customer_id: stripeCustomerId
        })?.eq('id', id)?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans markAsPaid:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Mark as paid error:', error);
      throw error;
    }
  },

  /**
   * Calculate booking total
   */
  calculateTotal: (amountLoyerCents, amountAssuranceCents, amountServiceCents, cautionCents = 0) => {
    return amountLoyerCents + amountAssuranceCents + amountServiceCents + cautionCents;
  },

  /**
   * Get bookings by annonce
   */
  getBookingsByAnnonce: async (annonceId) => {
    try {
      const { data, error } = await supabase?.from('bookings')?.select('*')?.eq('annonce_id', annonceId)?.order('date_start', { ascending: true });

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getBookingsByAnnonce:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get bookings by annonce error:', error);
      throw error;
    }
  },

  /**
   * Cancel booking
   */
  cancelBooking: async (id, refusalReasonId = null, refusalReason = null) => {
    try {
      const { data, error } = await supabase?.from('bookings')?.update({ 
          status: 'canceled',
          refusal_reason_id: refusalReasonId,
          refusal_reason: refusalReason
        })?.eq('id', id)?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans cancelBooking:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Cancel booking error:', error);
      throw error;
    }
  },

  /**
   * Complete booking
   */
  completeBooking: async (id) => {
    try {
      const { data, error } = await supabase?.from('bookings')?.update({ status: 'completed' })?.eq('id', id)?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans completeBooking:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Complete booking error:', error);
      throw error;
    }
  },

  /**
   * Refund booking
   */
  refundBooking: async (id) => {
    try {
      const { data, error } = await supabase?.from('bookings')?.update({ status: 'refunded' })?.eq('id', id)?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans refundBooking:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Refund booking error:', error);
      throw error;
    }
  }
};

export default bookingService;
