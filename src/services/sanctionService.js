import { supabase } from '../lib/supabase';

/**
 * Sanction Service
 * Maps to 'user_sanctions' and 'sanctions_log' tables
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

const sanctionService = {
  /**
   * Create user sanction
   */
  createSanction: async (userId, type, level = 1, metadata = {}, listingId = null) => {
    try {
      const { data, error } = await supabase?.from('user_sanctions')?.insert({
          user_id: userId,
          type,
          level,
          metadata,
          listing_id: listingId,
          created_at: new Date()?.toISOString()
        })?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans createSanction:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Create sanction error:', error);
      throw error;
    }
  },

  /**
   * Get user sanctions
   */
  getUserSanctions: async (userId) => {
    try {
      const { data, error } = await supabase?.from('user_sanctions')?.select('*')?.eq('user_id', userId)?.order('created_at', { ascending: false });

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getUserSanctions:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get user sanctions error:', error);
      throw error;
    }
  },

  /**
   * Log sanction action
   */
  logSanction: async (userId, target, type, description = null, reservationId = null) => {
    try {
      const { data, error } = await supabase?.from('sanctions_log')?.insert({
          user_id: userId,
          target,
          type,
          description,
          reservation_id: reservationId,
          created_at: new Date()?.toISOString()
        })?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans logSanction:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Log sanction error:', error);
      throw error;
    }
  },

  /**
   * Get sanctions log
   */
  getSanctionsLog: async (userId = null) => {
    try {
      let query = supabase?.from('sanctions_log')?.select('*');

      if (userId) query = query?.eq('user_id', userId);

      query = query?.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getSanctionsLog:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get sanctions log error:', error);
      throw error;
    }
  },

  /**
   * Sanction types
   */
  TYPES: {
    NO_REPLY: 'no_reply',
    LATE_PAYMENT: 'late_payment',
    DAMAGE: 'damage',
    VIOLATION: 'violation',
    FRAUD: 'fraud'
  },

  /**
   * Sanction targets
   */
  TARGETS: {
    OWNER: 'owner',
    RENTER: 'renter'
  }
};

export default sanctionService;
