import React, { useEffect, useMemo, useState } from 'react';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import notificationService from '../../services/notificationService';
import toast from 'react-hot-toast';

const createDefaultPreferences = () => ({
  bookingRequests: { email: true, push: true, sms: false },
  messages: { email: true, push: true, sms: false },
  payments: { email: true, push: true, sms: false },
  reminders: { email: true, push: false, sms: false },
  documents: { email: true, push: true, sms: false },
  marketing: { email: false, push: false, sms: false }
});

const mergePreferencesWithDefaults = (rows) => {
  const merged = createDefaultPreferences();
  (rows || [])?.forEach((row) => {
    const category = row?.category;
    if (!category || !merged?.[category]) return;

    merged[category] = {
      email: Boolean(row?.email_enabled),
      push: Boolean(row?.push_enabled),
      sms: Boolean(row?.sms_enabled)
    };
  });
  return merged;
};

const TYPE_META = {
  new_message: { icon: 'MessageSquare', title: 'Nouveau message', actionLabel: 'Voir les messages', actionLink: '/messages' },
  payment_received: { icon: 'CreditCard', title: 'Paiement reçu', actionLabel: 'Voir mes paiements', actionLink: '/gerer-paiements' },
  reservation_accepted: { icon: 'CalendarCheck', title: 'Réservation acceptée', actionLabel: 'Voir la réservation', actionLink: '/mes-reservations' },
  reservation_cancelled: { icon: 'CalendarX', title: 'Réservation annulée', actionLabel: 'Voir mes réservations', actionLink: '/mes-reservations' },
  new_reservation: { icon: 'Calendar', title: 'Nouvelle réservation', actionLabel: 'Voir mes réservations', actionLink: '/mes-reservations' },
  document_uploaded: { icon: 'FileText', title: 'Document téléversé', actionLabel: 'Voir mes documents', actionLink: '/profil-documents-utilisateur' },
  annonce_approved: { icon: 'CheckCircle', title: 'Annonce validée', actionLabel: 'Voir mes annonces', actionLink: '/mes-annonces' },
  annonce_rejected: { icon: 'XCircle', title: 'Annonce refusée', actionLabel: 'Voir mes annonces', actionLink: '/mes-annonces' }
};

const formatPayloadMessage = (payload) => {
  if (!payload) return '';
  if (typeof payload?.message === 'string') return payload?.message;

  const candidates = [
    payload?.annonce_title,
    payload?.annonceTitle,
    payload?.title,
    payload?.owner_name,
    payload?.renter_name
  ]?.filter(Boolean);

  if (candidates?.length > 0) return candidates?.join(' ? ');
  return '';
};

const normalizeNotification = (notification) => {
  const type = String(notification?.type || '')?.toLowerCase();
  const meta = TYPE_META?.[type] || {};
  const payload = notification?.payload || {};

  return {
    ...notification,
    icon: notification?.icon || meta?.icon || 'Bell',
    title: notification?.title || payload?.title || meta?.title || 'Notification',
    message: notification?.message || formatPayloadMessage(payload) || 'Nouvelle notification',
    timestamp: notification?.timestamp || notification?.created_at || notification?.read_at || new Date()?.toISOString(),
    actionLink: notification?.actionLink || payload?.actionLink || payload?.url || meta?.actionLink || '#',
    actionLabel: notification?.actionLabel || payload?.actionLabel || meta?.actionLabel || 'Voir'
  };
};

