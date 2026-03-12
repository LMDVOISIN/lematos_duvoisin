import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import annonceService from '../../services/annonceService';
import storageService from '../../services/storageService';
import Icon from '../../components/AppIcon';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import normaliserAnnonce from '../../utils/annonceNormalizer';
import { construireUrlAnnonce } from '../../utils/listingUrl';
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
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [annonces, setAnnonces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [togglingTemporaryDisabledById, setTogglingTemporaryDisabledById] = useState({});
  const heroRefreshStartedRef = useRef(false);
  const heroRefreshInProgressRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/authentification');
      return;
    }

    fetchUserAnnonces();
  }, [isAuthenticated, user]);

  const fetchUserAnnonces = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await annonceService?.getUserAnnonces(user?.id);

      if (fetchError) {
        setError('Erreur lors du chargement de vos annonces');
        console.error('Fetch annonces error:', fetchError);
      } else {
        heroRefreshStartedRef.current = false;
        const annoncesNormalisees = (data || [])?.map((annonce) => normaliserAnnonce(annonce));
        setAnnonces(annoncesNormalisees);
      }
    } catch (err) {
      setError('Une erreur est survenue');
      console.error('Fetch error:', err);
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
    if (!window.confirm('Etes-vous sur de vouloir supprimer cette annonce ?')) {
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
        alert('Erreur lors de la mise ? jour de la visibilite');
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

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen app-page-gradient pt-24 pb-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Chargement de vos annonces...</p>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen app-page-gradient pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Mes Annonces</h1>
            <p className="mt-2 text-muted-foreground">
              Gérez vos annonces et suivez leur statut
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Icon name="AlertCircle" size={20} className="text-red-600" />
                <p className="text-red-800">{error}</p>
              </div>
            </div>
          )}

          {!loading && annonces?.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-border p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon name="Package" size={32} className="text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Vous n'avez pas encore d'annonces
                </h2>
                <p className="text-muted-foreground mb-6">
                  Commencez à partager votre matériel avec vos voisins
                </p>
                <Link
                  to="/creer-annonce"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Icon name="Plus" size={20} />
                  Créer une annonce
                </Link>
              </div>
            </div>
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
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Icon name="Plus" size={20} />
                Creer une nouvelle annonce
              </Link>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
};

export default UserAnnonces;

