import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function getWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  return (await import(workerUrl.href)).default;
}

let stateModelPromise;
async function getStateModel() {
  stateModelPromise ??= readFile(
    new URL("../app/lib/mini-ceo.ts", import.meta.url),
    "utf8",
  ).then(async (source) => {
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
      reportDiagnostics: true,
    });
    const errors = (compiled.diagnostics ?? []).filter(
      (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
    );
    assert.deepEqual(errors, []);
    const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`;
    return import(moduleUrl);
  });
  return stateModelPromise;
}

let bossAssetsPromise;
async function getBossAssets() {
  bossAssetsPromise ??= readFile(
    new URL("../app/lib/boss-assets.ts", import.meta.url),
    "utf8",
  ).then(async (source) => {
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
      reportDiagnostics: true,
    });
    const errors = (compiled.diagnostics ?? []).filter(
      (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
    );
    assert.deepEqual(errors, []);
    const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`;
    return import(moduleUrl);
  });
  return bossAssetsPromise;
}

function bindings() {
  return {
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
  };
}

const executionContext = {
  waitUntil() {},
  passThroughOnException() {},
};

test("server-renders Mini CEO metadata and branded loading state", async () => {
  const worker = await getWorker();
  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    bindings(),
    executionContext,
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Mini CEO - Your boss in your pocket(?: \| Mini CEO)?<\/title>/i);
  assert.match(html, /Mini CEO is reviewing the schedule\./i);
  assert.match(html, /manifest\.webmanifest/i);
  assert.match(html, /og\.png/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("legacy CSS boss is mounted only after a PNG asset error", async () => {
  const source = await readFile(
    new URL("../app/components/BossCharacter.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /\{assetFailed\s*&&\s*\(\s*<div className="boss-character-fallback"/);
  assert.doesNotMatch(source, /boss-asset-ready/);
  assert.doesNotMatch(source, /onLoad=\{\(\) => setLoadedAsset/);
});

test("classic Mac chrome exposes real commands and honest connection states", async () => {
  const source = await readFile(
    new URL("../app/mini-ceo-app.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /<span className="mac-menu-item">(?:File|Edit|View|Boss)<\/span>/);
  assert.match(source, /className=\{`mac-menu-command/);
  assert.match(source, /section=\{isDemoMode \? "Demo mode" : "Connections"\}/);
  assert.match(source, /function ConnectionsView/);
  assert.match(source, /Anything marked not connected has no hidden button or simulated data behind it/);
  assert.match(source, /Account and creator workspace/);
  assert.match(source, /Live boss agent/);
  assert.match(source, /ElevenLabs character voice/);
  assert.match(source, /iPhone Web Push/);
  assert.match(source, /Creator platforms/);
  assert.match(source, /Mini CEO editors marketplace/);
  assert.match(source, /Editor wallet payouts/);
});

test("editor marketplace persists a complete local workflow while payments stay disconnected", async () => {
  const [appSource, marketplaceSource, syncSource] = await Promise.all([
    readFile(new URL("../app/mini-ceo-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/EditorMarketplace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/sync/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(appSource, /projects=\{state\.editorProjects\}/);
  assert.match(appSource, /editorProjects: \[project, \.\.\.current\.editorProjects\]/);
  assert.match(marketplaceSource, /Local workflow simulator/);
  assert.match(marketplaceSource, /Simulate acceptance/);
  assert.match(marketplaceSource, /Simulate delivery/);
  assert.match(marketplaceSource, /Request changes/);
  assert.match(marketplaceSource, /Approve final cut/);
  assert.match(marketplaceSource, /cryptoPayouts: false/);
  assert.match(marketplaceSource, /USDC payout disabled/);
  assert.match(syncSource, /function isEditorProject/);
  assert.doesNotMatch(marketplaceSource, /fetch\(|QuickNode|onchainos|OKX_API_KEY|wallet\.send/);
});

test("private backend routes require host authentication before data access", async () => {
  const worker = await getWorker();
  for (const path of ["/api/sync", "/api/push"]) {
    const response = await worker.fetch(
      new Request(`http://localhost${path}`),
      bindings(),
      executionContext,
    );
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Authentication required" });
  }
});

test("hosted AI, voice, and push credentials remain server-side environment values", async () => {
  const sources = await Promise.all([
    readFile(new URL("../app/api/assistant/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/ideas/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/elevenlabs.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/push.ts", import.meta.url), "utf8"),
  ]);
  const source = sources.join("\n");
  assert.match(source, /process\.env\.OPENROUTER_API_KEY/);
  assert.match(source, /process\.env\.ELEVENLABS_API_KEY/);
  assert.match(source, /process\.env\.VAPID_PRIVATE_KEY/);
  assert.doesNotMatch(source, /sk-(?:or-)?v?1?-[A-Za-z0-9]{20,}/);
});

test("assistant route refuses to simulate creator help without a live provider", async () => {
  const worker = await getWorker();
  const response = await worker.fetch(
    new Request("http://localhost/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: "Give me three stronger hooks",
        context: {
          goal: "Make AI news useful for working creators",
          topics: ["AI news"],
          bossMode: "serious",
        },
      }),
    }),
    bindings(),
    executionContext,
  );

  assert.equal(response.status, 503);
  const body = await response.json();
  assert.match(body.error, /No simulated reply was substituted/i);
  assert.equal(body.reply, undefined);
});

test("demo assistant never substitutes canned dialogue for a live agent", async () => {
  const worker = await getWorker();
  const response = await worker.fetch(
    new Request("http://localhost/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: "What task should I do today?",
        demo: true,
        history: [
          {
            role: "boss",
            text: "You missed the AI dog pooper scooper publish deadline.",
          },
        ],
        context: {
          goal: "Turn weird AI products into useful and funny short form reviews.",
          topics: ["weird AI products"],
          bossMode: "unhinged",
          missedDays: 3,
          task: {
            title: "Publish the AI dog pooper scooper video",
            status: "active",
            stage: "publish",
          },
        },
      }),
    }),
    bindings(),
    executionContext,
  );

  assert.equal(response.status, 503);
  const body = await response.json();
  assert.match(body.error, /No simulated reply was substituted/i);
  assert.equal(body.reply, undefined);
});

test("idea route refuses to substitute templates without the live model", async () => {
  const worker = await getWorker();
  const response = await worker.fetch(
    new Request("http://localhost/api/ideas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        goal: "Make AI news useful for working creators",
        topics: ["AI news"],
        platforms: ["TikTok"],
        count: 3,
      }),
    }),
    bindings(),
    executionContext,
  );

  assert.equal(response.status, 503);
  const body = await response.json();
  assert.match(body.error, /No template ideas were (?:generated|substituted)/i);
  assert.equal(body.ideas, undefined);
});

