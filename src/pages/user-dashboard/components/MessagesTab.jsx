import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';

import Button from '../../../components/ui/Button';
import messageService from '../../../services/messageService';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';

const toTimestamp = (value) => {
  const parsed = new Date(value)?.getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortMessagesByCreatedAt = (messages = []) =>
  [...(messages || [])]?.sort((left, right) => toTimestamp(left?.created_at) - toTimestamp(right?.created_at));

const MessagesTab = ({ initialConversationId = null }) => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) {
      fetchConversations();
    }
  }, [user?.id]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation);
      
      // Subscribe to real-time messages
      const channel = messageService?.subscribeToMessages(selectedConversation, (newMsg) => {
        setMessages((prev) => {
          const alreadyInList = (prev || [])?.some(
            (message) => String(message?.id || '') === String(newMsg?.id || '')
          );
          if (alreadyInList) return prev;
          return sortMessagesByCreatedAt([...(prev || []), newMsg]);
        });
      });

      const fallbackPoll = window?.setInterval(() => {
        fetchMessages(selectedConversation);
      }, 5000);

      return () => {
        messageService?.unsubscribe(channel);
        if (fallbackPoll) window?.clearInterval(fallbackPoll);
      };
    }
  }, [selectedConversation]);

  useEffect(() => {
    if (!conversations?.length) {
      setSelectedConversation(null);
      setMessages([]);
      return;
    }

    const selectedStillExists = conversations?.some(
      (conversation) => String(conversation?.id) === String(selectedConversation)
    );
    if (selectedStillExists) return;

    const matchingInitialConversation = initialConversationId
      ? conversations?.find((conversation) => String(conversation?.id) === String(initialConversationId))
      : null;

    setSelectedConversation(matchingInitialConversation?.id || conversations?.[0]?.id || null);
  }, [initialConversationId, conversations, selectedConversation]);

  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    const selectedConversationData = conversations?.find(
      (conversation) => String(conversation?.id) === String(selectedConversation)
    );
    if (!selectedConversationData) return;

    setMessages(sortMessagesByCreatedAt(selectedConversationData?.messages || []));
  }, [conversations, selectedConversation]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const { data, error } = await messageService?.getUserConversations(user?.id);
      if (error) throw error;

      setConversations(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement de conversations:', error);
      toast?.error('Erreur lors du chargement des conversations');
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId) => {
    try {
      const { data, error } = await messageService?.getMessages(conversationId);
      if (error) throw error;

      setMessages(sortMessagesByCreatedAt(data || []));
    } catch (error) {
      console.error('Erreur lors du chargement de messages:', error);
      toast?.error('Erreur lors du chargement des messages');
      setMessages([]);
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!newMessage?.trim() || !selectedConversation) return;

    setSending(true);
    try {
      const { data, error } = await messageService?.sendMessage(selectedConversation, newMessage?.trim());
      if (error) throw error;

      setMessages((prev) => {
        const alreadyInList = (prev || [])?.some(
          (message) => String(message?.id || '') === String(data?.id || '')
        );
        if (alreadyInList) return prev;
        return sortMessagesByCreatedAt([...(prev || []), data]);
      });
      setNewMessage('');
    } catch (error) {
      console.error('Send message error:', error);
      toast?.error('Erreur lors de l\'envoi du message');
    } finally {
      setSending(false);
    }
  };

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const messageDate = new Date(timestamp);
    const diffInMinutes = Math.floor((now - messageDate) / (1000 * 60));

    if (diffInMinutes < 60) {
      return `Il y a ${diffInMinutes} min`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `Il y a ${hours}h`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `Il y a ${days}j`;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Icon name="Loader" size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Conversations</h2>
      </div>

      {/* Conversations List */}
      {conversations?.length === 0 ?
        <div className="text-center py-12">
          <Icon name="MessageSquare" size={48} className="mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Aucune conversation</p>
        </div> :
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Conversations sidebar */}
          <div className="lg:col-span-1 space-y-2">
            {conversations?.map((conversation) => {
              const lastMessage = conversation?.messages?.[conversation?.messages?.length - 1];

              return (
                <button
                  key={conversation?.id}
                  onClick={() => setSelectedConversation(conversation?.id)}
                  className={`w-full text-left bg-surface rounded-lg p-4 border transition-all ${
                    selectedConversation === conversation?.id ?
                    'border-[#17a2b8] shadow-elevation-2' :
                    'border-border hover:border-muted-foreground hover:shadow-elevation-1'}`
                  }>
                  <div className="flex gap-3">
                    {/* User Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                        <Icon name="User" size={24} className="text-muted-foreground" />
                      </div>
                    </div>

                    {/* Conversation Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate text-foreground">
                            {conversation?.annonce?.titre || 'Conversation'}
                          </h3>
                        </div>
                        {lastMessage && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {getTimeAgo(lastMessage?.created_at)}
                          </span>
                        )}
                      </div>
                      {lastMessage && (
                        <p className="text-sm line-clamp-2 text-muted-foreground">
                          {lastMessage?.content}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Chat Interface */}
          <div className="lg:col-span-2">
            {selectedConversation ? (
              <div className="bg-surface rounded-lg border border-border h-[600px] flex flex-col">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages?.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center">
                      <p className="text-sm text-muted-foreground">
                        Aucun message pour le moment. Envoyez le premier message.
                      </p>
                    </div>
                  ) : messages?.map((message) => {
                    const isOwn = message?.sender_id === user?.id;

                    return (
                      <div key={message?.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] rounded-lg p-3 ${
                          isOwn ? 'bg-[#17a2b8] text-white' : 'bg-muted text-foreground'
                        }`}>
                          <p className="text-sm">{message?.content}</p>
                          <span className={`text-xs mt-1 block ${
                            isOwn ? 'text-white/70' : 'text-muted-foreground'
                          }`}>
                            {new Date(message?.created_at)?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Message Input */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-border">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e?.target?.value)}
                      placeholder="Tapez votre message..."
                      className="flex-1 px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#17a2b8]"
                      disabled={sending}
                    />
                    <Button
                      type="submit"
                      iconName="Send"
                      loading={sending}
                      disabled={!newMessage?.trim() || sending}
                      className="bg-[#17a2b8] hover:bg-[#138496]"
                    >
                      Envoyer
                    </Button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="bg-surface rounded-lg border border-border h-[600px] flex items-center justify-center">
                <div className="text-center">
                  <Icon name="MessageSquare" size={48} className="mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Sélectionnez une conversation</p>
                </div>
              </div>
            )}
          </div>
        </div>
      }
    </div>
  );
};

export default MessagesTab;

