import { supabase } from '../lib/supabase';

/**
 * FAQ Service
 * Maps to 'faqs' table
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

function isMissingColumn(error, columnName) {
  if (!error?.message || !columnName) return false;
  const pattern = new RegExp(`column\\s+.*${columnName}.*does not exist`, 'i');
  return pattern.test(error?.message);
}

function withOrderColumnCompatibility(payload, error) {
  if (!payload || !error) return null;

  if (isMissingColumn(error, 'display_order') && Object.prototype.hasOwnProperty.call(payload, 'display_order')) {
    const nextPayload = { ...payload, sort_order: payload?.display_order };
    delete nextPayload.display_order;
    return nextPayload;
  }

  if (isMissingColumn(error, 'sort_order') && Object.prototype.hasOwnProperty.call(payload, 'sort_order')) {
    const nextPayload = { ...payload, display_order: payload?.sort_order };
    delete nextPayload.sort_order;
    return nextPayload;
  }

  return null;
}

async function executeFaqQuery(buildQuery) {
  const orderColumns = ['display_order', 'sort_order', 'created_at'];

  for (const column of orderColumns) {
    const response = await buildQuery()?.order(column, { ascending: true });
    if (!response?.error || !isMissingColumn(response?.error, column)) {
      return response;
    }
  }

  return buildQuery();
}

const faqService = {
  /**
   * Get all FAQs
   */
  getFAQs: async (publishedOnly = true) => {
    try {
      const { data, error } = await executeFaqQuery(() => {
        let query = supabase?.from('faqs')?.select('*');
        if (publishedOnly) query = query?.eq('published', true);
        return query;
      });

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getFAQs:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get FAQs error:', error);
      throw error;
    }
  },

  /**
   * Get home page FAQs
   */
  getHomeFAQs: async () => {
    try {
      const buildHomeQuery = (includeHomeFilter = true) => {
        let query = supabase?.from('faqs')?.select('*')?.eq('published', true);
        if (includeHomeFilter) query = query?.eq('show_on_home', true);
        return query;
      };

      let { data, error } = await executeFaqQuery(() => buildHomeQuery(true));

      if (error && isMissingColumn(error, 'show_on_home')) {
        ({ data, error } = await executeFaqQuery(() => buildHomeQuery(false)));
      }

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getHomeFAQs:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get home FAQs error:', error);
      throw error;
    }
  },

  /**
   * Get FAQ by ID
   */
  getFAQById: async (id) => {
    try {
      const { data, error } = await supabase?.from('faqs')?.select('*')?.eq('id', id)?.maybeSingle();

      if (error) {
        if (error?.code === 'PGRST116') return { data: null, error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getFAQById:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get FAQ by ID error:', error);
      throw error;
    }
  },

  /**
   * Create FAQ (admin)
   */
  createFAQ: async (faqData) => {
    try {
      let payload = {
        ...faqData,
        created_at: new Date()?.toISOString()
      };

      let { data, error } = await supabase?.from('faqs')?.insert(payload)?.select()?.single();

      if (error) {
        const compatiblePayload = withOrderColumnCompatibility(payload, error);
        if (compatiblePayload) {
          payload = compatiblePayload;
          ({ data, error } = await supabase?.from('faqs')?.insert(payload)?.select()?.single());
        }
      }

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans createFAQ:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Create FAQ error:', error);
      throw error;
    }
  },

  /**
   * Update FAQ (admin)
   */
  updateFAQ: async (id, updates) => {
    try {
      let payload = { ...updates };
      let { data, error } = await supabase?.from('faqs')?.update(payload)?.eq('id', id)?.select()?.single();

      if (error) {
        const compatiblePayload = withOrderColumnCompatibility(payload, error);
        if (compatiblePayload) {
          payload = compatiblePayload;
          ({ data, error } = await supabase?.from('faqs')?.update(payload)?.eq('id', id)?.select()?.single());
        }
      }

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans updateFAQ:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Update FAQ error:', error);
      throw error;
    }
  },

  /**
   * Delete FAQ (admin)
   */
  deleteFAQ: async (id) => {
    try {
      const { error } = await supabase?.from('faqs')?.delete()?.eq('id', id);

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans deleteFAQ:', error?.message);
          throw error;
        }
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Delete FAQ error:', error);
      throw error;
    }
  }
};

export default faqService;

