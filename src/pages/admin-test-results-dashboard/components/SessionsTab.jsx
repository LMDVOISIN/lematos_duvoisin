import React, { useEffect, useState } from 'react';
import { CheckCircle, Clock, Download, Mail, PauseCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

import userTestingService from '../../../services/userTestingService';
import { sendEmail } from '../../../services/emailService';

const obtenirLibelleStatut = (statut) => {
  switch (statut) {
    case 'all':
      return 'Toutes';
    case 'pending':
      return 'En attente';
    case 'in_progress':
      return 'En cours';
    case 'completed':
      return 'Terminée';
    case 'paused':
      return 'En pause';
    default:
      return statut;
  }
};

const construireContenuMailReprise = ({ scenarioTitle, appUrl }) => {
  const safeScenarioTitle = String(scenarioTitle || 'votre test').trim();
  const safeAppUrl = String(appUrl || '').trim();
  const targetUrl = safeAppUrl
    ? `${safeAppUrl.replace(/\/$/, '')}/participant-configuration-contexte-authentification`
    : '/participant-configuration-contexte-authentification';

  return {
    subject: `Votre test peut reprendre sur Le Matos du Voisin`,
    htmlBody: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #0f172a;">
        <h1 style="font-size: 24px; margin-bottom: 16px;">Votre test peut reprendre</h1>
        <p style="margin: 0 0 12px;">L'observateur a corrigé le blocage rencontré pendant le test <strong>${safeScenarioTitle}</strong>.</p>
        <p style="margin: 0 0 12px;">Vous pouvez maintenant revenir sur votre espace de test pour reprendre exactement là où vous vous étiez arrêté.</p>
        <p style="margin: 0 0 24px;"><a href="${targetUrl}" style="background: #0f5ea8; color: white; text-decoration: none; padding: 12px 18px; border-radius: 8px; display: inline-block;">Reprendre mon test</a></p>
        <p style="margin: 0; color: #475569;">Si le rythme dépend de l'autre testeur, il est normal d'attendre certaines étapes le temps qu'il avance lui aussi.</p>
      </div>
    `,
    textBody: [
      'Votre test peut reprendre.',
      `Le blocage rencontré pendant le test "${safeScenarioTitle}" a été corrigé.`,
      `Revenez sur ${targetUrl} pour reprendre exactement là où vous vous étiez arrêté.`
    ].join('\n')
  };
};

const SeancesTab = () => {
  const [seances, setSeances] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [filtre, setFiltre] = useState('all');
  const [actionSessionId, setActionSessionId] = useState(null);

  useEffect(() => {
    chargerSeances();
  }, []);

  const chargerSeances = async () => {
    setChargement(true);
    const { data } = await userTestingService?.getAllSessions();
    setSeances(data || []);
    setChargement(false);
  };

  const seancesFiltrees = seances?.filter((seance) => {
    if (filtre === 'all') return true;
    return seance?.status === filtre;
  });

  const calculerDuree = (seance) => {
    if (!seance?.started_at) return 'N/D';
    const debut = new Date(seance?.started_at);
    const fin = seance?.completed_at
      ? new Date(seance?.completed_at)
      : seance?.paused_at
        ? new Date(seance?.paused_at)
        : new Date();
    const minutes = Math.floor((fin - debut) / 60000);
    return `${minutes} min`;
  };

  const exporterCsv = () => {
    const enTetes = ['Participant', 'Parcours', 'Statut', 'Duree', 'Debut', 'Fin'];
    const lignes = seancesFiltrees?.map((seance) => [
      seance?.tester?.email || 'N/D',
      seance?.scenario?.title || 'N/D',
      obtenirLibelleStatut(seance?.status),
      calculerDuree(seance),
      new Date(seance?.started_at)?.toLocaleString(),
      seance?.completed_at ? new Date(seance?.completed_at)?.toLocaleString() : 'En cours'
    ]);

    const csv = [enTetes, ...lignes]?.map((ligne) => ligne?.join(','))?.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `seances-${new Date()?.toISOString()}.csv`;
    lien?.click();
  };

  const mettreEnPause = async (seance) => {
    if (!seance?.id) return;

    const raison = window.prompt(
      'Pourquoi mettez-vous ce test en pause ?',
      seance?.pause_reason || 'Blocage à corriger avant reprise'
    );

    if (raison === null) return;

    setActionSessionId(seance?.id);
    const { data, error } = await userTestingService?.pauseSessionAsAdmin(seance?.id, raison);
    setActionSessionId(null);

    if (error) {
      toast?.error('Impossible de mettre ce test en pause.');
      return;
    }

    await chargerSeances();
    const pausedCount = Number(data?.pausedCount || 0);
    toast?.success(
      pausedCount > 1
        ? `${pausedCount} sessions du binome ont ete mises en pause.`
        : 'Le test a ete mis en pause.'
    );
  };

  const autoriserRepriseEtNotifier = async (seance) => {
    if (!seance?.id) return;

    setActionSessionId(seance?.id);
    const { data, error } = await userTestingService?.markPausedSessionReadyForResume(seance?.id);

    if (error) {
      setActionSessionId(null);
      toast?.error("Impossible d'autoriser la reprise de ce test.");
      return;
    }

    const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
    const appUrl = window.location?.origin || '';
    const emailResults = await Promise.allSettled(
      sessions
        .filter((session) => String(session?.testerEmail || '').trim())
        .map((session) => {
          const emailPayload = construireContenuMailReprise({
            scenarioTitle: session?.scenarioTitle,
            appUrl
          });

          return sendEmail({
            to: session?.testerEmail,
            subject: emailPayload.subject,
            htmlBody: emailPayload.htmlBody,
            textBody: emailPayload.textBody
          });
        })
    );

    setActionSessionId(null);
    await chargerSeances();

    const failedEmails = emailResults.filter((result) => {
      if (result?.status !== 'fulfilled') return true;
      return result?.value?.success === false;
    });

    if (failedEmails.length > 0) {
      toast?.error("La reprise est autorisée, mais au moins un e-mail n'a pas pu être envoyé.");
      return;
    }

    const sessionCount = sessions.length;
    toast?.success(
      sessionCount > 1
        ? `La reprise est autorisée et les ${sessionCount} testeurs ont été prévenus par e-mail.`
        : 'La reprise est autorisée et le testeur a été prévenu par e-mail.'
    );
  };

  if (chargement) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-2">
          {['all', 'pending', 'in_progress', 'paused', 'completed']?.map((statut) => (
            <button
              key={statut}
              onClick={() => setFiltre(statut)}
              className={`rounded-lg px-4 py-2 font-medium transition-colors ${
                filtre === statut
                  ? 'bg-primary text-white'
                  : 'bg-white text-surface-foreground hover:bg-surface'
              }`}
            >
              {obtenirLibelleStatut(statut)}
            </button>
          ))}
        </div>
        <button
          onClick={exporterCsv}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
        >
          <Download className="h-4 w-4" />
          Exporter CSV
        </button>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-surface">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Participant</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Parcours</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Statut</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Duree</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Debut</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Contexte</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {seancesFiltrees?.map((seance) => (
              <tr key={seance?.id} className="hover:bg-surface">
                <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">
                  {seance?.tester?.email || 'N/D'}
                </td>
                <td className="px-6 py-4 text-sm text-foreground">
                  {seance?.scenario?.title || 'N/D'}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                    seance?.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : seance?.status === 'paused'
                        ? 'bg-amber-100 text-amber-900'
                      : seance?.status === 'in_progress'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-surface-foreground'
                  }`}>
                    {seance?.status === 'completed' && <CheckCircle className="h-3 w-3" />}
                    {seance?.status === 'in_progress' && <Clock className="h-3 w-3" />}
                    {seance?.status === 'paused' && <PauseCircle className="h-3 w-3" />}
                    {obtenirLibelleStatut(seance?.status)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">
                  {calculerDuree(seance)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                  {new Date(seance?.started_at)?.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  <div>{seance?.tester?.system} / {seance?.tester?.screen_type} / {seance?.tester?.browser}</div>
                  {seance?.pause_reason && (
                    <div className="mt-1 text-xs text-amber-900">
                      Pause : {seance?.pause_reason}
                    </div>
                  )}
                  {seance?.resume_ready_at && (
                    <div className="mt-1 text-xs text-green-800">
                      Reprise autorisée le {new Date(seance?.resume_ready_at)?.toLocaleString()}
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">
                  <div className="flex flex-wrap gap-2">
                    {seance?.status === 'in_progress' && (
                      <button
                        onClick={() => mettreEnPause(seance)}
                        disabled={actionSessionId === seance?.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <PauseCircle className="h-4 w-4" />
                        {actionSessionId === seance?.id ? 'Pause...' : 'Mettre en pause'}
                      </button>
                    )}

                    {seance?.status === 'paused' && (
                      <button
                        onClick={() => autoriserRepriseEtNotifier(seance)}
                        disabled={actionSessionId === seance?.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-900 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actionSessionId === seance?.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Mail className="h-4 w-4" />
                        )}
                        {seance?.resume_ready_at
                          ? 'Renvoyer le mail'
                          : 'Autoriser la reprise + mail'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SeancesTab;



