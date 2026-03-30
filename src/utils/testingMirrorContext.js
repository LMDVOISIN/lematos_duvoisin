const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const normalizeMirrorListingChoice = (value = {}, fallbackOwnerEmail = '') => {
  const listingTitle = String(
    value?.listingTitle
    || value?.title
    || 'Annonce du test'
  ).trim();
  const actionPath = String(value?.listingPath || value?.actionPath || '').trim();
  const ownerEmail = String(value?.ownerEmail || fallbackOwnerEmail || '').trim();
  const searchHint = String(value?.searchHint || listingTitle).trim();
  const listingId = String(value?.listingId || value?.id || '').trim();

  if (!listingTitle && !actionPath && !listingId) return null;

  return {
    listingId,
    title: listingTitle,
    actionPath,
    actionLabel: String(value?.actionLabel || 'Ouvrir cette annonce').trim(),
    searchHint,
    ownerEmail
  };
};

export const getTestingMirrorGuidance = (runtimeState = {}) => {
  const sessionRole = String(runtimeState?.sessionRole || runtimeState?.session_role || '').trim();
  if (sessionRole && sessionRole !== 'mirror') {
    return null;
  }

  const referenceContext = isObject(runtimeState?.referenceContext)
    ? runtimeState.referenceContext
    : isObject(runtimeState?.reference_context)
      ? runtimeState.reference_context
      : null;

  if (!referenceContext) return null;

  const hasListingsPayload = Array.isArray(referenceContext?.listings)
    || referenceContext?.kind === 'listing_created'
    || referenceContext?.kind === 'owner_scope';

  if (hasListingsPayload) {
    const ownerEmail = String(referenceContext?.ownerEmail || '').trim();
    const listings = (
      Array.isArray(referenceContext?.listings)
        ? referenceContext.listings
        : [
            {
              listingId: referenceContext?.listingId,
              listingTitle: referenceContext?.listingTitle || referenceContext?.title,
              listingPath: referenceContext?.listingPath,
              searchHint: referenceContext?.searchHint,
              ownerEmail: referenceContext?.ownerEmail,
              actionLabel: referenceContext?.actionLabel
            }
          ]
    )
      .map((listing) => normalizeMirrorListingChoice(listing, ownerEmail))
      .filter(Boolean);

    const primaryListing = listings[0] || null;
    const listingTitle = String(
      primaryListing?.title
      || referenceContext?.listingTitle
      || referenceContext?.title
      || "Annonce créée par l'autre participant"
    ).trim();
    const listingPath = String(primaryListing?.actionPath || referenceContext?.listingPath || '').trim();
    const searchHint = String(primaryListing?.searchHint || referenceContext?.searchHint || '').trim();
    const hasMultipleListings = listings.length > 1;
    const isOwnerScope = String(referenceContext?.kind || '').trim() === 'owner_scope';

    return {
      kind: isOwnerScope ? 'owner_scope' : 'listing_created',
      title:
        isOwnerScope
          ? 'Annonces du propriétaire testeur'
          : hasMultipleListings
            ? `${listings.length} annonces pour ce test`
            : 'Annonce pour ce test',
      description:
        listings.length === 0
          ? 'Le système attend encore une annonce publiée pour ce test.'
          : isOwnerScope
            ? 'Seules les annonces du propriétaire testeur sont proposées pour ce test.'
            : hasMultipleListings
              ? 'Choisissez uniquement dans cette liste.'
              : 'Cette annonce a déjà été préparée pour ce test.',
      instruction:
        referenceContext?.messageForMirror
        || (
          listings.length === 0
            ? "Attendez qu'une annonce publiée soit disponible, puis reprenez ce parcours."
            : hasMultipleListings
              ? 'Choisissez une annonce ci-dessous puis lancez la réservation correspondante.'
              : `Retrouvez puis ouvrez l'annonce "${listingTitle}" pour lancer la réservation correspondante.`
        ),
      searchHint,
      ownerEmail,
      actionLabel: listingPath ? 'Ouvrir cette annonce' : '',
      actionPath: listingPath || '',
      actionAvailable: Boolean(listingPath),
      listings
    };
  }

  return {
    kind: String(referenceContext?.kind || 'generic').trim() || 'generic',
    title: String(referenceContext?.title || 'Informations du test').trim(),
    description: String(referenceContext?.description || '').trim(),
    instruction: String(referenceContext?.messageForMirror || '').trim(),
    searchHint: String(referenceContext?.searchHint || '').trim(),
    ownerEmail: String(referenceContext?.ownerEmail || '').trim(),
    actionLabel: String(referenceContext?.actionLabel || '').trim(),
    actionPath: String(referenceContext?.actionPath || '').trim(),
    actionAvailable: Boolean(referenceContext?.actionPath)
  };
};

