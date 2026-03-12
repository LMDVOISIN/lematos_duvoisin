import storageService from '../services/storageService';

export const ANNONCE_BRANDED_HERO_PREFIX = 'hero-branded-';
export const ANNONCE_BRANDED_HERO_VERSION = 'v2';
const CURRENT_BRANDED_HERO_PREFIX = `${ANNONCE_BRANDED_HERO_PREFIX}${ANNONCE_BRANDED_HERO_VERSION}-`;

const MAX_CANVAS_DIMENSION = 2200;
const MIN_BRANDED_HERO_WIDTH = 1200;
const MAX_BRANDED_HERO_WIDTH = 1800;
const BRANDED_HERO_ASPECT_RATIO = 1200 / 630;
const TITLE_FONT_FAMILY = 'Arial Black, Arial, sans-serif';
const META_FONT_FAMILY = 'Arial, sans-serif';

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

const isStringValue = (value) => typeof value === 'string' && value.trim() !== '';

const normalizeWhitespace = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const formatDailyRate = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Prix sur demande';
  }

  const formattedAmount = formatDailyRateAmount(value);
  return `${formattedAmount} EUR / jour`;
};

const formatDailyRateAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Prix';
  }

  const hasDecimals = Math.abs(amount % 1) > Number.EPSILON;
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2
  })
    .format(amount)
    .replace(/\u202f/g, ' ')
    .replace(/\xa0/g, ' ');
};

const buildLocationLabel = ({ city, postalCode }) => {
  const label = [normalizeWhitespace(postalCode), normalizeWhitespace(city)]
    .filter(Boolean)
    .join(' ');

  return label || 'Localisation a confirmer';
};

const extractExtensionFromType = (mimeType) => {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
};

const getCanvasOutputType = (sourceType) => {
  if (sourceType === 'image/png') return 'image/png';
  if (sourceType === 'image/webp') return 'image/webp';
  return 'image/jpeg';
};

const splitLongWord = (ctx, word, maxWidth) => {
  const characters = Array.from(word || '');
  if (characters.length === 0) return [''];

  const segments = [];
  let current = '';

  characters.forEach((character) => {
    const candidate = `${current}${character}`;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      segments.push(current);
      current = character;
      return;
    }

    current = candidate;
  });

  if (current) {
    segments.push(current);
  }

  return segments;
};

