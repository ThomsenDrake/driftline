'use client';

import { useEffect, useRef } from 'react';
import type { LatLngExpression } from 'leaflet';
import L, { LatLngBounds } from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';

// Import Leaflet CSS
import 'leaflet/dist/leaflet.css';

// Manual icon fix for Next.js bundlers - more reliable than webpack CSS
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

type Thought = {
  id: string;
  text: string;
  audio_url?: string;
  lat: number;
  lng: number;
  created_at: string;
};

type Props = {
  center: LatLngExpression;
  thoughts?: Thought[];
  onThoughtClick?: (thought: Thought) => void;
  onBoundsChange?: (bounds: LatLngBounds) => void;
  onMapInstanceReady?: (map: L.Map) => void;
};

function MapEventHandler({ 
  onBoundsChange, 
  onMapInstanceReady 
}: { 
  onBoundsChange?: (b: LatLngBounds) => void;
  onMapInstanceReady?: (map: L.Map) => void;
}) {
  const map = useMap();
  
  useEffect(() => {
    // Initialize map when component mounts
    onMapInstanceReady?.(map);
    onBoundsChange?.(map.getBounds());
    
    // Ensure proper sizing if mounted during layout shifts
    requestAnimationFrame(() => map.invalidateSize());
    
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);
    
    // Cleanup
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  
  useMapEvents({
    moveend: () => onBoundsChange?.(map.getBounds()),
    zoomend: () => onBoundsChange?.(map.getBounds()),
  });
  
  return null;
}

function CenterUpdater({ center }: { center: LatLngExpression }) {
  const map = useMap();
  const prev = useRef<string>('');
  useEffect(() => {
    const key = Array.isArray(center) ? center.join(',') : JSON.stringify(center);
    if (prev.current !== key) {
      prev.current = key;
      map.setView(center as LatLngExpression, map.getZoom());
    }
  }, [center, map]);
  return null;
}

export default function MapCanvas({ center, thoughts = [], onThoughtClick, onBoundsChange, onMapInstanceReady }: Props) {
  return (
    <MapContainer
      center={center}
      zoom={13}
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%', minHeight: '500px' }}
    >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          eventHandlers={{
            tileerror: (e) => console.error('Leaflet tile error', e),
            load: () => console.log('Leaflet tiles loaded'),
            tileload: (e) => {
              console.log('Individual tile loaded:', e.tile.src);
              e.tile.style.opacity = '1';
              e.tile.style.visibility = 'visible';
              e.tile.style.display = 'block';
            },
          }}
        />

        <MapEventHandler 
          onBoundsChange={onBoundsChange}
          onMapInstanceReady={onMapInstanceReady}
        />
        <CenterUpdater center={center} />

        {thoughts.map((t) => (
          <Marker key={t.id} position={[t.lat, t.lng]} eventHandlers={{ click: () => onThoughtClick?.(t) }}>
            <Popup>
              <div className="p-2">
                <p className="text-sm text-gray-800 mb-2">{t.text}</p>
                {t.audio_url && (
                  <audio controls className="w-full">
                    <source src={t.audio_url} type="audio/webm" />
                    Your browser does not support the audio element.
                  </audio>
                )}
                <p className="text-xs text-gray-500 mt-2">{new Date(t.created_at).toLocaleString()}</p>
              </div>
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}
