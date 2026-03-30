import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import {
  ActionCard,
  ActionHero,
  ActionPageShell
} from '../../components/page/ActionPageLayout';
import { useAuth } from '../../contexts/AuthContext';
import profileService from '../../services/profileService';
import reservationService from '../../services/reservationService';
import userProfileDocumentService from '../../services/userProfileDocumentService';
import ProfileTab from './components/ProfileTab';
import ActivityHistoryTab from './components/ActivityHistoryTab';
import DocumentsTab from './components/DocumentsTab';
import SettingsSection from './components/SettingsSection';
import PayoutSettingsTab from './components/PayoutSettingsTab';
import LogoutTab from './components/LogoutTab';
import ReportSection from './components/ReportSection';
import {
  ACCOUNT_PAGE_META,
  ACCOUNT_SECTION_PATHS,
  resolveLegacyAccountTabPath
} from './accountNavigation';
import { isReservationPaymentConfirmed } from '../../utils/reservationStatus';

const ACCOUNT_SETTINGS_STORAGE_KEY_PREFIX = 'ldv:account-settings:v1';

const buildDefaultSettings = () => ({
  notifications: {
    newBooking: true,
    messages: true,
    paymentConfirmed: true,
    returnReminder: true,
    documentReminder: true,
    dailyDigest: false,
    promotions: false
  },
  security: {
    passwordHelpOpenedAt: null,
    twoFactorEnabled: false,
    activeSessions: [],
    lastPasswordChangeLabel: 'Dernière modification inconnue'
  },
  preferences: {
    language: 'Français',
    currency: 'Euro (€)',
    timezone: 'Europe/Paris (UTC+1)'
  }
});

const buildAccountSettingsStorageKey = (userId) => (
  `${ACCOUNT_SETTINGS_STORAGE_KEY_PREFIX}:${String(userId || 'anonymous')}`
);

const buildCurrentSessionEntry = () => ({
  id: 'current',
  deviceLabel: typeof navigator !== 'undefined'
    ? (navigator?.userAgent?.split(')')?.[0] || 'Navigateur actuel')
    : 'Navigateur actuel',
  lastSeenAt: new Date().toISOString(),
  current: true
});

const readStoredSettings = (userId) => {
  if (typeof window === 'undefined' || !window?.localStorage || !userId) {
    return buildDefaultSettings();
  }

  try {
    const rawValue = window.localStorage.getItem(buildAccountSettingsStorageKey(userId));
    const parsedValue = rawValue ? JSON.parse(rawValue) : {};
    const defaults = buildDefaultSettings();
    const activeSessions = Array.isArray(parsedValue?.security?.activeSessions)
      && parsedValue?.security?.activeSessions?.length > 0
      ? parsedValue.security.activeSessions
      : [buildCurrentSessionEntry()];

    return {
      ...defaults,
      ...parsedValue,
      notifications: {
        ...defaults.notifications,
        ...(parsedValue?.notifications || {})
      },
      security: {
        ...defaults.security,
        ...(parsedValue?.security || {}),
        activeSessions
      },
      preferences: {
        ...defaults.preferences,
        ...(parsedValue?.preferences || {})
      }
    };
  } catch (_error) {
    return buildDefaultSettings();
  }
};

const persistStoredSettings = (userId, settings) => {
  if (typeof window === 'undefined' || !window?.localStorage || !userId || !settings) return;

  try {
    window.localStorage.setItem(
      buildAccountSettingsStorageKey(userId),
      JSON.stringify(settings)
    );
  } catch (error) {
    console.warn('Impossible de sauvegarder les paramètres du compte:', error);
  }
};

