import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import CommuneAutocompleteFields from '../../../components/ui/CommuneAutocompleteFields';
import { useAuth } from '../../../contexts/AuthContext';
import storageService from '../../../services/storageService';
import { getBestKnownCity, setStoredCity } from '../../../utils/cityPrefill';
import {
  buildSharedProfileFromUser,
  getStoredSharedProfile,
  mergeStoredSharedProfile
} from '../../../utils/sharedProfilePrefill';

const buildSyncedProfileSeed = (userProfile, user) => {
  const storedProfile = getStoredSharedProfile();
  const accountProfile = buildSharedProfileFromUser({ userProfile, user });
  const city = getBestKnownCity(accountProfile?.city, storedProfile?.city);

  return {
    first_name: accountProfile?.firstName || storedProfile?.firstName || '',
    last_name: accountProfile?.lastName || storedProfile?.lastName || '',
    pseudo: accountProfile?.pseudonym || storedProfile?.pseudonym || '',
    email: accountProfile?.email || storedProfile?.email || '',
    phone: accountProfile?.phone || storedProfile?.phone || '',
    birth_date: accountProfile?.birthDate || storedProfile?.birthDate || '',
    address: accountProfile?.addressLine1 || storedProfile?.addressLine1 || '',
    city,
    postal_code: accountProfile?.postalCode || storedProfile?.postalCode || ''
  };
};

