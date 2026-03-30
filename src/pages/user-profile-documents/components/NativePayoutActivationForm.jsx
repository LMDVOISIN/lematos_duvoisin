import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '../../../components/AppIcon';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import CommuneAutocompleteFields from '../../../components/ui/CommuneAutocompleteFields';
import { useAuth } from '../../../contexts/AuthContext';
import payoutAccountService from '../../../services/payoutAccountService';
import stripeTokenService from '../../../services/stripeTokenService';
import { setStoredCity } from '../../../utils/cityPrefill';
import {
  buildSharedProfileFromUser,
  getStoredSharedProfile,
  mergeStoredSharedProfile
} from '../../../utils/sharedProfilePrefill';
import { setStoredTestPayoutSimulation } from '../../../utils/testPayoutSimulation';

function normalizeIban(value = '') {
  return String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .trim();
}

function formatIbanDisplay(value = '') {
  return normalizeIban(value).replace(/(.{4})/g, '$1 ').trim();
}

function isLikelyValidIban(value = '') {
  const normalized = normalizeIban(value);
  return /^[A-Z]{2}[0-9A-Z]{13,32}$/.test(normalized);
}

function buildTestModePayoutState({ userId, displayName, email, iban }) {
  const normalizedIban = normalizeIban(iban);
  const last4 = normalizedIban.slice(-4);
  const bankName = 'Compte bancaire de test';

  setStoredTestPayoutSimulation({
    userId,
    displayName,
    email,
    bankName,
    last4
  });

  return {
    ok: true,
    accountId: `test_payout_${String(userId || 'local').slice(0, 12)}`,
    displayName,
    email,
    detailsSubmitted: true,
    bankAccount: {
      bankName,
      last4,
      country: 'FR',
      currency: 'EUR',
      status: 'validated'
    },
    requirementSummary: {
      currentlyDueCount: 0,
      pastDueCount: 0,
      pendingVerificationCount: 0
    },
    status: {
      code: 'connected',
      description: 'Mode test : vos versements sont simules localement sur cet appareil.'
    }
  };
}

function getFriendlyPayoutErrorMessage(error) {
  const message = String(error?.message || '').trim();
  if (!message) {
    return "Impossible d'enregistrer vos versements.";
  }

  if (/test bank account number/i.test(message)) {
    return "Le site est encore en mode test. Utilisez l'IBAN de test propose sur la page.";
  }

  if (/valid phone number/i.test(message)) {
    return "Le numéro de téléphone n'est pas dans un format accepté. Essayez par exemple 06 12 34 56 78.";
  }

  if (/business_type[\s\S]*account token/i.test(message) || /account token[\s\S]*business_type/i.test(message)) {
    return "Les informations de versement ont bien été saisies, mais leur enregistrement a été refusé une première fois par le service de paiement. Rechargez la page puis réessayez.";
  }

  if (/account tokens?/i.test(message)) {
    return "Le mode natif des versements n'est pas encore complètement actif sur cette configuration.";
  }

  return message;
}

