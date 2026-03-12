import React, { useEffect, useMemo, useState } from 'react';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import faqService from '../../services/faqService';

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
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <main className="flex-1 pt-20 pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <section className="bg-gradient-to-r from-[#17a2b8] to-[#138496] rounded-lg p-8 md:p-12 text-white mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Foire aux questions</h1>
            <p className="text-white/90">Retrouvez les reponses aux questions les plus frequentes.</p>
          </section>

          <section className="mb-6 rounded-lg bg-white p-4 md:p-5 shadow-elevation-1">
            <label htmlFor="faq-search" className="block text-sm font-medium text-foreground mb-2">
              Rechercher dans la FAQ
            </label>
            <div className="relative">
              <Icon
                name="Search"
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <input
                id="faq-search"
                type="text"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event?.target?.value || '');
                  setOpenFaqKey(null);
                }}
                placeholder="Ex: reservation, caution, annulation..."
                className="h-10 w-full rounded-md border border-input bg-background pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              {searchQuery?.trim() && (
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
              )}
            </div>
            {!loading && (
              <p className="mt-2 text-sm text-muted-foreground">
                {filteredFaqs?.length} resultat{filteredFaqs?.length > 1 ? 's' : ''} trouve{filteredFaqs?.length > 1 ? 's' : ''}
              </p>
            )}
          </section>

          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <section className="bg-white rounded-lg shadow-elevation-2 divide-y divide-border">
            {loading ? (
              <div className="p-6 text-muted-foreground">Chargement...</div>
            ) : filteredFaqs?.length === 0 ? (
              <div className="p-6 text-muted-foreground">
                {searchQuery?.trim()
                  ? 'Aucune question ne correspond a votre recherche.'
                  : 'Aucune question disponible pour le moment.'}
              </div>
            ) : (
              filteredFaqs?.map((faq, index) => {
                const faqKey = faq?.id ? String(faq?.id) : `faq-${index}`;

                return (
                  <div key={faqKey} className="p-6">
                    <button
                      type="button"
                      onClick={() => setOpenFaqKey(openFaqKey === faqKey ? null : faqKey)}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <h2 className="text-base md:text-lg font-semibold text-foreground pr-4">
                        {faq?.question || 'Question'}
                      </h2>
                      <Icon
                        name={openFaqKey === faqKey ? 'ChevronUp' : 'ChevronDown'}
                        size={20}
                        className="text-muted-foreground flex-shrink-0"
                      />
                    </button>

                    {openFaqKey === faqKey && (
                      <p className="mt-4 text-muted-foreground whitespace-pre-wrap">{faq?.answer || '-'}</p>
                    )}
                  </div>
                );
              })
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default FAQPage;
