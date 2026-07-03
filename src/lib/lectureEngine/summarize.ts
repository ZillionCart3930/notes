import type { SummaryLength } from '../../types/lecture';
import { processRawTranscript } from './textProcessor';
import type { LectureProcessedResult, ProcessTranscriptOptions } from './types';

interface RankedSentence {
  text: string;
  index: number;
  score: number;
  terms: string[];
  roles: Record<string, number>;
  primaryRole: string | null;
}

interface SentenceCluster {
  header: RankedSentence;
  bullets: RankedSentence[];
}

const STOP_WORDS = new Set([
  'i', 'me', 'my', 'mine', 'you', 'your', 'yours', 'he', 'him', 'his',
  'she', 'her', 'hers', 'we', 'us', 'our', 'ours', 'they', 'them', 'their',
  'theirs', 'it', 'its', 'this', 'that', 'these', 'those',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'must', 'shall', 'can', 'am', 'and', 'but', 'or', 'because', 'so', 'yet',
  'for', 'nor', 'although', 'while', 'when', 'if', 'then', 'there', 'here',
  'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just',
  'about', 'up', 'out', 'in', 'on', 'at', 'by', 'from', 'with', 'as', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'under',
  'wanna', 'somehow', 'stuff', 'like', 'basically', 'literally', 'okay',
  'right', 'um', 'uh', 'er', 'ah', 'hmm', 'so', 'also', 'well', 'the', 'a',
  'an', 'to', 'of', 'that', 'this', 'these', 'those', 'which', 'who', 'whom',
]);

const KNOWN_ABBREVIATIONS = new Set(['vs', 'etc', 'e.g', 'i.e', 'mr', 'mrs', 'dr', 'prof', 'inc', 'st']);

const ROLE_PATTERNS = {
  concept: {
    regex: /\b(is|means|refers to|defined as|is a type of|specifically|essentially)\b/i,
    weight: 1.5,
  },
  mechanism: {
    regex: /\b(because|causes|leads to|triggers|binds to|slows down|accelerates|blocks|stops|interacts|creates|results in|how this works)\b/i,
    weight: 1.3,
  },
  evidence: {
    regex: /\b(\d+|percent|%|times stronger|fold|statistics|years|scale|lethal dose|compared to|data)\b/i,
    weight: 1.4,
  },
  takeaway: {
    regex: /\b(so|therefore|must|crucial to|remember|always|never|stay safe|be aware|keep in mind|the takeaway)\b/i,
    weight: 1.6,
  },
};

function safeString(text: string | null | undefined): string {
  return typeof text === 'string' ? text.trim() : '';
}

function sanitizeTranscript(raw: string): string {
  if (!raw) return '';

  let text = raw.replace(/[\r\n\t]+/g, ' ');
  text = text.replace(/\.{2,}/g, '.');
  text = text.replace(/,{2,}/g, ',');
  text = text.replace(/\s*([.,!?])\s*/g, '$1 ');
  text = text.replace(/(\.|,)\s*\./g, '.');
  text = text.replace(/(\.|,)\s*,/g, ',');
  text = text.replace(/\s{2,}/g, ' ');
  text = text.replace(/\b(and|with|so|just|like|um|uh|er|ah)\s*([.!?])/gi, '$2');
  text = text.replace(/\b([A-Za-z]{1,10})\.\s+([a-z])/g, (_match, subject, next) => {
    if (KNOWN_ABBREVIATIONS.has(subject.toLowerCase())) {
      return `${subject}. ${next}`;
    }
    return `${subject}, ${next}`;
  });
  text = text.replace(/\s+/g, ' ').trim();
  text = text.replace(/\s+([.,!?])/g, '$1');
  return text.trim();
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeToken(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function selectContentWords(text: string): string[] {
  return normalizeToken(text).filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function splitSentencesMicro(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const matches = cleaned.match(/[^.!?]+[.!?]+/g);
  return matches ? matches.map((part) => part.trim()).filter(Boolean) : [cleaned];
}

function splitSentencesByPunctuation(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const matches = cleaned.match(/[^.!?]+[.!?]*/g) ?? [];
  return matches.map((sentence) => sentence.trim()).filter(Boolean);
}

function buildWindowBlocks(sentences: string[]): string[][] {
  const windows: string[][] = [];
  let current: string[] = [];
  let currentCount = 0;

  for (const sentence of sentences) {
    const sentenceWords = countWords(sentence);
    if (currentCount >= 750 && current.length > 0) {
      windows.push(current);
      current = [];
      currentCount = 0;
    }
    current.push(sentence);
    currentCount += sentenceWords;
  }

  if (current.length > 0) {
    windows.push(current);
  }

  return windows;
}

function hasSubjectInFirstFour(sentence: string): boolean {
  const tokens = normalizeToken(sentence).slice(0, 4);
  return tokens.some((token) => !STOP_WORDS.has(token));
}

function isEvidenceSentence(sentence: string): boolean {
  return /\d|percent|%|times stronger|fold|statistics|years|scale|lethal dose|compared to|data/i.test(sentence);
}

function scoreSentence(
  sentence: string,
  globalIndex: number,
  windowPosition: number,
  windowSize: number,
): RankedSentence {
  const roleScores: Record<string, number> = {
    concept: 0,
    mechanism: 0,
    evidence: 0,
    takeaway: 0,
  };

  if (ROLE_PATTERNS.concept.regex.test(sentence) && hasSubjectInFirstFour(sentence)) {
    roleScores.concept = ROLE_PATTERNS.concept.weight;
  }

  if (ROLE_PATTERNS.mechanism.regex.test(sentence)) {
    roleScores.mechanism = ROLE_PATTERNS.mechanism.weight;
  }

  if (ROLE_PATTERNS.evidence.regex.test(sentence) && isEvidenceSentence(sentence)) {
    roleScores.evidence = ROLE_PATTERNS.evidence.weight;
  }

  if (ROLE_PATTERNS.takeaway.regex.test(sentence)) {
    roleScores.takeaway = ROLE_PATTERNS.takeaway.weight;
    if (windowPosition >= Math.floor(windowSize * 0.75)) {
      roleScores.takeaway *= 1.2;
    }
  }

  const primaryRole = Object.entries(roleScores).reduce<null | string>((best, [role, score]) => {
    if (best === null) return score > 0 ? role : null;
    return score > (roleScores[best] ?? 0) ? role : best;
  }, null);

  const terms = selectContentWords(sentence);
  const baseScore = Object.values(roleScores).reduce((sum, value) => sum + value, 0);
  const lengthBonus = Math.min(1, countWords(sentence) / 20);
  const score = baseScore > 0 ? baseScore + lengthBonus : lengthBonus * 0.5;

  return {
    text: sentence,
    index: globalIndex,
    score,
    terms,
    roles: roleScores,
    primaryRole,
  };
}

function sortChronologically(sentences: RankedSentence[]): RankedSentence[] {
  return [...sentences].sort((a, b) => a.index - b.index);
}

function selectTopByRole(sentences: RankedSentence[], role: keyof typeof ROLE_PATTERNS, count: number): RankedSentence[] {
  return [...sentences]
    .filter((sentence) => sentence.roles[role] > 0)
    .sort((a, b) => b.roles[role] - a.roles[role] || a.index - b.index)
    .slice(0, count);
}

function buildSmallOutput(sentences: RankedSentence[]): string {
  const roles: Array<keyof typeof ROLE_PATTERNS> = ['concept', 'mechanism', 'evidence', 'takeaway'];
  const labels: Record<string, string> = {
    concept: 'Concept',
    mechanism: 'Mechanism',
    evidence: 'Data Point',
    takeaway: 'Takeaway',
  };

  const lines: string[] = [];
  for (const role of roles) {
    const top = selectTopByRole(sentences, role, 1)[0];
    if (top) {
      lines.push(`* **${labels[role]}:** ${top.text}`);
    }
  }

  return lines.join('\n');
}

function buildMediumOutput(sentences: RankedSentence[]): string {
  const roles: Array<keyof typeof ROLE_PATTERNS> = ['concept', 'mechanism', 'evidence', 'takeaway'];
  const selected: RankedSentence[] = [];

  for (const role of roles) {
    selected.push(...selectTopByRole(sentences, role, 2));
  }

  const ordered = sortChronologically(selected);
  const paragraphs: string[] = [];
  const paragraphSize = Math.max(1, Math.ceil(ordered.length / 3));

  for (let i = 0; i < ordered.length; i += paragraphSize) {
    paragraphs.push(ordered.slice(i, i + paragraphSize).map((item) => item.text).join(' '));
  }

  return paragraphs.map((paragraph) => paragraph.trim()).filter(Boolean).join('\n\n');
}

function buildLongOutputMicro(sentences: RankedSentence[]): string {
  const selectionCount = Math.max(1, Math.ceil(sentences.length * 0.5));
  const selected = [...sentences]
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, selectionCount);

  const ordered = sortChronologically(selected);
  const lines: string[] = ordered.map((sentence) => `* ${sentence.text}`);
  return ['### Block 1: Core Lecture Notes', '', ...lines].join('\n');
}

function generateWindowTitle(sentences: string[]): string {
  const keywords = selectContentWords(sentences.join(' '));
  if (keywords.length === 0) return 'Lecture Window';
  const freq: Record<string, number> = {};

  for (const word of keywords) {
    freq[word] = (freq[word] ?? 0) + 1;
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') || 'Lecture Window';
}

function buildLongOutputMacro(sentences: string[]): string {
  const windows = buildWindowBlocks(sentences);
  const sections: string[] = [];
  let globalIndex = 0;

  for (let windowIndex = 0; windowIndex < windows.length; windowIndex += 1) {
    const window = windows[windowIndex];
    const windowSentences = window.map((sentence, sentenceIndex) =>
      scoreSentence(sentence, globalIndex + sentenceIndex, sentenceIndex, window.length),
    );
    globalIndex += window.length;

    const selectionCount = Math.max(1, Math.ceil(windowSentences.length * 0.3));
    const selected = [...windowSentences]
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, selectionCount);

    const ordered = sortChronologically(selected);
    const title = `### Block ${windowIndex + 1}: ${generateWindowTitle(window)}`;

    const conceptLines = ordered
      .filter((item) => item.roles.concept > 0)
      .map((item) => `* **Core Concept:** ${item.text}`);
    const mechanismLines = ordered
      .filter((item) => item.roles.mechanism > 0)
      .map((item) => `* **How it Works:** ${item.text}`);
    const evidenceLines = ordered
      .filter((item) => item.roles.evidence > 0)
      .map((item) => `* **Key Data & Examples:** ${item.text}`);
    const takeawayLines = ordered
      .filter((item) => item.roles.takeaway > 0)
      .map((item) => `* **Summary Rule:** ${item.text}`);

    const sectionLines = [title];
    if (conceptLines.length) sectionLines.push('', ...conceptLines);
    if (mechanismLines.length) sectionLines.push('', ...mechanismLines);
    if (evidenceLines.length) sectionLines.push('', ...evidenceLines);
    if (takeawayLines.length) sectionLines.push('', ...takeawayLines);

    sections.push(sectionLines.join('\n'));
  }

  return sections.join('\n\n');
}

function fallbackOutput(cleanedText: string): { small: string; medium: string; long: string } {
  const fallbackText = `### Core Summary\n\n${cleanedText}\n\n### Important Note\n* Review the full transcript above for complete context.`;
  return { small: fallbackText, medium: fallbackText, long: fallbackText };
}

function buildClusters(sentences: RankedSentence[]): SentenceCluster[] {
  const ordered = sortChronologically(sentences);
  if (ordered.length === 0) return [];

  const clusters: RankedSentence[][] = [];
  let current: RankedSentence[] = [ordered[0]];

  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1];
    const next = ordered[i];
    const gap = next.index - previous.index;
    if (gap > 5) {
      clusters.push(current);
      current = [next];
    } else {
      current.push(next);
    }
  }
  clusters.push(current);

  return clusters.map((group) => {
    const header = group.reduce((best, item) => (item.score >= best.score ? item : best), group[0]);
    const bullets = group.filter((item) => item !== header);
    return { header, bullets };
  });
}

