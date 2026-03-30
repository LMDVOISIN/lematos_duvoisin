import React, { useEffect, useMemo, useRef, useState } from 'react';
import { normalizePostalCode, searchFrenchCommunes } from '../../services/communeAutocompleteService';
import { setStoredCity } from '../../utils/cityPrefill';
import { cn } from '../../utils/cn';
import Icon from '../AppIcon';

const normalizeLocationText = (value = '') =>
  String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const CommuneSearchInput = ({
  value = '',
  onChange,
  onSuggestionSelect,
  label,
  name = 'city',
  placeholder = 'Ville ou code postal',
  disabled = false,
  rememberCity = false,
  iconName = 'MapPin',
  autoComplete = 'address-level2',
  className,
  inputClassName,
  labelClassName,
  suggestionsClassName,
  loadingText = 'Recherche des communes...',
  noResultsText = 'Aucune commune trouvee pour cette saisie.',
  emptyQueryText = 'Saisissez au moins 2 caracteres de ville ou de code postal.',
  onKeyDown,
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef(null);
  const blurTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  const normalizedValue = String(value || '').trim();
  const normalizedPostal = normalizePostalCode(value);

  const hasQuery = useMemo(() => {
    return normalizedValue.length >= 2 || normalizedPostal.length >= 2;
  }, [normalizedPostal, normalizedValue]);

  useEffect(() => {
    if (!showSuggestions || disabled) return undefined;

    if (normalizedValue.length < 2 && normalizedPostal.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return undefined;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const controller = new AbortController();
    abortControllerRef.current?.abort();
    abortControllerRef.current = controller;

    searchTimeoutRef.current = setTimeout(async () => {
      setIsLoading(true);

      try {
        const nextSuggestions = await searchFrenchCommunes({
          cityQuery: normalizedPostal.length >= 2 ? '' : normalizedValue,
          postalCodeQuery: normalizedPostal,
          limit: 8,
          signal: controller.signal,
        });

        if (abortControllerRef.current !== controller) return;

        setSuggestions(nextSuggestions);

        const uniqueSuggestion = nextSuggestions.length === 1 ? nextSuggestions[0] : null;
        if (uniqueSuggestion && normalizedPostal.length === 5) {
          const nextValue = uniqueSuggestion.city || normalizedValue;
          onChange?.(nextValue);
          if (rememberCity && uniqueSuggestion.city) {
            setStoredCity(uniqueSuggestion.city);
          }
          onSuggestionSelect?.(uniqueSuggestion);
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (error) {
        if (error?.name !== 'AbortError') {
          console.error('Erreur autocomplete commune simple:', error);
          setSuggestions([]);
        }
      } finally {
        if (abortControllerRef.current === controller) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      controller.abort();
    };
  }, [disabled, hasQuery, normalizedPostal, normalizedValue, onChange, onSuggestionSelect, rememberCity]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleFocus = () => {
    if (disabled) return;
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    setShowSuggestions(true);
  };

  const handleBlur = () => {
    blurTimeoutRef.current = setTimeout(() => {
      setShowSuggestions(false);
    }, 120);
  };

  const handleChange = (nextValue) => {
    onChange?.(nextValue);
    if (rememberCity) {
      setStoredCity(nextValue);
    }
    setShowSuggestions(true);
  };

  const handleSuggestionSelect = (suggestion) => {
    const nextValue = suggestion?.city || value || '';
    onChange?.(nextValue);
    if (rememberCity && suggestion?.city) {
      setStoredCity(suggestion.city);
    }
    onSuggestionSelect?.(suggestion);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const hasExactCityMatch = suggestions.some((suggestion) =>
    normalizeLocationText(suggestion?.city) === normalizeLocationText(normalizedValue)
  );

  return (
    <div className={cn('relative', className)}>
      {label ? (
        <label className={cn('mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600', labelClassName)}>
          {label}
        </label>
      ) : null}

      <div className="relative">
        {iconName ? (
          <Icon
            name={iconName}
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
        ) : null}
        <input
          type="text"
          name={name}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          onChange={(event) => handleChange(event?.target?.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={onKeyDown}
          className={cn(
            'h-12 w-full rounded-xl border border-slate-200 bg-white/90 px-4 text-sm text-slate-800 placeholder:text-slate-400 transition-all duration-200 focus:border-[#17a2b8] focus:outline-none focus:ring-4 focus:ring-[#17a2b8]/15',
            iconName ? 'pl-10' : '',
            inputClassName
          )}
        />
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
          ) : suggestions.length > 0 ? (
            suggestions.map((suggestion) => (
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
          ) : hasQuery && !hasExactCityMatch ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">{noResultsText}</p>
          ) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">{emptyQueryText}</p>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default CommuneSearchInput;
