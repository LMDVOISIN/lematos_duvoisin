import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import InformationsStep from './components/InformationsStep';
import PhotosStep from './components/PhotosStep';
import TarificationStep from './components/TarificationStep';
import LocalisationStep from './components/LocalisationStep';
import DisponibilitesStep from './components/DisponibilitesStep';
import ReglesStep from './components/ReglesStep';
import {
  LISTING_CATEGORY_OPTIONS,
  buildListingCategoryOptions,
  isValidListingCategory,
  normalizeListingCategory
} from './constants/categoryOptions';
import annonceService from '../../services/annonceService';
import storageService from '../../services/storageService';
import categoryService from '../../services/categoryService';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { buildBlockedDateSet } from '../../utils/availabilityRules';
import {
  buildBrandedAnnonceHeroFile,
  extractAnnoncePhotoReferenceValue,
  extractAnnonceStoragePath,
  isBrandedAnnonceHeroReference
} from '../../utils/annonceHeroPhoto';
import { isValidTimeValue as isValidScheduleTime, normalizeTimeValue } from '../../utils/timeSlots';

const CreateListing = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, userProfile, loading: authLoading } = useAuth();
  const editAnnonceId = searchParams?.get('edit');
  const isEditMode = Boolean(editAnnonceId);
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitIntent, setSubmitIntent] = useState(null);
  const [loadingAnnonce, setLoadingAnnonce] = useState(isEditMode);
  const [categoryOptions, setCategoryOptions] = useState(LISTING_CATEGORY_OPTIONS);
  const submitLockRef = useRef(false);
  const createRequestTokenRef = useRef(null);
  const wizardTopRef = useRef(null);
  const stepCardRef = useRef(null);
  const hasMountedStepRef = useRef(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    photos: [],
    dailyRate: '',
    cautionAmount: '',
    address: '',
    addressSource: 'profile',
    unavailableDates: [],
    temporarilyDisabled: false,
    rules: ''
  });

  const mapperPhotosExistantes = (photos) => {
    if (!Array.isArray(photos)) return [];

    return photos
      ?.map((photo, index) => {
        const source =
          typeof photo === 'string'
            ? photo
            : photo?.url || photo?.preview || photo?.path || null;

        if (!source) return null;

        const normalizedUrl = storageService?.getAnnoncePhotoUrl(source) || source;
        return {
          id: `existing-${index}-${Date.now()}`,
          preview: normalizedUrl,
          url: normalizedUrl,
          source,
          generatedHero: isBrandedAnnonceHeroReference(source) || isBrandedAnnonceHeroReference(normalizedUrl)
        };
      })
      ?.filter(Boolean);
  };

  const versNombreOuNull = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const nombre = Number(value);
    return Number.isFinite(nombre) ? nombre : null;
  };

  const normalizeUnavailableDates = (values = []) =>
    Array.from(buildBlockedDateSet(values || [])?.values())?.sort();

  const getOrCreateClientSubmissionToken = () => {
    if (isEditMode) return null;
    if (createRequestTokenRef.current) return createRequestTokenRef.current;

    const randomUuid = globalThis?.crypto?.randomUUID;
    createRequestTokenRef.current = typeof randomUuid === 'function'
      ? randomUuid.call(globalThis.crypto)
      : `annonce-${Date.now()}-${Math.random()?.toString(36)?.slice(2, 10)}`;

    return createRequestTokenRef.current;
  };

  const construirePayloadAnnonce = (uploadedPhotos, statut, published = false, clientSubmissionToken = null) => ({
    titre: formData?.title,
    description: formData?.description,
    categorie: formData?.category,
    photos: uploadedPhotos,
    prix_jour: versNombreOuNull(formData?.dailyRate),
    caution: versNombreOuNull(formData?.cautionAmount),
    // Mode de garantie unique: empreinte bancaire (CB).
    caution_mode: 'cb',
    address: formData?.address,
    city: formData?.city,
    postal_code: formData?.postalCode,
    latitude: versNombreOuNull(formData?.latitude),
    longitude: versNombreOuNull(formData?.longitude),
    unavailable_dates: normalizeUnavailableDates(formData?.unavailableDates),
    temporarily_disabled: Boolean(formData?.temporarilyDisabled),
    rules: formData?.rules,
    pickup_days: formData?.pickupDays || [],
    return_days: formData?.returnDays || [],
    pickup_time_start: normalizeTimeValue(formData?.pickupTimeStart) || null,
    pickup_time_end: normalizeTimeValue(formData?.pickupTimeEnd) || null,
    return_time_start: normalizeTimeValue(formData?.returnTimeStart) || null,
    return_time_end: normalizeTimeValue(formData?.returnTimeEnd) || null,
    equipment_value: versNombreOuNull(formData?.equipmentValue),
    ...(clientSubmissionToken ? { client_submission_token: clientSubmissionToken } : {}),
    statut,
    published
  });

  const ajouterPhotoPreparee = async (photo, uploadedPhotos) => {
    if (photo instanceof File) {
      const { data, error } = await storageService?.uploadAnnoncePhoto(photo, user?.id);
      if (error) throw error;
      if (data?.url) uploadedPhotos?.push(data?.url);
      return;
    }

    if (photo?.file instanceof File) {
      const { data, error } = await storageService?.uploadAnnoncePhoto(photo?.file, user?.id);
      if (error) throw error;
      if (data?.url) uploadedPhotos?.push(data?.url);
      return;
    }

    if (typeof photo === 'string' && photo?.trim()) {
      uploadedPhotos?.push(photo);
      return;
    }

    if (typeof photo?.url === 'string' && photo?.url?.trim()) {
      uploadedPhotos?.push(photo?.url);
      return;
    }

    if (typeof photo?.preview === 'string' && /^https?:\/\//i.test(photo?.preview)) {
      uploadedPhotos?.push(photo?.preview);
    }
  };

  const preparerPhotos = async () => {
    const uploadedPhotos = [];
    const existingHeroPathsToDelete = [];
    const allPhotos = Array.isArray(formData?.photos) ? formData.photos : [];

    const existingGeneratedHeroPhotos = allPhotos?.filter((photo) => {
      const reference = extractAnnoncePhotoReferenceValue(photo);
      const isGeneratedHero =
        Boolean(photo?.generatedHero) || isBrandedAnnonceHeroReference(reference);

      if (isGeneratedHero) {
        const storagePath = extractAnnonceStoragePath(reference);
        if (storagePath) {
          existingHeroPathsToDelete.push(storagePath);
        }
      }

      return isGeneratedHero;
    });

    const basePhotos = allPhotos?.filter((photo) => {
      const reference = extractAnnoncePhotoReferenceValue(photo);
      return !(Boolean(photo?.generatedHero) || isBrandedAnnonceHeroReference(reference));
    });

    const heroSourcePhoto = basePhotos?.[0] || existingGeneratedHeroPhotos?.[0] || null;
    let heroGenerated = false;

    if (heroSourcePhoto) {
      try {
        const brandedHeroFile = await buildBrandedAnnonceHeroFile({
          photo: heroSourcePhoto,
          title: formData?.title,
          city: formData?.city,
          postalCode: formData?.postalCode,
          dailyRate: formData?.dailyRate
        });

        await ajouterPhotoPreparee(brandedHeroFile, uploadedPhotos);
        heroGenerated = true;
      } catch (error) {
        console.warn('[create-listing] Impossible de generer le visuel principal floque:', error);
      }
    }

    if (!heroGenerated && existingGeneratedHeroPhotos?.[0]) {
      await ajouterPhotoPreparee(existingGeneratedHeroPhotos?.[0], uploadedPhotos);
    }

    for (const photo of basePhotos) {
      await ajouterPhotoPreparee(photo, uploadedPhotos);
    }

    return {
      uploadedPhotos: [...new Set(uploadedPhotos)],
      existingHeroPathsToDelete: heroGenerated ? [...new Set(existingHeroPathsToDelete)] : []
    };
  };

  useEffect(() => {
    let isMounted = true;

    const loadCategoryOptions = async () => {
      try {
        const { data, error } = await categoryService?.getCategories();
        if (!isMounted || error) return;
        setCategoryOptions(buildListingCategoryOptions(data || []));
      } catch (error) {
        console.warn('Chargement categories annonce fallback (liste locale conservee):', error);
      }
    };

    loadCategoryOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const chargerAnnonceEnEdition = async () => {
      if (!isEditMode) {
        setLoadingAnnonce(false);
        return;
      }

      if (authLoading) return;

      if (!user?.id) {
        toast?.error('Veuillez vous connecter pour modifier une annonce');
        navigate('/authentification');
        return;
      }

      setLoadingAnnonce(true);
      try {
        const { data, error } = await annonceService?.getAnnonceById(editAnnonceId);

        if (error || !data) {
          toast?.error('Annonce introuvable');
          navigate('/mes-annonces');
          return;
        }

        const ownerId = data?.owner_id || data?.user_id;
        if (ownerId && ownerId !== user?.id) {
          toast?.error('Vous ne pouvez pas modifier cette annonce');
          navigate('/mes-annonces');
          return;
        }

        const adresseAnnonce = data?.address || data?.adresse || '';
        const adresseProfilSimple = (userProfile?.address || '')?.trim();
        const villeProfil = (userProfile?.city || '')?.trim();
        const codePostalProfil = (userProfile?.postal_code || '')?.trim();
        const adresseProfilComplete = [adresseProfilSimple, [codePostalProfil, villeProfil]?.filter(Boolean)?.join(' ')]?.filter(Boolean)?.join(', ');
        const normaliserAdresse = (value = '') => String(value)?.trim()?.toLowerCase()?.replace(/\s+/g, ' ');
        const annonceNormalisee = normaliserAdresse(adresseAnnonce);
        const estAdresseProfil = Boolean(adresseAnnonce) && (
          annonceNormalisee === normaliserAdresse(adresseProfilSimple) ||
          annonceNormalisee === normaliserAdresse(adresseProfilComplete)
        );
        const sourceAdresseInitiale = (!adresseAnnonce || estAdresseProfil) ? 'profile' : 'custom';

        setFormData((prev) => ({
          ...prev,
          title: data?.titre || data?.title || '',
          description: data?.description || '',
          category: String(data?.categorie || data?.category || '')?.trim(),
          photos: mapperPhotosExistantes(data?.photos),
          dailyRate:
            data?.prix_jour !== null && data?.prix_jour !== undefined
              ? String(data?.prix_jour)
              : '',
          cautionAmount:
            data?.caution !== null && data?.caution !== undefined
              ? String(data?.caution)
              : '',
          address: adresseAnnonce,
          addressSource: sourceAdresseInitiale,
          city: data?.city || data?.ville || '',
          postalCode: data?.postal_code || data?.code_postal || '',
          latitude: data?.latitude || '',
          longitude: data?.longitude || '',
          unavailableDates: normalizeUnavailableDates(
            Array.isArray(data?.unavailable_dates) ? data?.unavailable_dates : []
          ),
          temporarilyDisabled: Boolean(data?.temporarily_disabled || data?.temporarilyDisabled),
          rules: data?.rules || data?.regles || '',
          pickupDays: Array.isArray(data?.pickup_days) ? data?.pickup_days : [],
          returnDays: Array.isArray(data?.return_days) ? data?.return_days : [],
          pickupTimeStart: normalizeTimeValue(data?.pickup_time_start) || '',
          pickupTimeEnd: normalizeTimeValue(data?.pickup_time_end) || '',
          returnTimeStart: normalizeTimeValue(data?.return_time_start) || '',
          returnTimeEnd: normalizeTimeValue(data?.return_time_end) || '',
          equipmentValue:
            data?.equipment_value !== null && data?.equipment_value !== undefined
              ? String(data?.equipment_value)
              : ''
        }));
      } catch (error) {
        console.error('Load edit annonce error:', error);
        toast?.error('Erreur lors du chargement de l\'annonce');
        navigate('/mes-annonces');
      } finally {
        setLoadingAnnonce(false);
      }
    };

    chargerAnnonceEnEdition();
  }, [isEditMode, editAnnonceId, authLoading, user?.id, userProfile?.address, userProfile?.city, userProfile?.postal_code, navigate]);

  useEffect(() => {
    setFormData((prev) => {
      const current = String(prev?.category || '')?.trim();
      if (!current) return prev;

      const normalized = normalizeListingCategory(current, categoryOptions);
      if (!normalized || normalized === current) return prev;

      return { ...prev, category: normalized };
    });
  }, [categoryOptions]);

  useEffect(() => {
    if (!hasMountedStepRef.current) {
      hasMountedStepRef.current = true;
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      const header = document.querySelector('.header-container');
      const headerHeight = header instanceof HTMLElement ? header.offsetHeight : 72;
      const anchor = stepCardRef.current || wizardTopRef.current;

      if (anchor instanceof HTMLElement) {
        const targetTop = window.scrollY + anchor.getBoundingClientRect().top - headerHeight - 12;
        window.scrollTo({ top: Math.max(0, targetTop), left: 0, behavior: 'auto' });
        return;
      }

      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [currentStep]);

  const steps = [
    { id: 1, label: 'Informations', icon: 'FileText' },
    { id: 2, label: 'Photos', icon: 'Image' },
    { id: 3, label: 'Tarification', icon: 'Euro' },
    { id: 4, label: 'Localisation', icon: 'MapPin' },
    { id: 5, label: 'Disponibilités', icon: 'Calendar' },
    { id: 6, label: 'Règles', icon: 'FileCheck' }
  ];

  const updateFormData = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors?.[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateStep = (step) => {
    const newErrors = {};

    switch (step) {
      case 1:
        if (!formData?.title?.trim()) newErrors.title = 'Le titre est requis';
        if (!formData?.description?.trim()) newErrors.description = 'La description est requise';
        if (!isValidListingCategory(formData?.category, categoryOptions)) newErrors.category = 'La catégorie est requise';
        break;
      case 2:
        if (formData?.photos?.length === 0) newErrors.photos = 'Au moins une photo est requise';
        break;
      case 3:
        if (!formData?.dailyRate || formData?.dailyRate <= 0) newErrors.dailyRate = 'Le tarif journalier est requis';
        if (!formData?.cautionAmount || formData?.cautionAmount <= 0) newErrors.cautionAmount = 'Le montant de la caution est requis';
        break;
      case 4:
        if (!formData?.address?.trim()) newErrors.address = 'L\'adresse est requise';
        break;
      case 5:
        if (!Array.isArray(formData?.pickupDays) || formData?.pickupDays?.length === 0) {
          newErrors.pickupDays = 'Sélectionnez au moins un jour de récupération/restitution';
        }
        if (!isValidScheduleTime(formData?.pickupTimeStart)) newErrors.pickupTimeStart = 'Heure de début de récupération requise';
        if (!isValidScheduleTime(formData?.pickupTimeEnd)) newErrors.pickupTimeEnd = 'Heure de fin de récupération requise';
        if (!isValidScheduleTime(formData?.returnTimeStart)) newErrors.returnTimeStart = 'Heure de début de restitution requise';
        if (!isValidScheduleTime(formData?.returnTimeEnd)) newErrors.returnTimeEnd = 'Heure de fin de restitution requise';
        break;
      case 6:
        // Règles are optional
        break;
      default:
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors)?.length === 0;
  };

  const handleNext = () => {
    if (submitting) return;
    if (validateStep(currentStep)) {
      if (currentStep < 6) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (submitting) return;
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSaveDraft = async () => {
    if (submitLockRef.current) return;

    if (!user) {
      toast?.error('Vous devez être connecté pour créer une annonce');
      navigate('/authentification');
      return;
    }

    submitLockRef.current = true;
    setSubmitIntent('draft');
    setSubmitting(true);
    try {
      const { uploadedPhotos, existingHeroPathsToDelete } = await preparerPhotos();
      const clientSubmissionToken = isEditMode ? null : getOrCreateClientSubmissionToken();
      const annonceData = construirePayloadAnnonce(uploadedPhotos, 'draft', false, clientSubmissionToken);
      const { data, error } = isEditMode
        ? await annonceService?.updateAnnonce(editAnnonceId, annonceData)
        : await annonceService?.createAnnonce(annonceData);
      if (error) throw error;

      if (existingHeroPathsToDelete?.length > 0) {
        const { error: cleanupError } = await storageService?.deleteFiles('annonce-photos', existingHeroPathsToDelete);
        if (cleanupError) {
          console.warn('[create-listing] Nettoyage des anciens visuels principaux impossible:', cleanupError);
        }
      }

      toast?.success(isEditMode ? 'Brouillon mis à jour avec succès' : 'Brouillon sauvegardé avec succès');
      navigate('/mes-annonces');
    } catch (error) {
      console.error('Save draft error:', error);
      toast?.error('Erreur lors de la sauvegarde du brouillon');
    } finally {
      submitLockRef.current = false;
      setSubmitIntent(null);
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (submitLockRef.current) return;
    if (!validateStep(currentStep)) return;

    if (!user) {
      toast?.error('Vous devez être connecté pour créer une annonce');
      navigate('/authentification');
      return;
    }

    submitLockRef.current = true;
    setSubmitIntent('submit');
    setSubmitting(true);
    try {
      const { uploadedPhotos, existingHeroPathsToDelete } = await preparerPhotos();
      const clientSubmissionToken = isEditMode ? null : getOrCreateClientSubmissionToken();
      const annonceData = construirePayloadAnnonce(uploadedPhotos, 'en_attente', false, clientSubmissionToken);
      const { data, error } = isEditMode
        ? await annonceService?.updateAnnonce(editAnnonceId, annonceData)
        : await annonceService?.createAnnonce(annonceData);
      if (error) throw error;

      if (existingHeroPathsToDelete?.length > 0) {
        const { error: cleanupError } = await storageService?.deleteFiles('annonce-photos', existingHeroPathsToDelete);
        if (cleanupError) {
          console.warn('[create-listing] Nettoyage des anciens visuels principaux impossible:', cleanupError);
        }
      }

      toast?.success(
        isEditMode
          ? 'Annonce mise à jour et soumise à modération'
          : 'Annonce soumise pour modération avec succès'
      );
      navigate('/mes-annonces');
    } catch (error) {
      console.error("Erreur d'envoi d'annonce :", error);
      toast?.error('Erreur lors de la soumission de l\'annonce');
    } finally {
      submitLockRef.current = false;
      setSubmitIntent(null);
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <InformationsStep
            formData={formData}
            updateFormData={updateFormData}
            errors={errors}
            categoryOptions={categoryOptions}
          />
        );
      case 2:
        return (
          <PhotosStep
            formData={formData}
            updateFormData={updateFormData}
            errors={errors}
          />
        );
      case 3:
        return (
          <TarificationStep
            formData={formData}
            updateFormData={updateFormData}
            errors={errors}
          />
        );
      case 4:
        return (
          <LocalisationStep
            formData={formData}
            updateFormData={updateFormData}
            errors={errors}
          />
        );
      case 5:
        return (
          <DisponibilitesStep
            formData={formData}
            updateFormData={updateFormData}
            errors={errors}
          />
        );
      case 6:
        return (
          <ReglesStep
            formData={formData}
            updateFormData={updateFormData}
            errors={errors}
            submitCtaLabel={isEditMode ? 'Mettre à jour et soumettre' : 'Soumettre à modération'}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />
      <main ref={wizardTopRef} className="main-content flex-1 container mx-auto px-4 pt-6 pb-8 md:pt-8 md:pb-32">
        {/* En-tête de page */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            {isEditMode ? 'Modifier une annonce' : 'Créer une annonce'}
          </h1>
          <p className="text-muted-foreground">
            {isEditMode
              ? 'Mettez à jour votre annonce puis soumettez-la à nouveau'
              : 'Partagez votre matériel avec la communauté'}
          </p>
        </div>

        {loadingAnnonce ? (
          <div className="bg-white rounded-lg shadow-elevation-1 p-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#17a2b8]" />
            </div>
            <p className="text-center text-sm text-muted-foreground mt-4">Chargement de l'annonce...</p>
          </div>
        ) : (
          <>

          {/* Progress Steps */}
          <div className="bg-white rounded-lg shadow-elevation-1 p-4 md:p-6 mb-6">
            <div className="flex items-center justify-between">
              {steps?.map((step, index) => (
                <React.Fragment key={step?.id}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                        currentStep === step?.id
                          ? 'bg-[#17a2b8] text-white'
                          : currentStep > step?.id
                          ? 'bg-success text-white' :'bg-muted text-muted-foreground'
                      }`}
                    >
                      {currentStep > step?.id ? (
                        <Icon name="Check" size={20} />
                      ) : (
                        <Icon name={step?.icon} size={20} />
                      )}
                    </div>
                    <span className="text-xs mt-2 text-center hidden md:block">{step?.label}</span>
                  </div>
                  {index < steps?.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-2 rounded transition-colors ${
                        currentStep > step?.id ? 'bg-success' : 'bg-muted'
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
            <div className="text-center mt-4">
              <p className="text-sm text-muted-foreground">
                ?tape {currentStep} sur {steps?.length}
              </p>
            </div>
          </div>

          {/* Step Content */}
          <div ref={stepCardRef} className="bg-white rounded-lg shadow-elevation-1 p-4 md:p-6 mb-6">
            {renderStep()}
          </div>

          {/* Navigation Buttons (fixed action bar) */}
          <div className="mt-2 rounded-lg border border-border bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] md:fixed md:inset-x-0 md:bottom-0 md:z-40 md:mt-0 md:rounded-none md:border-x-0 md:border-b-0 md:backdrop-blur">
            <div className="container mx-auto px-3 py-3 md:px-4 md:py-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                  {currentStep > 1 && (
                    <Button
                      variant="outline"
                      iconName="ChevronLeft"
                      disabled={submitting}
                      onClick={handlePrevious}
                    >
                      Précédent
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    iconName="Save"
                    loading={submitting && submitIntent === 'draft'}
                    disabled={submitting}
                    onClick={handleSaveDraft}
                  >
                    Sauvegarder le brouillon
                  </Button>
                </div>

                <div className="w-full sm:w-auto">
                  {currentStep < 6 ? (
                    <Button
                      iconName="ChevronRight"
                      iconPosition="right"
                      disabled={submitting}
                      onClick={handleNext}
                      className="bg-[#17a2b8] hover:bg-[#138496] w-full sm:w-auto"
                    >
                      Suivant
                    </Button>
                  ) : (
                    <Button
                      iconName={isEditMode ? 'Save' : 'Send'}
                      loading={submitting && submitIntent === 'submit'}
                      disabled={submitting}
                      onClick={handleSubmit}
                      className="bg-success hover:bg-success/90 w-full sm:w-auto"
                    >
                      {isEditMode ? 'Mettre à jour et soumettre' : 'Soumettre à modération'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default CreateListing;


