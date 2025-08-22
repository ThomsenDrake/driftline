'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
import ThoughtForm from './ThoughtForm';
import { supabase } from '@/lib/supabase';

// Fix for Leaflet default marker icons
import L from 'leaflet';
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MapPlaceholderProps {
  center?: LatLngExpression;
  zoom?: number;
}

interface Thought {
  id: string;
  text: string;
  audio_url?: string;
  lat: number;
  lng: number;
  created_at: string;
}

export default function MapPlaceholder({
  center: defaultCenter = [40.7128, -74.006] as LatLngExpression,
  zoom = 13
}: MapPlaceholderProps) {
  const [center, setCenter] = useState<LatLngExpression>(defaultCenter);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);

  useEffect(() => {
    console.log('🔍 [DEBUG] Starting geolocation request...');
    if (navigator.geolocation) {
      const options = {
        enableHighAccuracy: true,
        timeout: 8000, // 8 second timeout (reduced from 10)
        maximumAge: 300000 // 5 minutes cache
      };
      
      const geolocationTimer = setTimeout(() => {
        console.error('🔍 [DEBUG] Geolocation request timed out after 8 seconds');
        setError('Location request timed out. Please check your internet connection and location services. Using default location.');
        setIsLoading(false);
      }, 8000);
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('🔍 [DEBUG] Geolocation success:', position.coords);
          clearTimeout(geolocationTimer);
          const { latitude, longitude } = position.coords;
          setCenter([latitude, longitude]);
          setIsLoading(false);
        },
        (err) => {
          console.error('🔍 [DEBUG] Geolocation error:', err);
          console.error('🔍 [DEBUG] Error code:', err.code);
          console.error('🔍 [DEBUG] Error message:', err.message);
          clearTimeout(geolocationTimer);
          
          let errorMessage = 'Unable to get your location. ';
          if (err.code === 1) {
            errorMessage += 'Location access denied. ';
            errorMessage += 'Please click the location icon in your browser address bar, select "Allow," and refresh the page. ';
            errorMessage += 'If you\'ve previously denied permission, you may need to reset permissions in page settings.';
            setLocationPermissionDenied(true);
          } else if (err.code === 2) {
            errorMessage += 'Location unavailable. Please check your device settings.';
          } else if (err.code === 3) {
            errorMessage += 'Location request timed out. Please check your internet connection.';
          } else {
            errorMessage += 'Please try again.';
          }
          
          setError(`${errorMessage} Using default location (New York City).`);
          setIsLoading(false);
        },
        options
      );
    } else {
      console.error('🔍 [DEBUG] Geolocation not supported by browser');
      setError('Geolocation is not supported by this browser. Using default location (New York City).');
      setIsLoading(false);
    }
  }, []);

  // Function to refresh location
  const refreshLocation = () => {
    console.log('🔍 [DEBUG] Refreshing location...');
    setError(null);
    setLocationPermissionDenied(false);
    setIsLoading(true);
    
    if (navigator.geolocation) {
      const options = {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 300000
      };
      
      const geolocationTimer = setTimeout(() => {
        console.error('🔍 [DEBUG] Geolocation request timed out after 8 seconds');
        setError('Location request timed out. Please check your internet connection and location services. Using default location.');
        setIsLoading(false);
      }, 8000);
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('🔍 [DEBUG] Geolocation success:', position.coords);
          clearTimeout(geolocationTimer);
          const { latitude, longitude } = position.coords;
          setCenter([latitude, longitude]);
          setIsLoading(false);
        },
        (err) => {
          console.error('🔍 [DEBUG] Geolocation error:', err);
          console.error('🔍 [DEBUG] Error code:', err.code);
          console.error('🔍 [DEBUG] Error message:', err.message);
          clearTimeout(geolocationTimer);
          
          let errorMessage = 'Unable to get your location. ';
          if (err.code === 1) {
            errorMessage += 'Location access denied. ';
            errorMessage += 'Please click the location icon in your browser address bar, select "Allow," and refresh the page. ';
            errorMessage += 'If you\'ve previously denied permission, you may need to reset permissions in page settings.';
            setLocationPermissionDenied(true);
          } else if (err.code === 2) {
            errorMessage += 'Location unavailable. Please check your device settings.';
          } else if (err.code === 3) {
            errorMessage += 'Location request timed out. Please check your internet connection.';
          } else {
            errorMessage += 'Please try again.';
          }
          
          setError(`${errorMessage} Using default location (New York City).`);
          setIsLoading(false);
        },
        options
      );
    } else {
      console.error('🔍 [DEBUG] Geolocation not supported by browser');
      setError('Geolocation is not supported by this browser. Using default location (New York City).');
      setIsLoading(false);
    }
  };

  // Fetch existing thoughts from Supabase
  useEffect(() => {
    const fetchThoughts = async () => {
      try {
        const { data, error } = await supabase
          .from('thoughts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('Error fetching thoughts:', error);
          return;
        }

        setThoughts(data || []);
      } catch (err) {
        console.error('Error fetching thoughts:', err);
      }
    };

    fetchThoughts();
  }, []);

  const handleThoughtSubmit = (thought: { text: string; audio_url?: string; lat: number; lng: number }) => {
    // Add the new thought to the local state immediately
    const newThought: Thought = {
      id: Date.now().toString(), // Temporary ID for local state
      text: thought.text,
      audio_url: thought.audio_url,
      lat: thought.lat,
      lng: thought.lng,
      created_at: new Date().toISOString(),
    };
    setThoughts(prev => [newThought, ...prev]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Getting your location...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Thought Form - Fixed width on the left */}
      <div className="w-96 bg-white shadow-lg z-10 overflow-y-auto">
        <div className="p-4">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Driftline</h1>
          <p className="text-gray-600 mb-6">Share anonymous thoughts with the world around you.</p>
          <ThoughtForm onSubmit={handleThoughtSubmit} />
        </div>
      </div>

      {/* Map - Takes remaining space */}
      <div className="flex-1 relative">
        {error && (
          <div className="absolute top-4 right-4 z-20 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-2 rounded shadow-md">
            {error}
            {locationPermissionDenied && (
              <button
                onClick={refreshLocation}
                className="ml-2 text-sm underline hover:text-blue-600"
              >
                Try Again
              </button>
            )}
          </div>
        )}
        
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            crossOrigin=""
          />
          
          {/* User location marker */}
          <Marker position={center}>
            <Popup>
              {error ? 'Default Location' : 'Your Location'}
              {error && (
                <>
                  <br />
                  <small className="text-gray-600">{error}</small>
                </>
              )}
            </Popup>
          </Marker>

          {/* Thought markers */}
          {thoughts.map((thought) => (
            <Marker key={thought.id} position={[thought.lat, thought.lng]}>
              <Popup>
                <div className="p-2">
                  <p className="text-sm text-gray-800 mb-2">{thought.text}</p>
                  {thought.audio_url && (
                    <audio controls className="w-full">
                      <source src={thought.audio_url} type="audio/webm" />
                      Your browser does not support the audio element.
                    </audio>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(thought.created_at).toLocaleString()}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}