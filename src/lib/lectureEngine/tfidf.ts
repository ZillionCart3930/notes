import { tokenize } from './parse';

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'to', 'of', 'in', 'for', 'on',
  'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here',
  'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 'just', 'that', 'this', 'these', 'those', 'it', 'its', 'they',
  'them', 'their', 'we', 'our', 'you', 'your', 'he', 'she', 'his', 'her', 'what',
  'which', 'who', 'whom', 'also', 'well', 'now', 'about', 'up', 'out', 'if',
]);

export interface RankedSentence {
  text: string;
  index: number;
  score: number;
  terms: string[];
}

export interface SentenceCluster {
  header: RankedSentence;
  bullets: RankedSentence[];
}

function sentenceTerms(sentence: string): string[] {
  return tokenize(sentence).filter((w) => !STOP_WORDS.has(w) && w.length > 2);
}

/** Build TF-IDF frequency matrix and score each sentence. */
export function scoreSentencesTfidf(sentences: string[]): RankedSentence[] {
  if (sentences.length === 0) return [];

  const docFreq = new Map<string, number>();
  const sentenceTermLists = sentences.map((s) => {
    const terms = sentenceTerms(s);
    const unique = new Set(terms);
    for (const t of unique) {
      docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
    }
    return terms;
  });

  const n = sentences.length;

  return sentences.map((text, index) => {
    const terms = sentenceTermLists[index];
    if (terms.length === 0) {
      return { text, index, score: 0, terms: [] };
    }

    const tf = new Map<string, number>();
    for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);

    let score = 0;
    const topTerms: string[] = [];

    for (const [term, count] of tf) {
      const tfVal = count / terms.length;
      const df = docFreq.get(term) ?? 1;
      const idf = Math.log((n + 1) / (df + 1)) + 1;
      const tfidf = tfVal * idf;
      score += tfidf;
      if (tfidf > 0.05) topTerms.push(term);
    }

    return { text, index, score, terms: topTerms.slice(0, 5) };
  });
}

export function getTopKeywords(
  ranked: RankedSentence[],
  limit = 3,
): string[] {
  const global = new Map<string, number>();
  for (const s of ranked) {
    for (const t of s.terms) {
      global.set(t, (global.get(t) ?? 0) + s.score);
    }
  }
  return [...global.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w.charAt(0).toUpperCase() + w.slice(1));
}

export function selectTier(
  ranked: RankedSentence[],
  percent: number,
): RankedSentence[] {
  const sorted = [...ranked].sort((a, b) => b.score - a.score);
  const count = Math.max(1, Math.ceil(sorted.length * percent));
  return sorted.slice(0, count).sort((a, b) => a.index - b.index);
}

/** Group adjacent sentences into clusters; highest score = header. */
export function clusterSentences(sentences: RankedSentence[]): SentenceCluster[] {
  if (sentences.length === 0) return [];

  const ordered = [...sentences].sort((a, b) => a.index - b.index);
  const clusters: RankedSentence[][] = [];
  let current: RankedSentence[] = [ordered[0]];

  for (let i = 1; i < ordered.length; i++) {
    const gap = ordered[i].index - ordered[i - 1].index;
    if (gap > 4) {
      clusters.push(current);
      current = [ordered[i]];
    } else {
      current.push(ordered[i]);
    }
  }
  clusters.push(current);

  return clusters.map((group) => {
    const sorted = [...group].sort((a, b) => b.score - a.score);
    return {
      header: sorted[0],
      bullets: sorted.slice(1),
    };
  });
}
