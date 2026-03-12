import { supabase } from '../lib/supabase';
import notificationService from './notificationService';

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
      /policy/i
    ];
    return schemaErrorPatterns?.some((pattern) => pattern?.test(error?.message));
  }
  return false;
}

const BUCKET = 'user-profile-documents';
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const PREVIEW_URL_TTL_SECONDS = 15 * 60;
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const DOCUMENT_TYPE_LABELS = {
  identity: "Piece d'identite",
  address: 'Justificatif de domicile',
  insurance: "Attestation d'assurance",
  bank: 'RIB'
};

function getDocumentTypeLabel(documentType) {
  return DOCUMENT_TYPE_LABELS?.[documentType] || documentType || 'Document';
}

function getFileExtension(fileName) {
  if (!fileName || typeof fileName !== 'string') return '';
  const parts = fileName?.split('.');
  return String(parts?.[parts?.length - 1] || '')?.toLowerCase();
}

function inferPreviewKind(row) {
  const mimeType = String(row?.mime_type || '')?.toLowerCase();
  const fileExtension = getFileExtension(row?.file_name);

  if (mimeType?.startsWith('image/') || ['jpg', 'jpeg', 'png']?.includes(fileExtension)) {
    return 'image';
  }

  if (mimeType === 'application/pdf' || fileExtension === 'pdf') {
    return 'pdf';
  }

  return 'file';
}

function buildAdminDocument(row, profile = null) {
  const previewKind = inferPreviewKind(row);
  const uploadDate = row?.uploaded_at || row?.created_at || null;

  return {
    id: row?.id,
    userId: row?.user_id,
    userPseudo: profile?.pseudo || 'Utilisateur',
    userEmail: profile?.email || '',
    userAvatar: profile?.avatar_url || '/assets/images/no_image.png',
    documentType: row?.document_type,
    documentTypeLabel: getDocumentTypeLabel(row?.document_type),
    fileName: row?.file_name,
    storagePath: row?.storage_path || null,
    mimeType: row?.mime_type || null,
    fileSizeBytes: Number.isFinite(Number(row?.file_size_bytes)) ? Number(row?.file_size_bytes) : null,
    status: row?.status || 'pending',
    uploadDate,
    approvedDate: row?.approved_at || null,
    rejectedDate: row?.status === 'rejected' ? (row?.updated_at || uploadDate) : null,
    rejectionReason: row?.rejection_reason || null,
    previewKind,
    previewUrl: null,
    previewError: '',
    thumbnail: '/assets/images/no_image.png',
    thumbnailAlt: `Document ${getDocumentTypeLabel(row?.document_type)}`
  };
}