const ProfileTab = () => {
  const navigate = useNavigate();
  const { user, userProfile, updateProfile, refreshProfile, deleteAccount } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    pseudo: '',
    email: '',
    phone: '',
    birth_date: '',
    address: '',
    city: '',
    postal_code: ''
  });

  useEffect(() => {
    if (!userProfile) return;

    const nextFormData = buildSyncedProfileSeed(userProfile, user);
    if (nextFormData?.city) {
      setStoredCity(nextFormData.city);
    }

    mergeStoredSharedProfile({
      firstName: nextFormData?.first_name,
      lastName: nextFormData?.last_name,
      pseudonym: nextFormData?.pseudo,
      email: nextFormData?.email,
      phone: nextFormData?.phone,
      birthDate: nextFormData?.birth_date,
      addressLine1: nextFormData?.address,
      postalCode: nextFormData?.postal_code,
      city: nextFormData?.city
    });

    setFormData(nextFormData);
  }, [user, userProfile]);

  const handleInputChange = (event) => {
    const { name, value } = event?.target || {};

    if (name === 'city') {
      setStoredCity(value);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCityChange = (value) => {
    setStoredCity(value);
    setFormData((prev) => ({
      ...prev,
      city: value
    }));
  };

  const handlePostalCodeChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      postal_code: value
    }));
  };

  const handleAvatarUpload = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;

    if (!file?.type?.startsWith('image/')) {
      toast?.error('Veuillez sélectionner une image');
      return;
    }

    if (file?.size > 2 * 1024 * 1024) {
      toast?.error("L'image ne doit pas dépasser 2 Mo");
      return;
    }

    setUploading(true);
    try {
      const { data, error } = await storageService?.uploadAvatar(file, user?.id);
      if (error) throw error;

      const { error: updateError } = await updateProfile({ avatar_url: data?.url });
      if (updateError) throw updateError;

      toast?.success('Photo de profil mise à jour');
      refreshProfile();
    } catch (error) {
      console.error("Erreur de téléversement de l'avatar:", error);
      toast?.error('Erreur lors du téléchargement');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      const { error } = await updateProfile(formData);
      if (error) throw error;

      mergeStoredSharedProfile({
        firstName: formData?.first_name,
        lastName: formData?.last_name,
        pseudonym: formData?.pseudo,
        email: formData?.email,
        phone: formData?.phone,
        birthDate: formData?.birth_date,
        addressLine1: formData?.address,
        postalCode: formData?.postal_code,
        city: formData?.city
      });

      toast?.success('Profil mis à jour avec succès');
      setIsEditing(false);
      refreshProfile();
    } catch (error) {
      console.error('Erreur de mise à jour du profil:', error);
      toast?.error('Erreur lors de la mise à jour');
    }
  };

  const handleCancel = () => {
    setFormData(buildSyncedProfileSeed(userProfile, user));
    setIsEditing(false);
  };

  const handleDeleteAccount = async () => {
    if (deletingAccount) return;

    const confirmed = window.confirm(
      "Supprimer définitivement votre compte ?\n\nCette action est irréversible.\nLa suppression est refusée s'il reste des réservations non terminées."
    );
    if (!confirmed) return;

    setDeletingAccount(true);
    try {
      const { error } = await deleteAccount?.();

      if (error) {
        if (error?.code === 'ACTIVE_RESERVATIONS_EXIST') {
          toast?.error("Impossible de supprimer le compte tant que des réservations ne sont pas terminées.");
        } else {
          toast?.error(error?.message || 'Suppression du compte impossible');
        }
        return;
      }

      toast?.success('Compte supprimé avec succès');
      navigate('/accueil-recherche', { replace: true });
    } catch (error) {
      console.error('Erreur suppression compte:', error);
      toast?.error('Suppression du compte impossible');
    } finally {
      setDeletingAccount(false);
    }
  };

  const profileFirstName = String(
    userProfile?.first_name || userProfile?.prenom || user?.user_metadata?.first_name || user?.user_metadata?.prenom || ''
  ).trim();
  const profileLastName = String(
    userProfile?.last_name || userProfile?.nom || user?.user_metadata?.last_name || user?.user_metadata?.nom || ''
  ).trim();
  const displayFullName = [profileFirstName, profileLastName].filter(Boolean).join(' ');

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="bg-card rounded-xl p-4 md:p-6 lg:p-8 shadow-elevation-2">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-full overflow-hidden bg-muted">
                {userProfile?.avatar_url ? (
                  <Image
                    src={userProfile?.avatar_url}
                    alt={`Avatar de ${userProfile?.pseudo}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon name="User" size={48} className="text-muted-foreground" />
                  </div>
                )}
              </div>
              <label className="absolute bottom-0 right-0 w-8 h-8 md:w-10 md:h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-elevation-2 hover:bg-primary/90 transition-smooth cursor-pointer">
                <Icon name="Camera" size={16} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
              {uploading && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <Icon name="Loader" size={24} className="animate-spin text-white" />
                </div>
              )}
            </div>
            <div>
              <h2 className="text-xl md:text-2xl lg:text-3xl font-semibold text-foreground">
                {displayFullName || userProfile?.pseudo || 'Utilisateur'}
              </h2>
              {displayFullName && userProfile?.pseudo ? (
                <p className="text-sm md:text-base text-muted-foreground">
                  Pseudonyme : {userProfile?.pseudo}
                </p>
              ) : null}
              <p className="text-sm md:text-base text-muted-foreground">
                {userProfile?.email}
              </p>
              <div className="flex items-center gap-2 mt-2">
                {!userProfile?.banned_at ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-success/10 text-success rounded-lg text-xs md:text-sm">
                    <Icon name="CheckCircle" size={14} />
                    Actif
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-error/10 text-error rounded-lg text-xs md:text-sm">
                    <Icon name="AlertCircle" size={14} />
                    Banni
                  </span>
                )}
              </div>
            </div>
          </div>
          {!isEditing ? (
            <Button
              variant="outline"
              iconName="Edit"
              iconPosition="left"
              onClick={() => setIsEditing(true)}
            >
              Modifier le profil
            </Button>
          ) : (
            <div className="flex gap-2 w-full lg:w-auto">
              <Button
                variant="outline"
                onClick={handleCancel}
                className="flex-1 lg:flex-none"
              >
                Annuler
              </Button>
              <Button
                variant="default"
                iconName="Save"
                iconPosition="left"
                onClick={handleSave}
                className="flex-1 lg:flex-none"
              >
                Enregistrer
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <Input
            label="Prenom"
            type="text"
            name="first_name"
            value={formData?.first_name}
            onChange={handleInputChange}
            disabled={!isEditing}
          />
          <Input
            label="Nom"
            type="text"
            name="last_name"
            value={formData?.last_name}
            onChange={handleInputChange}
            disabled={!isEditing}
          />
          <Input
            label="Pseudonyme"
            type="text"
            name="pseudo"
            value={formData?.pseudo}
            onChange={handleInputChange}
            disabled={!isEditing}
            required
            className="md:col-span-2"
          />
          <Input
            label="E-mail"
            type="email"
            name="email"
            value={formData?.email}
            onChange={handleInputChange}
            disabled
            required
          />
          <Input
            label="Telephone"
            type="tel"
            name="phone"
            value={formData?.phone}
            onChange={handleInputChange}
            disabled={!isEditing}
            required
          />
          <Input
            label="Date de naissance"
            type="date"
            name="birth_date"
            value={formData?.birth_date}
            onChange={handleInputChange}
            disabled={!isEditing}
          />
          <Input
            label="Adresse"
            type="text"
            name="address"
            value={formData?.address}
            onChange={handleInputChange}
            disabled={!isEditing}
            className="md:col-span-2"
          />
          <CommuneAutocompleteFields
            className="md:col-span-2"
            fieldsClassName="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-start"
            cityValue={formData?.city}
            postalCodeValue={formData?.postal_code}
            onCityChange={handleCityChange}
            onPostalCodeChange={handlePostalCodeChange}
            cityName="city"
            postalCodeName="postal_code"
            disabled={!isEditing}
          />
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 md:p-6 lg:p-8 shadow-elevation-2 border border-error/20">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-error flex items-center gap-2">
              <Icon name="AlertTriangle" size={18} />
              Zone sensible
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Vous pouvez supprimer votre compte définitivement.
            </p>
            <p className="text-sm text-muted-foreground">
              La suppression est bloquée tant qu&apos;une réservation n&apos;est pas terminée (locataire ou propriétaire).
            </p>
          </div>
          <Button
            variant="danger"
            iconName="Trash2"
            loading={deletingAccount}
            disabled={deletingAccount}
            onClick={handleDeleteAccount}
            className="w-full md:w-auto"
          >
            Supprimer mon compte
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProfileTab;
