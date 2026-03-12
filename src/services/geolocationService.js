import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

/**
 * Geolocation service with Haversine distance calculation
 */

const EARTH_RADIUS_KM = 6371;

const parseCoordinate = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const isNativeGeolocationAvailable = () => (
  Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Geolocation')
);

/**
 * Convert degrees to radians
 */
const toRadians = (degrees) => {
  return degrees * (Math.PI / 180);
};

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a = (
    Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2))
    * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  );

  const c = 2 * Math.asin(Math.sqrt(a));
  const distance = EARTH_RADIUS_KM * c;

  return distance;
};

/**
 * Get user's current position using browser geolocation API
 */
export const getCurrentPosition = () => {
  return new Promise((resolve, reject) => {
    if (isNativeGeolocationAvailable()) {
      Geolocation.requestPermissions()
        ?.then((permissionStatus) => {
          if (permissionStatus?.location === 'denied' || permissionStatus?.coarseLocation === 'denied') {
            throw new Error('Autorisation de geolocalisation refusee. Veuillez activer la localisation dans les parametres de votre appareil.');
          }

          return Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          });
        })
        ?.then((position) => {
          resolve({
            latitude: position?.coords?.latitude,
            longitude: position?.coords?.longitude,
            accuracy: position?.coords?.accuracy
          });
        })
        ?.catch((error) => {
          reject(new Error(error?.message || 'Erreur de geolocalisation.'));
        });
      return;
    }

    if (!navigator.geolocation) {
      reject(new Error("La geolocalisation n'est pas supportee par votre navigateur"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        let errorMessage = 'Erreur de geolocalisation';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Autorisation de geolocalisation refusee. Veuillez activer la geolocalisation dans les parametres de votre navigateur.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Position non disponible. Veuillez reessayer.';
            break;
          case error.TIMEOUT:
            errorMessage = "Delai d'attente depasse. Veuillez reessayer.";
            break;
          default:
            errorMessage = 'Erreur inconnue lors de la geolocalisation.';
        }

        reject(new Error(errorMessage));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
};

/**
 * Filter annonces by distance from user location
 */
export const filterByDistance = (annonces, userLocation, maxDistanceKm) => {
  if (!userLocation || !annonces) return annonces;

  const userLatitude = parseCoordinate(userLocation?.latitude);
  const userLongitude = parseCoordinate(userLocation?.longitude);
  if (userLatitude === null || userLongitude === null) return annonces;

  return annonces?.map((annonce) => {
    const annonceLatitude = parseCoordinate(annonce?.latitude);
    const annonceLongitude = parseCoordinate(annonce?.longitude);
    if (annonceLatitude !== null && annonceLongitude !== null) {
      const distance = calculateDistance(
        userLatitude,
        userLongitude,
        annonceLatitude,
        annonceLongitude
      );

      return {
        ...annonce,
        distance,
        distanceText: `A ${distance?.toFixed(1)} km de vous`
      };
    }

    return annonce;
  })?.filter((annonce) => {
    if (annonce?.distance !== undefined) {
      return annonce?.distance <= maxDistanceKm;
    }

    return true;
  })?.sort((a, b) => {
    if (a?.distance !== undefined && b?.distance !== undefined) {
      return a?.distance - b?.distance;
    }

    if (a?.distance === undefined) return 1;
    if (b?.distance === undefined) return -1;
    return 0;
  });
};

/**
 * Add distance information to a single annonce
 */
export const addDistanceInfo = (annonce, userLocation) => {
  const userLatitude = parseCoordinate(userLocation?.latitude);
  const userLongitude = parseCoordinate(userLocation?.longitude);
  const annonceLatitude = parseCoordinate(annonce?.latitude);
  const annonceLongitude = parseCoordinate(annonce?.longitude);

  if (userLatitude === null || userLongitude === null || annonceLatitude === null || annonceLongitude === null) {
    return annonce;
  }

  const distance = calculateDistance(
    userLatitude,
    userLongitude,
    annonceLatitude,
    annonceLongitude
  );

  return {
    ...annonce,
    distance,
    distanceText: `A ${distance?.toFixed(1)} km de vous`
  };
};

/**
 * Check if geolocation is available
 */
export const isGeolocationAvailable = () => {
  return isNativeGeolocationAvailable() || ('geolocation' in navigator);
};

/**
 * Watch user position for real-time updates
 */
export const watchPosition = (onSuccess, onError) => {
  if (!navigator.geolocation) {
    onError?.(new Error('Geolocalisation non supportee'));
    return null;
  }

  const watchId = navigator.geolocation?.watchPosition(
    (position) => {
      onSuccess?.({
        latitude: position?.coords?.latitude,
        longitude: position?.coords?.longitude,
        accuracy: position?.coords?.accuracy
      });
    },
    (error) => {
      onError?.(error);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000
    }
  );

  return watchId;
};

/**
 * Stop watching position
 */
export const clearWatch = (watchId) => {
  if (watchId && navigator.geolocation) {
    navigator.geolocation?.clearWatch(watchId);
  }
};

export default {
  calculateDistance,
  getCurrentPosition,
  filterByDistance,
  addDistanceInfo,
  isGeolocationAvailable,
  watchPosition,
  clearWatch
};
