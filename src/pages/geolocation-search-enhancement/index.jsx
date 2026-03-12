import React, { useState, useEffect } from 'react';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import geolocationService from '../../services/geolocationService';
import { supabase } from '../../lib/supabase';
import MapView from './components/MapView';
import EquipmentCard from '../home-search/components/EquipmentCard';
import normaliserAnnonce from '../../utils/annonceNormalizer';
import { getStoredCity, setStoredCity } from '../../utils/cityPrefill';

const GeolocationSearchEnhancement = () => {
  const [userLocation, setUserLocation] = useState(null);
  const [geolocating, setGeolocating] = useState(false);
  const [annonces, setAnnonces] = useState([]);
  const [filteredAnnonces, setFilteredAnnonces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [radiusKm, setRadiusKm] = useState(10);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'map'
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [manualCity, setManualCity] = useState(getStoredCity());

  useEffect(() => {
    loadAnnonces();
  }, []);

  const loadAnnonces = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        ?.from('annonces')
        ?.select('*')
        ?.or('statut.eq.publiee,published.eq.true')
        ?.order('created_at', { ascending: false });

      if (error) throw error;
      const annoncesNormalisees = (data || [])?.map((annonce) => normaliserAnnonce(annonce));
      const annoncesVisibles = (annoncesNormalisees || [])?.filter(
        (annonce) => !Boolean(annonce?.temporarily_disabled ?? annonce?.temporarilyDisabled)
      );
      setAnnonces(annoncesVisibles);
      setFilteredAnnonces(annoncesVisibles);
    } catch (err) {
      console.error('Erreur lors du chargement de annonces:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGetLocation = async () => {
    try {
      setGeolocating(true);
      setPermissionDenied(false);
      
      const position = await geolocationService?.getCurrentPosition();
      setUserLocation(position);
      
      // Filter by distance
      const filtered = geolocationService?.filterByDistance(
        annonces,
        position,
        radiusKm
      );
      
      setFilteredAnnonces(filtered);
      setGeolocating(false);
    } catch (err) {
      console.error('Geolocation error:', err);
      setGeolocating(false);
      
      if (err?.message?.includes('refusée')) {
        setPermissionDenied(true);
      } else {
        alert(err?.message || 'Erreur de géolocalisation');
      }
    }
  };

  const handleRadiusChange = (newRadius) => {
    setRadiusKm(newRadius);
    
    if (userLocation) {
      const filtered = geolocationService?.filterByDistance(
        annonces,
        userLocation,
        newRadius
      );
      setFilteredAnnonces(filtered);
    }
  };

  const handleManualSearch = () => {
    if (!manualCity?.trim()) {
      alert('Veuillez entrer une ville');
      return;
    }
    
    // Filter by city name
    const filtered = annonces?.filter((annonce) =>
      annonce?.ville?.toLowerCase()?.includes(manualCity?.toLowerCase()) ||
      String(annonce?.code_postal || '')?.includes(manualCity)
    );
    
    setFilteredAnnonces(filtered);
  };

  const handleRefreshLocation = () => {
    handleGetLocation();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        {/* En-tête de page */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Recherche par géolocalisation
          </h1>
          <p className="text-muted-foreground">
            Trouvez les équipements disponibles autour de vous
          </p>
        </div>

        {/* Geolocation Controls */}
        <div className="bg-white rounded-lg border border-border p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Location Button */}
            <div>
              <Button
                variant="primary"
                iconName="MapPin"
                onClick={handleGetLocation}
                disabled={geolocating}
                className="w-full"
              >
                {geolocating ? 'Localisation...' : 'Autour de moi'}
              </Button>
              {userLocation && (
                <div className="mt-2 text-xs text-success flex items-center gap-1">
                  <Icon name="CheckCircle" size={12} />
                  Position acquise (précision: {userLocation?.accuracy?.toFixed(0)}m)
                </div>
              )}
            </div>

            {/* Radius Selector */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Rayon de recherche
              </label>
              <Select
                value={radiusKm}
                onChange={(e) => handleRadiusChange(Number(e?.target?.value))}
                disabled={!userLocation}
              >
                <option value={5}>5 km</option>
                <option value={10}>10 km</option>
                <option value={20}>20 km</option>
                <option value={50}>50 km</option>
                <option value={100}>100 km</option>
              </Select>
            </div>

            {/* Bascule de mode d'affichage */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Mode d'affichage
              </label>
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'grid' ? 'primary' : 'outline'}
                  iconName="Grid"
                  onClick={() => setViewMode('grid')}
                  className="flex-1"
                >
                  Grille
                </Button>
                <Button
                  variant={viewMode === 'map' ? 'primary' : 'outline'}
                  iconName="Map"
                  onClick={() => setViewMode('map')}
                  className="flex-1"
                  disabled={!userLocation}
                >
                  Carte
                </Button>
              </div>
            </div>
          </div>

          {/* Permission Denied Fallback */}
          {permissionDenied && (
            <div className="mt-4 p-4 bg-warning/10 border border-warning rounded-lg">
              <div className="flex items-start gap-3">
                <Icon name="AlertTriangle" size={20} className="text-warning flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground mb-2">
                    Autorisation de géolocalisation refusée
                  </p>
                  <p className="text-sm text-muted-foreground mb-3">
                    Vous pouvez rechercher manuellement par ville ou code postal
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="city"
                      placeholder="Ville ou code postal"
                      value={manualCity}
                      onChange={(e) => {
                        const nextCity = e?.target?.value;
                        setManualCity(nextCity);
                        setStoredCity(nextCity);
                      }}
                      autoComplete="address-level2"
                      className="flex-1 px-3 py-2 rounded-md border border-input bg-background text-sm"
                    />
                    <Button
                      variant="primary"
                      iconName="Search"
                      onClick={handleManualSearch}
                    >
                      Rechercher
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Refresh Button */}
          {userLocation && (
            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                iconName="RefreshCw"
                onClick={handleRefreshLocation}
                size="sm"
              >
                Actualiser la position
              </Button>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filteredAnnonces?.length} {filteredAnnonces?.length > 1 ? 'annonces trouvées' : 'annonce trouvée'}
            {userLocation && ` dans un rayon de ${radiusKm} km`}
          </p>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Icon name="Loader" size={32} className="animate-spin text-primary" />
          </div>
        ) : viewMode === 'map' && userLocation ? (
          <MapView
            userLocation={userLocation}
            annonces={filteredAnnonces}
            radiusKm={radiusKm}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAnnonces?.map((annonce) => (
              <EquipmentCard
                key={annonce?.id}
                equipment={annonce}
                userLocation={userLocation}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredAnnonces?.length === 0 && (
          <div className="text-center py-12">
            <Icon name="MapPin" size={48} className="text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Aucune annonce trouvée
            </h3>
            <p className="text-muted-foreground mb-4">
              Essayez d'augmenter le rayon de recherche ou de changer de localisation
            </p>
            <Button variant="primary" iconName="MapPin" onClick={handleGetLocation}>
              Relancer la recherche
            </Button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default GeolocationSearchEnhancement;



