import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Image from '../../../components/AppImage';

const ListingDetailModal = ({ listing, onClose, onValidate, onRefuse }) => {
  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-elevation-4 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal En-tête */}
        <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Détails de l'annonce</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface rounded-md transition-colors"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6">
          {/* Image */}
          <div className="w-full h-64 rounded-lg overflow-hidden">
            <Image
              src={listing?.image}
              alt={listing?.imageAlt}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Title and Price */}
          <div>
            <h3 className="text-2xl font-bold text-foreground mb-2">{listing?.title}</h3>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-[#17a2b8]">{listing?.dailyPrice?.toFixed(2)} €</span>
              <span className="text-muted-foreground">/ jour</span>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Propriétaire</p>
              <p className="font-medium text-foreground">{listing?.ownerPseudo}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Catégorie</p>
              <p className="font-medium text-foreground">{listing?.category}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Date de soumission</p>
              <p className="font-medium text-foreground">
                {new Date(listing?.submissionDate)?.toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Statut</p>
              <p className="font-medium text-foreground capitalize">{listing?.status}</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Description</p>
            <p className="text-foreground">{listing?.description}</p>
          </div>

          {/* Refusal Reason (if applicable) */}
          {listing?.refusalReason && (
            <div className="bg-error/10 border border-error/20 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Icon name="AlertCircle" size={18} className="text-error mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-error mb-1">Raison du refus</p>
                  <p className="text-sm text-foreground">{listing?.refusalReason}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="sticky bottom-0 bg-surface border-t border-border px-6 py-4 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          {listing?.status === 'pending' && (
            <>
                <Button
                variant="danger"
                iconName="XCircle"
                onClick={() => {
                  onRefuse(listing);
                  onClose();
                }}
              >
                Refuser
              </Button>
              <Button
                variant="success"
                iconName="CheckCircle"
                onClick={() => {
                  onValidate(listing?.id);
                  onClose();
                }}
              >
                Valider
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ListingDetailModal;
