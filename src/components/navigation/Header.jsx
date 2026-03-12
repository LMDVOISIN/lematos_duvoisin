import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from '../AppIcon';
import UserMenu from './UserMenu';
import ListingPromotionPopup from './ListingPromotionPopup';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import notificationService from '../../services/notificationService';
import reservationService from '../../services/reservationService';

const ONGOING_MESSAGING_STATUSES = new Set(['accepted', 'paid', 'active', 'ongoing']);

const normalizeDateOnly = (value) => {
  const parsedDate = value ? new Date(value) : null;
  if (!parsedDate || Number.isNaN(parsedDate?.getTime())) return null;
  parsedDate?.setHours(0, 0, 0, 0);
  return parsedDate;
};

const isReservationOngoingNow = (reservation) => {
  const status = String(reservation?.status || '')?.toLowerCase();
  if (!ONGOING_MESSAGING_STATUSES?.has(status)) return false;

  const today = normalizeDateOnly(new Date());
  const startDate = normalizeDateOnly(reservation?.start_date);
  const endDate = normalizeDateOnly(reservation?.end_date);
  if (!today || !startDate || !endDate) return false;

  return startDate <= today && endDate >= today;
};

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsPreview, setNotificationsPreview] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messageBadgeCount, setMessageBadgeCount] = useState(0);
  const [hasMessagingAccess, setHasMessagingAccess] = useState(false);
  const location = useLocation();
  const mobileMenuRef = useRef(null);
  const { user, userProfile, loading } = useAuth();
  const isAuthenticated = !loading && !!user;

  const publicNavigationItems = [
    {
      label: 'Accueil',
      path: '/accueil-recherche',
      icon: 'Home'
    },
    {
      label: 'Créer une annonce',
      path: '/creer-annonce',
      icon: 'Plus'
    },
    {
      label: 'Créer une demande',
      path: '/creer-demande',
      icon: 'FileSearch'
    }
  ];

  const privateNavigationItems = [
    {
      label: 'Mes Annonces',
      path: '/mes-annonces',
      icon: 'Package'
    },
    {
      label: 'Mes Réservations',
      path: '/mes-reservations',
      icon: 'Calendar'
    }
  ];

  if (hasMessagingAccess) {
    privateNavigationItems?.push({
      label: 'Messages',
      path: '/messages',
      icon: 'MessageSquare',
      badge: messageBadgeCount > 0 ? messageBadgeCount : null
    });
  }

  const navigationItems = isAuthenticated
    ? [...publicNavigationItems, ...privateNavigationItems]
    : publicNavigationItems;

  if (isAuthenticated && userProfile?.is_admin === true) {
    navigationItems?.push({
      label: 'Administration',
      path: '/administration-tableau-bord',
      icon: 'Shield'
    });
  }

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    if (Number.isNaN(date?.getTime())) return '';

    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 60) {
      return `Il y a ${Math.max(diffMins, 0)} min`;
    }

    if (diffHours < 24) {
      return `Il y a ${Math.max(diffHours, 0)}h`;
    }

    return date?.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short'
    });
  };

  const isActivePath = (path) => {
    return location?.pathname === path;
  };

  const getNotificationIcon = (type) => {
    const iconByType = {
      new_message: 'MessageSquare',
      new_reservation: 'Calendar',
      reservation_accepted: 'CheckCircle',
      reservation_cancelled: 'XCircle',
      payment_received: 'CreditCard',
      document_uploaded: 'FileText',
      review_received: 'Star',
      annonce_approved: 'CheckCircle',
      annonce_rejected: 'XCircle'
    };

    return iconByType?.[type] || 'Bell';
  };

  const getNotificationTitle = (notification) => {
    const payload = notification?.payload && typeof notification?.payload === 'object' ? notification?.payload : {};

    if (typeof payload?.title === 'string' && payload?.title?.trim()) {
      return payload?.title;
    }

    const labels = {
      new_message: 'Nouveau message',
      new_reservation: 'Nouvelle réservation',
      reservation_accepted: 'Réservation acceptée',
      reservation_cancelled: 'Réservation annulée',
      payment_received: 'Paiement reçu',
      document_uploaded: 'Document',
      review_received: 'Nouvel avis',
      annonce_approved: 'Annonce validée',
      annonce_rejected: 'Annonce refusée'
    };

    return labels?.[notification?.type] || 'Notification';
  };

  const getNotificationMessage = (notification) => {
    const payload = notification?.payload;

    if (typeof payload === 'string' && payload?.trim()) {
      return payload;
    }

    if (!payload || typeof payload !== 'object') {
      return 'Voir le centre de notifications';
    }

    const candidates = [
      payload?.message,
      payload?.description,
      payload?.content,
      payload?.message_preview
    ]?.filter((value) => typeof value === 'string' && value?.trim());

    if (candidates?.length > 0) {
      return candidates?.[0];
    }

    if (payload?.annonce_title) {
      return `Annonce: ${payload?.annonce_title}`;
    }

    if (payload?.reservation_id || payload?.reservationId) {
      return `Réservation ${payload?.reservation_id || payload?.reservationId}`;
    }

    return 'Voir le centre de notifications';
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (mobileMenuRef?.current && !mobileMenuRef?.current?.contains(event?.target)) {
        closeMobileMenu();
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    closeMobileMenu();
  }, [location?.pathname]);

  useEffect(() => {
    if (!isAuthenticated && showNotifications) {
      setShowNotifications(false);
    }
  }, [isAuthenticated, showNotifications]);

  useEffect(() => {
    let isMounted = true;

    const loadMessagingAccess = async () => {
      if (!isAuthenticated || !user?.id) {
        if (isMounted) setHasMessagingAccess(false);
        return;
      }

      try {
        const [renterReservations, ownerReservations] = await Promise.all([
          reservationService?.getUserReservations(user?.id),
          reservationService?.getOwnerReservations(user?.id)
        ]);

        const allReservations = [
          ...(renterReservations?.data || []),
          ...(ownerReservations?.data || [])
        ];

        const canAccessMessaging = allReservations?.some((reservation) => isReservationOngoingNow(reservation));

        if (isMounted) {
          setHasMessagingAccess(Boolean(canAccessMessaging));
        }
      } catch (_error) {
        if (isMounted) {
          setHasMessagingAccess(false);
        }
      }
    };

    loadMessagingAccess();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    let isMounted = true;

    const loadUnreadMessageCount = async () => {
      if (!isAuthenticated || !user?.id || !hasMessagingAccess) {
        if (isMounted) setMessageBadgeCount(0);
        return;
      }

      try {
        const { count, error } = await supabase
          ?.from('messages')
          ?.select('*', { count: 'exact', head: true })
          ?.eq('receiver_id', user?.id)
          ?.eq('is_read', false);

        if (error) throw error;

        if (isMounted) {
          setMessageBadgeCount(count || 0);
        }
      } catch (_error) {
        if (isMounted) {
          setMessageBadgeCount(0);
        }
      }
    };

    loadUnreadMessageCount();

    return () => {
      isMounted = false;
    };
  }, [hasMessagingAccess, isAuthenticated, user?.id]);

  useEffect(() => {
    let isMounted = true;
    let channel = null;

    const resetNotifications = () => {
      if (!isMounted) return;
      setUnreadCount(0);
      setNotificationsPreview([]);
    };

    const refreshNotifications = async () => {
      if (!isAuthenticated || !user?.id) {
        resetNotifications();
        return;
      }

      try {
        const [unreadResult, previewResult] = await Promise.all([
          notificationService?.getUnreadCount(user?.id),
          notificationService?.getUserNotifications(user?.id, { is_archived: false, limit: 5 })
        ]);

        if (unreadResult?.error) throw unreadResult?.error;
        if (previewResult?.error) throw previewResult?.error;
        if (!isMounted) return;

        setUnreadCount(unreadResult?.count || 0);
        setNotificationsPreview(previewResult?.data || []);
      } catch (_error) {
        resetNotifications();
      }
    };

    const loadNotifications = async () => {
      await refreshNotifications();
      channel = notificationService?.subscribeToNotifications(user?.id, (newNotification) => {
        if (!isMounted || !newNotification) return;

        setNotificationsPreview((prev) =>
          [newNotification, ...(prev || [])?.filter((item) => item?.id !== newNotification?.id)]?.slice(0, 5)
        );

        if (!newNotification?.is_read) {
          setUnreadCount((prev) => prev + 1);
        }
      });
    };

    const handleNotificationsChanged = () => {
      void refreshNotifications();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('ldv:notifications-changed', handleNotificationsChanged);
    }

    loadNotifications();

    return () => {
      isMounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('ldv:notifications-changed', handleNotificationsChanged);
      }
      notificationService?.unsubscribe(channel);
    };
  }, [isAuthenticated, user?.id]);

  return (
    <>
      <header className="header-container">
        <div className="header-content">
          <Link to="/accueil-recherche" className="header-logo">
            <img
              src="/assets/images/android-chrome-192x192-1771179342850.png"
              alt="Logo Le Matos Du Voisin - poignee de main formant un coeur"
              className="header-logo-image"
            />
          </Link>

          <nav className="header-nav">
            {navigationItems?.map((item) => (
              <Link
                key={item?.path}
                to={item?.path}
                className={`header-nav-item ${isActivePath(item?.path) ? 'active' : ''}`}
              >
                <Icon name={item?.icon} size={20} />
                <span>{item?.label}</span>
                {item?.badge && (
                  <span className="notification-badge">{item?.badge}</span>
                )}
              </Link>
            ))}
          </nav>

          <div className="header-actions">
            {isAuthenticated ? (
              <>
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors hover:bg-surface"
                  >
                    <Icon name="Bell" size={24} />
                    {unreadCount > 0 && (
                      <span className="notification-badge">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-elevation-4 border border-border z-50">
                      <div className="p-4 border-b border-border flex items-center justify-between">
                        <h3 className="font-semibold text-foreground">Notifications</h3>
                        <Link
                          to="/centre-notifications"
                          className="text-sm text-primary hover:text-[#0d7b88]"
                          onClick={() => setShowNotifications(false)}
                        >
                          Voir tout
                        </Link>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {notificationsPreview?.length === 0 ? (
                          <div className="p-6 text-center">
                            <Icon name="Bell" size={24} className="mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">Aucune notification</p>
                          </div>
                        ) : (
                          notificationsPreview?.map((notification) => (
                            <div
                              key={notification?.id}
                              className={`p-4 border-b border-border hover:bg-surface transition-colors cursor-pointer ${
                                !notification?.is_read ? 'bg-primary/5' : ''
                              }`}
                            >
                              <div className="flex gap-3">
                                <Icon
                                  name={getNotificationIcon(notification?.type)}
                                  size={20}
                                  className="text-primary flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground">{getNotificationTitle(notification)}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{getNotificationMessage(notification)}</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {formatTimestamp(notification?.created_at || notification?.timestamp)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <UserMenu />
              </>
            ) : (
              <Link
                to="/authentification"
                className="inline-flex items-center justify-center h-10 px-4 rounded-lg bg-gradient-to-r from-[#0f4d7a] to-[#0d7b88] text-white font-medium transition-colors hover:from-[#116192] hover:to-[#0f8f9d]"
              >
                Se connecter
              </Link>
            )}
          </div>
        </div>
      </header>
      <ListingPromotionPopup />
      <button
        className="mobile-menu-button"
        onClick={toggleMobileMenu}
        aria-label="Toggle mobile menu"
      >
        <Icon name={isMobileMenuOpen ? 'X' : 'Menu'} size={24} />
      </button>
      <div
        ref={mobileMenuRef}
        className={`mobile-menu-overlay ${isMobileMenuOpen ? 'open' : 'closed'}`}
      >
        <div className="mobile-menu-content">
          <nav className="mobile-menu-nav">
            {navigationItems?.map((item) => (
              <Link
                key={item?.path}
                to={item?.path}
                className={`mobile-menu-nav-item ${isActivePath(item?.path) ? 'active' : ''}`}
              >
                <Icon name={item?.icon} size={24} />
                <span>{item?.label}</span>
                {item?.badge && (
                  <span className="notification-badge">{item?.badge}</span>
                )}
              </Link>
            ))}
          </nav>

          <div className="mt-auto pt-4 border-t border-border">
            {isAuthenticated ? (
              <UserMenu isMobile={true} />
            ) : (
              <Link
                to="/authentification"
                className="block text-center w-full px-4 py-3 rounded-lg bg-gradient-to-r from-[#0f4d7a] to-[#0d7b88] text-white font-medium transition-colors hover:from-[#116192] hover:to-[#0f8f9d]"
              >
                Se connecter
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Header;

