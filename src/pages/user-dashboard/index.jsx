import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import annonceService from '../../services/annonceService';
import reservationService from '../../services/reservationService';
import messageService from '../../services/messageService';
import ReservationsTab from './components/ReservationsTab';
import ListingsTab from './components/ListingsTab';
import MessagesTab from './components/MessagesTab';
import DocumentsTab from './components/DocumentsTab';
import DemandesTab from './components/DemandesTab';

const TERMINAL_RESERVATION_STATUSES = new Set([
  'cancelled',
  'canceled',
  'refused',
  'rejected',
  'completed',
  'finished',
  'closed',
  'expired'
]);

const CHAT_ELIGIBLE_RESERVATION_STATUSES = new Set(['accepted', 'paid', 'active', 'ongoing']);

const isReservationChatEligible = (reservation) => {
  const status = String(reservation?.status || '')?.trim()?.toLowerCase();
  return CHAT_ELIGIBLE_RESERVATION_STATUSES?.has(status);
};

const VALID_TABS = new Set(['reservations', 'listings', 'demandes', 'messages', 'documents']);

const UserDashboard = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const requestedTab = searchParams?.get('tab');
  const requestedConversationId = searchParams?.get('conversation');
  const [activeTab, setActiveTab] = useState(() => requestedTab || 'reservations');
  const [hasMessagingAccess, setHasMessagingAccess] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({
    loading: true,
    reservationsActive: 0,
    reservationsTotal: 0,
    listingsPublished: 0,
    listingsPending: 0,
    conversationsCount: 0,
    messagesCount: 0
  });

  useEffect(() => {
    if (requestedTab && VALID_TABS?.has(requestedTab)) {
      if (requestedTab === 'messages' && !hasMessagingAccess) {
        setActiveTab('reservations');
        return;
      }
      setActiveTab(requestedTab);
    }
  }, [hasMessagingAccess, requestedTab]);

  useEffect(() => {
    if (!hasMessagingAccess && activeTab === 'messages') {
      setActiveTab('reservations');
    }
  }, [activeTab, hasMessagingAccess]);

  useEffect(() => {
    let isMounted = true;

    const loadDashboardStats = async () => {
      if (!user?.id) {
        if (isMounted) {
          setHasMessagingAccess(false);
          setDashboardStats((prev) => ({ ...prev, loading: false }));
        }
        return;
      }

      try {
        if (isMounted) {
          setDashboardStats((prev) => ({ ...prev, loading: true }));
        }

        const [
          { data: reservationsData, error: reservationsError },
          { data: listingsData, error: listingsError },
          { data: ownerReservationsData, error: ownerReservationsError }
        ] = await Promise.all([
          reservationService?.getUserReservations(user?.id),
          annonceService?.getUserAnnonces(user?.id),
          reservationService?.getOwnerReservations(user?.id)
        ]);

        if (reservationsError) throw reservationsError;
        if (listingsError) throw listingsError;
        if (ownerReservationsError) throw ownerReservationsError;

        const reservations = Array.isArray(reservationsData) ? reservationsData : [];
        const ownerReservations = Array.isArray(ownerReservationsData) ? ownerReservationsData : [];
        const allReservations = [...reservations, ...ownerReservations];
        const reservationsActive = reservations?.filter((reservation) => {
          const status = String(reservation?.status || '')?.toLowerCase();
          return !status || !TERMINAL_RESERVATION_STATUSES?.has(status);
        })?.length;

        const listings = Array.isArray(listingsData) ? listingsData : [];
        const listingsPublished = listings?.filter((listing) => {
          const statut = String(listing?.statut || '')?.toLowerCase();
          return listing?.published === true || statut === 'publiee' || statut === 'published';
        })?.length;
        const listingsPending = listings?.filter((listing) => {
          const statut = String(listing?.statut || '')?.toLowerCase();
          const moderationStatus = String(listing?.moderation_status || '')?.toLowerCase();
          return statut === 'en_attente' || statut === 'pending' || moderationStatus === 'pending';
        })?.length;

        const canAccessMessaging = allReservations?.some((reservation) => isReservationChatEligible(reservation));
        let conversations = [];
        if (canAccessMessaging) {
          const { data: conversationsData, error: conversationsError } =
            await messageService?.getUserConversations(user?.id);
          if (conversationsError) throw conversationsError;
          conversations = Array.isArray(conversationsData) ? conversationsData : [];
        }

        const messagesCount = conversations?.reduce((sum, conversation) => {
          const count = Array.isArray(conversation?.messages) ? conversation?.messages?.length : 0;
          return sum + count;
        }, 0);

        if (!isMounted) return;

        setDashboardStats({
          loading: false,
          reservationsActive: reservationsActive || 0,
          reservationsTotal: allReservations?.length || 0,
          listingsPublished: listingsPublished || 0,
          listingsPending: listingsPending || 0,
          conversationsCount: conversations?.length || 0,
          messagesCount: messagesCount || 0
        });
        setHasMessagingAccess(Boolean(canAccessMessaging));
      } catch (error) {
        console.error('Erreur de chargement des stats dashboard:', error);
        if (!isMounted) return;
        setHasMessagingAccess(false);
        setDashboardStats((prev) => ({ ...prev, loading: false }));
      }
    };

    loadDashboardStats();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const tabs = [
    { id: 'reservations', label: 'Mes réservations', icon: 'Calendar' },
    { id: 'listings', label: 'Mes annonces', icon: 'Package' },
    { id: 'demandes', label: 'Mes demandes', icon: 'Search' },
    { id: 'documents', label: 'Documents', icon: 'FileText' }
  ];

  if (hasMessagingAccess) {
    tabs?.splice(3, 0, { id: 'messages', label: 'Messages', icon: 'MessageSquare' });
  }

  const stats = [
    {
      id: 1,
      label: 'Réservations actives',
      value: dashboardStats?.reservationsActive,
      icon: 'Calendar',
      trend: dashboardStats?.loading
        ? 'Chargement...'
        : `${dashboardStats?.reservationsTotal || 0} au total`,
      color: 'text-[#17a2b8] bg-[#17a2b8]/10'
    },
    {
      id: 2,
      label: 'Annonces publiées',
      value: dashboardStats?.listingsPublished,
      icon: 'Package',
      trend: dashboardStats?.loading
        ? 'Chargement...'
        : `${dashboardStats?.listingsPending || 0} en attente`,
      color: 'text-success bg-success/10'
    },
    {
      id: 3,
      label: 'Conversations',
      value: dashboardStats?.conversationsCount,
      icon: 'MessageSquare',
      trend: dashboardStats?.loading
        ? 'Chargement...'
        : `${dashboardStats?.messagesCount || 0} message(s)`,
      color: 'text-warning bg-warning/10'
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'reservations':
        return <ReservationsTab />;
      case 'listings':
        return <ListingsTab />;
      case 'demandes':
        return <DemandesTab />;
      case 'messages':
        return hasMessagingAccess
          ? <MessagesTab initialConversationId={requestedConversationId} />
          : <ReservationsTab />;
      case 'documents':
        return <DocumentsTab />;
      default:
        return <ReservationsTab />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-6 md:py-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Tableau de bord</h1>
          <p className="text-muted-foreground">Gérez vos réservations et annonces</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {stats?.map((stat) => (
            <div key={stat?.id} className="bg-white rounded-lg shadow-elevation-1 p-4 md:p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">{stat?.label}</p>
                  <p className="text-3xl font-bold text-foreground mb-2">{stat?.value}</p>
                  <p className="text-xs text-muted-foreground">{stat?.trend}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat?.color}`}>
                  <Icon name={stat?.icon} size={24} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow-elevation-1 overflow-hidden">
          <div className="border-b border-border overflow-x-auto">
            <div className="flex min-w-max md:min-w-0">
              {tabs?.map((tab) => (
                <button
                  key={tab?.id}
                  onClick={() => setActiveTab(tab?.id)}
                  className={`flex items-center gap-2 px-4 md:px-6 py-3 md:py-4 text-sm md:text-base font-medium transition-colors border-b-2 whitespace-nowrap ${
                    activeTab === tab?.id
                      ? 'border-[#17a2b8] text-[#17a2b8] bg-[#17a2b8]/5'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-surface'
                  }`}
                >
                  <Icon name={tab?.icon} size={18} />
                  <span>{tab?.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 md:p-6">
            {renderTabContent()}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default UserDashboard;