const userProfileDocumentService = {
  getDocumentTypeLabel,

  async listUserDocuments(userId) {
    try {
      const { data, error } = await supabase
        ?.from('user_profile_documents')
        ?.select('*')
        ?.eq('user_id', userId)
        ?.order('uploaded_at', { ascending: false });

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schema dans listUserDocuments:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data: data || [], error: null };
    } catch (error) {
      console.error('Erreur lors du chargement des documents utilisateur:', error);
      throw error;
    }
  },

  async listDocumentsForAdmin() {
    try {
      const { data: rows, error } = await supabase
        ?.from('user_profile_documents')
        ?.select('*')
        ?.order('uploaded_at', { ascending: false });

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schema dans listDocumentsForAdmin:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      const safeRows = Array.isArray(rows) ? rows : [];
      const userIds = Array.from(new Set(safeRows?.map((row) => row?.user_id)?.filter(Boolean)));
      const profilesById = new Map();

      if (userIds?.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          ?.from('profiles')
          ?.select('id, pseudo, email, avatar_url')
          ?.in('id', userIds);

        if (profilesError) {
          if (isSchemaError(profilesError)) {
            console.error('Erreur de schema dans listDocumentsForAdmin/profiles:', profilesError?.message);
            throw profilesError;
          }
          console.warn('Chargement des profils documents admin degrade:', profilesError?.message || profilesError);
        } else {
          for (const profile of profiles || []) {
            profilesById.set(profile?.id, profile);
          }
        }
      }

      return {
        data: safeRows?.map((row) => buildAdminDocument(row, profilesById.get(row?.user_id))),
        error: null
      };
    } catch (error) {
      console.error('Erreur lors du chargement admin des documents utilisateur:', error);
      throw error;
    }
  },

  async getSignedDocumentUrl(storagePath, expiresInSeconds = PREVIEW_URL_TTL_SECONDS) {
    try {
      if (!storagePath) {
        return { data: null, error: { message: 'Chemin de stockage manquant.' } };
      }

      const { data, error } = await supabase?.storage
        ?.from(BUCKET)
        ?.createSignedUrl(storagePath, expiresInSeconds);

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schema dans getSignedDocumentUrl:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      return { data: data?.signedUrl || null, error: null };
    } catch (error) {
      console.error("Erreur lors de la generation d'URL signee document:", error);
      throw error;
    }
  },

  async uploadUserDocument(userId, documentType, file) {
    try {
      if (!userId) return { data: null, error: { message: 'Utilisateur non connecte' } };
      if (!file) return { data: null, error: { message: 'Fichier manquant' } };

      if (file?.size > MAX_FILE_SIZE_BYTES) {
        return { data: null, error: { message: 'Le fichier depasse la taille maximale de 5 Mo.' } };
      }

      if (file?.type && !ALLOWED_MIME_TYPES?.includes(file?.type)) {
        return { data: null, error: { message: 'Format de fichier non autorise (PDF, JPG, PNG uniquement).' } };
      }

      const fileExt = file?.name?.split('.')?.pop()?.toLowerCase() || 'bin';
      const random = Math.random()?.toString(36)?.slice(2, 8);
      const storagePath = `${userId}/${documentType}-${Date.now()}-${random}.${fileExt}`;

      const { error: uploadError } = await supabase?.storage
        ?.from(BUCKET)
        ?.upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        if (isSchemaError(uploadError)) {
          console.error('Erreur de schema dans upload storage user profile documents:', uploadError?.message);
          throw uploadError;
        }
        return { data: null, error: uploadError };
      }

      const { data, error } = await supabase
        ?.from('user_profile_documents')
        ?.insert({
          user_id: userId,
          document_type: documentType,
          file_name: file?.name,
          storage_path: storagePath,
          mime_type: file?.type || null,
          file_size_bytes: Number.isFinite(file?.size) ? file?.size : null,
          status: 'pending',
          uploaded_at: new Date()?.toISOString(),
          created_at: new Date()?.toISOString(),
          updated_at: new Date()?.toISOString()
        })
        ?.select('*')
        ?.single();

      if (error) {
        await supabase?.storage?.from(BUCKET)?.remove([storagePath]);

        if (isSchemaError(error)) {
          console.error('Erreur de schema dans uploadUserDocument (insert row):', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      try {
        await notificationService?.createNotification(
          userId,
          notificationService?.TYPES?.DOCUMENT_UPLOADED || 'document_uploaded',
          {
            title: 'Document recu',
            message: `${getDocumentTypeLabel(documentType)} recu et en attente de verification.`,
            actionLink: '/profil-documents-utilisateur',
            actionLabel: 'Voir mes documents',
            document_id: data?.id,
            document_type: documentType
          },
          {
            relatedId: data?.id,
            title: 'Document recu',
            message: `${getDocumentTypeLabel(documentType)} recu et en attente de verification.`
          }
        );
      } catch (notificationError) {
        console.warn('Notification document uploaded degradee:', notificationError?.message || notificationError);
      }

      return { data, error: null };
    } catch (error) {
      console.error("Erreur lors de l'upload du document utilisateur:", error);
      throw error;
    }
  },

  async reviewDocument(documentId, { status, rejectionReason = '' } = {}) {
    try {
      const normalizedStatus = String(status || '')?.trim()?.toLowerCase();
      const normalizedReason = String(rejectionReason || '')?.trim();

      if (!documentId) {
        return { data: null, error: { message: 'Document introuvable.' } };
      }

      if (!['approved', 'rejected']?.includes(normalizedStatus)) {
        return { data: null, error: { message: 'Statut de validation invalide.' } };
      }

      if (normalizedStatus === 'rejected' && !normalizedReason) {
        return { data: null, error: { message: 'Le motif de refus est obligatoire.' } };
      }

      const { data: currentRow, error: currentRowError } = await supabase
        ?.from('user_profile_documents')
        ?.select('*')
        ?.eq('id', documentId)
        ?.maybeSingle();

      if (currentRowError) {
        if (isSchemaError(currentRowError)) {
          console.error('Erreur de schema dans reviewDocument (fetch):', currentRowError?.message);
          throw currentRowError;
        }
        return { data: null, error: currentRowError };
      }

      if (!currentRow) {
        return { data: null, error: { message: 'Document introuvable.' } };
      }

      const nowIso = new Date()?.toISOString();
      const { data, error } = await supabase
        ?.from('user_profile_documents')
        ?.update({
          status: normalizedStatus,
          rejection_reason: normalizedStatus === 'rejected' ? normalizedReason : null,
          approved_at: normalizedStatus === 'approved' ? nowIso : null,
          updated_at: nowIso
        })
        ?.eq('id', documentId)
        ?.select('*')
        ?.single();

      if (error) {
        if (isSchemaError(error)) {
          console.error('Erreur de schema dans reviewDocument (update):', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      const documentLabel = getDocumentTypeLabel(data?.document_type);
      const notificationTitle = normalizedStatus === 'approved'
        ? `${documentLabel} valide`
        : `${documentLabel} refuse`;
      const notificationMessage = normalizedStatus === 'approved'
        ? `${documentLabel} valide par la plateforme.`
        : `${documentLabel} refuse par la plateforme: ${normalizedReason}`;

      try {
        await notificationService?.createNotification(
          data?.user_id,
          normalizedStatus === 'approved' ? 'document_approved' : 'document_rejected',
          {
            title: notificationTitle,
            message: notificationMessage,
            actionLink: '/profil-documents-utilisateur',
            actionLabel: 'Voir mes documents',
            document_id: data?.id,
            document_type: data?.document_type,
            rejection_reason: normalizedStatus === 'rejected' ? normalizedReason : null
          },
          {
            relatedId: data?.id,
            title: notificationTitle,
            message: notificationMessage
          }
        );
      } catch (notificationError) {
        console.warn('Notification document review degradee:', notificationError?.message || notificationError);
      }

      return { data, error: null };
    } catch (error) {
      console.error('Erreur lors de la moderation du document utilisateur:', error);
      throw error;
    }
  },

  async deleteUserDocument(documentId) {
    try {
      const { data: row, error: fetchError } = await supabase
        ?.from('user_profile_documents')
        ?.select('id, storage_path')
        ?.eq('id', documentId)
        ?.maybeSingle();

      if (fetchError) {
        if (isSchemaError(fetchError)) {
          console.error('Erreur de schema dans deleteUserDocument (fetch):', fetchError?.message);
          throw fetchError;
        }
        return { error: fetchError };
      }

      if (!row) {
        return { error: null };
      }

      const { error: deleteRowError } = await supabase
        ?.from('user_profile_documents')
        ?.delete()
        ?.eq('id', documentId);

      if (deleteRowError) {
        if (isSchemaError(deleteRowError)) {
          console.error('Erreur de schema dans deleteUserDocument (row):', deleteRowError?.message);
          throw deleteRowError;
        }
        return { error: deleteRowError };
      }

      if (row?.storage_path) {
        const { error: storageDeleteError } = await supabase?.storage?.from(BUCKET)?.remove([row?.storage_path]);
        if (storageDeleteError) {
          console.warn('Document supprime en base mais suppression storage impossible:', storageDeleteError?.message);
        }
      }

      return { error: null };
    } catch (error) {
      console.error('Erreur lors de la suppression du document utilisateur:', error);
      throw error;
    }
  },

  mapRowToUiDocument(row) {
    const statusMap = {
      pending: 'pending',
      approved: 'approved',
      rejected: 'rejected'
    };

    return {
      id: row?.id,
      type: row?.document_type,
      fileName: row?.file_name,
      uploadDate: row?.uploaded_at || row?.created_at,
      status: statusMap?.[row?.status] || 'pending',
      approvedDate: row?.approved_at || null,
      rejectionReason: row?.rejection_reason || null,
      storagePath: row?.storage_path || null,
      mimeType: row?.mime_type || null,
      size: row?.file_size_bytes || null
    };
  }
};

export default userProfileDocumentService;
