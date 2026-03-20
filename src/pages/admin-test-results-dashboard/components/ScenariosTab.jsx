import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Edit, Layers, Plus, RotateCcw, Trash2 } from 'lucide-react';

import userTestingService from '../../../services/userTestingService';
import {
  getTestProgramFamilyMeta,
  TEST_PROGRAM_FAMILIES,
  TEST_PROGRAM_TOTAL_STEPS
} from '../../../utils/testingProgram';

const buildEmptyForm = () => ({
  title: '',
  objective: '',
  expectedResult: '',
  instructions: '',
  pages: [],
  isActive: true,
  programFamily: '',
  mirrorGroupKey: '',
  mirrorRole: ''
});

const familyOptions = TEST_PROGRAM_FAMILIES.map((family) => ({
  value: family,
  ...getTestProgramFamilyMeta(family)
}));

const ScenariosTab = () => {
  const [scenarios, setScenarios] = useState([]);
  const [campaignSummary, setCampaignSummary] = useState({ campaign: null, rounds: [] });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingScenario, setEditingScenario] = useState(null);
  const [saving, setSaving] = useState(false);
  const [startingNewCampaign, setStartingNewCampaign] = useState(false);
  const [formData, setFormData] = useState(buildEmptyForm());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const { data: scenariosData } = await userTestingService?.getAllScenarios();
    const { data: campaignData } = await userTestingService?.getCurrentMirrorCampaignSummary();

    setScenarios(scenariosData || []);
    setCampaignSummary(campaignData || { campaign: null, rounds: [] });
    setLoading(false);
  };

  const handleOpenModal = (scenario = null) => {
    if (scenario) {
      setEditingScenario(scenario);
      setFormData({
        title: scenario?.title || '',
        objective: scenario?.objective || '',
        expectedResult: scenario?.expected_result || '',
        instructions: scenario?.instructions || '',
        pages: scenario?.pages || [],
        isActive: scenario?.is_active !== false,
        programFamily: scenario?.program_family || '',
        mirrorGroupKey: scenario?.mirror_group_key || '',
        mirrorRole: scenario?.mirror_role || ''
      });
    } else {
      setEditingScenario(null);
      setFormData(buildEmptyForm());
    }

    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData?.title?.trim() || !formData?.objective?.trim()) {
      toast?.error('Le titre et l objectif sont obligatoires.');
      return;
    }

    const hasMirrorGroup = Boolean(formData?.mirrorGroupKey?.trim());
    const hasMirrorRole = Boolean(formData?.mirrorRole);
    const hasProgramFamily = Boolean(formData?.programFamily);

    if (hasMirrorGroup !== hasMirrorRole) {
      toast?.error('Renseignez a la fois le groupe miroir et la place du parcours dans le binome.');
      return;
    }

    if (hasProgramFamily && (!hasMirrorGroup || !hasMirrorRole)) {
      toast?.error('Un parcours place dans le protocole principal doit aussi avoir son binome miroir complet.');
      return;
    }

    if (!hasProgramFamily && (hasMirrorGroup || hasMirrorRole)) {
      toast?.error('Choisissez d abord la famille de test avant de rattacher le parcours a un binome miroir.');
      return;
    }

    setSaving(true);

    if (editingScenario) {
      await userTestingService?.updateScenario(editingScenario?.id, formData);
    } else {
      await userTestingService?.createScenario(formData);
    }

    setSaving(false);
    setShowModal(false);
    setFormData(buildEmptyForm());
    await loadData();
    toast?.success(editingScenario ? 'Parcours mis a jour.' : 'Parcours cree.');
  };

  const handleDelete = async (scenarioId) => {
    if (!confirm('Etes-vous sur de vouloir supprimer ce parcours ?')) return;

    await userTestingService?.deleteScenario(scenarioId);
    await loadData();
    toast?.success('Parcours supprime.');
  };

  const handleStartNewCampaign = async () => {
    if (!confirm('Ouvrir une nouvelle vague remet les choix de reference a zero. Continuer ?')) {
      return;
    }

    setStartingNewCampaign(true);
    const { error } = await userTestingService?.startNewMirrorCampaign();
    setStartingNewCampaign(false);

    if (error) {
      toast?.error('Impossible d ouvrir une nouvelle vague.');
      return;
    }

    await loadData();
    toast?.success('Nouvelle vague miroir ouverte.');
  };

  const addPage = () => {
    setFormData((previous) => ({
      ...previous,
      pages: [
        ...previous?.pages,
        {
          url: '',
          title: '',
          required: true,
          order: previous?.pages?.length + 1,
          coherence_question: '',
          exit_questions: []
        }
      ]
    }));
  };

  const updatePage = (index, field, value) => {
    setFormData((previous) => ({
      ...previous,
      pages: previous?.pages?.map((page, pageIndex) => (
        pageIndex === index ? { ...page, [field]: value } : page
      ))
    }));
  };

  const removePage = (index) => {
    setFormData((previous) => ({
      ...previous,
      pages: previous?.pages?.filter((_, pageIndex) => pageIndex !== index)?.map((page, pageIndex) => ({
        ...page,
        order: pageIndex + 1
      }))
    }));
  };

  const rounds = campaignSummary?.rounds || [];
  const scenarioById = scenarios?.reduce((accumulator, scenario) => {
    accumulator[scenario?.id] = scenario;
    return accumulator;
  }, {});
  const activeReferenceScenarios = scenarios?.filter((scenario) => (
    scenario?.is_active &&
    scenario?.mirror_role === 'reference' &&
    scenario?.program_family &&
    scenario?.mirror_group_key
  ));
  const protocolRounds = rounds?.filter((round) => {
    const scenario = scenarioById?.[round?.reference_scenario_id];
    return Boolean(round?.program_family || scenario?.program_family);
  });
  const remainingReferenceCount = Math.max(activeReferenceScenarios?.length - protocolRounds?.length, 0);
  const pendingMirrorCount = protocolRounds?.filter((round) => !round?.mirror_tester_id)?.length;
  const familyStats = familyOptions.map((family) => {
    const referenceScenarios = activeReferenceScenarios?.filter((scenario) => (
      scenario?.program_family === family?.value
    ));
    const familyRounds = rounds?.filter((round) => {
      const scenario = scenarioById?.[round?.reference_scenario_id];
      return (round?.program_family || scenario?.program_family) === family?.value;
    });

    return {
      ...family,
      usedCount: familyRounds?.length,
      remainingCount: Math.max(referenceScenarios?.length - familyRounds?.length, 0),
      pendingCount: familyRounds?.filter((round) => !round?.mirror_tester_id)?.length
    };
  });

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Organisation miroir en cours</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {campaignSummary?.campaign?.label || 'Vague en cours'} : chaque testeur passe{' '}
              {TEST_PROGRAM_TOTAL_STEPS} tests obligatoires. Dans chaque famille, un participant
              choisit la reference libre, puis le suivant recoit automatiquement son miroir.
            </p>
          </div>

          <button
            onClick={handleStartNewCampaign}
            disabled={startingNewCampaign}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw className="w-4 h-4" />
            {startingNewCampaign ? 'Ouverture en cours...' : 'Ouvrir une nouvelle vague'}
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mt-6">
          <div className="rounded-lg bg-surface p-4">
            <p className="text-sm text-muted-foreground mb-1">Parcours de reference deja pris</p>
            <p className="text-2xl font-bold text-foreground">{protocolRounds?.length}</p>
          </div>
          <div className="rounded-lg bg-surface p-4">
            <p className="text-sm text-muted-foreground mb-1">Parcours de reference encore libres</p>
            <p className="text-2xl font-bold text-foreground">{remainingReferenceCount}</p>
          </div>
          <div className="rounded-lg bg-surface p-4">
            <p className="text-sm text-muted-foreground mb-1">Miroirs en attente d attribution</p>
            <p className="text-2xl font-bold text-foreground">{pendingMirrorCount}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mt-4">
          {familyStats.map((family) => (
            <div key={family?.value} className="rounded-lg border border-border bg-white p-4">
              <p className="text-sm font-semibold text-foreground">{family?.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{family?.description}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-surface p-2">
                  <p className="text-xs text-muted-foreground">Pris</p>
                  <p className="text-lg font-bold text-foreground">{family?.usedCount}</p>
                </div>
                <div className="rounded-md bg-surface p-2">
                  <p className="text-xs text-muted-foreground">Libres</p>
                  <p className="text-lg font-bold text-foreground">{family?.remainingCount}</p>
                </div>
                <div className="rounded-md bg-surface p-2">
                  <p className="text-xs text-muted-foreground">Miroirs</p>
                  <p className="text-lg font-bold text-foreground">{family?.pendingCount}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Gestion des parcours</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {scenarios?.filter((scenario) => scenario?.is_active)?.length} parcours actifs sur {scenarios?.length} total
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          Nouveau parcours
        </button>
      </div>

      <div className="grid gap-4">
        {scenarios?.map((scenario) => (
          <div key={scenario?.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-foreground">{scenario?.title}</h3>
                  {scenario?.is_active ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                      <Eye className="w-3 h-3" /> Actif
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted text-surface-foreground rounded-full text-xs font-medium">
                      <EyeOff className="w-3 h-3" /> Inactif
                    </span>
                  )}
                  {scenario?.mirror_role && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                      {scenario?.mirror_role === 'reference' ? 'Reference' : 'Miroir'}
                    </span>
                  )}
                  {scenario?.program_family && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-violet-100 text-violet-900 rounded-full text-xs font-medium">
                      {getTestProgramFamilyMeta(scenario?.program_family)?.label}
                    </span>
                  )}
                  {scenario?.mirror_group_key && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-medium">
                      Binome : {scenario?.mirror_group_key}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground mb-2">{scenario?.objective}</p>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span>{scenario?.pages?.length || 0} etapes</span>
                  <span>{scenario?.pages?.filter((page) => page?.required)?.length || 0} obligatoires</span>
                  {!scenario?.program_family || !scenario?.mirror_group_key || !scenario?.mirror_role ? (
                    <span className="text-amber-700">
                      Ce parcours ne peut pas encore entrer dans le protocole automatique des{' '}
                      {TEST_PROGRAM_TOTAL_STEPS} tests.
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenModal(scenario)}
                  className="p-2 text-primary hover:bg-primary/10 rounded-lg"
                  title="Editer"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(scenario?.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {scenarios?.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-muted-foreground">Aucun parcours disponible.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-foreground mb-4">
              {editingScenario ? 'Editer le parcours' : 'Nouveau parcours'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-foreground mb-1">
                  Titre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData?.title}
                  onChange={(event) => setFormData((previous) => ({ ...previous, title: event?.target?.value }))}
                  className="w-full border border-border rounded-lg p-2 focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-foreground mb-1">
                  Objectif <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData?.objective}
                  onChange={(event) => setFormData((previous) => ({ ...previous, objective: event?.target?.value }))}
                  className="w-full border border-border rounded-lg p-2 min-h-[80px] focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-surface-foreground mb-1">
                    Famille de test
                  </label>
                  <select
                    value={formData?.programFamily}
                    onChange={(event) => setFormData((previous) => ({ ...previous, programFamily: event?.target?.value }))}
                    className="w-full border border-border rounded-lg p-2 focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Hors protocole principal</option>
                    {familyOptions.map((family) => (
                      <option key={family?.value} value={family?.value}>
                        {family?.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Utilisez cette liste pour indiquer si le parcours sert au test abouti, a
                    l echec cote locataire, a l echec cote proprietaire ou aux incidents
                    transverses.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-foreground mb-1">
                    Nom du binome miroir
                  </label>
                  <input
                    type="text"
                    placeholder="ex. reservation-comparaison-1"
                    value={formData?.mirrorGroupKey}
                    onChange={(event) => setFormData((previous) => ({ ...previous, mirrorGroupKey: event?.target?.value }))}
                    className="w-full border border-border rounded-lg p-2 focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Donnez exactement le meme nom aux deux parcours qui doivent aller ensemble.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-foreground mb-1">
                    Place du parcours dans le binome
                  </label>
                  <select
                    value={formData?.mirrorRole}
                    onChange={(event) => setFormData((previous) => ({ ...previous, mirrorRole: event?.target?.value }))}
                    className="w-full border border-border rounded-lg p-2 focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Aucune</option>
                    <option value="reference">Parcours de reference</option>
                    <option value="mirror">Parcours miroir</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Le parcours de reference est celui que choisit le participant libre. Le parcours
                    miroir est attribue automatiquement au participant suivant.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-foreground mb-1">
                  Resultat attendu
                </label>
                <textarea
                  value={formData?.expectedResult}
                  onChange={(event) => setFormData((previous) => ({ ...previous, expectedResult: event?.target?.value }))}
                  className="w-full border border-border rounded-lg p-2 min-h-[60px] focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-foreground mb-1">
                  Consignes
                </label>
                <textarea
                  value={formData?.instructions}
                  onChange={(event) => setFormData((previous) => ({ ...previous, instructions: event?.target?.value }))}
                  className="w-full border border-border rounded-lg p-2 min-h-[60px] focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-surface-foreground">
                    Etapes du parcours
                  </label>
                  <button
                    onClick={addPage}
                    className="text-sm text-primary hover:text-[#0d7b88] font-medium"
                  >
                    + Ajouter une etape
                  </button>
                </div>
                <div className="space-y-3">
                  {formData?.pages?.map((page, index) => (
                    <div key={index} className="border border-border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium text-surface-foreground">Etape {index + 1}</span>
                        <button
                          onClick={() => removePage(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="URL (ex: /accueil-recherche)"
                          value={page?.url}
                          onChange={(event) => updatePage(index, 'url', event?.target?.value)}
                          className="border border-border rounded p-2 text-sm"
                        />
                        <input
                          type="text"
                          placeholder="Titre de la page"
                          value={page?.title}
                          onChange={(event) => updatePage(index, 'title', event?.target?.value)}
                          className="border border-border rounded p-2 text-sm"
                        />
                      </div>
                      <div className="mt-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={page?.required}
                            onChange={(event) => updatePage(index, 'required', event?.target?.checked)}
                            className="rounded"
                          />
                          <span className="text-sm text-surface-foreground">Etape obligatoire</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData?.isActive}
                    onChange={(event) => setFormData((previous) => ({ ...previous, isActive: event?.target?.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-surface-foreground">Parcours actif</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSave}
                disabled={saving || !formData?.title?.trim() || !formData?.objective?.trim()}
                className="flex-1 bg-primary text-white py-2 px-4 rounded-lg hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed"
              >
                {saving ? 'Enregistrement...' : editingScenario ? 'Mettre a jour' : 'Creer'}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-border text-surface-foreground py-2 px-4 rounded-lg hover:bg-muted"
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

export default ScenariosTab;
