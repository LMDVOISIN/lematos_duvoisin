import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Icon from '../../components/AppIcon';
import { useChat } from '../../hooks/useChat';
import demandeService from '../../services/demandeService';
import categoryService from '../../services/categoryService';
import { useAuth } from '../../contexts/AuthContext';
import StyleSelectorModal from '../create-listing/components/StyleSelectorModal';
import GeneratedOptionsModal from '../create-listing/components/GeneratedOptionsModal';
import { getBestKnownCity, getStoredCity, setStoredCity } from '../../utils/cityPrefill';
import {
  LISTING_CATEGORY_OPTIONS,
  buildListingCategoryOptions,
  normalizeListingCategory
} from '../create-listing/constants/categoryOptions';

const DEMAND_DRAFT_STORAGE_KEY = 'createDemandDraft';

const CreateDemandRequest = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [errors, setErrors] = useState({});
  const [styleSelectorOpen, setStyleSelectorOpen] = useState(false);
  const [generatedOptionsOpen, setGeneratedOptionsOpen] = useState(false);
  const [currentFieldType, setCurrentFieldType] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [generatedOptions, setGeneratedOptions] = useState(null);

  const {
    response: generatedResponse,
    isLoading: isGenerating,
    error: generationError,
    sendMessage
  } = useChat('GEMINI', 'gemini/gemini-2.5-flash', false);

  const [formData, setFormData] = useState(() => ({
    titre: '',
    description: '',
    categorie_slug: '',
    ville: getStoredCity(),
    rayon_km: 10,
    prix_max: '',
    dispo_de: '',
    dispo_a: ''
  }));

  useEffect(() => {
    loadCategories();

    try {
      const rawDraft = sessionStorage?.getItem(DEMAND_DRAFT_STORAGE_KEY);
      if (!rawDraft) return;

      const parsedDraft = JSON.parse(rawDraft);
      if (!parsedDraft || typeof parsedDraft !== 'object') return;

      setFormData((previous) => ({
        ...previous,
        ...parsedDraft
      }));
    } catch (error) {
      console.warn('Impossible de restaurer le brouillon de demande:', error);
    }
  }, []);

  useEffect(() => {
    if (!generationError) return;

    toast?.error(generationError?.message || 'Erreur lors de la génération');
    setGeneratedOptionsOpen(false);
  }, [generationError]);

  useEffect(() => {
    if (!generatedResponse || isGenerating || !selectedStyle) return;

    if (currentFieldType === 'title') {
      const titles = generatedResponse
        ?.split('\n')
        ?.map((line) => line?.replace(/^[\d\-\.\*]+\s*/, '')?.trim())
        ?.filter((line) => line?.length > 0)
        ?.slice(0, 5);

      setGeneratedOptions(titles);
    } else {
      setGeneratedOptions(generatedResponse);
    }

    setGeneratedOptionsOpen(true);
  }, [generatedResponse, isGenerating, selectedStyle, currentFieldType]);

  useEffect(() => {
    const preferredCity = getBestKnownCity(formData?.ville, userProfile?.city, getStoredCity());
    if (!preferredCity || preferredCity === formData?.ville) return;

    setFormData((prev) => ({
      ...prev,
      ville: preferredCity
    }));
    setStoredCity(preferredCity);
  }, [userProfile?.city]);

  const loadCategories = async () => {
    try {
      const { data } = await categoryService?.getCategories();
      if (data) {
        setCategories(data);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des catégories :', error);
    }
  };

  const categoryOptions = useMemo(() => {
    return buildListingCategoryOptions(categories || []);
  }, [categories]);

  useEffect(() => {
    const current = String(formData?.categorie_slug || '')?.trim();
    if (!current || categoryOptions?.length === 0) return;

    const normalized = normalizeListingCategory(current, categoryOptions);
    if (!normalized || normalized === current) return;

    setFormData((prev) => ({
      ...prev,
      categorie_slug: normalized
    }));
  }, [formData?.categorie_slug, categoryOptions]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (field === 'ville') {
      setStoredCity(value);
    }

    if (errors?.[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData?.titre?.trim()) {
      newErrors.titre = 'Le titre est requis';
    }

    if (!formData?.description?.trim()) {
      newErrors.description = 'La description est requise';
    }

    if (!normalizeListingCategory(formData?.categorie_slug, categoryOptions)) {
      newErrors.categorie_slug = 'La catégorie est requise';
    }

    if (!formData?.ville?.trim()) {
      newErrors.ville = 'La ville est requise';
    }

    if (!formData?.prix_max || formData?.prix_max <= 0) {
      newErrors.prix_max = 'Le prix maximum doit être supérieur à 0';
    }

    if (!formData?.dispo_de) {
      newErrors.dispo_de = 'La date de début est requise';
    }

    if (!formData?.dispo_a) {
      newErrors.dispo_a = 'La date de fin est requise';
    }

    if (formData?.dispo_de && formData?.dispo_a && new Date(formData?.dispo_de) > new Date(formData?.dispo_a)) {
      newErrors.dispo_a = 'La date de fin doit être après la date de début';
    }

    setErrors(newErrors);
    return Object.keys(newErrors)?.length === 0;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();

    if (!user) {
      try {
        sessionStorage?.setItem(DEMAND_DRAFT_STORAGE_KEY, JSON.stringify(formData));
      } catch (error) {
        console.warn('Impossible de sauvegarder temporairement la demande:', error);
      }

      setErrors((prev) => ({
        ...prev,
        submit: 'Connectez-vous ou créez un compte pour publier votre demande. Votre saisie a été conservée.'
      }));

      navigate('/authentification', { state: { from: '/creer-demande' } });
      return;
    }

    if (!validateForm()) return;

    setLoading(true);

    try {
      const normalizedCategory = normalizeListingCategory(formData?.categorie_slug, categoryOptions);
      const { error } = await demandeService?.createDemande({
        ...formData,
        categorie_slug: normalizedCategory || formData?.categorie_slug,
        statut: 'open',
        moderation_status: 'pending'
      });

      if (error) {
        setErrors({ submit: error?.message || 'Erreur lors de la création de la demande' });
        return;
      }

      sessionStorage?.removeItem(DEMAND_DRAFT_STORAGE_KEY);
      navigate('/tableau-bord-utilisateur?tab=demandes');
    } catch (error) {
      console.error("Erreur d'envoi :", error);
      setErrors({ submit: 'Une erreur est survenue. Veuillez réessayer.' });
    } finally {
      setLoading(false);
    }
  };

  const rayonOptions = [
    { value: '5', label: '5 km' },
    { value: '10', label: '10 km' },
    { value: '25', label: '25 km' },
    { value: '50', label: '50 km' },
    { value: '100', label: '100 km' }
  ];

  const getSelectedCategoryLabel = () => {
    return (
      categoryOptions?.find((option) => option?.value === formData?.categorie_slug)?.label ||
      formData?.categorie_slug
    );
  };

  const getDemandContext = () => {
    return [
      formData?.ville ? `Ville: ${formData?.ville}` : '',
      formData?.rayon_km ? `Rayon: ${formData?.rayon_km} km` : '',
      formData?.prix_max ? `Budget max: ${formData?.prix_max} EUR/jour` : '',
      formData?.dispo_de ? `Date de début: ${formData?.dispo_de}` : '',
      formData?.dispo_a ? `Date de fin: ${formData?.dispo_a}` : ''
    ]
      ?.filter(Boolean)
      ?.join(', ');
  };

  const getStylePrompt = (style, fieldType) => {
    const categoryLabel = getSelectedCategoryLabel();
    const demandContext = getDemandContext();
    const baseContext = demandContext ? ` Contexte: ${demandContext}.` : '';

    const stylePrompts = {
      funny: {
        title: `Génère 5 titres humoristiques et accrocheurs pour une demande de location de matériel. Catégorie: ${categoryLabel}${formData?.titre ? `, Idée: ${formData?.titre}` : ''}. Retourne uniquement les titres, un par ligne, sans numérotation.`,
        description: `Génère une description humoristique, claire et sympathique pour une demande de location de matériel. Titre: ${formData?.titre}. Catégorie: ${categoryLabel}.${baseContext} La description doit être en français, rester utile, inclure le besoin principal, les contraintes et le budget. Maximum 180 mots.`
      },
      professional: {
        title: `Génère 5 titres professionnels, clairs et rassurants pour une demande de location de matériel. Catégorie: ${categoryLabel}${formData?.titre ? `, Idée: ${formData?.titre}` : ''}. Retourne uniquement les titres, un par ligne, sans numérotation.`,
        description: `Génère une description professionnelle, précise et convaincante pour une demande de location de matériel. Titre: ${formData?.titre}. Catégorie: ${categoryLabel}.${baseContext} La description doit être en français, structurée, mentionner le besoin exact, les contraintes, les dates et le budget. Maximum 180 mots.`
      },
      technical: {
        title: `Génère 5 titres techniques et précis pour une demande de location de matériel. Catégorie: ${categoryLabel}${formData?.titre ? `, Idée: ${formData?.titre}` : ''}. Retourne uniquement les titres, un par ligne, sans numérotation.`,
        description: `Génère une description technique et détaillée pour une demande de location de matériel. Titre: ${formData?.titre}. Catégorie: ${categoryLabel}.${baseContext} La description doit être en français, orientée spécifications, mentionner les caractéristiques attendues, la plage de budget et les contraintes d'usage. Maximum 180 mots.`
      }
    };

    return stylePrompts?.[style]?.[fieldType] || '';
  };

  const handleOpenStyleSelector = (fieldType) => {
    if (fieldType === 'description' && (!formData?.titre || !formData?.categorie_slug)) {
      toast?.error('Veuillez renseigner le titre et la catégorie avant de générer la description');
      return;
    }

    if (fieldType === 'title' && !formData?.categorie_slug) {
      toast?.error('Veuillez sélectionner une catégorie avant de générer le titre');
      return;
    }

    setCurrentFieldType(fieldType);
    setStyleSelectorOpen(true);
  };

  const handleStyleSelect = (style) => {
    setSelectedStyle(style);
    setStyleSelectorOpen(false);
    setGeneratedOptionsOpen(true);

    const prompt = getStylePrompt(style, currentFieldType);
    sendMessage([{ role: 'user', content: prompt }], { temperature: 0.7, max_tokens: 500 });
  };

  const handleSelectOption = (option) => {
    if (currentFieldType === 'title') {
      handleChange('titre', option);
      toast?.success('Titre appliqué avec succès');
    } else {
      handleChange('description', option);
      toast?.success('Description appliquée avec succès');
    }

    setGeneratedOptionsOpen(false);
    setSelectedStyle(null);
    setGeneratedOptions(null);
  };

  const handleRegenerate = () => {
    if (!selectedStyle) return;

    const prompt = getStylePrompt(selectedStyle, currentFieldType);
    sendMessage([{ role: 'user', content: prompt }], { temperature: 0.8, max_tokens: 500 });
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-6 md:py-8">
        <div className="max-w-3xl mx-auto">
          {/* En-tête */}
          <div className="mb-6">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-smooth"
            >
              <Icon name="ArrowLeft" size={20} />
              <span>Retour</span>
            </button>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              Créer une demande de location
            </h1>
            <p className="text-muted-foreground">
              Décrivez l'équipement que vous recherchez et nous vous mettrons en relation avec des propriétaires
            </p>
          </div>

          {!user && (
            <div className="mb-6 rounded-lg border border-[#17a2b8]/30 bg-[#ecfeff] p-4">
              <div className="flex gap-3">
                <Icon name="Info" size={20} className="mt-0.5 flex-shrink-0 text-[#0f7081]" />
                <div>
                  <p className="text-sm font-semibold text-[#0f4d7a]">
                    Vous pouvez commencer votre demande sans compte.
                  </p>
                  <p className="mt-1 text-sm text-[#0f7081]">
                    La connexion sera demandée uniquement au moment de publier.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-elevation-2 p-6 space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Informations générales</h2>
              <p className="text-sm text-muted-foreground">
                Décrivez l'équipement recherché de manière claire et précise
              </p>
            </div>

            {/* Titre */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-foreground">Titre de la demande *</label>
                <button
                  type="button"
                  onClick={() => handleOpenStyleSelector('title')}
                  disabled={isGenerating || !formData?.categorie_slug}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 rounded-md hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-4 h-4" />
                  Générer avec l'IA
                </button>
              </div>
              <Input
                type="text"
                placeholder="Ex: Recherche perceuse sans fil pour 3 jours"
                value={formData?.titre}
                onChange={(e) => handleChange('titre', e?.target?.value)}
                error={errors?.titre}
              />
              {errors?.titre && <p className="text-sm text-error mt-1">{errors?.titre}</p>}
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-foreground">Description *</label>
                <button
                  type="button"
                  onClick={() => handleOpenStyleSelector('description')}
                  disabled={isGenerating || !formData?.titre || !formData?.categorie_slug}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 rounded-md hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-4 h-4" />
                  Générer avec l'IA
                </button>
              </div>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                rows={4}
                placeholder="Décrivez précisément l'équipement recherché, vos besoins et contraintes..."
                value={formData?.description}
                onChange={(e) => handleChange('description', e?.target?.value)}
              />
              {errors?.description && <p className="text-sm text-error mt-1">{errors?.description}</p>}
            </div>

            {/* Catégorie */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Catégorie *</label>
              <Select
                options={categoryOptions}
                value={formData?.categorie_slug}
                onChange={(value) => handleChange('categorie_slug', value)}
                placeholder="Sélectionnez une catégorie"
              />
              {errors?.categorie_slug && (
                <p className="text-sm text-error mt-1">{errors?.categorie_slug}</p>
              )}
            </div>

            {/* Localisation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Ville *</label>
                <Input
                  type="text"
                  name="city"
                  placeholder="Ex: Paris"
                  value={formData?.ville}
                  onChange={(e) => handleChange('ville', e?.target?.value)}
                  autoComplete="address-level2"
                  error={errors?.ville}
                />
                {errors?.ville && <p className="text-sm text-error mt-1">{errors?.ville}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Rayon de recherche</label>
                <Select
                  options={rayonOptions}
                  value={formData?.rayon_km?.toString()}
                  onChange={(value) => handleChange('rayon_km', Number.parseInt(value, 10) || 10)}
                />
              </div>
            </div>

            {/* Prix */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Prix maximum par jour (EUR) *
              </label>
              <Input
                type="number"
                placeholder="Ex: 25"
                value={formData?.prix_max}
                onChange={(e) => handleChange('prix_max', e?.target?.value)}
                min="0"
                step="0.01"
                error={errors?.prix_max}
              />
              {errors?.prix_max && <p className="text-sm text-error mt-1">{errors?.prix_max}</p>}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Date de début *</label>
                <Input
                  type="date"
                  value={formData?.dispo_de}
                  onChange={(e) => handleChange('dispo_de', e?.target?.value)}
                  min={new Date()?.toISOString()?.split('T')?.[0]}
                  error={errors?.dispo_de}
                />
                {errors?.dispo_de && <p className="text-sm text-error mt-1">{errors?.dispo_de}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Date de fin *</label>
                <Input
                  type="date"
                  value={formData?.dispo_a}
                  onChange={(e) => handleChange('dispo_a', e?.target?.value)}
                  min={formData?.dispo_de || new Date()?.toISOString()?.split('T')?.[0]}
                  error={errors?.dispo_a}
                />
                {errors?.dispo_a && <p className="text-sm text-error mt-1">{errors?.dispo_a}</p>}
              </div>
            </div>

            {/* Erreur d'envoi */}
            {errors?.submit && (
              <div className="bg-error/10 border border-error rounded-lg p-4">
                <p className="text-sm text-error">{errors?.submit}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate(-1)} className="flex-1">
                Annuler
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? (
                  <>
                    <Icon name="Loader" size={20} className="animate-spin" />
                    <span>Création...</span>
                  </>
                ) : (
                  user ? 'Publier la demande' : 'Se connecter pour publier'
                )}
              </Button>
            </div>
          </form>

          {/* Encadré d'information */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <Icon name="Info" size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Comment ça marche ?</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>- Votre demande sera modérée sous 24h</li>
                  <li>- Notre algorithme recherchera automatiquement des équipements correspondants</li>
                  <li>- Vous recevrez des propositions de propriétaires</li>
                  <li>- Vous pourrez accepter ou refuser chaque proposition</li>
                </ul>
              </div>
            </div>
          </div>

          <StyleSelectorModal
            isOpen={styleSelectorOpen}
            onClose={() => setStyleSelectorOpen(false)}
            onSelectStyle={handleStyleSelect}
            fieldType={currentFieldType}
          />

          <GeneratedOptionsModal
            isOpen={generatedOptionsOpen}
            onClose={() => {
              setGeneratedOptionsOpen(false);
              setSelectedStyle(null);
              setGeneratedOptions(null);
            }}
            options={generatedOptions}
            onSelect={handleSelectOption}
            onRegenerate={handleRegenerate}
            fieldType={currentFieldType}
            isLoading={isGenerating}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CreateDemandRequest;
