const FAVORITES_STORAGE_KEY = 'ldv:favorites:listings';
const FAVORITES_EVENT_NAME = 'ldv:favorites-changed';

const safeWindow = () => (typeof window === 'undefined' ? null : window);

const readFavoriteIds = () => {
  const currentWindow = safeWindow();
  if (!currentWindow?.localStorage) return [];

  try {
    const rawValue = currentWindow.localStorage.getItem(FAVORITES_STORAGE_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsedValue)
      ? parsedValue.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [];
  } catch {
    return [];
  }
};

const writeFavoriteIds = (favoriteIds = []) => {
  const currentWindow = safeWindow();
  if (!currentWindow?.localStorage) return;

  const normalizedIds = Array.from(
    new Set(
      (favoriteIds || [])
        .map((entry) => String(entry || '').trim())
        .filter(Boolean)
    )
  );

  currentWindow.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(normalizedIds));
  currentWindow.dispatchEvent(new CustomEvent(FAVORITES_EVENT_NAME, {
    detail: {
      favoriteIds: normalizedIds
    }
  }));
};

export const favoriteListings = {
  EVENT_NAME: FAVORITES_EVENT_NAME,

  list() {
    return readFavoriteIds();
  },

  isFavorite(listingId) {
    const normalizedId = String(listingId || '').trim();
    if (!normalizedId) return false;
    return readFavoriteIds().includes(normalizedId);
  },

  setFavorite(listingId, shouldBeFavorite) {
    const normalizedId = String(listingId || '').trim();
    if (!normalizedId) return false;

    const currentIds = readFavoriteIds();
    const nextIds = shouldBeFavorite
      ? [...currentIds, normalizedId]
      : currentIds.filter((entry) => entry !== normalizedId);

    writeFavoriteIds(nextIds);
    return shouldBeFavorite;
  },

  toggle(listingId) {
    const nextValue = !favoriteListings.isFavorite(listingId);
    favoriteListings.setFavorite(listingId, nextValue);
    return nextValue;
  }
};

export default favoriteListings;

