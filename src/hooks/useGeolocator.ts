'use client';

import { useState, useEffect } from 'react';

interface GeolocationState {
  location: {
    lat: number;
    lng: number;
  } | null;
  isLoading: boolean;
  error: string | null;
}

export const useGeolocator = () => {
  const [state, setState] = useState<GeolocationState>({
    location: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setState({
        location: null,
        isLoading: false,
        error: 'Geolocation is not supported by this browser',
      });
      return;
    }

    const handleSuccess = (position: GeolocationPosition) => {
      setState({
        location: {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        },
        isLoading: false,
        error: null,
      });
    };

    const handleError = (error: GeolocationPositionError) => {
      let errorMessage = 'Unable to retrieve your location';
      
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Location access denied by user';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Location information is unavailable';
          break;
        case error.TIMEOUT:
          errorMessage = 'Location request timed out';
          break;
      }

      setState({
        location: null,
        isLoading: false,
        error: errorMessage,
      });
    };

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000, // 5 minutes
    };

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, options);

    return () => {
      // Clean up if needed
    };
  }, []);

  return state;
};