import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import { useChat } from '../../../hooks/useChat';

const AI_STYLE_VARIANTS = [
  'ton pedagogique et constructif',
  'ton professionnel et concis',
  'ton cordial et rassurant',
  'ton ferme mais respectueux',
  'ton oriente actions concretes'
];

const REFUSAL_CATEGORIES = [
  { value: 'photos', label: 'Photos de mauvaise qualite' },
  { value: 'description', label: 'Description insuffisante' },
  { value: 'price', label: 'Prix inapproprie' },
  { value: 'category', label: 'Categorie incorrecte' },
  { value: 'prohibited', label: 'Article interdit' },
  { value: 'duplicate', label: 'Annonce en double' },
  { value: 'other', label: 'Autre raison' }
];

function normalizeGeneratedText(text) {
  let value = String(text || '').trim();
  value = value.replace(/^```(?:text)?\s*/i, '').replace(/```$/i, '').trim();
  value = value.replace(/^["“”]+/, '').replace(/["“”]+$/, '').trim();
  return value;
}

const RefusalModal = ({ listing = null, onClose, onSubmit, loading = false }) => {
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('');
  const [generationError, setGenerationError] = useState('');
  const [generatedHistory, setGeneratedHistory] = useState([]);
  const lastAppliedResponseRef = useRef('');

  const { response, isLoading: aiLoading, error: aiError, sendMessage } = useChat(
    'GEMINI',
    'gemini/gemini-2.5-flash',
    false
  );

  const selectedCategoryLabel = useMemo(
    () => REFUSAL_CATEGORIES.find((item) => item?.value === category)?.label || '',
    [category]
  );

  useEffect(() => {
    if (!aiError) return;
    setGenerationError(aiError?.message || 'Erreur lors de la generation du motif');
  }, [aiError]);

  useEffect(() => {
    const next = normalizeGeneratedText(response);
    if (!next || next === lastAppliedResponseRef.current) return;

    lastAppliedResponseRef.current = next;
    setReason(next);
    setGenerationError('');
    setGeneratedHistory((prev) => {
      if (prev.includes(next)) return prev;
      return [next, ...prev].slice(0, 5);
    });
  }, [response]);

  const buildAiPrompt = () => {
    const style = AI_STYLE_VARIANTS[Math.floor(Math.random() * AI_STYLE_VARIANTS.length)];
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const title = listing?.title || listing?.titre || 'Annonce';
    const categoryLabel = listing?.category || listing?.categorie || 'Non precisee';
    const price = Number(listing?.dailyPrice ?? listing?.prix_jour ?? 0);
    const previousSuggestions = generatedHistory.length > 0
      ? generatedHistory.map((item, index) => `${index + 1}. ${item}`).join('\n')
      : 'Aucune suggestion precedente';

    return `Tu es moderateur d'une plateforme de location entre particuliers.
Redige UNE raison detaillee de refus d'annonce en francais (vouvoiement), destinee au propriétaire.

Contexte annonce:
- Titre: ${title}
- Categorie: ${categoryLabel}
- Prix/jour: ${Number.isFinite(price) ? price.toFixed(2) : 'N/A'} EUR
- Categorie de refus choisie par le moderateur: ${selectedCategoryLabel}

Contraintes:
- 2 a 4 phrases
- ${style}
- Respectueux, precis, actionnable
- Expliquer ce qui pose probleme ET ce qu'il faut corriger
- Pas de liste a puces
- Pas de salutation, pas de signature, pas de markdown
- Texte naturel, formulation variee

Suggestions deja generees a eviter (ne pas refaire la meme):
${previousSuggestions}

Genere une nouvelle formulation differente.
Nonce anti-repetition: ${nonce}`;
  };

  const handleGenerateReason = async () => {
    if (!category) {
      window?.alert('Veuillez selectionner une categorie de refus avant de generer un texte');
      return;
    }

    setGenerationError('');

    await sendMessage(
      [{ role: 'user', content: buildAiPrompt() }],
      { temperature: 1.1, top_p: 0.95, max_tokens: 220 }
    );
  };

  const handleSubmit = () => {
    if (!category || !reason?.trim()) {
      window?.alert('Veuillez selectionner une categorie et fournir une raison');
      return;
    }
    onSubmit(reason);
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-elevation-4 max-w-md w-full">
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="XCircle" size={20} className="text-error" />
            <h2 className="text-xl font-semibold text-foreground">Refuser l&apos;annonce</h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading || aiLoading}
            className="p-2 hover:bg-surface rounded-md transition-colors disabled:opacity-50"
            type="button"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Veuillez indiquer la raison du refus. Cette information sera communiquee au propriétaire.
          </p>

          {listing && (
            <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground line-clamp-2">{listing?.title}</p>
              <p>{listing?.category || '-'}</p>
            </div>
          )}

          <Select
            label="Categorie de refus"
            options={REFUSAL_CATEGORIES}
            value={category}
            onChange={setCategory}
            placeholder="Selectionnez une categorie"
            required
          />

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-sm font-medium text-foreground block">
                Raison detaillee <span className="text-error">*</span>
              </label>
              <Button
                type="button"
                variant="outline"
                size="xs"
                iconName="Sparkles"
                disabled={loading || aiLoading || !category}
                loading={aiLoading}
                onClick={handleGenerateReason}
              >
                {generatedHistory.length > 0 ? 'Regenerer IA' : 'Gemini'}
              </Button>
            </div>

            <textarea
              value={reason}
              onChange={(e) => setReason(e?.target?.value || '')}
              placeholder="Expliquez en detail pourquoi cette annonce est refusee..."
              rows={5}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />

            <div className="mt-2 min-h-[18px]">
              {generationError ? (
                <p className="text-xs text-error">{generationError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Generation IA optionnelle. Vous pouvez modifier le texte avant confirmation.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-surface border-t border-border px-6 py-4 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={loading || aiLoading}>
            Annuler
          </Button>
          <Button
            variant="danger"
            iconName="XCircle"
            loading={loading}
            disabled={loading || aiLoading}
            onClick={handleSubmit}
          >
            Confirmer le refus
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RefusalModal;
