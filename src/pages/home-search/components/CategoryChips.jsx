import React from 'react';
import Icon from '../../../components/AppIcon';

const CategoryChips = ({ selectedCategory, onCategoryChange }) => {
  const categories = [
    { id: '', label: 'Tout', icon: 'Grid3x3' },
    { id: 'bricolage', label: 'Bricolage', icon: 'Hammer' },
    { id: 'sport', label: 'Sport', icon: 'Bike' },
    { id: 'camping', label: 'Camping', icon: 'Tent' },
    { id: 'photo', label: 'Photo', icon: 'Camera' },
    { id: 'musique', label: 'Musique', icon: 'Music' },
    { id: 'transport', label: 'Transport', icon: 'Car' },
    { id: 'electromenager', label: 'Électroménager', icon: 'Microwave' },
    { id: 'fete', label: 'Fête', icon: 'PartyPopper' }
  ];

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex gap-2 md:gap-3 min-w-max lg:justify-center">
        {categories?.map((category) => (
          <button
            key={category?.id}
            onClick={() => onCategoryChange(category?.id)}
            className={`flex items-center gap-2 px-4 md:px-5 lg:px-6 py-2 md:py-2.5 lg:py-3 rounded-full transition-smooth flex-shrink-0 ${
              selectedCategory === category?.id
                ? 'bg-primary text-primary-foreground shadow-elevation-2'
                : 'bg-surface text-foreground hover:bg-muted'
            }`}
          >
            <Icon name={category?.icon} size={18} />
            <span className="text-sm md:text-base font-medium whitespace-nowrap">
              {category?.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryChips;