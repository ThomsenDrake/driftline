'use client';

import { useState, useEffect, useCallback } from 'react';
import { LatLngBounds } from 'leaflet';

interface Thought {
  id: string;
  text: string;
  mood?: string | null;
  created_at: string;
}

interface VibeSummaryProps {
  currentBounds?: LatLngBounds | null;
  onRefresh?: () => void;
}

// Simple in-memory cache
const vibeCache = new Map<string, { summary: string; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Generate cache key from bounds
const generateCacheKey = (bounds: LatLngBounds): string => {
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  return `${ne.lat.toFixed(4)},${ne.lng.toFixed(4)}_${sw.lat.toFixed(4)},${sw.lng.toFixed(4)}`;
};

// Fetch thoughts within bounds
const fetchThoughtsInBounds = async (bounds: LatLngBounds): Promise<Thought[]> => {
  try {
    const northEast = bounds.getNorthEast();
    const southWest = bounds.getSouthWest();
    
    const response = await fetch(`/api/thoughts-in-bounds?ne_lat=${northEast.lat}&ne_lng=${northEast.lng}&sw_lat=${southWest.lat}&sw_lng=${southWest.lng}&limit=40`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch thoughts');
    }
    
    const data = await response.json();
    return data.thoughts || [];
  } catch (error) {
    console.error('Error fetching thoughts:', error);
    return [];
  }
};

// Fetch vibe summary
const fetchVibeSummary = async (samples: Array<{ text: string; mood?: string }>): Promise<{ summary: string }> => {
  try {
    const response = await fetch('/api/vibe-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ samples }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch vibe summary');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching vibe summary:', error);
    return { summary: 'quiet currents under restless streets' };
  }
};

export default function VibeSummary({ currentBounds, onRefresh }: VibeSummaryProps) {
  const [summary, setSummary] = useState<string>('quiet currents under restless streets');
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load vibe summary
  const loadVibeSummary = useCallback(async (bounds: LatLngBounds) => {
    if (!bounds) return;

    setIsLoading(true);
    setError(null);

    try {
      const cacheKey = generateCacheKey(bounds);
      const cached = vibeCache.get(cacheKey);

      // Check cache first
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setSummary(cached.summary);
        setLastUpdated(new Date());
        setIsLoading(false);
        return;
      }

      // Fetch thoughts
      const thoughts = await fetchThoughtsInBounds(bounds);
      
      if (thoughts.length === 0) {
        setSummary('quiet currents under restless streets');
        setLastUpdated(new Date());
        setIsLoading(false);
        return;
      }

      // Prepare samples for AI
      const samples = thoughts.map(thought => ({
        text: thought.text,
        mood: thought.mood || undefined
      }));

      // Fetch vibe summary
      const result = await fetchVibeSummary(samples);
      const newSummary = result.summary;

      // Cache the result
      vibeCache.set(cacheKey, {
        summary: newSummary,
        timestamp: Date.now()
      });

      setSummary(newSummary);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error loading vibe summary:', err);
      setError('Unable to generate vibe summary');
      setSummary('quiet currents under restless streets');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    if (currentBounds) {
      await loadVibeSummary(currentBounds);
    }
    onRefresh?.();
  }, [currentBounds, loadVibeSummary, onRefresh]);

  // Auto-update when bounds change significantly
  useEffect(() => {
    if (currentBounds) {
      const debounceTimer = setTimeout(() => {
        loadVibeSummary(currentBounds);
      }, 2000); // Debounce to avoid excessive API calls

      return () => clearTimeout(debounceTimer);
    }
  }, [currentBounds, loadVibeSummary]);

  // Format time ago
  const formatTimeAgo = (date: Date | null): string => {
    if (!date) return '';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 bg-white/95 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-xl border border-gray-200 max-w-md w-full mx-4">
      <div className="flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse"></div>
            <h3 className="text-lg font-bold text-gray-900">Area Vibe</h3>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center space-x-2 px-4 py-2 text-sm bg-gradient-to-r from-blue-50 to-purple-50 text-blue-600 rounded-lg hover:from-blue-100 hover:to-purple-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 shadow-sm"
          >
            <svg
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isLoading ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              )}
            </svg>
            <span className="font-medium">Refresh</span>
          </button>
        </div>

        {/* Summary */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg"></div>
          <p className="relative text-gray-700 text-base leading-relaxed italic px-4 py-3">
            &quot;{summary}&quot;
          </p>
        </div>

        {/* Metadata */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className="flex items-center space-x-2 text-sm text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">{lastUpdated ? formatTimeAgo(lastUpdated) : 'Never'}</span>
          </span>
          {error && (
            <span className="flex items-center space-x-2 text-sm text-red-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">{error}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}