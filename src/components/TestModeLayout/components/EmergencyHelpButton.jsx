import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  LifeBuoy,
  RefreshCw,
  Send,
  X
} from 'lucide-react';

import userTestingService from '../../../services/userTestingService';
import {
  captureCurrentTestingScreenFile,
  TESTING_SCREENSHOT_IGNORE_ATTR
} from '../../../utils/testingScreenshotCapture';

const STATUS_LABELS = {
  open: 'Alerte ouverte',
  observer_joined: 'Observateur en ligne',
  resolved: 'Débloqué'
};

const STATUS_CLASSES = {
  open: 'bg-red-100 text-red-800 border-red-200',
  observer_joined: 'bg-amber-100 text-amber-900 border-amber-200',
  resolved: 'bg-green-100 text-green-800 border-green-200'
};

const ROLE_LABELS = {
  participant: 'Participant',
  observer: 'Observateur'
};

const EmergencyHelpButton = ({
  sessionId,
  currentPageUrl,
  floatingClassName = 'fab-mobile-safe-secondary'
}) => {
  const [showModal, setShowModal] = useState(false);
  const [requestData, setRequestData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draftMessage, setDraftMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const sortedMessages = useMemo(() => {
    return [...(messages || [])].sort((firstMessage, secondMessage) => {
      return new Date(firstMessage?.created_at || 0) - new Date(secondMessage?.created_at || 0);
    });
  }, [messages]);

  const loadThread = async ({ silent = false } = {}) => {
    if (!sessionId) return;
    if (!silent) setLoading(true);

    const { data: latestRequest, error: requestError } =
      await userTestingService?.getLatestEmergencyRequestForSession(sessionId);

    if (requestError) {
      if (!silent) {
        toast?.error("Impossible de charger le fil d'urgence.");
      }
      setLoading(false);
      return;
    }

    setRequestData(latestRequest || null);

    if (!latestRequest?.id) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const { data: threadMessages, error: messagesError } =
      await userTestingService?.getEmergencyRequestMessages(latestRequest?.id);

    if (messagesError) {
      if (!silent) {
        toast?.error('Impossible de charger les messages d urgence.');
      }
      setLoading(false);
      return;
    }

    setMessages(threadMessages || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!showModal || !sessionId) return undefined;

    loadThread();

    const intervalId = window.setInterval(() => {
      loadThread({ silent: true });
    }, 6000);

    return () => window.clearInterval(intervalId);
  }, [showModal, sessionId]);

  const captureAndUploadScreenshot = async () => {
    if (!sessionId) return [];

    try {
      const screenshotFile = await captureCurrentTestingScreenFile({
        fileNamePrefix: 'emergency-help'
      });

      const { data, error } = await userTestingService?.uploadScreenshot(screenshotFile, sessionId);
      if (error) throw error;

      return data?.url ? [data.url] : [];
    } catch (error) {
      console.error('Capture automatique d urgence indisponible :', error);
      return [];
    }
  };

  const handleSend = async () => {
    const trimmedMessage = String(draftMessage || '').trim();
    if (!trimmedMessage || !sessionId) return;

    setSending(true);

    try {
      const screenshotUrls = await captureAndUploadScreenshot();

      if (!requestData?.id || requestData?.status === 'resolved') {
        const { error } = await userTestingService?.createEmergencyRequest({
          sessionId,
          pageUrl: currentPageUrl,
          content: trimmedMessage,
          screenshotUrls
        });

        if (error) {
          throw error;
        }
      } else {
        const { error } = await userTestingService?.sendEmergencyMessage(
          requestData?.id,
          trimmedMessage,
          'participant',
          screenshotUrls
        );

        if (error) {
          throw error;
        }
      }

      setDraftMessage('');
      await loadThread({ silent: true });
      toast?.success("Message d'urgence envoyé.");
    } catch (error) {
      console.error("Erreur lors de l'envoi du message d'urgence :", error);
      toast?.error("Impossible d'envoyer le message d'urgence.");
    } finally {
      setSending(false);
    }
  };

  const handleMarkResolved = async () => {
    if (!requestData?.id) return;

    setUpdatingStatus(true);

    const { data, error } = await userTestingService?.updateEmergencyRequestStatus(
      requestData?.id,
      'resolved'
    );

    setUpdatingStatus(false);

    if (error || !data) {
      toast?.error('Impossible de clôturer cette alerte.');
      return;
    }

    setRequestData(data);
    toast?.success('Alerte marquée comme résolue.');
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`fixed rounded-full bg-amber-500 p-4 text-white shadow-lg transition-colors hover:bg-amber-600 z-40 ${floatingClassName}`}
        title="Demander de l'aide"
        {...{ [TESTING_SCREENSHOT_IGNORE_ATTR]: 'true' }}
      >
        <LifeBuoy className="h-6 w-6" />
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          {...{ [TESTING_SCREENSHOT_IGNORE_ATTR]: 'true' }}
        >
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-border px-6 py-4">
              <div>
                <h3 className="text-xl font-semibold text-foreground">Aide d'urgence</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Utilisez ce fil si la personne est bloquée et qu'un observateur doit intervenir.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Page actuelle : {currentPageUrl || '/'}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
              <div className="flex items-center gap-3">
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  STATUS_CLASSES[requestData?.status || 'open']
                }`}>
                  {STATUS_LABELS[requestData?.status || 'open']}
                </span>
                {requestData?.last_message_at && (
                  <span className="text-xs text-muted-foreground">
                    Dernière activité : {new Date(requestData?.last_message_at)?.toLocaleString()}
                  </span>
                )}
              </div>

              <button
                onClick={() => loadThread()}
                className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80"
              >
                <RefreshCw className="h-4 w-4" />
                Actualiser
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-white px-6 py-4">
              {loading ? (
                <div className="py-10 text-center">
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-primary"></div>
                </div>
              ) : sortedMessages?.length === 0 ? (
                <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                  Aucun échange pour le moment. Écrivez ici pour ouvrir une alerte d'urgence.
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedMessages?.map((message) => {
                    const isObserver = message?.sender_role === 'observer';

                    return (
                      <div
                        key={message?.id}
                        className={`flex ${isObserver ? 'justify-start' : 'justify-end'}`}
                      >
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                          isObserver
                            ? 'bg-slate-100 text-slate-900'
                            : 'bg-amber-100 text-amber-950'
                        }`}>
                          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
                            <span>{ROLE_LABELS[message?.sender_role] || 'Message'}</span>
                            <span className="text-[11px] normal-case tracking-normal text-muted-foreground">
                              {new Date(message?.created_at)?.toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap break-words text-sm">{message?.content}</p>
                          {message?.screenshot_urls?.length > 0 && (
                            <div className="mt-3 grid gap-2">
                              {message?.screenshot_urls?.map((url, index) => (
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
                                    className="max-h-64 w-full rounded-lg border border-white/20 object-cover"
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
                onChange={(event) => setDraftMessage(event?.target?.value || '')}
                placeholder="Expliquez ce qui bloque, ce que vous attendez, ou la consigne à donner."
                rows={3}
                className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  Ce fil sert à débloquer la personne sur le moment et à garder une trace exploitable.
                </div>

                <div className="flex items-center gap-2">
                  {requestData?.id && requestData?.status !== 'resolved' && (
                    <button
                      onClick={handleMarkResolved}
                      disabled={updatingStatus}
                      className="flex items-center gap-2 rounded-lg border border-green-300 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {updatingStatus ? 'Clôture...' : 'Débloqué'}
                    </button>
                  )}

                  <button
                    onClick={handleSend}
                    disabled={!String(draftMessage || '').trim() || sending}
                    className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    <Send className="h-4 w-4" />
                    {sending ? 'Envoi...' : 'Envoyer'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EmergencyHelpButton;

