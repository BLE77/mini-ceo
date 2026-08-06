type AssistantContext = {
  goal?: string;
  topics?: string[];
  bossMode?: "coach" | "serious" | "unhinged";
  task?: { title?: string; brief?: string; stage?: string };
  idea?: { title?: string; hook?: string; angle?: string };
  skill?: {
    name?: string;
    hook?: string;
    pacing?: string;
    tone?: string;
    visualFormat?: string;
    length?: string;
  };
  reference?: AssistantReference;
  references?: AssistantReference[];
};

type AssistantReference = {
  name?: string;
  title?: string;
  url?: string;
  type?: string;
};

type AssistantRequest = {
  message?: string;
  context?: AssistantContext;
};

function referenceNames(context: AssistantContext) {
  return [context.reference, ...(context.references || [])]
    .filter((reference): reference is AssistantReference => Boolean(reference))
    .map(
      (reference) =>
        reference.name || reference.title || reference.url || reference.type || "uploaded example",
    )
    .slice(0, 3);
}

function contextNotes(context: AssistantContext) {
  const notes = [`Goal: ${context.goal || "publish consistently"}`];
  if (context.task?.title) {
    notes.push(
      `Current assignment: ${context.task.title}${context.task.stage ? ` (${context.task.stage})` : ""}`,
    );
  }
  if (context.skill?.name) notes.push(`Content Skill: ${context.skill.name}`);
  const references = referenceNames(context);
  if (references.length) notes.push(`References: ${references.join(", ")}`);
  return `Context used:\n- ${notes.join("\n- ")}`;
}

