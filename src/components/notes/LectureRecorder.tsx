import { useCallback, useMemo } from 'react';
import {
  Mic,
  Square,
  ChevronUp,
  ChevronDown,
  Loader2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useLectureRecorder } from '../../hooks/useLectureRecorder';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

export interface LectureRecorderProps {
  content: string;
  onContentChange: (next: string) => void;
  onTitleSuggestion?: (title: string) => void;
  disabled?: boolean;
}

const LECTURE_MARKER = '<!-- lecture-auto -->\n';

function withLectureSection(base: string, lectureSection: string): string {
  const trimmedBase = stripLectureSection(base);
  const trimmedLecture = lectureSection.trim();
  if (!trimmedLecture) return trimmedBase;
  return trimmedBase
    ? `${trimmedBase}\n\n${LECTURE_MARKER}${trimmedLecture}`
    : `${LECTURE_MARKER}${trimmedLecture}`;
}

function stripLectureSection(content: string): string {
  const idx = content.indexOf('<!-- lecture-auto -->');
  if (idx >= 0) return content.slice(0, idx).trim();
  // Legacy: older notes used ## Lecture notes header
  const legacy = content.split(/## Lecture notes/i);
  return legacy[0]?.trim() ?? content.trim();
}

export function LectureRecorder({
  content,
  onContentChange,
  onTitleSuggestion,
  disabled,
}: LectureRecorderProps) {
  const baseContent = useMemo(() => stripLectureSection(content), [content]);

  const handleNotesUpdate = useCallback(
    (lectureSection: string) => {
      onContentChange(withLectureSection(baseContent, lectureSection));
    },
    [baseContent, onContentChange],
  );

  const recorder = useLectureRecorder({
    baseContent,
    onNotesUpdate: handleNotesUpdate,
    onTitleSuggestion,
  });

  const statusLabel = useMemo(() => {
    switch (recorder.status) {
      case 'listening':
        return 'Listening';
      case 'processing':
        return 'Processing';
      case 'error':
        return recorder.speechError ?? 'Error';
      default:
        return recorder.hasProcessed ? 'Done' : 'Ready';
    }
  }, [recorder]);

  const canStart =
    !disabled &&
    recorder.speechSupported &&
    !recorder.recording &&
    recorder.status !== 'processing';

  const showTranscriptPanel =
    recorder.recording || recorder.liveTranscript || recorder.cleanedPreview;

  return (
    <>
      {/* Collapsible transcript drawer — collapsed by default */}
      {showTranscriptPanel && recorder.showTranscript && (
        <div className="border-t border-border bg-surface-2/80 max-h-28 overflow-y-auto px-4 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-text-subtle mb-1">
            {recorder.recording ? 'Live transcript' : 'Cleaned transcript'}
          </p>
          <p className="text-[12.5px] leading-relaxed text-text-muted whitespace-pre-wrap">
            {recorder.recording ? (
              <>
                {recorder.liveTranscript || (
                  <span className="italic text-text-subtle">Waiting for speech…</span>
                )}
                {recorder.interimTranscript && (
                  <span className="text-text-subtle"> {recorder.interimTranscript}</span>
                )}
              </>
            ) : (
              recorder.cleanedPreview ?? recorder.liveTranscript
            )}
          </p>
        </div>
      )}

      {/* Slim sticky footer bar */}
      <div className="flex items-center gap-2 border-t border-border bg-surface-2/90 px-4 py-1.5 backdrop-blur">
        {recorder.recording ? (
          <Button
            variant="danger"
            size="sm"
            onClick={recorder.stopRecording}
            leadingIcon={<Square size={11} fill="currentColor" />}
            className="h-7"
          >
            Stop
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            disabled={!canStart}
            onClick={recorder.startRecording}
            leadingIcon={<Mic size={13} />}
            className="h-7"
            aria-label="Record lecture"
          >
            Record
          </Button>
        )}

        {/* "Turn into notes" — appears once a transcript is ready */}
        {recorder.transcript && !recorder.recording && (
          <Button
            variant="secondary"
            size="sm"
            disabled={recorder.summarizing}
            onClick={recorder.turnIntoNotes}
            leadingIcon={
              recorder.summarizing ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Sparkles size={13} />
              )
            }
            className="h-7"
            aria-label="Turn transcript into notes"
          >
            {recorder.summarizing ? 'Summarising…' : 'Turn into notes'}
          </Button>
        )}

        <div className="flex items-center gap-1.5 text-[11px] text-text-muted min-w-0">
          {(recorder.status === 'listening' || recorder.status === 'processing') && (
            <Loader2 size={11} className="animate-spin text-accent shrink-0" />
          )}
          {recorder.status === 'error' && (
            <AlertCircle size={11} className="text-danger shrink-0" />
          )}
          <span
            className={cn(
              'truncate',
              recorder.status === 'listening' && 'text-success',
              recorder.status === 'processing' && 'text-accent',
              recorder.status === 'error' && 'text-danger',
            )}
          >
            {statusLabel}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1">
          {showTranscriptPanel && (
            <button
              type="button"
              onClick={() => recorder.setShowTranscript((v) => !v)}
              className="inline-flex h-7 items-center gap-1 rounded-[8px] px-2 text-[11px] text-text-muted hover:bg-surface hover:text-text transition-colors"
              aria-expanded={recorder.showTranscript}
            >
              Transcript
              {recorder.showTranscript ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronUp size={12} />
              )}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
