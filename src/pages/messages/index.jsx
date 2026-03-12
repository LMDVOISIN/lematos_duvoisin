import React, { useState, useEffect } from 'react';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Image from '../../components/AppImage';
import Button from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const Messages = () => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const [filter, setFilter] = useState('all');
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) {
      fetchConversations();
    }
  }, [user?.id]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase?.from('messages')?.select('*')?.or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`)?.order('created_at', { ascending: false });

      if (error) throw error;
      
      // Group messages by conversation
      const conversationsMap = {};
      data?.forEach(msg => {
        const otherUserId = msg?.sender_id === user?.id ? msg?.receiver_id : msg?.sender_id;
        if (!conversationsMap?.[otherUserId]) {
          conversationsMap[otherUserId] = [];
        }
        conversationsMap?.[otherUserId]?.push(msg);
      });
      
      setConversations(Object.values(conversationsMap));
    } catch (error) {
      console.error('Erreur lors du chargement de conversations:', error);
      setConversations([]);
    } finally {
      setLoading(false);
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

  const filteredConversations = conversations?.filter((conv) => {
    if (filter === 'unread') return conv?.unread > 0;
    if (filter === 'archived') return conv?.archived;
    return !conv?.archived;
  });

  const activeConversation = conversations?.find((c) => c?.id === selectedConversation);

  const handleSendMessage = () => {
    if (!messageInput?.trim()) return;
    console.log('Send message:', messageInput);
    setMessageInput('');
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-6 md:py-8">
        <div className="bg-white rounded-lg shadow-elevation-1 overflow-hidden h-[calc(100vh-180px)]">
          <div className="flex h-full">
            {/* Conversations List Sidebar */}
            <div className="w-full md:w-80 lg:w-96 border-r border-border flex flex-col">
              {/* Sidebar En-tête */}
              <div className="p-4 border-b border-border">
                <h2 className="text-xl font-semibold text-foreground mb-4">Messages</h2>
                
                {/* Filter Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    filter === 'all' ? 'bg-[#17a2b8] text-white' : 'bg-surface text-muted-foreground hover:bg-muted hover:text-foreground'}`
                    }>
                    
                    Toutes
                  </button>
                  <button
                    onClick={() => setFilter('unread')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    filter === 'unread' ? 'bg-[#17a2b8] text-white' : 'bg-surface text-muted-foreground hover:bg-muted hover:text-foreground'}`
                    }>
                    
                    Non lues ({conversations?.filter((c) => c?.unread > 0)?.length})
                  </button>
                  <button
                    onClick={() => setFilter('archived')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    filter === 'archived' ? 'bg-[#17a2b8] text-white' : 'bg-surface text-muted-foreground hover:bg-muted hover:text-foreground'}`
                    }>
                    
                    Archivées
                  </button>
                </div>
              </div>

              {/* Conversations List */}
              <div className="flex-1 overflow-y-auto">
                {filteredConversations?.length === 0 ?
                <div className="text-center py-12 px-4">
                    <Icon name="MessageSquare" size={48} className="mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Aucune conversation</p>
                  </div> :

                <div>
                    {filteredConversations?.map((conversation) =>
                  <button
                    key={conversation?.id}
                    onClick={() => setSelectedConversation(conversation?.id)}
                    className={`w-full text-left p-4 border-b border-border transition-all hover:bg-surface ${
                    selectedConversation === conversation?.id ? 'bg-[#17a2b8]/5' : ''}`
                    }>
                    
                        <div className="flex gap-3">
                          {/* User Avatar */}
                          <div className="relative flex-shrink-0">
                            <div className="w-12 h-12 rounded-full overflow-hidden">
                              <Image
                            src={conversation?.userAvatar}
                            alt={conversation?.userAvatarAlt}
                            className="w-full h-full object-cover" />
                          
                            </div>
                            {conversation?.unread > 0 &&
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-error text-white text-xs font-bold rounded-full flex items-center justify-center">
                                {conversation?.unread}
                              </div>
                        }
                          </div>

                          {/* Conversation Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="flex-1 min-w-0">
                                <h3 className={`font-semibold text-sm truncate ${
                            conversation?.unread > 0 ? 'text-foreground' : 'text-muted-foreground'}`
                            }>
                                  {conversation?.userPseudo}
                                </h3>
                                <p className="text-xs text-muted-foreground truncate">{conversation?.equipmentTitle}</p>
                              </div>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {getTimeAgo(conversation?.timestamp)}
                              </span>
                            </div>
                            <p className={`text-sm line-clamp-2 ${
                        conversation?.unread > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`
                        }>
                              {conversation?.lastMessage}
                            </p>
                          </div>
                        </div>
                      </button>
                  )}
                  </div>
                }
              </div>
            </div>

            {/* Active Chat Area */}
            <div className="hidden md:flex flex-1 flex-col">
              {!activeConversation ?
              <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Icon name="MessageSquare" size={64} className="mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-foreground mb-2">Sélectionnez une conversation</p>
                    <p className="text-sm text-muted-foreground">Choisissez une conversation pour commencer à discuter</p>
                  </div>
                </div> :

              <>
                  {/* Chat En-tête */}
                  <div className="p-4 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden">
                        <Image
                        src={activeConversation?.userAvatar}
                        alt={activeConversation?.userAvatarAlt}
                        className="w-full h-full object-cover" />
                      
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{activeConversation?.userPseudo}</h3>
                        <p className="text-xs text-muted-foreground">{activeConversation?.equipmentTitle}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" iconName="MoreVertical" />
                  </div>

                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {activeConversation?.messages?.map((message) =>
                  <div
                    key={message?.id}
                    className={`flex ${message?.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                    
                        <div className={`max-w-[70%] ${
                    message?.sender === 'me' ? 'bg-[#17a2b8] text-white' : 'bg-surface text-foreground'} rounded-lg px-4 py-2`
                    }>
                          <p className="text-sm">{message?.content}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <span className={`text-xs ${
                        message?.sender === 'me' ? 'text-white/70' : 'text-muted-foreground'}`
                        }>
                              {new Date(message?.timestamp)?.toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                            </span>
                            {message?.sender === 'me' &&
                        <Icon
                          name={message?.read ? 'CheckCheck' : 'Check'}
                          size={14}
                          className="text-white/70" />

                        }
                          </div>
                        </div>
                      </div>
                  )}
                  </div>

                  {/* Message Input */}
                  <div className="p-4 border-t border-border">
                    <div className="flex gap-2">
                      <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e?.target?.value)}
                      onKeyPress={(e) => e?.key === 'Enter' && handleSendMessage()}
                      placeholder="Écrivez votre message..."
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
                    
                      <Button
                      iconName="Send"
                      onClick={handleSendMessage}
                      className="bg-[#17a2b8] hover:bg-[#138496]">
                      
                        Envoyer
                      </Button>
                    </div>
                  </div>
                </>
              }
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>);

};

export default Messages;

