import React, { useState, useEffect } from 'react';
import Icon from '../AppIcon';

const NotificationIndicator = ({ count = 0, onClick }) => {
  const [displayCount, setDisplayCount] = useState(count);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (count !== displayCount) {
      setIsAnimating(true);
      setDisplayCount(count);
      
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 250);

      return () => clearTimeout(timer);
    }
  }, [count, displayCount]);

  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      className="relative flex items-center justify-center w-12 h-12 rounded-lg transition-smooth hover:bg-muted"
      onClick={handleClick}
      aria-label={`Notifications (${displayCount} unread)`}
    >
      <Icon name="Bell" size={24} />
      {displayCount > 0 && (
        <span 
          className={`notification-badge ${isAnimating ? 'transition-spring' : 'transition-smooth'}`}
        >
          {displayCount > 99 ? '99+' : displayCount}
        </span>
      )}
    </button>
  );
};

export default NotificationIndicator;