function buildMarkdown(title: string, body: string): string {
  return [`## ${title}`, '', body].join('\n');
}

export function processTranscript(
  opts: ProcessTranscriptOptions,
): LectureProcessedResult | null {
  const raw = safeString(opts.rawTranscript);
  if (!raw) return null;

  const sanitized = sanitizeTranscript(raw);
  const cleanedText = processRawTranscript(sanitized);
  const totalWords = countWords(cleanedText);
  if (totalWords === 0) return null;

  const microMode = totalWords < 500;
  const rawSentences = microMode
    ? splitSentencesMicro(cleanedText)
    : splitSentencesByPunctuation(cleanedText);
  if (rawSentences.length === 0) return null;

  const rankedSentences: RankedSentence[] = [];
  if (microMode) {
    for (let i = 0; i < rawSentences.length; i += 1) {
      rankedSentences.push(scoreSentence(rawSentences[i], i, i, rawSentences.length));
    }
  } else {
    const windows = buildWindowBlocks(rawSentences);
    let globalIndex = 0;
    for (let windowIndex = 0; windowIndex < windows.length; windowIndex += 1) {
      const window = windows[windowIndex];
      for (let sentenceIndex = 0; sentenceIndex < window.length; sentenceIndex += 1) {
        rankedSentences.push(
          scoreSentence(window[sentenceIndex], globalIndex, sentenceIndex, window.length),
        );
        globalIndex += 1;
      }
    }
  }

  const smallMarkdown = buildSmallOutput(rankedSentences);
  const mediumMarkdown = buildMediumOutput(rankedSentences);
  const longMarkdown = microMode ? buildLongOutputMicro(rankedSentences) : buildLongOutputMacro(rawSentences);

  const validLengths = longMarkdown.length > mediumMarkdown.length && mediumMarkdown.length > smallMarkdown.length;
  const fallback = !validLengths || rankedSentences.length <= 3 ? fallbackOutput(cleanedText) : null;
  const finalSmall = fallback ? fallback.small : smallMarkdown;
  const finalMedium = fallback ? fallback.medium : mediumMarkdown;
  const finalLong = fallback ? fallback.long : longMarkdown;

  const frequency: Record<string, number> = {};
  selectContentWords(cleanedText).forEach((word) => {
    frequency[word] = (frequency[word] ?? 0) + 1;
  });
  const keywords = Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`);
  const title = keywords.length > 0 ? keywords.join(' · ') : 'Lecture Notes';

  const smallSentences = sortChronologically([
    ...selectTopByRole(rankedSentences, 'concept', 1),
    ...selectTopByRole(rankedSentences, 'mechanism', 1),
    ...selectTopByRole(rankedSentences, 'evidence', 1),
    ...selectTopByRole(rankedSentences, 'takeaway', 1),
  ]);

  const mediumSentences = sortChronologically([
    ...selectTopByRole(rankedSentences, 'concept', 2),
    ...selectTopByRole(rankedSentences, 'mechanism', 2),
    ...selectTopByRole(rankedSentences, 'evidence', 2),
    ...selectTopByRole(rankedSentences, 'takeaway', 2),
  ]);

  const longSentences = sortChronologically(
    [...rankedSentences]
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, Math.max(1, Math.ceil(rankedSentences.length * (microMode ? 0.5 : 0.3)))),
  );

  return {
    title,
    cleanedText,
    ranked: sortChronologically(rankedSentences),
    tiers: {
      small: smallSentences,
      medium: mediumSentences,
      long: longSentences,
    },
    clusters: {
      small: buildClusters(smallSentences),
      medium: buildClusters(mediumSentences),
      long: buildClusters(longSentences),
    },
    markdown: {
      small: buildMarkdown(title, finalSmall),
      medium: buildMarkdown(title, finalMedium),
      long: buildMarkdown(title, finalLong),
    },
  };
}

export function getMarkdownForLength(
  result: LectureProcessedResult,
  length: SummaryLength,
): string {
  return result.markdown[length];
}
