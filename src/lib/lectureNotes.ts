import type { SummaryLength } from '../types/lecture';
import {
  processTranscript,
  getMarkdownForLength,
} from './lectureEngine/summarize';
import type { LectureProcessedResult } from './lectureEngine/types';

export type { LectureProcessedResult };

export function runLecturePipeline(
  rawTranscript: string,
): LectureProcessedResult | null {
  return processTranscript({ rawTranscript });
}

export function renderLectureNotes(
  result: LectureProcessedResult,
  length: SummaryLength,
): string {
  return getMarkdownForLength(result, length);
}
