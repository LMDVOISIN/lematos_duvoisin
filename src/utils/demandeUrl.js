const nettoyerSegment = (value) => {
  if (!value) return '';

  return String(value)
    ?.normalize('NFD')
    ?.replace(/[\u0300-\u036f]/g, '')
    ?.toLowerCase()
    ?.replace(/[^a-z0-9]+/g, '-')
    ?.replace(/^-+|-+$/g, '')
    ?.replace(/-{2,}/g, '-');
};

export const construireSlugDemande = (demande = {}) => {
  const objet = nettoyerSegment(
    demande?.requested_object_label
    || demande?.titre
    || 'demande'
  );
  const ville = nettoyerSegment(demande?.ville || 'ville');

  return [objet, ville]?.filter(Boolean)?.join('-') || 'demande';
};

export const construireUrlDemande = (demande = {}) => {
  if (!demande?.id) return '/demandes-publiques';
  return `/demandes-publiques/${construireSlugDemande(demande)}/${demande?.id}/`;
};

export default construireUrlDemande;
