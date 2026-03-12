import React from 'react';
import EquipmentCard from './EquipmentCard';
import Icon from '../../../components/AppIcon';

const EquipmentGrid = ({ equipment, loading, userLocation }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Icon name="Loader" className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!equipment || equipment?.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 md:py-16 lg:py-20 bg-surface rounded-2xl">
        <div className="mb-4">
          <Icon name="SearchX" size={64} color="var(--color-muted-foreground)" />
        </div>
        <h3 className="text-xl md:text-2xl font-semibold text-foreground mb-2">
          Aucun équipement trouvé
        </h3>
        <p className="text-sm md:text-base text-muted-foreground text-center max-w-md">
          Essayez de modifier vos critères de recherche ou explorez d'autres catégories
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {equipment?.map((item) => (
          <EquipmentCard 
            key={item?.id} 
            equipment={item} 
            showDistance={!!userLocation}
          />
        ))}
      </div>
    </div>
  );
};

export default EquipmentGrid;