test("assistant route validates empty requests before contacting providers", async () => {
  const worker = await getWorker();
  const response = await worker.fetch(
    new Request("http://localhost/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "   " }),
    }),
    bindings(),
    executionContext,
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Message is required" });
});

test("ships a complete installable PWA shell", async () => {
  const manifestPath = new URL("../public/manifest.webmanifest", import.meta.url);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  assert.equal(manifest.name, "Mini CEO - Your boss in your pocket");
  assert.equal(manifest.id, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.icons.length, 2);
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ["192x192", "512x512"]);

  await Promise.all([
    access(new URL("../public/icon-192.png", import.meta.url)),
    access(new URL("../public/icon-512.png", import.meta.url)),
    access(new URL("../public/sw.js", import.meta.url)),
  ]);

  const serviceWorker = await readFile(
    new URL("../public/sw.js", import.meta.url),
    "utf8",
  );
  assert.match(serviceWorker, /mini-ceo-shell-v3/);
  assert.match(serviceWorker, /addEventListener\("push"/);
  assert.match(serviceWorker, /showNotification/);
});

test("ships every typed Mini CEO expression and action asset", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../public/characters/mini-ceo/manifest.json", import.meta.url),
      "utf8",
    ),
  );
  const { BOSS_ACTION_ASSETS, BOSS_EXPRESSION_ASSETS } = await getBossAssets();

  assert.deepEqual(BOSS_EXPRESSION_ASSETS, manifest.expressions);
  assert.deepEqual(BOSS_ACTION_ASSETS, manifest.actions);

  for (const assetPath of [
    ...Object.values(BOSS_EXPRESSION_ASSETS),
    ...Object.values(BOSS_ACTION_ASSETS),
  ]) {
    const image = await readFile(
      new URL(`../public${assetPath}`, import.meta.url),
    );
    assert.deepEqual([...image.subarray(1, 4)], [80, 78, 71]);
    assert.equal(image.readUInt32BE(16), 512);
    assert.equal(image.readUInt32BE(20), 512);
  }
});