const NotificationsCenter = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState('toutes');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [preferences, setPreferences] = useState(createDefaultPreferences);

  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setPreferences(createDefaultPreferences());
      setLoading(false);
      return;
    }

    fetchNotifications();
    fetchPreferences();

    const channel = notificationService?.subscribeToNotifications(user?.id, (newNotif) => {
      setNotifications((prev) => [normalizeNotification(newNotif), ...prev]);
      toast?.success('Nouvelle notification reçue');
    });

    return () => {
      notificationService?.unsubscribe(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const { data, error } = await notificationService?.getUserNotifications(user?.id);
      if (error) throw error;

      setNotifications((data || [])?.map(normalizeNotification));
    } catch (error) {
      console.error('Erreur lors du chargement de notifications:', error);
      toast?.error('Erreur lors du chargement des notifications');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreferences = async () => {
    try {
      setPreferencesLoading(true);
      const { data, error } = await notificationService?.getUserPreferences(user?.id);
      if (error) throw error;
      setPreferences(mergePreferencesWithDefaults(data));
    } catch (error) {
      console.warn('Preferences notifications non disponibles (migration peut-etre non appliquee):', error?.message || error);
      setPreferences(createDefaultPreferences());
    } finally {
      setPreferencesLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    if (Number.isNaN(date?.getTime())) return '-';

    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `Il y a ${Math.max(0, diffMins)} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;

    return date?.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const filteredNotifications = useMemo(() => {
    return (notifications || [])?.filter((notification) => {
      const matchesFilter =
        filterTab === 'toutes' ||
        (filterTab === 'non-lues' && !notification?.is_read) ||
        (filterTab === 'lues' && notification?.is_read);

      const haystack = [
        notification?.type,
        notification?.title,
        notification?.message,
        JSON.stringify(notification?.payload || {})
      ]?.join(' ')?.toLowerCase();

      const matchesSearch =
        searchTerm === '' ||
        haystack?.includes(String(searchTerm || '')?.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }, [filterTab, notifications, searchTerm]);

  const unreadCount = (notifications || [])?.filter((n) => !n?.is_read)?.length;

  const handleMarkAsRead = async (id) => {
    try {
      const { error } = await notificationService?.markAsRead(id);
      if (error) throw error;
      setNotifications((prev) => prev?.map((n) => n?.id === id ? { ...n, is_read: true } : n));
    } catch (error) {
      console.error('Mark as read error:', error);
      toast?.error('Erreur lors du marquage');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const { error } = await notificationService?.markAllAsRead(user?.id);
      if (error) throw error;

      setNotifications((prev) => prev?.map((n) => ({ ...n, is_read: true })));
      toast?.success('Toutes les notifications ont ete marquees comme lues');
    } catch (error) {
      console.error('Mark all as read error:', error);
      toast?.error('Erreur lors du marquage');
    }
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await notificationService?.deleteNotification(id);
      if (error) throw error;

      setNotifications((prev) => prev?.filter((n) => n?.id !== id));
      toast?.success('Notification supprimee');
    } catch (error) {
      console.error('Delete notification error:', error);
      toast?.error('Erreur lors de la suppression');
    }
  };

  const handlePreferenceChange = (category, channel) => {
    setPreferences((prev) => ({
      ...prev,
      [category]: {
        ...prev?.[category],
        [channel]: !prev?.[category]?.[channel]
      }
    }));
  };

  const handleSavePreferences = async () => {
    if (!user?.id) {
      toast?.error('Veuillez vous connecter pour enregistrer vos preferences.');
      return;
    }

    try {
      setSavingPreferences(true);
      const { error } = await notificationService?.saveUserPreferences(user?.id, preferences);
      if (error) throw error;

      toast?.success('Preferences de notifications enregistrees');
      setShowPreferences(false);
    } catch (error) {
      console.error('Save notification preferences error:', error);
      toast?.error(error?.message || "Impossible d'enregistrer les preferences");
    } finally {
      setSavingPreferences(false);
    }
  };

  const preferenceCategories = [
    { key: 'bookingRequests', label: 'Demandes de reservation', icon: 'Calendar' },
    { key: 'messages', label: 'Messages', icon: 'MessageSquare' },
    { key: 'payments', label: 'Paiements', icon: 'CreditCard' },
    { key: 'reminders', label: 'Rappels', icon: 'Clock' },
    { key: 'documents', label: 'Documents', icon: 'FileText' },
    { key: 'marketing', label: 'Offres et actualites', icon: 'Mail' }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <main className="flex-1 pt-20 pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-elevation-1 p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">Centre de notifications</h1>
                <p className="text-muted-foreground mt-1">
                  {unreadCount > 0
                    ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}`
                    : 'Toutes les notifications sont lues'}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowPreferences((prev) => !prev)}>
                <Icon name="Settings" size={16} />
                Preferences
              </Button>
            </div>
          </div>

          {showPreferences && (
            <div className="bg-white rounded-lg shadow-elevation-2 p-6 mb-6">
              <h2 className="text-xl font-bold text-foreground mb-4">Preferences de notification</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Choisissez comment vous souhaitez recevoir vos notifications.
              </p>

              {preferencesLoading && (
                <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon name="Loader2" size={16} className="animate-spin" />
                  <span>Chargement des preferences...</span>
                </div>
              )}

              <div className="space-y-4">
                {preferenceCategories?.map((category) => (
                  <div key={category?.key} className="border border-border rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Icon name={category?.icon} size={20} className="text-[#17a2b8]" />
                      <h3 className="font-semibold text-foreground">{category?.label}</h3>
                    </div>
                    <div className="flex gap-6 ml-8 flex-wrap">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences?.[category?.key]?.email}
                          onChange={() => handlePreferenceChange(category?.key, 'email')}
                          className="w-4 h-4 rounded border-border text-[#17a2b8] focus:ring-[#17a2b8]"
                        />
                        <span className="text-sm text-foreground">E-mail</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences?.[category?.key]?.push}
                          onChange={() => handlePreferenceChange(category?.key, 'push')}
                          className="w-4 h-4 rounded border-border text-[#17a2b8] focus:ring-[#17a2b8]"
                        />
                        <span className="text-sm text-foreground">Push</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences?.[category?.key]?.sms}
                          onChange={() => handlePreferenceChange(category?.key, 'sms')}
                          className="w-4 h-4 rounded border-border text-[#17a2b8] focus:ring-[#17a2b8]"
                        />
                        <span className="text-sm text-foreground">SMS</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowPreferences(false)}>
                  Fermer
                </Button>
                <Button onClick={handleSavePreferences} loading={savingPreferences} disabled={preferencesLoading}>
                  Enregistrer les preferences
                </Button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-elevation-1 p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterTab('toutes')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterTab === 'toutes' ? 'bg-[#17a2b8] text-white' : 'bg-surface text-muted-foreground hover:bg-[#17a2b8]/10'
                  }`}
                >
                  Toutes
                </button>
                <button
                  onClick={() => setFilterTab('non-lues')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterTab === 'non-lues' ? 'bg-[#17a2b8] text-white' : 'bg-surface text-muted-foreground hover:bg-[#17a2b8]/10'
                  }`}
                >
                  Non lues ({unreadCount})
                </button>
                <button
                  onClick={() => setFilterTab('lues')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterTab === 'lues' ? 'bg-[#17a2b8] text-white' : 'bg-surface text-muted-foreground hover:bg-[#17a2b8]/10'
                  }`}
                >
                  Lues
                </button>
              </div>

              <div className="flex-1 w-full md:w-auto">
                <div className="relative">
                  <Icon name="Search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Rechercher une notification..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e?.target?.value || '')}
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#17a2b8]"
                  />
                </div>
              </div>

              {unreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
                  Tout marquer comme lu
                </Button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-elevation-2 divide-y divide-border">
            {loading ? (
              <div className="p-12 text-center">
                <Icon name="Loader2" size={32} className="text-muted-foreground mx-auto mb-4 animate-spin" />
                <p className="text-muted-foreground">Chargement des notifications...</p>
              </div>
            ) : filteredNotifications?.length === 0 ? (
              <div className="p-12 text-center">
                <Icon name="Bell" size={48} className="text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucune notification trouvee</p>
              </div>
            ) : (
              filteredNotifications?.map((notification) => (
                <div
                  key={notification?.id}
                  className={`p-4 hover:bg-surface transition-colors ${!notification?.is_read ? 'bg-[#17a2b8]/5' : ''}`}
                >
                  <div className="flex gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      !notification?.is_read ? 'bg-[#17a2b8]' : 'bg-surface'
                    }`}>
                      <Icon
                        name={notification?.icon}
                        size={20}
                        className={!notification?.is_read ? 'text-white' : 'text-muted-foreground'}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-1">
                        <h3 className={`text-sm font-semibold ${!notification?.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {notification?.title}
                        </h3>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatTimestamp(notification?.timestamp)}
                        </span>
                      </div>

                      <p className="text-sm text-muted-foreground mb-3">{notification?.message}</p>

                      <div className="flex items-center gap-3 flex-wrap">
                        {notification?.actionLink && notification?.actionLink !== '#' && (
                          <a
                            href={notification?.actionLink}
                            className="text-sm text-[#17a2b8] hover:text-[#138496] font-medium"
                          >
                            {notification?.actionLabel}
                          </a>
                        )}
                        {!notification?.is_read && (
                          <button
                            onClick={() => handleMarkAsRead(notification?.id)}
                            className="text-sm text-muted-foreground hover:text-foreground"
                          >
                            Marquer comme lu
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(notification?.id)}
                          className="text-sm text-muted-foreground hover:text-foreground"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default NotificationsCenter;

