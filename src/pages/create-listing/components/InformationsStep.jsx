import React from 'react';
import { useState, useEffect } from 'react';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import { useChat } from '../../../hooks/useChat';
import toast from 'react-hot-toast';
import { Sparkles } from 'lucide-react';
import StyleSelectorModal from './StyleSelectorModal';
import GeneratedOptionsModal from './GeneratedOptionsModal';
import { LISTING_CATEGORY_OPTIONS } from '../constants/categoryOptions';

const InformationsStep = ({ formData, updateFormData, errors, categoryOptions = LISTING_CATEGORY_OPTIONS }) => {
  const [styleSelectorOpen, setStyleSelectorOpen] = useState(false);
  const [generatedOptionsOpen, setGeneratedOptionsOpen] = useState(false);
  const [currentFieldType, setCurrentFieldType] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [generatedOptions, setGeneratedOptions] = useState(null);
  
  const { response, isLoading, error, sendMessage } = useChat(
    'GEMINI',
    'gemini/gemini-2.5-flash',
    false
  );

  useEffect(() => {
    if (error) {
      toast?.error(error?.message || 'Erreur lors de la génération');
      setGeneratedOptionsOpen(false);
    }
  }, [error]);

  useEffect(() => {
    if (response && !isLoading && selectedStyle) {
      if (currentFieldType === 'title') {
        // Parse title variations from response
        const lines = response?.split('\n')?.filter(line => line?.trim());
        const titles = lines?.map(line => line?.replace(/^[\d\-\.\*]+\s*/, '')?.trim())?.filter(t => t?.length > 0);
        setGeneratedOptions(titles?.slice(0, 5));
      } else {
        // For description, use the full response
        setGeneratedOptions(response);
      }
      setGeneratedOptionsOpen(true);
    }
  }, [response, isLoading, selectedStyle, currentFieldType]);

  const getStylePrompt = (style, fieldType) => {
    const categoryLabel = categoryOptions?.find(opt => opt?.value === formData?.category)?.label || formData?.category;
    
    const stylePrompts = {
      funny: {
        title: `Génère 5 titres humoristiques et accrocheurs avec un ton léger et sympathique pour une annonce de location de matériel. Catégorie: ${categoryLabel}${formData?.title ? `, Contexte: ${formData?.title}` : ''}. Retourne uniquement les titres, un par ligne, sans numérotation.`,
        description: `Génère une description humoristique et accrocheuse avec un ton léger et sympathique pour une annonce de location de matériel. Titre: ${formData?.title}, Catégorie: ${categoryLabel}. La description doit être en français, amusante mais informative, mentionner l'état et les caractéristiques avec humour. Maximum 200 mots.`
      },
      professional: {
        title: `Génère 5 titres professionnels, clairs et convaincants pour inspirer confiance pour une annonce de location de matériel. Catégorie: ${categoryLabel}${formData?.title ? `, Contexte: ${formData?.title}` : ''}. Retourne uniquement les titres, un par ligne, sans numérotation.`,
        description: `Génère une description professionnelle, claire et convaincante pour inspirer confiance pour une annonce de location de matériel. Titre: ${formData?.title}, Catégorie: ${categoryLabel}. La description doit être en français, professionnelle, rassurante, mentionner l'état, les caractéristiques et les avantages. Maximum 200 mots.`
      },
      technical: {
        title: `Génère 5 titres techniques avec spécifications détaillées et vocabulaire précis pour une annonce de location de matériel. Catégorie: ${categoryLabel}${formData?.title ? `, Contexte: ${formData?.title}` : ''}. Retourne uniquement les titres, un par ligne, sans numérotation.`,
        description: `Génère une description technique avec spécifications détaillées et vocabulaire précis pour une annonce de location de matériel. Titre: ${formData?.title}, Catégorie: ${categoryLabel}. La description doit être en français, technique, détaillée, mentionner les spécifications exactes, les caractéristiques techniques et les performances. Maximum 200 mots.`
      }
    };

    return stylePrompts?.[style]?.[fieldType] || '';
  };

  const handleOpenStyleSelector = (fieldType) => {
    if (fieldType === 'description' && (!formData?.title || !formData?.category)) {
      toast?.error('Veuillez renseigner le titre et la catégorie avant de générer la description');
      return;
    }
    if (fieldType === 'title' && !formData?.category) {
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
      updateFormData('title', option);
      toast?.success('Titre appliqué avec succès!');
    } else {
      updateFormData('description', option);
      toast?.success('Description appliquée avec succès!');
    }
    setGeneratedOptionsOpen(false);
    setSelectedStyle(null);
    setGeneratedOptions(null);
  };

  const handleRegenerate = () => {
    if (selectedStyle) {
      const prompt = getStylePrompt(selectedStyle, currentFieldType);
      sendMessage([{ role: 'user', content: prompt }], { temperature: 0.8, max_tokens: 500 });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Informations générales</h2>
        <p className="text-sm text-muted-foreground">Décrivez votre matériel de manière claire et précise</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-foreground">
            Titre de l'annonce <span className="text-error">*</span>
          </label>
          <button
            type="button"
            onClick={() => handleOpenStyleSelector('title')}
            disabled={isLoading || !formData?.category}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 rounded-md hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" />
            Générer avec l'IA
          </button>
        </div>
        <Input
          placeholder="Ex: Perceuse sans fil Bosch Professional"
          value={formData?.title}
          onChange={(e) => updateFormData('title', e?.target?.value)}
          error={errors?.title}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-foreground">
            Description <span className="text-error">*</span>
          </label>
          <button
            type="button"
            onClick={() => handleOpenStyleSelector('description')}
            disabled={isLoading || !formData?.title || !formData?.category}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 rounded-md hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" />
            Générer avec l'IA
          </button>
        </div>
        <textarea
          value={formData?.description}
          onChange={(e) => updateFormData('description', e?.target?.value)}
          placeholder="Décrivez votre matériel: état, caractéristiques, accessoires inclus..."
          rows={6}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
        />
        {errors?.description && (
          <p className="text-sm text-error mt-1">{errors?.description}</p>
        )}
      </div>

      <Select
        label="Catégorie"
        options={categoryOptions}
        value={formData?.category}
        onChange={(value) => updateFormData('category', value)}
        placeholder="Sélectionnez une catégorie"
        error={errors?.category}
        required
      />

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
        isLoading={isLoading}
      />
    </div>
  );
};

export default InformationsStep;
