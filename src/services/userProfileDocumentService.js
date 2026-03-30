import { supabase } from '../lib/supabase';
import { sendEmail } from './emailService';
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
  identity: "Pièce d'identité",
  address: 'Justificatif de domicile',
  insurance: "Attestation d'assurance",
  bank: 'RIB'
};

function getDocumentTypeLabel(documentType) {
  return DOCUMENT_TYPE_LABELS?.[documentType] || documentType || 'Document';
}

function parseEmailList(value) {
  return String(value || '')
    ?.split(/[;,]/)
    ?.map((item) => item?.trim())
    ?.filter(Boolean);
}

function getModerationRecipientEmailsFromEnv() {
  const env = import.meta?.env || {};
  const candidates = [
    env?.VITE_MODERATOR_EMAILS,
    env?.VITE_ADMIN_MODERATION_EMAILS,
    env?.VITE_MODERATION_INBOX,
    'contact@lematosduvoisin.fr'
  ];

  return [...new Set(candidates?.flatMap(parseEmailList))];
}

function getAppOrigin() {
  return (
    (typeof window !== 'undefined' ? (window.location?.origin || '') : '')
    || import.meta?.env?.VITE_APP_URL
    || import.meta?.env?.VITE_SITE_URL
    || ''
  );
}

function buildAppUrl(path = '') {
  const origin = getAppOrigin()?.replace(/\/$/, '');
  const safePath = String(path || '');

  if (!origin) return safePath;
  if (!safePath) return origin;
  if (safePath?.startsWith('http://') || safePath?.startsWith('https://')) return safePath;
  return `${origin}${safePath?.startsWith('/') ? safePath : `/${safePath}`}`;
}

