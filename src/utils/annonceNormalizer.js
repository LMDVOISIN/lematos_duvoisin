import storageService from '../services/storageService';
import { normalizeCautionMode } from './cautionMode';

const estTexteNonVide = (value) => typeof value === 'string' && value?.trim() !== '';

const premiereValeur = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && value?.trim() === '') continue;
    return value;
  }
  return null;
};

const versNombre = (value, fallback = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const extrairePrixJour = (annonce = {}) => {
  if (annonce?.price_day_cents !== null && annonce?.price_day_cents !== undefined) {
    return versNombre(annonce?.price_day_cents, 0) / 100;
  }

  return versNombre(
    premiereValeur(
      annonce?.prix_jour,
      annonce?.daily_price,
      annonce?.price_day,
      annonce?.prix
    ),
    0
  );
};

const extraireCheminsPhotos = (annonce = {}) => {
  const photos = Array.isArray(annonce?.photos) ? annonce?.photos : [];

  let images = [];
  if (Array.isArray(annonce?.images)) {
    images = annonce?.images
      ?.map((image) => image?.url || image?.path || image)
      ?.filter(estTexteNonVide);
  } else if (annonce?.images) {
    const imageUnique = annonce?.images?.url || annonce?.images?.path || annonce?.images;
    if (estTexteNonVide(imageUnique)) {
      images = [imageUnique];
    }
  }

  const legacy = [
    annonce?.image,
    annonce?.image_url,
    annonce?.photo_principale
  ]?.filter(estTexteNonVide);

  return [...new Set([...photos, ...images, ...legacy])];
};

const extrairePseudoProprietaire = (annonce = {}, profilProprietaire = null) => {
  return (
    premiereValeur(
      profilProprietaire?.pseudo,
      annonce?.owner?.pseudo,
      annonce?.profiles?.pseudo,
      annonce?.profiles?.pseudonym,
      annonce?.owner_pseudonym,
      annonce?.propriétaire_pseudo
    ) || 'Anonyme'
  );
};

const extraireAvatarProprietaire = (annonce = {}, profilProprietaire = null) => {
  return premiereValeur(
    profilProprietaire?.avatar_url,
    annonce?.owner?.avatar_url,
    annonce?.profiles?.avatar_url
  );
};

export const normaliserAnnonce = (annonce = {}, options = {}) => {
  const ownerProfiles = options?.ownerProfiles || {};
  const proprietaireId =
    premiereValeur(annonce?.owner_id, annonce?.user_id, annonce?.ownerId) || null;
  const profilProprietaire = ownerProfiles?.[proprietaireId] || options?.ownerProfile || null;

  const titre = premiereValeur(annonce?.titre, annonce?.title) || 'Sans titre';
  const categorie =
    premiereValeur(annonce?.categorie, annonce?.category, annonce?.categories?.name) || '';
  const prixJour = extrairePrixJour(annonce);
  const caution = versNombre(
    premiereValeur(
      annonce?.caution,
      annonce?.caution_amount,
      annonce?.deposit_amount,
      annonce?.montant_caution,
      annonce?.deposit
    ),
    0
  );
  const cautionMode = normalizeCautionMode(
    premiereValeur(
      annonce?.caution_mode,
      annonce?.cautionMode,
      annonce?.deposit_mode
    )
  );
  const ville = premiereValeur(annonce?.ville, annonce?.city) || '';
  const codePostal = premiereValeur(annonce?.code_postal, annonce?.postal_code) || '';
  const adresse = premiereValeur(annonce?.adresse, annonce?.address) || '';
  const ligneVille = [codePostal, ville]?.filter(Boolean)?.join(' ');
  const localisation =
    ligneVille ||
    ville ||
    codePostal ||
    'Non specifie';

  const cheminsPhotos = extraireCheminsPhotos(annonce);
  const urlsPhotos = storageService?.getAnnoncePhotoUrls(cheminsPhotos);
  const imagePrincipale = premiereValeur(
    annonce?.image,
    urlsPhotos?.[0],
    annonce?.image_url,
    annonce?.photo_principale
  );

  const pseudoProprietaire = extrairePseudoProprietaire(annonce, profilProprietaire);
  const avatarProprietaire = extraireAvatarProprietaire(annonce, profilProprietaire);
  const note = premiereValeur(annonce?.rating, annonce?.note_moyenne);
  const nombreAvis = versNombre(
    premiereValeur(annonce?.review_count, annonce?.nombre_avis),
    0
  );
  const ownerRating = premiereValeur(
    profilProprietaire?.rating,
    profilProprietaire?.note_moyenne,
    annonce?.owner?.rating,
    annonce?.owner?.note_moyenne,
    annonce?.owner_rating
  );
  const ownerReviewCount = versNombre(
    premiereValeur(
      profilProprietaire?.review_count,
      profilProprietaire?.nombre_avis,
      annonce?.owner?.review_count,
      annonce?.owner?.nombre_avis,
      annonce?.owner_review_count
    ),
    0
  );

  return {
    ...annonce,
    id: annonce?.id,
    titre,
    title: titre,
    categorie,
    category: categorie,
    prix_jour: prixJour,
    dailyPrice: prixJour,
    caution,
    cautionAmount: caution,
    caution_mode: cautionMode,
    cautionMode,
    ville,
    city: ville,
    code_postal: codePostal,
    postal_code: codePostal,
    adresse,
    address: adresse || null,
    location: localisation,
    photos: urlsPhotos,
    image: imagePrincipale || '/assets/images/no_image.png',
    imageAlt: annonce?.image_alt || `Image de ${titre}`,
    rating: note,
    reviewCount: nombreAvis,
    availability: annonce?.disponibilite || annonce?.availability || 'available',
    owner_id: proprietaireId,
    ownerId: proprietaireId,
    ownerPseudonym: pseudoProprietaire,
    ownerInitials: pseudoProprietaire?.substring(0, 2)?.toUpperCase() || 'AN',
    ownerAvatarUrl: avatarProprietaire || null,
    ownerRating,
    ownerReviewCount,
    owner: {
      ...(annonce?.owner || {}),
      id: proprietaireId,
      pseudo: pseudoProprietaire,
      pseudonym: pseudoProprietaire,
      avatar_url: avatarProprietaire || null,
      avatar: avatarProprietaire || null,
      rating: ownerRating,
      note_moyenne: ownerRating,
      review_count: ownerReviewCount,
      nombre_avis: ownerReviewCount,
      created_at:
        premiereValeur(
          profilProprietaire?.created_at,
          annonce?.owner?.created_at,
          annonce?.profiles?.created_at
        ) || annonce?.created_at
    },
    latitude:
      annonce?.latitude !== null && annonce?.latitude !== undefined
        ? versNombre(annonce?.latitude, null)
        : null,
    longitude:
      annonce?.longitude !== null && annonce?.longitude !== undefined
        ? versNombre(annonce?.longitude, null)
        : null,
    description: annonce?.description || '',
    subcategoryId: annonce?.subcategory_id || null,
    type: annonce?.type || 'offre',
    statut: annonce?.statut || null,
    temporarily_disabled: Boolean(annonce?.temporarily_disabled ?? annonce?.temporarilyDisabled),
    temporarilyDisabled: Boolean(annonce?.temporarily_disabled ?? annonce?.temporarilyDisabled),
    published: Boolean(annonce?.published),
    createdAt: annonce?.created_at || null
  };
};

export default normaliserAnnonce;
