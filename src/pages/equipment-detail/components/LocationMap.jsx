import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import Icon from '../../../components/AppIcon';
import L from 'leaflet';

// Fix for default marker icon in React-Leaflet
delete L?.Icon?.Default?.prototype?._getIconUrl;
L?.Icon?.Default?.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DEFAULT_FRANCE_COORDINATES = [46.603354, 1.888334];
const TILE_PROVIDERS = [
  {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; CARTO',
    subdomains: 'abcd',
  },
];

const parseCoordinate = (value) => {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const numericValue = Number(raw.replace(',', '.'));
  return Number.isFinite(numericValue) ? numericValue : null;
};

const hasValidCoordinates = (latitude, longitude) => {
  const lat = parseCoordinate(latitude);
  const lng = parseCoordinate(longitude);

  if (lat === null || lng === null) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

const geocodeLocation = async (query) => {
  if (!query?.trim()) return null;

  try {
    const searchParams = new URLSearchParams({
      format: 'jsonv2',
      limit: '1',
      countrycodes: 'fr',
      q: query,
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${searchParams?.toString()}`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response?.ok) {
      return null;
    }

    const results = await response?.json();
    const firstMatch = Array.isArray(results) ? results?.[0] : null;
    const lat = parseCoordinate(firstMatch?.lat);
    const lng = parseCoordinate(firstMatch?.lon);

    if (lat === null || lng === null) {
      return null;
    }

    return [lat, lng];
  } catch (error) {
    console.error('Erreur géocodage localisation:', error);
    return null;
  }
};

const LocationMap = ({ location, address, latitude, longitude }) => {
  const locationLabel = location || 'Localisation non spécifiée';
  const locationQuery = useMemo(
    () => [address, location]?.filter(Boolean)?.join(', ')?.trim(),
    [address, location]
  );

  const explicitCoordinates = useMemo(() => {
    if (!hasValidCoordinates(latitude, longitude)) {
      return null;
    }

    return [Number(latitude), Number(longitude)];
  }, [latitude, longitude]);

  const [coordinates, setCoordinates] = useState(explicitCoordinates || DEFAULT_FRANCE_COORDINATES);
  const [isResolvingCoordinates, setIsResolvingCoordinates] = useState(!explicitCoordinates);
  const [tileProviderIndex, setTileProviderIndex] = useState(0);
  const [tileStatus, setTileStatus] = useState('idle');
  const tileErrorCooldownRef = useRef(false);

  useEffect(() => {
    let isCancelled = false;

    const resolveCoordinates = async () => {
      if (explicitCoordinates) {
        setCoordinates(explicitCoordinates);
        setIsResolvingCoordinates(false);
        return;
      }

      if (!locationQuery) {
        setCoordinates(DEFAULT_FRANCE_COORDINATES);
        setIsResolvingCoordinates(false);
        return;
      }

      setIsResolvingCoordinates(true);
      const geocodedCoordinates = await geocodeLocation(locationQuery);

      if (!isCancelled) {
        setCoordinates(geocodedCoordinates || DEFAULT_FRANCE_COORDINATES);
        setIsResolvingCoordinates(false);
      }
    };

    resolveCoordinates();

    return () => {
      isCancelled = true;
    };
  }, [explicitCoordinates, locationQuery]);

  const mapKey = `${coordinates?.[0]}-${coordinates?.[1]}`;
  const activeTileProvider = TILE_PROVIDERS?.[tileProviderIndex] || TILE_PROVIDERS?.[0];

  useEffect(() => {
    setTileProviderIndex(0);
    setTileStatus('idle');
    tileErrorCooldownRef.current = false;
  }, [mapKey]);

  const handleTileError = () => {
    if (tileErrorCooldownRef.current) return;

    tileErrorCooldownRef.current = true;
    const hasFallbackProvider = tileProviderIndex < TILE_PROVIDERS.length - 1;

    if (hasFallbackProvider) {
      setTileProviderIndex(tileProviderIndex + 1);
      setTileStatus('fallback');
    } else {
      setTileStatus('unavailable');
    }

    setTimeout(() => {
      tileErrorCooldownRef.current = false;
    }, 1000);
  };

  const handleTileLoad = () => {
    setTileStatus('loaded');
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="MapPin" size={24} className="text-[#17a2b8]" />
        <h2 className="text-xl font-semibold text-foreground">Plan de localisation</h2>
      </div>

      <div className="mb-4">
        <div className="flex items-start gap-2 text-muted-foreground">
          <Icon name="MapPin" size={16} className="mt-1 flex-shrink-0" />
          <div>
            <p className="text-foreground font-medium">{locationLabel}</p>
            <p className="text-sm text-muted-foreground mt-1">
              La localisation exacte sera communiquée après la réservation
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg overflow-hidden border border-border" style={{ height: '400px' }}>
        <MapContainer
          key={mapKey}
          center={coordinates}
          zoom={13}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution={activeTileProvider?.attribution}
            url={activeTileProvider?.url}
            {...(activeTileProvider?.subdomains ? { subdomains: activeTileProvider?.subdomains } : {})}
            eventHandlers={{
              tileerror: handleTileError,
              tileload: handleTileLoad,
            }}
          />

          {/* Circle to show approximate area for privacy */}
          <Circle
            center={coordinates}
            radius={500}
            pathOptions={{
              color: '#17a2b8',
              fillColor: '#17a2b8',
              fillOpacity: 0.2,
              weight: 2,
            }}
          />

          {/* Marker for approximate location */}
          <Marker position={coordinates}>
            <Popup>
              <div className="text-center">
                <p className="font-semibold text-foreground">{locationLabel}</p>
                <p className="text-xs text-muted-foreground mt-1">Zone approximative</p>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      {isResolvingCoordinates ? (
        <p className="mt-3 text-xs text-muted-foreground">Mise à jour de la position en cours...</p>
      ) : null}

      {tileStatus === 'fallback' ? (
        <p className="mt-3 text-xs text-amber-700">
          Le fond de carte principal est indisponible. Affichage via une source de secours.
        </p>
      ) : null}

      {tileStatus === 'unavailable' ? (
        <p className="mt-3 text-xs text-amber-700">
          Le fond de carte ne peut pas être chargé (réseau, extension navigateur ou blocage du fournisseur).
          Le point affiché reste une zone approximative.
        </p>
      ) : null}

      <div className="mt-4 flex items-start gap-2 p-3 bg-blue-50 rounded-md">
        <Icon name="Info" size={16} className="text-[#17a2b8] mt-0.5 flex-shrink-0" />
        <p className="text-sm text-foreground">
          Pour des raisons de confidentialité, seule une zone approximative est affichée.
          L'adresse exacte vous sera communiquée après confirmation de la réservation.
        </p>
      </div>
    </div>
  );
};

export default LocationMap;

