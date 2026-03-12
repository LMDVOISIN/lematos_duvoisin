import React, { useEffect, useMemo, useState } from 'react';
import Header from '../navigation/Header';
import Footer from '../Footer';
import Icon from '../AppIcon';
import legalService from '../../services/legalService';
import { getCandidateSlugs } from '../../utils/legalPagesConfig';

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date?.getTime())) return '-';
  return date?.toLocaleDateString('fr-FR');
};

const ManagedLegalPage = ({ slug, titleFallback, fallbackSlugs = [], children = null }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pageData, setPageData] = useState({
    slug,
    title: titleFallback || slug,
    content: '',
    updated_at: null
  });

  const fallbackKey = useMemo(() => (fallbackSlugs || [])?.join('|'), [fallbackSlugs]);

  useEffect(() => {
    let active = true;

    const loadPage = async () => {
      try {
        setLoading(true);
        setError('');

        const candidates = getCandidateSlugs(slug, fallbackSlugs);
        let resolved = null;

        for (const candidate of candidates) {
          const { data, error: requestError } = await legalService?.getLegalPage(candidate);
          if (requestError) throw requestError;
          if (data) {
            resolved = data;
            break;
          }
        }

        if (!active) return;

        if (resolved) {
          setPageData({
            slug: resolved?.slug || slug,
            title: resolved?.title || titleFallback || slug,
            content: resolved?.content || '',
            updated_at: resolved?.updated_at || null
          });
        } else {
          setPageData({
            slug,
            title: titleFallback || slug,
            content: '',
            updated_at: null
          });
        }
      } catch (err) {
        console.error('Erreur chargement page legale publique:', err);
        if (!active) return;
        setError(err?.message || 'Impossible de charger cette page');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadPage();

    return () => {
      active = false;
    };
  }, [slug, titleFallback, fallbackKey]);

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <main className="flex-1 pt-20 pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-elevation-2 p-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">{pageData?.title || titleFallback}</h1>
            <p className="text-sm text-muted-foreground mb-8">
              Derniere mise ? jour : {formatDate(pageData?.updated_at)}
            </p>

            {error && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {loading ? (
              <p className="text-muted-foreground">Chargement...</p>
            ) : pageData?.content ? (
              <div
                className="prose prose-sm md:prose-base max-w-none text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: pageData?.content }}
              />
            ) : (
              <p className="text-muted-foreground">Cette page n'a pas encore de contenu.</p>
            )}

            {children}

            <div className="mt-8 pt-6 border-t border-border">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-surface hover:bg-border rounded-lg text-sm font-medium text-foreground transition-colors"
              >
                <Icon name="Printer" size={16} />
                Imprimer cette page
              </button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ManagedLegalPage;
