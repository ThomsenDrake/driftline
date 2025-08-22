'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';

interface ReportModalProps {
  thoughtId: string;
  isOpen: boolean;
  onClose: () => void;
}

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam or unwanted content' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate-speech', label: 'Hate speech or discrimination' },
  { value: 'violence', label: 'Violent or threatening content' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'other', label: 'Other (please specify)' },
];

export default function ReportModal({ thoughtId, isOpen, onClose }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedReason) {
      setSubmitError('Please select a reason for reporting');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          thoughtId,
          reason: selectedReason,
          details: selectedReason === 'other' ? details : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit report');
      }

      setSubmitSuccess(true);
      setTimeout(() => {
        onClose();
        setSubmitSuccess(false);
        setSelectedReason('');
        setDetails('');
      }, 2000);

    } catch (error) {
      console.error('Error submitting report:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div 
        className="relative bg-white rounded-lg shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
          aria-label="Close"
        >
          <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Modal content */}
        <div className="p-6">
          <div className="flex items-center mb-4">
            <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
            <h2 className="text-xl font-semibold text-gray-800">Report Content</h2>
          </div>

          <p className="text-gray-600 mb-6">
            Help us maintain a safe community by reporting inappropriate content. 
            All reports are reviewed by our moderation team.
          </p>

          {submitSuccess ? (
            <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
              Report submitted successfully! Thank you for helping keep our community safe.
            </div>
          ) : submitError ? (
            <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {submitError}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for reporting *
              </label>
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                disabled={isSubmitting}
              >
                <option value="">Select a reason</option>
                {REPORT_REASONS.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </div>

            {selectedReason === 'other' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Please provide details
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  rows={3}
                  placeholder="Please provide more details about your report..."
                  disabled={isSubmitting}
                />
              </div>
            )}

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !selectedReason}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}