import { supabase } from '../lib/supabase';

export const OBJECT_IMAGE_LIBRARY_BUCKET = 'demande-object-library';
export const OBJECT_IMAGE_LIBRARY_MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
export const OBJECT_IMAGE_LIBRARY_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/svg+xml'
];

const IMAGE_SELECT = `
  *,
  category:categories(id, nom, slug),
  subcategory:subcategories(id, category_id, name, nom, slug)
`;

const normalizeText = (value) => String(value || '').trim();

const normalizeSearchText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const sanitizeStorageSegment = (value, fallback = 'file') => {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();

  return normalized || fallback;
};

const normalizeTags = (value) => {
  const source = Array.isArray(value)
    ? value
    : String(value || '').split(/[;,]/);

  return [...new Set(
    source
      .map((entry) => normalizeText(entry).toLowerCase())
      .filter(Boolean)
  )];
};

const parseOptionalInteger = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const isAllowedMimeType = (file) =>
  OBJECT_IMAGE_LIBRARY_ALLOWED_MIME_TYPES.includes(String(file?.type || '').toLowerCase());

const getFileExtension = (file) => {
  const rawName = String(file?.name || 'image').trim();
  const lastDotIndex = rawName.lastIndexOf('.');
  const explicitExtension = lastDotIndex > -1 ? rawName.slice(lastDotIndex + 1) : '';

  if (explicitExtension) {
    return sanitizeStorageSegment(explicitExtension.toLowerCase(), 'bin');
  }

  const type = String(file?.type || '').toLowerCase();
  if (type === 'image/jpeg') return 'jpg';
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/avif') return 'avif';
  if (type === 'image/svg+xml') return 'svg';
  return 'bin';
};

const getBaseFileName = (file) => {
  const rawName = String(file?.name || 'image').trim();
  const lastDotIndex = rawName.lastIndexOf('.');
  const explicitBaseName = lastDotIndex > -1 ? rawName.slice(0, lastDotIndex) : rawName;
  return sanitizeStorageSegment(explicitBaseName, 'image');
};

const buildPublicUrl = (storagePath) => {
  if (!storagePath) return '';
  const { data } = supabase?.storage?.from(OBJECT_IMAGE_LIBRARY_BUCKET)?.getPublicUrl(storagePath);
  return data?.publicUrl || '';
};

const getLastPathSegment = (storagePath) => {
  const parts = String(storagePath || '')
    .split('/')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts[parts.length - 1] : '';
};

const buildStoragePath = ({ categorySlug, subcategorySlug, fileName }) => {
  const safeCategorySlug = sanitizeStorageSegment(categorySlug, 'categorie');
  const safeSubcategorySlug = sanitizeStorageSegment(subcategorySlug, 'sous-categorie');
  const safeFileName = sanitizeStorageSegment(fileName, `image-${Date.now()}`);
  return `${safeCategorySlug}/${safeSubcategorySlug}/${safeFileName}`;
};

const mapImageRow = (row) => {
  if (!row) return null;

  return {
    ...row,
    tags: Array.isArray(row?.tags) ? row.tags : [],
    categoryLabel: row?.category?.nom || row?.category?.name || row?.category?.slug || '',
    subcategoryLabel: row?.subcategory?.nom || row?.subcategory?.name || row?.subcategory?.slug || ''
  };
};

const filterImagesBySearch = (rows, search) => {
  const normalizedSearch = normalizeSearchText(search);
  if (!normalizedSearch) return rows;

  return (rows || []).filter((row) => {
    const haystack = [
      row?.title,
      row?.description,
      row?.alt_text,
      row?.categoryLabel,
      row?.subcategoryLabel,
      ...(Array.isArray(row?.tags) ? row.tags : [])
    ]
      .map((value) => normalizeSearchText(value))
      .filter(Boolean)
      .join(' ');

    return haystack.includes(normalizedSearch);
  });
};

const validateCategoryPair = ({ category, subcategory }) => {
  if (!category?.id) {
    return { valid: false, message: 'La categorie est requise.' };
  }

  if (!subcategory?.id) {
    return { valid: false, message: 'La sous-categorie est requise.' };
  }

  if (String(subcategory?.category_id || '') !== String(category?.id || '')) {
    return { valid: false, message: 'La sous-categorie ne correspond pas a la categorie choisie.' };
  }

  return { valid: true, message: '' };
};

