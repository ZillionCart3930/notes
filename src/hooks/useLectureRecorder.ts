import { useCallback, useEffect, useRef, useState } from 'react';
import type { LectureRecorderStatus } from '../types/lecture';
import {
  runLecturePipeline,
  renderLectureNotes,
  type LectureProcessedResult,
} from '../lib/lectureNotes';
import { useSpeechRecognition } from './useSpeechRecognition';

const TRANSCRIBE_AUDIO_API_URL = '/api/transcribe-audio';
const NOTES_API_URL = '/api/notes';

function extractTitleFromMarkdown(markdown: string): string | null {
  const match = markdown.match(/^#\s+(?:Lecture Notes:\s*)?(.+)$/m);
  return match ? match[1].trim() : null;
}

/** Uploads the recorded audio blob to the local whisper.cpp pipeline. */
async function requestWhisperTranscript(audio: Blob): Promise<string | null> {
  try {
    const form = new FormData();
    form.append('audio', audio, 'lecture.webm');
    const response = await fetch(TRANSCRIBE_AUDIO_API_URL, {
      method: 'POST',
      body: form,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      success?: boolean;
      transcript?: string;
    };
    const transcript = payload?.transcript?.trim();
    return transcript ? transcript : null;
  } catch {
    return null;
  }
}

/** "Turn into notes": sends the transcript to the OpenRouter notes endpoint. */
async function requestNotesFromTranscript(
  transcript: string,
): Promise<string | null> {
  try {
    const response = await fetch(NOTES_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      success?: boolean;
      notes?: string;
    };
    const notes = payload?.notes?.trim();
    return notes ? notes : null;
  } catch {
    return null;
  }
}

/** Picks the best supported MediaRecorder mime type for this browser. */
function pickRecorderMimeType(): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  if (typeof MediaRecorder === 'undefined') return undefined;
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export interface UseLectureRecorderOptions {
  baseContent: string;
  onNotesUpdate: (lectureSection: string) => void;
  onTitleSuggestion?: (title: string) => void;
}

export function useLectureRecorder({
  baseContent,
  onNotesUpdate,
  onTitleSuggestion,
}: UseLectureRecorderOptions) {
  const speech = useSpeechRecognition();
  const [status, setStatus] = useState<LectureRecorderStatus>('idle');
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(false);

  const baseContentRef = useRef(baseContent);
  baseContentRef.current = baseContent;

  // MediaRecorder state for capturing the raw audio blob.
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const stopMediaTracks = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    speech.reset();
    setTranscript(null);
    setHasProcessed(false);
    setShowTranscript(false);
    audioChunksRef.current = [];

    // Capture real audio for the whisper.cpp pipeline.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = pickRecorderMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.start(1000); // gather data every second
      mediaRecorderRef.current = recorder;
    } catch {
      // Mic permission denied or MediaRecorder unsupported — fall back to
      // browser speech recognition only.
      mediaRecorderRef.current = null;
    }

    // Also run browser speech recognition for the live transcript preview
    // and as a fallback transcript source if whisper.cpp is offline.
    if (speech.supported) speech.start();

    if (!mediaRecorderRef.current && !speech.supported) {
      setStatus('error');
      return;
    }
    setStatus('listening');
  }, [speech]);

  const stopRecording = useCallback(async () => {
    const speechTranscript = speech.stop() || speech.getTranscriptSnapshot();

    // Finalize the audio recording into a single blob.
    let audioBlob: Blob | null = null;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      audioBlob = await new Promise<Blob | null>((resolve) => {
        recorder.onstop = () => {
          const chunks = audioChunksRef.current;
          resolve(
            chunks.length
              ? new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
              : null,
          );
        };
        recorder.stop();
      });
    }
    mediaRecorderRef.current = null;
    stopMediaTracks();

    setStatus('processing');
    try {
      // Prefer the local whisper.cpp transcription of the real audio.
      let finalTranscript: string | null = null;
      if (audioBlob && audioBlob.size > 0) {
        finalTranscript = await requestWhisperTranscript(audioBlob);
      }
      // Fallback: browser speech recognition transcript.
      if (!finalTranscript && speechTranscript.trim()) {
        finalTranscript = speechTranscript.trim();
      }

      if (!finalTranscript) {
        setStatus('idle');
        return;
      }

      setTranscript(finalTranscript);
      setShowTranscript(true);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }, [speech, stopMediaTracks]);

  /**
   * "Turn into notes" — sends the captured transcript to the OpenRouter
   * notes endpoint and inserts the formatted result into the editor.
   * Falls back to the local summarizer if the API is unreachable.
   */
  const turnIntoNotes = useCallback(async () => {
    if (!transcript || summarizing) return;

    setSummarizing(true);
    setStatus('processing');
    try {
      const notes = await requestNotesFromTranscript(transcript);
      if (notes) {
        onNotesUpdate(notes);
        const title = extractTitleFromMarkdown(notes);
        if (title) onTitleSuggestion?.(title);
        setHasProcessed(true);
      } else {
        // Offline fallback: local extractive summarizer (compact tier so it
        // reads as a summary, not a transcript dump).
        const localResult: LectureProcessedResult | null =
          runLecturePipeline(transcript);
        if (localResult) {
          onNotesUpdate(renderLectureNotes(localResult, 'small'));
          if (localResult.title) onTitleSuggestion?.(localResult.title);
          setHasProcessed(true);
        }
      }
      setStatus('idle');
    } catch {
      setStatus('error');
    } finally {
      setSummarizing(false);
    }
  }, [transcript, summarizing, onNotesUpdate, onTitleSuggestion]);

  useEffect(() => {
    if (speech.error && !mediaRecorderRef.current) setStatus('error');
  }, [speech.error]);

  // Release the microphone if the component unmounts mid-recording.
  useEffect(() => stopMediaTracks, [stopMediaTracks]);

  return {
    recording: status === 'listening',
    status,
    showTranscript,
    setShowTranscript,
    hasProcessed,
    transcript,
    summarizing,
    turnIntoNotes,
    liveTranscript: speech.fullTranscript,
    interimTranscript: speech.interimTranscript,
    cleanedPreview: transcript,
    speechSupported: speech.supported || typeof MediaRecorder !== 'undefined',
    speechError: speech.error,
    startRecording,
    stopRecording,
  };
}
