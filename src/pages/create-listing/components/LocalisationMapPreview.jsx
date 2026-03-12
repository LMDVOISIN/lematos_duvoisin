import React, { useEffect, useMemo, useState } from 'react';
import { Circle, MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Icon from '../../../components/AppIcon';

delete L?.Icon?.Default?.prototype?._getIconUrl;
L?.Icon?.Default?.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

const DEFAULT_FRANCE_COORDINATES = [46.603354, 1.888334];

const parseCoordinate = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const hasValidCoordinates = (latitude, longitude) => {
  const lat = parseCoordinate(latitude);
  const lng = parseCoordinate(longitude);

  if (lat === null || lng === null) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

const geocodeAddress = async (query) => {
  if (!query?.trim()) return null;

  try {
    const searchParams = new URLSearchParams({
      format: 'jsonv2',
      limit: '1',
      countrycodes: 'fr',
      q: query
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${searchParams?.toString()}`, {
      headers: { Accept: 'application/json' }
    });

    if (!response?.ok) return null;

    const payload = await response?.json();
    const firstMatch = Array.isArray(payload) ? payload?.[0] : null;
    const lat = parseCoordinate(firstMatch?.lat);
    const lng = parseCoordinate(firstMatch?.lon);

    if (lat === null || lng === null) return null;
    return [lat, lng];
  } catch (error) {
    console.error('Erreur geocodage adresse annonce:', error);
    return null;
  }
};

const LocalisationMapPreview = ({
  address,
  postalCode,
  city,
  latitude,
  longitude,
  onCoordinatesChange
}) => {
  const explicitCoordinates = useMemo(() => {
    if (!hasValidCoordinates(latitude, longitude)) return null;
    return [Number(latitude), Number(longitude)];
  }, [latitude, longitude]);

  const geocodeQuery = useMemo(() => {
    const parts = [address, postalCode, city]
      ?.map((value) => String(value || '')?.trim())
      ?.filter(Boolean);

    return [...new Set(parts)]?.join(', ');
  }, [address, postalCode, city]);

  const [coordinates, setCoordinates] = useState(explicitCoordinates || DEFAULT_FRANCE_COORDINATES);
  const [hasPreciseTarget, setHasPreciseTarget] = useState(Boolean(explicitCoordinates));
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let timeoutId = null;

    const resolveCoordinates = async () => {
      if (explicitCoordinates) {
        setCoordinates(explicitCoordinates);
        setHasPreciseTarget(true);
        setResolveError('');
        setIsResolving(false);
        return;
      }

      if (!geocodeQuery) {
        setCoordinates(DEFAULT_FRANCE_COORDINATES);
        setHasPreciseTarget(false);
        setResolveError('');
        setIsResolving(false);
        onCoordinatesChange?.(null);
        return;
      }

      setIsResolving(true);
      setResolveError('');

      timeoutId = setTimeout(async () => {
        const geocodedCoordinates = await geocodeAddress(geocodeQuery);
        if (cancelled) return;

        if (geocodedCoordinates) {
          setCoordinates(geocodedCoordinates);
          setHasPreciseTarget(true);
          setResolveError('');
          onCoordinatesChange?.(geocodedCoordinates);
        } else {
          setCoordinates(DEFAULT_FRANCE_COORDINATES);
          setHasPreciseTarget(false);
          setResolveError('Impossible de localiser cette adresse automatiquement pour le moment.');
          onCoordinatesChange?.(null);
        }

        setIsResolving(false);
      }, 350);
    };

    resolveCoordinates();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [explicitCoordinates, geocodeQuery]);

  const mapKey = `${coordinates?.[0]}-${coordinates?.[1]}-${hasPreciseTarget ? 'target' : 'default'}`;

  return (
    <div className="bg-surface rounded-lg border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="MapPin" size={18} className="text-[#17a2b8]" />
        <p className="text-sm font-medium text-foreground">Aperçu de la carte</p>
      </div>

      <div
        className="rounded-lg overflow-hidden border border-border bg-white"
        style={{ height: 'clamp(170px, 24vh, 280px)' }}
      >
        <MapContainer
          key={mapKey}
          center={coordinates}
          zoom={hasPreciseTarget ? 13 : 5}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {hasPreciseTarget ? (
            <>
              <Circle
                center={coordinates}
                radius={500}
                pathOptions={{
                  color: '#17a2b8',
                  fillColor: '#17a2b8',
                  fillOpacity: 0.18,
                  weight: 2
                }}
              />
              <Marker position={coordinates} />
            </>
          ) : null}
        </MapContainer>
      </div>

      <div className="mt-3 space-y-1">
        {isResolving ? (
          <p className="text-xs text-muted-foreground">Recherche de la position...</p>
        ) : null}

        {!isResolving && resolveError ? (
          <p className="text-xs text-amber-700">{resolveError}</p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          La carte affiche une zone approximative pour protéger votre adresse exacte.
        </p>
      </div>
    </div>
  );
};

export default LocalisationMapPreview;
