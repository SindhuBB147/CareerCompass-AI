'use client';
import { useEffect, useRef, useState } from 'react';

// Web Speech API isn't in the default TS lib — declared loosely here since
// this (plus ChatInput.tsx, which shares this hook) are the only places in
// the app that touch it.
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

interface UseSpeechRecognitionOptions {
  lang?: string;
  onResult: (transcript: string) => void;
}

/**
 * Browser-only voice input (no server-side STT) — shared by the AI
 * Counsellor's ChatInput and the Smart Search bar, both of which just need
 * "listen, hand back a transcript, use the same text pipeline as typing."
 */
export function useSpeechRecognition({ lang = 'en-IN', onResult }: UseSpeechRecognitionOptions) {
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  // Checked only after mount — `window` is unavailable during SSR, and
  // branching the render tree on `typeof window` directly causes a
  // server/client markup mismatch (the mic button would appear or vanish
  // between the server-rendered and hydrated DOM).
  useEffect(() => {
    setSpeechSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  const toggleListening = () => {
    if (!speechSupported) return;

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new RecognitionCtor();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) onResultRef.current(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  return { listening, speechSupported, toggleListening };
}