const UserProfileDocuments = ({ section = 'profile' }) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const sectionKey = ACCOUNT_PAGE_META?.[section] ? section : 'profile';
  const searchParams = useMemo(() => new URLSearchParams(location?.search || ''), [location?.search]);
  const legacyTargetPath = resolveLegacyAccountTabPath(searchParams?.get('tab'));
  const shouldStripActivation = sectionKey !== 'payouts' && searchParams?.has('activation');
  const shouldRedirectLegacyAccountPath = Boolean(legacyTargetPath)
    && (location?.pathname !== legacyTargetPath || searchParams?.has('tab'));

  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [activities, setActivities] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [settings, setSettings] = useState(buildDefaultSettings());
  const currentPageMeta = ACCOUNT_PAGE_META?.[sectionKey] || ACCOUNT_PAGE_META.profile;

  useEffect(() => {
    if (!shouldRedirectLegacyAccountPath && !shouldStripActivation) {
      return;
    }

    const nextPath = legacyTargetPath || location?.pathname || ACCOUNT_SECTION_PATHS.profile;
    const nextParams = new URLSearchParams(location?.search || '');

    nextParams.delete('tab');

    if (nextPath !== ACCOUNT_SECTION_PATHS.payouts) {
      nextParams.delete('activation');
    }

    const nextSearch = nextParams?.toString();

    navigate(
      {
        pathname: nextPath,
        search: nextSearch ? `?${nextSearch}` : ''
      },
      { replace: true }
    );
  }, [
    legacyTargetPath,
    location?.pathname,
    location?.search,
    navigate,
    shouldRedirectLegacyAccountPath,
    shouldStripActivation
  ]);

  const loadUserDocuments = async (userId) => {
    if (!userId) {
      setDocuments([]);
      return;
    }

    try {
      const { data, error } = await userProfileDocumentService?.listUserDocuments(userId);

      if (error) {
        console.error('Erreur lors du chargement des documents utilisateur:', error);
        setDocuments([]);
        return;
      }

      setDocuments((data || [])?.map((row) => userProfileDocumentService?.mapRowToUiDocument(row)));
    } catch (error) {
      console.error('Erreur lors du chargement des documents utilisateur:', error);
      setDocuments([]);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    setSettings(readStoredSettings(user?.id));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    persistStoredSettings(user?.id, settings);
  }, [settings, user?.id]);

  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data: profile, error } = await profileService?.getProfile(user?.id);

        if (error) {
          console.error('Erreur lors du chargement du profil:', error);
          setLoading(false);
          return;
        }

        if (profile) {
          setUserData({
            pseudonym: profile?.pseudo || 'Utilisateur',
            email: profile?.email || user?.email || '',
            phone: profile?.phone || '',
            address: profile?.address || '',
            city: profile?.city || '',
            postalCode: profile?.postal_code || '',
            bio: profile?.bio || '',
            avatar: profile?.avatar_url || '/assets/images/no_image.png',
            avatarAlt: `Photo de profil de ${profile?.pseudo || 'utilisateur'}`,
            role: 'owner',
            isVerified: true,
            stripeConnectStatus: profile?.stripe_account_id ? 'completed' : 'pending',
            stats: {
              listings: 0,
              bookings: 0,
              rating: 0,
              reviews: 0
            }
          });
        }
      } catch (error) {
        console.error('Erreur lors du chargement du profil utilisateur:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [user]);

  useEffect(() => {
    if (sectionKey !== 'activity' || !user?.id) {
      if (sectionKey !== 'activity') {
        setActivities([]);
      }
      return;
    }

    const mapReservationStatusToActivityStatus = (status) => {
      const normalizedStatus = String(status || '')?.toLowerCase();
      if (normalizedStatus === 'completed') return 'completed';
      if (['cancelled', 'refused', 'rejected']?.includes(normalizedStatus)) return 'cancelled';
      if (['active', 'ongoing']?.includes(normalizedStatus)) return 'active';
      return 'pending';
    };

    const buildReservationActivity = (reservation, role) => {
      const title = reservation?.annonce?.titre || 'Réservation';
      const reservationLabel = role === 'owner' ? 'Demande sur votre annonce' : 'Votre réservation';
      const counterpartName = role === 'owner'
        ? reservation?.renter?.pseudo
        : reservation?.owner?.pseudo;

      return {
        id: `${role}-${reservation?.id}`,
        type: role === 'owner' ? 'booking' : 'rental',
        title,
        description: reservationLabel,
        date: reservation?.created_at || reservation?.start_date || reservation?.updated_at || new Date()?.toISOString(),
        status: isReservationPaymentConfirmed(reservation)
          ? 'active'
          : mapReservationStatusToActivityStatus(reservation?.status),
        amount: Number.parseFloat(reservation?.total_price || 0) || 0,
        user: counterpartName ? {
          name: counterpartName,
          avatar: reservation?.renter?.avatar_url || reservation?.owner?.avatar_url || '/assets/images/no_image.png',
          avatarAlt: `Avatar de ${counterpartName}`
        } : null,
        actionLabel: 'Voir détails',
        actionIcon: 'Eye'
      };
    };

    const loadRealActivities = async () => {
      try {
        const [ownerResult, renterResult] = await Promise.all([
          reservationService?.getOwnerReservations(user?.id),
          reservationService?.getUserReservations(user?.id)
        ]);

        const ownerReservations = ownerResult?.error ? [] : ownerResult?.data || [];
        const renterReservations = renterResult?.error ? [] : renterResult?.data || [];
        const realActivities = [
          ...ownerReservations?.map((reservation) => buildReservationActivity(reservation, 'owner')),
          ...renterReservations?.map((reservation) => buildReservationActivity(reservation, 'renter'))
        ]?.sort((a, b) => new Date(b?.date) - new Date(a?.date));

        setActivities(realActivities);
      } catch (error) {
        console.error('Erreur lors du chargement des activités réelles :', error);
        setActivities([]);
      }
    };

    loadRealActivities();
  }, [sectionKey, user?.id]);

  useEffect(() => {
    if (sectionKey !== 'documents') {
      setDocuments([]);
      return;
    }

    void loadUserDocuments(user?.id);
  }, [sectionKey, user?.id]);

  const handleUpdateProfile = async (updatedData) => {
    if (!user?.id) return;

    try {
      const dbFields = {
        pseudo: updatedData?.pseudonym,
        email: updatedData?.email,
        phone: updatedData?.phone,
        address: updatedData?.address,
        city: updatedData?.city,
        postal_code: updatedData?.postalCode
      };

      const { error } = await profileService?.updateProfileFields(user?.id, dbFields);

      if (error) {
        console.error('Erreur lors de la mise à jour du profil:', error);
        alert('Erreur lors de la mise à jour du profil');
        return;
      }

      setUserData((prev) => ({
        ...prev,
        ...updatedData
      }));

      alert('Profil mis à jour avec succès');
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      alert('Erreur lors de la mise à jour du profil');
    }
  };

  const handleUploadDocument = async (documentType, file) => {
    if (!user?.id) {
      alert('Veuillez vous connecter pour téléverser un document.');
      return;
    }

    try {
      const { error } = await userProfileDocumentService?.uploadUserDocument(user?.id, documentType, file);

      if (error) {
        console.error('Erreur lors du téléversement du document:', error);
        alert(error?.message || 'Erreur lors du téléversement du document');
        return;
      }

      await loadUserDocuments(user?.id);
    } catch (error) {
      console.error('Erreur lors du téléversement du document:', error);
      alert('Erreur lors du téléversement du document');
    }
  };

  const handleDeleteDocument = async (documentId) => {
    if (!user?.id) return;

    try {
      const { error } = await userProfileDocumentService?.deleteUserDocument(documentId);

      if (error) {
        console.error('Erreur lors de la suppression du document:', error);
        alert(error?.message || 'Erreur lors de la suppression du document');
        return;
      }

      setDocuments((prev) => prev?.filter((doc) => doc?.id !== documentId));
    } catch (error) {
      console.error('Erreur lors de la suppression du document:', error);
      alert('Erreur lors de la suppression du document');
    }
  };

  const handleUpdateSettings = (updatedSettings) => {
    setSettings((prev) => ({
      ...prev,
      ...updatedSettings
    }));
  };

  const renderSection = () => {
    switch (sectionKey) {
      case 'profile':
        return userData
          ? <ProfileTab userData={userData} onUpdateProfile={handleUpdateProfile} />
          : null;
      case 'activity':
        return <ActivityHistoryTab activities={activities} />;
      case 'documents':
        return (
          <DocumentsTab
            documents={documents}
            onUploadDocument={handleUploadDocument}
            onDeleteDocument={handleDeleteDocument}
          />
        );
      case 'settings':
        return <SettingsSection settings={settings} onUpdateSettings={handleUpdateSettings} />;
      case 'payouts':
        return <PayoutSettingsTab />;
      case 'logout':
        return <LogoutTab />;
      case 'report':
        return <ReportSection targetName={userData?.pseudonym || 'Mon compte'} />;
      default:
        return null;
    }
  };

  if (shouldRedirectLegacyAccountPath || shouldStripActivation) {
    return (
      <ActionPageShell
        maxWidth="max-w-5xl"
        hero={(
          <ActionHero
            eyebrow="Mon espace"
            title="On vous emmene vers la bonne section"
            subtitle="La navigation de compte se remet en place automatiquement."
            tone="sky"
          />
        )}
      >
        <ActionCard className="py-16 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Redirection vers votre espace...</p>
        </ActionCard>
      </ActionPageShell>
    );
  }

  if (loading) {
    return (
      <ActionPageShell
        maxWidth="max-w-5xl"
        hero={(
          <ActionHero
            eyebrow="Mon espace"
            title="Votre espace se prepare"
            subtitle="Profil, documents et reglages arrivent ici."
            tone="sky"
          />
        )}
      >
        <ActionCard className="py-16 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement de votre espace...</p>
        </ActionCard>
      </ActionPageShell>
    );
  }

  if (!user) {
    return (
      <ActionPageShell
        maxWidth="max-w-5xl"
        hero={(
          <ActionHero
            eyebrow="Mon espace"
            title="Connexion requise"
            subtitle="Connectez-vous pour acceder a votre profil, vos documents et vos reglages."
            tone="warm"
          />
        )}
      >
        <ActionCard className="py-16 text-center">
          <Icon name="AlertCircle" size={48} className="mx-auto mb-4 text-warning" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Connexion requise</h2>
          <p className="text-muted-foreground mb-4">Veuillez vous connecter pour accéder à cette page.</p>
          <Button onClick={() => { window.location.href = '/authentification'; }}>
            Se connecter
          </Button>
        </ActionCard>
      </ActionPageShell>
    );
  }

  return (
    <ActionPageShell
      maxWidth="max-w-7xl"
      hero={(
        <ActionHero
          eyebrow="Mon espace"
          title={currentPageMeta?.title || 'Mon espace'}
          subtitle={currentPageMeta?.subtitle || 'Retrouvez ici les informations et actions utiles pour votre compte.'}
          tone="sky"
        />
      )}
    >
      <div className="transition-smooth">
        {renderSection()}
      </div>
    </ActionPageShell>
  );
};

export default UserProfileDocuments;


