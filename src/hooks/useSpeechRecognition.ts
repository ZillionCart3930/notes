import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
} from '../lib/speechRecognition';

export interface UseSpeechRecognitionResult {
  supported: boolean;
  listening: boolean;
  interimTranscript: string;
  finalTranscript: string;
  fullTranscript: string;
  error: string | null;
  start: () => void;
  stop: () => string;
  reset: () => void;
  getTranscriptSnapshot: () => string;
}

export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const supported = isSpeechRecognitionSupported();
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldListenRef = useRef(false);

  const [listening, setListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const finalRef = useRef('');
  const interimRef = useRef('');

  const fullTranscript = finalTranscript
    ? interimTranscript
      ? `${finalTranscript} ${interimTranscript}`.trim()
      : finalTranscript.trim()
    : interimTranscript.trim();

  const getTranscriptSnapshot = useCallback(() => {
    const finals = finalRef.current.trim();
    const interim = interimRef.current.trim();
    return finals && interim ? `${finals} ${interim}` : finals || interim;
  }, []);

  const attachHandlers = useCallback((recognition: SpeechRecognition) => {
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let finals = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) finals += text;
        else interim += text;
      }
      if (finals) {
        const next = `${finalRef.current}${finals}`.trim() + ' ';
        finalRef.current = next;
        setFinalTranscript(next);
        interimRef.current = '';
        setInterimTranscript('');
      } else {
        interimRef.current = interim;
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return;
      setError(event.error === 'not-allowed' ? 'Microphone access denied' : event.message || event.error);
    };

    recognition.onend = () => {
      if (shouldListenRef.current) {
        try {
          recognition.start();
        } catch {
          setListening(false);
          shouldListenRef.current = false;
        }
        return;
      }
      setListening(false);
    };
  }, []);

  const start = useCallback(() => {
    if (!supported) {
      setError('Speech recognition is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    setError(null);
    shouldListenRef.current = true;

    let recognition = recognitionRef.current;
    if (!recognition) {
      recognition = createSpeechRecognition();
      if (!recognition) {
        setError('Could not start speech recognition.');
        shouldListenRef.current = false;
        return;
      }
      recognitionRef.current = recognition;
      attachHandlers(recognition);
    }

    try {
      recognition.start();
      setListening(true);
    } catch {
      // Already started — ignore
      setListening(true);
    }
  }, [supported, attachHandlers]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    const snapshot = getTranscriptSnapshot();
    recognitionRef.current?.stop();
    setListening(false);
    interimRef.current = '';
    setInterimTranscript('');
    return snapshot;
  }, [getTranscriptSnapshot]);

  const reset = useCallback(() => {
    finalRef.current = '';
    interimRef.current = '';
    setFinalTranscript('');
    setInterimTranscript('');
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  return {
    supported,
    listening,
    interimTranscript,
    finalTranscript,
    fullTranscript,
    error,
    start,
    stop,
    reset,
    getTranscriptSnapshot,
  };
}
