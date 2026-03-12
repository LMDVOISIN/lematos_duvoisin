import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import notificationService from '../../services/notificationService';

const UserMenu = ({ isMobile = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const { user, signOut } = useAuth();
  const menuRef = useRef(null);
  const navigate = useNavigate();

  const menuItems = [
    {
      label: 'Mon Profil',
      path: '/profil-documents-utilisateur',
      icon: 'User'
    },
    {
      label: 'Mes Réservations',
      path: '/mes-reservations',
      icon: 'Calendar'
    },
    {
      label: 'Gérer mes paiements',
      path: '/legal/connexion-stripe',
      icon: 'CreditCard'
    },
    {
      label: 'Notifications',
      path: '/centre-notifications',
      icon: 'Bell',
      badge: unreadNotificationCount > 0 ? unreadNotificationCount : null
    }
  ];

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  const handleLogout = async () => {
    closeMenu();

    try {
      const { error } = await signOut();
      if (error) {
        console.error('Erreur de déconnexion :', error);
        return;
      }
      navigate('/authentification', { replace: true });
    } catch (error) {
      console.error('Erreur inattendue de déconnexion :', error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef?.current && !menuRef?.current?.contains(event?.target)) {
        closeMenu();
      }
    };

    if (isOpen && !isMobile) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, isMobile]);

  useEffect(() => {
    let isMounted = true;
    let channel = null;

    const loadUnreadCount = async () => {
      if (!user?.id) {
        if (isMounted) setUnreadNotificationCount(0);
        return;
      }

      try {
        const { count, error } = await notificationService?.getUnreadCount(user?.id);
        if (error) throw error;

        if (isMounted) {
          setUnreadNotificationCount(count || 0);
        }
      } catch (error) {
        if (isMounted) {
          setUnreadNotificationCount(0);
        }
      }
    };

    loadUnreadCount();

    if (user?.id) {
      channel = notificationService?.subscribeToNotifications(user?.id, (newNotif) => {
        if (!isMounted || !newNotif) return;
        if (!newNotif?.is_read) {
          setUnreadNotificationCount((prev) => prev + 1);
        }
      });
    }

    return () => {
      isMounted = false;
      notificationService?.unsubscribe(channel);
    };
  }, [user?.id]);

  if (isMobile) {
    return (
      <div className="flex flex-col gap-2">
        <div className="user-menu-header">
          <div className="user-menu-name">{user?.pseudonym}</div>
          <div className="user-menu-email">{user?.email}</div>
        </div>
        <div className="user-menu-items">
          {menuItems?.map((item) => (
            <Link
              key={item?.path}
              to={item?.path}
              className="user-menu-item"
            >
              <Icon name={item?.icon} size={20} />
              <span>{item?.label}</span>
              {item?.badge && (
                <span className="ml-auto notification-badge relative top-0 right-0">
                  {item?.badge}
                </span>
              )}
            </Link>
          ))}
          <Link to="/tableau-bord-utilisateur" className="block px-4 py-2 text-sm text-foreground hover:bg-surface transition-colors">
            Tableau de bord
          </Link>
          <div className="user-menu-divider" />
          <button
            onClick={handleLogout}
            className="user-menu-item w-full text-left"
          >
            <Icon name="LogOut" size={20} />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={menuRef} className="user-menu-container">
      <button
        className="user-menu-trigger"
        onClick={toggleMenu}
        aria-label="Menu utilisateur"
        aria-expanded={isOpen}
      >
        <div className="user-menu-avatar">{user?.avatar}</div>
        <Icon name={isOpen ? 'ChevronUp' : 'ChevronDown'} size={20} className="hidden sm:block" />
      </button>
      <div className={`user-menu-dropdown ${isOpen ? 'open' : 'closed'}`}>
        <div className="user-menu-header">
          <div className="user-menu-name">{user?.pseudonym}</div>
          <div className="user-menu-email">{user?.email}</div>
        </div>

        <div className="user-menu-items">
          {menuItems?.map((item) => (
            <Link
              key={item?.path}
              to={item?.path}
              className="user-menu-item"
              onClick={closeMenu}
            >
              <Icon name={item?.icon} size={20} />
              <span>{item?.label}</span>
              {item?.badge && (
                <span className="ml-auto notification-badge relative top-0 right-0">
                  {item?.badge}
                </span>
              )}
            </Link>
          ))}

          <Link to="/tableau-bord-utilisateur" className="block px-4 py-2 text-sm text-foreground hover:bg-surface transition-colors">
            Tableau de bord
          </Link>

          <div className="user-menu-divider" />

          <button
            onClick={handleLogout}
            className="user-menu-item w-full text-left"
          >
            <Icon name="LogOut" size={20} />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserMenu;


