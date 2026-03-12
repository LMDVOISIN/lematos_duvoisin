import { supabase } from '../lib/supabase';

/**
 * Notification Service
 * Maps to 'notifications' table
 * Handles user notifications with real-time updates
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

function normalizePayload(payload) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) return payload;
  if (typeof payload === 'string' && payload?.trim()) return { message: payload?.trim() };
  return {};
}

function isMissingCreateNotificationRpcError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  const details = String(error?.details || '');
  const source = `${message} ${details}`?.toLowerCase();

  if (code === 'PGRST202') return true;
  return source?.includes('create_notification') && (
    source?.includes('could not find')
    || source?.includes('not found')
    || source?.includes('does not exist')
  );
}

const notificationService = {
  /**
   * Get user notifications
   */
  getUserNotifications: async (userId, filters = {}) => {
    try {
      let query = supabase?.from('notifications')?.select('*')?.eq('user_id', userId);

      if (filters?.is_read !== undefined) query = query?.eq('is_read', filters?.is_read);
      if (filters?.is_archived !== undefined) query = query?.eq('is_archived', filters?.is_archived);
      if (filters?.type) query = query?.eq('type', filters?.type);

      query = query?.order('created_at', { ascending: false });

      if (filters?.limit) query = query?.limit(filters?.limit);

      const { data, error } = await query;

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getUserNotifications:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get user notifications error:', error);
      throw error;
    }
  },

  /**
   * Get unread notification count
   */
  getUnreadCount: async (userId) => {
    try {
      const { count, error } = await supabase?.from('notifications')?.select('*', { count: 'exact', head: true })?.eq('user_id', userId)?.eq('is_read', false)?.eq('is_archived', false);

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getUnreadCount:', error?.message);
          throw error;
        }
        return { count: 0, error };
      }

      return { count: count || 0, error: null };
    } catch (error) {
      console.error('Get unread count error:', error);
      throw error;
    }
  },

  /**
   * Create notification
   */
  createNotification: async (userId, type, payload, options = {}) => {
    try {
      const normalizedPayload = normalizePayload(payload);
      const relatedId = options?.relatedId
        || options?.related_id
        || normalizedPayload?.related_id
        || normalizedPayload?.reservation_id
        || normalizedPayload?.proposal_id
        || null;

      const title = (
        (typeof options?.title === 'string' && options?.title?.trim())
          ? options?.title?.trim()
          : (typeof normalizedPayload?.title === 'string' && normalizedPayload?.title?.trim())
            ? normalizedPayload?.title?.trim()
            : null
      );

      const message = (
        (typeof options?.message === 'string' && options?.message?.trim())
          ? options?.message?.trim()
          : (typeof normalizedPayload?.message === 'string' && normalizedPayload?.message?.trim())
            ? normalizedPayload?.message?.trim()
            : null
      );

      const { data: rpcData, error: rpcError } = await supabase?.rpc('create_notification', {
        p_user_id: userId,
        p_type: type,
        p_payload: normalizedPayload,
        p_related_id: relatedId,
        p_title: title,
        p_message: message
      });

      if (!rpcError) {
        return { data: rpcData || null, error: null };
      }

      if (!isMissingCreateNotificationRpcError(rpcError)) {
        if (isSchemaError(rpcError)) {
          console.error('Erreur de schéma dans createNotification RPC:', rpcError?.message);
          throw rpcError;
        }
        return { data: null, error: rpcError };
      }

      const { data, error } = await supabase?.from('notifications')?.insert({
        user_id: userId,
        type,
        title,
        message,
        payload: normalizedPayload,
        related_id: relatedId,
        created_at: new Date()?.toISOString()
      })?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans createNotification:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Create notification error:', error);
      throw error;
    }
  },

  /**
   * Mark notification as read
   */
  markAsRead: async (notificationId) => {
    try {
      const { data, error } = await supabase?.from('notifications')?.update({ 
          is_read: true,
          read_at: new Date()?.toISOString()
        })?.eq('id', notificationId)?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans markAsRead:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Mark as read error:', error);
      throw error;
    }
  },

  /**
   * Mark all notifications as read
   */
  markAllAsRead: async (userId) => {
    try {
      const { data, error } = await supabase?.from('notifications')?.update({ 
          is_read: true,
          read_at: new Date()?.toISOString()
        })?.eq('user_id', userId)?.eq('is_read', false)?.select();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans markAllAsRead:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Mark all as read error:', error);
      throw error;
    }
  },

  /**
   * Archive notification
   */
  archiveNotification: async (notificationId) => {
    try {
      const { data, error } = await supabase?.from('notifications')?.update({ 
          is_archived: true,
          archived_at: new Date()?.toISOString()
        })?.eq('id', notificationId)?.select()?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans archiveNotification:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Archive notification error:', error);
      throw error;
    }
  },

  /**
   * Delete notification
   */
  deleteNotification: async (notificationId) => {
    try {
      const { data: { user } } = await supabase?.auth?.getUser();
      if (!user) return { error: { message: 'User not authenticated' } };

      const { error } = await supabase?.from('notifications')?.delete()?.eq('id', notificationId)?.eq('user_id', user?.id);

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans deleteNotification:', error?.message);
          throw error;
        }
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Delete notification error:', error);
      throw error;
    }
  },

  /**
   * Subscribe to user notifications (real-time)
   */
  subscribeToNotifications: (userId, callback) => {
    const channel = supabase?.channel(`notifications:${userId}`)?.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          callback(payload?.new);
        }
      )?.subscribe();

    return channel;
  },

  /**
   * Unsubscribe from notifications
   */
  unsubscribe: (channel) => {
    if (channel) {
      supabase?.removeChannel(channel);
    }
  },

  /**
   * Get persisted notification channel preferences for a user
   */
  getUserPreferences: async (userId) => {
    try {
      const { data, error } = await supabase
        ?.from('notification_preferences')
        ?.select('category, email_enabled, push_enabled, sms_enabled')
        ?.eq('user_id', userId)
        ?.order('category', { ascending: true });

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getUserPreferences:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data: data || [], error: null };
    } catch (error) {
      console.error('Get user preferences error:', error);
      throw error;
    }
  },

  /**
   * Upsert notification channel preferences for a user
   */
  saveUserPreferences: async (userId, preferencesByCategory) => {
    try {
      const rows = Object.entries(preferencesByCategory || {})?.map(([category, channels]) => ({
        user_id: userId,
        category,
        email_enabled: Boolean(channels?.email),
        push_enabled: Boolean(channels?.push),
        sms_enabled: Boolean(channels?.sms),
        updated_at: new Date()?.toISOString()
      }));

      if (!rows?.length) return { data: [], error: null };

      const { data, error } = await supabase
        ?.from('notification_preferences')
        ?.upsert(rows, { onConflict: 'user_id,category' })
        ?.select('category, email_enabled, push_enabled, sms_enabled');

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans saveUserPreferences:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data: data || [], error: null };
    } catch (error) {
      console.error('Save user preferences error:', error);
      throw error;
    }
  },

  /**
   * Notification types
   */
  TYPES: {
    NEW_MESSAGE: 'new_message',
    NEW_RESERVATION: 'new_reservation',
    RESERVATION_ACCEPTED: 'reservation_accepted',
    RESERVATION_CANCELLED: 'reservation_cancelled',
    PAYMENT_RECEIVED: 'payment_received',
    DOCUMENT_UPLOADED: 'document_uploaded',
    REVIEW_RECEIVED: 'review_received',
    ANNONCE_APPROVED: 'annonce_approved',
    ANNONCE_REJECTED: 'annonce_rejected'
  }
};

export default notificationService;
