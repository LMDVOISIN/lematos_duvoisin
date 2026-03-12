import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { getStoredCity, setStoredCity } from '../../../utils/cityPrefill';

const SearchBar = ({
  onSearch,
  onAroundMe,
  geolocating,
  defaultSearchType = 'offres',
  categories = []
}) => {
  const [searchType, setSearchType] = useState(defaultSearchType);
  const [searchText, setSearchText] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState(getStoredCity());

  const fieldClassName =
    'h-12 w-full rounded-xl border border-slate-200 bg-white/90 px-4 text-sm text-slate-800 placeholder:text-slate-400 transition-all duration-200 focus:border-[#17a2b8] focus:outline-none focus:ring-4 focus:ring-[#17a2b8]/15';

  const handleSearch = () => {
    onSearch({
      searchType,
      text: searchText,
      category,
      location
    });
  };

  const handleKeyPress = (event) => {
    if (event?.key === 'Enter') {
      handleSearch();
    }
  };

  const isDemandOnlySearch = searchType === 'demandes';
  const isAllSearch = searchType === 'tout';

  const searchLabel = isDemandOnlySearch ? 'Demande' : isAllSearch ? 'Recherche' : 'Objet';
  const searchPlaceholder = isDemandOnlySearch
    ? 'Quelle demande recherchez-vous ?'
    : isAllSearch
      ? 'Objet ou demande'
      : 'Que recherchez-vous ?';

  const categoryOptions = Array.isArray(categories) ? categories : [];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/95 p-4 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.55)] backdrop-blur-xl md:p-5">
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#17a2b8]/80 to-transparent" />

      <div className="mb-4 inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          onClick={() => setSearchType('offres')}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
            searchType === 'offres'
              ? 'bg-gradient-to-r from-[#17a2b8] to-[#1d4ed8] text-white shadow'
              : 'text-slate-600 hover:bg-white'
          }`}
        >
          <Icon name="Package" size={16} />
          Offres
        </button>
        <button
          type="button"
          onClick={() => setSearchType('demandes')}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
            searchType === 'demandes'
              ? 'bg-gradient-to-r from-[#17a2b8] to-[#1d4ed8] text-white shadow'
              : 'text-slate-600 hover:bg-white'
          }`}
        >
          <Icon name="FileSearch" size={16} />
          Demandes
        </button>
        <button
          type="button"
          onClick={() => setSearchType('tout')}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
            searchType === 'tout'
              ? 'bg-gradient-to-r from-[#17a2b8] to-[#1d4ed8] text-white shadow'
              : 'text-slate-600 hover:bg-white'
          }`}
        >
          <Icon name="Layers3" size={16} />
          Tout
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-[1.3fr_0.95fr_1fr_auto_auto]">
        <div>
          <label htmlFor="search-text" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            {searchLabel}
          </label>
          <div className="relative">
            <Icon name="Search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="search-text"
              type="text"
              placeholder={searchPlaceholder}
              value={searchText}
              onChange={(event) => setSearchText(event?.target?.value)}
              onKeyDown={handleKeyPress}
              className={`${fieldClassName} pl-10`}
            />
          </div>
        </div>

        <div>
          <label htmlFor="search-category" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Categorie
          </label>
          <div className="relative">
            <Icon name="LayoutGrid" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              id="search-category"
              value={category}
              onChange={(event) => setCategory(event?.target?.value)}
              className={`${fieldClassName} appearance-none pl-10 pr-10`}
            >
              <option value="">Toutes categories</option>
              {categoryOptions?.map((option) => (
                <option key={option?.value} value={option?.value}>
                  {option?.label}
                </option>
              ))}
            </select>
            <Icon name="ChevronDown" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        <div>
          <label htmlFor="search-location" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Localisation
          </label>
          <div className="relative">
            <Icon name="MapPin" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="search-location"
              type="text"
              name="city"
              placeholder="Ville ou code postal"
              value={location}
              onChange={(event) => {
                const nextLocation = event?.target?.value;
                setLocation(nextLocation);
                setStoredCity(nextLocation);
              }}
              autoComplete="address-level2"
              onKeyDown={handleKeyPress}
              className={`${fieldClassName} pl-10`}
            />
          </div>
        </div>

        <div className="flex items-end">
          <Button
            variant="default"
            className="h-12 w-full rounded-xl border-0 bg-gradient-to-r from-[#17a2b8] to-[#1d4ed8] px-6 text-white shadow-[0_10px_30px_-15px_rgba(29,78,216,0.8)] hover:from-[#148da1] hover:to-[#1e40af]"
            iconName="Search"
            onClick={handleSearch}
          >
            Rechercher
          </Button>
        </div>

        <div className="flex items-end">
          <Button
            variant="outline"
            className="h-12 w-full rounded-xl border-slate-200 bg-white text-slate-700 hover:border-[#17a2b8] hover:bg-[#ecfeff] hover:text-[#0f7081] lg:w-12 lg:px-0"
            onClick={onAroundMe}
            disabled={geolocating || isDemandOnlySearch}
            title={isDemandOnlySearch ? 'Autour de moi disponible pour les offres et tout' : 'Autour de moi'}
            aria-label="Autour de moi"
          >
            {geolocating && !isDemandOnlySearch ? (
              <Icon name="Loader" size={18} className="animate-spin" />
            ) : (
              <Icon name="LocateFixed" size={18} />
            )}
          </Button>
        </div>
      </div>

      {geolocating && !isDemandOnlySearch && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#ecfeff] px-3 py-1 text-xs font-medium text-[#0f7081]">
          <Icon name="Loader" size={14} className="animate-spin" />
          <span>Localisation en cours...</span>
        </div>
      )}
    </div>
  );
};

export default SearchBar;
