import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import BeforePhotosSection from './components/BeforePhotosSection';
import AfterPhotosSection from './components/AfterPhotosSection';
import ComparisonView from './components/ComparisonView';
import reservationService from '../../services/reservationService';
import photoService from '../../services/photoService';
import storageService from '../../services/storageService';
import inspectionService from '../../services/inspectionService';
import { useAuth } from '../../contexts/AuthContext';

const isAbsoluteUrl = (value) => /^https?:\/\//i.test(String(value || ''));

const normalizeReservationStatus = (status) => String(status || '')?.toLowerCase();

const normalizePhase = (phase) => (String(phase || '')?.toLowerCase() === 'end' ? 'end' : 'start');

const formatPhaseForLabel = (phase) => (normalizePhase(phase) === 'start' ? 'début' : 'fin');

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const toLocalDateOnly = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value?.getTime())) return null;
    const normalizedDate = new Date(value);
    normalizedDate?.setHours(0, 0, 0, 0);
    return normalizedDate;
  }

  const rawValue = String(value || '')?.trim();
  if (!rawValue) return null;

  const dateOnlyMatch = rawValue?.match(DATE_ONLY_REGEX);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const normalizedDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    return Number.isNaN(normalizedDate?.getTime()) ? null : normalizedDate;
  }

  const parsedDate = new Date(rawValue);
  if (Number.isNaN(parsedDate?.getTime())) return null;
  parsedDate?.setHours(0, 0, 0, 0);
  return parsedDate;
};

const isSameLocalDay = (left, right) => {
  const leftDate = toLocalDateOnly(left);
  const rightDate = toLocalDateOnly(right);
  if (!leftDate || !rightDate) return false;
  return leftDate?.getTime() === rightDate?.getTime();
};

