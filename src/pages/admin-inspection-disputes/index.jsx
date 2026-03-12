import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import inspectionService from '../../services/inspectionService';

const OPEN_STATUSES = ['opened', 'under_review', 'pending_information'];

const STATUS_OPTIONS = [
  { value: 'open_only', label: 'Litiges ouverts' },
  { value: 'all', label: 'Tous' },
  { value: 'opened', label: 'Ouvert' },
  { value: 'under_review', label: 'En revue' },
  { value: 'pending_information', label: 'Infos requises' },
  { value: 'resolved_release', label: 'Résolu (libération)' },
  { value: 'resolved_capture', label: 'Résolu (capture)' },
  { value: 'rejected', label: 'Rejeté' },
  { value: 'withdrawn', label: 'Retiré' }
];

const MODERATION_OPTIONS = [
  { value: 'release', label: "Libérer l'empreinte CB" },
  { value: 'capture', label: "Capturer l'empreinte CB" },
  { value: 'reject', label: 'Rejeter le litige' }
];

const DISPUTE_META = {
  opened: { label: 'Ouvert', cls: 'text-amber-700 bg-amber-100 border-amber-200', icon: 'AlertTriangle' },
  under_review: { label: 'En revue', cls: 'text-blue-700 bg-blue-100 border-blue-200', icon: 'Search' },
  pending_information: { label: 'Infos requises', cls: 'text-violet-700 bg-violet-100 border-violet-200', icon: 'Info' },
  resolved_release: { label: 'Libéré après modération', cls: 'text-green-700 bg-green-100 border-green-200', icon: 'CheckCircle2' },
  resolved_capture: { label: 'Capturée après modération', cls: 'text-red-700 bg-red-100 border-red-200', icon: 'Gavel' },
  rejected: { label: 'Rejeté', cls: 'text-slate-700 bg-slate-100 border-slate-200', icon: 'XCircle' },
  withdrawn: { label: 'Retiré', cls: 'text-slate-700 bg-slate-100 border-slate-200', icon: 'CornerDownLeft' }
};

const SETTLEMENT_META = {
  hold_24h: { label: 'Fenêtre 24h', cls: 'text-amber-700 bg-amber-100 border-amber-200' },
  disputed_pending_moderation: { label: 'En modération', cls: 'text-red-700 bg-red-100 border-red-200' },
  released_no_dispute: { label: 'Libéré sans litige', cls: 'text-green-700 bg-green-100 border-green-200' },
  released_after_moderation: { label: 'Libéré après modération', cls: 'text-green-700 bg-green-100 border-green-200' },
  captured_after_moderation: { label: 'Capturée après modération', cls: 'text-red-700 bg-red-100 border-red-200' },
  pending_end_inspection: { label: 'Attente EDL fin', cls: 'text-slate-700 bg-slate-100 border-slate-200' }
};

const PAYMENT_META = {
  hold_24h: { label: 'Hold 24h', cls: 'text-amber-700 bg-amber-100 border-amber-200' },
  frozen_for_moderation: { label: 'Gel modération', cls: 'text-red-700 bg-red-100 border-red-200' },
  released: { label: 'Libéré', cls: 'text-green-700 bg-green-100 border-green-200' },
  captured: { label: 'Capturee', cls: 'text-red-700 bg-red-100 border-red-200' },
  none: { label: 'Aucun hold', cls: 'text-slate-700 bg-slate-100 border-slate-200' }
};

const fmt = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const countdown = (v) => {
  if (!v) return null;
  const end = new Date(v);
  if (Number.isNaN(end.getTime())) return null;
  const diff = end.getTime() - Date.now();
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  return diff >= 0 ? `reste ${h}h ${String(m).padStart(2, '0')}m` : `expiré depuis ${h}h ${String(m).padStart(2, '0')}m`;
};

const text = (v) => {
  if (v === null || v === undefined) return '-';
  const s = String(v).trim();
  return s || '-';
};