const wrapText = (ctx, text, maxWidth) => {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [''];

  const words = normalized.split(' ');
  const lines = [];
  let currentLine = '';

  words.forEach((word) => {
    if (!currentLine) {
      if (ctx.measureText(word).width <= maxWidth) {
        currentLine = word;
        return;
      }

      const segments = splitLongWord(ctx, word, maxWidth);
      lines.push(...segments.slice(0, -1));
      currentLine = segments[segments.length - 1] || '';
      return;
    }

    const candidate = `${currentLine} ${word}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
      return;
    }

    lines.push(currentLine);
    if (ctx.measureText(word).width <= maxWidth) {
      currentLine = word;
      return;
    }

    const segments = splitLongWord(ctx, word, maxWidth);
    lines.push(...segments.slice(0, -1));
    currentLine = segments[segments.length - 1] || '';
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
};

const fitWrappedText = ({
  ctx,
  text,
  maxWidth,
  maxHeight,
  maxFontSize,
  minFontSize,
  fontFamily,
  fontWeight = '700',
  lineHeightRatio = 1.1
}) => {
  let fallbackLines = [normalizeWhitespace(text) || ''];
  let fallbackFontSize = minFontSize;

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 2) {
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const lines = wrapText(ctx, text, maxWidth);
    const lineHeight = fontSize * lineHeightRatio;

    fallbackLines = lines;
    fallbackFontSize = fontSize;

    if (lines.length * lineHeight <= maxHeight) {
      return { lines, fontSize, lineHeight };
    }
  }

  return {
    lines: fallbackLines,
    fontSize: fallbackFontSize,
    lineHeight: fallbackFontSize * lineHeightRatio
  };
};

const fitSingleLineFont = ({
  ctx,
  text,
  maxWidth,
  maxFontSize,
  minFontSize,
  fontFamily,
  fontWeight = '700'
}) => {
  const normalized = normalizeWhitespace(text);
  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 1) {
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    if (ctx.measureText(normalized).width <= maxWidth) {
      return fontSize;
    }
  }

  return minFontSize;
};

const drawRoundedRect = (ctx, x, y, width, height, radius) => {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
};

const drawCircle = (ctx, centerX, centerY, radius) => {
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.closePath();
};

const drawImageCover = (ctx, image, targetWidth, targetHeight) => {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const sourceAspectRatio = sourceWidth / sourceHeight;
  const targetAspectRatio = targetWidth / targetHeight;

  let sourceX = 0;
  let sourceY = 0;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;

  if (sourceAspectRatio > targetAspectRatio) {
    cropWidth = sourceHeight * targetAspectRatio;
    sourceX = (sourceWidth - cropWidth) / 2;
  } else {
    cropHeight = sourceWidth / targetAspectRatio;
    sourceY = (sourceHeight - cropHeight) / 2;
  }

  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    cropWidth,
    cropHeight,
    0,
    0,
    targetWidth,
    targetHeight
  );
};

const toPublicAnnoncePhotoUrl = (reference) => {
  if (!isStringValue(reference)) return null;
  if (/^(blob:|data:|https?:\/\/)/i.test(reference)) return reference;
  return storageService.getAnnoncePhotoUrl(reference) || reference;
};

const loadImageElement = (src) =>
  new Promise((resolve, reject) => {
    const image = new window.Image();
    image.decoding = 'async';
    if (/^https?:\/\//i.test(src)) {
      image.crossOrigin = 'anonymous';
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Impossible de charger l'image source: ${src}`));
    image.src = src;
  });

const resolvePhotoSource = (photo) => {
  if (photo?.file instanceof File) {
    const objectUrl = URL.createObjectURL(photo.file);
    return {
      src: objectUrl,
      sourceType: photo.file.type || 'image/jpeg',
      cleanup: () => URL.revokeObjectURL(objectUrl)
    };
  }

  const directReference = extractAnnoncePhotoReferenceValue(photo);
  const src = toPublicAnnoncePhotoUrl(directReference);
  if (!src) {
    return null;
  }

  return {
    src,
    sourceType: 'image/jpeg',
    cleanup: () => {}
  };
};

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Impossible de convertir l'image filigranee en fichier."));
    }, type, quality);
  });

export const extractAnnoncePhotoReferenceValue = (photo) => {
  if (!photo) return '';
  if (typeof photo === 'string') return photo;
  if (isStringValue(photo?.path)) return photo.path;
  if (isStringValue(photo?.url)) return photo.url;
  if (isStringValue(photo?.preview)) return photo.preview;
  if (photo?.file instanceof File && isStringValue(photo.file.name)) return photo.file.name;
  return '';
};

export const extractAnnonceStoragePath = (reference) => {
  const value = normalizeWhitespace(reference);
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, '');

  try {
    const parsedUrl = new URL(value);
    const markers = [
      '/storage/v1/object/public/annonce-photos/',
      '/storage/v1/render/image/public/annonce-photos/'
    ];

    for (const marker of markers) {
      const markerIndex = parsedUrl.pathname.indexOf(marker);
      if (markerIndex === -1) continue;

      const path = parsedUrl.pathname.slice(markerIndex + marker.length);
      return decodeURIComponent(path);
    }
  } catch (error) {
    console.warn('[annonceHeroPhoto] URL de photo non analysable:', error);
  }

  return null;
};

export const isBrandedAnnonceHeroReference = (reference) => {
  const rawValue = normalizeWhitespace(reference).toLowerCase();
  const storagePath = normalizeWhitespace(extractAnnonceStoragePath(reference) || '').toLowerCase();

  return rawValue.includes(ANNONCE_BRANDED_HERO_PREFIX) || storagePath.includes(ANNONCE_BRANDED_HERO_PREFIX);
};