function formatDateTimeForEmail(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date?.getTime?.())) return '';

  return date?.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getDocumentLabelForEmail(documentType) {
  if (String(documentType || '')?.trim()?.toLowerCase() === 'identity') {
    return "piece d'identite";
  }

  return String(getDocumentTypeLabel(documentType) || 'document');
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

function sortDocumentsByRecent(a, b) {
  const aTime = new Date(a?.uploadDate || a?.uploaded_at || a?.created_at || 0)?.getTime?.() || 0;
  const bTime = new Date(b?.uploadDate || b?.uploaded_at || b?.created_at || 0)?.getTime?.() || 0;
  return bTime - aTime;
}

function buildIdentitySummary(documents = []) {
  const identityDocuments = (Array.isArray(documents) ? documents : [])
    ?.filter((document) => {
      const documentType = String(
        document?.documentType
        || document?.document_type
        || document?.type
        || ''
      )?.trim()?.toLowerCase();
      return documentType === 'identity';
    })
    ?.sort(sortDocumentsByRecent);

  const latestDocument = identityDocuments?.[0] || null;
  const approvedDocuments = identityDocuments?.filter((document) => document?.status === 'approved');
  const pendingDocuments = identityDocuments?.filter((document) => document?.status === 'pending');
  const rejectedDocuments = identityDocuments?.filter((document) => document?.status === 'rejected');
  const latestApprovedDocument = approvedDocuments?.sort(sortDocumentsByRecent)?.[0] || null;

  let status = 'missing';
  let label = 'Aucune';

  if (approvedDocuments?.length > 0) {
    status = 'approved';
    label = 'Validee';
  } else if (pendingDocuments?.length > 0) {
    status = 'pending';
    label = 'En attente';
  } else if (rejectedDocuments?.length > 0) {
    status = 'rejected';
    label = 'Refusee';
  }

  return {
    status,
    label,
    totalCount: identityDocuments?.length || 0,
    approvedCount: approvedDocuments?.length || 0,
    pendingCount: pendingDocuments?.length || 0,
    rejectedCount: rejectedDocuments?.length || 0,
    latestUploadedAt: latestDocument?.uploadDate || latestDocument?.uploaded_at || latestDocument?.created_at || null,
    latestReviewedAt:
      latestApprovedDocument?.approvedDate
      || latestApprovedDocument?.approved_at
      || latestDocument?.approvedDate
      || latestDocument?.approved_at
      || latestDocument?.rejectedDate
      || latestDocument?.updated_at
      || null,
    latestDocument,
    latestApprovedDocument,
    documents: identityDocuments
  };
}

function buildIdentitySummaryMap(documents = []) {
  const groupedDocuments = (Array.isArray(documents) ? documents : [])?.reduce((accumulator, document) => {
    const userId = String(document?.userId || document?.user_id || '')?.trim();
    if (!userId) return accumulator;

    if (!accumulator?.[userId]) {
      accumulator[userId] = [];
    }

    accumulator[userId]?.push(document);
    return accumulator;
  }, {});

  return Object.entries(groupedDocuments || {})?.reduce((accumulator, [userId, userDocuments]) => {
    accumulator[userId] = buildIdentitySummary(userDocuments);
    return accumulator;
  }, {});
}

async function getUserProfileEmailContext(userId) {
  if (!userId) {
    return { pseudo: '', email: '' };
  }

  try {
    const { data, error } = await supabase
      ?.from('profiles')
      ?.select('pseudo, email')
      ?.eq('id', userId)
      ?.maybeSingle();

    if (error) {
      if (isSchemaError(error)) {
        console.error('Erreur de schema dans getUserProfileEmailContext:', error?.message);
        throw error;
      }

      console.warn('Chargement du profil e-mail degrade:', error?.message || error);
      return { pseudo: '', email: '' };
    }

    return {
      pseudo: data?.pseudo || '',
      email: data?.email || ''
    };
  } catch (error) {
    console.warn('Lecture du profil e-mail impossible:', error?.message || error);
    return { pseudo: '', email: '' };
  }
}

async function listIdentityModerationRecipients() {
  try {
    const { data: admins, error } = await supabase
      ?.from('profiles')
      ?.select('email')
      ?.eq('is_admin', true);

    if (error) {
      if (isSchemaError(error)) {
        console.error('Erreur de schema dans listIdentityModerationRecipients:', error?.message);
        throw error;
      }

      console.warn('Chargement des admins moderation degrade:', error?.message || error);
    }

    const adminEmails = (admins || [])
      ?.map((admin) => admin?.email)
      ?.filter(Boolean);

    return [...new Set([
      ...adminEmails,
      ...getModerationRecipientEmailsFromEnv()
    ])];
  } catch (error) {
    console.warn('Chargement des destinataires moderation impossible:', error?.message || error);
    return getModerationRecipientEmailsFromEnv();
  }
}

async function sendPendingIdentityDocumentEmails({ userId, documentType, fileName, uploadedAt }) {
  if (String(documentType || '')?.trim()?.toLowerCase() !== 'identity') {
    return;
  }

  const userProfile = await getUserProfileEmailContext(userId);
  const moderationRecipients = await listIdentityModerationRecipients();

  if (!moderationRecipients?.length) {
    return;
  }

  const userName = userProfile?.pseudo || userProfile?.email || 'Utilisateur';
  const documentLabel = getDocumentLabelForEmail(documentType);
  const formattedUploadedAt = formatDateTimeForEmail(uploadedAt);
  const adminUrl = buildAppUrl('/administration-gestion-utilisateurs?tab=identity');

  const results = await Promise.allSettled(
    moderationRecipients?.map((recipientEmail) => (
      sendEmail({
        to: recipientEmail,
        templateKey: 'identity_document_pending_admin',
        variables: {
          user_name: userName,
          user_email: userProfile?.email || '',
          document_label: documentLabel,
          file_name: fileName || 'document',
          uploaded_at: formattedUploadedAt,
          admin_url: adminUrl
        }
      })
    ))
  );

  results?.forEach((result, index) => {
    const recipientEmail = moderationRecipients?.[index];

    if (result?.status === 'rejected') {
      console.warn('Echec envoi e-mail admin identite en attente:', result?.reason, recipientEmail);
      return;
    }

    if (!result?.value?.success) {
      console.warn('Echec envoi e-mail admin identite en attente:', result?.value?.error, recipientEmail);
    }
  });
}

async function sendIdentityDocumentReviewEmail({ row, status, rejectionReason = '' }) {
  if (String(row?.document_type || '')?.trim()?.toLowerCase() !== 'identity') {
    return;
  }

  const userProfile = await getUserProfileEmailContext(row?.user_id);
  if (!userProfile?.email) {
    return;
  }

  const userName = userProfile?.pseudo || userProfile?.email || 'Utilisateur';
  const documentLabel = getDocumentLabelForEmail(row?.document_type);
  const documentsUrl = buildAppUrl('/profil-documents-utilisateur');
  const reviewedAt = formatDateTimeForEmail(
    row?.approved_at
    || row?.updated_at
    || new Date()?.toISOString()
  );

  let result = null;

  if (status === 'approved') {
    result = await sendEmail({
      to: userProfile?.email,
      templateKey: 'identity_document_approved_user',
      variables: {
        user_name: userName,
        document_label: documentLabel,
        reviewed_at: reviewedAt,
        documents_url: documentsUrl
      }
    });
  } else if (status === 'rejected') {
    result = await sendEmail({
      to: userProfile?.email,
      templateKey: 'identity_document_rejected_user',
      variables: {
        user_name: userName,
        document_label: documentLabel,
        reviewed_at: reviewedAt,
        rejection_reason: rejectionReason || '',
        documents_url: documentsUrl
      }
    });
  }

  if (result && !result?.success) {
    console.warn("Echec d'envoi e-mail resultat verification identite:", result?.error, userProfile?.email);
  }
}

const userProfileDocumentService = {
  getDocumentTypeLabel,
  buildIdentitySummary,
  buildIdentitySummaryMap,

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

  async listDocumentsForAdmin(options = {}) {
    try {
      const {
        userId = null,
        userIds = [],
        documentType = null
      } = options || {};

      let query = supabase
        ?.from('user_profile_documents')
        ?.select('*')
        ?.order('uploaded_at', { ascending: false });

      if (userId) {
        query = query?.eq('user_id', userId);
      }

      if (Array.isArray(userIds) && userIds?.length > 0) {
        query = query?.in('user_id', userIds);
      }

      if (documentType) {
        query = query?.eq('document_type', documentType);
      }

      const { data: rows, error } = await query;

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) {
          console.error('Erreur de schema dans listDocumentsForAdmin:', error?.message);
          throw error;
        }
        return { data: null, error };
      }

      const safeRows = Array.isArray(rows) ? rows : [];
      const documentUserIds = Array.from(new Set(safeRows?.map((row) => row?.user_id)?.filter(Boolean)));
      const profilesById = new Map();

      if (documentUserIds?.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          ?.from('profiles')
          ?.select('id, pseudo, email, avatar_url')
          ?.in('id', documentUserIds);

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

  async listUserDocumentsForAdmin(userId) {
    if (!userId) {
      return { data: [], error: null };
    }

    return this.listDocumentsForAdmin({ userId });
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
            title: 'Document reçu',
            message: `${getDocumentTypeLabel(documentType)} reçu et en attente de vérification.`,
            actionLink: '/profil-documents-utilisateur',
            actionLabel: 'Voir mes documents',
            document_id: data?.id,
            document_type: documentType
          },
          {
            relatedId: data?.id,
            title: 'Document reçu',
            message: `${getDocumentTypeLabel(documentType)} reçu et en attente de vérification.`
          }
        );
      } catch (notificationError) {
        console.warn('Notification document uploaded degradee:', notificationError?.message || notificationError);
      }

      try {
        await sendPendingIdentityDocumentEmails({
          userId,
          documentType,
          fileName: data?.file_name || file?.name,
          uploadedAt: data?.uploaded_at || data?.created_at
        });
      } catch (emailError) {
        console.warn("Echec d'envoi e-mail document identite en attente:", emailError?.message || emailError);
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

      try {
        await sendIdentityDocumentReviewEmail({
          row: data,
          status: normalizedStatus,
          rejectionReason: normalizedReason
        });
      } catch (emailError) {
        console.warn("Echec d'envoi e-mail revue document identite:", emailError?.message || emailError);
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
