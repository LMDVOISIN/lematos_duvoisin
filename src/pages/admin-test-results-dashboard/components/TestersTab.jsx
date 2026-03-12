import React, { useEffect, useState } from 'react';
import { Download, UserCheck, UserPlus, UserX } from 'lucide-react';

import userTestingService from '../../../services/userTestingService';

const ParticipantsTab = () => {
  const [participants, setParticipants] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [afficherFenetreAjout, setAfficherFenetreAjout] = useState(false);
  const [nouvelEmailParticipant, setNouvelEmailParticipant] = useState('');
  const [nouveauGroupeProtocole, setNouveauGroupeProtocole] = useState('');

  useEffect(() => {
    chargerParticipants();
  }, []);

  const chargerParticipants = async () => {
    setChargement(true);
    const { data } = await userTestingService?.getAllTesters();
    setParticipants(data || []);
    setChargement(false);
  };

  const ajouterParticipant = async () => {
    if (!nouvelEmailParticipant?.trim()) return;

    await userTestingService?.createTester({
      email: nouvelEmailParticipant,
      protocolGroup: nouveauGroupeProtocole
    });

    setNouvelEmailParticipant('');
    setNouveauGroupeProtocole('');
    setAfficherFenetreAjout(false);
    chargerParticipants();
  };

  const basculerStatutParticipant = async (participantId, statutActuel) => {
    await userTestingService?.toggleTesterStatus(participantId, !statutActuel);
    chargerParticipants();
  };

  const exporterCsv = () => {
    const enTetes = ['E-mail', 'Protocole', 'Systeme', 'Ecran', 'Navigateur', 'Statut', 'Date de creation'];
    const lignes = participants?.map((participant) => [
      participant?.email,
      participant?.protocol_group || '',
      participant?.system || '',
      participant?.screen_type || '',
      participant?.browser || '',
      participant?.is_active ? 'Actif' : 'Inactif',
      new Date(participant?.created_at)?.toLocaleString()
    ]);

    const csv = [enTetes, ...lignes]?.map((ligne) => ligne?.join(','))?.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `participants-${new Date()?.toISOString()}.csv`;
    lien?.click();
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
        <div>
          <h2 className="text-xl font-semibold text-foreground">Gestion des participants</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {participants?.filter((participant) => participant?.is_active)?.length} participants actifs sur {participants?.length} au total
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setAfficherFenetreAjout(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90"
          >
            <UserPlus className="h-4 w-4" />
            Ajouter un participant
          </button>
          <button
            onClick={exporterCsv}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
          >
            <Download className="h-4 w-4" />
            Exporter CSV
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-surface">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">E-mail</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Protocole</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Contexte</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Statut</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {participants?.map((participant) => (
              <tr key={participant?.id} className="hover:bg-surface">
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-foreground">
                  {participant?.email}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                  {participant?.protocol_group || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">
                  {participant?.system && participant?.screen_type && participant?.browser
                    ? `${participant?.system} / ${participant?.screen_type} / ${participant?.browser}`
                    : 'Non renseigne'}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                    participant?.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-muted text-surface-foreground'
                  }`}>
                    {participant?.is_active ? (
                      <>
                        <UserCheck className="h-3 w-3" /> Actif
                      </>
                    ) : (
                      <>
                        <UserX className="h-3 w-3" /> Inactif
                      </>
                    )}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <button
                    onClick={() => basculerStatutParticipant(participant?.id, participant?.is_active)}
                    className={`rounded-lg px-3 py-1 font-medium transition-colors ${
                      participant?.is_active
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {participant?.is_active ? 'Désactiver' : 'Activer'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {afficherFenetreAjout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-4 text-xl font-semibold text-foreground">Ajouter un participant</h3>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-surface-foreground">
                  E-mail <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={nouvelEmailParticipant}
                  onChange={(event) => setNouvelEmailParticipant(event?.target?.value)}
                  placeholder="participant@example.com"
                  className="w-full rounded-lg border border-border p-2 focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-surface-foreground">
                  Groupe de protocole (facultatif)
                </label>
                <input
                  type="text"
                  value={nouveauGroupeProtocole}
                  onChange={(event) => setNouveauGroupeProtocole(event?.target?.value)}
                  placeholder="groupe_a"
                  className="w-full rounded-lg border border-border p-2 focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={ajouterParticipant}
                disabled={!nouvelEmailParticipant?.trim()}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted"
              >
                Ajouter
              </button>
              <button
                onClick={() => {
                  setAfficherFenetreAjout(false);
                  setNouvelEmailParticipant('');
                  setNouveauGroupeProtocole('');
                }}
                className="flex-1 rounded-lg bg-border px-4 py-2 text-surface-foreground hover:bg-muted"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParticipantsTab;

