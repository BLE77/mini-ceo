type IdeaGenerationRequest = {
  goal?: unknown;
  topics?: unknown;
  platforms?: unknown;
  bossMode?: unknown;
  count?: unknown;
  referenceLabels?: unknown;
  existingTitles?: unknown;
};

type ResearchSignal = {
  headline?: unknown;
  summary?: unknown;
  whyNow?: unknown;
  viralEvidence?: unknown;
  topic?: unknown;
  sourceUrls?: unknown;
};

type ModelIdea = {
  signalIndex?: unknown;
  title?: unknown;
  hook?: unknown;
  angle?: unknown;
  topic?: unknown;
  fitReason?: unknown;
  researchNeeded?: unknown;
};

type UrlCitationAnnotation = {
  type?: unknown;
  url_citation?: {
    url?: unknown;
    title?: unknown;
    content?: unknown;
  };
};

type OpenRouterResponse = {
  model?: unknown;
  choices?: Array<{
    message?: {
      content?: unknown;
      annotations?: unknown;
    };
  }>;
  usage?: {
    server_tool_use?: {
      web_search_requests?: unknown;
    };
  };
};

type VerifiedSource = {
  url: string;
  title: string;
  excerpt: string;
  channel: "x" | "news";
};

type VerifiedSignal = {
  headline: string;
  summary: string;
  whyNow: string;
  viralEvidence: string;
  topic: string;
  sources: VerifiedSource[];
  hasXSource: boolean;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_RESEARCH_MODEL = "x-ai/grok-4.3";
const RESEARCH_TIMEOUT_MS = 45_000;
const GENERATION_TIMEOUT_MS = 25_000;

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
    return JSON.parse(unfenced.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function safeHttpUrl(value: unknown) {
  const candidate = text(value, 2_000);
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function sourceKey(value: string) {
  try {
    const url = new URL(value);
    return `${url.hostname.toLowerCase().replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return "";
  }
}

function sourceDomain(value: string) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "source";
  }
}

function isXUrl(value: string) {
  const domain = sourceDomain(value);
  return domain === "x.com" || domain === "twitter.com";
}

function extractCitations(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const citations: VerifiedSource[] = [];

  for (const annotation of value as UrlCitationAnnotation[]) {
    if (annotation?.type !== "url_citation") continue;
    const url = safeHttpUrl(annotation.url_citation?.url);
    const key = sourceKey(url);
    if (!url || !key || seen.has(key)) continue;
    seen.add(key);
    citations.push({
      url,
      title: text(annotation.url_citation?.title, 240) || sourceDomain(url),
      excerpt: text(annotation.url_citation?.content, 1_200),
      channel: isXUrl(url) ? "x" : "news",
    });
  }

  return citations;
}

function verifySignals(value: unknown, citations: VerifiedSource[]) {
  if (!Array.isArray(value)) return [];
  const citationByKey = new Map(citations.map((citation) => [sourceKey(citation.url), citation]));
  const seen = new Set<string>();
  const verified: VerifiedSignal[] = [];

  for (const entry of value as ResearchSignal[]) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const headline = text(entry.headline, 180);
    const summary = text(entry.summary, 700);
    const whyNow = text(entry.whyNow, 400);
    const viralEvidence = text(entry.viralEvidence, 500);
    const topic = text(entry.topic, 100);
    const requestedUrls = stringList(entry.sourceUrls, 8, 2_000);
    const sources = Array.from(
      new Map(
        requestedUrls
          .map((url) => citationByKey.get(sourceKey(url)))
          .filter((source): source is VerifiedSource => Boolean(source))
          .map((source) => [sourceKey(source.url), source]),
      ).values(),
    );
    const key = headline.toLowerCase();

    // A signal needs two actual search citations and at least one non-social source.
    // X-only chatter can be useful research, but it is not independently verified news.
    if (
      !headline ||
      !summary ||
      !whyNow ||
      !viralEvidence ||
      !topic ||
      sources.length < 2 ||
      !sources.some((source) => source.channel === "news") ||
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);
    verified.push({
      headline,
      summary,
      whyNow,
      viralEvidence,
      topic,
      sources,
      hasXSource: sources.some((source) => source.channel === "x"),
    });
  }

  return verified.slice(0, 10);
}

function validIdea(value: unknown): value is ModelIdea {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const idea = value as ModelIdea;
  return Boolean(
    Number.isInteger(Number(idea.signalIndex)) &&
      text(idea.title, 140) &&
      text(idea.hook, 240) &&
      text(idea.angle, 500) &&
      text(idea.topic, 100) &&
      text(idea.fitReason, 300) &&
      text(idea.researchNeeded, 300),
  );
}

async function callOpenRouter({
  apiKey,
  model,
  timeoutMs,
  payload,
  operation,
}: {
  apiKey: string;
  model: string;
  timeoutMs: number;
  payload: Record<string, unknown>;
  operation: "research" | "generation";
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://mini-ceo-creator.ble77.chatgpt.site",
        "X-OpenRouter-Title": "Mini CEO Live Trend Research",
      },
      signal: controller.signal,
      body: JSON.stringify({ model, ...payload }),
    });

    if (!response.ok) {
      const providerBody = (await response.json().catch(() => null)) as
        | { error?: { message?: unknown } }
        | null;
      console.error(`OpenRouter ${operation} failed`, {
        status: response.status,
        model,
        message: text(providerBody?.error?.message, 300) || "Provider request failed",
      });
      return null;
    }

    return (await response.json().catch(() => null)) as OpenRouterResponse | null;
  } catch (error) {
    console.error(`OpenRouter ${operation} unavailable`, {
      model,
      cause: error instanceof Error && error.name === "AbortError" ? "timeout" : "network",
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function publicSources(sources: VerifiedSource[]) {
  return sources.map(({ url, title, channel }) => ({ url, title, channel }));
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const configuredModel = process.env.OPENROUTER_MODEL?.trim();
  const researchModel =
    process.env.OPENROUTER_RESEARCH_MODEL?.trim() || DEFAULT_RESEARCH_MODEL;
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

  const researchedAt = new Date();
  const fromDate = new Date(researchedAt.getTime() - 7 * 24 * 60 * 60 * 1_000)
    .toISOString()
    .slice(0, 10);
  const toDate = researchedAt.toISOString().slice(0, 10);
  const researchResult = await callOpenRouter({
    apiKey,
    model: researchModel,
    timeoutMs: RESEARCH_TIMEOUT_MS,
    operation: "research",
    payload: {
      temperature: 0.1,
      max_tokens: 3_800,
      plugins: [
        {
          id: "web",
          engine: "native",
          max_results: 10,
        },
      ],
      x_search_filter: {
        from_date: fromDate,
        to_date: toDate,
      },
      messages: [
        {
          role: "system",
          content:
            "You are the live research desk for Mini CEO. You MUST use the search tool to investigate current news, primary sources, credible reporting, and public X posts before answering. Find concrete developments from the last seven days that can support timely short-form creator coverage. Look for independent confirmation and observable X discussion, but never invent or estimate views, likes, reposts, rankings, or virality. A topic is not viral merely because it is interesting. Use exact URLs returned by search. Return JSON only with this shape: {\"signals\":[{\"headline\":\"factual event\",\"summary\":\"what actually happened\",\"whyNow\":\"date-specific reason it matters now\",\"viralEvidence\":\"observable reporting or X discussion without invented numbers\",\"topic\":\"matching creator topic\",\"sourceUrls\":[\"exact searched URL\",\"exact searched URL\"]}]}. Each signal must cite at least two searched sources, including at least one credible non-social source; seek at least one X post too. If a claim cannot be verified from searched sources, omit it. If there are no verified signals, return {\"signals\":[]}. Do not add markdown or commentary.",
        },
        {
          role: "user",
          content: JSON.stringify({
            currentDate: toDate,
            searchWindowStart: fromDate,
            creatorGoal: goal,
            topics,
            platforms,
            requestedSignals: Math.min(10, Math.max(count * 2, 6)),
            searchInstructions: [
              "Search current reporting and primary announcements for each topic.",
              "Search X for the same developments and public discussion around them.",
              "Favor specific events, releases, disputes, data, or surprising changes over evergreen advice.",
            ],
          }),
        },
      ],
    },
  });

  const researchMessage = researchResult?.choices?.[0]?.message;
  const researchContent = researchMessage?.content;
  const citations = extractCitations(researchMessage?.annotations);
  // Some native providers omit the optional usage counter. Standardized URL
  // annotations are stronger proof that live search actually returned sources.
  if (!researchResult || typeof researchContent !== "string" || citations.length < 2) {
    return Response.json(
      {
        error:
          "Live news and X research did not complete, so Mini CEO refused to invent trend ideas. Try again shortly.",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const researchJson = parseModelJson(researchContent);
  const verifiedSignals = verifySignals(researchJson?.signals, citations);
  if (!verifiedSignals.length || !verifiedSignals.some((signal) => signal.hasXSource)) {
    return Response.json(
      {
        error:
          "No story had enough verified current-news and X evidence to recommend right now. Nothing was fabricated.",
      },
      { status: 422, headers: { "Cache-Control": "no-store" } },
    );
  }

  const generationResult = await callOpenRouter({
    apiKey,
    model: configuredModel,
    timeoutMs: GENERATION_TIMEOUT_MS,
    operation: "generation",
    payload: {
      temperature: bossMode === "unhinged" ? 0.86 : bossMode === "coach" ? 0.62 : 0.72,
      max_tokens: 2_500,
      messages: [
        {
          role: "system",
          content:
            "You are Mini CEO, an active boss for short-form creators. Turn only the supplied verified research signals into specific, executable video concepts. You may sharpen the language and point of view, but you may not add facts, engagement numbers, dates, or trend claims that are absent from the signal. Never copy a living creator's distinctive expression. Each hook must be speakable on camera; each angle must say what the video delivers; each fitReason must connect to the creator's goal; researchNeeded must name the final fact or source check to do before scripting. signalIndex must exactly identify the source signal used. Return JSON only with this exact shape: {\"ideas\":[{\"signalIndex\":0,\"title\":\"...\",\"hook\":\"...\",\"angle\":\"...\",\"topic\":\"...\",\"fitReason\":\"...\",\"researchNeeded\":\"...\"}]}. Do not add markdown or commentary.",
        },
        {
          role: "user",
          content: JSON.stringify({
            requestedIdeaCount: count,
            creatorGoal: goal,
            platforms,
            managementTone: bossMode,
            referenceLabels,
            referenceWarning:
              "These are user-supplied labels only. Their contents were not provided and must not be described.",
            titlesToAvoid: existingTitles,
            verifiedSignals: verifiedSignals.map((signal, signalIndex) => ({
              signalIndex,
              headline: signal.headline,
              summary: signal.summary,
              whyNow: signal.whyNow,
              viralEvidence: signal.viralEvidence,
              topic: signal.topic,
              sources: publicSources(signal.sources),
            })),
          }),
        },
      ],
    },
  });

  const generationContent = generationResult?.choices?.[0]?.message?.content;
  if (!generationResult || typeof generationContent !== "string") {
    return Response.json(
      { error: "The boss could not turn the verified research into ideas. Nothing was fabricated." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const generationJson = parseModelJson(generationContent);
  const rawIdeas = Array.isArray(generationJson?.ideas) ? generationJson.ideas : [];
  const seen = new Set(existingTitles.map((title) => title.toLowerCase()));
  const modelIdeas = rawIdeas
    .filter(validIdea)
    .filter((idea) => {
      const signalIndex = Number(idea.signalIndex);
      const key = text(idea.title, 140).toLowerCase();
      if (!verifiedSignals[signalIndex] || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, count);

  if (!modelIdeas.length) {
    return Response.json(
      { error: "The boss returned no usable ideas from the verified research. Nothing was fabricated." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const allSources = Array.from(
    new Map(
      verifiedSignals
        .flatMap((signal) => signal.sources)
        .map((source) => [sourceKey(source.url), source]),
    ).values(),
  );

  return Response.json(
    {
      provider: "openrouter",
      model:
        typeof generationResult.model === "string"
          ? generationResult.model.slice(0, 200)
          : configuredModel,
      researchModel:
        typeof researchResult.model === "string"
          ? researchResult.model.slice(0, 200)
          : researchModel,
      generatedAt: new Date().toISOString(),
      researchedAt: researchedAt.toISOString(),
      searchWindow: { from: fromDate, to: toDate },
      sources: publicSources(allSources),
      ideas: modelIdeas.map((idea) => {
        const signal = verifiedSignals[Number(idea.signalIndex)];
        const sourceSummary = signal.sources
          .slice(0, 4)
          .map((source) => `${source.title} (${source.url})`)
          .join("; ");
        return {
          title: text(idea.title, 140),
          hook: text(idea.hook, 240),
          angle: text(idea.angle, 500),
          topic: text(idea.topic, 100),
          fitReason: text(idea.fitReason, 300),
          verificationNote: text(idea.researchNeeded, 300),
          provenance: {
            kind: "ai-original",
            label: signal.hasXSource ? "Live news + X signal" : "Live news signal",
            detail: `Researched ${researchedAt.toISOString()}. Why now: ${signal.whyNow} Sources: ${sourceSummary}`.slice(
              0,
              1_500,
            ),
          },
        };
      }),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
