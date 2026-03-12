import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '../AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import notificationService from '../../services/notificationService';
import {
  buildPromotionSharePayload,
  downloadPromotionImage,
  getSocialPromotionNetworks,
  openSocialShareWindows,
  shareOnInstagram
} from '../../services/socialPromotionService';

const PROMOTION_POPUP_STORAGE_KEY = 'ldv:listings:promotion-popup-seen';

const readSeenPromotionNotificationIds = () => {
  if (typeof window === 'undefined') return [];

  try {
    const rawValue = window.localStorage.getItem(PROMOTION_POPUP_STORAGE_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch (_error) {
    return [];
  }
};

const hasPromotionNotificationBeenSeen = (notificationId) => (
  Boolean(notificationId) && readSeenPromotionNotificationIds()?.includes(notificationId)
);

const markPromotionNotificationAsSeenLocally = (notificationId) => {
  if (typeof window === 'undefined' || !notificationId) return;

  const currentIds = readSeenPromotionNotificationIds();
  const nextIds = [...new Set([...currentIds, notificationId])]?.slice(-50);
  window.localStorage.setItem(PROMOTION_POPUP_STORAGE_KEY, JSON.stringify(nextIds));
};

const isPromotionReadyNotification = (notification) => {
  const type = String(notification?.type || '')?.toLowerCase();
  const payload = notification?.payload && typeof notification?.payload === 'object'
    ? notification?.payload
    : {};

  return type === notificationService?.TYPES?.ANNONCE_APPROVED
    && payload?.promotion_ready === true;
};

const buildPromotionPrompt = (notification) => {
  if (!notification) return null;

  const payload = notification?.payload && typeof notification?.payload === 'object'
    ? notification?.payload
    : {};

  const suggestedNetworks = Array.isArray(payload?.social_networks)
    ? payload?.social_networks?.filter(Boolean)
    : [];

  return {
    id: notification?.id,
    title: String(payload?.annonce_title || payload?.title || 'Votre annonce est en ligne').trim(),
    message: String(
      notification?.message
      || payload?.message
      || 'Le visuel et le lien sont deja prets. Partagez-la pour gagner en visibilite.'
    ).trim(),
    actionLink: String(payload?.actionLink || payload?.url || '/mes-annonces').trim(),
    shareTitle: String(payload?.share_title || payload?.annonce_title || payload?.title || '').trim(),
    shareDescription: String(payload?.share_description || payload?.message || '').trim(),
    shareUrl: String(payload?.share_url || payload?.url || '').trim(),
    imageUrl: String(payload?.image_url || payload?.imageUrl || '').trim(),
    suggestedNetworks,
    payload
  };
};

const buildNetworkSequence = (availableNetworks = [], preferredNetworkIds = []) => {
  const preferredIds = Array.isArray(preferredNetworkIds)
    ? preferredNetworkIds?.filter(Boolean)
    : [];

  if (!preferredIds?.length) {
    return availableNetworks;
  }

  const preferredSet = new Set(preferredIds);
  const preferredNetworks = availableNetworks?.filter((network) => preferredSet?.has(network?.id));
  const remainingNetworks = availableNetworks?.filter((network) => !preferredSet?.has(network?.id));

  return [...preferredNetworks, ...remainingNetworks];
};

const ListingPromotionPopup = () => {
  const { user, loading } = useAuth();
  const [promotionNotification, setPromotionNotification] = useState(null);
  const [currentNetworkIndex, setCurrentNetworkIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const socialNetworks = useMemo(() => getSocialPromotionNetworks(), []);

  const activePrompt = useMemo(
    () => buildPromotionPrompt(promotionNotification),
    [promotionNotification]
  );

  const networkSequence = useMemo(
    () => buildNetworkSequence(socialNetworks, activePrompt?.suggestedNetworks),
    [activePrompt?.suggestedNetworks, socialNetworks]
  );

  const currentNetwork = networkSequence?.[currentNetworkIndex] || null;
  const totalNetworks = networkSequence?.length || 0;

  const buildActiveSharePayload = () => buildPromotionSharePayload({
    ...activePrompt?.payload,
    title: activePrompt?.shareTitle || activePrompt?.title,
    share_title: activePrompt?.shareTitle || activePrompt?.title,
    share_description: activePrompt?.shareDescription || activePrompt?.message,
    share_url: activePrompt?.shareUrl || activePrompt?.actionLink,
    image_url: activePrompt?.imageUrl
  }, window.location?.origin);

  useEffect(() => {
    if (!activePrompt) {
      setCurrentNetworkIndex(0);
      return;
    }

    setCurrentNetworkIndex(0);
  }, [activePrompt]);

  useEffect(() => {
    let isMounted = true;
    let channel = null;

    const resetPrompt = () => {
      if (!isMounted) return;
      setPromotionNotification(null);
      setIsVisible(false);
    };

    const showNotificationIfEligible = (notification) => {
      if (!notification || !isMounted) return;
      if (!isPromotionReadyNotification(notification)) return;
      if (hasPromotionNotificationBeenSeen(notification?.id)) return;

      setPromotionNotification(notification);
      setIsVisible(true);
    };

    const loadPromotionNotifications = async () => {
      if (loading || !user?.id) {
        resetPrompt();
        return;
      }

      try {
        const { data, error } = await notificationService?.getUserNotifications(user?.id, {
          is_read: false,
          is_archived: false,
          type: notificationService?.TYPES?.ANNONCE_APPROVED,
          limit: 10
        });

        if (error) throw error;
        if (!isMounted) return;

        const nextNotification = (data || [])?.find((notification) => (
          isPromotionReadyNotification(notification)
          && !hasPromotionNotificationBeenSeen(notification?.id)
        ));

        if (nextNotification) {
          setPromotionNotification(nextNotification);
          setIsVisible(true);
        } else {
          resetPrompt();
        }
      } catch (error) {
        console.warn('Chargement popup promotion annonce impossible:', error?.message || error);
        resetPrompt();
      }

      channel = notificationService?.subscribeToNotifications(user?.id, (newNotification) => {
        showNotificationIfEligible(newNotification);
      });
    };

    loadPromotionNotifications();

    return () => {
      isMounted = false;
      notificationService?.unsubscribe(channel);
    };
  }, [loading, user?.id]);

  const finalizePrompt = async () => {
    if (!promotionNotification?.id) {
      setIsVisible(false);
      setPromotionNotification(null);
      return;
    }

    const notificationId = promotionNotification?.id;
    markPromotionNotificationAsSeenLocally(notificationId);
    setIsVisible(false);
    setPromotionNotification(null);

    try {
      await notificationService?.markAsRead(notificationId);
      window?.dispatchEvent?.(new CustomEvent('ldv:notifications-changed'));
    } catch (error) {
      console.warn('Marquage notification promotion impossible:', error?.message || error);
    }
  };

  const handleDismiss = async () => {
    await finalizePrompt();
  };

  const advanceToNextNetwork = async () => {
    const nextIndex = currentNetworkIndex + 1;

    if (nextIndex >= totalNetworks) {
      await finalizePrompt();
      return;
    }

    setCurrentNetworkIndex(nextIndex);
  };

  const handleSkipNetwork = async () => {
    if (!currentNetwork) {
      await finalizePrompt();
      return;
    }

    await advanceToNextNetwork();
  };

  const handlePromote = async () => {
    if (!activePrompt || !currentNetwork) return;

    try {
      setIsSubmitting(true);

      const sharePayload = buildActiveSharePayload();

      const result = currentNetwork?.id === 'instagram'
        ? await shareOnInstagram(sharePayload)
        : openSocialShareWindows([currentNetwork?.id], sharePayload);

      if (result?.total === 0 || result?.openedCount === 0) {
        toast?.error(`Le navigateur a bloque l'ouverture de ${currentNetwork?.label}.`);
        return;
      }

      if (currentNetwork?.id === 'instagram') {
        if (result?.copiedText) {
          toast?.success('Legende Instagram copiee. Utilisez aussi le bouton pour telecharger le visuel.');
        } else {
          toast?.success("Instagram ouvert. Ajoutez maintenant votre visuel et le lien de l'annonce.");
        }
      }

      await advanceToNextNetwork();
    } catch (error) {
      console.error('Promotion annonce impossible:', error);
      toast?.error(error?.message || 'Impossible de lancer la promotion pour le moment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadVisual = async () => {
    if (!activePrompt?.imageUrl) return;

    try {
      setIsSubmitting(true);
      const sharePayload = buildActiveSharePayload();
      const result = await downloadPromotionImage(sharePayload);

      if (result?.downloaded) {
        toast?.success('Visuel Instagram telecharge.');
        return;
      }

      if (result?.openedPreview) {
        toast?.success("Visuel ouvert. Enregistrez-le ensuite depuis l'onglet.");
        return;
      }

      toast?.error('Impossible de recuperer le visuel pour le moment.');
    } catch (error) {
      console.error('Telechargement du visuel impossible:', error);
      toast?.error(error?.message || 'Impossible de telecharger le visuel pour le moment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user?.id || !isVisible || !activePrompt) {
    return null;
  }

  if (!currentNetwork) {
    return null;
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-[70] sm:inset-x-auto sm:right-4 sm:bottom-4">
      <div
        key={currentNetwork?.id}
        className="w-full sm:w-[340px] rounded-2xl border border-slate-200 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur"
      >
        <div className="p-3.5">
          <div className="flex items-start gap-3">
            <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
              {activePrompt?.imageUrl ? (
                <img
                  src={activePrompt?.imageUrl}
                  alt={activePrompt?.title || 'Visuel annonce'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Icon name="Package" size={20} className="text-slate-500" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0d7b88]">
                  Annonce validee
                </p>
                <span className="text-[11px] font-medium text-slate-400">
                  {currentNetworkIndex + 1}/{totalNetworks}
                </span>
              </div>
              <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">
                Partager sur {currentNetwork?.label}
              </h3>
              <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                {activePrompt?.title}
              </p>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Fermer la popup de promotion"
            >
              <Icon name="X" size={16} />
            </button>
          </div>

          <div className="mt-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${currentNetwork?.activeClassName}`}>
                <Icon name={currentNetwork?.icon} size={13} />
                <span>{currentNetwork?.label}</span>
              </span>
              <span>Souhaitez-vous le partager ici ?</span>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">
              {currentNetwork?.shareHint || 'Une fois votre choix fait, nous passons automatiquement au reseau suivant.'}
            </p>
            {currentNetwork?.id === 'instagram' ? (
              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                Ouvrez Instagram, collez la legende prete, puis publiez quand votre visuel est ajoute.
              </p>
            ) : null}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handlePromote}
              disabled={isSubmitting}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${currentNetwork?.buttonClassName || 'bg-[#0d7b88] hover:bg-[#0b6873] text-white'}`}
            >
              {isSubmitting ? (
                <Icon name="Loader2" size={15} className="animate-spin" />
              ) : (
                <Icon name={currentNetwork?.icon} size={15} />
              )}
              <span>{currentNetwork?.buttonLabel || 'Partager'}</span>
            </button>

            {currentNetwork?.id === 'instagram' && activePrompt?.imageUrl ? (
              <button
                type="button"
                onClick={handleDownloadVisual}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Telecharger le visuel
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleSkipNetwork}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Ne pas partager
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingPromotionPopup;
