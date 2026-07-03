import express from 'express';
import multer from 'multer';
import ffmpeg from 'fluent-ffmpeg';
import { randomUUID } from 'node:crypto';
import { openAsBlob } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const app = express();
const PORT = process.env.PORT || 4000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL_ID = process.env.GEMINI_MODEL_ID || 'google/gemini-3-flash-preview';
const GEMINI_API_URL = process.env.GEMINI_API_URL || `https://api.generativeai.googleapis.com/v1beta2/models/${GEMINI_MODEL_ID}:generate`;
const SHORT_TRANSCRIPT_WORD_LIMIT = 110;

// Local whisper.cpp server endpoint (boot it with: ./server -m models/ggml-base.en.bin --port 8080)
const WHISPER_SERVER_URL = process.env.WHISPER_SERVER_URL || 'http://127.0.0.1:8080/inference';
// Hard ceiling so a hung whisper.cpp process can't hold the request open forever.
const WHISPER_TIMEOUT_MS = Number(process.env.WHISPER_TIMEOUT_MS) || 120_000;

// OpenRouter summarization config. NOTE: prefer setting OPENROUTER_API_KEY in
// the environment instead of relying on this fallback value.
const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY ||
  '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';
const OPENROUTER_MODEL_ID = process.env.OPENROUTER_MODEL_ID || 'deepseek/deepseek-v4-flash';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

app.use(express.json({ limit: '1mb' }));

