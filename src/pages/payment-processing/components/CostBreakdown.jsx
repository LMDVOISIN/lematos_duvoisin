import React from 'react';
import Icon from '../../../components/AppIcon';

const CostBreakdown = ({ bookingDetails }) => {
  const formatPrice = (price) => {
    return price?.toFixed(2);
  };

  const rentalDays = Number(bookingDetails?.rentalDays || 0) || 0;
  const locationPrice = Number(bookingDetails?.equipmentTotal ?? 0) || 0;
  const insuranceSelected = Boolean(bookingDetails?.insuranceSelected);
  const insuranceAmount = insuranceSelected
    ? (Number(bookingDetails?.insuranceAmount ?? 0) || 0)
    : 0;
  const totalToPay = Number(bookingDetails?.totalAmount ?? (locationPrice + insuranceAmount) ?? 0) || 0;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center py-2">
        <div className="flex items-center gap-2">
          <Icon name="Package" size={18} className="text-muted-foreground" />
          <span className="text-sm text-foreground">
            Prix de location ({rentalDays} jour{rentalDays > 1 ? 's' : ''})
          </span>
        </div>
        <span className="font-medium text-foreground">
          {formatPrice(locationPrice)} EUR
        </span>
      </div>

      {insuranceSelected && insuranceAmount > 0 && (
        <div className="flex justify-between items-center py-2">
          <div className="flex items-center gap-2">
            <Icon name="ShieldCheck" size={18} className="text-muted-foreground" />
            <span className="text-sm text-foreground">Assurance optionnelle</span>
          </div>
          <span className="font-medium text-foreground">
            {formatPrice(insuranceAmount)} EUR
          </span>
        </div>
      )}

      <div className="border-t border-border my-3" />
      <div className="flex justify-between items-center py-2">
        <span className="text-lg font-semibold text-foreground">
          Total a payer
        </span>
        <span className="text-xl font-bold text-primary">
          {formatPrice(totalToPay)} EUR
        </span>
      </div>
    </div>
  );
};

export default CostBreakdown;
