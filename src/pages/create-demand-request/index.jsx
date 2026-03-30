import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import CommuneAutocompleteFields from '../../components/ui/CommuneAutocompleteFields';
import Select from '../../components/ui/Select';
import Icon from '../../components/AppIcon';
import {
  ActionCard,
  ActionHero,
  ActionPageShell
} from '../../components/page/ActionPageLayout';
import { useChat } from '../../hooks/useChat';
import demandeService from '../../services/demandeService';
import categoryService from '../../services/categoryService';
import objectImageLibraryService from '../../services/objectImageLibraryService';
import { normalizePostalCode } from '../../services/communeAutocompleteService';
import { useAuth } from '../../contexts/AuthContext';
import StyleSelectorModal from '../create-listing/components/StyleSelectorModal';
import GeneratedOptionsModal from '../create-listing/components/GeneratedOptionsModal';
import { getBestKnownCity, getStoredCity, setStoredCity } from '../../utils/cityPrefill';
import {
  buildListingCategoryOptions,
  normalizeListingCategory
} from '../create-listing/constants/categoryOptions';

const DEMAND_DRAFT_STORAGE_KEY = 'createDemandDraft';
const DEFAULT_RAYON_KM = 10;

const createEmptyFormData = () => ({
  titre: '',
  description: '',
  categorie_slug: '',
  library_image_id: null,
  code_postal: '',
  ville: getStoredCity(),
  rayon_km: DEFAULT_RAYON_KM
});

const sanitizeDemandDraft = (draft = {}) => {
  const defaults = createEmptyFormData();
  const parsedRadius = Number.parseInt(draft?.rayon_km, 10);

  return {
    ...defaults,
    titre: String(draft?.titre || ''),
    description: String(draft?.description || ''),
    categorie_slug: String(draft?.categorie_slug || ''),
    library_image_id: draft?.library_image_id ? Number.parseInt(draft?.library_image_id, 10) || null : null,
    code_postal: normalizePostalCode(draft?.code_postal || draft?.postal_code),
    ville: String(draft?.ville || draft?.city || defaults?.ville || '').trim(),
    rayon_km: Number.isFinite(parsedRadius) ? parsedRadius : DEFAULT_RAYON_KM
  };
};

const buildSubmitPayload = (formData = {}) => {
  const parsedRadius = Number.parseInt(formData?.rayon_km, 10);

  return {
    titre: String(formData?.titre || '').trim(),
    description: String(formData?.description || '').trim(),
    categorie_slug: String(formData?.categorie_slug || '').trim(),
    library_image_id: formData?.library_image_id ? Number.parseInt(formData?.library_image_id, 10) || null : null,
    code_postal: normalizePostalCode(formData?.code_postal),
    ville: String(formData?.ville || '').trim(),
    rayon_km: Number.isFinite(parsedRadius) ? parsedRadius : DEFAULT_RAYON_KM
  };
};

