import storageService from './storageService';
import { construireUrlAnnonceAbsolue } from '../utils/listingUrl';

const DEFAULT_SITE_ORIGIN = 'https://www.lematosduvoisin.fr';
const INSTAGRAM_HOME_URL = 'https://www.instagram.com/';
const INSTAGRAM_HASHTAGS = ['#Location', '#EntreVoisins', '#LeMatosDuVoisin'];

const SOCIAL_PROMOTION_NETWORKS = Object.freeze([
  {
    id: 'instagram',
    label: 'Instagram',
    icon: 'Instagram',
    idleClassName: 'border-[#E1306C]/20 bg-[#E1306C]/10 text-[#E1306C]',
    activeClassName: 'border-[#E1306C] bg-[#E1306C] text-white',
    buttonClassName: 'bg-[#E1306C] hover:bg-[#c1275c] text-white',
    buttonLabel: 'Ouvrir Instagram',
    shareHint: 'Nous copions une legende prete a coller avec le lien. Telechargez aussi le visuel avant de publier.'
  },
  {
    id: 'facebook',
    label: 'Facebook',
    icon: 'Facebook',
    idleClassName: 'border-[#1877F2]/20 bg-[#1877F2]/10 text-[#1877F2]',
    activeClassName: 'border-[#1877F2] bg-[#1877F2] text-white',
    buttonClassName: 'bg-[#1877F2] hover:bg-[#1664d9] text-white'
  },
  {
    id: 'x',
    label: 'X',
    icon: 'BrandX',
    idleClassName: 'border-slate-900/15 bg-slate-900/5 text-slate-900',
    activeClassName: 'border-slate-900 bg-slate-900 text-white',
    buttonClassName: 'bg-slate-900 hover:bg-slate-800 text-white'
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    icon: 'Linkedin',
    idleClassName: 'border-[#0A66C2]/20 bg-[#0A66C2]/10 text-[#0A66C2]',
    activeClassName: 'border-[#0A66C2] bg-[#0A66C2] text-white',
    buttonClassName: 'bg-[#0A66C2] hover:bg-[#0958a8] text-white'
  },
  {
    id: 'pinterest',
    label: 'Pinterest',
    icon: 'BrandPinterest',
    idleClassName: 'border-[#E60023]/20 bg-[#E60023]/10 text-[#E60023]',
    activeClassName: 'border-[#E60023] bg-[#E60023] text-white',
    buttonClassName: 'bg-[#E60023] hover:bg-[#cc001f] text-white'
  }
]);

const normalizeOrigin = (value) => String(value || '').trim().replace(/\/+$/, '');

const sanitizeFileName = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase();

const copyTextToClipboard = async (value = '') => {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue || typeof window === 'undefined') return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(normalizedValue);
      return true;
    }
  } catch (_error) {
    // Fallback DOM ci-dessous.
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = normalizedValue;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch (_error) {
    return false;
  }
};

const openPopupWindow = (url) => {
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl || typeof window === 'undefined') return false;

  const popupWindow = window?.open('', '_blank');

  if (!popupWindow) {
    return false;
  }

  try {
    popupWindow.opener = null;
  } catch (_error) {
    // Certains navigateurs ignorent l'affectation d'opener sur une fenetre deja ouverte.
  }

  try {
    popupWindow.location.href = normalizedUrl;
  } catch (_error) {
    window.location.assign(normalizedUrl);
  }

  popupWindow?.focus?.();
  return true;
};

const resolveBaseOrigin = (origin = '') => normalizeOrigin(
  origin
  || import.meta.env?.VITE_SITE_URL
  || import.meta.env?.VITE_APP_URL
  || DEFAULT_SITE_ORIGIN
);

