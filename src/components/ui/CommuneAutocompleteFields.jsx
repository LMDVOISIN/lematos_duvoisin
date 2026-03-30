import React, { useEffect, useMemo, useRef, useState } from 'react';
import { normalizePostalCode, searchFrenchCommunes } from '../../services/communeAutocompleteService';
import { setStoredCity } from '../../utils/cityPrefill';
import { cn } from '../../utils/cn';
import Input from './Input';

const normalizeLocationText = (value = '') =>
  String(value || '')
    ?.trim()
    ?.normalize('NFD')
    ?.replace(/[\u0300-\u036f]/g, '')
    ?.toLowerCase();

const CommuneAutocompleteFields = ({
  cityValue = '',
  postalCodeValue = '',
  onCityChange,
  onPostalCodeChange,
  cityLabel = 'Ville',
  postalCodeLabel = 'Code postal',
  cityName = 'city',
  postalCodeName = 'postalCode',
  cityPlaceholder = 'Ex: Paris',
  postalCodePlaceholder = 'Ex: 75002',
  cityError,
  postalCodeError,
  cityRequired = false,
  postalCodeRequired = false,
  cityDescription,
  postalCodeDescription,
  disabled = false,
  rememberCity = false,
  className,
  fieldsClassName,
  suggestionsClassName,
  loadingText = 'Recherche des communes...',
  noResultsText = 'Aucune commune trouvee pour cette saisie.',
  emptyQueryText = 'Saisissez au moins 2 caracteres de ville ou de code postal.',
  children
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeField, setActiveField] = useState(null);
  const searchTimeoutRef = useRef(null);
  const blurTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  const hasLocationQuery = useMemo(() => {
    const cityQuery = String(cityValue || '')?.trim();
    const postalCodeQuery = normalizePostalCode(postalCodeValue);
    return cityQuery?.length >= 2 || postalCodeQuery?.length >= 2;
  }, [cityValue, postalCodeValue]);

  useEffect(() => {
    if (disabled) {
      setShowSuggestions(false);
      setSuggestions([]);
      setActiveField(null);
    }
  }, [disabled]);

  useEffect(() => {
    if (!showSuggestions || disabled) return undefined;

    const cityQuery = String(cityValue || '')?.trim();
    const postalCodeQuery = normalizePostalCode(postalCodeValue);

    if (cityQuery?.length < 2 && postalCodeQuery?.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return undefined;
    }

    if (searchTimeoutRef?.current) {
      clearTimeout(searchTimeoutRef?.current);
    }

    const controller = new AbortController();
    abortControllerRef.current?.abort();
    abortControllerRef.current = controller;

    searchTimeoutRef.current = setTimeout(async () => {
      setIsLoading(true);

      try {
        const nextSuggestions = await searchFrenchCommunes({
          cityQuery,
          postalCodeQuery,
          limit: 8,
          signal: controller?.signal
        });

        if (abortControllerRef?.current !== controller) return;

        setSuggestions(nextSuggestions);

        const uniqueSuggestion = nextSuggestions?.length === 1 ? nextSuggestions?.[0] : null;
        const shouldAutofillFromPostalCode = Boolean(
          uniqueSuggestion
          && activeField === 'postalCode'
          && postalCodeQuery?.length === 5
        );
        const shouldAutofillFromCity = Boolean(
          uniqueSuggestion
          && activeField === 'city'
          && normalizeLocationText(uniqueSuggestion?.city) === normalizeLocationText(cityQuery)
        );

        if (uniqueSuggestion && (shouldAutofillFromPostalCode || shouldAutofillFromCity)) {
          const nextCity = uniqueSuggestion?.city || cityValue || '';
          const nextPostalCode = normalizePostalCode(uniqueSuggestion?.postalCode) || postalCodeQuery || '';

          onCityChange?.(nextCity);
          onPostalCodeChange?.(nextPostalCode);

          if (rememberCity && nextCity) {
            setStoredCity(nextCity);
          }

          setShowSuggestions(false);
          setSuggestions([]);
          setActiveField(null);
        }
      } catch (error) {
        if (error?.name !== 'AbortError') {
          console.error('Erreur autocomplete commune:', error);
          setSuggestions([]);
        }
      } finally {
        if (abortControllerRef?.current === controller) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      if (searchTimeoutRef?.current) {
        clearTimeout(searchTimeoutRef?.current);
      }
      controller?.abort();
    };
  }, [
    activeField,
    cityValue,
    disabled,
    onCityChange,
    onPostalCodeChange,
    postalCodeValue,
    rememberCity,
    showSuggestions
  ]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef?.current) {
        clearTimeout(searchTimeoutRef?.current);
      }

      if (blurTimeoutRef?.current) {
        clearTimeout(blurTimeoutRef?.current);
      }

      if (abortControllerRef?.current) {
        abortControllerRef?.current?.abort();
      }
    };
  }, []);

  const handleCityValueChange = (value) => {
    onCityChange?.(value);

    if (rememberCity) {
      setStoredCity(value);
    }

    setActiveField('city');
    setShowSuggestions(true);
  };

  const handlePostalCodeValueChange = (value) => {
    onPostalCodeChange?.(normalizePostalCode(value));
    setActiveField('postalCode');
    setShowSuggestions(true);
  };

  const handleFocus = (field) => {
    if (disabled) return;

    if (blurTimeoutRef?.current) {
      clearTimeout(blurTimeoutRef?.current);
    }

    setActiveField(field);
    setShowSuggestions(true);
  };

  const handleBlur = () => {
    blurTimeoutRef.current = setTimeout(() => {
      setShowSuggestions(false);
      setActiveField(null);
    }, 120);
  };

  const handleSuggestionSelect = (suggestion) => {
    const nextCity = suggestion?.city || '';
    const nextPostalCode = normalizePostalCode(suggestion?.postalCode);

    onCityChange?.(nextCity);
    onPostalCodeChange?.(nextPostalCode);

    if (rememberCity && nextCity) {
      setStoredCity(nextCity);
    }

    setSuggestions([]);
    setShowSuggestions(false);
    setActiveField(null);
  };

  return (
    <div className={cn('relative', className)}>
      <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-4 items-start', fieldsClassName)}>
        <Input
          label={postalCodeLabel}
          type="text"
          name={postalCodeName}
          placeholder={postalCodePlaceholder}
          value={postalCodeValue}
          onChange={(event) => handlePostalCodeValueChange(event?.target?.value)}
          onFocus={() => handleFocus('postalCode')}
          onBlur={handleBlur}
          error={postalCodeError}
          description={postalCodeDescription}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          disabled={disabled}
          required={postalCodeRequired}
        />

        <Input
          label={cityLabel}
          type="text"
          name={cityName}
          placeholder={cityPlaceholder}
          value={cityValue}
          onChange={(event) => handleCityValueChange(event?.target?.value)}
          onFocus={() => handleFocus('city')}
          onBlur={handleBlur}
          error={cityError}
          description={cityDescription}
          autoComplete="address-level2"
          disabled={disabled}
          required={cityRequired}
        />

        {children}
      </div>

      {showSuggestions ? (
        <div
          className={cn(
            'absolute z-30 top-full left-0 right-0 mt-2 rounded-md border border-input bg-white shadow-elevation-2 max-h-64 overflow-auto',
            suggestionsClassName
          )}
        >
          {isLoading ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">{loadingText}</p>
          ) : suggestions?.length > 0 ? (
            suggestions?.map((suggestion) => (
              <button
                key={suggestion?.id}
                type="button"
                onMouseDown={(event) => {
                  event?.preventDefault();
                  handleSuggestionSelect(suggestion);
                }}
                className="w-full text-left px-3 py-2 border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors"
              >
                <p className="text-sm text-foreground">{suggestion?.label}</p>
              </button>
            ))
          ) : hasLocationQuery ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">{noResultsText}</p>
          ) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">{emptyQueryText}</p>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default CommuneAutocompleteFields;
