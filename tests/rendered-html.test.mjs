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

test("assistant route returns grounded creator help without external configuration", async () => {
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
          idea: { title: "The AI update everyone is explaining wrong" },
        },
      }),
    }),
    bindings(),
    executionContext,
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.provider, "mini-ceo-local");
  assert.match(body.reply, /Three hooks/i);
  assert.match(body.reply, /AI update everyone is explaining wrong/i);
});

test("assistant route covers the creator workflow and validates requests", async () => {
  const worker = await getWorker();
  const cases = [
    ["Write a natural script outline", /Natural bullet outline/i],
    ["Build a production shot list", /Production checklist/i],
    ["Give me a research plan", /Research plan/i],
    ["Suggest a viral idea", /Use this angle/i],
  ];

  for (const [message, expected] of cases) {
    const response = await worker.fetch(
      new Request("http://localhost/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message,
          context: {
            goal: "Publish useful creator education three times a week",
            topics: ["creator systems"],
            bossMode: "coach",
            idea: { title: "A better weekly creator workflow" },
            skill: { length: "30 seconds" },
          },
        }),
      }),
      bindings(),
      executionContext,
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.provider, "mini-ceo-local");
    assert.match(body.reply, expected);
  }

  const invalidResponse = await worker.fetch(
    new Request("http://localhost/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "   " }),
    }),
    bindings(),
    executionContext,
  );

  assert.equal(invalidResponse.status, 400);
  assert.deepEqual(await invalidResponse.json(), { error: "Message is required" });
});

test("ships a complete installable PWA shell", async () => {
  const manifestPath = new URL("../public/manifest.webmanifest", import.meta.url);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  assert.equal(manifest.name, "Mini CEO - Your boss in your pocket");
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
  assert.match(serviceWorker, /mini-ceo-shell-v2/);
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

test("idea generation honors the creator's weekly publishing target", async () => {
  const { DEFAULT_PROFILE, generateIdeas } = await getStateModel();
  const ideas = generateIdeas(
    {
      ...DEFAULT_PROFILE,
      videosPerWeek: 6,
      topics: ["AI news", "creator systems"],
    },
    [],
  );

  assert.equal(ideas.length, 6);
  assert.equal(new Set(ideas.map((idea) => idea.title)).size, 6);
  assert.ok(ideas.every((idea) => idea.goalFit >= 82));
});