const toAbsoluteUrl = (value, origin = '') => {
  const trimmedValue = String(value || '').trim();
  if (!trimmedValue) return '';
  if (/^https?:\/\//i.test(trimmedValue)) return trimmedValue;

  const baseOrigin = resolveBaseOrigin(origin);
  if (!baseOrigin) return trimmedValue;

  if (trimmedValue.startsWith('/')) {
    return `${baseOrigin}${trimmedValue}`;
  }

  return trimmedValue;
};

const appendQueryParams = (rawUrl, params = {}) => {
  const normalizedUrl = String(rawUrl || '').trim();
  if (!normalizedUrl) return '';

  try {
    const url = new URL(normalizedUrl);

    Object.entries(params)?.forEach(([key, value]) => {
      if (value == null || value === '') return;
      url.searchParams.set(key, String(value));
    });

    return url.toString();
  } catch (_error) {
    return normalizedUrl;
  }
};

const resolvePromotionTitle = (annonce = {}) => (
  String(
    annonce?.share_title
    || annonce?.annonce_title
    || annonce?.titre
    || annonce?.title
    || 'Decouvrez cette annonce'
  ).trim()
);

const resolvePromotionDescription = (annonce = {}) => {
  const explicitDescription = String(
    annonce?.share_description
    || annonce?.message
    || annonce?.description
    || ''
  ).trim();

  if (explicitDescription) {
    return explicitDescription;
  }

  const title = resolvePromotionTitle(annonce);
  const city = String(annonce?.ville || annonce?.city || '').trim();

  return city
    ? `${title} est disponible a la location sur Le Matos du Voisin, a ${city}.`
    : `${title} est disponible a la location sur Le Matos du Voisin.`;
};

const resolvePromotionImageReference = (annonce = {}) => {
  if (annonce?.image_url) return annonce?.image_url;
  if (annonce?.imageUrl) return annonce?.imageUrl;
  if (annonce?.image) return annonce?.image;
  if (annonce?.photo_principale) return annonce?.photo_principale;

  if (Array.isArray(annonce?.photos) && annonce?.photos?.length > 0) {
    return annonce?.photos?.[0];
  }

  if (Array.isArray(annonce?.images) && annonce?.images?.length > 0) {
    const firstImage = annonce?.images?.[0];
    if (typeof firstImage === 'string') return firstImage;
    return firstImage?.url || firstImage?.path || null;
  }

  return null;
};

export const resolvePromotionImageUrl = (annonce = {}, origin = '') => {
  const imageReference = resolvePromotionImageReference(annonce);
  if (!imageReference) return '';

  const normalizedReference = String(imageReference).trim();
  if (!normalizedReference) return '';
  if (/^https?:\/\//i.test(normalizedReference)) return normalizedReference;
  if (normalizedReference.startsWith('/')) return toAbsoluteUrl(normalizedReference, origin);

  return storageService?.getAnnoncePhotoUrl(normalizedReference) || '';
};

export const buildPromotionSharePayload = (annonce = {}, origin = '') => {
  const shareUrl = toAbsoluteUrl(
    annonce?.share_url
    || annonce?.url
    || annonce?.actionLink
    || construireUrlAnnonceAbsolue(annonce, origin),
    origin
  );

  return {
    title: resolvePromotionTitle(annonce),
    description: resolvePromotionDescription(annonce),
    url: shareUrl,
    imageUrl: resolvePromotionImageUrl(annonce, origin)
  };
};

export const getSocialPromotionNetworks = () => SOCIAL_PROMOTION_NETWORKS;

const buildInstagramCaptionLines = (payload = {}) => {
  const shareTitle = String(payload?.title || '').trim();
  const shareDescription = String(payload?.description || '').trim();
  const shareUrl = String(payload?.url || '').trim();
  const descriptionSnippet = shareDescription
    ? shareDescription.replace(/\s+/g, ' ').trim().slice(0, 150)
    : '';

  return [
    shareTitle ? `A louer : ${shareTitle}` : '',
    descriptionSnippet,
    shareUrl ? `Lien direct : ${shareUrl}` : '',
    INSTAGRAM_HASHTAGS.join(' ')
  ].filter(Boolean);
};

export const buildInstagramShareText = (payload = {}) => {
  return buildInstagramCaptionLines(payload).join('\n\n');
};

export const downloadPromotionImage = async (payload = {}) => {
  const imageUrl = String(payload?.imageUrl || '').trim();
  if (!imageUrl || typeof window === 'undefined') {
    return { downloaded: false, openedPreview: false };
  }

  const fileNameBase = sanitizeFileName(payload?.title || 'visuel-annonce') || 'visuel-annonce';

  try {
    const response = await fetch(imageUrl);
    if (!response?.ok) {
      throw new Error(`image_fetch_failed_${response?.status}`);
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `${fileNameBase}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);

    return {
      downloaded: true,
      openedPreview: false,
      fileName: `${fileNameBase}.jpg`
    };
  } catch (_error) {
    const openedPreview = openPopupWindow(imageUrl);
    return {
      downloaded: false,
      openedPreview,
      fileName: `${fileNameBase}.jpg`
    };
  }
};

export const shareOnInstagram = async (payload = {}) => {
  const shareText = buildInstagramShareText(payload);
  const copiedText = shareText ? await copyTextToClipboard(shareText) : false;
  const openedInstagram = openPopupWindow(INSTAGRAM_HOME_URL);

  return {
    total: 1,
    openedCount: openedInstagram ? 1 : 0,
    blockedCount: openedInstagram ? 0 : 1,
    openedNetworkIds: openedInstagram ? ['instagram'] : [],
    blockedNetworkIds: openedInstagram ? [] : ['instagram'],
    copiedText,
    shareText
  };
};

export const buildSocialShareUrl = (networkId, payload = {}) => {
  const shareUrl = String(payload?.url || '').trim();
  const shareTitle = String(payload?.title || '').trim();
  const shareDescription = String(payload?.description || payload?.title || '').trim();
  const shareImageUrl = String(payload?.imageUrl || '').trim();

  if (!shareUrl) return '';

  switch (String(networkId || '').toLowerCase()) {
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    case 'instagram':
      return INSTAGRAM_HOME_URL;
    case 'x':
      return `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`;
    case 'linkedin': {
      const linkedinShareUrl = appendQueryParams(shareUrl, {
        utm_source: 'linkedin',
        utm_medium: 'social',
        utm_campaign: 'listing_promotion',
        li_share: '1'
      });
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(linkedinShareUrl)}`;
    }
    case 'pinterest': {
      const params = new URLSearchParams({ url: shareUrl });
      if (shareImageUrl) params.set('media', shareImageUrl);
      if (shareDescription) params.set('description', shareDescription);
      return `https://www.pinterest.com/pin/create/button/?${params.toString()}`;
    }
    default:
      return '';
  }
};

export const buildSelectedSocialShareUrls = (networkIds = [], payload = {}) => {
  const selectedIds = Array.isArray(networkIds) ? networkIds : [];

  return selectedIds
    ?.map((networkId) => {
      const network = SOCIAL_PROMOTION_NETWORKS?.find((item) => item?.id === networkId);
      const url = buildSocialShareUrl(networkId, payload);

      if (!network || !url) return null;
      return { network, url };
    })
    ?.filter(Boolean);
};

export const openSocialShareWindows = (networkIds = [], payload = {}) => {
  const shareTargets = buildSelectedSocialShareUrls(networkIds, payload);
  const openedNetworkIds = [];
  const blockedNetworkIds = [];

  shareTargets?.forEach(({ network, url }) => {
    if (openPopupWindow(url)) {
      openedNetworkIds.push(network?.id);
    } else {
      blockedNetworkIds.push(network?.id);
    }
  });

  return {
    total: shareTargets?.length || 0,
    openedCount: openedNetworkIds?.length,
    blockedCount: blockedNetworkIds?.length,
    openedNetworkIds,
    blockedNetworkIds
  };
};

const socialPromotionService = {
  buildInstagramShareText,
  buildPromotionSharePayload,
  buildSelectedSocialShareUrls,
  buildSocialShareUrl,
  downloadPromotionImage,
  getSocialPromotionNetworks,
  openSocialShareWindows,
  resolvePromotionImageUrl,
  shareOnInstagram
};

export default socialPromotionService;
