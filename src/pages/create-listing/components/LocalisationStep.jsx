import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Input from '../../../components/ui/Input';
import Icon from '../../../components/AppIcon';
import { Checkbox } from '../../../components/ui/Checkbox';
import { useAuth } from '../../../contexts/AuthContext';
import LocalisationMapPreview from './LocalisationMapPreview';

const LocalisationStep = ({ formData, updateFormData, errors }) => {
  const { userProfile } = useAuth();

  const adresseProfilSimple = (userProfile?.address || '')?.trim();
  const villeProfil = (userProfile?.city || '')?.trim();
  const codePostalProfil = (userProfile?.postal_code || '')?.trim();
  const adresseProfilComplete = [
    adresseProfilSimple,
    [codePostalProfil, villeProfil]?.filter(Boolean)?.join(' ')
  ]?.filter(Boolean)?.join(', ');

  const profilAdresseDisponible = Boolean(adresseProfilSimple);
  const sourceAdresse = formData?.addressSource || (profilAdresseDisponible ? 'profile' : 'custom');

  const normaliserAdresse = (value = '') => String(value)?.trim()?.toLowerCase()?.replace(/\s+/g, ' ');
  const adresseActiveProfil = normaliserAdresse(adresseProfilComplete || adresseProfilSimple);

  const appliquerAdresseProfil = () => {
    if (!profilAdresseDisponible) return;

    const adresseCible = adresseProfilComplete || adresseProfilSimple;
    if (formData?.address !== adresseCible) {
      updateFormData('address', adresseCible);
    }

    if (villeProfil && formData?.city !== villeProfil) {
      updateFormData('city', villeProfil);
    }

    if (codePostalProfil && formData?.postalCode !== codePostalProfil) {
      updateFormData('postalCode', codePostalProfil);
    }
  };

  const basculerSourceAdresse = (nouvelleSource) => {
    if (nouvelleSource === 'profile') {
      updateFormData('addressSource', 'profile');
      appliquerAdresseProfil();
      return;
    }

    updateFormData('addressSource', 'custom');
    const adresseActuelle = normaliserAdresse(formData?.address);
    if (adresseActuelle && adresseActuelle === adresseActiveProfil) {
      updateFormData('address', '');
    }
  };

  useEffect(() => {
    if (!profilAdresseDisponible && sourceAdresse === 'profile') {
      updateFormData('addressSource', 'custom');
      return;
    }

    if (sourceAdresse === 'profile') {
      appliquerAdresseProfil();
    }
  }, [profilAdresseDisponible, sourceAdresse]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Localisation</h2>
        <p className="text-sm text-muted-foreground">Indiquez où se trouve votre matériel</p>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <Checkbox
          label="Utiliser l'adresse de mon profil"
          description={
            profilAdresseDisponible
              ? (adresseProfilComplete || adresseProfilSimple)
              : "Aucune adresse enregistrée dans votre profil"
          }
          checked={sourceAdresse === 'profile'}
          disabled={!profilAdresseDisponible}
          onChange={(e) => {
            if (e?.target?.checked) {
              basculerSourceAdresse('profile');
            } else {
              basculerSourceAdresse('custom');
            }
          }}
        />
        <Checkbox
          label="Utiliser une autre adresse pour cette annonce"
          checked={sourceAdresse === 'custom'}
          onChange={(e) => {
            if (e?.target?.checked) {
              basculerSourceAdresse('custom');
            } else if (profilAdresseDisponible) {
              basculerSourceAdresse('profile');
            }
          }}
        />
        <div className="pt-1">
          <Link
            to="/profil-documents-utilisateur"
            className="text-sm text-[#17a2b8] hover:text-[#138496] underline underline-offset-2"
          >
            Modifier mon adresse de profil
          </Link>
        </div>
      </div>

      <Input
        label="Adresse"
        placeholder="123 Rue de la République, 75001 Paris"
        value={formData?.address}
        onChange={(e) => updateFormData('address', e?.target?.value)}
        error={errors?.address}
        description={
          sourceAdresse === 'profile'
            ? "Adresse reprise depuis votre profil"
            : "L'adresse exacte ne sera partagée qu'après confirmation de la réservation"
        }
        disabled={sourceAdresse === 'profile'}
        required
      />

      {/* Emplacement de la carte */}
      <LocalisationMapPreview
        address={formData?.address}
        postalCode={formData?.postalCode}
        city={formData?.city}
        latitude={formData?.latitude}
        longitude={formData?.longitude}
        onCoordinatesChange={(nextCoordinates) => {
          if (!nextCoordinates) {
            if (formData?.latitude !== '' && formData?.latitude !== undefined) {
              updateFormData('latitude', '');
            }
            if (formData?.longitude !== '' && formData?.longitude !== undefined) {
              updateFormData('longitude', '');
            }
            return;
          }

          const [nextLatitude, nextLongitude] = nextCoordinates;
          if (String(formData?.latitude ?? '') !== String(nextLatitude)) {
            updateFormData('latitude', nextLatitude);
          }
          if (String(formData?.longitude ?? '') !== String(nextLongitude)) {
            updateFormData('longitude', nextLongitude);
          }
        }}
      />

      {/* Informations de confidentialite */}
      <div className="bg-[#17a2b8]/10 border border-[#17a2b8]/20 rounded-lg p-4">
        <div className="flex gap-2">
          <Icon name="Shield" size={18} className="text-[#17a2b8] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground mb-2">Protection de votre vie privée</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Seule une zone approximative est affichée publiquement</li>
              <li>• L'adresse exacte est partagée uniquement après réservation</li>
              <li>• Vous pouvez proposer un point de rencontre alternatif</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocalisationStep;
