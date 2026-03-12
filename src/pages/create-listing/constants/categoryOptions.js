export const LISTING_CATEGORY_OPTIONS = [
  { value: 'jardinage', label: 'Jardinage' },
  { value: 'electromenager', label: 'Électroménager' },
  { value: 'hi-tech', label: 'Hi-Tech' },
  { value: 'maison-mobilier', label: 'Maison & Mobilier' },
  { value: 'puericulture', label: 'Puériculture' },
  { value: 'evenementiel-loisirs', label: 'Événementiel & Loisirs' },
  { value: 'sports-bien-etre', label: 'Sports & Bien-?tre' },
  { value: 'accessoires-vetements', label: 'Accessoires & Vêtements' },
  { value: 'accessoires-animaux', label: 'Accessoires pour Animaux' },
  { value: 'vehicules-mobilite', label: 'Véhicules & Mobilité' },
  { value: 'bricolage-btp', label: 'Bricolage & BTP' },
  { value: 'logements', label: 'Logements' }
];

export const slugifyCategoryValue = (value) => {
  if (!value) return '';

  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
};

export const mapDatabaseCategoriesToOptions = (rows = []) => {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      const label = String(row?.nom || row?.name || row?.label || '')?.trim();
      const value = String(row?.slug || row?.value || slugifyCategoryValue(label || row?.nom))?.trim();
      if (!value || !label) return null;
      return { value, label };
    })
    .filter(Boolean);
};

export const mergeCategoryOptions = (...optionLists) => {
  const byValue = new Map();

  for (const list of optionLists) {
    if (!Array.isArray(list)) continue;

    for (const rawOption of list) {
      const value = String(rawOption?.value || '')?.trim();
      const label = String(rawOption?.label || value || '')?.trim();

      if (!value || !label) continue;

      if (!byValue.has(value)) {
        byValue.set(value, { value, label });
        continue;
      }

      const existing = byValue.get(value);
      // Prefer the most descriptive label (non-slug looking) when duplicate values exist.
      const existingLooksLikeSlug = existing?.label === existing?.value;
      const incomingLooksLikeSlug = label === value;
      if (existingLooksLikeSlug && !incomingLooksLikeSlug) {
        byValue.set(value, { value, label });
      }
    }
  }

  return [...byValue.values()];
};

export const buildListingCategoryOptions = (dbCategories = []) =>
  mergeCategoryOptions(LISTING_CATEGORY_OPTIONS, mapDatabaseCategoriesToOptions(dbCategories));

export const findCategoryOption = (value, options = LISTING_CATEGORY_OPTIONS) => {
  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  if (!normalizedValue) return null;

  const exact = (options || []).find((option) => option?.value === normalizedValue);
  if (exact) return exact;

  const byLabel = (options || []).find(
    (option) => String(option?.label || '')?.trim()?.toLowerCase() === normalizedValue.toLowerCase()
  );

  return byLabel || null;
};

export const isValidListingCategory = (value, options = LISTING_CATEGORY_OPTIONS) => {
  return Boolean(findCategoryOption(value, options));
};

export const normalizeListingCategory = (value, options = LISTING_CATEGORY_OPTIONS) => {
  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  if (!normalizedValue) return '';

  const resolvedOption = findCategoryOption(normalizedValue, options);
  return resolvedOption?.value || normalizedValue;
};

