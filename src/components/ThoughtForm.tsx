'use client';

import { useState, useRef, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { containsProfanity, filterProfanity, getProfanityMatch } from '@/lib/profanity-filter';

const thoughtSchema = z.object({
  text: z.string().min(1, 'Text is required').max(200, 'Text must be 200 characters or less'),
  lat: z.number(),
  lng: z.number(),
});

type ThoughtFormData = z.infer<typeof thoughtSchema>;

interface ThoughtFormProps {
  onSubmit?: (thought: { text: string; audio_url?: string; lat: number; lng: number }) => void;
}

export default function ThoughtForm({ onSubmit }: ThoughtFormProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [profanityError, setProfanityError] = useState<string | null>(null);
  const [showProfanityWarning, setShowProfanityWarning] = useState(false);
  const [filteredText, setFilteredText] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    reset,
    getValues,
  } = useForm<ThoughtFormData>({
    resolver: zodResolver(thoughtSchema),
    mode: 'onChange',
  });

  // Get user location on mount
  useEffect(() => {
    console.log('🔍 [DEBUG] ThoughtForm: Starting geolocation request...');
    let geolocationTimer: NodeJS.Timeout;
    
    if (navigator.geolocation) {
      const options = {
        enableHighAccuracy: true,
        timeout: 8000, // 8 second timeout (reduced from 10)
        maximumAge: 300000 // 5 minutes cache
      };
      
      geolocationTimer = setTimeout(() => {
        console.error('🔍 [DEBUG] ThoughtForm: Geolocation request timed out after 8 seconds');
        setLocationError('Location request timed out. Please check your internet connection and location services.');
      }, 8000);
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('🔍 [DEBUG] ThoughtForm: Geolocation success:', position.coords);
          clearTimeout(geolocationTimer);
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('🔍 [DEBUG] ThoughtForm: Geolocation error:', error);
          console.error('🔍 [DEBUG] ThoughtForm: Error code:', error.code);
          console.error('🔍 [DEBUG] ThoughtForm: Error message:', error.message);
          clearTimeout(geolocationTimer);
          
          let errorMessage = 'Unable to get your location. ';
          if (error.code === 1) {
            errorMessage += 'Location access denied. ';
            errorMessage += 'Please click the location icon in your browser address bar, select "Allow," and refresh the page. ';
            errorMessage += 'If you\'ve previously denied permission, you may need to reset permissions in page settings.';
          } else if (error.code === 2) {
            errorMessage += 'Location unavailable. Please check your device settings.';
          } else if (error.code === 3) {
            errorMessage += 'Location request timed out. Please check your internet connection.';
          } else {
            errorMessage += 'Please try again.';
          }
          
          setLocationError(errorMessage);
        },
        options
      );
    } else {
      console.error('🔍 [DEBUG] ThoughtForm: Geolocation not supported by browser');
      setLocationError('Geolocation is not supported by your browser.');
    }

    // Cleanup function
    return () => {
      if (geolocationTimer) {
        clearTimeout(geolocationTimer);
      }
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      console.log('🔍 [DEBUG] Starting audio recording...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('🔍 [DEBUG] Audio stream obtained:', stream);
      streamRef.current = stream;
      
      // Clear any existing timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('🔍 [DEBUG] Audio data available:', event.data.size, 'bytes');
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        console.log('🔍 [DEBUG] Audio recording stopped, creating blob...');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log('🔍 [DEBUG] Audio blob created:', audioBlob.size, 'bytes');
        setAudioBlob(audioBlob);
        const objectUrl = URL.createObjectURL(audioBlob);
        console.log('🔍 [DEBUG] Audio object URL created:', objectUrl);
        setAudioUrl(objectUrl);
        
        // Clear timer after recording stops
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      mediaRecorderRef.current.start();
      console.log('🔍 [DEBUG] Audio recording started');
      setIsRecording(true);
      setRecordingTime(0);

      // Timer for 10 seconds max
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 10) {
            console.log('🔍 [DEBUG] Max recording time reached, stopping...');
            stopRecording();
            return 10;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (error) {
      console.error('🔍 [DEBUG] Error starting recording:', error);
      const errorType = error instanceof Error ? error.constructor.name : 'Unknown';
      console.error('🔍 [DEBUG] Error type:', errorType);
      console.error('🔍 [DEBUG] Error details:', error);
      setSubmitError('Unable to access microphone. Please check permissions.');
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
    console.log('🔍 [DEBUG] Deleting recording...');
    if (audioUrl) {
      console.log('🔍 [DEBUG] Revoking audio object URL:', audioUrl);
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    if (streamRef.current) {
      console.log('🔍 [DEBUG] Stopping audio tracks...');
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const uploadAudio = async (): Promise<string | null> => {
    if (!audioBlob) {
      console.log('🔍 [DEBUG] No audio blob to upload');
      return null;
    }

    console.log('🔍 [DEBUG] Starting audio upload...');
    console.log('🔍 [DEBUG] Audio blob size:', audioBlob.size, 'bytes');
    console.log('🔍 [DEBUG] Audio blob type:', audioBlob.type);

    setIsUploading(true);
    try {
      const fileName = `audio/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.webm`;
      console.log('🔍 [DEBUG] Generated filename:', fileName);
      
      const { error: uploadError } = await supabase.storage
        .from('audio')
        .upload(fileName, audioBlob);

      if (uploadError) {
        console.error('🔍 [DEBUG] Audio upload error:', uploadError);
        throw uploadError;
      }

      console.log('🔍 [DEBUG] Audio upload successful, getting public URL...');
      const { data: { publicUrl } } = supabase.storage
        .from('audio')
        .getPublicUrl(fileName);

      console.log('🔍 [DEBUG] Public URL generated:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('🔍 [DEBUG] Error uploading audio:', error);
      const errorType = error instanceof Error ? error.constructor.name : 'Unknown';
      console.error('🔍 [DEBUG] Error type:', errorType);
      console.error('🔍 [DEBUG] Error details:', error);
      setSubmitError('Failed to upload audio. Please try again.');
      return null;
    } finally {
      setIsUploading(false);
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
        }
      }
    } catch (error) {
      console.warn('Mood tagging error:', error);
      // Don't throw - this is fire-and-forget
    }
  };

  const checkProfanity = (text: string) => {
    const hasProfanity = containsProfanity(text);
    if (hasProfanity) {
      const { filtered } = filterProfanity(text);
      setFilteredText(filtered);
      const matches = getProfanityMatch(text);
      setProfanityError(`Please remove inappropriate language: ${matches.slice(0, 2).join(', ')}${matches.length > 2 ? '...' : ''}`);
      setShowProfanityWarning(true);
      return false;
    } else {
      setFilteredText(text);
      setProfanityError(null);
      setShowProfanityWarning(false);
      return true;
    }
  };

  const onTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    register('text').onChange(e);
    checkProfanity(text);
  };

  const onFormSubmit = async () => {
    console.log('🔍 [DEBUG] Starting thought submission...');
    console.log('🔍 [DEBUG] Location:', location);
    console.log('🔍 [DEBUG] Text:', getValues('text'));
    console.log('🔍 [DEBUG] Filtered text:', filteredText);
    console.log('🔍 [DEBUG] Audio blob:', audioBlob ? 'present' : 'none');
    
    if (!location) {
      console.error('🔍 [DEBUG] Submission failed: No location');
      setSubmitError('Location is required. Please enable location services.');
      return;
    }

    // Check for profanity before submitting
    const text = getValues('text');
    if (!checkProfanity(text)) {
      console.log('🔍 [DEBUG] Submission blocked: Profanity detected');
      return;
    }

    setSubmitError(null);
    setSubmitSuccess(false);
    setShowProfanityWarning(false);

    try {
      let audioUrlValue: string | null = null;
      
      // Upload audio if recorded
      if (audioBlob) {
        console.log('🔍 [DEBUG] Uploading audio...');
        audioUrlValue = await uploadAudio();
        if (!audioUrlValue) {
          console.error('🔍 [DEBUG] Audio upload failed');
          return; // Error already set
        }
        console.log('🔍 [DEBUG] Audio upload successful:', audioUrlValue);
      }

      // Insert into database using new API route with rate limiting
      console.log('🔍 [DEBUG] Submitting to API...');
      const response = await fetch('/api/thoughts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: filteredText,
          audio_url: audioUrlValue,
          lat: location.lat,
          lng: location.lng,
        }),
      });

      console.log('🔍 [DEBUG] API response status:', response.status);
      const result = await response.json();
      console.log('🔍 [DEBUG] API response:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit thought');
      }

      const { data: insertedThought } = result;

      if (!insertedThought) {
        throw new Error('Failed to insert thought');
      }

      console.log('🔍 [DEBUG] Thought submitted successfully:', insertedThought);
      setSubmitSuccess(true);
      reset();
      setAudioBlob(null);
      setAudioUrl(null);
      deleteRecording();
      setFilteredText('');
      setShowProfanityWarning(false);

      if (onSubmit) {
        onSubmit({ text: filteredText, audio_url: audioUrlValue || undefined, lat: location.lat, lng: location.lng });
      }

      // Fire-and-forget mood tagging
      tagThoughtMoodAsync(insertedThought.id, filteredText);

      // Reset success message after 3 seconds
      setTimeout(() => setSubmitSuccess(false), 3000);

    } catch (error) {
      console.error('🔍 [DEBUG] Error submitting thought:', error);
      const errorType = error instanceof Error ? error.constructor.name : 'Unknown';
      console.error('🔍 [DEBUG] Error type:', errorType);
      console.error('🔍 [DEBUG] Error details:', error);
      setSubmitError('Failed to submit thought. Please try again.');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-auto border border-gray-100">
      <div className="flex items-center mb-6">
        <div className="w-3 h-3 bg-blue-500 rounded-full mr-3 animate-pulse"></div>
        <h2 className="text-2xl font-bold text-gray-900">Share a Thought</h2>
      </div>
      
      {/* Success/Error Messages */}
      <div className="space-y-3 mb-6">
        {submitSuccess && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-green-800 font-medium">Thought submitted successfully!</span>
          </div>
        )}

        {submitError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-800 font-medium">{submitError}</span>
          </div>
        )}

        {locationError && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center space-x-2">
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-yellow-800 font-medium">{locationError}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
        {/* Text Input */}
        <div>
          <label htmlFor="text" className="block text-sm font-semibold text-gray-700 mb-2">
            Your thought (max 200 characters)
          </label>
          <div className="relative">
            <textarea
              id="text"
              {...register('text')}
              onChange={onTextChange}
              className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none ${
                showProfanityWarning
                  ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-200 hover:border-gray-300 focus:border-blue-500 focus:ring-blue-500'
              }`}
              rows={4}
              placeholder="What's on your mind? Share your thoughts anonymously..."
              maxLength={200}
            />
            {/* Character counter */}
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 bg-white/80 px-2 py-1 rounded">
              {getValues('text')?.length || 0}/200
            </div>
          </div>
          
          {/* Error messages */}
          <div className="mt-2 space-y-1">
            {errors.text && (
              <p className="text-sm text-red-600 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {errors.text.message}
              </p>
            )}
            {profanityError && (
              <p className="text-sm text-red-600 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {profanityError}
              </p>
            )}
          </div>

          {/* Profanity warning */}
          {showProfanityWarning && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm text-yellow-800 font-medium">
                    Inappropriate language detected
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Please modify your thought to continue.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Audio Recording Section */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Optional Audio Recording (10 seconds max)
          </label>
          
          <div className="space-y-3">
            {/* Recording Controls */}
            <div className="flex items-center space-x-3">
              {!isRecording && !audioBlob && (
                <button
                  type="button"
                  onClick={startRecording}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 shadow-md"
                  disabled={isRecording}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  <span>Record Audio</span>
                </button>
              )}
              
              {isRecording && (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200 transform hover:scale-105 shadow-md"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  <span>Stop Recording</span>
                </button>
              )}
              
              {audioBlob && (
                <button
                  type="button"
                  onClick={deleteRecording}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 transform hover:scale-105 shadow-md"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Delete</span>
                </button>
              )}
            </div>

            {/* Recording Status */}
            {isRecording && (
              <div className="flex items-center space-x-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">Recording in progress</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="flex-1 bg-red-200 rounded-full h-2">
                      <div
                        className="bg-red-500 h-2 rounded-full transition-all duration-1000"
                        style={{ width: `${(recordingTime / 10) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-red-700 font-medium">{recordingTime}s / 10s</span>
                  </div>
                </div>
              </div>
            )}

            {/* Audio Player */}
            {audioUrl && !isRecording && (
              <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Audio Recording</span>
                </div>
                <audio controls className="w-full h-10">
                  <source src={audioUrl} type="audio/webm" />
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isValid || !location || isRecording || isUploading || showProfanityWarning}
          className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
        >
          {isUploading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Uploading...</span>
            </>
          ) : showProfanityWarning ? (
            <span>Please fix inappropriate content</span>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <span>Submit Thought</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}