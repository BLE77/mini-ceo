const ELEVENLABS_API_ORIGIN = "https://api.elevenlabs.io";
const MAX_VOICE_TEXT_LENGTH = 900;

export type BossMode = "coach" | "serious" | "unhinged";

type ElevenLabsVoice = {
  voice_id?: unknown;
  name?: unknown;
  description?: unknown;
  labels?: unknown;
};

type ElevenLabsVoiceList = {
  voices?: unknown;
};

export type SelectedElevenLabsVoice = {
  id: string;
  name: string;
};

export class ElevenLabsServiceError extends Error {
  readonly code:
    | "not_configured"
    | "credentials_rejected"
    | "no_voices"
    | "provider_unavailable"
    | "audio_unavailable";

  constructor(code: ElevenLabsServiceError["code"], message: string) {
    super(message);
    this.name = "ElevenLabsServiceError";
    this.code = code;
  }
}

let cachedVoice: SelectedElevenLabsVoice | null = null;

function apiKey() {
  const value = process.env.ELEVENLABS_API_KEY?.trim();
  if (!value) {
    throw new ElevenLabsServiceError(
      "not_configured",
      "ElevenLabs has not been configured on the server.",
    );
  }
  return value;
}

function parseLabels(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function parseVoices(data: ElevenLabsVoiceList) {
  if (!Array.isArray(data.voices)) return [];

  return data.voices.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const voice = candidate as ElevenLabsVoice;
    if (typeof voice.voice_id !== "string" || typeof voice.name !== "string") return [];

    return [
      {
        id: voice.voice_id,
        name: voice.name,
        description: typeof voice.description === "string" ? voice.description : "",
        labels: parseLabels(voice.labels),
      },
    ];
  });
}

function voiceScore(voice: ReturnType<typeof parseVoices>[number]) {
  const labels = Object.values(voice.labels).join(" ").toLowerCase();
  const searchable = `${voice.name} ${voice.description} ${labels}`.toLowerCase();
  let score = 0;

  if (/\bmale\b/.test(labels)) score += 8;
  if (/\b(narration|narrator|professional|corporate|social media)\b/.test(labels)) score += 6;
  if (/\b(adult|middle[- ]aged|mature)\b/.test(labels)) score += 4;
  if (/\b(grounded|authoritative|confident|serious|deep|calm|firm|professional)\b/.test(searchable)) {
    score += 5;
  }
  if (/\b(child|teen|teenager|cartoon|high-pitched)\b/.test(searchable)) score -= 12;

  return score;
}

function selectBossVoice(voices: ReturnType<typeof parseVoices>) {
  const configuredName = process.env.ELEVENLABS_VOICE_NAME?.trim();
  if (configuredName) {
    const configuredMatch = voices.find((voice) =>
      voice.name.toLowerCase().includes(configuredName.toLowerCase()),
    );
    if (configuredMatch) return configuredMatch;
  }

  // Jon was the original fallback. Prefer a noticeably different character
  // voice, and keep Jon out of automatic selection when another voice exists.
  const withoutOriginal = voices.filter(
    (voice) => !/\bjon\b/i.test(voice.name),
  );
  const candidates = withoutOriginal.length ? withoutOriginal : voices;
  const preferredNames = ["adam", "brian", "george", "clyde", "eric"];
  for (const preferredName of preferredNames) {
    const preferredMatch = candidates.find((voice) =>
      new RegExp(`\\b${preferredName}\\b`, "i").test(voice.name),
    );
    if (preferredMatch) return preferredMatch;
  }

  return candidates
    .map((voice, index) => ({ voice, index, score: voiceScore(voice) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.voice;
}

function providerError(status: number) {
  if (status === 401 || status === 403) {
    return new ElevenLabsServiceError(
      "credentials_rejected",
      "ElevenLabs rejected the server credentials.",
    );
  }
  return new ElevenLabsServiceError(
    "provider_unavailable",
    "ElevenLabs is temporarily unavailable.",
  );
}

export async function listAndSelectElevenLabsVoice() {
  const response = await fetch(
    `${ELEVENLABS_API_ORIGIN}/v2/voices?page_size=100&include_total_count=false`,
    {
      headers: {
        Accept: "application/json",
        "xi-api-key": apiKey(),
      },
      cache: "no-store",
    },
  ).catch(() => {
    throw new ElevenLabsServiceError(
      "provider_unavailable",
      "ElevenLabs is temporarily unavailable.",
    );
  });

  if (!response.ok) {
    cachedVoice = null;
    throw providerError(response.status);
  }

  const data = (await response.json().catch(() => null)) as ElevenLabsVoiceList | null;
  const voices = data ? parseVoices(data) : [];
  const selected = selectBossVoice(voices);

  if (!selected) {
    cachedVoice = null;
    throw new ElevenLabsServiceError(
      "no_voices",
      "No usable ElevenLabs voices are available for this account.",
    );
  }

  cachedVoice = { id: selected.id, name: selected.name };
  return { selected: cachedVoice, availableVoiceCount: voices.length };
}

async function selectedVoice() {
  if (cachedVoice) return cachedVoice;
  return (await listAndSelectElevenLabsVoice()).selected;
}

function voiceSettings(bossMode: BossMode) {
  switch (bossMode) {
    case "coach":
      return {
        stability: 0.62,
        similarity_boost: 0.78,
        style: 0.18,
        use_speaker_boost: true,
      };
    case "unhinged":
      return {
        stability: 0.36,
        similarity_boost: 0.82,
        style: 0.64,
        use_speaker_boost: true,
      };
    default:
      return {
        stability: 0.52,
        similarity_boost: 0.8,
        style: 0.36,
        use_speaker_boost: true,
      };
  }
}

export function validateVoiceText(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return { ok: false as const, error: "Text is required." };
  }

  const text = value.trim();
  if (text.length > MAX_VOICE_TEXT_LENGTH) {
    return {
      ok: false as const,
      error: `Text must be ${MAX_VOICE_TEXT_LENGTH} characters or fewer.`,
    };
  }

  return { ok: true as const, text };
}

export function parseBossMode(value: unknown): BossMode {
  return value === "coach" || value === "unhinged" || value === "serious"
    ? value
    : "serious";
}

export async function synthesizeElevenLabsSpeech(text: string, bossMode: BossMode) {
  const voice = await selectedVoice();
  const response = await fetch(
    `${ELEVENLABS_API_ORIGIN}/v1/text-to-speech/${encodeURIComponent(voice.id)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey(),
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: voiceSettings(bossMode),
      }),
      cache: "no-store",
    },
  ).catch(() => {
    throw new ElevenLabsServiceError(
      "provider_unavailable",
      "ElevenLabs is temporarily unavailable.",
    );
  });

  if (!response.ok) throw providerError(response.status);
  if (!response.body) {
    throw new ElevenLabsServiceError(
      "audio_unavailable",
      "ElevenLabs did not return audio.",
    );
  }

  return {
    stream: response.body,
    contentType: response.headers.get("content-type") || "audio/mpeg",
    contentLength: response.headers.get("content-length"),
    voice,
  };
}
