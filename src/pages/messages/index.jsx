import React, { useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import MessagesTab from '../user-dashboard/components/MessagesTab';
import { useAuth } from '../../contexts/AuthContext';
import { ActionCard, ActionHero, ActionPageShell } from '../../components/page/ActionPageLayout';

const Messages = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const initialConversationId = String(searchParams?.get('conversation') || '')?.trim() || null;

  useEffect(() => {
    if (!loading && !user) {
      navigate('/authentification', {
        replace: true,
        state: {
          from: `${location?.pathname || '/messages'}${location?.search || ''}`
        }
      });
    }
  }, [loading, location?.pathname, location?.search, navigate, user]);

  if (loading) {
    return (
      <ActionPageShell
        maxWidth="max-w-5xl"
        hero={(
          <ActionHero
            eyebrow="Messages"
            title="Vos conversations arrivent ici"
            subtitle="Ouvrez une discussion, répondez, puis passez à l'étape suivante avec votre interlocuteur."
            pills={[
              { label: 'Accès direct aux conversations actives', icon: 'MessageSquare' },
              { label: 'Réponse en temps réel', icon: 'Zap' }
            ]}
            tone="sky"
          />
        )}
      >
        <div className="flex items-center justify-center py-10">
          <div className="w-10 h-10 rounded-full border-4 border-[#17a2b8]/20 border-t-[#17a2b8] animate-spin" aria-hidden="true" />
        </div>
      </ActionPageShell>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <ActionPageShell
      maxWidth="max-w-6xl"
      hero={(
        <ActionHero
          eyebrow="Messages"
          title="Vos conversations"
          subtitle="Choisissez une conversation et repondez."
          pills={[
            { label: 'Conversations actives', icon: 'MessageSquare' },
            { label: 'Reponse rapide', icon: 'Send' }
          ]}
          tone="sky"
        />
      )}
    >
      <ActionCard className="p-4 md:p-6">
          <MessagesTab initialConversationId={initialConversationId} />
      </ActionCard>
    </ActionPageShell>
  );
};

export default Messages;