const CreateDemandRequest = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [libraryImages, setLibraryImages] = useState([]);
  const [libraryImagesLoading, setLibraryImagesLoading] = useState(false);
  const [librarySubcategoryFilter, setLibrarySubcategoryFilter] = useState('');
  const [errors, setErrors] = useState({});
  const [styleSelectorOpen, setStyleSelectorOpen] = useState(false);
  const [generatedOptionsOpen, setGeneratedOptionsOpen] = useState(false);
  const [currentFieldType, setCurrentFieldType] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [generatedOptions, setGeneratedOptions] = useState(null);
  const [formData, setFormData] = useState(createEmptyFormData);

  const {
    response: generatedResponse,
    isLoading: isGenerating,
    error: generationError,
    sendMessage
  } = useChat('GEMINI', 'gemini/gemini-2.5-flash', false);

  useEffect(() => {
    loadCategories();

    try {
      const rawDraft = sessionStorage?.getItem(DEMAND_DRAFT_STORAGE_KEY);
      if (!rawDraft) return;

      const parsedDraft = JSON.parse(rawDraft);
      if (!parsedDraft || typeof parsedDraft !== 'object') return;

      setFormData(sanitizeDemandDraft(parsedDraft));
    } catch (error) {
      console.warn('Impossible de restaurer le brouillon de demande:', error);
    }
  }, []);

  useEffect(() => {
    if (!generationError) return;

    toast?.error(generationError?.message || 'Erreur lors de la generation');
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
    const preferredCity = getBestKnownCity(userProfile?.city, getStoredCity());
    const preferredPostalCode = normalizePostalCode(userProfile?.postal_code);

    if (!preferredCity && !preferredPostalCode) return;

    setFormData((prev) => {
      let hasChanges = false;
      const next = { ...prev };

      if (!prev?.ville && preferredCity) {
        next.ville = preferredCity;
        hasChanges = true;
      }

      if (!prev?.code_postal && preferredPostalCode) {
        next.code_postal = preferredPostalCode;
        hasChanges = true;
      }

      return hasChanges ? next : prev;
    });

    if (preferredCity) {
      setStoredCity(preferredCity);
    }
  }, [userProfile?.city, userProfile?.postal_code]);

  const loadCategories = async () => {
    try {
      const { data } = await categoryService?.getCategories();
      if (data) {
        setCategories(data);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des categories :', error);
    }
  };

  const categoryOptions = useMemo(() => {
    return buildListingCategoryOptions(categories || []);
  }, [categories]);

  const selectedCategory = useMemo(() => {
    const currentSlug = String(formData?.categorie_slug || '').trim();
    if (!currentSlug) return null;

    return (categories || []).find((category) => String(category?.slug || '').trim() === currentSlug) || null;
  }, [categories, formData?.categorie_slug]);

  const librarySubcategoryOptions = useMemo(() => {
    const rows = selectedCategory?.subcategories || [];
    return rows.map((subcategory) => ({
      value: String(subcategory?.id || ''),
      label: subcategory?.nom || subcategory?.name || subcategory?.slug || 'Sous-categorie'
    }));
  }, [selectedCategory]);

  const filteredLibraryImages = useMemo(() => {
    if (!librarySubcategoryFilter) return libraryImages || [];

    return (libraryImages || []).filter((image) =>
      String(image?.subcategory_id || '') === String(librarySubcategoryFilter || '')
    );
  }, [libraryImages, librarySubcategoryFilter]);

  const selectedLibraryImage = useMemo(() => {
    return (libraryImages || []).find((image) =>
      String(image?.id || '') === String(formData?.library_image_id || '')
    ) || null;
  }, [formData?.library_image_id, libraryImages]);

  useEffect(() => {
    const current = String(formData?.categorie_slug || '').trim();
    if (!current || categoryOptions?.length === 0) return;

    const normalized = normalizeListingCategory(current, categoryOptions);
    if (!normalized || normalized === current) return;

    setFormData((prev) => ({
      ...prev,
      categorie_slug: normalized
    }));
  }, [formData?.categorie_slug, categoryOptions]);

  useEffect(() => {
    const loadLibraryImages = async () => {
      if (!selectedCategory?.id) {
        setLibraryImages([]);
        setLibrarySubcategoryFilter('');
        return;
      }

      try {
        setLibraryImagesLoading(true);
        const { data, error } = await objectImageLibraryService?.listImages({
          categoryId: selectedCategory?.id
        });

        if (error) {
          console.error("Erreur lors du chargement des images de bibliothèque :", error);
          setLibraryImages([]);
          return;
        }

        setLibraryImages(data || []);
      } catch (error) {
        console.error("Erreur lors du chargement des images de bibliothèque :", error);
        setLibraryImages([]);
      } finally {
        setLibraryImagesLoading(false);
      }
    };

    void loadLibraryImages();
  }, [selectedCategory?.id]);

  const handleChange = (field, value) => {
    const nextValue = field === 'code_postal' ? normalizePostalCode(value) : value;

    if (field === 'categorie_slug') {
      setFormData((prev) => ({
        ...prev,
        categorie_slug: nextValue,
        library_image_id: null
      }));
      setLibrarySubcategoryFilter('');
      if (errors?.[field]) {
        setErrors((prev) => ({ ...prev, [field]: '' }));
      }
      return;
    }

    setFormData((prev) => ({ ...prev, [field]: nextValue }));

    if (field === 'ville') {
      setStoredCity(nextValue);
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
      newErrors.categorie_slug = 'La categorie est requise';
    }

    if (!normalizePostalCode(formData?.code_postal)) {
      newErrors.code_postal = 'Le code postal est requis';
    } else if (normalizePostalCode(formData?.code_postal)?.length !== 5) {
      newErrors.code_postal = 'Le code postal doit contenir 5 chiffres';
    }

    if (!formData?.ville?.trim()) {
      newErrors.ville = 'La ville est requise';
    }

    setErrors(newErrors);
    return Object.keys(newErrors)?.length === 0;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();

    const payload = buildSubmitPayload(formData);

    if (!user) {
      try {
        sessionStorage?.setItem(DEMAND_DRAFT_STORAGE_KEY, JSON.stringify(payload));
      } catch (error) {
        console.warn('Impossible de sauvegarder temporairement la demande:', error);
      }

      setErrors((prev) => ({
        ...prev,
        submit: 'Connectez-vous ou creez un compte pour publier votre demande. Votre saisie a ete conservee.'
      }));

      navigate('/authentification', { state: { from: '/creer-demande' } });
      return;
    }

    if (!validateForm()) return;

    setLoading(true);

    try {
      const normalizedCategory = normalizeListingCategory(payload?.categorie_slug, categoryOptions);
      const { error } = await demandeService?.createDemande({
        ...payload,
        categorie_slug: normalizedCategory || payload?.categorie_slug,
        library_image_id: payload?.library_image_id,
        statut: 'open',
        moderation_status: 'pending'
      });

      if (error) {
        setErrors({ submit: error?.message || 'Erreur lors de la creation de la demande' });
        return;
      }

      sessionStorage?.removeItem(DEMAND_DRAFT_STORAGE_KEY);
      navigate('/mes-annonces#demandes');
    } catch (error) {
      console.error("Erreur d'envoi :", error);
      setErrors({ submit: 'Une erreur est survenue. Veuillez reessayer.' });
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
      formData?.code_postal ? `Code postal: ${formData?.code_postal}` : '',
      formData?.ville ? `Ville: ${formData?.ville}` : '',
      formData?.rayon_km ? `Rayon: ${formData?.rayon_km} km` : ''
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
        title: `Genere 5 titres humoristiques et accrocheurs pour une demande de location de materiel. Categorie: ${categoryLabel}${formData?.titre ? `, Idee: ${formData?.titre}` : ''}. Retourne uniquement les titres, un par ligne, sans numerotation.`,
        description: `Genere une description humoristique, claire et sympathique pour une demande de location de materiel. Titre: ${formData?.titre}. Categorie: ${categoryLabel}.${baseContext} La description doit etre en francais, rester utile et inclure le besoin principal ainsi que les contraintes importantes. Maximum 180 mots.`
      },
      professional: {
        title: `Genere 5 titres professionnels, clairs et rassurants pour une demande de location de materiel. Categorie: ${categoryLabel}${formData?.titre ? `, Idee: ${formData?.titre}` : ''}. Retourne uniquement les titres, un par ligne, sans numerotation.`,
        description: `Genere une description professionnelle, precise et convaincante pour une demande de location de materiel. Titre: ${formData?.titre}. Categorie: ${categoryLabel}.${baseContext} La description doit etre en francais, structuree et mentionner le besoin exact ainsi que les contraintes logistiques utiles. Maximum 180 mots.`
      },
      technical: {
        title: `Genere 5 titres techniques et precis pour une demande de location de materiel. Categorie: ${categoryLabel}${formData?.titre ? `, Idee: ${formData?.titre}` : ''}. Retourne uniquement les titres, un par ligne, sans numerotation.`,
        description: `Genere une description technique et detaillee pour une demande de location de materiel. Titre: ${formData?.titre}. Categorie: ${categoryLabel}.${baseContext} La description doit etre en francais, orientee specifications et mentionner les caracteristiques attendues ainsi que les contraintes d'usage. Maximum 180 mots.`
      }
    };

    return stylePrompts?.[style]?.[fieldType] || '';
  };

  const handleOpenStyleSelector = (fieldType) => {
    if (fieldType === 'description' && (!formData?.titre || !formData?.categorie_slug)) {
      toast?.error('Veuillez renseigner le titre et la categorie avant de generer la description');
      return;
    }

    if (fieldType === 'title' && !formData?.categorie_slug) {
      toast?.error('Veuillez selectionner une categorie avant de generer le titre');
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
      toast?.success('Titre applique avec succes');
    } else {
      handleChange('description', option);
      toast?.success('Description appliquee avec succes');
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
    <ActionPageShell
      maxWidth="max-w-5xl"
      hero={(
        <ActionHero
          eyebrow="Nouvelle demande"
          title="Dites ce que vous cherchez"
          subtitle="Le but ici: decrire le besoin, poser la zone, puis publier."
          pills={[
            { label: 'Besoin clair', icon: 'Sparkles' },
            { label: 'Ville + rayon', icon: 'MapPin' },
            { label: 'Publication rapide', icon: 'Send' },
            !user ? { label: 'Compte au moment de publier', icon: 'Info' } : null
          ]?.filter(Boolean)}
          actions={(
            <Button type="button" variant="outline" onClick={() => navigate(-1)} iconName="ArrowLeft">
              Retour
            </Button>
          )}
          aside={(
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">A retenir</p>
              <div className="grid gap-3">
                <div className="rounded-3xl border border-sky-200 bg-sky-50/90 p-4">
                  <p className="text-sm font-semibold text-slate-950">1. Decrire</p>
                  <p className="mt-1 text-sm font-medium text-sky-700">Objet + categorie</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50/90 p-4">
                  <p className="text-sm font-semibold text-slate-950">2. Situer</p>
                  <p className="mt-1 text-sm font-medium text-slate-600">Ville + rayon</p>
                </div>
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50/90 p-4">
                  <p className="text-sm font-semibold text-slate-950">3. Publier</p>
                  <p className="mt-1 text-sm font-medium text-emerald-700">La plateforme prend le relais</p>
                </div>
              </div>
            </div>
          )}
          tone="sky"
        />
      )}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {!user ? (
          <ActionCard className="border-sky-200/80 bg-sky-50/90">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sky-700 shadow-sm">
                <Icon name="Info" size={18} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-950">Vous pouvez preparer la demande maintenant.</p>
                <p className="text-sm text-sky-800">Le compte sera demande seulement au moment de publier.</p>
              </div>
            </div>
          </ActionCard>
        ) : null}

        <ActionCard className="overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Le principal</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">Remplir puis publier</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">Titre</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">Lieu</span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Publication</span>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_220px]">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-sm font-medium text-foreground">Titre *</label>
                  <button
                    type="button"
                    onClick={() => handleOpenStyleSelector('title')}
                    disabled={isGenerating || !formData?.categorie_slug}
                    className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    IA
                  </button>
                </div>
                <Input
                  type="text"
                  placeholder="Ex: Recherche perceuse sans fil"
                  value={formData?.titre}
                  onChange={(e) => handleChange('titre', e?.target?.value)}
                  error={errors?.titre}
                />
                {errors?.titre ? <p className="mt-1 text-sm text-error">{errors?.titre}</p> : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Categorie *</label>
                <Select
                  options={categoryOptions}
                  value={formData?.categorie_slug}
                  onChange={(value) => handleChange('categorie_slug', value)}
                  placeholder="Choisir"
                />
                {errors?.categorie_slug ? <p className="mt-1 text-sm text-error">{errors?.categorie_slug}</p> : null}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="block text-sm font-medium text-foreground">Description *</label>
                <button
                  type="button"
                  onClick={() => handleOpenStyleSelector('description')}
                  disabled={isGenerating || !formData?.titre || !formData?.categorie_slug}
                  className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  IA
                </button>
              </div>
              <textarea
                className="w-full resize-none rounded-2xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                rows={4}
                placeholder="Expliquez rapidement ce qu'il vous faut, pour quoi faire, et s'il y a une contrainte importante."
                value={formData?.description}
                onChange={(e) => handleChange('description', e?.target?.value)}
              />
              {errors?.description ? <p className="mt-1 text-sm text-error">{errors?.description}</p> : null}
            </div>

            <div className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 md:p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Illustration</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Choisissez une image de la bibliothèque pour rendre la demande plus lisible.
                  </p>
                </div>
                {selectedCategory ? (
                  <div className="w-full md:w-[260px]">
                    <Select
                      options={[
                        { value: '', label: 'Toutes les sous-categories' },
                        ...librarySubcategoryOptions
                      ]}
                      value={librarySubcategoryFilter}
                      onChange={(value) => setLibrarySubcategoryFilter(value)}
                      placeholder="Filtrer les sous-categories"
                    />
                  </div>
                ) : null}
              </div>

              {!selectedCategory ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                  Sélectionnez d&apos;abord une catégorie pour afficher les images disponibles.
                </div>
              ) : libraryImagesLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                  Chargement des images...
                </div>
              ) : filteredLibraryImages?.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                  Aucune image disponible pour cette catégorie.
                </div>
              ) : (
                <>
                  {selectedLibraryImage ? (
                    <div className="flex items-center gap-4 rounded-2xl border border-sky-200 bg-white px-4 py-4">
                      <img
                        src={selectedLibraryImage?.public_url}
                        alt={selectedLibraryImage?.alt_text || selectedLibraryImage?.title || 'Illustration sélectionnée'}
                        className="h-20 w-20 rounded-2xl object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-950">{selectedLibraryImage?.title}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {selectedLibraryImage?.subcategoryLabel || 'Sous-categorie'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleChange('library_image_id', null)}
                      >
                        Retirer
                      </Button>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredLibraryImages?.map((image) => {
                      const isSelected = String(formData?.library_image_id || '') === String(image?.id || '');

                      return (
                        <button
                          key={image?.id}
                          type="button"
                          onClick={() => handleChange('library_image_id', image?.id)}
                          className={`overflow-hidden rounded-3xl border bg-white text-left transition-all ${
                            isSelected
                              ? 'border-sky-400 ring-2 ring-sky-200'
                              : 'border-slate-200 hover:border-sky-200 hover:shadow-sm'
                          }`}
                        >
                          <div className="aspect-[4/3] bg-slate-100">
                            <img
                              src={image?.public_url}
                              alt={image?.alt_text || image?.title || 'Illustration de bibliothèque'}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="space-y-2 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-950 line-clamp-2">{image?.title}</p>
                              {isSelected ? (
                                <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                                  Choisie
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs text-slate-500">
                              {image?.subcategoryLabel || 'Sous-categorie'}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 md:p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Zone de recherche</p>
                <p className="mt-1 text-sm text-slate-600">Choisissez une ville, un code postal et un rayon.</p>
              </div>

              <CommuneAutocompleteFields
                fieldsClassName="grid grid-cols-1 items-start gap-4 md:grid-cols-[180px_minmax(0,1fr)_180px]"
                cityValue={formData?.ville}
                postalCodeValue={formData?.code_postal}
                onCityChange={(value) => handleChange('ville', value)}
                onPostalCodeChange={(value) => handleChange('code_postal', value)}
                cityError={errors?.ville}
                postalCodeError={errors?.code_postal}
                cityName="city"
                postalCodeName="postalCode"
                cityPlaceholder="Ex: Paris"
                postalCodePlaceholder="Ex: 75002"
                cityRequired
                postalCodeRequired
              >
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Rayon</label>
                  <Select
                    options={rayonOptions}
                    value={String(formData?.rayon_km || DEFAULT_RAYON_KM)}
                    onChange={(value) => handleChange('rayon_km', Number.parseInt(value, 10) || DEFAULT_RAYON_KM)}
                  />
                </div>
              </CommuneAutocompleteFields>
            </div>

            {errors?.submit ? (
              <div className="rounded-2xl border border-error bg-error/10 p-4">
                <p className="text-sm text-error">{errors?.submit}</p>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => navigate(-1)} className="sm:flex-1">
                Annuler
              </Button>
              <Button type="submit" disabled={loading} className="sm:flex-1">
                {loading ? (
                  <>
                    <Icon name="Loader" size={20} className="animate-spin" />
                    <span>Publication...</span>
                  </>
                ) : (
                  user ? 'Publier la demande' : 'Se connecter pour publier'
                )}
              </Button>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3">
              <p className="text-sm font-medium text-amber-900">
                A la fin, votre demande part en moderation puis la plateforme cherche les bonnes propositions.
              </p>
            </div>
          </form>
        </ActionCard>

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
    </ActionPageShell>
  );
};

export default CreateDemandRequest;
