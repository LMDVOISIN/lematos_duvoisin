import React, { useEffect, useState } from 'react';

import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const RejectDocumentModal = ({
  open,
  document,
  loading,
  onClose,
  onConfirm
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setReason('');
      setError('');
      return;
    }

    setReason(document?.rejectionReason || '');
    setError('');
  }, [document?.id, document?.rejectionReason, open]);

  if (!open || !document) return null;

  const handleSubmit = (event) => {
    event?.preventDefault?.();

    const trimmedReason = String(reason || '').trim();
    if (!trimmedReason) {
      setError('Le motif de refus est obligatoire.');
      return;
    }

    onConfirm?.(trimmedReason);
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 px-4 py-6">
      <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Refus document
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              Refuser {document?.documentTypeLabel || 'ce document'}
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

        <form className="mt-6" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-900" htmlFor="document-rejection-reason">
            Motif de refus
          </label>
          <textarea
            id="document-rejection-reason"
            value={reason}
            onChange={(event) => {
              setReason(event?.target?.value || '');
              if (error) setError('');
            }}
            rows={6}
            className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#17a2b8] focus:ring-2 focus:ring-[#17a2b8]/20"
            placeholder="Explique pourquoi le document est refuse."
          />
          {error ? (
            <p className="mt-2 text-sm text-rose-600">{error}</p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              Ce motif sera visible par l'utilisateur dans son espace documents.
            </p>
          )}

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              variant="danger"
              iconName="CircleX"
              loading={loading}
            >
              Confirmer le refus
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RejectDocumentModal;