test("conversation portraits follow the real agent response and live interaction phase", async () => {
  const {
    inferBossExpression,
    resolveConversationBossExpression,
  } = await getBossAssets();

  assert.equal(
    inferBossExpression(
      "You lazy fuck, you missed three days. Get your ass in gear and publish it right now.",
      "unhinged",
    ),
    "focused",
  );
  assert.equal(
    inferBossExpression("The deadline is overdue. Publish immediately.", "unhinged"),
    "impatient",
  );
  assert.equal(
    inferBossExpression("You did it. The video is published. Let's go!", "unhinged"),
    "celebrating",
  );
  assert.equal(
    inferBossExpression("Good move. That's exactly the right next step.", "serious"),
    "approving",
  );
  assert.equal(
    inferBossExpression("We need proof, so verify the claim before you post.", "serious"),
    "concerned",
  );
  assert.equal(
    inferBossExpression("Let's think through three options for the hook.", "serious"),
    "thinking",
  );
  assert.equal(
    resolveConversationBossExpression({
      message: "You missed the deadline.",
      mode: "unhinged",
      phase: "thinking",
    }),
    "thinking",
  );
  assert.equal(
    resolveConversationBossExpression({
      message: "You missed the deadline.",
      mode: "unhinged",
      phase: "error",
    }),
    "concerned",
  );

  const appSource = await readFile(
    new URL("../app/mini-ceo-app.tsx", import.meta.url),
    "utf8",
  );
  assert.match(appSource, /resolveConversationBossExpression/);
  assert.doesNotMatch(appSource, /isSpeaking \? "surprised"/);
});

test("state model maintains real streaks and rolls weekly metrics forward", async () => {
  const {
    calculateCreatorStreak,
    createEmptyState,
    rolloverMiniCeoState,
    weekStartKey,
  } = await getStateModel();
  const now = new Date(2026, 7, 6, 12, 0, 0);

  assert.equal(weekStartKey(now), "2026-08-03");
  assert.equal(
    calculateCreatorStreak(["2026-08-03", "2026-08-04", "2026-08-05"], now),
    3,
  );

  const previous = createEmptyState(new Date(2026, 6, 30, 12, 0, 0));
  const rolled = rolloverMiniCeoState(
    {
      ...previous,
      weekStartDate: "2026-07-27",
      publishedThisWeek: 2,
      weeklyScore: 92,
      activityDates: ["2026-08-04", "2026-08-05", "2026-08-06"],
      tasks: [
        {
          id: "task_done",
          ideaId: "idea_1",
          stage: "research",
          title: "Finished task",
          brief: "Already complete",
          day: "Thursday",
          scheduledDate: "2026-07-30",
          dueAt: "2026-07-30T13:30:00.000Z",
          weekStartDate: "2026-07-27",
          time: "09:30",
          duration: 25,
          status: "done",
        },
        {
          id: "task_active",
          ideaId: "idea_2",
          stage: "script",
          title: "Current task",
          brief: "Keep moving",
          day: "Thursday",
          scheduledDate: "2026-08-06",
          dueAt: "2026-08-06T17:30:00.000Z",
          weekStartDate: "2026-07-27",
          time: "13:30",
          duration: 35,
          status: "active",
        },
      ],
    },
    now,
  );

  assert.equal(rolled.weekStartDate, "2026-08-03");
  assert.equal(rolled.publishedThisWeek, 0);
  assert.equal(rolled.weeklyScore, 0);
  assert.equal(rolled.streak, 3);
  assert.equal(rolled.tasks[0].weekStartDate, "2026-07-27");
  assert.equal(rolled.tasks[1].weekStartDate, "2026-08-03");
});

test("demo mode seeds a complete isolated presentation story", async () => {
  const { createDemoState, DEMO_STORAGE_KEY, STORAGE_KEY } = await getStateModel();
  const demo = createDemoState(new Date(2026, 7, 6, 12, 0, 0));

  assert.notEqual(DEMO_STORAGE_KEY, STORAGE_KEY);
  assert.equal(demo.onboardingComplete, true);
  assert.equal(demo.profile.name, "Alex");
  assert.equal(demo.profile.bossMode, "unhinged");
  assert.equal(demo.publishedThisWeek, 1);
  assert.equal(demo.streak, 0);
  assert.equal(demo.skills.length, 2);
  assert.equal(demo.ideas.length, 5);
  assert.equal(demo.tasks.filter((task) => task.status === "active").length, 1);
  assert.match(
    demo.tasks.find((task) => task.status === "active").title,
    /AI dog pooper scooper/i,
  );
  assert.equal(
    new Date(2026, 7, 6, 12, 0, 0).getTime() -
      new Date(demo.tasks.find((task) => task.status === "active").dueAt).getTime(),
    3 * 24 * 60 * 60 * 1000,
  );
  assert.ok(demo.tasks.filter((task) => task.status === "done").length >= 7);
  assert.ok(demo.achievements.some((achievement) => achievement.title === "First publish"));
  assert.equal(demo.editorProjects.length, 1);
  assert.equal(demo.editorProjects[0].status, "delivered");
});

