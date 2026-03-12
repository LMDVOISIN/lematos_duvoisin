import { supabase } from '../lib/supabase';

/**
 * Category Service
 * Maps to 'categories' and 'subcategories' tables
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
      /syntax error/i
    ];
    return schemaErrorPatterns?.some((pattern) => pattern?.test(error?.message));
  }
  return false;
}

function isMissingEmbedRelationship(error) {
  if (!error?.message) return false;
  return /could not find a relationship between/i.test(error?.message);
}

function isMissingTable(error) {
  if (!error?.message) return false;
  return /could not find the table/i.test(error?.message) || /relation.*does not exist/i.test(error?.message);
}

const categoryService = {
  /**
   * Get all categories with subcategories
   */
  getCategories: async () => {
    try {
      let { data, error } = await supabase?.from('categories')?.select(`
          *,
          subcategories(*)
        `)?.order('nom', { ascending: true });

      // Fallback for environments where subcategories table/FK is missing.
      if (error && (isMissingEmbedRelationship(error) || isMissingTable(error))) {
        const fallback = await supabase?.from('categories')?.select('*')?.order('nom', { ascending: true });
        data = (fallback?.data || [])?.map((category) => ({ ...category, subcategories: [] }));
        error = fallback?.error || null;
      }

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schema dans getCategories:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get categories error:', error);
      throw error;
    }
  },

  /**
   * Get category by ID
   */
  getCategoryById: async (id) => {
    try {
      let { data, error } = await supabase?.from('categories')?.select(`
          *,
          subcategories(*)
        `)?.eq('id', id)?.maybeSingle();

      if (error && (isMissingEmbedRelationship(error) || isMissingTable(error))) {
        const fallback = await supabase?.from('categories')?.select('*')?.eq('id', id)?.maybeSingle();
        data = fallback?.data ? { ...fallback?.data, subcategories: [] } : null;
        error = fallback?.error || null;
      }

      if (error) {
        if (error?.code === 'PGRST116') return { data: null, error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schema dans getCategoryById:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get category by ID error:', error);
      throw error;
    }
  },

  /**
   * Get subcategories by category ID
   */
  getSubcategories: async (categoryId) => {
    try {
      const { data, error } = await supabase?.from('subcategories')?.select('*')?.eq('category_id', categoryId)?.order('name', { ascending: true });

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isMissingTable(error)) return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schema dans getSubcategories:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get subcategories error:', error);
      throw error;
    }
  },

  /**
   * Get subcategory by slug
   */
  getSubcategoryBySlug: async (slug) => {
    try {
      let { data, error } = await supabase?.from('subcategories')?.select(`
          *,
          category:categories(*)
        `)?.eq('slug', slug)?.maybeSingle();

      if (error && (isMissingEmbedRelationship(error) || isMissingTable(error))) {
        const fallback = await supabase?.from('subcategories')?.select('*')?.eq('slug', slug)?.maybeSingle();
        data = fallback?.data || null;
        error = fallback?.error || null;
      }

      if (error) {
        if (error?.code === 'PGRST116') return { data: null, error: null };
        if (isMissingTable(error)) return { data: null, error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schema dans getSubcategoryBySlug:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get subcategory by slug error:', error);
      throw error;
    }
  }
};

export default categoryService;