async function readImageDimensions(file) {
  if (typeof window === 'undefined' || !file || !String(file?.type || '').startsWith('image/')) {
    return { width: null, height: null };
  }

  return new Promise((resolve) => {
    const objectUrl = window.URL?.createObjectURL?.(file);
    if (!objectUrl) {
      resolve({ width: null, height: null });
      return;
    }

    const image = new window.Image();

    image.onload = () => {
      window.URL?.revokeObjectURL?.(objectUrl);
      resolve({
        width: parseOptionalInteger(image?.naturalWidth),
        height: parseOptionalInteger(image?.naturalHeight)
      });
    };

    image.onerror = () => {
      window.URL?.revokeObjectURL?.(objectUrl);
      resolve({ width: null, height: null });
    };

    image.src = objectUrl;
  });
}

const objectImageLibraryService = {
  listImages: async (filters = {}) => {
    try {
      let query = supabase
        ?.from('demande_object_images')
        ?.select(IMAGE_SELECT)
        ?.order('created_at', { ascending: false });

      if (filters?.categoryId) {
        query = query?.eq('category_id', filters?.categoryId);
      }

      if (filters?.subcategoryId) {
        query = query?.eq('subcategory_id', filters?.subcategoryId);
      }

      if (filters?.includeInactive !== true) {
        query = query?.eq('is_active', true);
      }

      if (filters?.limit) {
        query = query?.limit(filters?.limit);
      }

      const { data, error } = await query;
      if (error) return { data: null, error };

      const mapped = (data || []).map(mapImageRow);
      return {
        data: filterImagesBySearch(mapped, filters?.search),
        error: null
      };
    } catch (error) {
      console.error("Erreur de chargement de la bibliotheque d'images :", error);
      throw error;
    }
  },

  uploadImage: async ({
    file,
    category,
    subcategory,
    title,
    description,
    altText,
    tags,
    isActive = true
  }) => {
    try {
      if (!file) {
        return { data: null, error: { message: 'Le fichier image est requis.' } };
      }

      if (!isAllowedMimeType(file)) {
        return { data: null, error: { message: 'Type de fichier non pris en charge.' } };
      }

      if (Number(file?.size || 0) > OBJECT_IMAGE_LIBRARY_MAX_FILE_SIZE_BYTES) {
        return { data: null, error: { message: 'Le fichier depasse la taille maximale autorisee.' } };
      }

      const categoryValidation = validateCategoryPair({ category, subcategory });
      if (!categoryValidation.valid) {
        return { data: null, error: { message: categoryValidation.message } };
      }

      const normalizedTitle = normalizeText(title);
      const normalizedAltText = normalizeText(altText);

      if (!normalizedTitle) {
        return { data: null, error: { message: 'Le titre est requis.' } };
      }

      if (!normalizedAltText) {
        return { data: null, error: { message: 'Le texte alternatif est requis.' } };
      }

      const extension = getFileExtension(file);
      const baseName = getBaseFileName(file);
      const finalFileName = `${Date.now()}-${baseName}.${extension}`;
      const storagePath = buildStoragePath({
        categorySlug: category?.slug,
        subcategorySlug: subcategory?.slug,
        fileName: finalFileName
      });

      const dimensions = await readImageDimensions(file);

      const { error: uploadError } = await supabase?.storage
        ?.from(OBJECT_IMAGE_LIBRARY_BUCKET)
        ?.upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file?.type || undefined
        });

      if (uploadError) {
        return { data: null, error: uploadError };
      }

      const publicUrl = buildPublicUrl(storagePath);
      const payload = {
        category_id: category?.id,
        subcategory_id: subcategory?.id,
        title: normalizedTitle,
        description: normalizeText(description) || null,
        alt_text: normalizedAltText,
        tags: normalizeTags(tags),
        storage_path: storagePath,
        public_url: publicUrl,
        file_name: finalFileName,
        mime_type: String(file?.type || '').toLowerCase() || 'application/octet-stream',
        file_size_bytes: Number(file?.size || 0) || 0,
        width: dimensions?.width,
        height: dimensions?.height,
        is_active: isActive !== false
      };

      const { data, error } = await supabase
        ?.from('demande_object_images')
        ?.insert(payload)
        ?.select(IMAGE_SELECT)
        ?.single();

      if (error) {
        await supabase?.storage?.from(OBJECT_IMAGE_LIBRARY_BUCKET)?.remove([storagePath]);
        return { data: null, error };
      }

      return { data: mapImageRow(data), error: null };
    } catch (error) {
      console.error("Erreur d'import d'image de la bibliotheque :", error);
      throw error;
    }
  },

  updateImage: async (id, updates = {}) => {
    try {
      const imageId = parseOptionalInteger(id);
      if (!imageId) {
        return { data: null, error: { message: "L'image a modifier est introuvable." } };
      }

      const { data: existing, error: loadError } = await supabase
        ?.from('demande_object_images')
        ?.select(IMAGE_SELECT)
        ?.eq('id', imageId)
        ?.single();

      if (loadError) {
        return { data: null, error: loadError };
      }

      const nextCategory = updates?.category || existing?.category;
      const nextSubcategory = updates?.subcategory || existing?.subcategory;
      const categoryValidation = validateCategoryPair({ category: nextCategory, subcategory: nextSubcategory });
      if (!categoryValidation.valid) {
        return { data: null, error: { message: categoryValidation.message } };
      }

      const normalizedTitle = normalizeText(updates?.title ?? existing?.title);
      const normalizedAltText = normalizeText(updates?.altText ?? updates?.alt_text ?? existing?.alt_text);

      if (!normalizedTitle) {
        return { data: null, error: { message: 'Le titre est requis.' } };
      }

      if (!normalizedAltText) {
        return { data: null, error: { message: 'Le texte alternatif est requis.' } };
      }

      const shouldMoveFile =
        String(existing?.category_id || '') !== String(nextCategory?.id || '')
        || String(existing?.subcategory_id || '') !== String(nextSubcategory?.id || '');

      let nextStoragePath = existing?.storage_path || '';
      let nextPublicUrl = existing?.public_url || '';
      let nextFileName = existing?.file_name || getLastPathSegment(existing?.storage_path);

      if (shouldMoveFile && existing?.storage_path) {
        nextFileName = sanitizeStorageSegment(nextFileName, getLastPathSegment(existing?.storage_path) || `image-${imageId}`);
        nextStoragePath = buildStoragePath({
          categorySlug: nextCategory?.slug,
          subcategorySlug: nextSubcategory?.slug,
          fileName: nextFileName
        });

        if (nextStoragePath !== existing?.storage_path) {
          const { error: moveError } = await supabase?.storage
            ?.from(OBJECT_IMAGE_LIBRARY_BUCKET)
            ?.move(existing?.storage_path, nextStoragePath);

          if (moveError) {
            return { data: null, error: moveError };
          }

          nextPublicUrl = buildPublicUrl(nextStoragePath);
        }
      }

      const payload = {
        category_id: nextCategory?.id,
        subcategory_id: nextSubcategory?.id,
        title: normalizedTitle,
        description: normalizeText(updates?.description ?? existing?.description) || null,
        alt_text: normalizedAltText,
        tags: normalizeTags(updates?.tags ?? existing?.tags),
        is_active: updates?.isActive === undefined ? existing?.is_active !== false : updates?.isActive !== false,
        storage_path: nextStoragePath,
        public_url: nextPublicUrl,
        file_name: nextFileName
      };

      const { data, error } = await supabase
        ?.from('demande_object_images')
        ?.update(payload)
        ?.eq('id', imageId)
        ?.select(IMAGE_SELECT)
        ?.single();

      if (error) {
        if (shouldMoveFile && nextStoragePath && existing?.storage_path && nextStoragePath !== existing?.storage_path) {
          await supabase?.storage
            ?.from(OBJECT_IMAGE_LIBRARY_BUCKET)
            ?.move(nextStoragePath, existing?.storage_path);
        }

        return { data: null, error };
      }

      return { data: mapImageRow(data), error: null };
    } catch (error) {
      console.error("Erreur de mise a jour d'image de la bibliotheque :", error);
      throw error;
    }
  },

  deleteImage: async (id) => {
    try {
      const imageId = parseOptionalInteger(id);
      if (!imageId) {
        return { error: { message: "L'image a supprimer est introuvable." } };
      }

      const { data: existing, error: loadError } = await supabase
        ?.from('demande_object_images')
        ?.select('id, storage_path')
        ?.eq('id', imageId)
        ?.single();

      if (loadError) {
        return { error: loadError };
      }

      if (existing?.storage_path) {
        const { error: storageError } = await supabase?.storage
          ?.from(OBJECT_IMAGE_LIBRARY_BUCKET)
          ?.remove([existing?.storage_path]);

        if (storageError) {
          return { error: storageError };
        }
      }

      const { error } = await supabase
        ?.from('demande_object_images')
        ?.delete()
        ?.eq('id', imageId);

      return { error: error || null };
    } catch (error) {
      console.error("Erreur de suppression d'image de la bibliotheque :", error);
      throw error;
    }
  }
};

export default objectImageLibraryService;
