import React, { useEffect, useState } from 'react';
import { AlertCircle, Download, ThumbsUp } from 'lucide-react';

import userTestingService from '../../../services/userTestingService';

const ComptesRendusTab = () => {
  const [comptesRendus, setComptesRendus] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    chargerComptesRendus();
  }, []);

  const chargerComptesRendus = async () => {
    setChargement(true);
    const { data } = await userTestingService?.getAllDebriefs();
    setComptesRendus(data || []);
    setChargement(false);
  };

  const exporterCsv = () => {
    const enTetes = ['Participant', 'Parcours', 'Clair', 'Bloquant', 'Confiance', 'Notes', 'Date'];
    const lignes = comptesRendus?.map((compteRendu) => [
      compteRendu?.session?.tester?.email || 'N/D',
      compteRendu?.session?.scenario?.title || 'N/D',
      compteRendu?.what_was_clear || '',
      compteRendu?.what_blocked || '',
      compteRendu?.confidence_level || '',
      compteRendu?.notes || '',
      new Date(compteRendu?.created_at)?.toLocaleString()
    ]);

    const csv = [enTetes, ...lignes]?.map((ligne) => ligne?.join(','))?.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `comptes-rendus-${new Date()?.toISOString()}.csv`;
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
          <h2 className="text-xl font-semibold text-foreground">Comptes rendus de seance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Retours à chaud des participants après complétion des parcours
          </p>
        </div>
        <button
          onClick={exporterCsv}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
        >
          <Download className="h-4 w-4" />
          Exporter CSV
        </button>
      </div>

      <div className="space-y-6">
        {comptesRendus?.map((compteRendu) => (
          <div key={compteRendu?.id} className="rounded-lg bg-white p-6 shadow">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {compteRendu?.session?.scenario?.title || 'Parcours inconnu'}
                </h3>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Participant: {compteRendu?.session?.tester?.email || 'N/D'}</span>
                  <span>|</span>
                  <span>{compteRendu?.session?.tester?.system} / {compteRendu?.session?.tester?.screen_type}</span>
                  <span>|</span>
                  <span>{new Date(compteRendu?.created_at)?.toLocaleDateString()}</span>
                </div>
              </div>
              {compteRendu?.confidence_level && (
                <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  {compteRendu?.confidence_level}
                </span>
              )}
            </div>

            <div className="mb-4 grid gap-4 md:grid-cols-2">
              {compteRendu?.what_was_clear && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4 text-green-600" />
                    <h4 className="font-medium text-green-900">Ce qui etait clair</h4>
                  </div>
                  <p className="text-sm text-green-700">{compteRendu?.what_was_clear}</p>
                </div>
              )}

              {compteRendu?.what_blocked && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <h4 className="font-medium text-red-900">Ce qui a bloque</h4>
                  </div>
                  <p className="text-sm text-red-700">{compteRendu?.what_blocked}</p>
                </div>
              )}
            </div>

            {compteRendu?.notes && (
              <div className="rounded-lg border border-border bg-surface p-4">
                <h4 className="mb-2 font-medium text-foreground">Notes complementaires</h4>
                <p className="text-sm text-surface-foreground">{compteRendu?.notes}</p>
              </div>
            )}
          </div>
        ))}

        {comptesRendus?.length === 0 && (
          <div className="rounded-lg bg-white p-12 text-center shadow">
            <p className="text-muted-foreground">Aucun compte rendu disponible</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComptesRendusTab;