export const isCurrentBrandedAnnonceHeroReference = (reference) => {
  const rawValue = normalizeWhitespace(reference).toLowerCase();
  const storagePath = normalizeWhitespace(extractAnnonceStoragePath(reference) || '').toLowerCase();
  const currentPrefix = CURRENT_BRANDED_HERO_PREFIX.toLowerCase();

  return rawValue.includes(currentPrefix) || storagePath.includes(currentPrefix);
};

export const buildBrandedAnnonceHeroFile = async ({
  photo,
  title,
  city,
  postalCode,
  dailyRate
}) => {
  const photoSource = resolvePhotoSource(photo);
  if (!photoSource?.src) {
    throw new Error("Aucune photo source disponible pour generer le visuel principal.");
  }

  try {
    const image = await loadImageElement(photoSource.src);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;

    if (!sourceWidth || !sourceHeight) {
      throw new Error("Dimensions d'image invalides pour le visuel principal.");
    }

    const dominantDimension = Math.min(MAX_CANVAS_DIMENSION, Math.max(sourceWidth, sourceHeight));
    const width = Math.max(
      MIN_BRANDED_HERO_WIDTH,
      Math.min(MAX_BRANDED_HERO_WIDTH, Math.round(dominantDimension))
    );
    const height = Math.max(1, Math.round(width / BRANDED_HERO_ASPECT_RATIO));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error("Contexte canvas indisponible pour la generation de l'image.");
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    drawImageCover(ctx, image, width, height);

    const subtleLight = ctx.createLinearGradient(0, 0, width * 0.75, height * 0.9);
    subtleLight.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
    subtleLight.addColorStop(0.45, 'rgba(255, 255, 255, 0.06)');
    subtleLight.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = subtleLight;
    ctx.fillRect(0, 0, width, height);

    const safeInsetX = clampNumber(width * 0.17, 140, 220);
    const safeInsetY = clampNumber(height * 0.18, 92, 146);
    const safeWidth = width - safeInsetX * 2;
    const safeHeight = height - safeInsetY * 2;
    const outerPadding = safeInsetX;
    const cardRadius = clampNumber(width * 0.022, 18, 28);
    const priceBadgeRadius = clampNumber(width * 0.115, 78, 120);
    const priceBadgeCenterX = safeInsetX + safeWidth * 0.82;
    const priceBadgeCenterY = safeInsetY + safeHeight * 0.28;
    const leftPanelWidth = Math.min(
      safeWidth * 0.5,
      priceBadgeCenterX - priceBadgeRadius - safeInsetX - width * 0.025
    );
    const panelX = safeInsetX;
    const panelY = safeInsetY;
    const panelPaddingX = clampNumber(width * 0.024, 18, 32);
    const panelPaddingTop = clampNumber(height * 0.028, 22, 38);
    const panelPaddingBottom = clampNumber(height * 0.03, 24, 42);
    const pillLabel = 'A LOUER';
    const pillFontSize = fitSingleLineFont({
      ctx,
      text: pillLabel,
      maxWidth: leftPanelWidth * 0.45,
      maxFontSize: clampNumber(width * 0.032, 18, 28),
      minFontSize: clampNumber(width * 0.018, 13, 18),
      fontFamily: META_FONT_FAMILY,
      fontWeight: '900'
    });
    ctx.font = `900 ${pillFontSize}px ${META_FONT_FAMILY}`;
    const pillPaddingX = clampNumber(width * 0.016, 14, 22);
    const pillPaddingY = clampNumber(height * 0.012, 10, 16);
    const pillHeight = pillFontSize + pillPaddingY * 2;
    const pillWidth = ctx.measureText(pillLabel).width + pillPaddingX * 2;
    const pillRadius = pillHeight / 2;
    const cityLabel = normalizeWhitespace(city) || 'Ville non renseignee';
    const postalLabel = normalizeWhitespace(postalCode) || 'Code postal non renseigne';
    const cityMaxWidth = Math.max(1, leftPanelWidth - panelPaddingX * 1.5);
    const cityFontSize = fitSingleLineFont({
      ctx,
      text: cityLabel,
      maxWidth: cityMaxWidth,
      maxFontSize: clampNumber(width * 0.05, 28, 52),
      minFontSize: clampNumber(width * 0.01, 9, 12),
      fontFamily: TITLE_FONT_FAMILY,
      fontWeight: '900'
    });
    ctx.font = `900 ${cityFontSize}px ${TITLE_FONT_FAMILY}`;
    const cityMeasuredWidth = ctx.measureText(cityLabel).width;
    const cityScaleX = cityMeasuredWidth > 0 ? Math.min(1, cityMaxWidth / cityMeasuredWidth) : 1;
    const cityLineHeight = cityFontSize * 1.02;
    const postalFontSize = fitSingleLineFont({
      ctx,
      text: postalLabel,
      maxWidth: leftPanelWidth - panelPaddingX * 2,
      maxFontSize: clampNumber(width * 0.019, 14, 20),
      minFontSize: clampNumber(width * 0.013, 10, 14),
      fontFamily: META_FONT_FAMILY,
      fontWeight: '700'
    });
    const postalLineHeight = postalFontSize * 1.18;
    const verticalGap = clampNumber(height * 0.012, 10, 18);
    const smallGap = clampNumber(height * 0.008, 6, 12);
    const panelHeight =
      panelPaddingTop +
      pillHeight +
      verticalGap +
      cityLineHeight +
      smallGap +
      postalLineHeight +
      panelPaddingBottom;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 10;
    drawRoundedRect(ctx, panelX, panelY, leftPanelWidth, panelHeight, cardRadius);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.fill();
    ctx.restore();

    const pillX = panelX + (leftPanelWidth - pillWidth) / 2;
    ctx.fillStyle = '#d62828';
    drawRoundedRect(ctx, pillX, panelY + panelPaddingTop, pillWidth, pillHeight, pillRadius);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${pillFontSize}px ${META_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      pillLabel,
      pillX + pillWidth / 2,
      panelY + panelPaddingTop + pillHeight / 2
    );

    let leftTextY = panelY + panelPaddingTop + pillHeight + verticalGap;
    ctx.fillStyle = '#111111';
    ctx.font = `900 ${cityFontSize}px ${TITLE_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const leftPanelCenterX = panelX + leftPanelWidth / 2;
    ctx.save();
    ctx.translate(leftPanelCenterX, leftTextY);
    ctx.scale(cityScaleX, 1);
    ctx.fillText(cityLabel, 0, 0);
    ctx.restore();
    leftTextY += cityLineHeight;

    leftTextY += smallGap;
    ctx.fillStyle = '#4b5563';
    ctx.font = `700 ${postalFontSize}px ${META_FONT_FAMILY}`;
    ctx.fillText(postalLabel.toUpperCase(), leftPanelCenterX, leftTextY);
    ctx.textAlign = 'start';

    const titleBandWidth = safeWidth;
    const titleBandX = safeInsetX;
    const titleBandPaddingX = clampNumber(width * 0.04, 28, 60);
    const titleBandPaddingY = clampNumber(height * 0.022, 18, 34);
    const titleBandAccentHeight = clampNumber(height * 0.008, 6, 10);
    const titleFit = fitWrappedText({
      ctx,
      text: normalizeWhitespace(title) || 'Matériel à louer',
      maxWidth: titleBandWidth - titleBandPaddingX * 2,
      maxHeight: safeHeight * 0.14,
      maxFontSize: clampNumber(width * 0.034, 18, 34),
      minFontSize: clampNumber(width * 0.016, 12, 18),
      fontFamily: TITLE_FONT_FAMILY,
      fontWeight: '900',
      lineHeightRatio: 1.08
    });
    const titleBandHeight =
      titleBandPaddingY * 2 +
      titleBandAccentHeight +
      smallGap +
      titleFit.lines.length * titleFit.lineHeight;
    const titleBandY = safeInsetY + safeHeight - titleBandHeight;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
    drawRoundedRect(ctx, titleBandX, titleBandY, titleBandWidth, titleBandHeight, cardRadius);
    ctx.fillStyle = 'rgba(12, 17, 25, 0.8)';
    ctx.fill();
    ctx.restore();

    drawRoundedRect(ctx, titleBandX, titleBandY, titleBandWidth, titleBandAccentHeight, cardRadius);
    ctx.fillStyle = '#17a2b8';
    ctx.fill();

    let titleY = titleBandY + titleBandPaddingY + titleBandAccentHeight + smallGap;
    const titleCenterX = titleBandX + titleBandWidth / 2;
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${titleFit.fontSize}px ${TITLE_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    titleFit.lines.forEach((line) => {
      ctx.fillText(line, titleCenterX, titleY);
      titleY += titleFit.lineHeight;
    });
    ctx.textAlign = 'start';

    const numericDailyRate = Number(dailyRate);
    const hasValidDailyRate = Number.isFinite(numericDailyRate) && numericDailyRate > 0;
    const priceAmountLabel = formatDailyRateAmount(dailyRate);
    const priceTopLabel = hasValidDailyRate ? `${priceAmountLabel} EUR` : 'Prix';
    const priceBottomLabel = hasValidDailyRate ? 'par jour' : 'sur demande';
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 12;
    drawCircle(ctx, priceBadgeCenterX, priceBadgeCenterY, priceBadgeRadius);
    ctx.fillStyle = '#d62828';
    ctx.fill();
    ctx.restore();

    const priceTopFontSize = fitSingleLineFont({
      ctx,
      text: priceTopLabel,
      maxWidth: priceBadgeRadius * 1.5,
      maxFontSize: clampNumber(priceBadgeRadius * 0.5, 34, 76),
      minFontSize: clampNumber(priceBadgeRadius * 0.22, 18, 30),
      fontFamily: TITLE_FONT_FAMILY,
      fontWeight: '900'
    });
    const priceBottomFontSize = fitSingleLineFont({
      ctx,
      text: priceBottomLabel,
      maxWidth: priceBadgeRadius * 1.3,
      maxFontSize: clampNumber(priceBadgeRadius * 0.3, 20, 40),
      minFontSize: clampNumber(priceBadgeRadius * 0.16, 14, 22),
      fontFamily: META_FONT_FAMILY,
      fontWeight: '900'
    });
    const priceTopLineHeight = priceTopFontSize * 1.02;
    const priceBottomLineHeight = priceBottomFontSize * 1.05;
    const badgeTextBlockHeight = priceTopLineHeight + priceBottomLineHeight + smallGap;
    let badgeTextY = priceBadgeCenterY - badgeTextBlockHeight / 2;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `900 ${priceTopFontSize}px ${TITLE_FONT_FAMILY}`;
    ctx.fillText(priceTopLabel, priceBadgeCenterX, badgeTextY);
    badgeTextY += priceTopLineHeight + smallGap;
    ctx.font = `900 ${priceBottomFontSize}px ${META_FONT_FAMILY}`;
    ctx.fillText(priceBottomLabel, priceBadgeCenterX, badgeTextY);
    ctx.textAlign = 'start';

    const outputType = getCanvasOutputType(photoSource.sourceType);
    const outputBlob = await canvasToBlob(canvas, outputType, 0.92);
    const outputExtension = extractExtensionFromType(outputType);

    return new File(
      [outputBlob],
      `${CURRENT_BRANDED_HERO_PREFIX}${Date.now()}.${outputExtension}`,
      { type: outputType }
    );
  } finally {
    photoSource.cleanup();
  }
};

