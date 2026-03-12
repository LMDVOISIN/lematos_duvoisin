import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import LegalModal from './LegalModal';
import CGUContent from './CGUContent';
import RGPDContent from './RGPDContent';
import { getBestKnownCity, getStoredCity, setStoredCity } from '../../../utils/cityPrefill';
import { clearAuthRedirectPath, resolveAuthRedirectPath } from '../../../utils/authRedirect';

const RegisterForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signUp } = useAuth();
  const [formData, setFormData] = useState(() => ({
    firstName: '',
    lastName: '',
    pseudonym: '',
    email: '',
    streetNumber: '',
    streetName: '',
    postalCode: '',
    city: getStoredCity(),
    password: '',
    confirmPassword: '',
    acceptTerms: false,
    acceptRGPD: false
  }));
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [isAddressLoading, setIsAddressLoading] = useState(false);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [showCGUModal, setShowCGUModal] = useState(false);
  const [showRGPDModal, setShowRGPDModal] = useState(false);
  const addressSearchTimeoutRef = useRef(null);
  const addressAbortControllerRef = useRef(null);

  const redirectAfterAuth = resolveAuthRedirectPath(location, '/accueil-recherche');

  const buildFullAddress = (values) => {
    const streetLine = [
      String(values?.streetNumber || '')?.trim(),
      String(values?.streetName || '')?.trim()
    ]?.filter(Boolean)?.join(' ');
    const cityLine = [
      String(values?.postalCode || '')?.trim(),
      String(values?.city || '')?.trim()
    ]?.filter(Boolean)?.join(' ');

    return [streetLine, cityLine]?.filter(Boolean)?.join(', ');
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e?.target;
    const normalizedValue = type === 'checkbox' ? checked : value;

    setFormData((prev) => ({
      ...prev,
      [name]: normalizedValue
    }));

    if (name === 'city') {
      setStoredCity(normalizedValue);
    }

    if (errors?.[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleStreetNameChange = (e) => {
    const value = e?.target?.value || '';

    setFormData((prev) => ({
      ...prev,
      streetName: value
    }));

    setShowAddressSuggestions(true);

    if (errors?.streetName) {
      setErrors((prev) => ({ ...prev, streetName: '' }));
    }
  };

  const handlePostalCodeChange = (e) => {
    const rawValue = String(e?.target?.value || '');
    const normalizedPostalCode = rawValue?.replace(/\D/g, '')?.slice(0, 5);

    setFormData((prev) => ({
      ...prev,
      postalCode: normalizedPostalCode
    }));

    if (errors?.postalCode) {
      setErrors((prev) => ({ ...prev, postalCode: '' }));
    }
  };

  const buildAddressSuggestion = (result) => {
    const details = result?.address || {};
    const fallbackLine = String(result?.display_name || '')?.split(',')?.[0]?.trim();
    const fallbackMatch = fallbackLine?.match(/^(\d+[A-Za-z0-9\s-]*)\s+(.+)$/);
    const fallbackNumber = fallbackMatch?.[1]?.trim() || '';
    const fallbackStreetName = fallbackMatch?.[2]?.trim() || fallbackLine;
    const streetNumber = details?.house_number || fallbackNumber;
    const streetName =
      details?.road ||
      details?.pedestrian ||
      details?.footway ||
      details?.path ||
      details?.residential ||
      fallbackStreetName ||
      '';
    const city = details?.city || details?.town || details?.village || details?.municipality || details?.county || '';
    const postalCode = details?.postcode || '';
    const firstLine = [streetNumber, streetName]?.filter(Boolean)?.join(' ');
    const secondLine = [postalCode, city]?.filter(Boolean)?.join(' ');
    const label = [firstLine, secondLine]?.filter(Boolean)?.join(', ');

    return {
      id: String(result?.place_id || result?.osm_id || result?.display_name || label),
      label: label || result?.display_name || '',
      streetNumber,
      streetName,
      city,
      postalCode
    };
  };

  const fetchAddressSuggestions = async (streetNameQuery, postalCodeQuery) => {
    const trimmedStreetName = String(streetNameQuery || '')?.trim();
    const trimmedPostalCode = String(postalCodeQuery || '')?.trim();

    if (trimmedStreetName?.length < 2) {
      setAddressSuggestions([]);
      setIsAddressLoading(false);
      return;
    }

    if (addressAbortControllerRef?.current) {
      addressAbortControllerRef?.current?.abort();
    }

    const controller = new AbortController();
    addressAbortControllerRef.current = controller;
    setIsAddressLoading(true);

    try {
      const searchParams = new URLSearchParams({
        format: 'jsonv2',
        addressdetails: '1',
        countrycodes: 'fr',
        dedupe: '1',
        limit: '5',
        q: [trimmedStreetName, trimmedPostalCode, 'France']?.filter(Boolean)?.join(' ')
      });

      const response = await fetch(`https://nominatim.openstreetmap.org/search?${searchParams?.toString()}`, {
        signal: controller?.signal,
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'fr'
        }
      });

      if (!response?.ok) {
        setAddressSuggestions([]);
        return;
      }

      const results = await response?.json();
      const suggestions = Array.isArray(results)
        ? results?.map(buildAddressSuggestion)?.filter((item) => item?.streetName)
        : [];

      setAddressSuggestions(suggestions);
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.error('Erreur autocomplete adresse:', error);
        setAddressSuggestions([]);
      }
    } finally {
      if (addressAbortControllerRef?.current === controller) {
        setIsAddressLoading(false);
      }
    }
  };

  const handleAddressSuggestionSelect = (suggestion) => {
    const cityFromSuggestion = suggestion?.city || '';

    setFormData((prev) => ({
      ...prev,
      streetNumber: suggestion?.streetNumber || prev?.streetNumber || '',
      streetName: suggestion?.streetName || prev?.streetName || '',
      city: cityFromSuggestion,
      postalCode: suggestion?.postalCode || prev?.postalCode || ''
    }));

    setStoredCity(cityFromSuggestion);

    setAddressSuggestions([]);
    setShowAddressSuggestions(false);

    setErrors((prev) => ({
      ...prev,
      streetName: '',
      postalCode: '',
      city: ''
    }));
  };

  useEffect(() => {
    if (!showAddressSuggestions) return;

    if (addressSearchTimeoutRef?.current) {
      clearTimeout(addressSearchTimeoutRef?.current);
    }

    addressSearchTimeoutRef.current = setTimeout(() => {
      fetchAddressSuggestions(formData?.streetName, formData?.postalCode);
    }, 250);

    return () => {
      if (addressSearchTimeoutRef?.current) {
        clearTimeout(addressSearchTimeoutRef?.current);
      }
    };
  }, [formData?.streetName, formData?.postalCode, showAddressSuggestions]);

  useEffect(() => {
    const bestKnownCity = getBestKnownCity(formData?.city, getStoredCity());
    if (bestKnownCity && bestKnownCity !== formData?.city) {
      setFormData((prev) => ({ ...prev, city: bestKnownCity }));
    }
  }, []);

  useEffect(() => {
    return () => {
      if (addressSearchTimeoutRef?.current) {
        clearTimeout(addressSearchTimeoutRef?.current);
      }

      if (addressAbortControllerRef?.current) {
        addressAbortControllerRef?.current?.abort();
      }
    };
  }, []);

  const validateForm = () => {
    const newErrors = {};

    if (!formData?.firstName || formData?.firstName?.trim()?.length < 2) {
      newErrors.firstName = 'Le prénom est requis';
    }

    if (!formData?.lastName || formData?.lastName?.trim()?.length < 2) {
      newErrors.lastName = 'Le nom est requis';
    }

    if (!formData?.pseudonym || formData?.pseudonym?.length < 3) {
      newErrors.pseudonym = 'Le pseudonyme doit contenir au moins 3 caractères';
    }

    if (!formData?.email) {
      newErrors.email = 'L\'adresse e-mail est requise';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/?.test(formData?.email)) {
      newErrors.email = 'Adresse e-mail invalide';
    }

    if (!formData?.streetName || formData?.streetName?.trim()?.length < 2) {
      newErrors.streetName = 'Le nom de voie est requis';
    }

    if (!formData?.postalCode) {
      newErrors.postalCode = 'Le code postal est requis';
    } else if (!/^\d{5}$/?.test(String(formData?.postalCode || '')?.trim())) {
      newErrors.postalCode = 'Le code postal doit contenir 5 chiffres';
    }

    if (!formData?.city || formData?.city?.trim()?.length < 2) {
      newErrors.city = 'La ville est requise';
    }

    if (!formData?.password) {
      newErrors.password = 'Le mot de passe est requis';
    } else if (formData?.password?.length < 8) {
      newErrors.password = 'Le mot de passe doit contenir au moins 8 caractères';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/?.test(formData?.password)) {
      newErrors.password = 'Le mot de passe doit contenir majuscules, minuscules, chiffres et caractères spéciaux';
    }

    if (formData?.password !== formData?.confirmPassword) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }

    if (!formData?.acceptTerms) {
      newErrors.acceptTerms = 'Vous devez accepter les conditions d\'utilisation';
    }

    if (!formData?.acceptRGPD) {
      newErrors.acceptRGPD = 'Vous devez accepter la politique de confidentialité';
    }

    setErrors(newErrors);
    return Object.keys(newErrors)?.length === 0;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      if (typeof signUp !== 'function') {
        toast?.error('Erreur d\'initialisation. Veuillez rafraîchir la page.');
        setLoading(false);
        return;
      }

      const fullAddress = buildFullAddress(formData);

      const { data, error } = await signUp(formData?.email, formData?.password, {
        first_name: String(formData?.firstName || '')?.trim() || null,
        last_name: String(formData?.lastName || '')?.trim() || null,
        prenom: String(formData?.firstName || '')?.trim() || null,
        nom: String(formData?.lastName || '')?.trim() || null,
        pseudo: formData?.pseudonym,
        address: fullAddress,
        postal_address: fullAddress,
        adresse: fullAddress,
        street_number: String(formData?.streetNumber || '')?.trim() || null,
        street_name: String(formData?.streetName || '')?.trim() || null,
        city: formData?.city || null,
        postal_code: String(formData?.postalCode || '')?.trim() || null,
        code_postal: String(formData?.postalCode || '')?.trim() || null,
        accept_terms: formData?.acceptTerms,
        accept_rgpd: formData?.acceptRGPD
      });

      if (error) {
        toast?.error(error?.message || 'Erreur lors de la création du compte');
        setLoading(false);
        return;
      }

      if (!data?.session) {
        setStoredCity(formData?.city);
        toast?.success('Compte créé. Vérifiez votre e-mail pour activer le compte.', {
          duration: 5000,
          position: 'top-center'
        });

        setTimeout(() => {
          navigate('/authentification');
        }, 1500);
      } else {
        setStoredCity(formData?.city);
        toast?.success('Compte créé avec succès ! Bienvenue sur Le Matos du Voisin', {
          duration: 4000,
          position: 'top-center'
        });

        setTimeout(() => {
          clearAuthRedirectPath();
          navigate(redirectAfterAuth);
        }, 1500);
      }
    } catch (err) {
      console.error('Inattendu erreur d\'inscription :', err);
      toast?.error('Une erreur inattendue est survenue');
      setLoading(false);
    }
  };

  const handleLinkClick = (e, modalSetter) => {
    e?.preventDefault();
    e?.stopPropagation();
    modalSetter(true);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Prénom"
            type="text"
            name="firstName"
            placeholder="Ex: Rabii"
            value={formData?.firstName}
            onChange={handleChange}
            error={errors?.firstName}
            required
          />

          <Input
            label="Nom"
            type="text"
            name="lastName"
            placeholder="Ex: Monra"
            value={formData?.lastName}
            onChange={handleChange}
            error={errors?.lastName}
            required
          />
        </div>

        <Input
          label="Pseudonyme"
          type="text"
          name="pseudonym"
          placeholder="MonPseudo123"
          value={formData?.pseudonym}
          onChange={handleChange}
          error={errors?.pseudonym}
          required
        />

        <Input
          label="Adresse e-mail"
          type="email"
          name="email"
          placeholder="votre.courriel@exemple.fr"
          value={formData?.email}
          onChange={handleChange}
          error={errors?.email}
          required
        />

        <Input
          label="Numéro de voie"
          type="text"
          name="streetNumber"
          placeholder="Ex: 12 bis"
          value={formData?.streetNumber}
          onChange={handleChange}
          autoComplete="address-line1"
        />

        <div className="space-y-2 relative">
          <label className={`text-sm font-medium leading-none ${errors?.streetName ? 'text-destructive' : 'text-foreground'}`}>
            Nom de voie
            <span className="text-destructive ml-1">*</span>
          </label>

          <input
            type="text"
            name="streetName"
            placeholder="Ex: rue de la Paix"
            value={formData?.streetName}
            onChange={handleStreetNameChange}
            onFocus={() => setShowAddressSuggestions(true)}
            onBlur={() => {
              setTimeout(() => setShowAddressSuggestions(false), 120);
            }}
            autoComplete="address-line1"
            className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              errors?.streetName ? 'border-destructive focus-visible:ring-destructive' : 'border-input'
            }`}
            required
          />

          {showAddressSuggestions ? (
            <div className="absolute z-30 top-[72px] w-full rounded-md border border-input bg-white shadow-elevation-2 max-h-64 overflow-auto">
              {isAddressLoading ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Recherche en cours...</p>
              ) : addressSuggestions?.length > 0 ? (
                addressSuggestions?.map((suggestion) => (
                  <button
                    key={suggestion?.id}
                    type="button"
                    onMouseDown={(e) => {
                      e?.preventDefault();
                      handleAddressSuggestionSelect(suggestion);
                    }}
                    className="w-full text-left px-3 py-2 border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors"
                  >
                    <p className="text-sm text-foreground line-clamp-2">{suggestion?.label}</p>
                  </button>
                ))
              ) : (formData?.streetName || '')?.trim()?.length >= 2 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  Aucune voie trouvée pour cette saisie.
                </p>
              ) : (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  Tapez au moins 2 caractères du nom de voie.
                </p>
              )}
            </div>
          ) : null}

          {!errors?.streetName ? (
            <p className="text-sm text-muted-foreground">
              L'autocomplétion commence dès les premiers caractères du nom de voie.
            </p>
          ) : (
            <p className="text-sm text-destructive">{errors?.streetName}</p>
          )}
        </div>

        <Input
          label="Code postal"
          type="text"
          name="postalCode"
          placeholder="Ex: 75002"
          value={formData?.postalCode}
          onChange={handlePostalCodeChange}
          error={errors?.postalCode}
          description="Saisissez 5 chiffres."
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          required
        />

        <Input
          label="Ville"
          type="text"
          name="city"
          placeholder="Ex: Neuilly-sur-Seine"
          value={formData?.city}
          onChange={handleChange}
          error={errors?.city}
          autoComplete="address-level2"
          required
        />

        <Input
          label="Mot de passe"
          type="password"
          name="password"
          placeholder="Minimum 8 caractères"
          value={formData?.password}
          onChange={handleChange}
          error={errors?.password}
          description="Doit contenir majuscules, minuscules, chiffres et caractères spéciaux"
          required
        />

        <Input
          label="Confirmer le mot de passe"
          type="password"
          name="confirmPassword"
          placeholder="Retapez votre mot de passe"
          value={formData?.confirmPassword}
          onChange={handleChange}
          error={errors?.confirmPassword}
          required
        />

        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <Checkbox
              name="acceptTerms"
              checked={formData?.acceptTerms}
              onChange={handleChange}
              error={errors?.acceptTerms}
              required
            />
            <label className="text-sm text-muted-foreground">
              J'accepte les{' '}
              <button
                type="button"
                onClick={(e) => handleLinkClick(e, setShowCGUModal)}
                className="text-[#17a2b8] hover:underline font-medium"
              >
                conditions générales d'utilisation
              </button>
              {' '}<span className="text-error">*</span>
            </label>
          </div>
          {errors?.acceptTerms && <p className="text-sm text-error mt-1">{errors?.acceptTerms}</p>}

          <div className="flex items-start gap-2">
            <Checkbox
              name="acceptRGPD"
              checked={formData?.acceptRGPD}
              onChange={handleChange}
              error={errors?.acceptRGPD}
              required
            />
            <label className="text-sm text-muted-foreground">
              J'accepte la{' '}
              <button
                type="button"
                onClick={(e) => handleLinkClick(e, setShowRGPDModal)}
                className="text-[#17a2b8] hover:underline font-medium"
              >
                politique de confidentialité et le traitement de mes données personnelles (RGPD)
              </button>
              {' '}<span className="text-error">*</span>
            </label>
          </div>
          {errors?.acceptRGPD && <p className="text-sm text-error mt-1">{errors?.acceptRGPD}</p>}
        </div>

        <Button
          type="submit"
          variant="default"
          size="lg"
          fullWidth
          loading={loading}
          iconName="UserPlus"
          iconPosition="right"
        >
          Créer mon compte
        </Button>
      </form>

      <LegalModal
        isOpen={showCGUModal}
        onClose={() => setShowCGUModal(false)}
        title="Conditions Générales d'Utilisation (CGU)"
      >
        <CGUContent />
      </LegalModal>

      <LegalModal
        isOpen={showRGPDModal}
        onClose={() => setShowRGPDModal(false)}
        title="Politique de confidentialité et RGPD"
      >
        <RGPDContent />
      </LegalModal>
    </>
  );
};

export default RegisterForm;
