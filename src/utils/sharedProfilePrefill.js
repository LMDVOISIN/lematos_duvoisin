const SHARED_PROFILE_PREFILL_STORAGE_KEY = 'ldv_shared_profile_prefill';

const normalizeText = (value = '') =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

const normalizeEmail = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase();

const normalizePhone = (value = '') =>
  String(value || '')
    .trim();

const normalizePostalCode = (value = '') =>
  String(value || '')
    .replace(/\D/g, '')
    .slice(0, 5);

const normalizeBirthDate = (value = '') => {
  const normalized = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
};

const compactSharedProfile = (profile = {}) =>
  Object.entries(profile).reduce((accumulator, [key, value]) => {
    if (value) {
      accumulator[key] = value;
    }
    return accumulator;
  }, {});

export const sanitizeSharedProfile = (profile = {}) => ({
  firstName: normalizeText(profile?.firstName),
  lastName: normalizeText(profile?.lastName),
  pseudonym: normalizeText(profile?.pseudonym),
  email: normalizeEmail(profile?.email),
  phone: normalizePhone(profile?.phone),
  birthDate: normalizeBirthDate(profile?.birthDate),
  addressLine1: normalizeText(profile?.addressLine1),
  postalCode: normalizePostalCode(profile?.postalCode),
  city: normalizeText(profile?.city)
});

export const getStoredSharedProfile = () => {
  if (typeof window === 'undefined') return {};

  try {
    const rawValue = window.localStorage?.getItem(SHARED_PROFILE_PREFILL_STORAGE_KEY);
    if (!rawValue) return {};
    return sanitizeSharedProfile(JSON.parse(rawValue));
  } catch (_error) {
    return {};
  }
};

export const mergeStoredSharedProfile = (profile = {}) => {
  if (typeof window === 'undefined') {
    return sanitizeSharedProfile(profile);
  }

  const currentProfile = getStoredSharedProfile();
  const nextProfile = compactSharedProfile({
    ...currentProfile,
    ...sanitizeSharedProfile(profile)
  });

  try {
    if (Object.keys(nextProfile).length === 0) {
      window.localStorage?.removeItem(SHARED_PROFILE_PREFILL_STORAGE_KEY);
      return {};
    }

    window.localStorage?.setItem(
      SHARED_PROFILE_PREFILL_STORAGE_KEY,
      JSON.stringify(nextProfile)
    );
  } catch (_error) {
    // Ignore storage quota/private mode errors.
  }

  return nextProfile;
};

export const buildSharedProfileFromUser = ({ userProfile, user } = {}) =>
  sanitizeSharedProfile({
    firstName:
      userProfile?.first_name
      || userProfile?.prenom
      || user?.user_metadata?.first_name
      || user?.user_metadata?.prenom,
    lastName:
      userProfile?.last_name
      || userProfile?.nom
      || user?.user_metadata?.last_name
      || user?.user_metadata?.nom,
    pseudonym: userProfile?.pseudo || user?.user_metadata?.pseudo,
    email: userProfile?.email || user?.email || user?.user_metadata?.email,
    phone: userProfile?.phone || user?.user_metadata?.phone,
    birthDate: userProfile?.birth_date || user?.user_metadata?.birth_date,
    addressLine1:
      userProfile?.address
      || user?.user_metadata?.address
      || user?.user_metadata?.postal_address
      || user?.user_metadata?.adresse,
    postalCode:
      userProfile?.postal_code
      || user?.user_metadata?.postal_code
      || user?.user_metadata?.code_postal,
    city:
      userProfile?.city
      || user?.user_metadata?.city
      || user?.user_metadata?.ville
  });

export const splitAddressLine = (addressLine = '') => {
  const normalized = normalizeText(addressLine);
  if (!normalized) {
    return {
      streetNumber: '',
      streetName: ''
    };
  }

  const match = normalized.match(/^(\d+[A-Za-z0-9\s/-]*)\s+(.+)$/);
  if (!match) {
    return {
      streetNumber: '',
      streetName: normalized
    };
  }

  return {
    streetNumber: normalizeText(match?.[1]),
    streetName: normalizeText(match?.[2])
  };
};
