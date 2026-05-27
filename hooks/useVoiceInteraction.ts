'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Define window extensions for Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function useVoiceInteraction(onTranscript?: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        
        recognitionRef.current.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              // We could also pass interim results, but final is usually cleaner for inputs
            }
          }
          if (finalTranscript && onTranscript) {
            onTranscript(finalTranscript);
          }
        };

        recognitionRef.current.onstart = () => setIsListening(true);
        recognitionRef.current.onend = () => setIsListening(false);
        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          setIsListening(false);
        };
      } else {
        console.warn('Speech Recognition API is not supported in this browser.');
      }

      synthesisRef.current = window.speechSynthesis;
    }
    
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      if (synthesisRef.current) {
        synthesisRef.current.cancel();
      }
    };
  }, [onTranscript]);

  const startListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Handle case where it might already be started
        console.error(e);
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (synthesisRef.current) {
      synthesisRef.current.cancel(); // Cancel any ongoing speech
      
      // Basic cleaning for TTS (remove markdown asterisks, hashes, etc.)
      const cleanText = text
        .replace(/```[\s\S]*?```/g, 'code block')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
        .replace(/#{1,6}\s/g, '')
        .replace(/[*_~]/g, '')
        .replace(/^\s*[-•]\s/gm, '')
        .replace(/\[Interrupted\]/g, '')
        .replace(/===METADATA===[^]*/g, '')
        .replace(/\n{2,}/g, '. ')
        .replace(/\n/g, ' ')
        .trim();
      
      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      
      // Try to find a good English voice
      const voices = synthesisRef.current.getVoices();
      const preferredVoice = voices.find(v => v.lang.startsWith('en-') && v.name.includes('Google')) || voices[0];
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      synthesisRef.current.speak(utterance);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
      setIsSpeaking(false);
    }
  }, []);

  return {
    isListening,
    startListening,
    stopListening,
    isSpeaking,
    speak,
    stopSpeaking,
    isSpeechSupported: typeof window !== 'undefined' && (
      'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
    ),
    isSynthesisSupported: typeof window !== 'undefined' && 'speechSynthesis' in window,
  };
}
