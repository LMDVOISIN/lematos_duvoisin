import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';

const ActivityHistoryTab = ({ activities }) => {
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const typeOptions = [
    { value: 'all', label: 'Tous les types' },
    { value: 'rental', label: 'Locations' },
    { value: 'booking', label: 'Réservations' },
    { value: 'payment', label: 'Paiements' },
    { value: 'message', label: 'Messages' }
  ];

  const statusOptions = [
    { value: 'all', label: 'Tous les statuts' },
    { value: 'completed', label: 'Terminé' },
    { value: 'active', label: 'En cours' },
    { value: 'pending', label: 'En attente' },
    { value: 'cancelled', label: 'Annulé' }
  ];

  const getActivityIcon = (type) => {
    const icons = {
      rental: 'Package',
      booking: 'Calendar',
      payment: 'CreditCard',
      message: 'MessageSquare',
      review: 'Star'
    };
    return icons?.[type] || 'Activity';
  };

  const getStatusColor = (status) => {
    const colors = {
      completed: 'text-success bg-success/10',
      active: 'text-primary bg-primary/10',
      pending: 'text-warning bg-warning/10',
      cancelled: 'text-error bg-error/10'
    };
    return colors?.[status] || 'text-muted-foreground bg-muted';
  };

  const getStatusLabel = (status) => {
    const labels = {
      completed: 'Terminé',
      active: 'En cours',
      pending: 'En attente',
      cancelled: 'Annulé'
    };
    return labels?.[status] || status;
  };

  const filteredActivities = activities?.filter(activity => {
    const typeMatch = filterType === 'all' || activity?.type === filterType;
    const statusMatch = filterStatus === 'all' || activity?.status === filterStatus;
    return typeMatch && statusMatch;
  });

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl p-4 md:p-6 shadow-elevation-2">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <Select
            label="Type d'activité"
            options={typeOptions}
            value={filterType}
            onChange={setFilterType}
            className="flex-1"
          />
          <Select
            label="Statut"
            options={statusOptions}
            value={filterStatus}
            onChange={setFilterStatus}
            className="flex-1"
          />
        </div>

        <div className="space-y-4">
          {filteredActivities?.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon name="Activity" size={32} color="var(--color-muted-foreground)" />
              </div>
              <p className="text-lg font-medium text-foreground mb-2">Aucune activité trouvée</p>
              <p className="text-sm text-muted-foreground">Essayez de modifier vos filtres</p>
            </div>
          ) : (
            filteredActivities?.map((activity) => (
              <div
                key={activity?.id}
                className="flex flex-col md:flex-row gap-4 p-4 bg-surface rounded-lg hover:shadow-elevation-2 transition-smooth"
              >
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon name={getActivityIcon(activity?.type)} size={24} color="var(--color-primary)" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-base md:text-lg font-semibold text-foreground line-clamp-2">
                        {activity?.title}
                      </h4>
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${getStatusColor(activity?.status)}`}>
                        {getStatusLabel(activity?.status)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {activity?.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Icon name="Calendar" size={16} />
                        <span>{new Date(activity.date)?.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                      </div>
                      {activity?.amount && (
                        <div className="flex items-center gap-1 font-semibold text-foreground">
                          <Icon name="Euro" size={16} />
                          <span>{activity?.amount?.toFixed(2)} €</span>
                        </div>
                      )}
                      {activity?.user && (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-muted">
                            <Image
                              src={activity?.user?.avatar}
                              alt={activity?.user?.avatarAlt}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <span>{activity?.user?.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {activity?.actionLabel && (
                  <div className="flex items-center md:items-start">
                    <Button
                      variant="outline"
                      size="sm"
                      iconName={activity?.actionIcon || 'ArrowRight'}
                      iconPosition="right"
                    >
                      {activity?.actionLabel}
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {filteredActivities?.length > 0 && (
          <div className="flex justify-center mt-6">
            <Button variant="outline" iconName="ChevronDown" iconPosition="right">
              Charger plus d'activités
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityHistoryTab;