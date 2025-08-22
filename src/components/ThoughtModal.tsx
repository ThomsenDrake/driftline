'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ReportModal from './ReportModal';

interface Thought {
  id: string;
  text: string;
  audio_url?: string;
  lat: number;
  lng: number;
  created_at: string;
}

interface ThoughtModalProps {
  thought: Thought | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ThoughtModal({ thought, isOpen, onClose }: ThoughtModalProps) {
  const [showReportModal, setShowReportModal] = useState(false);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        setShowReportModal(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Handle click outside modal to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen || !thought) {
    return null;
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      {createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
          onClick={handleBackdropClick}
        >
          <div
            className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 z-10 p-2.5 rounded-full hover:bg-white/70 transition-all duration-200 hover:scale-105"
              aria-label="Close"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Modal content */}
            <div className="p-8">
          {/* Thought text */}
          <div className="mb-8">
            <div className="flex items-center mb-4">
              <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mr-3 animate-pulse"></div>
              <h2 className="text-xl font-bold text-gray-900">Anonymous Thought</h2>
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-gray-800 leading-relaxed font-medium text-lg">
                "{thought.text}"
              </p>
            </div>
          </div>

          {/* Audio player */}
          {thought.audio_url && (
            <div className="mb-8">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <h3 className="text-sm font-medium text-gray-700 flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Audio Recording</span>
                </h3>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <audio controls className="w-full h-12">
                  <source src={thought.audio_url} type="audio/webm" />
                  Your browser does not support the audio element.
                </audio>
              </div>
            </div>
          )}

          {/* Location and timestamp */}
          <div className="border-t border-gray-100 pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Location</span>
                <span className="text-gray-500">{thought.lat.toFixed(4)}, {thought.lng.toFixed(4)}</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Shared</span>
                <span className="text-gray-500">{formatTime(thought.created_at)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-6 border-t border-gray-100">
          <div className="space-y-3">
            <button
              onClick={() => setShowReportModal(true)}
              className="w-full px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 shadow-lg flex items-center justify-center font-medium"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Report Content
            </button>
            <button
              onClick={onClose}
              className="w-full px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 shadow-lg font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )}

      {thought && showReportModal && (
        <ReportModal
          thoughtId={thought.id}
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </>
  );
}