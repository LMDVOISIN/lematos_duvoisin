import { supabase } from '../lib/supabase';
import { sendEmail } from './emailService';
import reservationService from './reservationService';

/**
 * Message Service
 * Maps to 'conversations' and 'messages' tables
 * Handles real-time messaging between users
 */

function isSchemaError(error) {
  if (!error) return false;
  if (error?.code && typeof error?.code === 'string') {
    if (error?.code === '42501' || error?.code === '42P17') return false;
    const errorClass = error?.code?.substring(0, 2);
    if (errorClass === '42' || errorClass === '08') return true;
  }
  if (error?.message) {
    const normalizedMessage = String(error?.message || '')?.toLowerCase();
    if (
      normalizedMessage?.includes('row-level security')
      || normalizedMessage?.includes('infinite recursion detected in policy')
    ) {
      return false;
    }
    const schemaErrorPatterns = [
      /relation.*does not exist/i,
      /column.*does not exist/i,
      /function.*does not exist/i,
      /syntax error/i,
    ];
    return schemaErrorPatterns?.some((pattern) => pattern?.test(error?.message));
  }
  return false;
}

const MESSAGING_ACCESS_DENIED_MESSAGE = "La messagerie entre utilisateurs est disponible uniquement lorsqu'une réservation liée à cette annonce existe entre les deux comptes.";
const MESSAGING_RLS_MISCONFIGURED_MESSAGE = 'Messagerie indisponible pour cette réservation (règles de sécurité à mettre à jour).';

const toMessagingAccessError = (message = MESSAGING_ACCESS_DENIED_MESSAGE) => ({ message });
const toMessagingRlsError = () => ({ message: MESSAGING_RLS_MISCONFIGURED_MESSAGE });

const normalizeParticipantIds = (participantIds = []) =>
  Array.from(new Set((participantIds || [])?.map((id) => String(id))?.filter(Boolean)));

let supportsReceiverIdColumn = null;

const isProfileJoinResolutionError = (error) => {
  if (!error) return false;
  const message = String(error?.message || '')?.toLowerCase();
  const details = String(error?.details || '')?.toLowerCase();
  return message?.includes('messages_sender_id_fkey')
    || message?.includes('could not find a relationship')
    || details?.includes('messages_sender_id_fkey');
};

const isMissingColumnError = (error, columnName) => {
  if (!error || !columnName) return false;
  const needle = String(columnName || '')?.toLowerCase();
  const message = String(error?.message || '')?.toLowerCase();
  const details = String(error?.details || '')?.toLowerCase();
  return message?.includes(`could not find the '${needle}' column`)
    || message?.includes(`column "${needle}" does not exist`)
    || details?.includes(`column "${needle}" does not exist`);
};

const isRlsViolation = (error) => {
  if (!error) return false;
  const code = String(error?.code || '')?.trim()?.toUpperCase();
  const details = String(error?.details || '')?.toLowerCase();
  const hint = String(error?.hint || '')?.toLowerCase();
  const message = String(error?.message || '')?.toLowerCase();
  const errorText = `${message} ${details} ${hint}`;
  return code === '42501'
    || code === '42P17'
    || errorText?.includes('row-level security')
    || errorText?.includes('infinite recursion detected in policy')
    || errorText?.includes('violates row-level security policy');
};

const isMissingRpcFunctionError = (error, functionName) => {
  if (!error || !functionName) return false;
  const message = String(error?.message || '')?.toLowerCase();
  const details = String(error?.details || '')?.toLowerCase();
  const code = String(error?.code || '')?.toUpperCase();
  const fn = String(functionName || '')?.toLowerCase();
  return code === 'PGRST202'
    || message?.includes('could not find the function')
    || message?.includes(fn)
    || details?.includes(fn);
};