// Multer ingests the browser's multipart form-data audio blob straight into /tmp.
// A random UUID prefix prevents filename collisions between concurrent uploads.
const upload = multer({
  storage: multer.diskStorage({
    destination: tmpdir(),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '') || '.webm';
      cb(null, `lecture-raw-${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB cap for long lectures
});

const sanitizationPatterns = [
  [ /\s+/g, ' ' ],
  [ /\.{2,}/g, '.' ],
  [ /,(\s*\.)+/g, '.' ],
  [ /\s*([,;:!?])\s*/g, '$1 ' ],
  [ /\s+([,;:!?])/g, '$1' ],
  [ /\s*\n\s*/g, ' ' ],
  [ /[“”]/g, '"' ],
  [ /[‘’]/g, "'" ],
];

function safeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeTranscript(text) {
  let cleaned = safeString(text);
  for (const [pattern, replacement] of sanitizationPatterns) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  return cleaned.trim();
}

function countWords(text) {
  return safeString(text).split(/\s+/).filter(Boolean).length;
}

function ensureApiKey() {
  if (!GEMINI_API_KEY) {
    const error = new Error('Server configuration error: GEMINI_API_KEY is not set.');
    error.code = 500;
    throw error;
  }
}

function buildMasterTitlePrompt(transcript) {
  return `You are an A+ university student and expert academic note-taker with deep subject-matter knowledge. Transform the raw speech-to-text lecture transcript below into the flawless, exam-ready notes a top student would produce in class.

Critical Quality Rules:
- The transcript is messy STT output. NEVER copy broken fragments, stutters, repeated words, or garbled phrases.
- If a sentence is incomplete, garbled, or clearly mis-transcribed, use your own subject knowledge to FILL IN THE BLANKS: infer what the lecturer actually meant and write the corrected, complete concept.
- If the lecturer mentions a concept but explains it poorly or partially, complete the explanation with accurate domain knowledge so the notes stand on their own.
- Never write "unclear" or "[inaudible]". Always resolve gaps into confident, correct academic prose.
- Detect implicit speaker shifts (student questions, second lecturer) and fold them cleanly into the notes.

Story Handling:
- If the lecturer tells a story, case example, or anecdote, pull it out of the main prose and format it as a sidebar:
> ### 📘 Case Study: [Short descriptive title]
> *[Rewritten summary of the story and the core lesson it illustrates.]*

Typography Rules:
- **Bold** for key terms, definitions, mechanisms, and frameworks the first time they appear.
- *Italics* for trends, causal relationships, and important qualifiers.
- \`inline code\` for exact numbers, percentages, dates, formulas, or data values.

Header Rules (very important):
- Generate SPECIFIC, descriptive headers based on the actual lecture content — never use generic placeholders like "Overview", "Introduction", or "Main Concepts".
- Each ## section header must name the actual topic discussed (e.g. "## 2. How the Krebs Cycle Generates ATP", not "## 2. Core Mechanisms").
- Use ### sub-headers to break long sections into scannable, named sub-topics.

Output Structure:
# [Concise, specific lecture title based on the content]

## 1. [Descriptive header for the foundational topic]
Well-developed paragraphs plus definition bullets for key terms.

## 2. [Descriptive header for the main mechanism/process discussed]
Step-by-step explanation of how it works, with cause-and-effect chains. Use numbered steps where the lecturer described a sequence. Inject case study sidebars here if stories were detected.

## 3. [Descriptive header for applications/implications discussed]
Real-world usage, consequences, and what happens when things fail.

(Add or remove ## sections as the actual lecture content demands — follow the lecture's real structure, not a rigid template.)

---
**📌 Key Takeaways:**
1-5 numbered, fully synthesized takeaway sentences densely formatted with **bold** terms and *italicized* relationships. These should be exactly what a student needs to review before an exam.

Return ONLY the markdown notes. No preamble, no commentary.

Transcript:
${transcript}`;
}
function buildShortTranscriptPrompt(transcript) {
  return `You are an A+ university student and expert academic note-taker. The transcript below is a very brief, messy speech-to-text fragment from a lecture.

Instructions:
- Produce a short set of polished class notes with this structure:
# [Concise, specific title based on the content]
One or two well-developed paragraphs synthesizing the material.
**📌 Key Takeaways:** followed by 2-3 numbered takeaway sentences.
- If the fragment is garbled or incomplete, use your subject knowledge to fill in the blanks and write the complete, correct concept. Never write "unclear".
- Use **bold** for key terms, *italics* for relationships, and \`inline code\` for exact metrics.
- Return ONLY the markdown notes. No preamble.

Transcript:\n${transcript}`;
}

async function requestGemini(prompt) {
  ensureApiKey();
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GEMINI_API_KEY}`,
    },
    body: JSON.stringify({
      model: GEMINI_MODEL_ID,
      temperature: 0.2,
      max_output_tokens: 1400,
      prompt: { text: prompt },
    }),
  });

  if (response.status === 429) {
    const error = new Error('The note-taking engine is currently busy. Please wait a moment and try again.');
    error.code = 429;
    throw error;
  }

  const payload = await response.json();
  if (!response.ok) {
    const error = new Error('Gemini API returned an error.');
    error.code = response.status;
    error.details = payload?.error || payload;
    throw error;
  }

  const text = extractTextFromPayload(payload);
  if (!text) {
    const error = new Error('Gemini API returned no usable text content.');
    error.code = 502;
    error.details = payload;
    throw error;
  }

  return text.trim();
}

function extractTextFromPayload(payload) {
  if (!payload) return null;
  if (typeof payload === 'string') return payload;
  if (Array.isArray(payload)) return payload.map(extractTextFromPayload).filter(Boolean).join('\n');
  if (payload.output) return extractTextFromPayload(payload.output);
  if (payload.choices) return extractTextFromPayload(payload.choices[0]);
  if (payload.candidates) return extractTextFromPayload(payload.candidates[0]);
  if (payload.message) return extractTextFromPayload(payload.message);
  if (payload.content) return extractTextFromPayload(payload.content);
  if (typeof payload.text === 'string') return payload.text;
  return null;
}

/**
 * Shared summarization hand-off: sanitizes the transcript, picks the correct
 * prompt tier by word count, and returns the Gemini textbook summary string.
 */
async function summarizeTranscript(rawTranscript) {
  const transcript = sanitizeTranscript(rawTranscript);
  const wordCount = countWords(transcript);
  const prompt =
    wordCount < SHORT_TRANSCRIPT_WORD_LIMIT
      ? buildShortTranscriptPrompt(transcript)
      : buildMasterTitlePrompt(transcript);
  return requestGemini(prompt);
}

/* ------------------------------------------------------------------ */
/*  OpenRouter "Turn into notes" summarization                         */
/* ------------------------------------------------------------------ */

/**
 * Sends the transcript to OpenRouter (google/gemma-4-26b-a4b-it:free) and
 * returns the summarized uni-student notes as a markdown string.
 */
async function requestOpenRouterNotes(transcript) {
  if (!OPENROUTER_API_KEY) {
    const error = new Error('Server configuration error: OPENROUTER_API_KEY is not set.');
    error.code = 500;
    throw error;
  }

  // Cap the output length proportionally to the transcript so a 2-minute
  // lecture can never balloon into a 1000-word essay (~1.4 tokens per word).
  const transcriptWords = countWords(transcript);
  const maxTokens = Math.min(1600, Math.max(300, Math.round(transcriptWords * 0.45)));

  let response;
  try {
    response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL_ID,
        temperature: 0.3,
        max_tokens: maxTokens,
        messages: [
          {
            role: 'system',
            content: [
              'You are an expert academic note-taker who writes concise, polished uni-student summary notes.',
              '',
              'HARD RULES:',
              '- SUMMARIZE. Never restate, paraphrase line-by-line, or echo the transcript. The notes must be dramatically shorter than the transcript — aim for roughly 20-30% of its length, and never longer than half of it.',
              '- Judge importance: go IN DEPTH only on the core concepts that matter (definitions, mechanisms, cause-and-effect), and compress or drop minor asides, repetition, filler, and small talk entirely.',
              '- Rewrite everything in your own words with perfect grammar and spelling. The transcript is messy speech-to-text; if a phrase is garbled, infer the intended meaning and write it correctly.',
              '- Never include speech artifacts ("um", "you know", repeated words) or meta comments about the recording.',
              '',
              'FORMAT:',
              '- Start with a short, specific # title.',
              '- Use 2-4 ## section headers named after the actual topics (never generic ones like "Overview").',
              '- Under each header: a brief 1-3 sentence explanation and/or tight bullet points.',
              '- **Bold** key terms, *italicize* important relationships, use `inline code` for exact numbers or data.',
              '- End with "## Key Takeaways" containing 2-4 numbered one-sentence points.',
              '- Return ONLY the markdown notes. No preamble, no commentary.',
            ].join('\n'),
          },
          {
            role: 'user',
            content: `Make this lecture transcript into concise summarised notes for a uni student. Remember: summarize and condense — do not restate the transcript:\n\n${transcript}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (cause) {
    const error = new Error('Could not reach the summarization service. Check your internet connection.');
    error.code = 503;
    error.details = cause?.message;
    throw error;
  }

  if (response.status === 429) {
    const error = new Error('The note-taking engine is currently busy. Please wait a moment and try again.');
    error.code = 429;
    throw error;
  }

  const payload = await response.json();
  if (!response.ok) {
    const error = new Error('OpenRouter API returned an error.');
    error.code = response.status;
    error.details = payload?.error || payload;
    throw error;
  }

  const text = safeString(payload?.choices?.[0]?.message?.content);
  if (!text) {
    const error = new Error('OpenRouter returned no usable text content.');
    error.code = 502;
    error.details = payload;
    throw error;
  }

  return formatNotesMarkdown(text);
}

/**
 * Post-formats the raw AI response into tidy markdown: strips code fences the
 * model sometimes wraps output in, trims stray whitespace, and normalizes
 * blank-line spacing so the notes render cleanly in the editor.
 */
function formatNotesMarkdown(raw) {
  let text = raw.trim();
  // Unwrap a full-body ```markdown ... ``` fence if present.
  const fenceMatch = text.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/);
  if (fenceMatch) text = fenceMatch[1].trim();
  // Collapse 3+ blank lines to a single blank line.
  text = text.replace(/\n{3,}/g, '\n\n');
  // Ensure headers are preceded by a blank line for proper rendering.
  text = text.replace(/([^\n])\n(#{1,6} )/g, '$1\n\n$2');
  return text.trim();
}

/* ------------------------------------------------------------------ */
/*  Local whisper.cpp transcription pipeline                           */
/* ------------------------------------------------------------------ */

/**
 * STEP 2 — Audio Transcoding Pass.
 * Converts the browser-native upload (WebM/AAC/MP3/etc.) into the strict
 * Whisper-compliant format: WAV container, 16000Hz sample rate, mono
 * channel, 16-bit signed little-endian PCM.
 */
function transcodeToWhisperWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioFrequency(16000)      // 16kHz sampling rate
      .audioChannels(1)           // mono / single channel
      .audioCodec('pcm_s16le')    // 16-bit PCM
      .format('wav')
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .save(outputPath);
  });
}

