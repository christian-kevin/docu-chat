'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatInterface } from '@/components/chat/ChatInterface';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-900">
      <ChatInterface />
    </div>
  );
}