function localReply(message: string, context: AssistantContext) {
  const prompt = message.toLowerCase();
  const topic = context.topics?.[0] || "your topic";
  const idea = context.idea?.title || context.task?.title || `a video about ${topic}`;
  const goal = context.goal || "publish consistently";
  const angle =
    context.idea?.angle ||
    context.task?.brief ||
    `show the audience why ${topic} matters and what to do next`;
  const skillHook = context.skill?.hook;
  const hook =
    context.idea?.hook ||
    skillHook ||
    `Most people are looking at ${idea} the wrong way—here is what actually matters.`;
  const length = context.skill?.length || "30-45 seconds";
  const tone = context.skill?.tone || "clear, conversational authority";
  const pacing = context.skill?.pacing || "a fast hook, one clean explanation, and a decisive close";
  const visualFormat = context.skill?.visualFormat || "face-to-camera with proof on screen";
  const references = referenceNames(context);
  const referenceDirection = references.length
    ? `Use ${references.join(", ")} as structural inspiration for the hook and pacing, while keeping the wording original.`
    : "Keep the wording original and grounded in verified information.";
  const mode = context.bossMode || "serious";
  const opening =
    mode === "coach"
      ? "Good. Let’s make this easier to execute."
      : mode === "unhinged"
        ? "Emergency creative meeting. I have notes."
        : "Here is the decision and the next action.";

  if (/hook|opening|first line/.test(prompt)) {
    return `${opening}\n\nThree hooks for “${idea}”:\n\n1. ${hook}\n2. If your goal is to ${goal.toLowerCase()}, do not ignore what “${idea}” changes for you.\n3. Everyone sees “${idea}.” Almost nobody is talking about this angle: ${angle}.\n\nUse hook 1 for the closest match to your saved Content Skill, hook 2 for direct goal relevance, or hook 3 for curiosity. Deliver it in a ${tone} tone, follow ${pacing}, and change the first visual within two seconds. ${referenceDirection}\n\n${contextNotes(context)}`;
  }

  if (/script|write/.test(prompt)) {
    return `${opening}\n\nFull short-form script (${length})\n\n[Hook | 0-3 seconds]\n“${hook}”\n\n[Set-up | 3-9 seconds]\n“Here’s the part worth paying attention to: ${angle}. The headline is not useful unless we turn it into a decision.”\n\n[Value | 9-25 seconds]\n“First, separate what is confirmed from what people are assuming. Then ask what this changes for the audience right now. For this story, the useful takeaway is not to repeat the trend—it’s to understand how ‘${idea}’ affects the next move.”\n\n[Goal connection | 25-35 seconds]\n“If you are working to ${goal.toLowerCase()}, use this as a filter: keep the part that helps your audience make a clearer decision, and cut everything that is just noise.”\n\n[Close | final 5-8 seconds]\n“What would you do with this—use it now, test it first, or skip it? Tell me your call.”\n\nNatural bullet outline (optional delivery version)\n\n- Open with: “${hook}”\n- Explain the angle in one sentence: ${angle}.\n- Share only confirmed information; do not invent a fact to fill the script.\n- State what “${idea}” changes for the viewer.\n- Tie the takeaway directly to: ${goal}.\n- Close by asking the viewer to choose: use it, test it, or skip it.\n\nPerformance direction: use ${visualFormat}, a ${tone} tone, and ${pacing}. ${referenceDirection}\n\n${contextNotes(context)}`;
  }

  if (/bullet|outline/.test(prompt)) {
    return `${opening}\n\nNatural bullet outline:\n\n- Hook: “${hook}”\n- Context: explain “${idea}” in one plain-language sentence.\n- Angle: ${angle}.\n- Proof: include the two strongest verified details and show the source on screen.\n- Meaning: explain how it supports the goal “${goal}.”\n- Takeaway: give the viewer one decision or action.\n- Close: ask a specific question tied to the idea.\n\nAim for ${length}. Deliver it with ${tone} and ${pacing}. ${referenceDirection}\n\n${contextNotes(context)}`;
  }

  if (/prop|shot|production|visual|b-roll|b roll/.test(prompt)) {
    return `${opening}\n\nProduction checklist for “${idea}”:\n\n- Format: ${visualFormat}.\n- Record the hook “${hook}” as a clean, separate first take.\n- Capture eye-level A-roll that explains this angle: ${angle}.\n- Show one primary source, headline, or reference frame as proof—not decoration.\n- Add one screen recording or close-up that makes the idea concrete.\n- Use two punch-ins at the strongest claims to support ${pacing}.\n- Match the saved skill tone: ${tone}.\n- Keep the finished video near ${length}.\n- Quiet room, charged phone, clean lens, and a ten-minute setup limit.\n\n${referenceDirection} Shoot the complete A-roll first; do not stop to edit between takes. This production plan serves the current goal: ${goal}.\n\n${contextNotes(context)}`;
  }

  if (/research|source|fact|verify/.test(prompt)) {
    return `${opening}\n\nResearch plan for “${idea}”:\n\n1. Define the exact claim behind this angle: ${angle}.\n2. Find the original announcement, study, data set, interview, or source document.\n3. Confirm the publication date, exact wording, and whether a newer update changes the claim.\n4. Find one credible independent source that explains or challenges it.\n5. Extract the three verified details that best help the goal “${goal}.”\n6. Compare the evidence with the hook “${hook}”; rewrite the hook if the proof does not support it.\n7. Save one on-screen proof asset for the ${visualFormat} format.\n\n${referenceDirection} Stop after 25 minutes unless a core claim is still unverified; uncertainty must be stated in the content, not hidden.\n\n${contextNotes(context)}`;
  }

  if (/idea|viral|trend|concept/.test(prompt)) {
    return `${opening}\n\nIdea: “The ${topic} shift everyone noticed—but almost nobody turned into a useful next step.”\n\nUse this angle: ${angle}.\n\nHook: “If you care about ${goal.toLowerCase()}, this ${topic} shift is the part you should not scroll past.”\n\nWhy it fits: it uses ${context.skill?.name ? `your “${context.skill.name}” Content Skill` : "a corrective, practical structure"} to turn a timely signal into a concrete takeaway for the creator goal “${goal}.” ${referenceDirection}\n\nBefore approving it, write the single decision the viewer should be able to make after watching.\n\n${contextNotes(context)}`;
  }

  return `${opening}\n\nYour current priority is ${context.task?.title?.toLowerCase() || "moving one approved idea forward"}. ${context.task?.brief || `Keep the work tied to your goal: ${goal}.`}\n\nNext move: spend ten focused minutes advancing “${idea}” through ${context.task?.stage || "its current stage"}. Ask me for hooks, a full script plus natural bullet version, a research plan, or a production checklist and I’ll apply your goal, Content Skill, and references.\n\n${contextNotes(context)}`;
}

async function hermesReply(message: string, context: AssistantContext) {
  const url = process.env.HERMES_API_URL;
  if (!url) return null;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.HERMES_API_KEY
        ? { Authorization: `Bearer ${process.env.HERMES_API_KEY}` }
        : {}),
    },
    body: JSON.stringify({
      agent: "mini-ceo",
      message,
      context,
      system:
        "You are Mini CEO, an active but useful creator boss. Help the user move short-form content from idea to publish. Be specific, concise, and grounded in their creator goal and Content Skill. Never attack identity, appearance, trauma, family, disability, or mental health.",
    }),
  });

  if (!response.ok) return null;
  const data = (await response.json()) as {
    reply?: string;
    message?: string;
    content?: string;
  };
  return data.reply || data.message || data.content || null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AssistantRequest;
    const message = body.message?.trim();
    if (!message) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }
    const context = body.context || {};

    const hermes = await hermesReply(message, context).catch(() => null);
    if (hermes) {
      return Response.json({ reply: hermes, provider: "hermes" });
    }

    return Response.json({
      reply: localReply(message, context),
      provider: "mini-ceo-local",
    });
  } catch {
    return Response.json({ error: "Invalid assistant request" }, { status: 400 });
  }
}
