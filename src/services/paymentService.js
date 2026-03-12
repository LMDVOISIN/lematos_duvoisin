import { supabase } from '../lib/supabase';

/**
 * Payment Service
 * Maps to 'payments' table
 * Handles Stripe payment intents and transactions
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

const paymentService = {
  /**
   * Create payment record
   */
  createPayment: async (paymentData) => {
    try {
      const { data, error } = await supabase?.from('payments')?.insert({
          ...paymentData,
          created_at: new Date()?.toISOString()
        })?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans createPayment:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Create payment error:', error);
      throw error;
    }
  },

  /**
   * Get payment by ID
   */
  getPaymentById: async (id) => {
    try {
      const { data, error } = await supabase?.from('payments')?.select('*')?.eq('id', id)?.maybeSingle();

      if (error) {
        if (error?.code === 'PGRST116') return { data: null, error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getPaymentById:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get payment by ID error:', error);
      throw error;
    }
  },

  /**
   * Get payments by booking ID
   */
  getPaymentsByBooking: async (bookingId) => {
    try {
      const { data, error } = await supabase?.from('payments')?.select('*')?.eq('booking_id', bookingId)?.order('created_at', { ascending: false });

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getPaymentsByBooking:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get payments by booking error:', error);
      throw error;
    }
  },

  /**
   * Update payment status
   */
  updatePaymentStatus: async (id, status, raw = null) => {
    try {
      const updateData = { status };
      if (raw) updateData.raw = raw;

      const { data, error } = await supabase?.from('payments')?.update(updateData)?.eq('id', id)?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans updatePaymentStatus:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Update payment status error:', error);
      throw error;
    }
  },

  /**
   * Payment types
   */
  TYPES: {
    MAIN: 'main',
    DEPOSIT_HOLD: 'deposit_hold',
    DEPOSIT_CAPTURE: 'deposit_capture',
    REFUND: 'refund'
  }
};

export default paymentService;