const formatDateDayLabel = (value) => {
  const date = toLocalDateOnly(value);
  if (!date) return '-';
  return date?.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const PhotosEtatDesLieux = () => {
  const { reservationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeView, setActiveView] = useState('upload');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reservation, setReservation] = useState(null);
  const [beforePhotos, setBeforePhotos] = useState([]);
  const [afterPhotos, setAfterPhotos] = useState([]);
  const [inspectionSessions, setInspectionSessions] = useState({});
  const [inspectionSettlement, setInspectionSettlement] = useState(null);
  const [inspectionDisputes, setInspectionDisputes] = useState([]);
  const [uploadingPhase, setUploadingPhase] = useState(null);
  const [presenceConfirmingPhase, setPresenceConfirmingPhase] = useState(null);
  const [photosFinalizingPhase, setPhotosFinalizingPhase] = useState(null);
  const [openingDispute, setOpeningDispute] = useState(false);
  const [cautionActionLoading, setCautionActionLoading] = useState(false);
  const [presencePopupDismissedByPhase, setPresencePopupDismissedByPhase] = useState({});

  const resolveReservationPhotoUrl = async (photoUrl) => {
    if (!photoUrl) return '/assets/images/no_image.png';
    if (isAbsoluteUrl(photoUrl)) return photoUrl;

    const { data, error: urlError } = await storageService?.getSignedUrl('reservation-photos', photoUrl, 3600 * 24 * 7);
    if (urlError || !data) return '/assets/images/no_image.png';
    return data;
  };

  const buildUploaderLabel = (photo, reservationData) => {
    const takenBy = String(photo?.taken_by || '')?.toLowerCase();
    if (takenBy === 'owner') return reservationData?.owner?.pseudo || 'Propriétaire';
    if (takenBy === 'renter') return reservationData?.renter?.pseudo || 'Locataire';
    return null;
  };

  const mapPhotoRecord = async (photo, reservationData) => {
    const photoPathOrUrl = photo?.photo_url || photo?.url || null;
    return {
      id: photo?.id,
      url: await resolveReservationPhotoUrl(photoPathOrUrl),
      storagePath: isAbsoluteUrl(photoPathOrUrl) ? null : photoPathOrUrl,
      timestamp: photo?.taken_at || photo?.created_at || new Date()?.toISOString(),
      uploadedBy: buildUploaderLabel(photo, reservationData),
      gpsCoordinates: photo?.gps_coordinates || photo?.gpsCoordinates || null,
      comment: photo?.comment || '',
      raw: photo
    };
  };

  const loadPageData = async () => {
    if (!reservationId) {
      setError('Reservation introuvable.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const [
        { data: reservationData, error: reservationError },
        { data: photosData, error: photosError },
        { data: sessionsData, error: sessionsError },
        { data: settlementData, error: settlementError },
        { data: disputesData, error: disputesError }
      ] = await Promise.all([
        reservationService?.getReservationById(reservationId),
        photoService?.getPhotosByReservation(reservationId),
        inspectionService?.getSessionsByReservation(reservationId),
        inspectionService?.getSettlementByReservation(reservationId),
        inspectionService?.getDisputesByReservation(reservationId)
      ]);

      if (reservationError) throw reservationError;
      if (photosError) throw photosError;
      if (sessionsError) throw sessionsError;
      if (settlementError) throw settlementError;
      if (disputesError) throw disputesError;
      if (!reservationData) {
        setReservation(null);
        setBeforePhotos([]);
        setAfterPhotos([]);
        setInspectionSessions({});
        setInspectionSettlement(null);
        setInspectionDisputes([]);
        setError('Reservation introuvable.');
        return;
      }

      const mappedPhotos = await Promise.all((photosData || [])?.map((photo) => mapPhotoRecord(photo, reservationData)));
      const before = mappedPhotos?.filter((photo) => String(photo?.raw?.phase || '')?.toLowerCase() === photoService?.PHASES?.START);
      const after = mappedPhotos?.filter((photo) => String(photo?.raw?.phase || '')?.toLowerCase() === photoService?.PHASES?.END);
      const sessionsByPhase = (sessionsData || [])?.reduce((acc, session) => {
        acc[normalizePhase(session?.phase)] = session;
        return acc;
      }, {});
      const disputeIds = (disputesData || [])?.map((dispute) => dispute?.id)?.filter(Boolean);
      const { data: disputePhotoSelections, error: disputePhotoSelectionsError } =
        await inspectionService?.getDisputePhotoSelectionsByDisputeIds(disputeIds);
      if (disputePhotoSelectionsError) throw disputePhotoSelectionsError;

      const disputePhotosByDisputeId = (disputePhotoSelections || [])?.reduce((acc, row) => {
        const key = String(row?.dispute_id || '');
        if (!key) return acc;
        if (!acc[key]) acc[key] = [];
        acc[key]?.push(row);
        return acc;
      }, {});

      const disputesWithSelections = (disputesData || [])?.map((dispute) => ({
        ...dispute,
        selected_photos: disputePhotosByDisputeId?.[String(dispute?.id)] || []
      }));

      setReservation(reservationData);
      setBeforePhotos(before || []);
      setAfterPhotos(after || []);
      setInspectionSessions(sessionsByPhase || {});
      setInspectionSettlement(settlementData || null);
      setInspectionDisputes(disputesWithSelections || []);
    } catch (loadError) {
      console.error("Erreur de chargement des photos d'etat des lieux:", loadError);
      setReservation(null);
      setBeforePhotos([]);
      setAfterPhotos([]);
      setInspectionSessions({});
      setInspectionSettlement(null);
      setInspectionDisputes([]);
      setError(loadError?.message || "Impossible de charger les photos d'etat des lieux.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId]);

  useEffect(() => {
    setPresencePopupDismissedByPhase({});
  }, [reservation?.id]);

  const currentUserRole = useMemo(() => {
    if (!user?.id || !reservation) return null;
    if (reservation?.owner_id === user?.id) return photoService?.TAKERS?.OWNER || 'owner';
    if (reservation?.renter_id === user?.id) return photoService?.TAKERS?.RENTER || 'renter';
    return null;
  }, [reservation, user?.id]);

  const reservationStatus = normalizeReservationStatus(reservation?.status);
  const startPhaseKey = photoService?.PHASES?.START || 'start';
  const endPhaseKey = photoService?.PHASES?.END || 'end';
  const ownerRoleKey = photoService?.TAKERS?.OWNER || 'owner';
  const renterRoleKey = photoService?.TAKERS?.RENTER || 'renter';
  const beforeSession = inspectionSessions?.[startPhaseKey] || null;
  const afterSession = inspectionSessions?.[endPhaseKey] || null;
  const startDateOnly = toLocalDateOnly(reservation?.start_date);
  const endDateOnly = toLocalDateOnly(reservation?.end_date || reservation?.start_date);
  const isStartInspectionDay = isSameLocalDay(startDateOnly, new Date());
  const isEndInspectionDay = isSameLocalDay(endDateOnly, new Date());
  const canInteractStartPhase = Boolean(currentUserRole)
    && isStartInspectionDay
    && !['completed', 'cancelled']?.includes(reservationStatus);
  const canInteractEndPhase = Boolean(currentUserRole)
    && isEndInspectionDay
    && ['accepted', 'paid', 'active', 'ongoing', 'completed']?.includes(reservationStatus);

  const isPhaseClosed = (session) => Boolean(session?.closed_at) || String(session?.status || '')?.toLowerCase() === 'closed';
  const isPresenceReady = (session) => Boolean(session?.owner_presence_confirmed_at && session?.renter_presence_confirmed_at);
  const hasCurrentUserPresenceConfirmed = (session) => {
    if (!currentUserRole) return false;
    if (currentUserRole === ownerRoleKey) return Boolean(session?.owner_presence_confirmed_at);
    if (currentUserRole === renterRoleKey) return Boolean(session?.renter_presence_confirmed_at);
    return false;
  };
  const hasCurrentUserFinalized = (session) => {
    if (!currentUserRole) return false;
    if (currentUserRole === ownerRoleKey) return Boolean(session?.owner_photos_finalized_at);
    if (currentUserRole === renterRoleKey) return Boolean(session?.renter_photos_finalized_at);
    return false;
  };
  const hasUserRolePhoto = (photos, role) => (photos || [])?.some((photo) => String(photo?.raw?.taken_by || '')?.toLowerCase() === String(role || '')?.toLowerCase());

  const beforePresenceReady = isPresenceReady(beforeSession);
  const afterPresenceReady = isPresenceReady(afterSession);
  const beforePhaseClosed = isPhaseClosed(beforeSession);
  const afterPhaseClosed = isPhaseClosed(afterSession);
  const settlementStatus = String(inspectionSettlement?.status || '')?.toLowerCase();
  const settlementPaymentHoldStatus = String(inspectionSettlement?.payment_hold_status || '')?.toLowerCase();
  const hasOfficialSettlementFlow = Boolean(inspectionSettlement) || Boolean(afterSession?.closed_at);
  const isContestWindowOpen = Boolean(
    afterSession?.closed_at &&
    afterSession?.contest_window_ends_at &&
    new Date(afterSession?.contest_window_ends_at)?.getTime() > Date.now()
  );
  const hasCurrentUserDispute = (inspectionDisputes || [])?.some(
    (dispute) => String(dispute?.opened_by_user_id || '') === String(user?.id || '')
      && ['opened', 'under_review', 'pending_information']?.includes(String(dispute?.status || '')?.toLowerCase())
  );
  const canOpenDispute = Boolean(
    reservation?.id &&
    user?.id &&
    currentUserRole &&
    afterPhaseClosed &&
    isContestWindowOpen &&
    !hasCurrentUserDispute &&
    ['hold_24h', 'disputed_pending_moderation', '']?.includes(settlementStatus)
  );
  const canSubmitDisputeAgainstPhotos = (beforePhotos?.length + afterPhotos?.length) > 0;

  const canUploadBefore = currentUserRole === ownerRoleKey && canInteractStartPhase && beforePresenceReady && !beforePhaseClosed;
  const canUploadAfter = currentUserRole === renterRoleKey && canInteractEndPhase && afterPresenceReady && !afterPhaseClosed;
  const canConfirmBeforePresence = canInteractStartPhase && !beforePhaseClosed && !hasCurrentUserPresenceConfirmed(beforeSession);
  const canConfirmAfterPresence = canInteractEndPhase && !afterPhaseClosed && !hasCurrentUserPresenceConfirmed(afterSession);
  const canFinalizeBefore = canInteractStartPhase && beforePresenceReady && !beforePhaseClosed && !hasCurrentUserFinalized(beforeSession) && hasUserRolePhoto(beforePhotos, currentUserRole);
  const canFinalizeAfter = canInteractEndPhase && afterPresenceReady && !afterPhaseClosed && !hasCurrentUserFinalized(afterSession) && hasUserRolePhoto(afterPhotos, currentUserRole);
  const presencePopupPhase = canConfirmBeforePresence
    ? startPhaseKey
    : canConfirmAfterPresence
      ? endPhaseKey
      : null;
  const presencePopupButtonId = presencePopupPhase === startPhaseKey
    ? `confirm-presence-start-${reservation?.id || reservationId || 'reservation'}`
    : presencePopupPhase === endPhaseKey
      ? `confirm-presence-end-${reservation?.id || reservationId || 'reservation'}`
      : null;
  const showPresencePopup = Boolean(
    activeView === 'upload'
    && presencePopupPhase
    && !presencePopupDismissedByPhase?.[presencePopupPhase]
  );
  const presencePopupPhaseLabel = presencePopupPhase === startPhaseKey ? 'début (remise)' : 'fin (restitution)';
  const presencePopupDateLabel = presencePopupPhase === startPhaseKey
    ? formatDateDayLabel(startDateOnly)
    : formatDateDayLabel(endDateOnly);

  const beforeCameraLockedReason = beforePhaseClosed
    ? 'La phase de debut est cloturee et les preuves sont figées.'
    : !isStartInspectionDay
      ? `La phase de début est disponible uniquement le jour de remise (${formatDateDayLabel(startDateOnly)}).`
      : !beforePresenceReady
        ? "La caméra reste bloquée tant que propriétaire et locataire n'ont pas confirmé leur présence."
        : null;
  const afterCameraLockedReason = afterPhaseClosed
    ? 'La phase de fin est cloturee et les preuves sont figées.'
    : !isEndInspectionDay
      ? `La phase de fin est disponible uniquement le jour de restitution (${formatDateDayLabel(endDateOnly)}).`
      : !afterPresenceReady
        ? "La caméra reste bloquée tant que propriétaire et locataire n'ont pas confirmé leur présence."
        : null;
  const cautionAmount = Number(reservation?.caution_amount ?? reservation?.deposit_amount ?? reservation?.annonce?.caution ?? 0) || 0;
  const cautionStatus = String(reservation?.deposit_status || reservation?.caution_status || (cautionAmount > 0 ? 'pending' : 'none'))?.toLowerCase();
  const manualCautionLockedByOfficialFlow = cautionAmount > 0;
  const canManageCaution = currentUserRole === ownerRoleKey && cautionAmount > 0 && !manualCautionLockedByOfficialFlow;
  const cautionDecisionLockReason = manualCautionLockedByOfficialFlow
    ? (
      !afterPhaseClosed
        ? "La caution ne peut pas etre decidee ici avant la clôture de l'etat des lieux de fin."
        : "Le règlement final suit le workflow officiel (fenêtre de contestation 24h puis arbitrage/modération si litige)."
    )
    : null;

  const handlePhotoAdd = async (phase, payload) => {
    if (!reservation || !user) {
      toast?.error('Veuillez vous connecter pour téléverser des photos.');
      return;
    }
    if (!payload?.file) {
      toast?.error('Fichier photo invalide.');
      return;
    }

    const takenBy = currentUserRole;
    if (!takenBy) {
      toast?.error("Vous n'êtes pas autorisé à ajouter des photos sur cette réservation.");
      return;
    }

    if (phase === photoService?.PHASES?.START && !canUploadBefore) {
      if (beforePhaseClosed) {
        toast?.error('La phase de debut est cloturee. Les photos sont figées.');
      } else if (!beforePresenceReady) {
        toast?.error("La caméra est bloquée tant que les 2 parties n'ont pas confirmé leur présence (début).");
      } else {
        toast?.error("Seul le propriétaire peut ajouter les photos avant location.");
      }
      return;
    }
    if (phase === photoService?.PHASES?.END && !canUploadAfter) {
      if (afterPhaseClosed) {
        toast?.error('La phase de fin est cloturee. Les photos sont figées.');
      } else if (!afterPresenceReady) {
        toast?.error("La caméra est bloquée tant que les 2 parties n'ont pas confirmé leur présence (fin).");
      } else {
        toast?.error("Seul le locataire peut ajouter les photos après restitution.");
      }
      return;
    }

    try {
      setUploadingPhase(phase);

      const { data: uploadData, error: uploadError } = await storageService?.uploadReservationPhoto(
        payload?.file,
        reservation?.id,
        phase,
        takenBy
      );
      if (uploadError) throw uploadError;

      const storagePath = uploadData?.path || null;
      const { data: savedPhoto, error: photoSaveError } = await photoService?.uploadPhoto(
        reservation?.id,
        phase,
        takenBy,
        storagePath || uploadData?.url,
        null
      );
      if (photoSaveError) throw photoSaveError;

      const mapped = {
        ...(await mapPhotoRecord(savedPhoto, reservation)),
        url: uploadData?.url || (await resolveReservationPhotoUrl(storagePath)),
        storagePath: storagePath || null
      };

      if (phase === photoService?.PHASES?.START) {
        setBeforePhotos((prev) => [...prev, mapped]);
      } else {
        setAfterPhotos((prev) => [...prev, mapped]);
      }

      toast?.success('Photo ajoutée.');
    } catch (uploadErr) {
      console.error('Erreur upload photo reservation:', uploadErr);
      toast?.error(uploadErr?.message || 'Impossible de téléverser cette photo.');
    } finally {
      setUploadingPhase(null);
    }
  };

  const handleBeforePhotoAdd = async (payload) => handlePhotoAdd(photoService?.PHASES?.START || 'start', payload);
  const handleAfterPhotoAdd = async (payload) => handlePhotoAdd(photoService?.PHASES?.END || 'end', payload);

  const handlePhotoDelete = async (phase, photoId) => {
    const sourceList = phase === (photoService?.PHASES?.START || 'start') ? beforePhotos : afterPhotos;
    const photo = sourceList?.find((item) => item?.id === photoId);
    if (!photo) return;

    try {
      const { error: deleteDbError } = await photoService?.deletePhoto(photoId);
      if (deleteDbError) throw deleteDbError;

      if (photo?.storagePath) {
        const { error: deleteStorageError } = await storageService?.deleteFile('reservation-photos', photo?.storagePath);
        if (deleteStorageError) {
          console.warn('Suppression storage partielle reservation photo:', deleteStorageError);
        }
      }

      if (phase === (photoService?.PHASES?.START || 'start')) {
        setBeforePhotos((prev) => prev?.filter((p) => p?.id !== photoId));
      } else {
        setAfterPhotos((prev) => prev?.filter((p) => p?.id !== photoId));
      }

      toast?.success('Photo supprimée.');
    } catch (deleteErr) {
      console.error('Erreur suppression photo reservation:', deleteErr);
      toast?.error(deleteErr?.message || 'Impossible de supprimer cette photo.');
    }
  };

  const handleBeforePhotoDelete = async (photoId) => handlePhotoDelete(photoService?.PHASES?.START || 'start', photoId);
  const handleAfterPhotoDelete = async (photoId) => handlePhotoDelete(photoService?.PHASES?.END || 'end', photoId);

  const mergeInspectionSession = (session) => {
    if (!session?.phase) return;
    setInspectionSessions((prev) => ({
      ...(prev || {}),
      [normalizePhase(session?.phase)]: session
    }));
  };

  const handleConfirmPresence = async (phase) => {
    if (!reservation?.id || !currentUserRole) {
      toast?.error('Vous devez être participant de la réservation.');
      return;
    }

    const normalizedPhase = normalizePhase(phase);
    if (normalizedPhase === startPhaseKey && !isStartInspectionDay) {
      toast?.error(`Validation debut autorisée uniquement le ${formatDateDayLabel(startDateOnly)}.`);
      return;
    }
    if (normalizedPhase === endPhaseKey && !isEndInspectionDay) {
      toast?.error(`Validation fin autorisée uniquement le ${formatDateDayLabel(endDateOnly)}.`);
      return;
    }

    const phaseLabel = formatPhaseForLabel(normalizedPhase);
    const confirmed = window?.confirm?.(
      `Confirmation de présence (${phaseLabel}).\n\n${inspectionService?.ATTESTATION_TEXT}\n\nConfirmer ?`
    );
    if (!confirmed) return;

    try {
      setPresenceConfirmingPhase(normalizedPhase);
      const { data, error: confirmError } = await inspectionService?.confirmPresence({
        reservationId: reservation?.id,
        phase: normalizedPhase
      });

      if (confirmError) throw confirmError;
      mergeInspectionSession(data);
      toast?.success(`Présence ${phaseLabel} confirmée.`);
      await loadPageData();
    } catch (confirmErr) {
      console.error('Erreur confirmation presence inspection:', confirmErr);
      toast?.error(confirmErr?.message || 'Impossible de confirmer votre présence.');
    } finally {
      setPresenceConfirmingPhase(null);
    }
  };

  const handleDismissPresencePopup = () => {
    if (!presencePopupPhase) return;
    setPresencePopupDismissedByPhase((prev) => ({
      ...(prev || {}),
      [presencePopupPhase]: true
    }));
  };

  const handleFocusPresenceButton = () => {
    if (!presencePopupButtonId) return;
    setActiveView('upload');

    window?.requestAnimationFrame?.(() => {
      const targetButton = document?.getElementById(presencePopupButtonId);
      if (!targetButton) return;
      targetButton?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      targetButton?.focus?.();
    });
  };

  const handleFinalizePhasePhotos = async (phase) => {
    if (!reservation?.id || !currentUserRole) {
      toast?.error('Vous devez être participant de la réservation.');
      return;
    }

    const normalizedPhase = normalizePhase(phase);
    if (normalizedPhase === startPhaseKey && !isStartInspectionDay) {
      toast?.error(`Finalisation debut autorisée uniquement le ${formatDateDayLabel(startDateOnly)}.`);
      return;
    }
    if (normalizedPhase === endPhaseKey && !isEndInspectionDay) {
      toast?.error(`Finalisation fin autorisée uniquement le ${formatDateDayLabel(endDateOnly)}.`);
      return;
    }

    const phaseLabel = formatPhaseForLabel(normalizedPhase);
    const confirmed = window?.confirm?.(
      `Finaliser vos photos de ${phaseLabel} ? Cette validation est définitive après clôture de la phase.`
    );
    if (!confirmed) return;

    try {
      setPhotosFinalizingPhase(normalizedPhase);
      const { data, error: finalizeError } = await inspectionService?.finalizePhotos({
        reservationId: reservation?.id,
        phase: normalizedPhase
      });

      if (finalizeError) throw finalizeError;
      mergeInspectionSession(data);
      toast?.success(`Photos de ${phaseLabel} finalisées.`);
      await loadPageData();
    } catch (finalizeErr) {
      console.error('Erreur finalisation photos inspection:', finalizeErr);
      toast?.error(finalizeErr?.message || 'Impossible de finaliser cette phase.');
    } finally {
      setPhotosFinalizingPhase(null);
    }
  };

  const handleOpenInspectionDispute = async ({ selectedPhotoIds, description, title } = {}) => {
    if (!reservation?.id || !user?.id || !currentUserRole) {
      toast?.error('Vous devez être participant de la réservation.');
      return { ok: false };
    }

    if (!canOpenDispute) {
      toast?.error('La contestation n’est plus disponible pour cette réservation.');
      return { ok: false };
    }

    if (!Array?.isArray(selectedPhotoIds) || selectedPhotoIds?.length === 0) {
      toast?.error('Sélectionnez au moins une photo précise.');
      return { ok: false };
    }

    if (String(description || '')?.trim()?.length < 30) {
      toast?.error('Ajoutez une explication détaillée (minimum 30 caractères).');
      return { ok: false };
    }

    try {
      setOpeningDispute(true);
      const { data, error: disputeError } = await inspectionService?.openDispute({
        reservationId: reservation?.id,
        selectedPhotoIds,
        description,
        title
      });

      if (disputeError) throw disputeError;

      toast?.success('Litige enregistré. Le dossier est gelé pour modération interne.');
      await loadPageData();
      return { ok: true, data };
    } catch (disputeErr) {
      console.error('Erreur ouverture litige inspection:', disputeErr);
      toast?.error(disputeErr?.message || 'Impossible d’ouvrir le litige.');
      return { ok: false, error: disputeErr };
    } finally {
      setOpeningDispute(false);
    }
  };

  const handleDepositDecision = async (targetStatus, confirmationMessage) => {
    if (!reservation?.id) return;
    if (!canManageCaution) {
      toast?.error(cautionDecisionLockReason || "Seul le propriétaire peut gerer la caution.");
      return;
    }

    const confirmed = window?.confirm?.(confirmationMessage);
    if (!confirmed) return;

    try {
      setCautionActionLoading(true);
      const { data, error: updateError } = await reservationService?.updateDepositStatus(
        reservation?.id,
        targetStatus,
        { clearReleaseTimestamp: true }
      );

      if (updateError) throw updateError;

      setReservation((prev) => ({ ...(prev || {}), ...(data || {}), deposit_status: data?.deposit_status || targetStatus }));
      toast?.success(targetStatus === 'released' ? 'Caution libérée.' : 'Caution marquée comme retenue.');
    } catch (decisionError) {
      console.error('Erreur mise ? jour caution:', decisionError);
      toast?.error(decisionError?.message || 'Impossible de mettre ? jour la caution.');
    } finally {
      setCautionActionLoading(false);
    }
  };

  const handleReleaseCaution = async () => handleDepositDecision(
    'released',
    "Confirmer la libération de la caution ? Cette action mettra à jour le statut de la réservation."
  );

  const handleCaptureCaution = async () => handleDepositDecision(
    'captured',
    "Confirmer la retenue de la caution ? Assurez-vous d'avoir des preuves (photos/messages)."
  );

  const equipmentImage = useMemo(() => {
    const annoncePhotos = Array?.isArray(reservation?.annonce?.photos) ? reservation?.annonce?.photos : [];
    const resolved = storageService?.getAnnoncePhotoUrls(annoncePhotos);
    return resolved?.[0] || annoncePhotos?.[0] || '/assets/images/no_image.png';
  }, [reservation]);

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-6 md:py-8">
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <Icon name="ArrowLeft" size={20} />
            <span>Retour</span>
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Photos d'état des lieux</h1>
          <p className="text-muted-foreground">Documentation réelle de l'état du matériel avant et après location</p>
        </div>

        {loading && (
          <div className="bg-white rounded-lg shadow-elevation-1 p-6 mb-6">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Icon name="Loader2" size={20} className="animate-spin" />
              <span>Chargement de la reservation et des photos...</span>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="bg-white rounded-lg shadow-elevation-1 p-6 mb-6">
            <div className="flex items-start gap-3 text-destructive">
              <Icon name="AlertCircle" size={20} className="mt-0.5" />
              <div>
                <p className="font-medium">{error}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Cette page n'affiche plus de reservation fictive.
                </p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && reservation && (
          <>
            {showPresencePopup && (
              <div
                className="fixed inset-0 z-[2200] bg-black/60 px-4 py-6 md:py-10"
                role="dialog"
                aria-modal="true"
                aria-labelledby="presence-popup-title"
              >
                <div className="mx-auto w-full max-w-2xl rounded-2xl border border-amber-200 bg-white shadow-elevation-4 overflow-hidden">
                  <div className="bg-amber-50 border-b border-amber-200 px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className="h-11 w-11 rounded-full bg-amber-100 text-amber-800 inline-flex items-center justify-center flex-shrink-0">
                        <Icon name="AlertTriangle" size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 id="presence-popup-title" className="text-xl md:text-2xl font-bold text-amber-900">
                          Action obligatoire avant les photos
                        </h2>
                        <p className="mt-1 text-sm text-amber-800">
                          Phase {presencePopupPhaseLabel} - autorisée le {presencePopupDateLabel}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-5">
                    <p className="text-base text-foreground font-medium">
                      Vous devez cliquer sur le bouton <span className="font-bold text-[#17a2b8]">"Confirmer ma présence"</span> pour continuer.
                    </p>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Tant que la presence n'est pas confirmée par les 2 parties, la caméra reste bloquée.
                    </p>

                    <div className="mt-5 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground">
                      <p className="font-medium mb-1">Ce que vous devez faire maintenant :</p>
                      <p>1. Cliquez sur "Aller au bouton".</p>
                      <p>2. Cliquez sur "Confirmer ma présence".</p>
                    </div>

                    <div className="mt-5 flex flex-col sm:flex-row gap-3">
                      <Button
                        iconName="MousePointerClick"
                        className="bg-[#17a2b8] hover:bg-[#138496] text-white"
                        onClick={handleFocusPresenceButton}
                        fullWidth={true}
                      >
                        Aller au bouton
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleDismissPresencePopup}
                        fullWidth={true}
                      >
                        J'ai compris
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow-elevation-1 p-4 mb-6">
              <div className="flex items-center gap-4">
                <img
                  src={equipmentImage}
                  alt={reservation?.annonce?.titre || 'Matériel'}
                  className="w-20 h-20 object-cover rounded-lg"
                />

                <div className="flex-1">
                  <h2 className="font-semibold text-foreground mb-1">{reservation?.annonce?.titre || 'Matériel'}</h2>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Icon name="Calendar" size={14} />
                      <span>
                        {reservation?.start_date ? new Date(reservation?.start_date)?.toLocaleDateString('fr-FR') : '-'}
                        {' - '}
                        {reservation?.end_date ? new Date(reservation?.end_date)?.toLocaleDateString('fr-FR') : '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Icon name="User" size={14} />
                      <span>Propriétaire: {reservation?.owner?.pseudo || '-'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Icon name="UserCheck" size={14} />
                      <span>Locataire: {reservation?.renter?.pseudo || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mb-6">
              <Button
                variant={activeView === 'upload' ? 'default' : 'outline'}
                onClick={() => setActiveView('upload')}
                iconName="Upload"
                className={activeView === 'upload' ? 'bg-[#17a2b8] hover:bg-[#138496]' : ''}
              >
                Gestion des photos
              </Button>
              <Button
                variant={activeView === 'comparison' ? 'default' : 'outline'}
                onClick={() => setActiveView('comparison')}
                iconName="Columns"
                className={activeView === 'comparison' ? 'bg-[#17a2b8] hover:bg-[#138496]' : ''}
                disabled={beforePhotos?.length === 0 && afterPhotos?.length === 0}
              >
                Vue comparative
              </Button>
            </div>

            {uploadingPhase && (
              <div className="mb-6 bg-primary/5 border border-primary/10 rounded-lg p-3 text-sm text-muted-foreground flex items-center gap-2">
                <Icon name="Loader2" size={16} className="animate-spin" />
                <span>Téléversement en cours ({uploadingPhase === (photoService?.PHASES?.START || 'start') ? 'avant location' : 'après restitution'})...</span>
              </div>
            )}

            {activeView === 'upload' && (
              <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex gap-2">
                  <Icon name="ShieldCheck" size={18} className="text-amber-700 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-900 mb-1">Mode renforce etat des lieux</p>
                    <p className="text-amber-800">
                      La caméra est activée uniquement après confirmation de présence par le propriétaire et le locataire.
                      Chaque partie doit ensuite finaliser explicitement ses photos pour permettre la clôture de la phase.
                      Les validations sont autorisées uniquement le jour correspondant (remise pour début, restitution pour fin).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeView === 'upload' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BeforePhotosSection
                  photos={beforePhotos}
                  canUpload={canUploadBefore}
                  onPhotoAdd={handleBeforePhotoAdd}
                  onPhotoDelete={handleBeforePhotoDelete}
                  session={beforeSession}
                  currentUserRole={currentUserRole}
                  ownerLabel={reservation?.owner?.pseudo || 'Propriétaire'}
                  renterLabel={reservation?.renter?.pseudo || 'Locataire'}
                  canConfirmPresence={canConfirmBeforePresence}
                  onConfirmPresence={() => handleConfirmPresence(startPhaseKey)}
                  confirmPresenceLoading={presenceConfirmingPhase === startPhaseKey}
                  canFinalizePhotos={canFinalizeBefore}
                  onFinalizePhotos={() => handleFinalizePhasePhotos(startPhaseKey)}
                  finalizePhotosLoading={photosFinalizingPhase === startPhaseKey}
                  caméraLockedReason={beforeCameraLockedReason}
                  isPhaseClosed={beforePhaseClosed}
                  attestationText={inspectionService?.ATTESTATION_TEXT}
                  presenceButtonId={`confirm-presence-start-${reservation?.id || reservationId || 'reservation'}`}
                  highlightPresenceButton={showPresencePopup && presencePopupPhase === startPhaseKey}
                />

                <AfterPhotosSection
                  photos={afterPhotos}
                  canUpload={canUploadAfter}
                  onPhotoAdd={handleAfterPhotoAdd}
                  onPhotoDelete={handleAfterPhotoDelete}
                  session={afterSession}
                  currentUserRole={currentUserRole}
                  ownerLabel={reservation?.owner?.pseudo || 'Propriétaire'}
                  renterLabel={reservation?.renter?.pseudo || 'Locataire'}
                  canConfirmPresence={canConfirmAfterPresence}
                  onConfirmPresence={() => handleConfirmPresence(endPhaseKey)}
                  confirmPresenceLoading={presenceConfirmingPhase === endPhaseKey}
                  canFinalizePhotos={canFinalizeAfter}
                  onFinalizePhotos={() => handleFinalizePhasePhotos(endPhaseKey)}
                  finalizePhotosLoading={photosFinalizingPhase === endPhaseKey}
                  caméraLockedReason={afterCameraLockedReason}
                  isPhaseClosed={afterPhaseClosed}
                  attestationText={inspectionService?.ATTESTATION_TEXT}
                  presenceButtonId={`confirm-presence-end-${reservation?.id || reservationId || 'reservation'}`}
                  highlightPresenceButton={showPresencePopup && presencePopupPhase === endPhaseKey}
                />
              </div>
            ) : (
              <ComparisonView
                beforePhotos={beforePhotos}
                afterPhotos={afterPhotos}
                cautionAmount={cautionAmount}
                cautionStatus={cautionStatus}
                canManageCaution={canManageCaution}
                cautionActionLoading={cautionActionLoading}
                onReleaseCaution={handleReleaseCaution}
                onCaptureCaution={handleCaptureCaution}
                settlement={inspectionSettlement}
                disputes={inspectionDisputes}
                currentUserId={user?.id || null}
                currentUserRole={currentUserRole}
                canOpenDispute={canOpenDispute && canSubmitDisputeAgainstPhotos}
                disputeOpening={openingDispute}
                onOpenDispute={handleOpenInspectionDispute}
                manualCautionLockedReason={cautionDecisionLockReason}
                legalArbitrationScopeNote={inspectionService?.INTERNAL_ARBITRATION_SCOPE_NOTE}
                contestWindowEndsAt={afterSession?.contest_window_ends_at || inspectionSettlement?.contest_window_ends_at || null}
                settlementPaymentHoldStatus={settlementPaymentHoldStatus}
              />
            )}

            <div className="mt-6 bg-[#17a2b8]/10 border border-[#17a2b8]/20 rounded-lg p-4">
              <div className="flex gap-2">
                <Icon name="Info" size={18} className="text-[#17a2b8] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Photos d'état des lieux (réelles)</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>- Les photos affichees proviennent de la reservation selectionnee.</li>
                    <li>- Aucune photo de demonstration n'est prechargee.</li>
                    <li>- Les commentaires/GPS ne s'affichent que s'ils existent reellement dans les donnees.</li>
                    <li>- Pour l'arbitrage interne de la plateforme, seules les photos prises via ce module officiel sont prises en compte.</li>
                    <li>- Cette règle d'arbitrage interne n'exclut pas les droits légaux des parties en dehors de la plateforme.</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default PhotosEtatDesLieux;
