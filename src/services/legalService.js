import { supabase } from '../lib/supabase';

/**
 * Legal Service
 * Maps to 'legal_pages' table
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

const legalService = {
  /**
   * Get legal page by slug
   */
  getLegalPage: async (slug) => {
    try {
      const { data, error } = await supabase?.from('legal_pages')?.select('*')?.eq('slug', slug)?.maybeSingle();

      if (error) {
        if (error?.code === 'PGRST116') return { data: null, error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getLegalPage:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get legal page error:', error);
      throw error;
    }
  },

  /**
   * Get all legal pages
   */
  getAllLegalPages: async () => {
    try {
      const { data, error } = await supabase?.from('legal_pages')?.select('slug, title, updated_at')?.order('slug', { ascending: true });

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getAllLegalPages:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get all legal pages error:', error);
      throw error;
    }
  },

  /**
   * Update legal page (admin)
   */
  updateLegalPage: async (slug, title, content) => {
    try {
      const payload = {
        slug,
        title,
        content,
        updated_at: new Date()?.toISOString()
      };

      const { data, error } = await supabase?.from('legal_pages')?.upsert(payload, { onConflict: 'slug' })?.select()?.single();

      if (error) {
        // Some environments allow UPDATE on existing legal pages but block INSERT via RLS.
        // In this case, fallback to UPDATE by slug so existing rows can still be edited.
        const isInsertRlsError =
          /new row violates row-level security policy/i?.test(error?.message || '') ||
          /violates row-level security policy/i?.test(error?.message || '');

        if (isInsertRlsError) {
          const { data: updatedData, error: updateError } = await supabase
            ?.from('legal_pages')
            ?.update({
              title,
              content,
              updated_at: payload?.updated_at
            })
            ?.eq('slug', slug)
            ?.select()
            ?.maybeSingle();

          if (updateError) {
            if (isSchemaError(updateError)) {
              console.error('Erreur de schéma dans updateLegalPage (fallback update):', updateError?.message);
              throw updateError;
            }
            return { data: null, error: updateError };
          }

          if (updatedData) {
            return { data: updatedData, error: null };
          }
        }

        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans updateLegalPage:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Update legal page error:', error);
      throw error;
    }
  },

  /**
   * Legal page slugs
   */
  SLUGS: {
    CGU: 'cgu',
    CGV: 'cgv',
    PRIVACY: 'politique-confidentialite',
    COOKIES: 'politique-temoins-connexion',
    MENTIONS: 'mentions-legales'
  }
};

export default legalService;