/**
 * STEP 3 — Local whisper.cpp communication.
 * POSTs the transcoded WAV to the local inference endpoint as multipart
 * form-data and returns the parsed JSON payload.
 */
async function requestWhisperInference(wavPath) {
  const form = new FormData();
  // Stream the WAV from disk as a Blob so large lectures don't need to be
  // buffered fully in memory before dispatch.
  form.append('file', await openAsBlob(wavPath, { type: 'audio/wav' }), path.basename(wavPath));
  form.append('temperature', '0.0');
  form.append('language', 'en');
  form.append('response_format', 'json');

  let response;
  try {
    response = await fetch(WHISPER_SERVER_URL, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(WHISPER_TIMEOUT_MS),
    });
  } catch (cause) {
    // Connection refused / DNS failure / abort — the whisper.cpp server
    // process is down or was never booted on port 8080.
    const error = new Error('Local transcription engine offline. Please verify whisper.cpp server status.');
    error.code = 503;
    error.details = cause?.message;
    throw error;
  }

  if (!response.ok) {
    const error = new Error('Local transcription engine offline. Please verify whisper.cpp server status.');
    error.code = 503;
    error.details = `whisper.cpp responded with HTTP ${response.status}`;
    throw error;
  }

  return response.json();
}

/**
 * POST /api/transcribe-audio
 * Full local pipeline: browser audio blob → /tmp → ffmpeg 16kHz mono WAV →
 * whisper.cpp inference → Gemini textbook summarization.
 */
