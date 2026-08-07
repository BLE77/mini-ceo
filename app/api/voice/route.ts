import {
  ElevenLabsServiceError,
  listAndSelectElevenLabsVoice,
  parseBossMode,
  synthesizeElevenLabsSpeech,
  validateVoiceText,
} from "@/app/lib/elevenlabs";

type VoiceRequest = {
  text?: unknown;
  bossMode?: unknown;
};

function errorStatus(error: ElevenLabsServiceError) {
  return error.code === "credentials_rejected" ? 502 : 503;
}

function safeError(error: unknown) {
  if (error instanceof ElevenLabsServiceError) {
    return Response.json(
      {
        connected: false,
        configured: error.code !== "not_configured",
        provider: "elevenlabs",
        status: error.code,
        selectedVoice: null,
        error: error.message,
      },
      { status: errorStatus(error) },
    );
  }

  return Response.json(
    {
      connected: false,
      configured: Boolean(process.env.ELEVENLABS_API_KEY?.trim()),
      provider: "elevenlabs",
      status: "provider_unavailable",
      selectedVoice: null,
      error: "ElevenLabs is temporarily unavailable.",
    },
    { status: 503 },
  );
}

export async function GET() {
  try {
    const { selected, availableVoiceCount } = await listAndSelectElevenLabsVoice();
    return Response.json(
      {
        connected: true,
        configured: true,
        provider: "elevenlabs",
        status: "ready",
        selectedVoice: selected.name,
        availableVoiceCount,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return safeError(error);
  }
}

export async function POST(request: Request) {
  let body: VoiceRequest;
  try {
    body = (await request.json()) as VoiceRequest;
  } catch {
    return Response.json({ error: "Invalid voice request." }, { status: 400 });
  }

  const validatedText = validateVoiceText(body.text);
  if (!validatedText.ok) {
    return Response.json({ error: validatedText.error }, { status: 400 });
  }

  try {
    const audio = await synthesizeElevenLabsSpeech(
      validatedText.text,
      parseBossMode(body.bossMode),
    );
    const headers = new Headers({
      "Cache-Control": "no-store",
      "Content-Type": audio.contentType,
      "X-Mini-CEO-Voice": encodeURIComponent(audio.voice.name),
    });
    if (audio.contentLength) headers.set("Content-Length", audio.contentLength);

    return new Response(audio.stream, { status: 200, headers });
  } catch (error) {
    return safeError(error);
  }
}
