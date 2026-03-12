import React, { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, Download, Info } from 'lucide-react';

import userTestingService from '../../../services/userTestingService';

const obtenirLibelleGravite = (gravite) => {
  switch (gravite) {
    case 'critical':
      return 'Critique';
    case 'high':
      return 'Elevee';
    case 'medium':
      return 'Moyenne';
    case 'low':
      return 'Faible';
    case 'all':
      return 'Toutes';
    default:
      return gravite;
  }
};

const obtenirIconeGravite = (gravite) => {
  switch (gravite) {
    case 'critical':
      return <AlertTriangle className="h-5 w-5 text-red-600" />;
    case 'high':
      return <AlertCircle className="h-5 w-5 text-orange-600" />;
    case 'medium':
      return <AlertCircle className="h-5 w-5 text-yellow-600" />;
    case 'low':
      return <Info className="h-5 w-5 text-primary" />;
    default:
      return null;
  }
};

const obtenirCouleurGravite = (gravite) => {
  switch (gravite) {
    case 'critical':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low':
      return 'bg-primary/10 text-primary border-primary/25';
    default:
      return 'bg-muted text-surface-foreground border-border';
  }
};

const SignalementsTab = () => {
  const [signalements, setSignalements] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [filtreGravite, setFiltreGravite] = useState('all');
  const [signalementSelectionne, setSignalementSelectionne] = useState(null);

  useEffect(() => {
    chargerSignalements();
  }, []);

  const chargerSignalements = async () => {
    setChargement(true);
    const { data } = await userTestingService?.getAllReports();
    setSignalements(data || []);
    setChargement(false);
  };

  const signalementsFiltres = filtreGravite === 'all'
    ? signalements
    : signalements?.filter((signalement) => signalement?.severity === filtreGravite);

  const exporterCsv = () => {
    const enTetes = ['Gravite', 'Page', 'Description', 'Participant', 'Parcours', 'Date'];
    const lignes = signalementsFiltres?.map((signalement) => [
      obtenirLibelleGravite(signalement?.severity),
      signalement?.page_url,
      signalement?.description,
      signalement?.session?.tester?.email || 'N/D',
      signalement?.session?.scenario?.title || 'N/D',
      new Date(signalement?.created_at)?.toLocaleString()
    ]);

    const csv = [enTetes, ...lignes]?.map((ligne) => ligne?.join(','))?.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `signalements-${new Date()?.toISOString()}.csv`;
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
          {['all', 'critical', 'high', 'medium', 'low']?.map((gravite) => (
            <button
              key={gravite}
              onClick={() => setFiltreGravite(gravite)}
              className={`rounded-lg px-4 py-2 font-medium transition-colors ${
                filtreGravite === gravite
                  ? 'bg-primary text-white'
                  : 'bg-white text-surface-foreground hover:bg-surface'
              }`}
            >
              {obtenirLibelleGravite(gravite)}
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

      <div className="grid gap-4">
        {signalementsFiltres?.map((signalement) => (
          <div
            key={signalement?.id}
            className="cursor-pointer rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-lg"
            onClick={() => setSignalementSelectionne(signalement)}
          >
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                {obtenirIconeGravite(signalement?.severity)}
              </div>
              <div className="flex-1">
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <span className={`inline-block rounded border px-2 py-1 text-xs font-medium ${obtenirCouleurGravite(signalement?.severity)}`}>
                      {obtenirLibelleGravite(signalement?.severity)}
                    </span>
                    <h3 className="mt-2 text-lg font-semibold text-foreground">{signalement?.page_url}</h3>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {new Date(signalement?.created_at)?.toLocaleDateString()}
                  </span>
                </div>
                <p className="mb-3 text-surface-foreground">{signalement?.description}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Participant: {signalement?.session?.tester?.email || 'N/D'}</span>
                  <span>|</span>
                  <span>Parcours: {signalement?.session?.scenario?.title || 'N/D'}</span>
                  {signalement?.screenshot_urls?.length > 0 && (
                    <>
                      <span>|</span>
                      <span>{signalement?.screenshot_urls?.length} capture(s)</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {signalementsFiltres?.length === 0 && (
          <div className="rounded-lg bg-white p-12 text-center shadow">
            <p className="text-muted-foreground">Aucun signalement disponible</p>
          </div>
        )}
      </div>

      {signalementSelectionne && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <span className={`inline-block rounded border px-2 py-1 text-xs font-medium ${obtenirCouleurGravite(signalementSelectionne?.severity)}`}>
                  {obtenirLibelleGravite(signalementSelectionne?.severity)}
                </span>
                <h2 className="mt-2 text-2xl font-bold text-foreground">{signalementSelectionne?.page_url}</h2>
              </div>
              <button
                onClick={() => setSignalementSelectionne(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                X
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="mb-1 text-sm font-medium text-surface-foreground">Description</h3>
                <p className="text-foreground">{signalementSelectionne?.description}</p>
              </div>

              {signalementSelectionne?.reproduction_steps && (
                <div>
                  <h3 className="mb-1 text-sm font-medium text-surface-foreground">Etapes de reproduction</h3>
                  <p className="whitespace-pre-wrap text-foreground">{signalementSelectionne?.reproduction_steps}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h3 className="mb-1 font-medium text-surface-foreground">Participant</h3>
                  <p className="text-foreground">{signalementSelectionne?.session?.tester?.email || 'N/D'}</p>
                </div>
                <div>
                  <h3 className="mb-1 font-medium text-surface-foreground">Parcours</h3>
                  <p className="text-foreground">{signalementSelectionne?.session?.scenario?.title || 'N/D'}</p>
                </div>
              </div>

              {signalementSelectionne?.screenshot_urls?.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-surface-foreground">Captures d'ecran</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {signalementSelectionne?.screenshot_urls?.map((url, index) => (
                      <img
                        key={index}
                        src={url}
                        alt={`Capture d'ecran ${index + 1}`}
                        className="h-48 w-full rounded-lg border border-border object-cover"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignalementsTab;


