const FRENCH_COMMUNES_API_URL = 'https://geo.api.gouv.fr/communes';

const toTrimmedText = (value = '') => String(value || '')?.trim();

const normalizeSearchValue = (value = '') =>
  toTrimmedText(value)
    ?.normalize('NFD')
    ?.replace(/[\u0300-\u036f]/g, '')
    ?.toLowerCase();

export const normalizePostalCode = (value = '') =>
  String(value || '')
    ?.replace(/\D/g, '')
    ?.slice(0, 5);

const dedupeSuggestions = (suggestions = []) => {
  const seen = new Set();

  return suggestions?.filter((suggestion) => {
    const key = `${suggestion?.postalCode || ''}|${normalizeSearchValue(suggestion?.city)}`;
    if (!key || seen?.has(key)) return false;
    seen?.add(key);
    return true;
  });
};

const buildSuggestionsFromCommune = (commune, postalCodeQuery = '') => {
  const city = toTrimmedText(commune?.nom);
  if (!city) return [];

  const postalCodes = Array.from(
    new Set(
      (Array.isArray(commune?.codesPostaux) ? commune?.codesPostaux : [])
        ?.map((value) => normalizePostalCode(value))
        ?.filter((value) => value?.length === 5)
    )
  );

  const effectivePostalCodes = postalCodeQuery
    ? postalCodes?.filter((value) => value?.startsWith(postalCodeQuery))
    : postalCodes;

  const expandedPostalCodes = effectivePostalCodes?.length > 0
    ? effectivePostalCodes
    : postalCodes?.length > 0
      ? [postalCodes?.[0]]
      : [''];

  return expandedPostalCodes?.map((postalCode) => ({
    id: `${commune?.code || city}-${postalCode || 'na'}`,
    city,
    postalCode,
    label: [postalCode, city]?.filter(Boolean)?.join(' ')
  }));
};

export const searchFrenchCommunes = async ({
  cityQuery = '',
  postalCodeQuery = '',
  limit = 8,
  signal
} = {}) => {
  const normalizedCityQuery = toTrimmedText(cityQuery);
  const normalizedPostalCodeQuery = normalizePostalCode(postalCodeQuery);

  if (normalizedCityQuery?.length < 2 && normalizedPostalCodeQuery?.length < 2) {
    return [];
  }

  const searchParams = new URLSearchParams({
    fields: 'nom,codesPostaux',
    boost: 'population',
    limit: String(limit)
  });

  if (normalizedCityQuery?.length >= 2) {
    searchParams?.set('nom', normalizedCityQuery);
  }

  if (normalizedPostalCodeQuery?.length >= 2) {
    searchParams?.set('codePostal', normalizedPostalCodeQuery);
  }

  const response = await fetch(`${FRENCH_COMMUNES_API_URL}?${searchParams?.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    },
    signal
  });

  if (!response?.ok) {
    throw new Error(`Recherche commune impossible (${response?.status})`);
  }

  const payload = await response?.json();
  const communes = Array.isArray(payload) ? payload : payload ? [payload] : [];
  const normalizedCitySearch = normalizeSearchValue(normalizedCityQuery);

  const suggestions = dedupeSuggestions(
    communes
      ?.flatMap((commune) => buildSuggestionsFromCommune(commune, normalizedPostalCodeQuery))
      ?.filter((suggestion) => {
        const matchesPostalCode = normalizedPostalCodeQuery
          ? String(suggestion?.postalCode || '')?.startsWith(normalizedPostalCodeQuery)
          : true;
        const matchesCity = normalizedCitySearch
          ? normalizeSearchValue(suggestion?.city)?.includes(normalizedCitySearch)
          : true;

        return matchesPostalCode && matchesCity;
      })
  );

  return suggestions?.slice(0, limit);
};

export default {
  normalizePostalCode,
  searchFrenchCommunes
};
