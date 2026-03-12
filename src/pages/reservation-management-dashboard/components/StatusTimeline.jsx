import React from 'react';
import Icon from '../../../components/AppIcon';

const StatusTimeline = ({ timeline }) => {
  const getEventColor = (type) => {
    const colors = {
      info: 'text-[#17a2b8] bg-[#17a2b8]/10',
      pending: 'text-warning bg-warning/10',
      success: 'text-success bg-success/10',
      error: 'text-error bg-error/10'
    };
    return colors?.[type] || colors?.info;
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date?.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-surface rounded-lg p-4">
      <h4 className="text-sm font-semibold text-foreground mb-4">Historique de la réservation</h4>
      <div className="space-y-4">
        {timeline?.map((item, index) => (
          <div key={index} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getEventColor(item?.type)}`}>
                <Icon name={item?.icon || 'Circle'} size={16} />
              </div>
              {index < timeline?.length - 1 && (
                <div className="w-0.5 h-full bg-border mt-2" />
              )}
            </div>
            <div className="flex-1 pb-4">
              <p className="text-sm font-medium text-foreground">{item?.event}</p>
              <p className="text-xs text-muted-foreground mt-1">{formatDateTime(item?.date)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatusTimeline;