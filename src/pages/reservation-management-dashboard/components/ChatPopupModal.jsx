import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import messageService from '../../../services/messageService';

const toTimestamp = (value) => {
  const parsed = new Date(value)?.getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortMessagesByDate = (messages = []) =>
  [...(messages || [])]?.sort((left, right) => toTimestamp(left?.created_at) - toTimestamp(right?.created_at));

const getTimeLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date?.getTime())) return '';
  return date?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

const ChatPopupModal = ({
  isOpen = false,
  conversationId = null,
  reservation = null,
  currentUserId = null,
  onClose = null,
  onOpenFullChat = null
}) => {
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesContainerRef = useRef(null);

  const title = useMemo(() => {
    const participantName = String(reservation?.participantPseudo || '')?.trim();
    if (participantName) return `Discussion avec ${participantName}`;
    return 'Discussion';
  }, [reservation?.participantPseudo]);

  const subtitle = useMemo(() => {
    const equipmentTitle = String(reservation?.equipmentTitle || '')?.trim();
    if (!equipmentTitle) return null;
    return equipmentTitle;
  }, [reservation?.equipmentTitle]);

  useEffect(() => {
    if (!isOpen || !conversationId) return undefined;

    let isMounted = true;

    const loadMessages = async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoadingMessages(true);
        const { data, error } = await messageService?.getMessages(conversationId);
        if (error) throw error;
        if (!isMounted) return;
        setMessages(sortMessagesByDate(data || []));
      } catch (error) {
        console.error('Erreur chargement messages popup:', error);
        if (!isMounted) return;
        if (!silent) setMessages([]);
      } finally {
        if (!silent && isMounted) setLoadingMessages(false);
      }
    };

    loadMessages();

    const channel = messageService?.subscribeToMessages(conversationId, (newMsg) => {
      if (!isMounted) return;
      setMessages((previousMessages) => {
        const alreadyExists = (previousMessages || [])?.some(
          (existingMessage) => String(existingMessage?.id || '') === String(newMsg?.id || '')
        );
        if (alreadyExists) return previousMessages;
        return sortMessagesByDate([...(previousMessages || []), newMsg]);
      });
    });

    const fallbackPoll = window?.setInterval(() => {
      loadMessages({ silent: true });
    }, 5000);

    return () => {
      isMounted = false;
      messageService?.unsubscribe(channel);
      if (fallbackPoll) window?.clearInterval(fallbackPoll);
    };
  }, [conversationId, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setNewMessage('');
      setSending(false);
      setLoadingMessages(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event) => {
      if (event?.key === 'Escape') {
        onClose?.();
      }
    };

    window?.addEventListener('keydown', onKeyDown);
    return () => window?.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const container = messagesContainerRef?.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [isOpen, messages]);

  const handleSendMessage = async (event) => {
    event?.preventDefault();
    const content = String(newMessage || '')?.trim();
    if (!content || !conversationId) return;

    try {
      setSending(true);
      const { data, error } = await messageService?.sendMessage(conversationId, content);
      if (error) throw error;

      setMessages((previousMessages) => {
        const alreadyExists = (previousMessages || [])?.some(
          (existingMessage) => String(existingMessage?.id || '') === String(data?.id || '')
        );
        if (alreadyExists) return previousMessages;
        return sortMessagesByDate([...(previousMessages || []), data]);
      });
      setNewMessage('');
    } catch (error) {
      console.error('Erreur envoi message popup:', error);
      window.alert(error?.message || "Impossible d'envoyer le message pour le moment.");
    } finally {
      setSending(false);
    }
  };

  if (!isOpen || !conversationId) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[2200] flex items-center justify-center bg-black/60 p-4"
      onClick={(event) => {
        if (event?.target === event?.currentTarget) onClose?.();
      }}
    >
      <div className="bg-white rounded-xl shadow-elevation-4 w-full max-w-4xl h-[85vh] flex flex-col border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base md:text-lg font-semibold text-foreground truncate">{title}</h2>
            {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              iconName="ExternalLink"
              onClick={() => onOpenFullChat?.(conversationId)}
            >
              Plein ecran
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 rounded-md hover:bg-surface transition-colors inline-flex items-center justify-center"
              aria-label="Fermer la discussion"
            >
              <Icon name="X" size={18} />
            </button>
          </div>
        </div>

        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 bg-surface/50">
          {loadingMessages ? (
            <div className="h-full flex items-center justify-center">
              <Icon name="Loader" size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : messages?.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center">
              <p className="text-sm text-muted-foreground">
                Aucun message pour le moment. Envoyez le premier message.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages?.map((message) => {
                const isOwnMessage = String(message?.sender_id || '') === String(currentUserId || '');
                return (
                  <div key={message?.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] md:max-w-[70%] rounded-xl px-3 py-2 ${
                        isOwnMessage ? 'bg-[#17a2b8] text-white' : 'bg-white border border-border text-foreground'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{message?.content}</p>
                      <p className={`text-[11px] mt-1 ${isOwnMessage ? 'text-white/75' : 'text-muted-foreground'}`}>
                        {getTimeLabel(message?.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <form onSubmit={handleSendMessage} className="border-t border-border p-3 bg-white">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(event) => setNewMessage(event?.target?.value || '')}
              placeholder="Ecrivez votre message..."
              className="flex-1 h-11 px-3 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-[#17a2b8]/30"
              disabled={sending}
            />
            <Button
              type="submit"
              iconName="Send"
              loading={sending}
              disabled={!String(newMessage || '')?.trim() || sending}
              className="bg-[#17a2b8] hover:bg-[#138496] text-white"
            >
              Envoyer
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return modal;
  }

  return createPortal(modal, document.body);
};

export default ChatPopupModal;

