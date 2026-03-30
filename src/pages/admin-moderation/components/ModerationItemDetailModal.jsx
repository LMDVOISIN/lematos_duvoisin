import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Image from '../../../components/AppImage';

const TYPE_LABELS = {
  annonce: 'Annonce',
  demande: 'Demande'
};

const STATUS_LABELS = {
  pending: 'En attente',
  in_review: 'En cours',
  validated: 'Validee',
  refused: 'Refusee'
};

const DetailRow = ({ label, value }) => (
  <div>
    <p className="text-sm text-muted-foreground mb-1">{label}</p>
    <p className="font-medium text-foreground break-words">{value || '-'}</p>
  </div>
);

const ModerationItemDetailModal = ({
  item,
  onClose,
  onApprove,
  onReject,
  loading = false
}) => {
  if (!item) return null;

  const typeLabel = TYPE_LABELS?.[item?.kind] || 'Element';
  const statusLabel = STATUS_LABELS?.[item?.status] || STATUS_LABELS?.pending;
  const canApprove = item?.status === 'pending' || item?.status === 'in_review';

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-elevation-4 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground">
              {typeLabel}
            </p>
            <h2 className="text-xl font-semibold text-foreground">Details de moderation</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-surface rounded-md transition-colors disabled:opacity-50"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {item?.kind === 'annonce' && item?.image ? (
            <div className="w-full h-64 rounded-lg overflow-hidden bg-surface">
              <Image
                src={item?.image}
                alt={item?.imageAlt || item?.title}
                className="w-full h-full object-cover"
              />
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-surface text-foreground">
                <Icon name={item?.kind === 'demande' ? 'FileSearch' : 'Package'} size={12} />
                {typeLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-surface text-foreground">
                <Icon name="Clock" size={12} />
                {statusLabel}
              </span>
              {item?.metaLabel ? (
                <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-primary/10 text-primary">
                  {item?.metaLabel}
                </span>
              ) : null}
            </div>

            <div>
              <h3 className="text-2xl font-bold text-foreground">{item?.title}</h3>
              {item?.subtitle ? (
                <p className="text-sm text-muted-foreground mt-2">{item?.subtitle}</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DetailRow label="Proprietaire / demandeur" value={item?.ownerLabel} />
            <DetailRow label="Email" value={item?.ownerEmail} />
            <DetailRow label="Categorie" value={item?.category} />
            <DetailRow label="Date de soumission" value={item?.formattedSubmissionDate} />
            {item?.kind === 'annonce' ? (
              <DetailRow label="Prix par jour" value={item?.priceLabel} />
            ) : (
              <DetailRow label="Budget / rayon" value={item?.budgetLabel || item?.radiusLabel} />
            )}
            {item?.kind === 'demande' ? (
              <DetailRow label="Ville" value={item?.locationLabel} />
            ) : (
              <DetailRow label="Statut" value={statusLabel} />
            )}
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-2">Description</p>
            <div className="rounded-lg border border-border bg-surface px-4 py-3 text-foreground whitespace-pre-wrap break-words">
              {item?.description || '-'}
            </div>
          </div>

          {item?.refusalReason ? (
            <div className="bg-error/10 border border-error/20 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Icon name="AlertCircle" size={18} className="text-error mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-error mb-1">Raison du refus</p>
                  <p className="text-sm text-foreground">{item?.refusalReason}</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="sticky bottom-0 bg-surface border-t border-border px-6 py-4 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Fermer
          </Button>

          {canApprove ? (
            <>
              <Button
                variant="danger"
                iconName="XCircle"
                disabled={loading}
                onClick={() => onReject?.(item)}
              >
                {item?.kind === 'demande' ? 'Rejeter' : 'Refuser'}
              </Button>
              <Button
                variant="success"
                iconName="CheckCircle"
                loading={loading}
                onClick={() => onApprove?.(item)}
              >
                {item?.kind === 'demande' ? 'Approuver' : 'Valider'}
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ModerationItemDetailModal;
