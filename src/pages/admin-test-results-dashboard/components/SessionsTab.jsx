import React, { useEffect, useState } from 'react';
import { CheckCircle, Clock, Download } from 'lucide-react';

import userTestingService from '../../../services/userTestingService';

const obtenirLibelleStatut = (statut) => {
  switch (statut) {
    case 'all':
      return 'Toutes';
    case 'pending':
      return 'En attente';
    case 'in_progress':
      return 'En cours';
    case 'completed':
      return 'Terminee';
    default:
      return statut;
  }
};

const SeancesTab = () => {
  const [seances, setSeances] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [filtre, setFiltre] = useState('all');

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
    const fin = seance?.completed_at ? new Date(seance?.completed_at) : new Date();
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
          {['all', 'pending', 'in_progress', 'completed']?.map((statut) => (
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
                      : seance?.status === 'in_progress'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-surface-foreground'
                  }`}>
                    {seance?.status === 'completed' && <CheckCircle className="h-3 w-3" />}
                    {seance?.status === 'in_progress' && <Clock className="h-3 w-3" />}
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
                  {seance?.tester?.system} / {seance?.tester?.screen_type} / {seance?.tester?.browser}
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


