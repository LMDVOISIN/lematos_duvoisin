import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icon issue with Webpack
delete L?.Icon?.Default?.prototype?._getIconUrl;
L?.Icon?.Default?.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const MapView = ({ userLocation, annonces, radiusKm = 10 }) => {
  if (!userLocation) return null;

  const center = [userLocation?.latitude, userLocation?.longitude];
  const radiusMeters = radiusKm * 1000;

  return (
    <div className="w-full h-[500px] rounded-lg overflow-hidden border border-border">
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* User location marker */}
        <Marker position={center}>
          <Popup>
            <div className="text-center">
              <strong>Votre position</strong>
              <br />
              <span className="text-xs text-muted-foreground">
                Precision: {userLocation?.accuracy?.toFixed(0)}m
              </span>
            </div>
          </Popup>
        </Marker>

        {/* Radius circle */}
        <Circle
          center={center}
          radius={radiusMeters}
          pathOptions={{
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.1,
            weight: 2
          }}
        />

        {/* Equipment markers */}
        {annonces?.map((annonce) => {
          if (!annonce?.latitude || !annonce?.longitude) return null;

          const titre = annonce?.titre || annonce?.title || 'Annonce';
          const prixJour = Number(annonce?.prix_jour ?? annonce?.dailyPrice ?? annonce?.prix ?? 0);

          return (
            <Marker
              key={annonce?.id}
              position={[annonce?.latitude, annonce?.longitude]}
            >
              <Popup>
                <div className="min-w-[200px]">
                  <strong className="block mb-1">{titre}</strong>
                  <p className="text-sm text-muted-foreground mb-2">
                    {prixJour?.toFixed(2)} €/jour
                  </p>
                  {annonce?.distanceText && (
                    <p className="text-xs text-primary font-medium">
                      {annonce?.distanceText}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default MapView;
