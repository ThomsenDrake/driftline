'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Howl } from 'howler';
import { LatLngExpression, LatLngBounds } from 'leaflet';
import { supabase } from '@/lib/supabase';

interface Thought {
  id: string;
  text: string;
  audio_url?: string;
  lat: number;
  lng: number;
  mood?: string | null;
  created_at: string;
}

interface DriftModeProps {
  center: LatLngExpression;
  thoughts: Thought[];
  onExit: () => void;
  mapInstance: L.Map | null;
}

interface PathPoint {
  lat: number;
  lng: number;
  thought: Thought;
}

type DriftState = 'idle' | 'computing' | 'playing' | 'paused' | 'completed';

export default function DriftMode({ center, thoughts, onExit, mapInstance }: DriftModeProps) {
  const [driftState, setDriftState] = useState<DriftState>('idle');
  const [path, setPath] = useState<PathPoint[]>([]);
  const [currentThoughtIndex, setCurrentThoughtIndex] = useState(0);
  const [currentBounds, setCurrentBounds] = useState<LatLngBounds | null>(null);
  const [internalMapInstance, setInternalMapInstance] = useState<L.Map | null>(null);
  const [audioPlayers, setAudioPlayers] = useState<Map<string, Howl>>(new Map());
  
  const animationRef = useRef<number | null>(null);
  const thoughtTimerRef = useRef<NodeJS.Timeout | null>(null);
  const crossfadeTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Calculate distance between two points
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Find nearest thoughts using simple nearest-neighbor algorithm
  const computePath = useCallback((centerPoint: LatLngExpression, availableThoughts: Thought[]): PathPoint[] => {
    if (availableThoughts.length === 0) return [];
    
    const [centerLat, centerLng] = centerPoint as [number, number];
    const thoughtsWithDistance = availableThoughts
      .filter(thought => thought.lat !== centerLat || thought.lng !== centerLng)
      .map(thought => ({
        thought,
        distance: calculateDistance(centerLat, centerLng, thought.lat, thought.lng)
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5)
      .map(({ thought, distance }) => ({ thought, distance }));

    // Simple nearest neighbor path
    const path: PathPoint[] = [];
    const remainingThoughts = [...thoughtsWithDistance];
    
    if (remainingThoughts.length === 0) return [];
    
    // Start with the nearest thought
    let current = remainingThoughts.shift()!;
    path.push({ lat: current.thought.lat, lng: current.thought.lng, thought: current.thought });
    
    // Find nearest neighbor for remaining thoughts
    while (remainingThoughts.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;
      
      for (let i = 0; i < remainingThoughts.length; i++) {
        const distance = calculateDistance(
          current.thought.lat, 
          current.thought.lng,
          remainingThoughts[i].thought.lat,
          remainingThoughts[i].thought.lng
        );
        
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }
      
      current = remainingThoughts.splice(nearestIndex, 1)[0]!;
      path.push({ lat: current.thought.lat, lng: current.thought.lng, thought: current.thought });
    }
    
    return path;
  }, []);

  // Initialize audio players
  const initializeAudioPlayers = useCallback((thoughts: Thought[]) => {
    const newAudioPlayers = new Map<string, Howl>();
    
    thoughts.forEach(thought => {
      if (thought.audio_url) {
        newAudioPlayers.set(thought.id, new Howl({
          src: [thought.audio_url],
          volume: 0,
          loop: false,
          onend: () => {
            // Audio ended, handle crossfade to next
            console.log(`Audio ended for thought ${thought.id}`);
          },
          onloaderror: (id, err) => {
            console.error(`Audio load error for thought ${thought.id}:`, err);
          },
          onplayerror: (id, err) => {
            console.error(`Audio play error for thought ${thought.id}:`, err);
          }
        }));
      }
    });
    
    setAudioPlayers(newAudioPlayers);
  }, []);

  // Clean up audio players
  const cleanupAudioPlayers = useCallback(() => {
    audioPlayers.forEach(player => {
      player.stop();
      player.unload();
    });
    setAudioPlayers(new Map());
  }, [audioPlayers]);

  // Animate map to a specific position
  const animateToPosition = useCallback((targetLat: number, targetLng: number, duration: number = 2000) => {
    if (!mapInstance) return;
    
    const startLat = mapInstance.getCenter().lat;
    const startLng = mapInstance.getCenter().lng;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      const currentLat = startLat + (targetLat - startLat) * easeProgress;
      const currentLng = startLng + (targetLng - startLng) * easeProgress;
      
      mapInstance.setView([currentLat, currentLng], mapInstance.getZoom());
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    animationRef.current = requestAnimationFrame(animate);
  }, [mapInstance]);

  // Crossfade audio between two thoughts
  const crossfadeAudio = useCallback((fromThought: Thought | null, toThought: Thought, duration: number = 1000) => {
    const fromPlayer = fromThought ? audioPlayers.get(fromThought.id) : null;
    const toPlayer = audioPlayers.get(toThought.id);
    
    if (!toPlayer) return;
    
    // Start the new audio
    toPlayer.play();
    
    // Crossfade logic
    const startTime = Date.now();
    const fadeDuration = duration;
    
    const fade = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / fadeDuration, 1);
      
      if (fromPlayer) {
        fromPlayer.volume(1 - progress);
      }
      toPlayer.volume(progress);
      
      if (progress < 1) {
        crossfadeTimerRef.current = setTimeout(fade, 16); // ~60fps
      }
    };
    
    if (crossfadeTimerRef.current) {
      clearTimeout(crossfadeTimerRef.current);
    }
    fade();
  }, [audioPlayers]);

  // Handle thought display
  const displayThought = useCallback((thought: Thought, index: number, total: number) => {
    // Auto-open thought modal (this would need to be passed from parent)
    console.log(`Displaying thought ${index + 1}/${total}:`, thought.text);
    
    // Set a timer to move to the next thought
    if (thoughtTimerRef.current) {
      clearTimeout(thoughtTimerRef.current);
    }
    
    thoughtTimerRef.current = setTimeout(() => {
      setCurrentThoughtIndex(prev => {
        const nextIndex = prev + 1;
        if (nextIndex >= path.length) {
          // End of path
          setDriftState('completed');
          cleanupAudioPlayers();
          return prev;
        }
        return nextIndex;
      });
    }, 7000); // 7 seconds per thought
  }, [path, cleanupAudioPlayers]);

  // Start the drift tour
  const startDrift = useCallback(() => {
    if (thoughts.length === 0) {
      console.warn('No thoughts available for drift mode');
      return;
    }
    
    setDriftState('computing');
    
    // Compute path
    const computedPath = computePath(center, thoughts);
    if (computedPath.length === 0) {
      console.warn('No valid path computed');
      setDriftState('idle');
      return;
    }
    
    setPath(computedPath);
    setCurrentThoughtIndex(0);
    setDriftState('playing');
    
    // Initialize audio players
    initializeAudioPlayers(computedPath.map(p => p.thought));
    
    // Start with first thought
    setTimeout(() => {
      displayThought(computedPath[0].thought, 0, computedPath.length);
    }, 1000);
  }, [center, thoughts, computePath, initializeAudioPlayers, displayThought]);

  // Pause the drift tour
  const pauseDrift = useCallback(() => {
    setDriftState('paused');
    
    if (thoughtTimerRef.current) {
      clearTimeout(thoughtTimerRef.current);
      thoughtTimerRef.current = null;
    }
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    if (crossfadeTimerRef.current) {
      clearTimeout(crossfadeTimerRef.current);
      crossfadeTimerRef.current = null;
    }
    
    // Pause all audio
    audioPlayers.forEach(player => {
      player.pause();
    });
  }, [audioPlayers]);

  // Resume the drift tour
  const resumeDrift = useCallback(() => {
    if (driftState === 'paused' && currentThoughtIndex < path.length) {
      setDriftState('playing');
      
      const currentThought = path[currentThoughtIndex].thought;
      displayThought(currentThought, currentThoughtIndex, path.length);
    }
  }, [driftState, currentThoughtIndex, path, displayThought]);

  // Handle current thought changes
  useEffect(() => {
    if (driftState !== 'playing' || path.length === 0) return;
    
    if (currentThoughtIndex >= path.length) {
      // Tour completed
      setDriftState('completed');
      cleanupAudioPlayers();
      return;
    }
    
    const currentPoint = path[currentThoughtIndex];
    
    // Animate map to current thought
    animateToPosition(currentPoint.lat, currentPoint.lng);
    
    // Handle audio crossfade
    if (currentThoughtIndex > 0) {
      const previousPoint = path[currentThoughtIndex - 1];
      crossfadeAudio(previousPoint.thought, currentPoint.thought);
    } else {
      // First thought - just play the audio
      const player = audioPlayers.get(currentPoint.thought.id);
      if (player) {
        player.play();
      }
    }
    
    // Display the thought
    displayThought(currentPoint.thought, currentThoughtIndex, path.length);
    
  }, [currentThoughtIndex, path, driftState, animateToPosition, crossfadeAudio, audioPlayers, displayThought, cleanupAudioPlayers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (thoughtTimerRef.current) {
        clearTimeout(thoughtTimerRef.current);
      }
      if (crossfadeTimerRef.current) {
        clearTimeout(crossfadeTimerRef.current);
      }
      cleanupAudioPlayers();
    };
  }, [cleanupAudioPlayers]);

  // Update map instance when provided
  useEffect(() => {
    setInternalMapInstance(mapInstance);
  }, [mapInstance]);

  useEffect(() => {
    if (internalMapInstance && driftState === 'playing' && path.length > 0 && currentThoughtIndex < path.length) {
      const currentPoint = path[currentThoughtIndex];
      animateToPosition(currentPoint.lat, currentPoint.lng);
    }
  }, [internalMapInstance, driftState, path, currentThoughtIndex, animateToPosition]);

  const handlePlay = () => {
    if (driftState === 'idle' || driftState === 'completed') {
      startDrift();
    } else if (driftState === 'paused') {
      resumeDrift();
    }
  };

  const handlePause = () => {
    if (driftState === 'playing') {
      pauseDrift();
    }
  };

  const handleExit = () => {
    // Clean up everything
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (thoughtTimerRef.current) {
      clearTimeout(thoughtTimerRef.current);
    }
    if (crossfadeTimerRef.current) {
      clearTimeout(crossfadeTimerRef.current);
    }
    cleanupAudioPlayers();
    
    onExit();
  };

  // Get current thought for display
  const currentThought = path.length > 0 && currentThoughtIndex < path.length 
    ? path[currentThoughtIndex].thought 
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
      {/* Drift Mode Overlay */}
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full mx-4 border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse"></div>
              <h2 className="text-2xl font-bold text-gray-900">Drift Mode</h2>
            </div>
            <button
              onClick={handleExit}
              className="p-2.5 rounded-full hover:bg-white/70 transition-all duration-200 hover:scale-105"
              aria-label="Exit Drift Mode"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Progress indicator */}
          {path.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span className="font-medium">Tour Progress</span>
                <span className="font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs">
                  {currentThoughtIndex + 1} / {path.length}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500 shadow-lg"
                  style={{ width: `${((currentThoughtIndex + 1) / path.length) * 100}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Current Thought Display */}
        {currentThought && (
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-start space-x-4">
              <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mt-1.5 animate-pulse"></div>
              <div className="flex-1">
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-5 rounded-2xl border border-gray-100 shadow-sm">
                  <p className="text-gray-800 leading-relaxed font-medium text-lg">
                    "{currentThought.text}"
                  </p>
                </div>
                {currentThought.audio_url && (
                  <div className="mt-4 flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-green-600 font-medium flex items-center">
                      <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                      </svg>
                      Audio Playing
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="p-6 bg-gray-50">
          <div className="flex items-center justify-center space-x-3">
            {driftState === 'playing' ? (
              <button
                onClick={handlePause}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 shadow-lg"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Pause</span>
              </button>
            ) : (
              <button
                onClick={handlePlay}
                disabled={driftState === 'computing'}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">{driftState === 'completed' ? 'Restart' : 'Start'}</span>
              </button>
            )}
            
            <button
              onClick={handleExit}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 shadow-lg"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Exit</span>
            </button>
          </div>
          
          {/* Status message */}
          {driftState === 'computing' && (
            <div className="text-center mt-4">
              <div className="flex items-center justify-center space-x-2 text-blue-600">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="font-medium">Computing drift path...</span>
              </div>
            </div>
          )}
          {driftState === 'completed' && (
            <div className="text-center mt-4">
              <div className="flex items-center justify-center space-x-2 text-green-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Drift tour completed!</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}