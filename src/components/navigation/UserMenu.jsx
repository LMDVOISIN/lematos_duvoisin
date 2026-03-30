import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { ACCOUNT_MENU_ITEMS } from '../../pages/user-profile-documents/accountNavigation';

const UserMenu = ({ isMobile = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, isTester } = useAuth();
  const menuRef = useRef(null);

  const closeMenu = () => {
    setIsOpen(false);
  };

  useEffect(() => {
    if (isMobile || !isOpen) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (menuRef?.current && !menuRef?.current?.contains(event?.target)) {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobile, isOpen]);

  const menuItems = isTester
    ? [
        ...ACCOUNT_MENU_ITEMS.slice(0, 5),
        { id: 'testing', label: 'Mes essais', icon: 'FlaskConical', path: '/participant-configuration-contexte-authentification' },
        ...ACCOUNT_MENU_ITEMS.slice(5)
      ]
    : ACCOUNT_MENU_ITEMS;

  const menuContent = (
    <>
      <div className="user-menu-header">
        <div className="user-menu-name">{user?.pseudonym}</div>
        <div className="user-menu-email">{user?.email}</div>
      </div>
      <div className="user-menu-items">
        {menuItems?.map((item) => (
          <Link
            key={item?.id}
            to={item?.path}
            className="user-menu-item"
            onClick={closeMenu}
          >
            <Icon name={item?.icon} size={20} />
            <span>{item?.label}</span>
          </Link>
        ))}
      </div>
    </>
  );

  if (isMobile) {
    return <div className="flex flex-col gap-2">{menuContent}</div>;
  }

  return (
    <div ref={menuRef} className="user-menu-container">
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setIsOpen((current) => !current)}
        aria-label="Menu du profil"
        aria-expanded={isOpen}
      >
        <div className="user-menu-avatar">{user?.avatar}</div>
        <Icon name={isOpen ? 'ChevronUp' : 'ChevronDown'} size={18} className="text-foreground" />
      </button>
      <div className={`user-menu-dropdown ${isOpen ? 'open' : 'closed'}`}>
        {menuContent}
      </div>
    </div>
  );
};

export default UserMenu;
