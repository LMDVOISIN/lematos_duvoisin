import React from 'react';

import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const formatDateTime = (value) => {
  if (!value) return 'Non renseigne';

  const date = new Date(value);
  if (Number.isNaN(date?.getTime())) return 'Non renseigne';

  return date?.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatFileSize = (value) => {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return 'Non renseigne';
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${(size / 1024)?.toFixed(1)} Ko`;
  return `${(size / (1024 * 1024))?.toFixed(1)} Mo`;
};

const getStatusBadgeClasses = (status) => {
  if (status === 'approved') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'rejected') return 'bg-rose-100 text-rose-700 border-rose-200';
  return 'bg-amber-100 text-amber-700 border-amber-200';
};

const DocumentDetailModal = ({
  open,
  document,
  previewUrl,
  previewLoading,
  previewError,
  actionLoading,
  onClose,
  onLoadPreview,
  onApprove,
  onReject
}) => {
  if (!open || !document) return null;

  const canApprove = document?.status !== 'approved';
  const canReject = document?.status !== 'rejected';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 px-4 py-6">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Verification document
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              {document?.documentTypeLabel || 'Document'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {document?.userPseudo || 'Utilisateur'} {document?.userEmail ? `- ${document?.userEmail}` : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
            aria-label="Fermer"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        <div className="grid max-h-[calc(92vh-96px)] grid-cols-1 overflow-y-auto lg:grid-cols-[1.15fr_0.85fr]">
          <div className="border-b border-slate-200 bg-slate-50 p-6 lg:border-b-0 lg:border-r">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getStatusBadgeClasses(document?.status)}`}>
                <Icon
                  name={document?.status === 'approved' ? 'BadgeCheck' : document?.status === 'rejected' ? 'CircleX' : 'Clock3'}
                  size={14}
                />
                {document?.status === 'approved' ? 'Valide' : document?.status === 'rejected' ? 'Refuse' : 'En attente'}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                iconName="RefreshCw"
                loading={previewLoading}
                onClick={() => onLoadPreview?.(document)}
              >
                Charger l'aperçu
              </Button>
            </div>

            <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-4">
              {previewLoading ? (
                <div className="text-center text-slate-500">
                  <Icon name="Loader" size={28} className="mx-auto animate-spin" />
                  <p className="mt-3 text-sm">Chargement du document...</p>
                </div>
              ) : previewUrl ? (
                document?.previewKind === 'image' ? (
                  <img
                    src={previewUrl}
                    alt={document?.thumbnailAlt || 'Document utilisateur'}
                    className="max-h-[70vh] w-full rounded-xl object-contain"
                  />
                ) : document?.previewKind === 'pdf' ? (
                  <iframe
                    src={previewUrl}
                    title={document?.fileName || 'Document PDF'}
                    className="h-[70vh] w-full rounded-xl border border-slate-200"
                  />
                ) : (
                  <div className="text-center">
                    <Icon name="FileText" size={42} className="mx-auto text-slate-400" />
                    <p className="mt-3 text-sm text-slate-600">
                      Apercu non disponible pour ce format.
                    </p>
                  </div>
                )
              ) : (
                <div className="text-center">
                  <Icon name="FileSearch" size={42} className="mx-auto text-slate-400" />
                  <p className="mt-3 text-sm text-slate-600">
                    Clique sur "Charger l'aperçu" pour ouvrir le document.
                  </p>
                  {previewError ? (
                    <p className="mt-2 text-sm text-rose-600">{previewError}</p>
                  ) : null}
                </div>
              )}
            </div>

            {previewUrl ? (
              <div className="mt-4">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-[#0f7081] hover:underline"
                >
                  <Icon name="ExternalLink" size={16} />
                  Ouvrir le document dans un nouvel onglet
                </a>
              </div>
            ) : null}
          </div>

          <div className="p-6">
            <div className="grid gap-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Identite</p>
                <dl className="mt-3 space-y-3 text-sm text-slate-700">
                  <div>
                    <dt className="font-medium text-slate-900">Utilisateur</dt>
                    <dd>{document?.userPseudo || 'Utilisateur'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-900">Email</dt>
                    <dd>{document?.userEmail || 'Non renseigne'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-900">Type</dt>
                    <dd>{document?.documentTypeLabel || 'Document'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-900">Nom du fichier</dt>
                    <dd className="break-all">{document?.fileName || 'Non renseigne'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-900">Taille</dt>
                    <dd>{formatFileSize(document?.fileSizeBytes)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-900">Depose le</dt>
                    <dd>{formatDateTime(document?.uploadDate)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-900">Derniere validation</dt>
                    <dd>{formatDateTime(document?.approvedDate || document?.rejectedDate)}</dd>
                  </div>
                </dl>
              </div>

              {document?.rejectionReason ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Motif de refus</p>
                  <p className="mt-2 text-sm text-rose-700">{document?.rejectionReason}</p>
                </div>
              ) : null}

              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Actions</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {canApprove ? (
                    <Button
                      type="button"
                      variant="success"
                      iconName="BadgeCheck"
                      loading={actionLoading}
                      onClick={() => onApprove?.(document)}
                    >
                      Valider
                    </Button>
                  ) : null}

                  {canReject ? (
                    <Button
                      type="button"
                      variant="outline"
                      iconName="CircleX"
                      loading={actionLoading}
                      onClick={() => onReject?.(document)}
                    >
                      Refuser
                    </Button>
                  ) : null}

                  <Button
                    type="button"
                    variant="ghost"
                    iconName="X"
                    onClick={onClose}
                  >
                    Fermer
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentDetailModal;
