import { supabase } from '../lib/supabase';

/**
 * Demande Service
 * Maps to 'demandes' table
 * Handles user requests/demands for equipment
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

const demandeService = {
  /**
   * Create new demande
   */
  createDemande: async (demandeData) => {
    try {
      const { data: { user } } = await supabase?.auth?.getUser();
      if (!user) return { data: null, error: { message: 'User not authenticated' } };

      const { data, error } = await supabase?.from('demandes')?.insert({
          ...demandeData,
          user_id: user?.id,
          statut: 'open',
          created_at: new Date()?.toISOString()
        })?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans createDemande:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
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
      let query = supabase?.from('demandes')?.select(`
          *,
          user:profiles!demandes_user_id_fkey(pseudo, avatar_url)
        `);

      if (filters?.statut) query = query?.eq('statut', filters?.statut);
      if (filters?.categorie_slug) query = query?.eq('categorie_slug', filters?.categorie_slug);
      if (filters?.ville) query = query?.ilike('ville', `%${filters?.ville}%`);
      if (filters?.user_id) query = query?.eq('user_id', filters?.user_id);

      query = query?.order('created_at', { ascending: false });

      if (filters?.limit) query = query?.limit(filters?.limit);

      const { data, error } = await query;

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getDemandes:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
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
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getDemandeById:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
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

      const { data, error } = await supabase?.from('demandes')?.update({
          ...updates,
          updated_at: new Date()?.toISOString()
        })?.eq('id', id)?.eq('user_id', user?.id)?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans updateDemande:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Update demande error:', error);
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
          console.error('Erreur de schéma dans closeDemande:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
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
          console.error('Erreur de schéma dans deleteDemande:', error?.message);
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
          console.error('Erreur de schéma dans getUserDemandes:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get user demandes error:', error);
      throw error;
    }
  }
};

export default demandeService;
