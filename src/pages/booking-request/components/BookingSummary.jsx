import React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Icon from '../../../components/AppIcon';
import { formatTimeRange } from '../../../utils/timeSlots';

const BookingSummary = ({
  equipment,
  startDate,
  endDate,
  rentalDays,
  insuranceSelected = false,
  insuranceAmount = 0,
  totalAmount
}) => {
  const normalizedRentalDays = Math.max(0, Number(rentalDays || 0));
  const rentalSubtotal = Math.max(0, Number(equipment?.dailyPrice || 0) * normalizedRentalDays);
  const normalizedInsuranceAmount = insuranceSelected
    ? Math.max(0, Number(insuranceAmount || 0))
    : 0;
  const normalizedTotalAmount = Number(totalAmount ?? (rentalSubtotal + normalizedInsuranceAmount) ?? 0) || 0;
  const pickupWindow = formatTimeRange(equipment?.pickupTimeStart, equipment?.pickupTimeEnd);
  const returnWindow = formatTimeRange(equipment?.returnTimeStart, equipment?.returnTimeEnd);

  return (
    <div className="bg-white rounded-lg shadow-elevation-3 p-6 space-y-6">
      <div>
        <h3 className="text-h5 font-heading text-foreground mb-4">
          Recapitulatif
        </h3>
        <div className="flex gap-4">
          <img
            src={equipment?.images?.[0]?.url || '/assets/images/no_image.png'}
            alt={equipment?.images?.[0]?.alt || 'Photo annonce'}
            className="w-20 h-20 object-cover rounded-md"
          />
          <div className="flex-1">
            <h4 className="font-medium text-foreground line-clamp-2">
              {equipment?.title}
            </h4>
            <p className="text-sm text-muted-foreground mt-1">
              {equipment?.category}
            </p>
            <p className="text-sm font-semibold text-primary mt-1">
              {Number(equipment?.dailyPrice || 0).toFixed(2)} EUR / jour
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-border" />

      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-3">
          Propriétaire
        </h4>
        <div className="flex items-center gap-3">
          <img
            src={equipment?.owner?.avatar || '/assets/images/no_image.png'}
            alt={equipment?.owner?.avatarAlt || 'Avatar propriétaire'}
            className="w-10 h-10 rounded-full object-cover"
          />
          <div>
            <p className="font-medium text-foreground">
              {equipment?.owner?.pseudonym}
            </p>
            {Number.isFinite(equipment?.owner?.rating) && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Icon name="Star" size={14} className="text-warning fill-warning" />
                <span>{equipment?.owner?.rating}</span>
                <span>({equipment?.owner?.reviewCount || 0})</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border" />

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">
          Details de la reservation
        </h4>

        {startDate && endDate ? (
          <>
            <div className="flex items-start gap-2">
              <Icon name="Calendar" size={18} className="text-primary mt-0.5" />
              <div className="text-sm">
                <p className="text-foreground">
                  Du {format(startDate, 'dd MMMM yyyy', { locale: fr })}
                </p>
                <p className="text-foreground">
                  Au {format(endDate, 'dd MMMM yyyy', { locale: fr })}
                </p>
                <p className="text-muted-foreground mt-1">
                  {normalizedRentalDays} jour{normalizedRentalDays > 1 ? 's' : ''}
                </p>
                {pickupWindow && (
                  <p className="text-muted-foreground mt-1">
                    Prise: {pickupWindow}
                  </p>
                )}
                {returnWindow && (
                  <p className="text-muted-foreground">
                    Restitution: {returnWindow}
                  </p>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-border space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium text-foreground">{rentalSubtotal.toFixed(2)} EUR</span>
              </div>
              {insuranceSelected && normalizedInsuranceAmount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Assurance optionnelle</span>
                  <span className="font-medium text-foreground">{normalizedInsuranceAmount.toFixed(2)} EUR</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2">
                <span className="font-semibold text-foreground">
                  Total
                </span>
                <span className="text-xl font-bold text-primary">
                  {normalizedTotalAmount.toFixed(2)} EUR
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground py-4 text-center">
            <Icon name="Calendar" size={24} className="mx-auto mb-2 opacity-50" />
            <p>Selectionnez vos dates pour voir le prix total</p>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-border space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon name="ShieldCheck" size={16} className="text-success" />
          <span>Paiement sécurisé</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon name="Lock" size={16} className="text-success" />
          <span>Donnees protegees</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon name="Shield" size={16} className="text-success" />
          <span>Remboursement minimum garanti en cas de vol ou de deterioration</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon name="Clock" size={16} className="text-primary" />
          <span>Confirmation immediate du creneau</span>
        </div>
      </div>
    </div>
  );
};

export default BookingSummary;
