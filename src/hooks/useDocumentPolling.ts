'use client';

import { useState, useEffect, useRef } from 'react';

type DocumentStatus = 'uploading' | 'processing' | 'ready' | 'failed' | null;

export function useDocumentPolling(documentId: string) {
  const [status, setStatus] = useState<DocumentStatus>(null);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!documentId) return;

    const pollDocument = async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch document status');
        }

        const data = await response.json();
        setStatus(data.status);
        setIsLoading(false);

        if (data.status === 'ready' || data.status === 'failed') {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } catch (error) {
        console.error('Error polling document:', error);
        setIsLoading(false);
      }
    };

    pollDocument();

    intervalRef.current = setInterval(pollDocument, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [documentId]);

  return { status, isLoading };
}

