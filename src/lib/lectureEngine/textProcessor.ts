/** Raw word tokens from speech (may lack punctuation). */
export function tokenizeWords(text: string): string[] {
  return text
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Step A: collapse immediate repetitions from audio glitches. */
export function collapseWordRepetitions(words: string[]): string[] {
  if (words.length === 0) return [];
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    const current = words[i];
    let j = i + 1;
    while (
      j < words.length &&
      words[j].toLowerCase() === current.toLowerCase()
    ) {
      j++;
    }
    out.push(current);
    i = j;
  }
  return out;
}

const FILLER = new Set([
  'um', 'uh', 'er', 'ah', 'like', 'basically', 'literally', 'okay', 'right',
]);

export function stripFillerWords(words: string[]): string[] {
  return words.filter((w) => !FILLER.has(w.toLowerCase().replace(/,/g, '')));
}

const SENTENCE_START = new Set([
  'today', 'now', 'first', 'second', 'third', 'finally', 'because', 'however',
  'therefore', 'thus', 'but', 'so', 'then', 'meanwhile', 'additionally',
  'furthermore', 'nevertheless', 'although', 'while', 'when', 'if', 'let',
]);

const COMMA_BEFORE = new Set([
  'and', 'but', 'or', 'nor', 'yet', 'so', 'for', 'however', 'therefore',
  'because', 'although', 'while', 'when', 'if', 'which', 'who', 'where',
]);

const PERIOD_AFTER = new Set([
  'today', 'finally', 'therefore', 'thus', 'however', 'overall', 'conclusion',
]);

const VERB_AGREEMENT_FIXES: { pattern: RegExp; replace: string }[] = [
  { pattern: /\bdoctors diagnosed patients\b/gi, replace: 'doctors diagnose patients' },
  { pattern: /\bstudents learns\b/gi, replace: 'students learn' },
  { pattern: /\bthey was\b/gi, replace: 'they were' },
  { pattern: /\bwe was\b/gi, replace: 'we were' },
  { pattern: /\bhe have\b/gi, replace: 'he has' },
  { pattern: /\bshe have\b/gi, replace: 'she has' },
  { pattern: /\bit have\b/gi, replace: 'it has' },
  { pattern: /\bpeople was\b/gi, replace: 'people were' },
  { pattern: /\bdata shows\b/gi, replace: 'data show' },
];

function capitalize(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** Step B: inject punctuation and fix grammar heuristically. */
export function injectPunctuation(words: string[]): string[] {
  const result: string[] = [];
  let afterPause = true;

  for (let i = 0; i < words.length; i++) {
    let word = words[i];
    const lower = word.toLowerCase().replace(/[,.]/g, '');

    if (afterPause || (i > 0 && SENTENCE_START.has(lower))) {
      word = capitalize(word.replace(/^[,.]/, ''));
      if (result.length > 0 && !/[.!?]$/.test(result[result.length - 1])) {
        const prev = result[result.length - 1];
        result[result.length - 1] = prev.replace(/[,;]?$/, '.');
      }
      afterPause = false;
    }

    if (i > 0 && COMMA_BEFORE.has(lower)) {
      const prev = result[result.length - 1];
      if (prev && !/[,;:]$/.test(prev)) {
        result[result.length - 1] = `${prev},`;
      }
    }

    result.push(word);

    if (PERIOD_AFTER.has(lower) && i < words.length - 1) {
      result[result.length - 1] = `${word.replace(/[,.]$/, '')}.`;
      afterPause = true;
    }

    if (/[.!?]$/.test(word)) afterPause = true;
  }

  return result;
}

const PLURAL_NOUN_RE = /^[a-z]+s$/i;
const CONNECTOR_WORDS = new Set([
  'and', 'or', 'but', 'the', 'a', 'an', 'to', 'of', 'in', 'on', 'at', 'for',
  'with', 'by', 'from', 'that', 'this', 'these', 'those', 'who', 'which',
]);

/** Step C: detect abrupt subject shifts and inject connectors. */
export function fixContinuity(words: string[]): string[] {
  const result = [...words];

  for (let i = 1; i < result.length - 1; i++) {
    const prev = result[i - 1].toLowerCase().replace(/[,.]/g, '');
    const curr = result[i].toLowerCase().replace(/[,.]/g, '');
    const next = result[i + 1]?.toLowerCase().replace(/[,.]/g, '') ?? '';

    if (CONNECTOR_WORDS.has(curr) || CONNECTOR_WORDS.has(prev)) continue;

    const prevPlural = PLURAL_NOUN_RE.test(prev) && prev.length > 4;
    const currPlural = PLURAL_NOUN_RE.test(curr) && curr.length > 4;
    const nextIsVerb =
      /^(fly|flies|run|runs|work|works|go|goes|do|does|is|are|was|were|have|has|can|will)$/.test(
        next,
      );

    if (prevPlural && currPlural && nextIsVerb) {
      result[i - 1] = `${result[i - 1].replace(/[,.]$/, '')};`;
      if (!CONNECTOR_WORDS.has(curr)) {
        result.splice(i, 0, 'and');
        i++;
      }
      continue;
    }

    if (
      prevPlural &&
      currPlural &&
      !CONNECTOR_WORDS.has(prev) &&
      !/[;,]$/.test(result[i - 1])
    ) {
      result[i - 1] = `${result[i - 1]},`;
    }
  }

  return result;
}

export function applyVerbAgreement(text: string): string {
  let out = text;
  for (const { pattern, replace } of VERB_AGREEMENT_FIXES) {
    out = out.replace(pattern, replace);
  }
  return out;
}

export function wordsToText(words: string[]): string {
  let text = words.join(' ');
  text = text.replace(/\s+([,.;:!?])/g, '$1');
  text = text.replace(/([.!?])\s*([a-z])/g, (_, p, c) => `${p} ${c.toUpperCase()}`);
  if (text.length > 0 && !/[.!?]$/.test(text.trim())) {
    text = `${text.trim()}.`;
  }
  return applyVerbAgreement(text);
}

/** Full pipeline: raw transcript → cleaned punctuated text. */
export function processRawTranscript(raw: string): string {
  let words = tokenizeWords(raw);
  words = stripFillerWords(words);
  words = collapseWordRepetitions(words);
  words = injectPunctuation(words);
  words = fixContinuity(words);
  return wordsToText(words);
}
