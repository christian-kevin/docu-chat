'use client';

import { useState, useRef } from 'react';

interface MessageInputProps {
  onSend: (content: string) => void;
  onDocumentUpload: (file: File) => void;
  disabled?: boolean;
  isUploading?: boolean;
  isProcessing?: boolean;
  hasReadyDocuments?: boolean;
}

export function MessageInput({ onSend, onDocumentUpload, disabled, isUploading: isUploadingProp, isProcessing, hasReadyDocuments }: MessageInputProps) {
  const [input, setInput] = useState('');
  const [isUploadingLocal, setIsUploadingLocal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isUploadingState = isUploadingProp || isUploadingLocal;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input);
      setInput('');
    }
  };

  const handleFileSelect = async (file: File) => {
    setIsUploadingLocal(true);
    try {
      await onDocumentUpload(file);
    } finally {
      setIsUploadingLocal(false);
    }
  };

  return (
    <div className="border-t border-gray-800 p-4">
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploadingState || disabled || isProcessing}
          className="p-2 text-gray-400 hover:text-gray-300 disabled:opacity-50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
            e.target.value = '';
          }}
          className="hidden"
        />

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={hasReadyDocuments === false ? "Upload a document first..." : "Type your message..."}
          disabled={disabled || isUploadingState || isProcessing || hasReadyDocuments === false}
          className="flex-1 bg-gray-800 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        />

        <button
          type="submit"
          disabled={!input.trim() || isUploadingState || disabled || isProcessing || hasReadyDocuments === false}
          className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>

      <p className="text-xs text-gray-500 mt-2 text-center">
        {isUploadingState && "Uploading document..."}
        {isProcessing && !isUploadingState && "Processing document..."}
        {!isUploadingState && !isProcessing && "Supports PDF and CSV files • Drag & drop or click to upload"}
      </p>
    </div>
  );
}

