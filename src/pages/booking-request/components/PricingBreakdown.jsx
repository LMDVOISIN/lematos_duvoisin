import React from 'react';
import Icon from '../../../components/AppIcon';

const PricingBreakdown = ({
  rentalDays,
  equipmentTotal,
  insuranceSelected = false,
  insuranceAmount = 0,
  totalAmount
}) => {
  const formatPrice = (price) => {
    return price?.toFixed(2);
  };

  const rentalAmount = Number(equipmentTotal ?? 0) || 0;
  const normalizedInsuranceAmount = insuranceSelected
    ? (Number(insuranceAmount ?? 0) || 0)
    : 0;
  const allInclusiveTotal = Number(totalAmount ?? (rentalAmount + normalizedInsuranceAmount) ?? 0) || 0;

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
          {formatPrice(rentalAmount)} EUR
        </span>
      </div>

      {insuranceSelected && normalizedInsuranceAmount > 0 && (
        <div className="flex justify-between items-center py-2">
          <div className="flex items-center gap-2">
            <Icon name="ShieldCheck" size={18} className="text-muted-foreground" />
            <span className="text-sm text-foreground">
              Assurance optionnelle
            </span>
          </div>
          <span className="font-medium text-foreground">
            {formatPrice(normalizedInsuranceAmount)} EUR
          </span>
        </div>
      )}

      <div className="border-t border-border my-3" />

      <div className="flex justify-between items-center py-2">
        <span className="text-lg font-semibold text-foreground">
          Total
        </span>
        <span className="text-xl font-bold text-primary">
          {formatPrice(allInclusiveTotal)} EUR
        </span>
      </div>
    </div>
  );
};

export default PricingBreakdown;