app.post('/api/transcribe-audio', upload.single('audio'), async (req, res) => {
  // STEP 1 — File Ingestion (multer has already streamed the blob to /tmp).
  if (!req.file) {
    return res.status(400).json({ error: 'An audio file is required in the "audio" form field.' });
  }

  const rawAudioPath = req.file.path;
  const wavPath = path.join(tmpdir(), `lecture-16k-${randomUUID()}.wav`);

  try {
    // STEP 2 — Transcode to Whisper-compliant 16kHz mono 16-bit PCM WAV.
    try {
      await transcodeToWhisperWav(rawAudioPath, wavPath);
    } catch (transcodeError) {
      console.error('FFmpeg transcoding failed. Ensure system audio dependencies are installed.', transcodeError);
      return res.status(500).json({
        error: 'FFmpeg transcoding failed. Ensure system audio dependencies are installed.',
      });
    }

    // STEP 3 — Send the WAV to the local whisper.cpp inference server.
    const whisperPayload = await requestWhisperInference(wavPath);

    // STEP 4 — Text Capture: pull the clean transcript string out of the JSON.
    const transcript = safeString(whisperPayload?.text);
    if (!transcript) {
      return res.status(502).json({
        error: 'Transcription produced no text. The recording may be silent or corrupted.',
      });
    }

    // Return the transcript only — summarization happens when the user
    // presses the "Turn into notes" button (POST /api/notes).
    return res.json({ success: true, transcript });
  } catch (error) {
    if (error?.code === 503) {
      return res.status(503).json({ error: error.message, details: error.details });
    }
    if (error?.code === 429) {
      return res.status(429).json({ error: error.message });
    }
    return res.status(error?.code || 500).json({
      error: 'Audio transcription pipeline failed.',
      details: error?.details || error?.message || String(error),
    });
  } finally {
    // File Cleanup Routine — always delete both temp artifacts so the /tmp
    // disk never fills up, regardless of success or failure above.
    await Promise.allSettled([
      unlink(rawAudioPath),
      unlink(wavPath),
    ]);
  }
});

/**
 * POST /api/notes
 * "Turn into notes" button target: takes a transcript string and returns
 * nicely formatted uni-student notes from OpenRouter (Gemma).
 */
app.post('/api/notes', async (req, res) => {
  const transcript = safeString(req.body?.transcript);
  if (!transcript) {
    return res.status(400).json({ error: 'Transcript is required and cannot be empty.' });
  }

  try {
    const notes = await requestOpenRouterNotes(sanitizeTranscript(transcript));
    return res.json({ success: true, notes });
  } catch (error) {
    if (error?.code === 429 || error?.code === 503) {
      return res.status(error.code).json({ error: error.message, details: error.details });
    }
    return res.status(error?.code || 500).json({
      error: 'Note generation failed.',
      details: error?.details || error?.message || String(error),
    });
  }
});

/* ------------------------------------------------------------------ */
/*  Text-only summarization route (existing frontend path)             */
/* ------------------------------------------------------------------ */

app.post('/api/transcript', async (req, res) => {
  const rawTranscript = safeString(req.body?.transcript);
  if (!rawTranscript) {
    return res.status(400).json({ error: 'Transcript is required and cannot be empty.' });
  }

  try {
    const textbookSummary = await summarizeTranscript(rawTranscript);
    return res.json({ success: true, textbookSummary });
  } catch (error) {
    if (error?.code === 429) {
      return res.status(429).json({ error: error.message });
    }

    return res.status(error?.code || 500).json({
      error: 'Transcript processing failed.',
      details: error?.details || error.message || String(error),
    });
  }
});

app.listen(PORT, () => {
  console.log(`Transcript API server listening on port ${PORT}`);
});
