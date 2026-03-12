import { supabase } from '../lib/supabase';

/**
 * Service de profil
 * Maps to 'profiles' table
 * Handles user profile data, KYC status, sanctions, and Stripe integration
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

const profileService = {
  /**
   * Get user profile by user ID
   * Fetches from profiles table
   */
  getProfile: async (userId) => {
    try {
      const { data, error } = await supabase?.from('profiles')?.select('*')?.eq('id', userId)?.maybeSingle();

      if (error) {
        if (error?.code === 'PGRST116') return { data: null, error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getProfile:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get profile error:', error);
      throw error;
    }
  },

  /**
   * Create user profile
   * Inserts into profiles table
   */
  createProfile: async (profileData) => {
    try {
      const { data, error } = await supabase?.from('profiles')?.insert(profileData)?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans createProfile:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Create profile error:', error);
      throw error;
    }
  },

  /**
   * Mettre à jour le profil utilisateur
   * Updates profiles table
   */
  updateProfile: async (userId, updates) => {
    try {
      let { data, error } = await supabase?.from('profiles')?.update(updates)?.eq('id', userId)?.select()?.single();

      if (
        error &&
        isSchemaError(error) &&
        /column.*(first_name|last_name).*does not exist/i.test(String(error?.message || ''))
      ) {
        const { first_name, last_name, ...legacyCompatibleUpdates } = updates || {};
        ({ data, error } = await supabase
          ?.from('profiles')
          ?.update(legacyCompatibleUpdates)
          ?.eq('id', userId)
          ?.select()
          ?.single());
      }

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans updateProfile:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  },

  /**
   * Update profile fields (pseudo, phone, address, avatar, etc.)
   */
  updateProfileFields: async (userId, fields) => {
    const allowedFields = [
      'pseudo', 'email', 'phone', 'city', 'address', 'postal_code',
      'first_name', 'last_name',
      'avatar_url', 'stripe_account_id', 'stripe_customer_id', 'updated_at'
    ];

    const filteredFields = Object.keys(fields)?.filter(key => allowedFields?.includes(key))?.reduce((obj, key) => {
        obj[key] = fields?.[key];
        return obj;
      }, {});

    filteredFields.updated_at = new Date()?.toISOString();

    return await profileService?.updateProfile(userId, filteredFields);
  },

  /**
   * Get profile with sanctions and KYC status
   */
  getProfileWithDetails: async (userId) => {
    try {
      const { data, error } = await supabase?.from('profiles')?.select(`
          *,
          user_sanctions(*)
        `)?.eq('id', userId)?.maybeSingle();

      if (error) {
        if (error?.code === 'PGRST116') return { data: null, error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getProfileWithDetails:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get profile with details error:', error);
      throw error;
    }
  },

  /**
   * Update Stripe account ID
   */
  updateStripeAccount: async (userId, stripeAccountId) => {
    try {
      const { data, error } = await supabase?.from('profiles')?.update({ stripe_account_id: stripeAccountId, updated_at: new Date()?.toISOString() })?.eq('id', userId)?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans updateStripeAccount:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Update Stripe account error:', error);
      throw error;
    }
  },

  /**
   * Increment no-reply strikes
   */
  incrementNoReplyStrikes: async (userId) => {
    try {
      const { data: profile } = await profileService?.getProfile(userId);
      const currentStrikes = profile?.no_reply_strikes || 0;

      const { data, error } = await supabase?.from('profiles')?.update({ 
          no_reply_strikes: currentStrikes + 1,
          updated_at: new Date()?.toISOString()
        })?.eq('id', userId)?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans incrementNoReplyStrikes:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Increment no-reply strikes error:', error);
      throw error;
    }
  },

  /**
   * Ban user
   */
  banUser: async (userId, reason) => {
    try {
      const { data, error } = await supabase?.from('profiles')?.update({ 
          banned_at: new Date()?.toISOString(),
          ban_reason: reason,
          updated_at: new Date()?.toISOString()
        })?.eq('id', userId)?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans banUser:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Ban user error:', error);
      throw error;
    }
  },

  /**
   * Unban user
   */
  unbanUser: async (userId) => {
    try {
      const { data, error } = await supabase?.from('profiles')?.update({ 
          banned_at: null,
          ban_reason: null,
          updated_at: new Date()?.toISOString()
        })?.eq('id', userId)?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans unbanUser:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Unban user error:', error);
      throw error;
    }
  },

  /**
   * Check if user is banned
   */
  isBanned: async (userId) => {
    try {
      const { data, error } = await profileService?.getProfile(userId);
      
      if (error) return { banned: false, error };
      
      return { banned: !!data?.banned_at, error: null };
    } catch (error) {
      console.error('Check banned status error:', error);
      throw error;
    }
  }
};

export default profileService;

