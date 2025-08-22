'use client';

import { useState, useEffect } from 'react';
import Map, { Marker, Popup } from 'react-map-gl/maplibre';
import { supabase } from '@/lib/supabase';
import 'maplibre-gl/dist/maplibre-gl.css';

// TypeScript interface for Thought data
interface Thought {
  id: string;
  text: string;
  audio_url?: string;
  lat: number;
  lng: number;
  mood?: string;
  created_at: string;
  expires_at: string;
}

// Function to get marker color based on mood
const getMoodColor = (mood?: string): string => {
  switch (mood) {
    case 'calm': return '#10b981'; // green
    case 'intense': return '#ef4444'; // red
    case 'dreamy': return '#8b5cf6'; // purple
    case 'neutral': return '#3b82f6'; // blue
    default: return '#6b7280'; // gray
  }
};

export default function MapLibreMap() {
  const [viewState, setViewState] = useState({
    longitude: -74.006,
    latitude: 40.7128,
    zoom: 13
  });
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedThought, setSelectedThought] = useState<string | null>(null);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [showThoughtForm, setShowThoughtForm] = useState(false);
  const [thoughtText, setThoughtText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [mediaRecorderRef] = useState<{ current: MediaRecorder | null }>({ current: null });
  const [audioChunksRef] = useState<{ current: Blob[] }>({ current: [] });
  const [streamRef] = useState<{ current: MediaStream | null }>({ current: null });
  const [timerRef] = useState<{ current: NodeJS.Timeout | null }>({ current: null });

  // Audio recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        setAudioUrl(URL.createObjectURL(audioBlob));
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };
      
      setIsRecording(true);
      setRecordingTime(0);
      mediaRecorder.start();
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 10) {
            stopRecording();
            return 10;
          }
          return prev + 1;
        });
      }, 1000);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const deleteRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const uploadAudio = async (): Promise<string | null> => {
    if (!audioBlob) return null;

    try {
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.webm`;
      
      const { error: uploadError } = await supabase.storage
        .from('audio')
        .upload(fileName, audioBlob);

      if (uploadError) {
        console.error('Audio upload error:', uploadError);
        
        // Provide user-friendly error messages based on the actual error
        if (uploadError.message.includes('Bucket not found')) {
          throw new Error('Audio storage bucket not found. Please create an "audio" bucket in your Supabase dashboard under Storage.');
        } else if (uploadError.message.includes('row-level security policy') || uploadError.message.includes('row level security')) {
          throw new Error('Storage permissions not configured. Please disable RLS on the audio bucket or create policies for anonymous uploads.');
        } else if (uploadError.statusCode === '403' || uploadError.status === 403) {
          throw new Error('Storage access denied. Please check bucket permissions in your Supabase dashboard.');
        } else {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }
      }

      const { data: { publicUrl } } = supabase.storage
        .from('audio')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading audio:', error);
      throw error;
    }
  };

  // Fire-and-forget mood tagging function
  const tagThoughtMoodAsync = async (thoughtId: string, text: string) => {
    try {
      const response = await fetch('/api/mood-tag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        console.warn('Mood tagging failed:', response.status);
        return;
      }

      const { mood } = await response.json();
      
      if (mood && mood !== 'neutral') {
        // Update the thought with the mood
        const { error: updateError } = await supabase
          .from('thoughts')
          .update({ mood })
          .eq('id', thoughtId);

        if (updateError) {
          console.warn('Failed to update mood:', updateError);
        } else {
          console.log(`Mood tagged: ${mood} for thought ${thoughtId}`);
          // Refresh thoughts to show the updated mood
          fetchThoughts();
        }
      }
    } catch (error) {
      console.warn('Mood tagging error:', error);
      // Don't throw - this is fire-and-forget
    }
  };

  // Submit thought to Supabase
  const submitThought = async () => {
    if (!userLocation || (!thoughtText.trim() && !audioBlob)) return;
    
    setIsSubmitting(true);
    try {
      let audioUrlValue: string | null = null;
      
      // Upload audio if recorded
      if (audioBlob) {
        audioUrlValue = await uploadAudio();
        if (!audioUrlValue) {
          throw new Error('Failed to upload audio');
        }
      }

      const response = await fetch('/api/thoughts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: thoughtText.trim() || '', // Allow empty text if audio exists
          audio_url: audioUrlValue,
          lat: userLocation.lat,
          lng: userLocation.lng,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit thought');
      }

      const result = await response.json();
      const thoughtId = result.data?.id;

      // Fire-and-forget mood tagging if we have text and a thought ID
      if (thoughtId && thoughtText.trim()) {
        tagThoughtMoodAsync(thoughtId, thoughtText.trim());
      }

      // Reset form
      setThoughtText('');
      deleteRecording();
      setShowThoughtForm(false);
      
      // Refresh thoughts to show the new one
      fetchThoughts();
    } catch (error) {
      console.error('Error submitting thought:', error);
      // Show user-friendly error message
      if (error instanceof Error) {
        if (error.message.includes('Audio storage bucket not found')) {
          alert('Audio storage not set up. Please create an "audio" bucket in your Supabase dashboard under Storage, or submit without audio.');
        } else {
          alert(`Failed to submit thought: ${error.message}`);
        }
      } else {
        alert('Failed to submit thought. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetch thoughts from Supabase
  const fetchThoughts = async () => {
    try {
      const { data, error } = await supabase
        .from('thoughts')
        .select('*')
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching thoughts:', error);
        return;
      }

      setThoughts(data || []);
    } catch (err) {
      console.error('Error fetching thoughts:', err);
    }
  };

  // Get user location and fetch thoughts
  useEffect(() => {
    // Fetch thoughts immediately
    fetchThoughts();

    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          setViewState(prev => ({
            ...prev,
            latitude,
            longitude
          }));
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

  // Set up real-time subscription for new thoughts
  useEffect(() => {
    const subscription = supabase
      .channel('thoughts')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'thoughts' },
        (payload) => {
          console.log('New thought received:', payload);
          setThoughts(prev => [payload.new as Thought, ...prev]);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
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
    <Map
      {...viewState}
      onMove={evt => setViewState(evt.viewState)}
      onLoad={(evt) => {
        const map = evt.target;
        // Add polyfills for missing Mapbox methods to prevent console errors
        if (!map.getSky) {
          map.getSky = () => undefined;
        }
        if (!map.setSky) {
          map.setSky = () => {};
        }
      }}
      style={{ width: '100vw', height: '100vh' }}
      mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
    >
      {/* User location marker */}
      {userLocation && (
        <Marker
          longitude={userLocation.lng}
          latitude={userLocation.lat}
          color="blue"
          onClick={() => setSelectedThought('user')}
        />
      )}

      {/* Thought markers */}
      {thoughts.map((thought) => (
        <Marker
          key={thought.id}
          longitude={thought.lng}
          latitude={thought.lat}
          color={getMoodColor(thought.mood)}
          onClick={() => setSelectedThought(thought.id)}
        />
      ))}

      {/* Popup for user location */}
      {selectedThought === 'user' && userLocation && (
        <Popup
          longitude={userLocation.lng}
          latitude={userLocation.lat}
          onClose={() => setSelectedThought(null)}
          closeButton={true}
          closeOnClick={false}
        >
          <div>
            <strong>Your Location</strong>
            <br />
            Lat: {userLocation.lat.toFixed(4)}, Lng: {userLocation.lng.toFixed(4)}
          </div>
        </Popup>
      )}

      {/* Popups for thoughts */}
      {thoughts.map((thought) => (
        selectedThought === thought.id && (
          <Popup
            key={thought.id}
            longitude={thought.lng}
            latitude={thought.lat}
            onClose={() => setSelectedThought(null)}
            closeButton={true}
            closeOnClick={false}
          >
            <div style={{ minWidth: '200px', maxWidth: '300px' }}>
              <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', fontSize: '14px' }}>
                {thought.text}
              </p>
              
              {thought.mood && (
                <div style={{ 
                  margin: '8px 0', 
                  padding: '2px 8px', 
                  backgroundColor: getMoodColor(thought.mood), 
                  color: 'white', 
                  borderRadius: '12px', 
                  fontSize: '12px',
                  display: 'inline-block'
                }}>
                  {thought.mood}
                </div>
              )}

              {thought.audio_url && (
                <div style={{ margin: '8px 0' }}>
                  <audio controls style={{ width: '100%', height: '32px' }}>
                    <source src={thought.audio_url} type="audio/webm" />
                    <source src={thought.audio_url} type="audio/mp4" />
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}
              
              <small style={{ color: '#666', fontSize: '11px' }}>
                {new Date(thought.created_at).toLocaleString()}
              </small>
            </div>
          </Popup>
        )
      ))}

      {/* Floating Action Button */}
      {userLocation && !showThoughtForm && (
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            width: '60px',
            height: '60px',
            backgroundColor: '#3b82f6',
            borderRadius: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
            zIndex: 1000,
          }}
          onClick={() => setShowThoughtForm(true)}
        >
          <div style={{ color: 'white', fontSize: '24px', fontWeight: 'bold' }}>+</div>
        </div>
      )}

      {/* Thought Form Backdrop */}
      {showThoughtForm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setShowThoughtForm(false)}
        >
          {/* Thought Form */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              maxWidth: '400px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside form
          >
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>
            Share a thought
          </h3>
          
          <textarea
            value={thoughtText}
            onChange={(e) => setThoughtText(e.target.value)}
            placeholder="What's on your mind? (text optional if recording audio)"
            style={{
              width: '100%',
              height: '80px',
              padding: '12px',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              marginBottom: '12px',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#3b82f6';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e5e7eb';
            }}
            maxLength={200}
          />
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <small style={{ color: '#6b7280' }}>
              {thoughtText.length}/200 characters
            </small>
            
            {/* Audio recording button */}
            {!isRecording && !audioBlob && (
              <button
                type="button"
                onClick={startRecording}
                style={{
                  padding: '8px',
                  border: '2px solid #3b82f6',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  color: '#3b82f6',
                  cursor: 'pointer',
                  fontSize: '14px',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                🎤
              </button>
            )}
          </div>

          {/* Recording indicator */}
          {isRecording && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              padding: '12px',
              backgroundColor: '#fef3f2',
              border: '2px solid #ef4444',
              borderRadius: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  backgroundColor: '#ef4444',
                  borderRadius: '50%',
                  animation: 'pulse 1s infinite',
                }}></div>
                <span style={{ color: '#ef4444', fontWeight: '500' }}>
                  Recording... {recordingTime}/10s
                </span>
              </div>
              <button
                type="button"
                onClick={stopRecording}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '500',
                }}
              >
                Stop
              </button>
            </div>
          )}

          {/* Audio preview */}
          {audioBlob && audioUrl && (
            <div style={{
              marginBottom: '16px',
              padding: '12px',
              backgroundColor: '#f0f9ff',
              border: '2px solid #3b82f6',
              borderRadius: '8px',
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                gap: '8px',
                marginBottom: '8px'
              }}>
                <small style={{ color: '#3b82f6', fontWeight: '500' }}>
                  Audio Recording ({recordingTime}s)
                </small>
                <button
                  type="button"
                  onClick={deleteRecording}
                  style={{
                    padding: '4px 8px',
                    border: 'none',
                    borderRadius: '4px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '500',
                  }}
                >
                  Delete
                </button>
              </div>
              <audio controls style={{ width: '100%', height: '32px' }}>
                <source src={audioUrl} type="audio/webm" />
              </audio>
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => {
                setShowThoughtForm(false);
                setThoughtText('');
                deleteRecording();
              }}
              style={{
                flex: 1,
                padding: '12px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: 'white',
                color: '#374151',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              Cancel
            </button>
            
            <button
              onClick={submitThought}
              disabled={(!thoughtText.trim() && !audioBlob) || isSubmitting}
              style={{
                flex: 1,
                padding: '12px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: (thoughtText.trim() || audioBlob) && !isSubmitting ? '#3b82f6' : '#9ca3af',
                color: 'white',
                cursor: (thoughtText.trim() || audioBlob) && !isSubmitting ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              {isSubmitting ? 'Submitting...' : 'Share'}
            </button>
          </div>
          </div>
        </div>
      )}
    </Map>
  );
}