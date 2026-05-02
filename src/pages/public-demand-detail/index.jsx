import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { ActionCard, ActionPageShell, ActionPill } from '../../components/page/ActionPageLayout';
import demandeService from '../../services/demandeService';
import { construireUrlDemande } from '../../utils/demandeUrl';
import { getCategoryLabel } from '../create-listing/constants/categoryOptions';
import LocationMap from '../equipment-detail/components/LocationMap';
import ShareButtons from '../equipment-detail/components/ShareButtons';

const formatDate = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date?.getTime())) return '';

  return date?.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

const formatBudget = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'A preciser';
  }

  return `Max ${amount.toFixed(2)} EUR/j`;
};

const cleanText = (value) => String(value || '')
  .replace(/\r/g, '')
  .replace(/\*\*/g, '')
  .replace(/[ \t]+\n/g, '\n')
  .trim();

const normalizeDemandObjectLabel = (value) => cleanText(value)
  .replace(/^demande\s+de\s+location\s+/i, '')
  .replace(/^location\s+/i, '')
  .replace(/^recherche\s+(?:de|d['’])?\s*/i, '')
  .trim();

const buildDemandShareStatement = () => {
  return "Nous cherchons ce type d’objet à louer ; caution fixée par vos soins, vous garantissant paiement et matériel.";
};

const truncateText = (value, maxLength = 180) => {
  const text = cleanText(value).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
};

const buildDemandSeoTitle = ({ requestedObjectLabel = 'materiel', ville = '' } = {}) => {
  const city = String(ville || '').trim();
  return truncateText(
    `Recherche ${requestedObjectLabel}${city ? ` a ${city}` : ''} | Le Matos Du Voisin`,
    65
  );
};

const normalizeComparableText = (value) => normalizeSectionTitle(value)
  ?.normalize('NFD')
  ?.replace(/[\u0300-\u036f]/g, '')
  ?.toLowerCase();

const normalizeSectionTitle = (value) => cleanText(value)
  .replace(/:+$/g, '')
  .trim();

const skipDescriptionSection = (value) => {
  const normalized = normalizeComparableText(value);
  return ['titre', 'categorie']?.includes(normalized);
};

const finalizeSectionContent = (lines = []) => lines
  ?.join('\n')
  ?.replace(/\n{3,}/g, '\n\n')
  ?.split('\n')
  ?.map((line) => cleanText(line))
  ?.join('\n')
  ?.replace(/\n{3,}/g, '\n\n')
  ?.trim();

const extractDescriptionSections = (description) => {
  const rawDescription = String(description || '').replace(/\r/g, '').trim();
  if (!rawDescription) return [];

  const lines = rawDescription.split('\n');
  const sections = [];
  let currentSection = null;

  const flushSection = () => {
    if (!currentSection) return;

    const content = finalizeSectionContent(currentSection?.lines || []);
    if (content) {
      sections.push({
        title: currentSection?.title || 'Details de la demande',
        content
      });
    }

    currentSection = null;
  };

  lines.forEach((line) => {
    const trimmedLine = String(line || '').trim();

    if (!trimmedLine) {
      if (currentSection) {
        currentSection.lines.push('');
      }
      return;
    }

    const headingMatch = trimmedLine.match(/^\*\*(.+?)\*\*\s*:?\s*(.*)$/);
    if (headingMatch) {
      const title = normalizeSectionTitle(headingMatch?.[1]);
      const inlineContent = cleanText(headingMatch?.[2] || '');

      if (skipDescriptionSection(title)) {
        return;
      }

      flushSection();
      currentSection = {
        title: title || 'Details de la demande',
        lines: inlineContent ? [inlineContent] : []
      };
      return;
    }

    if (!currentSection) {
      currentSection = {
        title: 'Details de la demande',
        lines: []
      };
    }

    currentSection.lines.push(trimmedLine);
  });

  flushSection();

  return sections;
};

const isDemandPubliclyVisible = (demande = {}) => {
  const statut = String(demande?.statut || '').toLowerCase();
  const moderation = String(demande?.moderation_status || '')
    ?.normalize('NFD')
    ?.replace(/[\u0300-\u036f]/g, '')
    ?.toLowerCase();

  const isOpen = ['open', 'ouverte', 'ouvert'].includes(statut);
  const isApproved = !moderation || ['approved', 'validated', 'validee'].includes(moderation);

  return isOpen && isApproved;
};

const PublicDemandDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [demande, setDemande] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const loadDemande = async () => {
      if (!id) {
        setLoadError('Demande introuvable.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError('');

      try {
        const { data, error } = await demandeService?.getDemandeById(id);

        if (error || !data) {
          setDemande(null);
          setLoadError('Demande introuvable.');
          return;
        }

        const isOwner = Boolean(user?.id && data?.user_id === user?.id);
        if (!isOwner && !isDemandPubliclyVisible(data)) {
          setDemande(null);
          setLoadError('Cette demande n est pas accessible publiquement.');
          return;
        }

        setDemande(data);
      } catch (error) {
        console.error('Erreur de chargement du detail demande:', error);
        setDemande(null);
        setLoadError('Impossible de charger cette demande pour le moment.');
      } finally {
        setLoading(false);
      }
    };

    void loadDemande();
  }, [id, user?.id]);

  const isOwner = Boolean(user?.id && demande?.user_id === user?.id);
  const categoryLabel = getCategoryLabel(demande?.categorie_slug || demande?.categorie) || 'Demande';
  const subcategoryLabel = demande?.library_image?.subcategoryLabel || demande?.requested_subcategory_name || '';
  const zoneLabel = [demande?.ville, demande?.code_postal]?.filter(Boolean)?.join(' ') || 'Zone de recherche non precisee';
  const detailSections = useMemo(
    () => extractDescriptionSections(demande?.description)?.filter(
      (section) => normalizeComparableText(section?.title) !== 'details de la demande'
    ),
    [demande?.description]
  );
  const mapLocationLabel = [demande?.ville, demande?.code_postal]?.filter(Boolean)?.join(' ') || zoneLabel;
  const mapAddressQuery = [demande?.code_postal, demande?.ville, 'France']?.filter(Boolean)?.join(' ');
  const requestedObjectLabel = normalizeDemandObjectLabel(
    demande?.requested_object_label
    || demande?.titre
    || 'materiel'
  ) || 'materiel';
  const demandShareStatement = buildDemandShareStatement();
  const demandShareTitle = truncateText(demandShareStatement, 110);
  const shareDescription = demandShareStatement;
  const seoTitle = buildDemandSeoTitle({
    requestedObjectLabel,
    ville: demande?.ville
  });
  const socialImageUrl = useMemo(() => {
    const baseOrigin = typeof window !== 'undefined' ? (window.location?.origin || '') : '';
    const rawImage = String(demande?.library_image?.public_url || '/assets/images/android-chrome-192x192-1771179342850.png').trim();
    if (!rawImage) return '';
    if (/^https?:\/\//i.test(rawImage)) return rawImage;
    return baseOrigin ? `${baseOrigin}${rawImage.startsWith('/') ? rawImage : `/${rawImage}`}` : rawImage;
  }, [demande?.library_image?.public_url]);
  const socialImageAlt = demande?.library_image?.alt_text
    || `Demande publique - ${requestedObjectLabel}`;

  const canonicalUrl = useMemo(() => {
    if (!demande?.id || typeof window === 'undefined') return '';
    return `${window.location?.origin || ''}${construireUrlDemande(demande)}`;
  }, [demande]);

  const handlePrimaryAction = () => {
    if (!demande?.id) return;

    if (isOwner) {
      navigate(`/creer-demande?edit=${demande?.id}`);
      return;
    }

    navigate(`/demandes-publiques?demande=${encodeURIComponent(demande?.id)}&action=proposer`);
  };

  return (
    <ActionPageShell maxWidth="max-w-6xl">
      <Helmet>
        <html lang="fr" />
        <title>{seoTitle || 'Demande publique | Le Matos Du Voisin'}</title>
        <meta name="description" content={shareDescription} />
        <meta name="robots" content={loadError ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'} />
        {canonicalUrl ? <link rel="canonical" href={canonicalUrl} /> : null}

        <meta property="og:locale" content="fr_FR" />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="Le Matos Du Voisin" />
        <meta property="og:title" content={demandShareTitle} />
        <meta property="og:description" content={shareDescription} />
        {canonicalUrl ? <meta property="og:url" content={canonicalUrl} /> : null}
        {socialImageUrl ? <meta property="og:image" content={socialImageUrl} /> : null}
        {socialImageAlt ? <meta property="og:image:alt" content={socialImageAlt} /> : null}

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={demandShareTitle} />
        <meta name="twitter:description" content={shareDescription} />
        {socialImageUrl ? <meta name="twitter:image" content={socialImageUrl} /> : null}
        {socialImageAlt ? <meta name="twitter:image:alt" content={socialImageAlt} /> : null}
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/demandes-publiques"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#0f7081] transition-colors hover:text-[#0b5a67]"
          >
            <Icon name="ArrowLeft" size={16} />
            Retour aux demandes publiques
          </Link>
          {demande?.created_at ? (
            <span className="text-sm text-slate-500">
              Publiee le {formatDate(demande?.created_at)}
            </span>
          ) : null}
        </div>

        {loading ? (
          <ActionCard className="py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sky-50 text-sky-700">
              <Icon name="Loader" size={26} className="animate-spin" />
            </div>
            <p className="mt-4 text-sm text-slate-600">Chargement de la demande...</p>
          </ActionCard>
        ) : loadError ? (
          <ActionCard className="py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-700">
              <Icon name="TriangleAlert" size={24} />
            </div>
            <p className="mt-4 text-lg font-semibold text-slate-950">{loadError}</p>
            <div className="mt-6">
              <Button variant="outline" onClick={() => navigate('/demandes-publiques')}>
                Voir les demandes publiques
              </Button>
            </div>
          </ActionCard>
        ) : (
          <>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-6">
                {demande?.library_image?.public_url ? (
                  <ActionCard className="overflow-hidden p-4 sm:p-5">
                    <div className="rounded-[28px] border border-white/85 bg-[radial-gradient(circle_at_top,#ffffff_0%,#f7fbff_54%,#eef6ff_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
                      <div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-[22px] bg-white">
                        <img
                          src={demande?.library_image?.public_url}
                          alt={demande?.library_image?.alt_text || demande?.library_image?.title || demande?.titre || 'Illustration de demande'}
                          className="h-full w-full object-contain object-center p-3 md:p-4"
                        />
                      </div>
                    </div>
                  </ActionCard>
                ) : (
                  <ActionCard className="overflow-hidden p-4 sm:p-5">
                    <div className="flex h-[320px] w-full flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        <Icon name="ImageOff" size={30} />
                      </div>
                      <p className="mt-4 text-lg font-semibold text-slate-900">Illustration en cours</p>
                      <p className="mt-2 max-w-xs text-sm text-slate-600">
                        Une image sera ajoutee automatiquement des qu elle sera prete.
                      </p>
                    </div>
                  </ActionCard>
                )}

                <ActionCard className="bg-[linear-gradient(180deg,#fcfeff_0%,#eef7ff_62%,#f7fbff_100%)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <ActionPill icon="MessageSquare" className="border-[#cce9ee] bg-[#e8fbff] text-[#0f7081]">
                      Demande
                    </ActionPill>
                    <ActionPill icon="Tag" className="border-slate-200 bg-white text-slate-700">
                      {categoryLabel}
                    </ActionPill>
                    {subcategoryLabel ? (
                      <ActionPill icon="FolderTree" className="border-slate-200 bg-white text-slate-700">
                        {subcategoryLabel}
                      </ActionPill>
                    ) : null}
                  </div>

                  <div className="mt-5 max-w-4xl">
                    <h1 className="text-2xl font-bold text-foreground lg:text-3xl">
                      {demande?.titre || 'Demande de materiel'}
                    </h1>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2.5 text-sm">
                    {demande?.ville ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/88 px-3.5 py-2 text-slate-700 shadow-sm">
                        <Icon name="MapPin" size={16} />
                        {zoneLabel}
                      </span>
                    ) : null}
                    {demande?.rayon_km ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/88 px-3.5 py-2 text-slate-700 shadow-sm">
                        <Icon name="LocateFixed" size={16} />
                        Rayon {demande?.rayon_km} km
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/88 px-3.5 py-2 text-slate-700 shadow-sm">
                      <Icon name="BadgeEuro" size={16} />
                      {formatBudget(demande?.prix_max)}
                    </span>
                    {demande?.user?.pseudo ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/88 px-3.5 py-2 text-slate-700 shadow-sm">
                        <Icon name="User" size={16} />
                        {demande?.user?.pseudo}
                      </span>
                    ) : null}
                  </div>
                </ActionCard>

                <ShareButtons
                  heading="Partager cette demande"
                  contentType="demand"
                  title={demandShareTitle}
                  description={shareDescription}
                  shareText={demandShareStatement}
                  url={canonicalUrl}
                  imageUrl={demande?.library_image?.public_url}
                  itemId={demande?.id}
                  itemCategory={categoryLabel}
                />

                <div className="space-y-6">
                  {detailSections?.length > 0 ? (
                    <ActionCard className="space-y-5">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Details utiles
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                          Informations complementaires
                        </h2>
                      </div>

                      <div className="grid gap-4">
                        {detailSections?.map((section, index) => (
                          <div
                            key={`${section?.title}-${index}`}
                            className="rounded-[24px] border border-slate-200 bg-slate-50/85 p-5"
                          >
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                              {section?.title}
                            </p>
                            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">
                              {section?.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    </ActionCard>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4 xl:sticky xl:top-28 xl:self-start">
                <LocationMap
                  title="Zone de recherche"
                  location={mapLocationLabel}
                  address={mapAddressQuery}
                  radiusMeters={Number(demande?.rayon_km || 1) * 1000}
                  subtitle={demande?.rayon_km
                    ? `${demande?.rayon_km} km autour de ${demande?.ville || 'la ville choisie'}`
                    : 'Zone de recherche de la demande'}
                  privacyMessage="Zone approximative affichee publiquement. L adresse exacte n apparait pas sur la fiche."
                  mapHeight={300}
                  className="rounded-[24px] border border-white/75 bg-white/90 shadow-[0_22px_48px_-38px_rgba(15,77,122,0.6)]"
                />

                <ActionCard className="bg-[linear-gradient(180deg,#ffffff_0%,#f5fbff_100%)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Repondre a cette demande
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">
                    Vous avez ce materiel ?
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Proposez une ou plusieurs de vos annonces pour cette zone.
                  </p>
                  <div className="mt-5">
                    <Button onClick={handlePrimaryAction} className="w-full bg-[#0f7081] hover:bg-[#0b5a67]">
                      {isOwner ? 'Modifier ma demande' : 'Proposer mes annonces'}
                    </Button>
                  </div>
                </ActionCard>
              </div>
            </div>

          </>
        )}
      </div>
    </ActionPageShell>
  );
};

export default PublicDemandDetail;
