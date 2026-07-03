const EMPHASIS_WORDS =
  /\b(always|never|only|must|cannot|critical|essential|important|note that|remember)\b/gi;

const GREEK_MAP: Record<string, string> = {
  alpha: '\\alpha', beta: '\\beta', gamma: '\\gamma', delta: '\\delta',
  epsilon: '\\epsilon', theta: '\\theta', lambda: '\\lambda', mu: '\\mu',
  pi: '\\pi', sigma: '\\sigma', omega: '\\omega', phi: '\\phi',
};

/** Convert spoken math patterns to LaTeX. */
export function spokenMathToLatex(text: string): string {
  let out = text;

  // "x squared" / "x cubed"
  out = out.replace(
    /\b([a-zA-Z0-9]+)\s+squared\b/gi,
    (_, v) => `$${v}^2$`,
  );
  out = out.replace(
    /\b([a-zA-Z0-9]+)\s+cubed\b/gi,
    (_, v) => `$${v}^3$`,
  );
  out = out.replace(
    /\b([a-zA-Z0-9]+)\s+to the power of\s+([a-zA-Z0-9]+)\b/gi,
    (_, base, exp) => `$${base}^{${exp}}$`,
  );

  // "a over b" fractions
  out = out.replace(
    /\b([a-zA-Z0-9]+)\s+over\s+([a-zA-Z0-9]+)\b/gi,
    (_, a, b) => `$\\frac{${a}}{${b}}$`,
  );

  // "square root of x"
  out = out.replace(
    /\bsquare root of\s+([a-zA-Z0-9]+)\b/gi,
    (_, v) => `$\\sqrt{${v}}$`,
  );

  // integral / derivative
  out = out.replace(/\bintegral of\b/gi, '$\\int$');
  out = out.replace(/\bderivative of\b/gi, '$\\frac{d}{dx}$');

  // Greek letters
  for (const [name, latex] of Object.entries(GREEK_MAP)) {
    out = out.replace(new RegExp(`\\b${name}\\b`, 'gi'), `$${latex}$`);
  }

  // "x equals y" with numbers
  out = out.replace(
    /\b([a-zA-Z0-9]+)\s+equals\s+([a-zA-Z0-9.+-]+)\b/gi,
    (_, l, r) => `$${l} = ${r}$`,
  );

  return out;
}

export function highlightNumbers(text: string): string {
  return text.replace(
    /\b(\d+(?:\.\d+)?%?|\d{1,2}\/\d{1,2}\/\d{2,4})\b/g,
    '<mark>$1</mark>',
  );
}

export function boldKeyTerms(text: string, terms: string[]): string {
  let out = text;
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  for (const term of sorted) {
    if (term.length < 4) continue;
    const re = new RegExp(`\\b(${escapeRegExp(term)})\\b`, 'gi');
    out = out.replace(re, '**$1**');
  }
  // Avoid double-bold
  out = out.replace(/\*\*\*\*/g, '');
  out = out.replace(/\*\*(\*\*[^*]+\*\*)\*\*/g, '$1');
  return out;
}

export function italicizeEmphasis(text: string): string {
  return text.replace(EMPHASIS_WORDS, (m) => `_${m}_`);
}

export function formatSentence(text: string, terms: string[]): string {
  let out = spokenMathToLatex(text);
  out = boldKeyTerms(out, terms);
  out = italicizeEmphasis(out);
  out = highlightNumbers(out);
  // Don't mark inside existing math
  out = out.replace(/<mark>(\$\$?[^<]+?\$\$?)<\/mark>/g, '$1');
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatDefinition(text: string, terms: string[]): string {
  const defMatch = text.match(
    /\b([A-Z][A-Za-z0-9\s-]{1,40}?)\s+(?:is defined as|is called|refers to|means)\s+(.+)/i,
  );
  if (defMatch) {
    const term = defMatch[1].trim();
    const body = formatSentence(defMatch[2].trim(), terms);
    return `> **${term}** — ${body}`;
  }
  return `> ${formatSentence(text, terms)}`;
}
