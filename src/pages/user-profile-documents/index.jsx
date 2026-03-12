import React, { useState, useEffect } from 'react';
import Header from '../../components/navigation/Header';
import Icon from '../../components/AppIcon';
import ProfileTab from './components/ProfileTab';
import ActivityHistoryTab from './components/ActivityHistoryTab';
import DocumentsTab from './components/DocumentsTab';
import SettingsSection from './components/SettingsSection';
import Footer from '../../components/Footer';
import ReportModal from '../../components/ReportModal';
import Button from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import profileService from '../../services/profileService';
import reservationService from '../../services/reservationService';
import userProfileDocumentService from '../../services/userProfileDocumentService';


const UserProfileDocuments = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [showReportModal, setShowReportModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const [userData, setUserData] = useState(null);

  const [activities, setActivities] = useState([]);

  const [documents, setDocuments] = useState([]);

  const [settings, setSettings] = useState({
    notifications: {
      newBooking: true,
      messages: true,
      paymentConfirmed: true,
      returnReminder: true,
      documentReminder: true,
      dailyDigest: false,
      promotions: false
    }
  });

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

  // Load real user profile data from Supabase
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data: profile, error } = await profileService?.getProfile(user?.id);
        
        if (error) {
          console.error('Erreur lors du chargement de profile:', error);
          setLoading(false);
          return;
        }

        if (profile) {
          // Map database fields to component format
          setUserData({
            pseudonym: profile?.pseudo || 'Utilisateur',
            email: profile?.email || user?.email || '',
            phone: profile?.phone || '',
            address: profile?.address || '',
            city: profile?.city || '',
            postalCode: profile?.postal_code || '',
            bio: profile?.bio || '',
            avatar: profile?.avatar_url || "/assets/images/no_image.png",
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
        console.error('Erreur lors du chargement de user profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [user]);

  const mapRéservationStatusToActivityStatus = (status) => {
    if (['completed']?.includes(status)) return 'completed';
    if (['active', 'accepted', 'paid']?.includes(status)) return 'active';
    if (['cancelled', 'refused', 'rejected']?.includes(status)) return 'cancelled';
    return 'pending';
  };

  const buildRéservationActivity = (reservation, role) => {
    const title = reservation?.annonce?.titre || 'Réservation';
    const reservationLabel = role === 'owner' ? 'Demande sur votre annonce' : 'Votre réservation';
    const counterpartName =
      role === 'owner'
        ? reservation?.renter?.pseudo
        : reservation?.owner?.pseudo;

    return {
      id: `${role}-${reservation?.id}`,
      type: role === 'owner' ? 'booking' : 'rental',
      title,
      description: reservationLabel,
      date: reservation?.created_at || reservation?.start_date || reservation?.updated_at || new Date()?.toISOString(),
      status: mapRéservationStatusToActivityStatus(reservation?.status),
      amount: Number.parseFloat(reservation?.total_price || 0) || 0,
      user: counterpartName ?
      {
        name: counterpartName,
        avatar: reservation?.renter?.avatar_url || reservation?.owner?.avatar_url || "/assets/images/no_image.png",
        avatarAlt: `Avatar de ${counterpartName}`
      } : null,
      actionLabel: 'Voir détails',
      actionIcon: 'Eye'
    };
  };

  useEffect(() => {
    const loadRealActivities = async () => {
      if (!user?.id) {
        setActivities([]);
        return;
      }

      try {
        const [ownerResult, renterResult] = await Promise.all([
          reservationService?.getOwnerRéservations(user?.id),
          reservationService?.getUserRéservations(user?.id)
        ]);

        const ownerRéservations = ownerResult?.error ? [] : ownerResult?.data || [];
        const renterRéservations = renterResult?.error ? [] : renterResult?.data || [];

        const realActivities = [
          ...ownerRéservations?.map((reservation) => buildRéservationActivity(reservation, 'owner')),
          ...renterRéservations?.map((reservation) => buildRéservationActivity(reservation, 'renter'))
        ]?.sort((a, b) => new Date(b?.date) - new Date(a?.date));

        setActivities(realActivities);
      } catch (error) {
        console.error('Erreur lors du chargement des activites reelles:', error);
        setActivities([]);
      }
    };

    loadRealActivities();
  }, [user?.id]);

  useEffect(() => {
    loadUserDocuments(user?.id);
  }, [user?.id]);

  const handleUpdateProfile = async (updatedData) => {
    if (!user?.id) return;

    try {
      // Map component fields to database fields
      const dbFields = {
        pseudo: updatedData?.pseudonym,
        email: updatedData?.email,
        phone: updatedData?.phone,
        address: updatedData?.address,
        city: updatedData?.city,
        postal_code: updatedData?.postalCode
      };

      const { data, error } = await profileService?.updateProfileFields(user?.id, dbFields);
      
      if (error) {
        console.error('Erreur lors de la mise à jour de profile:', error);
        alert('Erreur lors de la mise à jour du profil');
        return;
      }

      // Update local state
      setUserData((prev) => ({
        ...prev,
        ...updatedData
      }));

      alert('Profil mis à jour avec succès');
    } catch (error) {
      console.error('Erreur lors de la mise à jour de profile:', error);
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

  const tabs = [
  { id: 'profile', label: 'Profil', icon: 'User' },
  { id: 'activity', label: 'Historique', icon: 'Activity' },
  { id: 'documents', label: 'Documents', icon: 'FileText' },
  { id: 'settings', label: 'Paramètres', icon: 'Settings' }];


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#e9f4ff] via-[#f2f8ff] to-[#e7f5ff] flex flex-col">
        <Header />
        <main className="main-content flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Chargement du profil...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#e9f4ff] via-[#f2f8ff] to-[#e7f5ff] flex flex-col">
        <Header />
        <main className="main-content flex items-center justify-center">
          <div className="text-center">
            <Icon name="AlertCircle" size={48} className="mx-auto mb-4 text-warning" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Connexion requise</h2>
            <p className="text-muted-foreground mb-4">Veuillez vous connecter pour accéder à votre profil</p>
            <Button onClick={() => window.location.href = '/authentification'}>Se connecter</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#e9f4ff] via-[#f2f8ff] to-[#e7f5ff] flex flex-col">
      <Header />
      <main className="main-content">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8 lg:py-12">
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-2">
              Mon Compte
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Gérez votre profil, vos documents et vos préférences
            </p>
          </div>

          <div className="bg-card rounded-xl shadow-elevation-2 mb-6 overflow-x-auto">
            <div className="flex border-b border-border min-w-max">
              {tabs?.map((tab) =>
              <button
                key={tab?.id}
                onClick={() => setActiveTab(tab?.id)}
                className={`flex items-center gap-2 px-4 md:px-6 py-3 md:py-4 text-sm md:text-base font-medium transition-smooth whitespace-nowrap ${
                activeTab === tab?.id ?
                'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`
                }>
                
                  <Icon name={tab?.icon} size={20} />
                  <span>{tab?.label}</span>
                </button>
              )}
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm">
                  <Icon name="MessageSquare" size={16} />
                  Envoyer un message
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReportModal(true)}>
                  
                  <Icon name="Flag" size={16} />
                  Signaler
                </Button>
              </div>
            </div>
          </div>

          <div className="transition-smooth">
            {activeTab === 'profile' && userData &&
            <ProfileTab userData={userData} onUpdateProfile={handleUpdateProfile} />
            }
            {activeTab === 'activity' &&
            <ActivityHistoryTab activities={activities} />
            }
            {activeTab === 'documents' &&
            <DocumentsTab
              documents={documents}
              onUploadDocument={handleUploadDocument}
              onDeleteDocument={handleDeleteDocument} />

            }
            {activeTab === 'settings' &&
            <SettingsSection settings={settings} onUpdateSettings={handleUpdateSettings} />
            }
          </div>
        </div>
      </main>
      <Footer />

      {/* Report Modal */}
      {showReportModal &&
      <ReportModal
        onClose={() => setShowReportModal(false)}
        reportType="user"
        targetId={userData?.pseudonym}
        targetName={userData?.pseudonym} />

      }
    </div>);

};

export default UserProfileDocuments;


