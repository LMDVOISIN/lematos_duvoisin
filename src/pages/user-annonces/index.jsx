import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import annonceService from '../../services/annonceService';
import demandeService from '../../services/demandeService';
import storageService from '../../services/storageService';
import userTestingService from '../../services/userTestingService';
import Icon from '../../components/AppIcon';
import {
  ActionCard,
  ActionEmptyState,
  ActionHero,
  ActionPageShell
} from '../../components/page/ActionPageLayout';
import normaliserAnnonce from '../../utils/annonceNormalizer';
import { construireUrlAnnonce } from '../../utils/listingUrl';
import { testingScenarioNeedsReservationSetup } from '../../utils/testingScenarioBriefs';
import DemandesTab from '../user-dashboard/components/DemandesTab';
import {
  buildBrandedAnnonceHeroFile,
  extractAnnoncePhotoReferenceValue,
  extractAnnonceStoragePath,
  isBrandedAnnonceHeroReference,
  isCurrentBrandedAnnonceHeroReference
} from '../../utils/annonceHeroPhoto';

const normalizeAnnonceStatusForUserView = (annonce) => {
  const moderation = String(annonce?.moderation_status || '')?.toLowerCase();
  const statut = String(annonce?.statut || '')?.toLowerCase();
  const isPublished = statut === 'publiee' || statut === 'published' || Boolean(annonce?.published);

  if (isPublished) return 'publiee';
  if (statut === 'refusee' || statut === 'rejected') return 'refusee';
  if (statut === 'en_attente' || statut === 'pending') return 'en_attente';

  if (moderation === 'approved' || moderation === 'validated' || moderation === 'accepted') return 'publiee';
  if (moderation === 'rejected' || moderation === 'refused') return 'refusee';
  if (moderation === 'pending') return 'en_attente';

  return 'inconnu';
};

const getAnnoncePhotos = (annonce) =>
  (Array.isArray(annonce?.photos) ? annonce.photos : [])?.filter(Boolean);

const isAnnonceUsingCurrentBrandedHero = (annonce) => {
  const photos = getAnnoncePhotos(annonce);
  if (!photos?.length) return false;

  return isCurrentBrandedAnnonceHeroReference(
    extractAnnoncePhotoReferenceValue(photos?.[0])
  );
};

const shouldRegenerateAnnonceHero = (annonce) => {
  const photos = getAnnoncePhotos(annonce);
  if (!photos?.length) return false;

  const primaryPhotoReference = extractAnnoncePhotoReferenceValue(photos?.[0]);
  if (!isBrandedAnnonceHeroReference(primaryPhotoReference)) {
    return false;
  }

  const hasBasePhoto = photos?.some(
    (photo) => !isBrandedAnnonceHeroReference(extractAnnoncePhotoReferenceValue(photo))
  );

  if (!hasBasePhoto) return false;

  return !isAnnonceUsingCurrentBrandedHero(annonce);
};

