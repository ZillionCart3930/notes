export function isSpeechRecognitionSupported(): boolean {
  return !!(
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)
  );
}

export function createSpeechRecognition(): SpeechRecognition | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = navigator.language || 'en-US';
  recognition.maxAlternatives = 1;
  return recognition;
}
