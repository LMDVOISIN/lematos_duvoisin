import React from 'react';
import Icon from '../../../components/AppIcon';

const OwnerProfile = ({ owner }) => {
  if (!owner) return null;

  const ownerReviewCount = Math.max(0, Number(owner?.reviewCount || 0));
  const hasOwnerRating = ownerReviewCount > 0 && Number.isFinite(Number(owner?.rating));

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Propriétaire</h3>

      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-[#17a2b8] flex items-center justify-center text-white font-semibold text-xl flex-shrink-0">
          {owner?.avatar ? (
            <img src={owner?.avatar} alt={owner?.pseudonym} className="w-full h-full rounded-full object-cover" />
          ) : (
            owner?.initials
          )}
        </div>

        <div className="flex-1">
          <h4 className="font-semibold text-foreground text-lg">{owner?.pseudonym}</h4>
          {hasOwnerRating ? (
            <div className="flex items-center gap-1 text-sm">
              <Icon name="Star" size={14} className="text-[#F59E0B] fill-[#F59E0B]" />
              <span className="font-medium text-foreground">{owner?.rating}</span>
              <span className="text-muted-foreground">({ownerReviewCount} avis)</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun avis pour le moment</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Icon name="Clock" size={16} />
            <span>Temps de réponse</span>
          </div>
          <p className="font-semibold text-foreground">{owner?.responseTime}</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Icon name="Calendar" size={16} />
            <span>Membre depuis</span>
          </div>
          <p className="font-semibold text-foreground">{owner?.memberSince}</p>
        </div>
      </div>
    </div>
  );
};

export default OwnerProfile;