const Badge = ({ icon, label, cls }) => (
  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${cls}`}>
    {icon ? <Icon name={icon} size={12} /> : null}
    {label}
  </span>
);

const AdminInspectionDisputes = () => {
  const [statusFilter, setStatusFilter] = useState('open_only');
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [loading, setLoading] = useState(true);
  const [processingDue, setProcessingDue] = useState(false);
  const [busyDisputeId, setBusyDisputeId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [items, setItems] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = () => setReloadKey((v) => v + 1);

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      setSuccessMessage('');

      const statuses = statusFilter === 'open_only' ? OPEN_STATUSES : statusFilter === 'all' ? [] : [statusFilter];
      const disputesRes = await inspectionService?.getDisputesForModeration?.({ statuses, limit: 120 });
      if (disputesRes?.error) throw disputesRes.error;
      const disputes = Array.isArray(disputesRes?.data) ? disputesRes.data : [];

      const disputeIds = disputes.map((d) => d?.id).filter(Boolean);
      const reservationIds = Array.from(new Set(disputes.map((d) => d?.reservation_id).filter(Boolean)));

      const [photosRes, settlementsRes, reservationsRes] = await Promise.all([
        inspectionService?.getDisputePhotoSelectionsByDisputeIds?.(disputeIds),
        inspectionService?.getSettlementsByReservationIds?.(reservationIds),
        inspectionService?.getReservationsByIds?.(reservationIds)
      ]);

      if (photosRes?.error) throw photosRes.error;
      if (settlementsRes?.error) throw settlementsRes.error;
      if (reservationsRes?.error) throw reservationsRes.error;

      const photosByDispute = {};
      (photosRes?.data || []).forEach((row) => {
        if (!row?.dispute_id) return;
        if (!photosByDispute[row.dispute_id]) photosByDispute[row.dispute_id] = [];
        photosByDispute[row.dispute_id].push(row);
      });

      const settlementsByReservation = {};
      (settlementsRes?.data || []).forEach((row) => {
        if (row?.reservation_id) settlementsByReservation[row.reservation_id] = row;
      });

      const reservationsById = {};
      (reservationsRes?.data || []).forEach((row) => {
        if (row?.id) reservationsById[row.id] = row;
      });

      setItems(disputes.map((dispute) => ({
        dispute,
        selectedPhotos: photosByDispute?.[dispute?.id] || [],
        settlement: settlementsByReservation?.[dispute?.reservation_id] || null,
        reservation: reservationsById?.[dispute?.reservation_id] || null
      })));

      setDrafts((prev) => {
        const next = { ...prev };
        disputes.forEach((d) => {
          if (!d?.id || next?.[d.id]) return;
          next[d.id] = { decision: 'release', note: '' };
        });
        return next;
      });
    } catch (error) {
      console.error('Erreur chargement moderation litiges EDL:', error);
      setErrorMessage(error?.message || "Impossible de charger les litiges d'etat des lieux.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [reloadKey, statusFilter]);

  const filteredItems = useMemo(() => {
    const q = String(deferredSearchTerm || '').trim().toLowerCase();
    if (!q) return items;
    return items.filter(({ dispute, reservation }) => {
      const haystack = [
        dispute?.id,
        dispute?.reservation_id,
        dispute?.status,
        dispute?.opened_by_role,
        dispute?.title,
        dispute?.description,
        reservation?.status,
        reservation?.deposit_status,
        reservation?.annonce_id
      ].map((v) => String(v || '').toLowerCase()).join(' ');
      return haystack.includes(q);
    });
  }, [items, deferredSearchTerm]);

  const counts = useMemo(() => {
    const total = items.length;
    const open = items.filter((it) => OPEN_STATUSES.includes(it?.dispute?.status)).length;
    return { total, open, closed: total - open };
  }, [items]);

  const setDraft = (disputeId, patch) => {
    setDrafts((prev) => ({
      ...prev,
      [disputeId]: { decision: prev?.[disputeId]?.decision || 'release', note: prev?.[disputeId]?.note || '', ...patch }
    }));
  };

  const handleProcessDue = async () => {
    try {
      setProcessingDue(true);
      setErrorMessage('');
      setSuccessMessage('');
      const res = await inspectionService?.processDueSettlements?.({ limit: 200 });
      if (res?.error) throw res.error;
      const d = res?.data || {};
      setSuccessMessage(`Traitement 24h: ${Number(d?.processed || 0)} dossier(s), ${Number(d?.released_count || 0)} libéré(s), ${Number(d?.frozen_count || 0)} gelé(s).`);
      refresh();
    } catch (error) {
      console.error('Erreur traitement 24h EDL:', error);
      setErrorMessage(error?.message || 'Traitement des échéances 24h impossible.');
    } finally {
      setProcessingDue(false);
    }
  };

  const handleModerate = async (disputeId) => {
    try {
      setBusyDisputeId(disputeId);
      setErrorMessage('');
      setSuccessMessage('');
      const draft = drafts?.[disputeId] || { decision: 'release', note: '' };
      const res = await inspectionService?.moderateDispute?.({
        disputeId,
        decision: draft?.decision,
        moderatorNote: draft?.note
      });
      if (res?.error) throw res.error;
      setSuccessMessage(`Litige #${disputeId} modéré (${draft?.decision}).`);
      refresh();
    } catch (error) {
      console.error('Erreur modÃ©ration litige EDL:', error);
      setErrorMessage(error?.message || 'Action de modération impossible.');
    } finally {
      setBusyDisputeId(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6 md:py-8 max-w-7xl">
        <div className="mb-6">
          <Link to="/administration-tableau-bord" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
            <Icon name="ArrowLeft" size={16} />
            Retour au tableau de bord admin
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-elevation-1 p-5 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Moderation des litiges d'etat des lieux</h1>
              <p className="text-muted-foreground mt-2">
                Arbitrage interne: moderation des litiges sur la base des photos officielles et des traces techniques associees.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" iconName="RefreshCw" onClick={refresh} loading={loading}>
                Actualiser
              </Button>
              <Button variant="warning" size="sm" iconName="Clock" onClick={handleProcessDue} loading={processingDue}>
                Traiter echeances 24h
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-elevation-1 p-4"><p className="text-sm text-muted-foreground">Litiges chargés</p><p className="text-2xl font-bold">{counts.total}</p></div>
          <div className="bg-white rounded-lg shadow-elevation-1 p-4"><p className="text-sm text-muted-foreground">Litiges ouverts</p><p className="text-2xl font-bold text-amber-700">{counts.open}</p></div>
          <div className="bg-white rounded-lg shadow-elevation-1 p-4"><p className="text-sm text-muted-foreground">Clôturés / rejetés</p><p className="text-2xl font-bold text-slate-700">{counts.closed}</p></div>
        </div>

        <div className="bg-white rounded-lg shadow-elevation-1 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Filtre statut" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
            <Input label="Recherche" placeholder="ID litige, reservation, statut..." value={searchTerm} onChange={(e) => setSearchTerm(e?.target?.value || '')} />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {inspectionService?.INTERNAL_ARBITRATION_SCOPE_NOTE}
          </p>
        </div>

        {errorMessage ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div> : null}
        {successMessage ? <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{successMessage}</div> : null}

        {loading ? (
          <div className="bg-white rounded-lg shadow-elevation-1 p-8 text-center text-muted-foreground">
            <Icon name="Loader2" size={16} className="inline-block animate-spin mr-2" />
            Chargement des litiges...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white rounded-lg shadow-elevation-1 p-8 text-center">
            <Icon name="ShieldCheck" size={24} className="mx-auto text-green-600 mb-2" />
            <p className="font-medium text-foreground">Aucun litige correspondant</p>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredItems.map(({ dispute, selectedPhotos, settlement, reservation }) => {
              const disputeMeta = DISPUTE_META?.[dispute?.status] || DISPUTE_META.opened;
              const settlementMeta = SETTLEMENT_META?.[settlement?.status] || null;
              const paymentMeta = PAYMENT_META?.[settlement?.payment_hold_status] || null;
              const draft = drafts?.[dispute?.id] || { decision: 'release', note: '' };
              const isBusy = busyDisputeId === dispute?.id;
              const isActionable = OPEN_STATUSES.includes(dispute?.status);

              return (
                <section key={dispute?.id} className="bg-white rounded-xl shadow-elevation-1 border border-border overflow-hidden">
                  <div className="px-4 py-4 border-b border-border bg-surface/60">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg font-semibold text-foreground">Litige #{dispute?.id}</h2>
                          <Badge icon={disputeMeta?.icon} label={disputeMeta?.label} cls={disputeMeta?.cls} />
                          {settlementMeta ? <Badge icon="Scale" label={settlementMeta?.label} cls={settlementMeta?.cls} /> : null}
                          {paymentMeta ? <Badge icon="Wallet" label={paymentMeta?.label} cls={paymentMeta?.cls} /> : null}
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                          <span>Reservation: <span className="text-foreground font-medium">{text(dispute?.reservation_id)}</span></span>
                          <span>Auteur: <span className="text-foreground font-medium">{text(dispute?.opened_by_role)}</span></span>
                          <span>Ouvert: <span className="text-foreground font-medium">{fmt(dispute?.opened_at)}</span></span>
                          <span>Fenêtre: <span className="text-foreground font-medium">{fmt(dispute?.window_ends_at)}</span></span>
                          {dispute?.window_ends_at ? <span className="text-foreground font-medium">{countdown(dispute?.window_ends_at)}</span> : null}
                        </div>
                      </div>
                      {dispute?.reservation_id ? (
                        <Link to={`/photos-d-tat-des-lieux/${dispute.reservation_id}`} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                          <Icon name="Camera" size={14} />
                          Voir ecran EDL
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <div className="p-4 grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <div className="xl:col-span-2 space-y-4">
                      <div className="rounded-lg border border-border p-4">
                        <h3 className="font-semibold mb-2">Description du litige</h3>
                        {dispute?.title ? <p className="text-sm font-medium mb-2">{dispute.title}</p> : null}
                        <p className="text-sm whitespace-pre-wrap text-foreground">{text(dispute?.description)}</p>
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <p>Soumis dans delai: <span className="text-foreground font-medium">{dispute?.submitted_within_window ? 'Oui' : 'Non'}</span></p>
                          <p>Decision mod.: <span className="text-foreground font-medium">{text(dispute?.moderator_decision)}</span></p>
                          <p>Resolu le: <span className="text-foreground font-medium">{fmt(dispute?.resolved_at)}</span></p>
                          <p>Note mod.: <span className="text-foreground font-medium">{text(dispute?.moderator_note)}</span></p>
                        </div>
                      </div>

                      <div className="rounded-lg border border-border p-4">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <h3 className="font-semibold">Photos selectionnees</h3>
                          <span className="text-xs text-muted-foreground">{selectedPhotos.length} photo(s)</span>
                        </div>
                        {selectedPhotos.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Aucune photo liee au litige.</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {selectedPhotos.map((photo) => (
                              <div key={photo?.id} className="rounded-lg border border-border p-3">
                                <div className="flex items-center justify-between gap-2 mb-2 text-xs">
                                  <span className="font-medium">Photo #{text(photo?.photo_id_text)}</span>
                                  <span className="uppercase tracking-wide text-muted-foreground">{text(photo?.photo_phase)}</span>
                                </div>
                                {photo?.photo_url_snapshot ? (
                                  <a href={photo.photo_url_snapshot} target="_blank" rel="noreferrer" className="block rounded-md overflow-hidden border border-border bg-surface">
                                    <img src={photo.photo_url_snapshot} alt={`Photo litige ${photo?.photo_id_text || ''}`} className="w-full h-40 object-cover" loading="lazy" />
                                  </a>
                                ) : (
                                  <div className="h-40 rounded-md border border-dashed border-border bg-surface flex items-center justify-center text-sm text-muted-foreground">URL snapshot indisponible</div>
                                )}
                                <p className="mt-2 text-[11px] text-muted-foreground">Selection: {fmt(photo?.selected_at)} | URL signee pouvant expirer</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-lg border border-border p-4">
                        <h3 className="font-semibold mb-3">Contexte reservation</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between gap-2"><span className="text-muted-foreground">Statut reservation</span><span className="font-medium text-foreground text-right">{text(reservation?.status)}</span></div>
                          <div className="flex justify-between gap-2"><span className="text-muted-foreground">Statut caution</span><span className="font-medium text-foreground text-right">{text(reservation?.deposit_status)}</span></div>
                          <div className="flex justify-between gap-2"><span className="text-muted-foreground">Annonce</span><span className="font-medium text-foreground text-right break-all">{text(reservation?.annonce_id)}</span></div>
                          <div className="flex justify-between gap-2"><span className="text-muted-foreground">Propriétaire</span><span className="font-medium text-foreground text-right break-all">{text(reservation?.owner_id)}</span></div>
                          <div className="flex justify-between gap-2"><span className="text-muted-foreground">Locataire</span><span className="font-medium text-foreground text-right break-all">{text(reservation?.renter_id)}</span></div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-border p-4">
                        <h3 className="font-semibold mb-3">Settlement inspection</h3>
                        {settlement ? (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between gap-2"><span className="text-muted-foreground">Statut</span><span className="font-medium text-foreground text-right">{text(settlement?.status)}</span></div>
                            <div className="flex justify-between gap-2"><span className="text-muted-foreground">Paiement hold</span><span className="font-medium text-foreground text-right">{text(settlement?.payment_hold_status)}</span></div>
                            <div className="flex justify-between gap-2"><span className="text-muted-foreground">Debut hold</span><span className="font-medium text-foreground text-right">{fmt(settlement?.hold_started_at)}</span></div>
                            <div className="flex justify-between gap-2"><span className="text-muted-foreground">Fin fenêtre</span><span className="font-medium text-foreground text-right">{fmt(settlement?.contest_window_ends_at)}</span></div>
                            <div className="flex justify-between gap-2"><span className="text-muted-foreground">Decision finale</span><span className="font-medium text-foreground text-right">{fmt(settlement?.final_decision_at)}</span></div>
                            <div className="pt-2 border-t border-border">
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {settlement?.legal_scope_note || inspectionService?.INTERNAL_ARBITRATION_SCOPE_NOTE}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Settlement non trouve pour cette reservation.</p>
                        )}
                      </div>

                      <div className="rounded-lg border border-border p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Icon name="Gavel" size={16} className="text-blue-600" />
                          <h3 className="font-semibold">Décision de modération</h3>
                        </div>
                        {!isActionable ? (
                          <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            Litige non modérable via l'action finale (déjà résolu / rejeté).
                          </div>
                        ) : null}
                        <div className="space-y-3">
                          <Select
                            label="Decision"
                            value={draft?.decision || 'release'}
                            onChange={(value) => setDraft(dispute?.id, { decision: value })}
                            options={MODERATION_OPTIONS}
                            disabled={!isActionable || isBusy}
                          />
                          <div className="space-y-2">
                            <label htmlFor={`note-${dispute?.id}`} className="text-sm font-medium text-foreground">
                              Note moderateur (optionnelle)
                            </label>
                            <textarea
                              id={`note-${dispute?.id}`}
                              className="w-full min-h-[110px] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                              placeholder="Motif objectif de la decision (photos comparees, dommage constate, etc.)"
                              value={draft?.note || ''}
                              onChange={(e) => setDraft(dispute?.id, { note: e?.target?.value || '' })}
                              disabled={!isActionable || isBusy}
                            />
                          </div>
                          <Button
                            fullWidth
                            onClick={() => handleModerate(dispute?.id)}
                            loading={isBusy}
                            disabled={!isActionable || isBusy}
                            variant={draft?.decision === 'capture' ? 'danger' : draft?.decision === 'reject' ? 'outline' : 'success'}
                          >
                            {draft?.decision === 'capture'
                              ? 'Confirmer la retenue'
                              : draft?.decision === 'reject'
                                ? 'Rejeter le litige'
                                : 'Confirmer la liberation'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default AdminInspectionDisputes;

