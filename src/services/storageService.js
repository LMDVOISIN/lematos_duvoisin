import { supabase } from '../lib/supabase';

/**
 * Storage Service
 * Handles file uploads to Supabase Storage buckets
 */

function isSchemaError(error) {
  if (!error) return false;
  if (error?.code && typeof error?.code === 'string') {
    const errorClass = error?.code?.substring(0, 2);
    if (errorClass === '42' || errorClass === '08') return true;
  }
  if (error?.message) {
    const schemaErrorPatterns = [
      /relation.*does not exist/i,
      /column.*does not exist/i,
      /bucket.*does not exist/i,
      /syntax error/i,
    ];
    return schemaErrorPatterns?.some(pattern => pattern?.test(error?.message));
  }
  return false;
}

function sanitizeStorageFileSegment(value, fallback = 'file') {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();

  return normalized || fallback;
}

const storageService = {
  /**
   * Téléverser un fichier dans le compartiment annonce-photos (public)
   */
  uploadAnnoncePhoto: async (file, userId) => {
    try {
      const rawName = String(file?.name || 'photo.jpg');
      const lastDotIndex = rawName.lastIndexOf('.');
      const rawBaseName = lastDotIndex > 0 ? rawName.slice(0, lastDotIndex) : rawName;
      const rawExtension = lastDotIndex > 0 ? rawName.slice(lastDotIndex + 1) : 'jpg';
      const fileExt = sanitizeStorageFileSegment(rawExtension.toLowerCase(), 'jpg');
      const baseName = sanitizeStorageFileSegment(rawBaseName, 'photo');
      const fileName = `${userId}/${Date.now()}-${baseName}.${fileExt}`;

      const { data, error } = await supabase?.storage
        ?.from('annonce-photos')
        ?.upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans uploadAnnoncePhoto:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      // Get public URL
      const { data: { publicUrl } } = supabase?.storage
        ?.from('annonce-photos')
        ?.getPublicUrl(fileName);

      return { data: { path: fileName, url: publicUrl }, error: null };
    } catch (error) {
      console.error("Erreur de téléversement de photo d'annonce :", error);
      throw error;
    }
  },

  /**
   * Téléverser l'avatar utilisateur (public)
   */
  uploadAvatar: async (file, userId) => {
    try {
      const fileExt = file?.name?.split('.')?.pop();
      const fileName = `${userId}/avatar-${Date.now()}.${fileExt}`;

      const { data, error } = await supabase?.storage
        ?.from('user-avatars')
        ?.upload(fileName, file, {
          cacheControl: '3600',
          upsert: true // Replace existing avatar
        });

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans uploadAvatar:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      // Get public URL
      const { data: { publicUrl } } = supabase?.storage
        ?.from('user-avatars')
        ?.getPublicUrl(fileName);

      return { data: { path: fileName, url: publicUrl }, error: null };
    } catch (error) {
      console.error("Erreur de téléversement d'avatar :", error);
      throw error;
    }
  },

  /**
   * Téléverser la photo de réservation (privé)
   */
  uploadReservationPhoto: async (file, reservationId, phase, takenBy) => {
    try {
      const fileExt = file?.name?.split('.')?.pop();
      const fileName = `${reservationId}/${phase}-${takenBy}-${Date.now()}.${fileExt}`;

      const { data, error } = await supabase?.storage
        ?.from('reservation-photos')
        ?.upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans uploadReservationPhoto:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      // Get signed URL (private bucket)
      const { data: signedUrlData, error: urlError } = await supabase?.storage
        ?.from('reservation-photos')
        ?.createSignedUrl(fileName, 3600 * 24 * 7); // 7 days

      if (urlError) {
        return { data: { path: fileName, url: null }, error: urlError };
      }

      return { data: { path: fileName, url: signedUrlData?.signedUrl }, error: null };
    } catch (error) {
      console.error('Erreur de téléversement de photo de réservation :', error);
      throw error;
    }
  },

  /**
   * Téléverser un document (privé)
   */
  uploadDocument: async (file, userId, documentType) => {
    try {
      const fileExt = file?.name?.split('.')?.pop();
      const fileName = `${userId}/${documentType}-${Date.now()}.${fileExt}`;

      const { data, error } = await supabase?.storage
        ?.from('documents')
        ?.upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans uploadDocument:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      // Get signed URL (private bucket)
      const { data: signedUrlData, error: urlError } = await supabase?.storage
        ?.from('documents')
        ?.createSignedUrl(fileName, 3600 * 24 * 30); // 30 days

      if (urlError) {
        return { data: { path: fileName, url: null }, error: urlError };
      }

      return { data: { path: fileName, url: signedUrlData?.signedUrl }, error: null };
    } catch (error) {
      console.error('Erreur de téléversement de document :', error);
      throw error;
    }
  },

  /**
   * Téléverser le contrat PDF (privé)
   */
  uploadContract: async (file, reservationId) => {
    try {
      const fileName = `${reservationId}/contract-${Date.now()}.pdf`;

      const { data, error } = await supabase?.storage
        ?.from('contracts')
        ?.upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'application/pdf'
        });

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans uploadContract:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      // Get signed URL (private bucket)
      const { data: signedUrlData, error: urlError } = await supabase?.storage
        ?.from('contracts')
        ?.createSignedUrl(fileName, 3600 * 24 * 365); // 1 year

      if (urlError) {
        return { data: { path: fileName, url: null }, error: urlError };
      }

      return { data: { path: fileName, url: signedUrlData?.signedUrl }, error: null };
    } catch (error) {
      console.error('Erreur de téléversement de contrat :', error);
      throw error;
    }
  },

  /**
   * Get signed URL for private file
   */
  getSignedUrl: async (bucket, filePath, expiresIn = 3600) => {
    try {
      const { data, error } = await supabase?.storage
        ?.from(bucket)
        ?.createSignedUrl(filePath, expiresIn);

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans getSignedUrl:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data: data?.signedUrl, error: null };
    } catch (error) {
      console.error('Get signed URL error:', error);
      throw error;
    }
  },

  /**
   * Delete file from storage
   */
  deleteFile: async (bucket, filePath) => {
    try {
      const { error } = await supabase?.storage
        ?.from(bucket)
        ?.remove([filePath]);

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans deleteFile:', error?.message);
          throw error;
        }
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Delete file error:', error);
      throw error;
    }
  },

  /**
   * Delete multiple files from storage
   */
  deleteFiles: async (bucket, filePaths) => {
    try {
      const { error } = await supabase?.storage
        ?.from(bucket)
        ?.remove(filePaths);

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans deleteFiles:', error?.message);
          throw error;
        }
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Delete files error:', error);
      throw error;
    }
  },

  /**
   * List files in a storage folder (non-recursive)
   */
  listFiles: async (bucket, folderPath = '') => {
    try {
      const { data, error } = await supabase?.storage
        ?.from(bucket)
        ?.list(folderPath, {
          limit: 1000,
          offset: 0
        });

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schéma dans listFiles:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data: Array?.isArray(data) ? data : [], error: null };
    } catch (error) {
      console.error('List files error:', error);
      throw error;
    }
  },

  /**
   * Get public URL for annonce photo from storage path
   */
  getAnnoncePhotoUrl: (filePath) => {
    if (!filePath) return null;
    
    // If already a full URL, return as is
    if (filePath?.startsWith('http://') || filePath?.startsWith('https://')) {
      return filePath;
    }
    
    // Get public URL from storage path
    const { data: { publicUrl } } = supabase?.storage
      ?.from('annonce-photos')
      ?.getPublicUrl(filePath);
    
    return publicUrl;
  },

  /**
   * Get public URLs for array of annonce photos
   */
  getAnnoncePhotoUrls: (photoPaths) => {
    if (!photoPaths || !Array.isArray(photoPaths)) return [];
    
    return photoPaths?.map(path => storageService?.getAnnoncePhotoUrl(path))?.filter(Boolean);
  }
};

export default storageService;