const UserAnnonces = () => {
  const { user, isAuthenticated, testerData } = useAuth();
  const navigate = useNavigate();
  const [annonces, setAnnonces] = useState([]);
  const [demandesCount, setDemandesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [togglingTemporaryDisabledById, setTogglingTemporaryDisabledById] = useState({});
  const [activeTestSession, setActiveTestSession] = useState(null);
  const heroRefreshStartedRef = useRef(false);
  const heroRefreshInProgressRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/authentification');
      return;
    }

    fetchUserAnnonces();
  }, [isAuthenticated, user]);

  useEffect(() => {
    let cancelled = false;

    const loadActiveTestSession = async () => {
      if (!testerData?.id) {
        setActiveTestSession(null);
        return;
      }

      const { data, error: sessionError } = await userTestingService?.getCurrentSession(testerData?.id);
      if (cancelled) return;

      if (sessionError) {
        console.error('Impossible de charger la session de test active :', sessionError);
        setActiveTestSession(null);
        return;
      }

      setActiveTestSession(data || null);
    };

    loadActiveTestSession();

    return () => {
      cancelled = true;
    };
  }, [testerData?.id]);

  const fetchUserAnnonces = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);
      const [
        { data: annoncesData, error: fetchError },
        { data: demandesTotal, error: demandesError }
      ] = await Promise.all([
        annonceService?.getUserAnnonces(user?.id),
        demandeService?.getUserDemandeCount(user?.id)
      ]);

      if (fetchError) {
        setError('Erreur lors du chargement de vos annonces');
        console.error('Fetch annonces error:', fetchError);
      } else {
        heroRefreshStartedRef.current = false;
        const annoncesNormalisees = (annoncesData || [])?.map((annonce) => normaliserAnnonce(annonce));
        setAnnonces(annoncesNormalisees);
      }

      if (demandesError) {
        console.error('Fetch demandes count error:', demandesError);
        setDemandesCount(0);
      } else {
        setDemandesCount(Number(demandesTotal || 0));
      }
    } catch (err) {
      setError('Une erreur est survenue');
      console.error('Fetch error:', err);
      setDemandesCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id || !Array.isArray(annonces) || annonces?.length === 0) return undefined;
    if (heroRefreshStartedRef.current || heroRefreshInProgressRef.current) return undefined;

    const annoncesToRefresh = annonces?.filter(shouldRegenerateAnnonceHero);
    heroRefreshStartedRef.current = true;

    if (annoncesToRefresh?.length === 0) {
      return undefined;
    }

    let isCancelled = false;

    const refreshOutdatedHeroes = async () => {
      heroRefreshInProgressRef.current = true;

      for (const annonce of annoncesToRefresh) {
        if (isCancelled) break;

        const allPhotos = getAnnoncePhotos(annonce);
        const existingHeroPhotos = allPhotos?.filter((photo) =>
          isBrandedAnnonceHeroReference(extractAnnoncePhotoReferenceValue(photo))
        );
        const basePhotos = allPhotos?.filter((photo) =>
          !isBrandedAnnonceHeroReference(extractAnnoncePhotoReferenceValue(photo))
        );
        const heroSourcePhoto = basePhotos?.[0];

        if (!heroSourcePhoto) continue;

        let uploadedHeroPath = null;

        try {
          const brandedHeroFile = await buildBrandedAnnonceHeroFile({
            photo: heroSourcePhoto,
            title: annonce?.titre || annonce?.title,
            city: annonce?.ville || annonce?.city,
            postalCode: annonce?.code_postal || annonce?.postal_code,
            dailyRate: annonce?.prix_jour || annonce?.dailyPrice
          });

          const { data: uploadedHero, error: uploadError } = await storageService?.uploadAnnoncePhoto(
            brandedHeroFile,
            user?.id
          );

          if (uploadError || !uploadedHero?.url) {
            throw uploadError || new Error('Upload du visuel floque impossible.');
          }

          uploadedHeroPath = extractAnnonceStoragePath(uploadedHero?.path || uploadedHero?.url);
          const updatedPhotos = [uploadedHero?.url, ...basePhotos];
          const { data: updatedAnnonce, error: updateError } = await annonceService?.updateAnnonce(
            annonce?.id,
            { photos: updatedPhotos }
          );

          if (updateError) {
            throw updateError;
          }

          const oldHeroPaths = existingHeroPhotos
            ?.map((photo) => extractAnnonceStoragePath(extractAnnoncePhotoReferenceValue(photo)))
            ?.filter(Boolean);

          if (oldHeroPaths?.length > 0) {
            const { error: cleanupError } = await storageService?.deleteFiles(
              'annonce-photos',
              [...new Set(oldHeroPaths)]
            );

            if (cleanupError) {
              console.warn('[user-annonces] Nettoyage ancien flocage impossible:', cleanupError);
            }
          }

          if (!isCancelled) {
            const normalizedAnnonce = normaliserAnnonce(updatedAnnonce || {
              ...annonce,
              photos: updatedPhotos
            });

            setAnnonces((prev) => (prev || [])?.map((item) => (
              item?.id === annonce?.id
                ? normalizedAnnonce
                : item
            )));
          }
        } catch (refreshError) {
          console.warn('[user-annonces] Regeneration du visuel floque ignoree:', refreshError);

          if (uploadedHeroPath) {
            try {
              await storageService?.deleteFile('annonce-photos', uploadedHeroPath);
            } catch (cleanupError) {
              console.warn('[user-annonces] Nettoyage nouveau flocage impossible:', cleanupError);
            }
          }
        }
      }

      heroRefreshInProgressRef.current = false;
    };

    refreshOutdatedHeroes();

    return () => {
      isCancelled = true;
    };
  }, [annonces, user?.id]);

  const handleDelete = async (annonceId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette annonce ?')) {
      return;
    }

    try {
      const { error: deleteError } = await annonceService?.deleteAnnonce(annonceId);

      if (deleteError) {
        alert('Erreur lors de la suppression');
        console.error('Delete error:', deleteError);
      } else {
        fetchUserAnnonces();
      }
    } catch (err) {
      alert('Une erreur est survenue');
      console.error('Delete error:', err);
    }
  };

  const isAnnonceTemporarilyDisabled = (annonce) => Boolean(
    annonce?.temporarily_disabled ?? annonce?.temporarilyDisabled
  );

  const handleToggleTemporaryDisabled = async (annonce) => {
    const annonceId = annonce?.id;
    if (!annonceId) return;

    const nextTemporarilyDisabled = !isAnnonceTemporarilyDisabled(annonce);

    try {
      setTogglingTemporaryDisabledById((prev) => ({
        ...prev,
        [annonceId]: true
      }));

      const { error: updateError } = await annonceService?.updateAnnonce(annonceId, {
        temporarily_disabled: nextTemporarilyDisabled
      });

      if (updateError) {
        alert('Erreur lors de la mise à jour de la visibilité');
        console.error('Toggle temporary disable error:', updateError);
        return;
      }

      setAnnonces((prev) => (prev || [])?.map((item) => {
        if (item?.id !== annonceId) return item;
        return {
          ...item,
          temporarily_disabled: nextTemporarilyDisabled,
          temporarilyDisabled: nextTemporarilyDisabled
        };
      }));
    } catch (err) {
      alert('Une erreur est survenue');
      console.error('Toggle temporary disable error:', err);
    } finally {
      setTogglingTemporaryDisabledById((prev) => ({
        ...prev,
        [annonceId]: false
      }));
    }
  };

  const getStatusBadge = (annonce) => {
    if (isAnnonceTemporarilyDisabled(annonce)) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
          Désactivée temporairement
        </span>
      );
    }

    const statut = normalizeAnnonceStatusForUserView(annonce);
    const statusConfig = {
      en_attente: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
      publiee: { label: 'Publiée', color: 'bg-green-100 text-green-800' },
      refusee: { label: 'Refusée', color: 'bg-red-100 text-red-800' },
      draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-800' },
      archivee: { label: 'Archivée', color: 'bg-slate-100 text-slate-800' },
      pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
      published: { label: 'Publiée', color: 'bg-green-100 text-green-800' },
      rejected: { label: 'Refusée', color: 'bg-red-100 text-red-800' },
      inconnu: { label: 'Statut inconnu', color: 'bg-gray-100 text-gray-800' }
    };

    const config = statusConfig?.[statut] || statusConfig?.inconnu;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config?.color}`}>
        {config?.label}
      </span>
    );
  };

  const activeReferenceContext =
    activeTestSession?.runtimeState?.referenceContext
    || activeTestSession?.runtimeState?.reference_context
    || {};
  const selectedTestListings = Array.isArray(activeReferenceContext?.listings)
    ? activeReferenceContext.listings
    : [];
  const isReferencePreparationSession = (
    String(activeTestSession?.runtimeState?.sessionRole || activeTestSession?.runtimeState?.session_role || '').trim() === 'reference'
    && testingScenarioNeedsReservationSetup(activeTestSession?.scenario || {})
  );
  const publishedTestListings = (annonces || []).filter((annonce) => (
    (String(annonce?.statut || '').toLowerCase() === 'publiee'
      || String(annonce?.statut || '').toLowerCase() === 'published'
      || Boolean(annonce?.published))
    && !Boolean(annonce?.temporarily_disabled ?? annonce?.temporarilyDisabled)
  ));

  const annonceStats = [
    {
      label: 'Publiees',
      value: (annonces || [])?.filter((annonce) => normalizeAnnonceStatusForUserView(annonce) === 'publiee')?.length,
      icon: 'BadgeCheck',
      tone: 'mint'
    },
    {
      label: 'En attente',
      value: (annonces || [])?.filter((annonce) => normalizeAnnonceStatusForUserView(annonce) === 'en_attente')?.length,
      icon: 'Clock3',
      tone: 'warm'
    },
    {
      label: 'Masquees',
      value: (annonces || [])?.filter((annonce) => isAnnonceTemporarilyDisabled(annonce))?.length,
      icon: 'EyeOff',
      tone: 'slate'
    },
    {
      label: 'Demandes',
      value: demandesCount,
      icon: 'FileSearch',
      tone: 'sky'
    }
  ];

  const hasDemandes = demandesCount > 0;

  const isAnnonceAlreadySelectedForTest = (annonce) => {
    const annonceId = String(annonce?.id || '').trim();
    if (!annonceId) return false;

    if (String(activeReferenceContext?.listingId || '').trim() === annonceId) {
      return true;
    }

    return selectedTestListings.some((listing) => String(
      listing?.listingId
      || listing?.id
      || ''
    ).trim() === annonceId);
  };

  useEffect(() => {
    let cancelled = false;

    const syncReferenceTestListings = async () => {
      if (!isReferencePreparationSession || !activeTestSession?.id || !user?.id) {
        return;
      }

      const currentListingIds = selectedTestListings
        .map((listing) => String(listing?.listingId || listing?.id || '').trim())
        .filter(Boolean)
        .sort();
      const publishedListingIds = publishedTestListings
        .map((annonce) => String(annonce?.id || '').trim())
        .filter(Boolean)
        .sort();

      if (currentListingIds.join('|') === publishedListingIds.join('|')) {
        return;
      }

      try {
        const { data, error: syncError } = await annonceService?.syncUserAnnoncesForReferenceTest({
          sessionId: activeTestSession?.id,
          userId: user?.id,
          ownerEmail: user?.email || '',
          existingContext: activeReferenceContext
        });

        if (syncError || cancelled) {
          if (syncError) {
            throw syncError;
          }
          return;
        }

        setActiveTestSession((previous) => (
          previous
            ? {
                ...previous,
                runtimeState: {
                  ...(previous?.runtimeState || {}),
                  referenceContext: data || activeReferenceContext
                }
              }
            : previous
        ));
      } catch (syncError) {
        console.error('Synchronisation automatique des annonces du test impossible :', syncError);
      }
    };

    syncReferenceTestListings();

    return () => {
      cancelled = true;
    };
  }, [
    activeReferenceContext,
    activeTestSession?.id,
    isReferencePreparationSession,
    publishedTestListings,
    selectedTestListings,
    user?.email,
    user?.id
  ]);

  if (loading) {
    return (
      <ActionPageShell
        maxWidth="max-w-7xl"
        hero={(
          <ActionHero
            eyebrow="Mes annonces"
            title="Vous pilotez vos annonces ici"
            subtitle="Offres, demandes, visibilite et actions directes restent au meme endroit."
            tone="mint"
          />
        )}
      >
        <ActionCard className="py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Chargement de vos annonces...</p>
          </div>
        </ActionCard>
      </ActionPageShell>
    );
  }

  return (
    <ActionPageShell
      maxWidth="max-w-7xl"
      hero={(
        <ActionHero
          eyebrow="Mes annonces"
          title="Mes annonces"
          subtitle="Vos offres et vos demandes restent sur la meme page."
          stats={annonceStats}
          tone="mint"
        />
      )}
    >
      <div className="space-y-6">

          {isReferencePreparationSession && (
            <ActionCard className="border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <Icon name="FlaskConical" size={20} className="text-blue-700 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-950">
                    Session de référence active
                  </p>
                  <p className="mt-1 text-sm text-blue-900">
                    Pendant ce test, vos annonces publiées de ce compte sont partagées automatiquement avec le locataire testeur.
                    Vous n'avez rien à sélectionner.
                  </p>
                  <p className="mt-2 text-xs text-blue-800">
                    {selectedTestListings.length > 0
                      ? `${selectedTestListings.length} annonce(s) publiée(s) sont actuellement proposée(s) au miroir.`
                      : publishedTestListings.length > 0
                        ? 'Synchronisation en cours des annonces publiées pour ce test.'
                      : 'Publiez au moins une annonce pour que le miroir puisse commencer ce test.'}
                  </p>
                </div>
              </div>
            </ActionCard>
          )}

          {error && (
            <ActionCard className="border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2">
                <Icon name="AlertCircle" size={20} className="text-red-600" />
                <p className="text-red-800">{error}</p>
              </div>
            </ActionCard>
          )}

          {!loading && annonces?.length === 0 && !hasDemandes && (
            <ActionEmptyState
              icon="PackageOpen"
              title="Vous n'avez pas encore d'annonces ni de demandes"
              description="Commencez à partager votre matériel avec vos voisins."
              action={(
                <div className="flex flex-wrap justify-center gap-3">
                  <Link
                    to="/creer-annonce"
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <Icon name="Plus" size={18} />
                    Créer une annonce
                  </Link>
                  <Link
                    to="/creer-demande"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <Icon name="FileSearch" size={18} />
                    Créer une demande
                  </Link>
                </div>
              )}
            />
          )}

          {!loading && annonces?.length === 0 && hasDemandes && (
            <ActionCard className="border border-slate-200 bg-slate-50/80">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Vos offres</p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-950">Aucune offre publiee pour l instant</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Vos demandes apparaissent plus bas sur cette page.
                  </p>
                </div>
                <Link
                  to="/creer-annonce"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Icon name="Plus" size={18} />
                  Créer une annonce
                </Link>
              </div>
            </ActionCard>
          )}

          {annonces?.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {annonces?.map((annonce) => (
                <div
                  key={annonce?.id}
                  className="bg-white rounded-lg shadow-sm border border-border overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="relative h-48 bg-surface">
                    {annonce?.image ? (
                      <img
                        src={annonce?.image}
                        alt={annonce?.titre || 'Annonce'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Icon name="Image" size={48} className="text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
                      {getStatusBadge(annonce)}
                      <button
                        type="button"
                        onClick={() => handleToggleTemporaryDisabled(annonce)}
                        disabled={Boolean(togglingTemporaryDisabledById?.[annonce?.id])}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium shadow-sm transition-colors ${
                          isAnnonceTemporarilyDisabled(annonce)
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-white/95 text-slate-700 hover:bg-white'
                        } disabled:opacity-60 disabled:cursor-not-allowed`}
                        title={isAnnonceTemporarilyDisabled(annonce)
                          ? "Réactiver l'annonce"
                          : "Désactiver temporairement l'annonce"}
                        aria-label={isAnnonceTemporarilyDisabled(annonce)
                          ? "Réactiver l'annonce"
                          : "Désactiver temporairement l'annonce"}
                      >
                        {togglingTemporaryDisabledById?.[annonce?.id] ? (
                          <Icon name="Loader2" size={14} className="animate-spin" />
                        ) : (
                          <Icon
                            name={isAnnonceTemporarilyDisabled(annonce) ? 'Eye' : 'EyeOff'}
                            size={14}
                          />
                        )}
                        <span>
                          {isAnnonceTemporarilyDisabled(annonce) ? 'Réactiver' : 'Désactiver'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-foreground mb-2 line-clamp-1">
                      {annonce?.titre}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                      {annonce?.description}
                    </p>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-primary font-bold text-lg">
                        {annonce?.prix_jour ? `${Number(annonce?.prix_jour)?.toFixed(2)}€/jour` : 'Prix non défini'}
                      </div>
                    </div>

                    {isReferencePreparationSession && isAnnonceAlreadySelectedForTest(annonce) && (
                      <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                        Proposée automatiquement pour ce test
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Link
                        to={construireUrlAnnonce(annonce)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-surface text-surface-foreground rounded-lg hover:bg-muted transition-colors text-sm"
                      >
                        <Icon name="Eye" size={16} />
                        Voir
                      </Link>
                      <Link
                        to={`/creer-annonce?edit=${annonce?.id}`}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
                      >
                        <Icon name="Edit" size={16} />
                        Modifier
                      </Link>
                      <button
                        onClick={() => handleDelete(annonce?.id)}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
                      >
                        <Icon name="Trash2" size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {annonces?.length > 0 && (
            <div className="mt-8 text-center">
              <Link
                to="/creer-annonce"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Icon name="Plus" size={20} />
                Créer une nouvelle annonce
              </Link>
            </div>
          )}

          {(annonces?.length > 0 || hasDemandes) && (
            <section id="demandes" className="scroll-mt-32">
              <ActionCard className="p-4 md:p-6">
                <DemandesTab />
              </ActionCard>
            </section>
          )}
      </div>
    </ActionPageShell>
  );
};

export default UserAnnonces;

