import photoService from './photoService';
import storageService from './storageService';

const isAbsoluteUrl = (value) => /^https?:\/\//i.test(String(value || ''));

function uniqueStrings(values) {
  return Array.from(new Set((values || []).filter(Boolean).map((v) => String(v))));
}

const reservationPhotoCleanupService = {
  /**
   * Purge les photos d'etat des lieux d'une reservation:
   * - bucket prive "reservation-photos"
   * - table "reservation_photos"
   *
   * Ne jette pas d'erreur par défaut pour ne pas bloquer le flux de paiement.
   */
  purgeReservationPhotosAfterPayment: async (reservationId, options = {}) => {
    const suppressErrors = options?.suppressErrors !== false;

    if (!reservationId) {
      return {
        ok: false,
        warning: 'reservationId manquant',
        storageDeletedCount: 0,
        dbDeleted: false
      };
    }

    try {
      const folderPrefix = String(reservationId);
      const [photosResult, listedFilesResult] = await Promise.all([
        photoService?.getPhotosByReservation(reservationId),
        storageService?.listFiles('reservation-photos', folderPrefix)
      ]);

      if (photosResult?.error) throw photosResult.error;
      if (listedFilesResult?.error) throw listedFilesResult.error;

      const dbPhotoPaths = (photosResult?.data || [])
        ?.map((photo) => photo?.photo_url || photo?.url || null)
        ?.filter((path) => path && !isAbsoluteUrl(path));

      const folderFilePaths = (listedFilesResult?.data || [])
        ?.filter((entry) => entry && !entry?.id && !entry?.metadata?.mimetype ? true : true)
        ?.filter((entry) => entry?.name && !entry?.name?.endsWith?.('/'))
        ?.map((entry) => `${folderPrefix}/${entry?.name}`);

      const storagePathsToDelete = uniqueStrings([...(dbPhotoPaths || []), ...(folderFilePaths || [])]);

      if (storagePathsToDelete?.length > 0) {
        const { error: storageError } = await storageService?.deleteFiles('reservation-photos', storagePathsToDelete);
        if (storageError) throw storageError;
      }

      const { error: dbDeleteError } = await photoService?.deletePhotosByReservation(reservationId);
      if (dbDeleteError) throw dbDeleteError;

      return {
        ok: true,
        storageDeletedCount: storagePathsToDelete?.length || 0,
        dbDeleted: true
      };
    } catch (error) {
      console.warn('Purge photos reservation apr?s paiement impossible:', error);
      if (!suppressErrors) throw error;

      return {
        ok: false,
        warning: error?.message || 'Suppression des photos impossible',
        storageDeletedCount: 0,
        dbDeleted: false
      };
    }
  }
};

export default reservationPhotoCleanupService;
