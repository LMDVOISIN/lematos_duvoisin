import { supabase } from '../config/supabase';

// Authentication Services
export const authService = {
  // Inscription d'un nouvel utilisateur
  signUp: async (email, password, userData = {}) => {
    const { data, error } = await supabase?.auth?.signUp({
      email,
      password,
      options: {
        data: userData
      }
    });
    return { data, error };
  },

  // Connexion d'un utilisateur existant
  signIn: async (email, password) => {
    const { data, error } = await supabase?.auth?.signInWithPassword({
      email,
      password
    });
    return { data, error };
  },

  // Déconnecter l'utilisateur courant
  signOut: async () => {
    const { error } = await supabase?.auth?.signOut();
    return { error };
  },

  // Get current session
  getSession: async () => {
    const { data, error } = await supabase?.auth?.getSession();
    return { data, error };
  },

  // Get current user
  getCurrentUser: async () => {
    const { data: { user }, error } = await supabase?.auth?.getUser();
    return { user, error };
  },

  // Reset password
  resetPassword: async (email) => {
    const { data, error } = await supabase?.auth?.resetPasswordForEmail(email);
    return { data, error };
  },

  // Update user
  updateUser: async (updates) => {
    const { data, error } = await supabase?.auth?.updateUser(updates);
    return { data, error };
  },

  // Listen to auth state changes
  onAuthStateChange: (callback) => {
    return supabase?.auth?.onAuthStateChange(callback);
  }
};

// Database Services
export const dbService = {
  // Generic select query
  select: async (table, columns = '*', filters = {}) => {
    let query = supabase?.from(table)?.select(columns);
    
    // Apply filters
    Object.entries(filters)?.forEach(([key, value]) => {
      query = query?.eq(key, value);
    });
    
    const { data, error } = await query;
    return { data, error };
  },

  // Insert data
  insert: async (table, data) => {
    const { data: result, error } = await supabase?.from(table)?.insert(data)?.select();
    return { data: result, error };
  },

  // Update data
  update: async (table, id, updates) => {
    const { data, error } = await supabase?.from(table)?.update(updates)?.eq('id', id)?.select();
    return { data, error };
  },

  // Delete data
  delete: async (table, id) => {
    const { error } = await supabase?.from(table)?.delete()?.eq('id', id);
    return { error };
  },

  // Get single record by ID
  getById: async (table, id) => {
    const { data, error } = await supabase?.from(table)?.select('*')?.eq('id', id)?.single();
    return { data, error };
  },

  // Custom query builder
  from: (table) => supabase?.from(table)
};

// Real-time Subscription Services
export const realtimeService = {
  // Subscribe to table changes
  subscribe: (table, callback, filter = '*') => {
    const channel = supabase?.channel(`${table}-changes`)?.on(
        'postgres_changes',
        {
          event: filter,
          schema: 'public',
          table: table
        },
        callback
      )?.subscribe();
    
    return channel;
  },

  // Unsubscribe from channel
  unsubscribe: (channel) => {
    supabase?.removeChannel(channel);
  },

  // Subscribe to specific row changes
  subscribeToRow: (table, id, callback) => {
    const channel = supabase?.channel(`${table}-${id}`)?.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: `id=eq.${id}`
        },
        callback
      )?.subscribe();
    
    return channel;
  }
};

// Storage Services
export const storageService = {
  // Téléverser un fichier
  upload: async (bucket, path, file) => {
    const { data, error } = await supabase?.storage?.from(bucket)?.upload(path, file);
    return { data, error };
  },

  // Download file
  download: async (bucket, path) => {
    const { data, error } = await supabase?.storage?.from(bucket)?.download(path);
    return { data, error };
  },

  // Get public URL
  getPublicUrl: (bucket, path) => {
    const { data } = supabase?.storage?.from(bucket)?.getPublicUrl(path);
    return data?.publicUrl;
  },

  // Delete file
  deleteFile: async (bucket, paths) => {
    const { data, error } = await supabase?.storage?.from(bucket)?.remove(paths);
    return { data, error };
  },

  // List files
  list: async (bucket, path = '') => {
    const { data, error } = await supabase?.storage?.from(bucket)?.list(path);
    return { data, error };
  }
};

export default {
  auth: authService,
  db: dbService,
  realtime: realtimeService,
  storage: storageService
};