const NativePayoutActivationForm = ({
  user,
  userProfile,
  payoutState,
  onSaved
}) => {
  const { updateProfile } = useAuth();
  const requiresIdentityDetails = !Boolean(payoutState?.detailsSubmitted);
  const isStripeTestMode = stripeTokenService?.isTestMode?.() === true;
  const suggestedTestIban = stripeTokenService?.getSuggestedTestIban?.() || '';
  const sharedProfile = useMemo(() => {
    return {
      ...getStoredSharedProfile(),
      ...buildSharedProfileFromUser({ userProfile, user })
    };
  }, [user, userProfile]);

  const initialForm = useMemo(() => ({
    firstName: String(sharedProfile?.firstName || '').trim(),
    lastName: String(sharedProfile?.lastName || '').trim(),
    email: String(sharedProfile?.email || '').trim(),
    phone: String(sharedProfile?.phone || '').trim(),
    birthDate: String(sharedProfile?.birthDate || '').trim(),
    addressLine1: String(sharedProfile?.addressLine1 || '').trim(),
    postalCode: String(sharedProfile?.postalCode || '').trim(),
    city: String(sharedProfile?.city || '').trim(),
    iban: '',
    confirm: false
  }), [sharedProfile]);

  const [formData, setFormData] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFormData(initialForm);
    setErrors({});
  }, [initialForm]);

  const connectedBankLabel = useMemo(() => {
    const bank = payoutState?.bankAccount;
    if (!bank?.last4) return null;
    const parts = [bank?.bankName, `•••• ${bank?.last4}`].filter(Boolean);
    return parts.join(' ');
  }, [payoutState]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors?.[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleCityChange = (value) => {
    setStoredCity(value);
    handleChange('city', value);
  };

  const handlePostalCodeChange = (value) => {
    handleChange('postalCode', value);
  };

  const validate = () => {
    const nextErrors = {};

    if (requiresIdentityDetails) {
      if (!formData?.firstName?.trim()) nextErrors.firstName = 'Le prenom est requis.';
      if (!formData?.lastName?.trim()) nextErrors.lastName = 'Le nom est requis.';
      if (!formData?.phone?.trim()) nextErrors.phone = 'Le telephone est requis.';
      if (!formData?.birthDate?.trim()) nextErrors.birthDate = 'La date de naissance est requise.';
      if (!formData?.addressLine1?.trim()) nextErrors.addressLine1 = "L'adresse est requise.";
      if (!formData?.postalCode?.trim()) nextErrors.postalCode = 'Le code postal est requis.';
      if (!formData?.city?.trim()) nextErrors.city = 'La ville est requise.';
    }

    if (!isLikelyValidIban(formData?.iban)) {
      nextErrors.iban = 'Le RIB/IBAN semble incomplet.';
    }

    if (!formData?.confirm) {
      nextErrors.confirm = 'Vous devez confirmer pour enregistrer vos versements.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors)?.length === 0;
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();
    if (!validate()) return;

    setLoading(true);

    try {
      const sharedProfilePayload = {
        firstName: formData?.firstName,
        lastName: formData?.lastName,
        email: formData?.email,
        phone: formData?.phone,
        birthDate: formData?.birthDate,
        addressLine1: formData?.addressLine1,
        postalCode: formData?.postalCode,
        city: formData?.city
      };

      if (requiresIdentityDetails && typeof updateProfile === 'function') {
        const { error: profileError } = await updateProfile({
          first_name: formData?.firstName,
          last_name: formData?.lastName,
          phone: formData?.phone,
          birth_date: formData?.birthDate,
          address: formData?.addressLine1,
          city: formData?.city,
          postal_code: formData?.postalCode
        });

        if (profileError) {
          throw new Error(profileError?.message || "Impossible d'enregistrer vos informations de profil.");
        }
      }

      mergeStoredSharedProfile(sharedProfilePayload);

      if (isStripeTestMode) {
        const simulatedState = buildTestModePayoutState({
          userId: user?.id,
          displayName: [formData?.firstName, formData?.lastName]
            .filter(Boolean)
            .join(' ')
            .trim() || userProfile?.pseudo || user?.email || 'Utilisateur',
          email: formData?.email,
          iban: formData?.iban
        });

        toast?.success('Mode test : vos versements sont maintenant simules sur cet appareil.');
        setFormData((prev) => ({
          ...prev,
          iban: '',
          confirm: false
        }));
        onSaved?.(simulatedState);
        return;
      }

      const { accountTokenId, bankAccountTokenId } = await stripeTokenService.createPayoutTokens({
        needsIdentity: requiresIdentityDetails,
        profile: {
          firstName: formData?.firstName,
          lastName: formData?.lastName,
          email: formData?.email,
          phone: formData?.phone,
          birthDate: formData?.birthDate,
          addressLine1: formData?.addressLine1,
          postalCode: formData?.postalCode,
          city: formData?.city
        },
        iban: formData?.iban
      });

      const { data, error } = await payoutAccountService.saveNativeDetails({
        accountTokenId,
        bankAccountTokenId,
        profile: {
          firstName: formData?.firstName,
          lastName: formData?.lastName,
          email: formData?.email,
          phone: formData?.phone,
          birthDate: formData?.birthDate,
          addressLine1: formData?.addressLine1,
          postalCode: formData?.postalCode,
          city: formData?.city
        },
        tosAccepted: true
      });

      if (error) {
        throw new Error(error?.message || "Impossible d'enregistrer vos versements.");
      }

      toast?.success(
        data?.status?.code === 'connected'
          ? 'Vos versements sont maintenant actifs.'
          : 'Vos informations ont bien été enregistrées.'
      );
      mergeStoredSharedProfile(sharedProfilePayload);
      setFormData((prev) => ({
        ...prev,
        iban: '',
        confirm: false
      }));
      onSaved?.(data || null);
    } catch (error) {
      toast?.error(getFriendlyPayoutErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-border rounded-xl p-5 bg-surface/50">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-[#17a2b8]/10 flex items-center justify-center flex-shrink-0">
          <Icon name="Wallet" size={18} className="text-[#17a2b8]" />
        </div>
        <div>
          <h4 className="font-semibold text-foreground">
            {requiresIdentityDetails ? 'Recevoir mes virements sur ce compte bancaire' : 'Remplacer mon compte bancaire de versement'}
          </h4>
          <p className="text-sm text-muted-foreground mt-1">
            {requiresIdentityDetails
              ? "Vous saisissez votre RIB ici. Les informations d'identité servent uniquement à préparer vos versements."
              : "Votre identité est déjà connue. Indiquez simplement le nouveau RIB à utiliser pour vos prochains virements."}
          </p>
          {connectedBankLabel && (
            <p className="text-xs text-muted-foreground mt-2">
              Compte bancaire actuel : <span className="font-medium text-foreground">{connectedBankLabel}</span>
            </p>
          )}
        </div>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {requiresIdentityDetails && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Prenom"
                value={formData?.firstName}
                onChange={(event) => handleChange('firstName', event?.target?.value)}
                error={errors?.firstName}
                required
              />
              <Input
                label="Nom"
                value={formData?.lastName}
                onChange={(event) => handleChange('lastName', event?.target?.value)}
                error={errors?.lastName}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Email"
                type="email"
                value={formData?.email}
                onChange={(event) => handleChange('email', event?.target?.value)}
                description="Utilise pour le suivi de vos versements."
                disabled
              />
              <Input
                label="Telephone"
                type="tel"
                value={formData?.phone}
                onChange={(event) => handleChange('phone', event?.target?.value)}
                error={errors?.phone}
                required
              />
            </div>

            <Input
              label="Date de naissance"
              type="date"
              value={formData?.birthDate}
              onChange={(event) => handleChange('birthDate', event?.target?.value)}
              error={errors?.birthDate}
              required
            />

            <Input
              label="Adresse"
              value={formData?.addressLine1}
              onChange={(event) => handleChange('addressLine1', event?.target?.value)}
              error={errors?.addressLine1}
              required
            />

            <CommuneAutocompleteFields
              cityValue={formData?.city}
              postalCodeValue={formData?.postalCode}
              onCityChange={handleCityChange}
              onPostalCodeChange={handlePostalCodeChange}
              cityError={errors?.city}
              postalCodeError={errors?.postalCode}
              cityName="city"
              postalCodeName="postalCode"
              cityRequired
              postalCodeRequired
              rememberCity
            />
          </>
        )}

        <Input
          label="RIB / IBAN"
          value={formatIbanDisplay(formData?.iban)}
          onChange={(event) => handleChange('iban', event?.target?.value)}
          error={errors?.iban}
          placeholder="FR76 3000 6000 0112 3456 7890 189"
          description="Le compte sur lequel la plateforme vous versera votre argent."
          required
        />

        {isStripeTestMode && (
          <div className="rounded-lg border border-warning/20 bg-warning/10 p-4 text-sm">
            <div className="flex gap-3">
              <Icon name="Info" size={18} className="text-warning flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="font-medium text-foreground">Mode test actif</p>
                <p className="text-muted-foreground">
                  Le site utilise encore un environnement de test. Pour essayer ce formulaire, il faut saisir un IBAN de test et non un vrai RIB.
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="font-medium text-foreground">{formatIbanDisplay(suggestedTestIban)}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleChange('iban', suggestedTestIban)}
                  >
                    Utiliser cet IBAN de test
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <Checkbox
          checked={Boolean(formData?.confirm)}
          onChange={(event) => handleChange('confirm', Boolean(event?.target?.checked))}
          label={
            requiresIdentityDetails
              ? "Je confirme que ces informations sont exactes pour recevoir mes virements."
              : "Je confirme remplacer le compte bancaire utilisé pour mes versements."
          }
          description="Vos coordonnées servent uniquement à préparer vos versements."
          error={errors?.confirm}
        />

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            type="submit"
            size="lg"
            loading={loading}
            iconName="Wallet"
            className="bg-[#17a2b8] hover:bg-[#0f6070]"
          >
            {requiresIdentityDetails ? 'Enregistrer mes versements' : 'Enregistrer mon nouveau RIB'}
          </Button>
          <div className="text-xs text-muted-foreground self-center">
            Aucune page externe ne s'ouvre. Tout est enregistre depuis cet ecran.
          </div>
        </div>
      </form>
    </div>
  );
};

export default NativePayoutActivationForm;
