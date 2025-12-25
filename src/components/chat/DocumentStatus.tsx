'use client';

import { useState } from 'react';
import { useDocumentPolling } from '@/hooks/useDocumentPolling';

interface DocumentStatusProps {
  documentId: string;
  filename: string;
}

export function DocumentStatus({ documentId, filename }: DocumentStatusProps) {
  const { status, isLoading } = useDocumentPolling(documentId);
  const [isMarkingFailed, setIsMarkingFailed] = useState(false);

  const handleForceFail = async () => {
    if (!confirm('Are you sure you want to mark this document as failed?')) {
      return;
    }

    setIsMarkingFailed(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/fail`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to mark document as failed');
      }

      window.location.reload();
    } catch (error) {
      console.error('Failed to mark document as failed:', error);
      alert('Failed to mark document as failed');
    } finally {
      setIsMarkingFailed(false);
    }
  };

  const getStatusIcon = () => {
    if (isLoading) {
      return (
        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    }

    if (status === 'ready') {
      return (
        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    }

    if (status === 'failed') {
      return (
        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    }

    return null;
  };

  const getStatusText = () => {
    if (isLoading) return 'Processing...';
    if (status === 'ready') return 'Ready';
    if (status === 'failed') return 'Failed';
    if (status === 'processing') return 'Processing...';
    if (status === 'uploading') return 'Uploading...';
    return 'Unknown';
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm">
        {getStatusIcon()}
        <span className="text-gray-400">{filename}</span>
        <span className="text-gray-500">•</span>
        <span className="text-gray-400">{getStatusText()}</span>
      </div>
      {(status === 'processing' || isLoading) && (
        <button
          onClick={handleForceFail}
          disabled={isMarkingFailed}
          className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 px-2 py-1"
          title="Mark as failed"
        >
          {isMarkingFailed ? 'Marking...' : 'Force Fail'}
        </button>
      )}
    </div>
  );
}

