import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Edit, Layers, Plus, RotateCcw, Trash2 } from 'lucide-react';

import userTestingService from '../../../services/userTestingService';
import {
  getTestProgramFamilyMeta,
  TEST_PROGRAM_FAMILIES,
  TEST_PROGRAM_TOTAL_STEPS
} from '../../../utils/testingProgram';
import {
  getTestingScenarioBrief,
  getTestingScenarioProtocolTags
} from '../../../utils/testingScenarioBriefs';
import ScenarioInstructionsModal from '../../../components/TestModeLayout/components/ScenarioInstructionsModal';

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

const splitQuestionLines = (value = '') =>
  String(value || '')
    .split(/\r?\n/)
    .map((line) => String(line || '').trim())
    .filter(Boolean);

const joinQuestionLines = (questions = []) =>
  (Array.isArray(questions) ? questions : [])
    .map((question) => {
      if (typeof question === 'string') return question;
      return String(question?.label || question?.question || '').trim();
    })
    .filter(Boolean)
    .join('\n');

const familyOptions = TEST_PROGRAM_FAMILIES.map((family) => ({
  value: family,
  ...getTestProgramFamilyMeta(family)
}));

const getScenarioAdminLabel = (scenario = {}) =>
  getTestingScenarioBrief(scenario)?.participantTitle || scenario?.title || 'Parcours';

const buildPairingDraft = (scenarios = []) => {
  const draft = TEST_PROGRAM_FAMILIES.reduce((accumulator, family) => ({
    ...accumulator,
    [family]: {}
  }), {});

  const familyScenarios = (Array.isArray(scenarios) ? scenarios : []).filter((scenario) => (
    scenario?.is_active && scenario?.program_family && TEST_PROGRAM_FAMILIES.includes(scenario.program_family)
  ));

  familyScenarios.forEach((scenario) => {
    draft[scenario.program_family] = {
      ...(draft?.[scenario.program_family] || {}),
      [scenario.id]: ''
    };
  });

  familyScenarios.forEach((scenario) => {
    if (scenario?.mirror_role !== 'reference' || !scenario?.mirror_group_key || !scenario?.program_family) {
      return;
    }

    const pairedMirror = familyScenarios.find((candidate) => (
      candidate?.id !== scenario?.id
      && candidate?.program_family === scenario?.program_family
      && candidate?.mirror_role === 'mirror'
      && candidate?.mirror_group_key === scenario?.mirror_group_key
    ));

    if (!pairedMirror?.id) return;

    draft[scenario.program_family] = {
      ...(draft?.[scenario.program_family] || {}),
      [scenario.id]: pairedMirror.id
    };
  });

  return draft;
};

const buildMirrorGroupKey = (family, mirrorScenarioId) =>
  `admin_${family}_${String(mirrorScenarioId || '').replace(/[^a-z0-9]/gi, '').slice(0, 12)}`;

const buildFamilyPairings = (familyScenarios = [], familyDraft = {}) => {
  const pairings = Object.entries(familyDraft || {})
    .filter(([, mirrorId]) => Boolean(mirrorId))
    .map(([referenceId, mirrorId]) => ({
      referenceScenario: familyScenarios.find((scenario) => scenario.id === referenceId),
      mirrorScenario: familyScenarios.find((scenario) => scenario.id === mirrorId)
    }))
    .filter(({ referenceScenario, mirrorScenario }) => referenceScenario && mirrorScenario)
    .sort((leftPair, rightPair) => (
      getScenarioAdminLabel(leftPair.referenceScenario).localeCompare(
        getScenarioAdminLabel(rightPair.referenceScenario),
        'fr'
      )
    ));

  const referenceScenarioIds = new Set(
    pairings.map(({ referenceScenario }) => referenceScenario.id)
  );
  const mirrorScenarioIds = new Set(
    pairings.map(({ mirrorScenario }) => mirrorScenario.id)
  );

  return {
    pairings,
    referenceScenarios: pairings.length
      ? familyScenarios.filter((scenario) => referenceScenarioIds.has(scenario.id))
      : familyScenarios,
    mirrorScenarios: pairings.length
      ? familyScenarios.filter((scenario) => mirrorScenarioIds.has(scenario.id))
      : familyScenarios
  };
};

