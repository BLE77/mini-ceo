type IdeaGenerationRequest = {
  goal?: unknown;
  topics?: unknown;
  platforms?: unknown;
  bossMode?: unknown;
  count?: unknown;
  referenceLabels?: unknown;
  existingTitles?: unknown;
};

type ModelIdea = {
  title?: unknown;
  hook?: unknown;
  angle?: unknown;
  topic?: unknown;
  fitReason?: unknown;
  researchNeeded?: unknown;
};

type OpenRouterResponse = {
  model?: unknown;
  choices?: Array<{ message?: { content?: unknown } }>;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 20_000;

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function stringList(value: unknown, maximumItems: number, maximumLength: number) {
  return Array.isArray(value)
    ? value
        .map((entry) => text(entry, maximumLength))
        .filter(Boolean)
        .slice(0, maximumItems)
    : [];
}

function parseModelJson(content: string) {
  const unfenced = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(unfenced.slice(start, end + 1)) as { ideas?: unknown };
  } catch {
    return null;
  }
}

function validIdea(value: unknown): value is ModelIdea {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const idea = value as ModelIdea;
  return Boolean(
    text(idea.title, 140) &&
      text(idea.hook, 240) &&
      text(idea.angle, 500) &&
      text(idea.topic, 100) &&
      text(idea.fitReason, 300) &&
      text(idea.researchNeeded, 300),
  );
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const configuredModel = process.env.OPENROUTER_MODEL?.trim();
  if (!apiKey || !configuredModel) {
    return Response.json(
      { error: "The real idea engine is not configured. No template ideas were substituted." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: IdeaGenerationRequest;
  try {
    body = (await request.json()) as IdeaGenerationRequest;
  } catch {
    return Response.json({ error: "Invalid idea request" }, { status: 400 });
  }

  const goal = text(body.goal, 800);
  const topics = stringList(body.topics, 10, 100);
  const platforms = stringList(body.platforms, 8, 80);
  const referenceLabels = stringList(body.referenceLabels, 8, 160);
  const existingTitles = stringList(body.existingTitles, 30, 160);
  const count = Math.min(8, Math.max(1, Number(body.count) || 4));
  const bossMode = ["coach", "serious", "unhinged"].includes(String(body.bossMode))
    ? String(body.bossMode)
    : "serious";

  if (!goal || !topics.length || !platforms.length) {
    return Response.json(
      { error: "A creator goal, at least one topic, and at least one platform are required" },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://mini-ceo-creator.ble77.chatgpt.site",
        "X-OpenRouter-Title": "Mini CEO Idea Engine",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: configuredModel,
        temperature: 0.82,
        max_tokens: 2_200,
        messages: [
          {
            role: "system",
            content:
              "You are the real idea engine for Mini CEO, a short-form creator operating system. Generate original, specific, executable video concepts grounded only in the creator inputs supplied. You do not have live web or social trend data. Never say an idea, topic, prediction, product, or format is currently trending, viral, popular, recent, or proven unless that fact appears explicitly in the creator inputs. Never claim you opened, watched, or analyzed a reference; referenceLabels are unverified labels supplied by the creator. Do not copy a living creator's distinctive expression. Convert preferences into high-level structure while keeping wording and concepts original. Every hook must be usable on camera, every angle must describe what the video actually delivers, every fitReason must tie directly to the creator goal, and every researchNeeded field must state what should be verified before scripting. Return JSON only with this exact shape: {\"ideas\":[{\"title\":\"...\",\"hook\":\"...\",\"angle\":\"...\",\"topic\":\"...\",\"fitReason\":\"...\",\"researchNeeded\":\"...\"}]}. Do not add markdown or commentary.",
          },
          {
            role: "user",
            content: JSON.stringify({
              requestedIdeaCount: count,
              creatorGoal: goal,
              topics,
              platforms,
              managementTone: bossMode,
              referenceLabels,
              referenceWarning:
                "These labels are metadata only. Their contents were not provided and must not be described.",
              titlesToAvoid: existingTitles,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      return Response.json(
        { error: "The real idea engine did not respond. No template ideas were substituted." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const result = (await response.json().catch(() => null)) as OpenRouterResponse | null;
    const content = result?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return Response.json(
        { error: "The idea engine returned an unreadable response. Nothing was fabricated." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const parsed = parseModelJson(content);
    const rawIdeas = Array.isArray(parsed?.ideas) ? parsed.ideas : [];
    const seen = new Set(existingTitles.map((title) => title.toLowerCase()));
    const modelIdeas = rawIdeas.filter(validIdea).filter((idea) => {
      const key = text(idea.title, 140).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, count);

    if (!modelIdeas.length) {
      return Response.json(
        { error: "The idea engine returned no valid original ideas. Nothing was fabricated." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const provenanceDetail = referenceLabels.length
      ? `Generated from your goal, topics, and the labels ${referenceLabels.join(", ")}. Mini CEO did not open or watch those references.`
      : "Generated from your creator goal, topics, platforms, and requested publishing pace.";

    return Response.json(
      {
        provider: "openrouter",
        model:
          typeof result?.model === "string" ? result.model.slice(0, 200) : configuredModel,
        generatedAt: new Date().toISOString(),
        ideas: modelIdeas.map((idea) => ({
          title: text(idea.title, 140),
          hook: text(idea.hook, 240),
          angle: text(idea.angle, 500),
          topic: text(idea.topic, 100),
          fitReason: text(idea.fitReason, 300),
          verificationNote: text(idea.researchNeeded, 300),
          provenance: {
            kind: "ai-original",
            label: "Generated by the live Mini CEO model",
            detail: provenanceDetail,
          },
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "The real idea engine is temporarily unavailable. No template ideas were substituted." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    clearTimeout(timeout);
  }
}
