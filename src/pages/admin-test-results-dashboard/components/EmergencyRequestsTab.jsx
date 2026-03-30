import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  LifeBuoy,
  RefreshCw,
  Send
} from 'lucide-react';

import userTestingService from '../../../services/userTestingService';

const STATUS_LABELS = {
  all: 'Toutes',
  open: 'Ouvertes',
  observer_joined: 'Prises en charge',
  resolved: 'Résolues'
};

const STATUS_BADGES = {
  open: 'bg-red-100 text-red-800 border-red-200',
  observer_joined: 'bg-amber-100 text-amber-900 border-amber-200',
  resolved: 'bg-green-100 text-green-800 border-green-200'
};

const ROLE_LABELS = {
  participant: 'Participant',
  observer: 'Observateur'
};

const UrgencesTab = () => {
  const [requests, setRequests] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [draftMessage, setDraftMessage] = useState('');

  const loadRequests = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);

    const { data, error } = await userTestingService.getAllEmergencyRequests();

    if (error) {
      if (!silent) {
        toast.error('Impossible de charger les urgences.');
      }
      setLoading(false);
      return;
    }

    setRequests(data || []);
    setLoading(false);
  };

  const loadMessages = async (requestId, { silent = false } = {}) => {
    if (!requestId) {
      setMessages([]);
      return;
    }

    const { data, error } = await userTestingService.getEmergencyRequestMessages(requestId);

    if (error) {
      if (!silent) {
        toast.error('Impossible de charger le fil de discussion.');
      }
      return;
    }

    setMessages(data || []);
  };

  useEffect(() => {
    loadRequests();

    const intervalId = window.setInterval(() => {
      loadRequests({ silent: true });
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!requests.length) {
      setSelectedRequestId(null);
      return;
    }

    const selectedStillExists = requests.some((request) => String(request.id) === String(selectedRequestId));
    if (!selectedStillExists) {
      setSelectedRequestId(requests[0]?.id || null);
    }
  }, [requests, selectedRequestId]);

  useEffect(() => {
    if (!selectedRequestId) {
      setMessages([]);
      return undefined;
    }

    loadMessages(selectedRequestId);

    const intervalId = window.setInterval(() => {
      loadMessages(selectedRequestId, { silent: true });
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [selectedRequestId]);

  const filteredRequests = useMemo(() => {
    return (requests || []).filter((request) => {
      if (filter === 'all') return true;
      return request.status === filter;
    });
  }, [filter, requests]);

  const selectedRequest = filteredRequests.find(
    (request) => String(request.id) === String(selectedRequestId)
  ) || requests.find((request) => String(request.id) === String(selectedRequestId)) || null;

  const handleStatusChange = async (status) => {
    if (!selectedRequest.id) return;

    setUpdatingStatus(true);

    const { error } = await userTestingService.updateEmergencyRequestStatus(selectedRequest.id, status);

    setUpdatingStatus(false);

    if (error) {
      toast.error('Impossible de mettre à jour le statut.');
      return;
    }

    await loadRequests({ silent: true });
    toast.success('Statut mis à jour.');
  };

  const handleSend = async () => {
    const trimmedMessage = String(draftMessage || '').trim();
    if (!trimmedMessage || !selectedRequest.id) return;

    setSending(true);

    const { error } = await userTestingService.sendEmergencyMessage(
      selectedRequest.id,
      trimmedMessage,
      'observer'
    );

    setSending(false);

    if (error) {
      toast.error("Impossible d'envoyer la réponse.");
      return;
    }

    setDraftMessage('');
    await loadRequests({ silent: true });
    await loadMessages(selectedRequest.id, { silent: true });
    toast.success('Réponse envoyée.');
  };

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Aides d'urgence</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Échanges en direct pour débloquer un participant pendant l'essai.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {['all', 'open', 'observer_joined', 'resolved'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-primary text-white'
                  : 'bg-white text-surface-foreground hover:bg-surface'
              }`}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}

          <button
            onClick={() => loadRequests()}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-surface-foreground hover:bg-surface"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-3">
          {filteredRequests.map((request) => (
            <button
              key={request.id}
              onClick={() => setSelectedRequestId(request.id)}
              className={`w-full rounded-lg border p-4 text-left transition-colors ${
                String(selectedRequestId) === String(request.id)
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-white hover:bg-surface'
              }`}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <LifeBuoy className="h-4 w-4 text-amber-600" />
                  <span className={`rounded-full border px-2 py-1 text-xs font-medium ${
                    STATUS_BADGES[request.status] || STATUS_BADGES.open
                  }`}>
                    {STATUS_LABELS[request.status] || request.status}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(request.last_message_at || request.requested_at).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>

              <p className="text-sm font-semibold text-foreground">
                {request.session.tester.email || 'Participant inconnu'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {request.session.scenario.title || 'Parcours non précisé'}
              </p>
              <p className="mt-2 text-xs text-muted-foreground break-all">
                Page : {request.page_url || '/'}
              </p>
            </button>
          ))}

          {filteredRequests.length === 0 && (
            <div className="rounded-lg bg-white p-8 text-center shadow">
              <p className="text-sm text-muted-foreground">Aucune urgence sur ce filtre.</p>
            </div>
          )}
        </div>

        <div className="rounded-lg bg-white shadow">
          {!selectedRequest ? (
            <div className="flex h-full min-h-[420px] items-center justify-center p-8 text-center">
              <div>
                <LifeBuoy className="mx-auto h-10 w-10 text-amber-500" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Sélectionnez une alerte pour lire le fil et répondre.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[420px] flex-col">
              <div className="border-b border-border px-6 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      {selectedRequest.session.tester.email || 'Participant inconnu'}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedRequest.session.scenario.title || 'Parcours non précisé'}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground break-all">
                      Page concernée : {selectedRequest.page_url || '/'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      STATUS_BADGES[selectedRequest.status] || STATUS_BADGES.open
                    }`}>
                      {STATUS_LABELS[selectedRequest.status] || selectedRequest.status}
                    </span>

                    {selectedRequest.status === 'open' && (
                      <button
                        onClick={() => handleStatusChange('observer_joined')}
                        disabled={updatingStatus}
                        className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {updatingStatus ? 'Mise à jour...' : 'Prendre en charge'}
                      </button>
                    )}

                    {selectedRequest.status !== 'resolved' && (
                      <button
                        onClick={() => handleStatusChange('resolved')}
                        disabled={updatingStatus}
                        className="flex items-center gap-2 rounded-lg border border-green-300 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {updatingStatus ? 'Mise à jour...' : 'Marquer comme résolu'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-surface/40 px-6 py-5">
                {messages.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-white p-4 text-sm text-muted-foreground">
                    Aucun message pour le moment.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message) => {
                      const isObserver = message.sender_role === 'observer';

                      return (
                        <div
                          key={message.id}
                          className={`flex ${isObserver ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                              isObserver
                                ? 'bg-primary text-white'
                               : 'bg-white text-foreground'
                            }`}>
                            <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
                              <span>{ROLE_LABELS[message.sender_role] || 'Message'}</span>
                              <span className={`text-[11px] normal-case tracking-normal ${
                                isObserver ? 'text-white/80' : 'text-muted-foreground'
                              }`}>
                                {new Date(message.created_at).toLocaleString()}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                            {message.screenshot_urls.length > 0 && (
                              <div className="mt-3 grid gap-2">
                                {message.screenshot_urls.map((url, index) => (
                                  <a
                                    key={index}
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block"
                                  >
                                    <img
                                      src={url}
                                      alt={`Capture d'urgence ${index + 1}`}
                                      className="max-h-72 w-full rounded-lg border border-border object-cover"
                                    />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-border bg-white px-6 py-4">
                <textarea
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value || '')}
                  rows={3}
                  placeholder="Ecrivez ici la consigne ou l aide a donner au participant."
                  className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />

                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Laissez une trace de ce debloquage pour nourrir les ameliorations a venir.
                  </p>

                  <button
                    onClick={handleSend}
                    disabled={!String(draftMessage || '').trim() || sending}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    <Send className="h-4 w-4" />
                    {sending ? 'Envoi...' : 'Répondre'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UrgencesTab;