const ensureCurrentUserCanMessageParticipant = async ({ currentUserId, otherUserId, annonceId }) => {
  if (!currentUserId || !otherUserId || !annonceId) {
    return { data: null, error: toMessagingAccessError() };
  }

  const { data: hasActiveLink, error } = await reservationService?.hasChatEligibleReservationLinkBetweenUsers({
    userId: currentUserId,
    otherUserId,
    annonceId
  });

  if (error) {
    return { data: null, error };
  }

  if (!hasActiveLink) {
    return { data: null, error: toMessagingAccessError() };
  }

  return { data: true, error: null };
};

const getConversationAccessContext = async (conversationId, currentUserId) => {
  const { data: conversation, error } = await supabase
    ?.from('conversations')
    ?.select('id, annonce_id, annonce:annonces(titre), conversation_participants(user_id)')
    ?.eq('id', conversationId)
    ?.maybeSingle();

  if (error) {
    if (error?.code === 'PGRST116') {
      return { data: null, error: { message: 'Conversation introuvable' } };
    }
    if (isRlsViolation(error)) {
      return { data: null, error: toMessagingRlsError() };
    }
    if (isSchemaError(error)) {
      console.error('Schema error in getConversationAccessContext:', error?.message);
      throw error;
    }
    return { data: null, error };
  }

  if (!conversation) {
    return { data: null, error: { message: 'Conversation introuvable' } };
  }

  const participantIds = normalizeParticipantIds(
    conversation?.conversation_participants?.map((participant) => participant?.user_id)
  );
  const normalizedCurrentUserId = String(currentUserId || '');
  if (!participantIds?.includes(normalizedCurrentUserId)) {
    return { data: null, error: toMessagingAccessError() };
  }

  const otherParticipantId = participantIds?.find((participantId) => participantId !== normalizedCurrentUserId);
  if (!otherParticipantId) {
    return { data: null, error: toMessagingAccessError() };
  }

  const eligibilityResult = await ensureCurrentUserCanMessageParticipant({
    currentUserId: normalizedCurrentUserId,
    otherUserId: otherParticipantId,
    annonceId: conversation?.annonce_id
  });

  if (eligibilityResult?.error) {
    return { data: null, error: eligibilityResult?.error };
  }

  return {
    data: {
      conversation,
      otherParticipantId
    },
    error: null
  };
};

