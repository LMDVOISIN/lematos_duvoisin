import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../AppIcon';
import legalService from '../../services/legalService';
import { getCandidateSlugs } from '../../utils/legalPagesConfig';
import { ActionCard, ActionHero, ActionPageShell, ActionPill } from '../page/ActionPageLayout';

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
          return;
        }

        setPageData({
          slug,
          title: titleFallback || slug,
          content: '',
          updated_at: null
        });
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
    <ActionPageShell
      maxWidth="max-w-5xl"
      hero={(
        <ActionHero
          eyebrow="Informations légales"
          title={pageData?.title || titleFallback}
          subtitle="Version officielle consultable et imprimable."
          tone="warm"
          pills={[
            { label: `Dernière mise à jour : ${formatDate(pageData?.updated_at)}`, icon: 'CalendarClock' },
            { label: 'Contenu officiel de la plateforme', icon: 'Scale' }
          ]}
        />
      )}
    >
      <ActionCard className="space-y-6">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <ActionPill icon="Scale" className="border-slate-200 bg-slate-50 text-slate-700">
              Lecture officielle
            </ActionPill>
            <ActionPill icon="FileText" className="border-slate-200 bg-slate-50 text-slate-700">
              Référence consultable à tout moment
            </ActionPill>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <Icon name="Printer" size={16} />
            Imprimer cette page
          </button>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            <Icon name="Loader2" size={18} className="animate-spin" />
            Chargement du contenu...
          </div>
        ) : pageData?.content ? (
          <div
            className="prose prose-sm max-w-none text-slate-700 md:prose-base prose-headings:text-slate-950 prose-p:text-slate-700 prose-a:text-primary"
            dangerouslySetInnerHTML={{ __html: pageData?.content }}
          />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            Cette page n'a pas encore de contenu.
          </div>
        )}

        {children}
      </ActionCard>
    </ActionPageShell>
  );
};

export default ManagedLegalPage;
