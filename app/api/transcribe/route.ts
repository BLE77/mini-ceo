import {
  ElevenLabsServiceError,
  transcribeElevenLabsAudio,
} from "@/app/lib/elevenlabs";

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

function failure(error: unknown) {
  const message =
    error instanceof ElevenLabsServiceError
      ? error.message
      : "The live transcription service is unavailable.";
  return Response.json({ error: message }, { status: 503 });
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid microphone recording." }, { status: 400 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size < 100 || audio.size > MAX_AUDIO_BYTES) {
    return Response.json(
      { error: "Record between a moment and twelve megabytes of audio." },
      { status: 400 },
    );
  }

  try {
    const transcript = await transcribeElevenLabsAudio(audio);
    return Response.json(
      {
        text: transcript.text,
        provider: "elevenlabs",
        model: transcript.model,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
