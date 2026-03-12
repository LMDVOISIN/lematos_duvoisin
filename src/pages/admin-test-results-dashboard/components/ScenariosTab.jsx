import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import userTestingService from '../../../services/userTestingService';

const ScenariosTab = () => {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingScenario, setEditingScenario] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    objective: '',
    expectedResult: '',
    instructions: '',
    pages: [],
    isActive: true
  });

  useEffect(() => {
    loadScenarios();
  }, []);

  const loadScenarios = async () => {
    setLoading(true);
    const { data } = await userTestingService?.getAllScenarios();
    setScenarios(data || []);
    setLoading(false);
  };

  const handleOpenModal = (scenario = null) => {
    if (scenario) {
      setEditingScenario(scenario);
      setFormData({
        title: scenario?.title,
        objective: scenario?.objective,
        expectedResult: scenario?.expected_result || '',
        instructions: scenario?.instructions || '',
        pages: scenario?.pages || [],
        isActive: scenario?.is_active
      });
    } else {
      setEditingScenario(null);
      setFormData({
        title: '',
        objective: '',
        expectedResult: '',
        instructions: '',
        pages: [],
        isActive: true
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData?.title?.trim() || !formData?.objective?.trim()) return;

    if (editingScenario) {
      await userTestingService?.updateScenario(editingScenario?.id, formData);
    } else {
      await userTestingService?.createScenario(formData);
    }

    setShowModal(false);
    loadScenarios();
  };

  const handleDelete = async (scenarioId) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce scénario ?')) {
      await userTestingService?.deleteScenario(scenarioId);
      loadScenarios();
    }
  };

  const addPage = () => {
    setFormData(prev => ({
      ...prev,
      pages: [
        ...prev?.pages,
        {
          url: '',
          title: '',
          required: true,
          order: prev?.pages?.length + 1,
          coherence_question: '',
          exit_questions: []
        }
      ]
    }));
  };

  const updatePage = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      pages: prev?.pages?.map((page, i) => 
        i === index ? { ...page, [field]: value } : page
      )
    }));
  };

  const removePage = (index) => {
    setFormData(prev => ({
      ...prev,
      pages: prev?.pages?.filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Gestion des scénarios</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {scenarios?.filter(s => s?.is_active)?.length} scénarios actifs sur {scenarios?.length} total
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          Nouveau scénario
        </button>
      </div>
      <div className="grid gap-4">
        {scenarios?.map((scenario) => (
          <div key={scenario?.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
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
                </div>
                <p className="text-muted-foreground mb-2">{scenario?.objective}</p>
                {scenario?.pages && (
                  <p className="text-sm text-muted-foreground">
                    {scenario?.pages?.length} étapes • {scenario?.pages?.filter(p => p?.required)?.length} obligatoires
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenModal(scenario)}
                  className="p-2 text-primary hover:bg-primary/10 rounded-lg"
                  title="Éditer"
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
            <p className="text-muted-foreground">Aucun scénario disponible</p>
          </div>
        )}
      </div>
      {/* Scenario Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold text-foreground mb-4">
              {editingScenario ? 'Éditer le scénario' : 'Nouveau scénario'}
            </h3>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-surface-foreground mb-1">
                  Titre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData?.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e?.target?.value }))}
                  className="w-full border border-border rounded-lg p-2 focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Objective */}
              <div>
                <label className="block text-sm font-medium text-surface-foreground mb-1">
                  Objectif <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData?.objective}
                  onChange={(e) => setFormData(prev => ({ ...prev, objective: e?.target?.value }))}
                  className="w-full border border-border rounded-lg p-2 min-h-[80px] focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Expected Result */}
              <div>
                <label className="block text-sm font-medium text-surface-foreground mb-1">
                  Résultat attendu
                </label>
                <textarea
                  value={formData?.expectedResult}
                  onChange={(e) => setFormData(prev => ({ ...prev, expectedResult: e?.target?.value }))}
                  className="w-full border border-border rounded-lg p-2 min-h-[60px] focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-sm font-medium text-surface-foreground mb-1">
                  Consignes
                </label>
                <textarea
                  value={formData?.instructions}
                  onChange={(e) => setFormData(prev => ({ ...prev, instructions: e?.target?.value }))}
                  className="w-full border border-border rounded-lg p-2 min-h-[60px] focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Pages */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-surface-foreground">
                    Étapes du scénario
                  </label>
                  <button
                    onClick={addPage}
                    className="text-sm text-primary hover:text-[#0d7b88] font-medium"
                  >
                    + Ajouter une étape
                  </button>
                </div>
                <div className="space-y-3">
                  {formData?.pages?.map((page, index) => (
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
                          value={page?.url}
                          onChange={(e) => updatePage(index, 'url', e?.target?.value)}
                          className="border border-border rounded p-2 text-sm"
                        />
                        <input
                          type="text"
                          placeholder="Titre de la page"
                          value={page?.title}
                          onChange={(e) => updatePage(index, 'title', e?.target?.value)}
                          className="border border-border rounded p-2 text-sm"
                        />
                      </div>
                      <div className="mt-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={page?.required}
                            onChange={(e) => updatePage(index, 'required', e?.target?.checked)}
                            className="rounded"
                          />
                          <span className="text-sm text-surface-foreground">Étape obligatoire</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active Status */}
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData?.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e?.target?.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-surface-foreground">Scénario actif</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSave}
                disabled={!formData?.title?.trim() || !formData?.objective?.trim()}
                className="flex-1 bg-primary text-white py-2 px-4 rounded-lg hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed"
              >
                {editingScenario ? 'Mettre à jour' : 'Créer'}
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