test("workspace migration adds editor projects safely and preserves valid lifecycle state", async () => {
  const { createEmptyState, migrateMiniCeoState } = await getStateModel();
  const now = new Date(2026, 7, 6, 12, 0, 0);
  const legacy = createEmptyState(now);
  delete legacy.editorProjects;

  const migratedLegacy = migrateMiniCeoState(legacy, now);
  assert.equal(migratedLegacy.version, 3);
  assert.deepEqual(migratedLegacy.editorProjects, []);

  const project = {
    id: "editor_project_1",
    editorId: "amina-duarte",
    editorName: "Amina Duarte",
    editorStudio: "Cut Room 11",
    title: "Launch recap",
    deliverable: "Short-form vertical video",
    budget: "$150",
    deadline: "2026-08-12",
    brief: "Create a clean launch recap with captions and a strong opening beat.",
    referenceUrl: "https://example.com/brief",
    status: "changes_requested",
    deliveryUrl: "https://example.com/cut",
    deliveryNote: "First cut ready for review.",
    revisionNote: "Tighten the first ten seconds.",
    createdAt: "2026-08-06T12:00:00.000Z",
    updatedAt: "2026-08-06T13:00:00.000Z",
    approvedAt: "",
  };
  const migrated = migrateMiniCeoState({ ...legacy, editorProjects: [project] }, now);
  assert.equal(migrated.editorProjects.length, 1);
  assert.equal(migrated.editorProjects[0].status, "changes_requested");
  assert.equal(migrated.editorProjects[0].revisionNote, "Tighten the first ten seconds.");
});

test("accountability ladder respects quiet hours and boss-specific pressure", async () => {
  const { DEFAULT_PROFILE, getAccountabilityReminder, isQuietTime } = await getStateModel();
  const task = {
    id: "task_reminder",
    ideaId: "idea_reminder",
    stage: "script",
    title: "Lock the script",
    brief: "Choose the hook and finish the draft.",
    day: "Thursday",
    scheduledDate: "2026-08-06",
    dueAt: "2026-08-06T18:00:00.000Z",
    weekStartDate: "2026-08-03",
    time: "14:00",
    duration: 35,
    status: "active",
  };

  assert.equal(
    isQuietTime({ start: "21:00", end: "08:00" }, new Date(2026, 7, 6, 22, 0, 0)),
    true,
  );

  const quiet = getAccountabilityReminder(
    { ...DEFAULT_PROFILE, quietHours: { start: "21:00", end: "08:00" } },
    task,
    new Date(2026, 7, 6, 22, 0, 0),
  );
  assert.equal(quiet.urgency, "quiet");
  assert.equal(quiet.quiet, true);

  const overdueTask = { ...task, dueAt: "2026-08-06T14:00:00.000Z" };
  const unhinged = getAccountabilityReminder(
    { ...DEFAULT_PROFILE, bossMode: "unhinged", quietHours: { start: "23:00", end: "07:00" } },
    overdueTask,
    new Date(2026, 7, 6, 16, 1, 0),
  );
  const coach = getAccountabilityReminder(
    { ...DEFAULT_PROFILE, bossMode: "coach", quietHours: { start: "23:00", end: "07:00" } },
    overdueTask,
    new Date(2026, 7, 6, 16, 1, 0),
  );

  assert.match(unhinged.cadence, /every 1 hour/i);
  assert.match(coach.cadence, /every 6 hours/i);
  assert.notEqual(unhinged.key, coach.key);
});

test("production idea flow contains no template generator or fake scoring", async () => {
  const [stateSource, appSource, ideaRouteSource] = await Promise.all([
    readFile(new URL("../app/lib/mini-ceo.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/mini-ceo-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/ideas/route.ts", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(stateSource, /function generateIdeas|goalFit:\s*Math\.max/);
  assert.doesNotMatch(appSource, /setTimeout\(resolve,\s*850|% goal fit|Content Skill grew/);
  assert.match(ideaRouteSource, /process\.env\.OPENROUTER_API_KEY/);
  assert.match(ideaRouteSource, /No template ideas were (?:generated|substituted)/);
  assert.match(ideaRouteSource, /kind:\s*"ai-original"/);
  assert.match(ideaRouteSource, /Researched \$\{researchedAt\.toISOString\(\)\}/);
});
