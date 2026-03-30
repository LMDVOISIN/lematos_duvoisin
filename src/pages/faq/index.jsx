import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../../components/AppIcon';
import faqService from '../../services/faqService';
import { ActionCard, ActionEmptyState, ActionHero, ActionPageShell } from '../../components/page/ActionPageLayout';

const normalizeText = (value = '') =>
  String(value || '')
    ?.normalize('NFD')
    ?.replace(/[\u0300-\u036f]/g, '')
    ?.toLowerCase();

const FAQPage = () => {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openFaqKey, setOpenFaqKey] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadFaqs();
  }, []);

  const loadFaqs = async () => {
    try {
      setLoading(true);
      setError('');
      const { data, error: serviceError } = await faqService?.getFAQs(true);
      if (serviceError) throw serviceError;

      setFaqs(Array?.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erreur chargement FAQ publique:', err);
      setError(err?.message || 'Impossible de charger la FAQ');
      setFaqs([]);
    } finally {
      setLoading(false);
    }
  };

  const normalizedSearch = useMemo(() => normalizeText(searchQuery)?.trim(), [searchQuery]);

  const filteredFaqs = useMemo(() => {
    if (!normalizedSearch) return faqs;

    return faqs?.filter((faq) => {
      const question = normalizeText(faq?.question);
      const answer = normalizeText(faq?.answer);
      return question?.includes(normalizedSearch) || answer?.includes(normalizedSearch);
    });
  }, [faqs, normalizedSearch]);

  return (
    <ActionPageShell
      maxWidth="max-w-5xl"
      hero={(
        <ActionHero
          eyebrow="FAQ"
          title="Questions frequentes"
          subtitle="Cherchez puis ouvrez la bonne reponse."
          tone="mint"
        />
      )}
    >
      <ActionCard className="space-y-5">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
          <label htmlFor="faq-search" className="mb-2 block text-sm font-medium text-foreground">
            Rechercher dans la FAQ
          </label>
          <div className="relative">
            <Icon
              name="Search"
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id="faq-search"
              type="text"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event?.target?.value || '');
                setOpenFaqKey(null);
              }}
              placeholder="Ex: réservation, caution, annulation..."
              className="h-11 w-full rounded-2xl border border-input bg-white pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            {searchQuery?.trim() ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setOpenFaqKey(null);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label="Effacer la recherche"
              >
                <Icon name="X" size={16} />
              </button>
            ) : null}
          </div>
          {!loading ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {filteredFaqs?.length} résultat{filteredFaqs?.length > 1 ? 's' : ''} trouvé{filteredFaqs?.length > 1 ? 's' : ''}
            </p>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            <Icon name="Loader2" size={18} className="animate-spin" />
            Chargement des questions...
          </div>
        ) : filteredFaqs?.length === 0 ? (
          <ActionEmptyState
            icon="SearchX"
            title={searchQuery?.trim() ? 'Aucune réponse trouvée' : 'Aucune question disponible'}
            description={
              searchQuery?.trim()
                ? 'Essayez un mot-clé plus simple ou retirez le filtre.'
                : 'La FAQ publique sera visible ici dès que du contenu sera publié.'
            }
          />
        ) : (
          <div className="space-y-3">
            {filteredFaqs?.map((faq, index) => {
              const faqKey = faq?.id ? String(faq?.id) : `faq-${index}`;
              const isOpen = openFaqKey === faqKey;

              return (
                <div key={faqKey} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setOpenFaqKey(isOpen ? null : faqKey)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-950 md:text-base">
                        {faq?.question || 'Question'}
                      </p>
                      <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                        {isOpen ? 'Réponse affichée' : 'Cliquer pour voir la réponse'}
                      </p>
                    </div>
                    <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${isOpen ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
                      <Icon name={isOpen ? 'ChevronUp' : 'ChevronDown'} size={18} />
                    </span>
                  </button>

                  {isOpen ? (
                    <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-4">
                      <p className="whitespace-pre-wrap text-sm text-slate-700 md:text-base">{faq?.answer || '-'}</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </ActionCard>
    </ActionPageShell>
  );
};

export default FAQPage;
