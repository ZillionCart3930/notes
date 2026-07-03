import type { SummaryLength } from '../../types/lecture';
import type { RankedSentence, SentenceCluster } from './tfidf';

export interface LectureProcessedResult {
  title: string;
  cleanedText: string;
  ranked: RankedSentence[];
  tiers: Record<SummaryLength, RankedSentence[]>;
  clusters: Record<SummaryLength, SentenceCluster[]>;
  markdown: Record<SummaryLength, string>;
}

export interface ProcessTranscriptOptions {
  rawTranscript: string;
}