const messageService = {
  /**
   * Get or create conversation between two users for an annonce
   */
  getOrCreateConversation: async (annonceId, participantIds) => {
    try {
      const { data: { user } } = await supabase?.auth?.getUser();
      if (!user) return { data: null, error: { message: 'User not authenticated' } };

      const normalizedParticipantIds = normalizeParticipantIds(participantIds);
      const currentUserId = String(user?.id || '');

      if (!normalizedParticipantIds?.includes(currentUserId)) {
        return { data: null, error: toMessagingAccessError() };
      }

      const otherParticipantId = normalizedParticipantIds?.find((participantId) => participantId !== currentUserId);
      if (!otherParticipantId) {
        return { data: null, error: toMessagingAccessError() };
      }

      const eligibilityResult = await ensureCurrentUserCanMessageParticipant({
        currentUserId,
        otherUserId: otherParticipantId,
        annonceId
      });
      if (eligibilityResult?.error) {
        return { data: null, error: eligibilityResult?.error };
      }

      // Preferred path: DB-side canonical resolver + participant repair.
      const { data: rpcConversationId, error: rpcError } = await supabase?.rpc(
        'chat_get_or_create_conversation',
        {
          p_annonce_id: annonceId,
          p_other_user_id: otherParticipantId
        }
      );

      if (!rpcError && rpcConversationId) {
        const { data: rpcConversation, error: rpcConversationError } = await supabase
          ?.from('conversations')
          ?.select(`
            *,
            conversation_participants(user_id)
          `)
          ?.eq('id', rpcConversationId)
          ?.maybeSingle();

        if (rpcConversationError) {
          if (isRlsViolation(rpcConversationError)) {
            return { data: null, error: toMessagingRlsError() };
          }
          if (isSchemaError(rpcConversationError)) {
            console.error('Schema error in getOrCreateConversation/rpc-fetch:', rpcConversationError?.message);
            throw rpcConversationError;
          }
          return { data: null, error: rpcConversationError };
        }

        if (rpcConversation) {
          return { data: rpcConversation, error: null };
        }

        return { data: { id: rpcConversationId, annonce_id: annonceId }, error: null };
      }

      if (rpcError && !isMissingRpcFunctionError(rpcError, 'chat_get_or_create_conversation')) {
        if (isRlsViolation(rpcError)) {
          return { data: null, error: toMessagingRlsError() };
        }
        return { data: null, error: rpcError };
      }

      // Check if conversation exists
      const { data: existingConv, error: searchError } = await supabase?.from('conversations')?.select(`
          *,
          conversation_participants(user_id)
        `)?.eq('annonce_id', annonceId);

      if (searchError) {
        if (isRlsViolation(searchError)) {
          return { data: null, error: toMessagingRlsError() };
        }
        if (isSchemaError(searchError)) {
          console.error('Schema error in getOrCreateConversation/search:', searchError?.message);
          throw searchError;
        }
        return { data: null, error: searchError };
      }

      // Find conversation with matching participants
      const conversation = (existingConv || [])?.find((conv) => {
        const convParticipants = normalizeParticipantIds(conv?.conversation_participants?.map((p) => p?.user_id));
        return normalizedParticipantIds?.every((id) => convParticipants?.includes(id));
      });

      if (conversation) {
        return { data: conversation, error: null };
      }

      // Create new conversation
      const { data: newConv, error: createError } = await supabase?.from('conversations')?.insert({
          annonce_id: annonceId,
          created_at: new Date()?.toISOString(),
          updated_at: new Date()?.toISOString()
        })?.select()?.single();

      if (createError) {
        if (isRlsViolation(createError)) {
          return { data: null, error: toMessagingRlsError() };
        }
        if (isSchemaError(createError)) {
          console.error('Schema error in getOrCreateConversation:', createError?.message);
          throw createError;
        }
        return { data: null, error: createError };
      }

      // Add participants
      const participants = normalizedParticipantIds?.map((participantId) => ({
        conversation_id: newConv?.id,
        user_id: participantId,
        created_at: new Date()?.toISOString()
      }));

      const { error: participantsError } = await supabase?.from('conversation_participants')?.insert(participants);

      if (participantsError) {
        if (isRlsViolation(participantsError)) {
          return { data: null, error: toMessagingRlsError() };
        }
        if (isSchemaError(participantsError)) {
          console.error('Schema error adding participants:', participantsError?.message);
          throw participantsError;
        }
        return { data: null, error: participantsError };
      }

      return { data: newConv, error: null };
    } catch (error) {
      console.error('Get or create conversation error:', error);
      if (isRlsViolation(error)) {
        return { data: null, error: toMessagingRlsError() };
      }
      if (isSchemaError(error)) {
        return {
          data: null,
          error: { message: 'Messagerie indisponible temporairement. Reessayez dans quelques instants.' }
        };
      }
      return { data: null, error: { message: error?.message || "Impossible d'ouvrir le chat pour le moment." } };
    }
  },

  /**
   * Get user's conversations
   */
  getUserConversations: async (userId) => {
    try {
      const { data: { user } } = await supabase?.auth?.getUser();
      if (!user) return { data: null, error: { message: 'User not authenticated' } };

      const currentUserId = String(user?.id || '');
      if (userId && String(userId) !== currentUserId) {
        return { data: null, error: toMessagingAccessError() };
      }

      const { data, error } = await supabase?.from('conversation_participants')?.select(`
          conversation:conversations(
            *,
            annonce:annonces(titre, photos),
            messages(content, created_at, sender_id),
            conversation_participants(user_id)
          )
        `)?.eq('user_id', currentUserId)?.order('created_at', { ascending: false });

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Schema error in getUserConversations:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      const conversations = data?.map((item) => item?.conversation)?.filter(Boolean) || [];
      if (conversations?.length === 0) {
        return { data: [], error: null };
      }

      const checks = await Promise.all(
        conversations?.map(async (conversation) => {
          const participantIds = normalizeParticipantIds(
            conversation?.conversation_participants?.map((participant) => participant?.user_id)
          );
          const otherParticipantId = participantIds?.find((participantId) => participantId !== currentUserId);
          if (!otherParticipantId || !conversation?.annonce_id) {
            return null;
          }

          const { data: hasActiveLink, error: linkError } =
            await reservationService?.hasChatEligibleReservationLinkBetweenUsers({
              userId: currentUserId,
              otherUserId: otherParticipantId,
              annonceId: conversation?.annonce_id
            });

          if (linkError || !hasActiveLink) {
            return null;
          }

          return conversation;
        })
      );

      return { data: checks?.filter(Boolean) || [], error: null };
    } catch (error) {
      console.error('Get user conversations error:', error);
      throw error;
    }
  },

  /**
   * Get messages for a conversation
   */
  getMessages: async (conversationId) => {
    try {
      const { data: { user } } = await supabase?.auth?.getUser();
      if (!user) return { data: null, error: { message: 'User not authenticated' } };

      const accessContext = await getConversationAccessContext(conversationId, user?.id);
      if (accessContext?.error) {
        return { data: null, error: accessContext?.error };
      }

      const buildMessagesQuery = (selectClause) => supabase
        ?.from('messages')
        ?.select(selectClause)
        ?.eq('conversation_id', conversationId)
        ?.order('created_at', { ascending: true });

      let { data, error } = await buildMessagesQuery(`
        *,
        sender:profiles!messages_sender_id_fkey(pseudo, avatar_url)
      `);

      if (error && isProfileJoinResolutionError(error)) {
        const fallbackResult = await buildMessagesQuery('*');
        data = fallbackResult?.data;
        error = fallbackResult?.error;
      }

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Schema error in getMessages:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get messages error:', error);
      throw error;
    }
  },

  /**
   * Send message in conversation
   */
  sendMessage: async (conversationId, content) => {
    try {
      const { data: { user } } = await supabase?.auth?.getUser();
      if (!user) return { data: null, error: { message: 'User not authenticated' } };

      const sanitizedContent = String(content || '')?.trim();
      if (!sanitizedContent) {
        return { data: null, error: { message: 'Message vide' } };
      }

      const accessContext = await getConversationAccessContext(conversationId, user?.id);
      if (accessContext?.error) {
        return { data: null, error: accessContext?.error };
      }

      const conversation = accessContext?.data?.conversation;
      const recipientId = accessContext?.data?.otherParticipantId;
      if (!recipientId) {
        return { data: null, error: toMessagingAccessError() };
      }

      const baseMessageData = {
        conversation_id: conversationId,
        sender_id: user?.id,
        content: sanitizedContent,
        created_at: new Date()?.toISOString()
      };

      const insertMessage = async (payload) =>
        supabase?.from('messages')?.insert(payload)?.select()?.single();

      let data = null;
      let error = null;

      if (supportsReceiverIdColumn === false) {
        const fallbackResult = await insertMessage(baseMessageData);
        data = fallbackResult?.data;
        error = fallbackResult?.error;
      } else {
        const withReceiverResult = await insertMessage({
          ...baseMessageData,
          receiver_id: recipientId
        });

        data = withReceiverResult?.data;
        error = withReceiverResult?.error;

        if (error && isMissingColumnError(error, 'receiver_id')) {
          supportsReceiverIdColumn = false;
          const fallbackResult = await insertMessage(baseMessageData);
          data = fallbackResult?.data;
          error = fallbackResult?.error;
        } else if (!error) {
          supportsReceiverIdColumn = true;
        }
      }

      if (error) {
        if (isSchemaError(error)) {
          console.error('Schema error in sendMessage:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      if (conversation && recipientId) {
        const { data: senderProfile } = await supabase?.from('profiles')?.select('pseudo')?.eq('id', user?.id)?.single();
        const { data: recipientProfile } = await supabase?.from('profiles')?.select('pseudo, email')?.eq('id', recipientId)?.single();

        if (recipientProfile?.email) {
          const messagePreview = sanitizedContent?.length > 100
            ? `${sanitizedContent?.substring(0, 100)}...`
            : sanitizedContent;

          const messageUrlParams = [
            `conversation=${encodeURIComponent(String(conversationId || ''))}`
          ];

          if (conversation?.annonce_id) {
            messageUrlParams.push(`annonce=${encodeURIComponent(String(conversation?.annonce_id))}`);
          }

          if (user?.id) {
            messageUrlParams.push(`other=${encodeURIComponent(String(user?.id))}`);
          }

          const messageUrl = `${window.location?.origin || ''}/mes-reservations?${messageUrlParams?.join('&')}`;

          await sendEmail({
            to: recipientProfile?.email,
            templateKey: 'message_received',
            variables: {
              recipient_name: recipientProfile?.pseudo || 'Utilisateur',
              sender_name: senderProfile?.pseudo || 'Utilisateur',
              annonce_title: conversation?.annonce?.titre || 'Equipement',
              message_preview: messagePreview,
              message_url: messageUrl
            }
          });
        }
      }

      await supabase?.from('conversations')?.update({ updated_at: new Date()?.toISOString() })?.eq('id', conversationId);

      return { data, error: null };
    } catch (error) {
      console.error('Send message error:', error);
      throw error;
    }
  },

  /**
   * Subscribe to new messages in a conversation (real-time)
   */
  subscribeToMessages: (conversationId, callback) => {
    const channel = supabase?.channel(`messages:${conversationId}`)?.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        async (payload) => {
          const withSenderResult = await supabase
            ?.from('messages')
            ?.select(`
              *,
              sender:profiles!messages_sender_id_fkey(pseudo, avatar_url)
            `)
            ?.eq('id', payload?.new?.id)
            ?.single();

          let message = withSenderResult?.data;
          let fetchError = withSenderResult?.error;

          if (fetchError && isProfileJoinResolutionError(fetchError)) {
            const fallbackResult = await supabase
              ?.from('messages')
              ?.select('*')
              ?.eq('id', payload?.new?.id)
              ?.single();
            message = fallbackResult?.data;
            fetchError = fallbackResult?.error;
          }

          if (fetchError) {
            callback(payload?.new);
            return;
          }

          callback(message || payload?.new);
        }
      )?.subscribe();

    return channel;
  },

  /**
   * Subscribe to all user conversations (real-time)
   */
  subscribeToConversations: (userId, callback) => {
    const channel = supabase?.channel(`conversations:${userId}`)?.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },
        callback
      )?.subscribe();

    return channel;
  },

  /**
   * Unsubscribe from real-time channel
   */
  unsubscribe: (channel) => {
    if (channel) {
      supabase?.removeChannel(channel);
    }
  },

  /**
   * Delete message
   */
  deleteMessage: async (messageId) => {
    try {
      const { data: { user } } = await supabase?.auth?.getUser();
      if (!user) return { error: { message: 'User not authenticated' } };

      const { error } = await supabase?.from('messages')?.delete()?.eq('id', messageId)?.eq('sender_id', user?.id);

      if (error) {
        if (isSchemaError(error)) {
          console.error('Schema error in deleteMessage:', error?.message);
          throw error;
        }
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Delete message error:', error);
      throw error;
    }
  },

  /**
   * Get conversation by ID
   */
  getConversationById: async (conversationId) => {
    try {
      const { data: { user } } = await supabase?.auth?.getUser();
      if (!user) return { data: null, error: { message: 'User not authenticated' } };

      const accessContext = await getConversationAccessContext(conversationId, user?.id);
      if (accessContext?.error) {
        return { data: null, error: accessContext?.error };
      }

      const { data, error } = await supabase?.from('conversations')?.select(`
          *,
          annonce:annonces(titre, photos, owner_id),
          conversation_participants(
            user:profiles(pseudo, avatar_url, email)
          )
        `)?.eq('id', conversationId)?.maybeSingle();

      if (error) {
        if (error?.code === 'PGRST116') return { data: null, error: null };
        if (isSchemaError(error)) {
          console.error('Schema error in getConversationById:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get conversation by ID error:', error);
      throw error;
    }
  }
};

export default messageService;

