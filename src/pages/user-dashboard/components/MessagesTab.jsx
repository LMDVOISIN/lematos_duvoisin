import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import messageService from '../../../services/messageService';
import { useAuth } from '../../../contexts/AuthContext';
import { ActionEmptyState } from '../../../components/page/ActionPageLayout';

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
    if (!selectedConversation) return undefined;

    fetchMessages(selectedConversation);

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

  const handleSendMessage = async (event) => {
    event?.preventDefault();
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
      toast?.error("Erreur lors de l'envoi du message");
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
    }
    if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `Il y a ${hours}h`;
    }
    const days = Math.floor(diffInMinutes / 1440);
    return `Il y a ${days}j`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Icon name="Loader2" size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  const selectedConversationData = conversations?.find(
    (conversation) => String(conversation?.id) === String(selectedConversation)
  ) || null;

  return (
    <div className="space-y-4">
      {conversations?.length === 0 ? (
        <ActionEmptyState
          icon="MessageSquare"
          title="Aucune conversation pour l'instant"
          description="Les échanges apparaîtront ici dès qu'une réservation active ouvrira la messagerie."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-2 lg:col-span-1">
            {conversations?.map((conversation) => {
              const lastMessage = conversation?.messages?.[conversation?.messages?.length - 1];
              const isSelected = selectedConversation === conversation?.id;

              return (
                <button
                  key={conversation?.id}
                  onClick={() => setSelectedConversation(conversation?.id)}
                  className={`w-full rounded-[24px] border p-4 text-left transition-all ${
                    isSelected
                      ? 'border-sky-300 bg-sky-50/90 shadow-elevation-2'
                      : 'border-border bg-white hover:border-sky-200 hover:shadow-elevation-1'
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="relative flex-shrink-0">
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
                        <Icon name="User" size={24} className="text-muted-foreground" />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-sm font-semibold text-foreground">
                            {conversation?.annonce?.titre || 'Conversation'}
                          </h3>
                        </div>
                        {lastMessage ? (
                          <span className="whitespace-nowrap text-xs text-muted-foreground">
                            {getTimeAgo(lastMessage?.created_at)}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {isSelected ? 'Ouverte maintenant' : 'Cliquez pour répondre'}
                      </p>
                      {lastMessage ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {lastMessage?.content}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-2">
            {selectedConversation ? (
              <div className="flex h-[600px] flex-col rounded-[28px] border border-border bg-slate-50/80">
                <div className="border-b border-slate-200 bg-white/85 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Conversation ouverte</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">
                    {selectedConversationData?.annonce?.titre || 'Conversation'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Répondez ici. Le message part immédiatement.</p>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                  {messages?.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-center">
                      <div className="max-w-sm">
                        <Icon name="MessageSquareDashed" size={40} className="mx-auto text-slate-400" />
                        <p className="mt-3 text-sm font-medium text-slate-950">Aucun message pour le moment</p>
                        <p className="mt-1 text-sm text-muted-foreground">Envoyez le premier message pour lancer l'échange.</p>
                      </div>
                    </div>
                  ) : (
                    messages?.map((message) => {
                      const isOwn = message?.sender_id === user?.id;

                      return (
                        <div key={message?.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[78%] rounded-[22px] p-3 ${
                              isOwn
                                ? 'bg-[#17a2b8] text-white shadow-[0_18px_28px_-24px_rgba(23,162,184,0.9)]'
                                : 'border border-slate-200 bg-white text-foreground'
                            }`}
                          >
                            <p className="text-sm">{message?.content}</p>
                            <span className={`mt-1 block text-xs ${isOwn ? 'text-white/70' : 'text-muted-foreground'}`}>
                              {new Date(message?.created_at)?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <form onSubmit={handleSendMessage} className="border-t border-slate-200 bg-white/90 p-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(event) => setNewMessage(event?.target?.value)}
                      placeholder="Écrivez votre message ici..."
                      className="flex-1 rounded-2xl border border-border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#17a2b8]"
                      disabled={sending}
                    />
                    <Button
                      type="submit"
                      iconName="Send"
                      loading={sending}
                      disabled={!newMessage?.trim() || sending}
                      className="rounded-2xl bg-[#17a2b8] hover:bg-[#138496]"
                    >
                      Envoyer
                    </Button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="flex h-[600px] items-center justify-center rounded-[28px] border border-border bg-slate-50/80">
                <div className="max-w-sm text-center">
                  <Icon name="MessageSquareMore" size={44} className="mx-auto text-slate-400" />
                  <p className="mt-3 text-base font-semibold text-slate-950">Choisissez une conversation</p>
                  <p className="mt-1 text-sm text-muted-foreground">La discussion s'affiche ici dès que vous cliquez sur une carte à gauche.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesTab;