const TRANSACTION_EXPECTATION_OPTIONS = [
  {
    value: 'direct_without_deposit',
    shortLabel: 'Directe',
    label: 'Transaction directe attendue',
    description: 'Paiement CB sans caution'
  },
  {
    value: 'deposit_only',
    shortLabel: 'Indirecte',
    label: 'Transaction indirecte attendue',
    description: 'Paiement via caution'
  },
  {
    value: 'direct_with_deposit',
    shortLabel: 'Directe + indirecte',
    label: 'Paiement direct et indirect attendu',
    description: 'Paiement CB plus caution'
  }
];

const ScenariosTab = () => {
  const [scenarios, setScenarios] = useState([]);
  const [campaignSummary, setCampaignSummary] = useState({ campaign: null, rounds: [] });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingScenario, setEditingScenario] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingPairings, setSavingPairings] = useState(false);
  const [savingTransactionScenarioId, setSavingTransactionScenarioId] = useState(null);
  const [startingNewCampaign, setStartingNewCampaign] = useState(false);
  const [formData, setFormData] = useState(buildEmptyForm());
  const [pairingDraft, setPairingDraft] = useState(buildPairingDraft());
  const [previewScenario, setPreviewScenario] = useState(null);
  const [previewReferenceScenario, setPreviewReferenceScenario] = useState(null);
  const [previewSessionRole, setPreviewSessionRole] = useState('reference');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const { data: scenariosData } = await userTestingService.getAllScenarios();
    const { data: campaignData } = await userTestingService.getCurrentMirrorCampaignSummary();

    setScenarios(scenariosData || []);
    setCampaignSummary(campaignData || { campaign: null, rounds: [] });
    setPairingDraft(buildPairingDraft(scenariosData || []));
    setLoading(false);
  };

  const handleOpenModal = (scenario = null) => {
    if (scenario) {
      setEditingScenario(scenario);
      setFormData({
        title: scenario.title || '',
        objective: scenario.objective || '',
        expectedResult: scenario.expected_result || '',
        instructions: scenario.instructions || '',
        pages: scenario.pages || [],
        isActive: scenario.is_active !== false,
        programFamily: scenario.program_family || '',
        mirrorGroupKey: scenario.mirror_group_key || '',
        mirrorRole: scenario.mirror_role || ''
      });
    } else {
      setEditingScenario(null);
      setFormData(buildEmptyForm());
    }

    setShowModal(true);
  };

  const handleOpenScenarioPreview = (scenario, options = {}) => {
    setPreviewScenario(scenario || null);
    setPreviewReferenceScenario(options.referenceScenario || null);
    setPreviewSessionRole(options.sessionRole || scenario?.mirror_role || 'reference');
  };

  const handleCloseScenarioPreview = () => {
    setPreviewScenario(null);
    setPreviewReferenceScenario(null);
    setPreviewSessionRole('reference');
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.objective.trim()) {
      toast.error('Le titre et l objectif sont obligatoires.');
      return;
    }

    const hasMirrorGroup = Boolean(formData.mirrorGroupKey.trim());
    const hasMirrorRole = Boolean(formData.mirrorRole);
    const hasProgramFamily = Boolean(formData.programFamily);

    if (hasMirrorGroup !== hasMirrorRole) {
      toast.error('Renseignez à la fois le groupe miroir et la place du parcours dans le binôme.');
      return;
    }

    if (hasProgramFamily && (!hasMirrorGroup || !hasMirrorRole)) {
      toast.error('Un parcours placé dans le protocole principal doit aussi avoir son binôme miroir complet.');
      return;
    }

    if (!hasProgramFamily && (hasMirrorGroup || hasMirrorRole)) {
      toast.error("Choisissez d'abord la famille de test avant de rattacher le parcours à un binôme miroir.");
      return;
    }

    setSaving(true);

    if (editingScenario) {
      await userTestingService.updateScenario(editingScenario.id, formData);
    } else {
      await userTestingService.createScenario(formData);
    }

    setSaving(false);
    setShowModal(false);
    setFormData(buildEmptyForm());
    await loadData();
    toast.success(editingScenario ? 'Parcours mis à jour.' : 'Parcours créé.');
  };

  const handleDelete = async (scenarioId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce parcours ?')) return;

    await userTestingService.deleteScenario(scenarioId);
    await loadData();
    toast.success('Parcours supprimé.');
  };

  const handleStartNewCampaign = async () => {
    if (!confirm("Ouvrir une nouvelle vague remet les choix de référence à zéro. Continuer ?")) {
      return;
    }

    setStartingNewCampaign(true);
    const { error } = await userTestingService.startNewMirrorCampaign();
    setStartingNewCampaign(false);

    if (error) {
      toast.error('Impossible d ouvrir une nouvelle vague.');
      return;
    }

    await loadData();
    toast.success('Nouvelle vague miroir ouverte.');
  };

  const addPage = () => {
    setFormData((previous) => ({
      ...previous,
      pages: [
        ...previous.pages,
        {
          url: '',
          title: '',
          required: true,
          order: previous.pages.length + 1,
          coherence_question: '',
          exit_questions: []
        }
      ]
    }));
  };

  const updatePage = (index, field, value) => {
    setFormData((previous) => ({
      ...previous,
      pages: previous.pages.map((page, pageIndex) => (
        pageIndex === index ? { ...page, [field]: value } : page
      ))
    }));
  };

  const removePage = (index) => {
    setFormData((previous) => ({
      ...previous,
      pages: previous.pages.filter((_, pageIndex) => pageIndex !== index).map((page, pageIndex) => ({
        ...page,
        order: pageIndex + 1
      }))
    }));
  };

  const handlePairingSelection = (family, referenceScenarioId, mirrorScenarioId) => {
    setPairingDraft((previous) => ({
      ...previous,
      [family]: {
        ...(previous?.[family] || {}),
        [referenceScenarioId]:
          (previous?.[family]?.[referenceScenarioId] || '') === (mirrorScenarioId || '')
            ? ''
            : (mirrorScenarioId || '')
      }
    }));
  };

  const handleResetPairingDraft = () => {
    setPairingDraft(buildPairingDraft(scenarios));
  };

  const handleTransactionExpectationToggle = async (referenceScenarioId, nextValue) => {
    const currentScenario = scenarios.find((scenario) => scenario.id === referenceScenarioId);
    if (!currentScenario) return;

    const resolvedValue =
      currentScenario?.transaction_expectation === nextValue ? null : nextValue;

    setSavingTransactionScenarioId(referenceScenarioId);
    const { error } = await userTestingService.updateScenarioTransactionExpectation(
      referenceScenarioId,
      resolvedValue
    );
    setSavingTransactionScenarioId(null);

    if (error) {
      toast.error("Impossible d'enregistrer l'attente de paiement.");
      return;
    }

    await loadData();
    toast.success(
      resolvedValue
        ? "Type de paiement attendu enregistré."
        : "Aucun type de paiement attendu pour ce test."
    );
  };

  const handleSavePairings = async () => {
    const nextAssignments = [];

    for (const family of TEST_PROGRAM_FAMILIES) {
      const familyScenarios = scenarios.filter((scenario) => scenario?.program_family === family);
      const activeFamilyScenarios = familyScenarios.filter((scenario) => scenario?.is_active);
      const familyDraft = pairingDraft?.[family] || {};
      const selectedReferenceEntries = Object.entries(familyDraft).filter(([, mirrorId]) => Boolean(mirrorId));
      const selectedMirrorIds = new Set(selectedReferenceEntries.map(([, mirrorId]) => mirrorId));

      const invalidDualRoleScenario = activeFamilyScenarios.find((scenario) => (
        selectedMirrorIds.has(scenario?.id)
        && Boolean(familyDraft?.[scenario?.id])
      ));

      if (invalidDualRoleScenario) {
        toast.error(
          `${getScenarioAdminLabel(invalidDualRoleScenario)} ne peut pas être à la fois référence et miroir dans le même tableau.`
        );
        return;
      }

      const groupedReferencesByMirror = selectedReferenceEntries.reduce((accumulator, [referenceId, mirrorId]) => {
        if (!mirrorId || referenceId === mirrorId) return accumulator;
        return {
          ...accumulator,
          [mirrorId]: [...(accumulator?.[mirrorId] || []), referenceId]
        };
      }, {});

      const familyAssignments = familyScenarios.reduce((accumulator, scenario) => ({
        ...accumulator,
        [scenario.id]: {
          scenarioId: scenario.id,
          programFamily: scenario.program_family || family,
          mirrorGroupKey: '',
          mirrorRole: ''
        }
      }), {});

      Object.entries(groupedReferencesByMirror).forEach(([mirrorScenarioId, referenceIds]) => {
        const mirrorScenario = familyScenarios.find((scenario) => scenario.id === mirrorScenarioId);
        if (!mirrorScenario) return;

        const mirrorGroupKey = buildMirrorGroupKey(family, mirrorScenarioId);

        familyAssignments[mirrorScenarioId] = {
          ...familyAssignments[mirrorScenarioId],
          mirrorGroupKey,
          mirrorRole: 'mirror'
        };

        referenceIds.forEach((referenceId) => {
          if (!familyAssignments?.[referenceId]) return;
          familyAssignments[referenceId] = {
            ...familyAssignments[referenceId],
            mirrorGroupKey,
            mirrorRole: 'reference'
          };
        });
      });

      nextAssignments.push(
        ...Object.values(familyAssignments).filter((assignment) => {
          const currentScenario = familyScenarios.find((scenario) => scenario.id === assignment.scenarioId);
          return (
            String(currentScenario?.mirror_group_key || '') !== String(assignment?.mirrorGroupKey || '')
            || String(currentScenario?.mirror_role || '') !== String(assignment?.mirrorRole || '')
          );
        })
      );
    }

    if (!nextAssignments.length) {
      toast.success('Aucun changement de binôme à enregistrer.');
      return;
    }

    setSavingPairings(true);
    const { error } = await userTestingService.saveScenarioMirrorAssignments(nextAssignments);
    setSavingPairings(false);

    if (error) {
      toast.error('Impossible d enregistrer les binômes.');
      return;
    }

    await loadData();
    toast.success('Tableau des binômes mis à jour.');
  };

  const rounds = campaignSummary.rounds || [];
  const scenarioById = scenarios.reduce((accumulator, scenario) => {
    accumulator[scenario.id] = scenario;
    return accumulator;
  }, {});
  const activeReferenceScenarios = scenarios.filter((scenario) => (
    scenario.is_active &&
    scenario.mirror_role === 'reference' &&
    scenario.program_family &&
    scenario.mirror_group_key &&
    scenarios.some((mirrorScenario) => (
      mirrorScenario.is_active &&
      mirrorScenario.mirror_role === 'mirror' &&
      mirrorScenario.program_family === scenario.program_family &&
      mirrorScenario.mirror_group_key === scenario.mirror_group_key
    ))
  ));
  const protocolRounds = rounds.filter((round) => {
    const scenario = scenarioById?.[round.reference_scenario_id];
    return Boolean(round.program_family || scenario?.program_family);
  });
  const remainingReferenceCount = Math.max(activeReferenceScenarios.length - protocolRounds.length, 0);
  const familyStats = familyOptions.map((family) => {
    const referenceScenarios = activeReferenceScenarios.filter((scenario) => (
      scenario.program_family === family.value
    ));
    const familyRounds = rounds.filter((round) => {
      const scenario = scenarioById?.[round.reference_scenario_id];
      return (round.program_family || scenario?.program_family) === family.value;
    });

    return {
      ...family,
      usedCount: familyRounds.length,
      remainingCount: Math.max(referenceScenarios.length - familyRounds.length, 0)
    };
  });
  const familyScenarioTables = familyOptions.map((family) => {
    const familyScenarios = scenarios.filter((scenario) => (
      scenario?.is_active && scenario?.program_family === family.value
    ));
    const familyDraft = pairingDraft?.[family.value] || {};
    const pairingSummary = buildFamilyPairings(familyScenarios, familyDraft);

    return {
      ...family,
      scenarios: familyScenarios,
      ...pairingSummary
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
              {campaignSummary.campaign.label || 'Vague en cours'} : chaque testeur couvre{' '}
              {TEST_PROGRAM_TOTAL_STEPS} familles de test. Ce bloc montre seulement les parcours
              qui peuvent etre lances comme point de depart dans chaque famille.
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

        <div className="grid gap-4 md:grid-cols-2 mt-6">
          <div className="rounded-lg bg-surface p-4">
            <p className="text-sm text-muted-foreground mb-1">Parcours deja lances</p>
            <p className="text-2xl font-bold text-foreground">{protocolRounds.length}</p>
          </div>
          <div className="rounded-lg bg-surface p-4">
            <p className="text-sm text-muted-foreground mb-1">Parcours encore disponibles</p>
            <p className="text-2xl font-bold text-foreground">{remainingReferenceCount}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mt-4">
          {familyStats.map((family) => (
            <div key={family.value} className="rounded-lg border border-border bg-white p-4">
              <p className="text-sm font-semibold text-foreground">{family.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{family.description}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-md bg-surface p-2">
                  <p className="text-xs text-muted-foreground">Lances</p>
                  <p className="text-lg font-bold text-foreground">{family.usedCount}</p>
                </div>
                <div className="rounded-md bg-surface p-2">
                  <p className="text-xs text-muted-foreground">Disponibles</p>
                  <p className="text-lg font-bold text-foreground">{family.remainingCount}</p>
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
            {scenarios.filter((scenario) => scenario.is_active).length} parcours actifs dans le catalogue sur {scenarios.length} total
          </p>
          <p className="text-sm text-muted-foreground">
            {activeReferenceScenarios.length} parcours peuvent etre lances comme references dans le protocole miroir.
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

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Binômes retenus</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Chaque ligne affiche directement le couple retenu : un parcours de référence à gauche,
            son miroir à droite.
          </p>
          <p className="text-sm text-muted-foreground">
            Un scénario affiché comme miroir n est plus affiché comme référence dans cette lecture.
          </p>
          <p className="text-sm text-muted-foreground">
            Si aucune case n est cochée sur une ligne, cela signifie qu aucun type de paiement
            n est attendu pour ce test.
          </p>
        </div>

        <div className="space-y-6 mt-6">
          {familyScenarioTables.map((family) => (
            <div key={family.value} className="rounded-lg border border-border">
              <div className="border-b border-border bg-surface px-4 py-3">
                <p className="font-semibold text-foreground">{family.label}</p>
                <p className="text-sm text-muted-foreground">{family.description}</p>
              </div>

              {family.pairings.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  Aucun binôme retenu dans cette famille pour l instant.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <caption className="sr-only">
                      Liste des binômes retenus pour {family.label}
                    </caption>
                    <thead>
                      <tr className="border-b border-border bg-white">
                        <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                          Référence
                        </th>
                        <th scope="col" className="px-3 py-3 text-center text-sm font-semibold text-foreground">
                          Lien
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                          Miroir
                        </th>
                        {TRANSACTION_EXPECTATION_OPTIONS.map((option) => (
                          <th
                            key={`${family.value}-${option.value}-header`}
                            scope="col"
                            className="px-4 py-3 text-left text-sm font-semibold text-foreground"
                          >
                            <div className="min-w-[180px]">
                              <p>{option.label}</p>
                              <p className="mt-1 text-xs font-normal text-muted-foreground">
                                {option.description}
                              </p>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {family.pairings.map(({ referenceScenario, mirrorScenario }) => (
                        <tr
                          key={`${family.value}-${referenceScenario.id}-${mirrorScenario.id}`}
                          className="border-b border-border last:border-b-0"
                        >
                          <td className="px-4 py-3 align-top">
                            <button
                              type="button"
                              onClick={() => handleOpenScenarioPreview(referenceScenario, { sessionRole: 'reference' })}
                              className="text-left text-sm font-semibold text-foreground underline-offset-2 transition-colors hover:text-primary hover:underline"
                            >
                              {getScenarioAdminLabel(referenceScenario)}
                            </button>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {referenceScenario.title}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-center align-middle text-sm font-semibold text-primary">
                            →
                          </td>
                          <td className="px-4 py-3 align-top">
                            <button
                              type="button"
                              onClick={() => handleOpenScenarioPreview(mirrorScenario, {
                                sessionRole: 'mirror',
                                referenceScenario
                              })}
                              className="text-left text-sm font-semibold text-foreground underline-offset-2 transition-colors hover:text-primary hover:underline"
                            >
                              {getScenarioAdminLabel(mirrorScenario)}
                            </button>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {mirrorScenario.title}
                            </p>
                          </td>
                          {TRANSACTION_EXPECTATION_OPTIONS.map((option) => {
                            const isChecked = referenceScenario?.transaction_expectation === option.value;
                            const isSavingRow = savingTransactionScenarioId === referenceScenario.id;

                            return (
                              <td
                                key={`${family.value}-${referenceScenario.id}-${option.value}`}
                                className="px-4 py-3 align-top"
                              >
                                <label className="inline-flex items-start gap-2 text-sm text-foreground">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={isSavingRow}
                                    onChange={() => handleTransactionExpectationToggle(referenceScenario.id, option.value)}
                                    aria-label={`${option.label} pour ${getScenarioAdminLabel(referenceScenario)}`}
                                  />
                                  <span className="leading-5">
                                    <span className="block font-medium">{option.shortLabel}</span>
                                    <span className="block text-xs text-muted-foreground">
                                      {option.description}
                                    </span>
                                  </span>
                                </label>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>

        <details className="mt-6 rounded-lg border border-border">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-foreground">
            Ouvrir l éditeur complet des binômes
          </summary>

          <div className="border-t border-border p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Colonnes = parcours de référence déjà retenus. Lignes = parcours miroir déjà retenus.
                </p>
                <p className="text-sm text-muted-foreground">
                  Cette vue détaillée sert uniquement à ajuster la grille existante si besoin.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleResetPairingDraft}
                  disabled={savingPairings}
                  className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-surface-foreground hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Réinitialiser
                </button>
                <button
                  type="button"
                  onClick={handleSavePairings}
                  disabled={savingPairings}
                  className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted"
                >
                  {savingPairings ? 'Enregistrement...' : 'Enregistrer les binômes cochés'}
                </button>
              </div>
            </div>

            <div className="space-y-6 mt-6">
              {familyScenarioTables.map((family) => (
                <div key={`${family.value}-editor`} className="rounded-lg border border-border">
                  <div className="border-b border-border bg-surface px-4 py-3">
                    <p className="font-semibold text-foreground">{family.label}</p>
                    <p className="text-sm text-muted-foreground">{family.description}</p>
                  </div>

                  {family.referenceScenarios.length === 0 || family.mirrorScenarios.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-muted-foreground">
                      Il faut au moins un parcours de référence et un parcours miroir retenus dans cette famille.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse">
                        <caption className="sr-only">
                          Matrice de sélection des binômes miroir pour {family.label}
                        </caption>
                        <thead>
                          <tr className="border-b border-border bg-white">
                            <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-foreground">
                              Miroir choisi
                            </th>
                            {family.referenceScenarios.map((referenceScenario) => (
                              <th
                                key={`${family.value}-${referenceScenario.id}-column`}
                                scope="col"
                                className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                              >
                                <div className="min-w-[200px]">
                                  <p className="text-sm font-semibold normal-case text-foreground">
                                    {getScenarioAdminLabel(referenceScenario)}
                                  </p>
                                  <p className="mt-1 text-xs normal-case text-muted-foreground">
                                    {referenceScenario.title}
                                  </p>
                                  <p className="mt-1 text-[11px] normal-case text-primary">
                                    Colonne référence
                                  </p>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {family.mirrorScenarios.map((mirrorScenario) => (
                            <tr
                              key={`${family.value}-${mirrorScenario.id}-row`}
                              className="border-b border-border last:border-b-0"
                            >
                              <th scope="row" className="px-4 py-3 text-left align-top">
                                <p className="text-sm font-semibold text-foreground">
                                  {getScenarioAdminLabel(mirrorScenario)}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {mirrorScenario.title}
                                </p>
                                <p className="mt-1 text-[11px] text-primary">
                                  Ligne miroir
                                </p>
                              </th>
                              {family.referenceScenarios.map((referenceScenario) => {
                                const isChecked = pairingDraft?.[family.value]?.[referenceScenario.id] === mirrorScenario.id;

                                return (
                                  <td key={`${family.value}-${mirrorScenario.id}-${referenceScenario.id}`} className="px-3 py-3 align-top">
                                    <div className="flex justify-center">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handlePairingSelection(family.value, referenceScenario.id, mirrorScenario.id)}
                                        aria-label={`Créer le binôme référence ${getScenarioAdminLabel(referenceScenario)} avec miroir ${getScenarioAdminLabel(mirrorScenario)}`}
                                      />
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </details>
      </div>

      <ScenarioInstructionsModal
        scenario={previewScenario}
        currentPath=""
        sessionRole={previewSessionRole}
        referenceScenario={previewReferenceScenario}
        testerOrderIndex={1}
        hasExistingListings={undefined}
        expectationText=""
        expectationSaved
        visitedPages={[]}
        mirrorGuidance={null}
        isOpen={Boolean(previewScenario)}
        readOnly
        onClose={handleCloseScenarioPreview}
        onCompleteScenario={() => {}}
        onGoToPage={() => {}}
        onSaveExpectation={async () => true}
      />

      <div className="grid gap-4">
        {scenarios.map((scenario) => (
          <div key={scenario.id} className="bg-white rounded-lg shadow p-6">
            {(() => {
              const scenarioBrief = getTestingScenarioBrief(scenario);
              const protocolTags = getTestingScenarioProtocolTags(scenario);

              return (
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h3 className="break-words text-lg font-semibold text-foreground">
                    {scenarioBrief.title}
                  </h3>
                  {scenario.is_active ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                      <Eye className="w-3 h-3" /> Actif
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted text-surface-foreground rounded-full text-xs font-medium">
                      <EyeOff className="w-3 h-3" /> Inactif
                    </span>
                  )}
                  {scenario.mirror_role && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                      {scenario.mirror_role === 'reference' ? 'Référence' : 'Miroir'}
                    </span>
                  )}
                  {scenario.program_family && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-violet-100 text-violet-900 rounded-full text-xs font-medium">
                      {getTestProgramFamilyMeta(scenario.program_family).label}
                    </span>
                  )}
                  {scenario.mirror_group_key && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-medium">
                      Binome : {scenario.mirror_group_key}
                    </span>
                  )}
                </div>
                {protocolTags.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {protocolTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-surface px-2 py-1 text-xs font-medium text-surface-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mb-2 text-muted-foreground">{scenarioBrief.objective}</p>
                {scenarioBrief.instructions?.[0] && (
                  <p className="mb-2 text-sm text-surface-foreground">
                    <span className="font-medium">Consigne interne :</span>{' '}
                    {scenarioBrief.instructions[0]}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span>{scenario.pages.length || 0} étapes</span>
                  <span>{scenario.pages.filter((page) => page.required).length || 0} obligatoires</span>
                  {!scenario.program_family || !scenario.mirror_group_key || !scenario.mirror_role ? (
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
                      onClick={() => handleDelete(scenario.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        ))}

        {scenarios.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-muted-foreground">Aucun parcours disponible.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-foreground mb-4">
              {editingScenario ? 'Éditer le parcours' : 'Nouveau parcours'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-foreground mb-1">
                  Titre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(event) => setFormData((previous) => ({ ...previous, title: event.target.value }))}
                  className="w-full border border-border rounded-lg p-2 focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-foreground mb-1">
                  Brief du test <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.objective}
                  onChange={(event) => setFormData((previous) => ({ ...previous, objective: event.target.value }))}
                  className="w-full border border-border rounded-lg p-2 min-h-[80px] focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-surface-foreground mb-1">
                    Famille de test
                  </label>
                  <select
                    value={formData.programFamily}
                    onChange={(event) => setFormData((previous) => ({ ...previous, programFamily: event.target.value }))}
                    className="w-full border border-border rounded-lg p-2 focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Hors protocole principal</option>
                    {familyOptions.map((family) => (
                      <option key={family.value} value={family.value}>
                        {family.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Utilisez cette liste pour indiquer si le parcours sert au test abouti, a
                    l'échec côté locataire, à l'échec côté propriétaire ou aux incidents
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
                    value={formData.mirrorGroupKey}
                    onChange={(event) => setFormData((previous) => ({ ...previous, mirrorGroupKey: event.target.value }))}
                    className="w-full border border-border rounded-lg p-2 focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Donnez exactement le même nom aux deux parcours qui doivent aller ensemble.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-foreground mb-1">
                    Place du parcours dans le binôme
                  </label>
                  <select
                    value={formData.mirrorRole}
                    onChange={(event) => setFormData((previous) => ({ ...previous, mirrorRole: event.target.value }))}
                    className="w-full border border-border rounded-lg p-2 focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Aucune</option>
                    <option value="reference">Parcours de référence</option>
                    <option value="mirror">Parcours miroir</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Le parcours de référence est celui que choisit le participant libre. Le parcours
                    miroir est attribué automatiquement au participant suivant.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-foreground mb-1">
                  Ce que l'observateur doit vérifier
                </label>
                <textarea
                  value={formData.expectedResult}
                  onChange={(event) => setFormData((previous) => ({ ...previous, expectedResult: event.target.value }))}
                  className="w-full border border-border rounded-lg p-2 min-h-[60px] focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-foreground mb-1">
                  Consignes internes de conduite
                </label>
                <textarea
                  value={formData.instructions}
                  onChange={(event) => setFormData((previous) => ({ ...previous, instructions: event.target.value }))}
                  className="w-full border border-border rounded-lg p-2 min-h-[60px] focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-surface-foreground">
                    Étapes du parcours
                  </label>
                  <button
                    onClick={addPage}
                    className="text-sm text-primary hover:text-[#0d7b88] font-medium"
                  >
                    + Ajouter une étape
                  </button>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  Le participant voit un checkpoint questionnaire tous les 2 ecrans visites.
                  Chaque question saisie ici devient un QCM avec une echelle standard, puis un
                  commentaire libre est demande automatiquement.
                </p>
                <div className="space-y-3">
                  {formData.pages.map((page, index) => (
                    <div key={index} className="border border-border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium text-surface-foreground">Étape {index + 1}</span>
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
                          value={page.url}
                          onChange={(event) => updatePage(index, 'url', event.target.value)}
                          className="border border-border rounded p-2 text-sm"
                        />
                        <input
                          type="text"
                          placeholder="Titre de la page"
                          value={page.title}
                          onChange={(event) => updatePage(index, 'title', event.target.value)}
                          className="border border-border rounded p-2 text-sm"
                        />
                      </div>
                      <div className="mt-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={page.required}
                            onChange={(event) => updatePage(index, 'required', event.target.checked)}
                            className="rounded"
                          />
                          <span className="text-sm text-surface-foreground">Étape obligatoire</span>
                        </label>
                      </div>
                      <div className="mt-3">
                        <label className="mb-1 block text-sm font-medium text-surface-foreground">
                          Questions QCM du checkpoint
                        </label>
                        <textarea
                          value={joinQuestionLines(page.exit_questions)}
                          onChange={(event) => updatePage(index, 'exit_questions', splitQuestionLines(event.target.value))}
                          className="min-h-[90px] w-full rounded border border-border p-2 text-sm"
                          placeholder={
                            "Une ligne = une question QCM.\nCes questions sont posees tous les 2 ecrans visites.\nSi vous laissez vide, un questionnaire generique sera utilise."
                          }
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Le commentaire libre est ajoute automatiquement a chaque checkpoint.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(event) => setFormData((previous) => ({ ...previous, isActive: event.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-surface-foreground">Parcours actif</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSave}
                disabled={saving || !formData.title.trim() || !formData.objective.trim()}
                className="flex-1 bg-primary text-white py-2 px-4 rounded-lg hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed"
              >
                {saving ? 'Enregistrement...' : editingScenario ? 'Mettre à jour' : 'Créer'}
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

