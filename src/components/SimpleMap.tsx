'use client';

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Create a custom icon with fixed anchoring to prevent jumping
const customIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Sample thought data for testing
const sampleThoughts = [
  {
    id: '1',
    text: 'Beautiful day in the city!',
    lat: 40.7580,
    lng: -73.9855,
    created_at: new Date().toISOString()
  },
  {
    id: '2', 
    text: 'Great coffee spot here',
    lat: 40.7505,
    lng: -73.9934,
    created_at: new Date().toISOString()
  }
];

export default function SimpleMap() {
  const [center, setCenter] = useState<[number, number]>([40.7128, -74.0060]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCenter([position.coords.latitude, position.coords.longitude]);
          setIsLoading(false);
        },
        (error) => {
          console.warn('Geolocation failed:', error);
          setIsLoading(false);
        }
      );
    } else {
      setIsLoading(false);
    }
  }, []);

  if (isLoading) {
    return (
      <div style={{ 
        height: '100vh', 
        width: '100vw', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f0f0f0'
      }}>
        <div>Getting your location...</div>
      </div>
    );
  }

  return (
    <MapContainer 
      center={center} 
      zoom={13} 
      style={{ height: '100vh', width: '100vw' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      
      {/* User location marker */}
      <Marker position={center} icon={customIcon}>
        <Popup>
          <div>
            <strong>Your Location</strong>
            <br />
            Lat: {center[0].toFixed(4)}, Lng: {center[1].toFixed(4)}
          </div>
        </Popup>
      </Marker>

      {/* Thought markers */}
      {sampleThoughts.map((thought) => (
        <Marker key={thought.id} position={[thought.lat, thought.lng]} icon={customIcon}>
          <Popup>
            <div>
              <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>{thought.text}</p>
              <small style={{ color: '#666' }}>
                {new Date(thought.created_at).toLocaleString()}
              </small>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}