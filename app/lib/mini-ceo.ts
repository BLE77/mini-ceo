export type BossMode = "coach" | "serious" | "unhinged";
export type AppView =
  | "today"
  | "ideas"
  | "schedule"
  | "skills"
  | "review"
  | "connections";
export type TaskStage =
  | "idea"
  | "research"
  | "script"
  | "production"
  | "shoot"
  | "edit"
  | "publish";
export type TaskStatus = "queued" | "active" | "done" | "skipped";

export interface CreatorProfile {
  name: string;
  goal: string;
  platforms: string[];
  videosPerWeek: number;
  topics: string[];
  scheduleStyle: "daily" | "batch";
  workDays: string[];
  bossMode: BossMode;
  quietHours: { start: string; end: string };
}

export interface ReferenceAsset {
  id: string;
  label: string;
  sourceType: "link" | "video" | "script";
  sourceValue: string;
  createdAt: string;
}

export interface ContentSkill {
  id: string;
  name: string;
  hook: string;
  pacing: string;
  tone: string;
  visualFormat: string;
  length: string;
  examples: number;
  confidence: number;
}

export interface Idea {
  id: string;
  title: string;
  hook: string;
  angle: string;
  topic: string;
  goalFit?: number;
  fitReason?: string;
  verificationNote?: string;
  provenance?: {
    kind: "ai-original" | "creator-input";
    label: string;
    detail: string;
  };
  source: "boss" | "creator";
  status: "suggested" | "approved" | "rejected";
  skillId?: string;
}

export interface Evidence {
  type: "done" | "file" | "link";
  value: string;
  createdAt: string;
}

export interface CreatorTask {
  id: string;
  ideaId: string;
  stage: TaskStage;
  title: string;
  brief: string;
  day: string;
  scheduledDate: string;
  dueAt: string;
  weekStartDate: string;
  time: string;
  duration: number;
  status: TaskStatus;
  evidence?: Evidence;
}

export interface Achievement {
  id: string;
  title: string;
  detail: string;
  unlockedAt: string;
}

export interface MiniCeoState {
  version: number;
  onboardingComplete: boolean;
  profile: CreatorProfile;
  references: ReferenceAsset[];
  skills: ContentSkill[];
  ideas: Idea[];
  tasks: CreatorTask[];
  streak: number;
  weeklyScore: number;
  bossApproval: number;
  publishedThisWeek: number;
  achievements: Achievement[];
  lastActiveDate: string;
  activityDates: string[];
  weekStartDate: string;
}

export const STORAGE_KEY = "mini-ceo-state-v1";
export const DEMO_STORAGE_KEY = "mini-ceo-demo-state-v1";
export const MAX_PRIVATE_FILE_BYTES = 100 * 1024 * 1024;
export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const PLATFORMS = [
  "TikTok",
  "Instagram Reels",
  "YouTube Shorts",
  "Facebook Reels",
  "X",
];

export const DEFAULT_PROFILE: CreatorProfile = {
  name: "",
  goal: "",
  platforms: ["TikTok", "Instagram Reels", "YouTube Shorts"],
  videosPerWeek: 3,
  topics: [],
  scheduleStyle: "batch",
  workDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  bossMode: "serious",
  quietHours: { start: "21:00", end: "08:00" },
};

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function weekStartKey(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  return localDateKey(start);
}

export function createEmptyState(now = new Date()): MiniCeoState {
  const today = localDateKey(now);
  return {
    version: 2,
    onboardingComplete: false,
    profile: {
      ...DEFAULT_PROFILE,
      platforms: [...DEFAULT_PROFILE.platforms],
      topics: [],
      workDays: [...DEFAULT_PROFILE.workDays],
      quietHours: { ...DEFAULT_PROFILE.quietHours },
    },
    references: [],
    skills: [],
    ideas: [],
    tasks: [],
    streak: 0,
    weeklyScore: 0,
    bossApproval: 50,
    publishedThisWeek: 0,
    achievements: [],
    lastActiveDate: today,
    activityDates: [],
    weekStartDate: weekStartKey(now),
  };
}

export const EMPTY_STATE: MiniCeoState = createEmptyState();

export function createDemoState(now = new Date()): MiniCeoState {
  const today = localDateKey(now);
  const currentWeek = weekStartKey(now);
  const weekStart = dateFromKey(currentWeek);
  const monday = localDateKey(weekStart);
  const tuesday = localDateKey(addDays(weekStart, 1));
  const wednesday = localDateKey(addDays(weekStart, 2));
  const activeDue = new Date(now.getTime() + 90 * 60 * 1000);
  const activeDate = localDateKey(activeDue);
  const activeTime = `${String(activeDue.getHours()).padStart(2, "0")}:${String(activeDue.getMinutes()).padStart(2, "0")}`;
  const nextDate = localDateKey(addDays(activeDue, 1));
  const publishDate = localDateKey(addDays(activeDue, 2));
  const completedAt = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const skills: ContentSkill[] = [
    {
      id: "demo_skill_breakdown",
      name: "Fast AI Tool Breakdown",
      hook: "Open with a costly misconception, then show the useful result immediately.",
      pacing: "Proof by second 6, demonstration by second 15, takeaway by second 32",
      tone: "Direct, curious, practical, and lightly skeptical",
      visualFormat: "Face-to-camera with product screen recordings and two bold evidence cutaways",
      length: "35-45 seconds",
      examples: 4,
      confidence: 88,
    },
    {
      id: "demo_skill_system",
      name: "Creator System Before-and-After",
      hook: "Contrast the chaotic default with one repeatable operating rule.",
      pacing: "Problem, visual switch, three-step system, one challenge",
      tone: "Calm authority with concise, actionable language",
      visualFormat: "Desk B-roll, calendar overlays, and a clean before-and-after frame",
      length: "30-40 seconds",
      examples: 3,
      confidence: 79,
    },
  ];

  const ideas: Idea[] = [
    {
      id: "demo_idea_agent",
      title: "I gave an AI agent one hour to run my content workflow",
      hook: "I stopped asking AI for ideas and gave it an actual job instead.",
      angle: "Show the difference between a chatbot prompt and an agent that plans, researches, and hands back a usable production brief.",
      topic: "AI tools",
      source: "boss",
      status: "approved",
      skillId: "demo_skill_breakdown",
    },
    {
      id: "demo_idea_calendar",
      title: "The two-hour creator system that replaced my chaotic week",
      hook: "Your content calendar is not the problem. The number of decisions inside it is.",
      angle: "Demonstrate a weekly batching system that turns five open-ended projects into one clear next action.",
      topic: "creator systems",
      source: "creator",
      status: "approved",
      skillId: "demo_skill_system",
    },
    {
      id: "demo_idea_stack",
      title: "Three AI tools that actually survived my workflow test",
      hook: "I deleted eleven AI subscriptions. These three earned their spot.",
      angle: "Use a fast evidence-led ranking based on time saved, output quality, and how often each tool gets used.",
      topic: "AI tools",
      source: "boss",
      status: "suggested",
      skillId: "demo_skill_breakdown",
    },
    {
      id: "demo_idea_hook",
      title: "Why your useful videos still lose people in two seconds",
      hook: "The information is good. Your first sentence is making it invisible.",
      angle: "Rewrite three weak educational openings into specific, tension-driven hooks without adding clickbait.",
      topic: "content strategy",
      source: "boss",
      status: "suggested",
      skillId: "demo_skill_system",
    },
    {
      id: "demo_idea_notes",
      title: "Turn a messy notes app into one publishable video",
      hook: "You probably have a month of content hiding in one unfinished note.",
      angle: "Transform a real pile of fragments into a hook, proof sequence, shot list, and publishable short.",
      topic: "creator systems",
      source: "boss",
      status: "suggested",
      skillId: "demo_skill_system",
    },
  ];

  const task = (
    id: string,
    ideaId: string,
    stage: TaskStage,
    title: string,
    brief: string,
    scheduledDate: string,
    time: string,
    duration: number,
    status: TaskStatus,
    evidence?: Evidence,
    dueAt = localDateTime(scheduledDate, time).toISOString(),
  ): CreatorTask => ({
    id,
    ideaId,
    stage,
    title,
    brief,
    day: weekdayName(dateFromKey(scheduledDate)),
    scheduledDate,
    dueAt,
    weekStartDate: currentWeek,
    time,
    duration,
    status,
    evidence,
  });

  const doneEvidence: Evidence = {
    type: "done",
    value: "Completed in demo workspace",
    createdAt: completedAt,
  };
  const tasks: CreatorTask[] = [
    task("demo_task_research", "demo_idea_agent", "research", "Research the claim", "Collect three examples that show the difference between a chat response and an agent completing a workflow.", monday, "09:30", 25, "done", doneEvidence),
    task("demo_task_script", "demo_idea_agent", "script", "Lock the hook and script", "Choose the strongest hook and tighten the demonstration into a 40-second story.", tuesday, "10:00", 35, "done", doneEvidence),
    task("demo_task_plan", "demo_idea_agent", "production", "Build the shot plan", "Prepare the desk setup, product screen recording, before-and-after frame, and final call to action.", wednesday, "14:00", 15, "done", doneEvidence),
    task("demo_task_shoot", "demo_idea_agent", "shoot", "Shoot the AI agent workflow video", "Record the A-roll first, then capture the agent handoff and three proof shots. Do not start editing yet.", activeDate, activeTime, 40, "active", undefined, activeDue.toISOString()),
    task("demo_task_edit", "demo_idea_agent", "edit", "Finish the edit", "Cut dead air, make the result visible in the first three seconds, add captions, and export the final.", nextDate, "14:00", 50, "queued"),
    task("demo_task_publish", "demo_idea_agent", "publish", "Publish and send the link", "Post to TikTok, Instagram Reels, and YouTube Shorts, then save the public link.", publishDate, "17:30", 10, "queued"),
    task("demo_calendar_research", "demo_idea_calendar", "research", "Find the workflow proof", "Pull the weekly planning screenshot and document the decisions the new system removed.", monday, "11:00", 20, "done", doneEvidence),
    task("demo_calendar_script", "demo_idea_calendar", "script", "Write the before-and-after story", "Turn the chaotic week into a tight problem, switch, system, and result sequence.", monday, "14:30", 30, "done", doneEvidence),
    task("demo_calendar_shoot", "demo_idea_calendar", "shoot", "Shoot the creator system demo", "Capture the desk B-roll and the calendar transformation.", tuesday, "13:00", 35, "done", doneEvidence),
    task("demo_calendar_edit", "demo_idea_calendar", "edit", "Edit the creator system demo", "Keep the visual switch fast and label the three operating rules.", wednesday, "10:30", 45, "done", doneEvidence),
    task("demo_calendar_publish", "demo_idea_calendar", "publish", "Publish the creator system demo", "Post the final cut and record the public link.", wednesday, "17:30", 10, "done", {
      type: "link",
      value: "https://example.com/mini-ceo-demo-publish",
      createdAt: completedAt,
    }),
  ];

  return {
    version: 2,
    onboardingComplete: true,
    profile: {
      name: "Alex",
      goal: "Make AI tools and creator systems practical for independent creators.",
      platforms: ["TikTok", "Instagram Reels", "YouTube Shorts"],
      videosPerWeek: 3,
      topics: ["AI tools", "creator systems", "content strategy"],
      scheduleStyle: "batch",
      workDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      bossMode: "serious",
      quietHours: { start: "21:00", end: "08:00" },
    },
    references: [
      {
        id: "demo_reference_agent",
        label: "Fast AI product breakdown",
        sourceType: "link",
        sourceValue: "https://example.com/reference/ai-breakdown",
        createdAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "demo_reference_system",
        label: "Creator workflow before-and-after",
        sourceType: "video",
        sourceValue: "demo-creator-workflow.mp4",
        createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    skills,
    ideas,
    tasks,
    streak: 4,
    weeklyScore: 86,
    bossApproval: 91,
    publishedThisWeek: 1,
    achievements: [
      {
        id: "demo_achievement_hired",
        title: "Hired",
        detail: "Committed to a creator goal and approved the first assignment.",
        unlockedAt: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "demo_achievement_streak",
        title: "Four-day streak",
        detail: "Moved a real content project forward four days in a row.",
        unlockedAt: completedAt,
      },
      {
        id: "demo_achievement_publish",
        title: "First publish",
        detail: "Finished the production pipeline and shipped a public video.",
        unlockedAt: completedAt,
      },
    ],
    lastActiveDate: today,
    activityDates: Array.from({ length: 4 }, (_, index) => localDateKey(addDays(now, -index))).sort(),
    weekStartDate: currentWeek,
  };
}

export const BOSS_MODES: Array<{
  id: BossMode;
  name: string;
  label: string;
  description: string;
  reminderCadence: string;
}> = [
  {
    id: "coach",
    name: "Supportive Coach",
    label: "Encouraging",
    description: "Clear direction, patient reminders, and credit for every real step.",
    reminderCadence: "In-app morning and deadline checks",
  },
  {
    id: "serious",
    name: "Serious Boss",
    label: "Direct",
    description: "Firm deadlines, honest feedback, and no pretending planning is publishing.",
    reminderCadence: "In-app morning, pre-deadline, and missed-task follow-up",
  },
  {
    id: "unhinged",
    name: "Unhinged CEO",
    label: "Relentless",
    description: "Opt-in comedic pressure for creators who perform best under dramatic management.",
    reminderCadence: "Hourly in-app follow-up after a missed deadline",
  },
];

export const STAGE_LABELS: Record<TaskStage, string> = {
  idea: "Idea",
  research: "Research",
  script: "Script",
  production: "Production",
  shoot: "Shoot",
  edit: "Edit",
  publish: "Publish",
};

export const makeId = (prefix: string) => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const PIPELINE: Array<{
  stage: TaskStage;
  title: string;
  brief: (idea: Idea) => string;
  duration: number;
}> = [
  {
    stage: "research",
    title: "Research the claim",
    brief: (idea) => `Find three reliable facts that make “${idea.title}” worth publishing.`,
    duration: 25,
  },
  {
    stage: "script",
    title: "Lock the hook and script",
    brief: (idea) => `Write three hooks, choose one, then draft a tight script for “${idea.title}”.`,
    duration: 35,
  },
  {
    stage: "production",
    title: "Build the shot plan",
    brief: () => "List the location, props, cutaways, screen recordings, and setup you need.",
    duration: 15,
  },
  {
    stage: "shoot",
    title: "Shoot the video",
    brief: () => "Record the A-roll first. Do not edit while you are still producing takes.",
    duration: 40,
  },
  {
    stage: "edit",
    title: "Finish the edit",
    brief: () => "Cut dead air, make the hook land immediately, add captions, and export the final.",
    duration: 50,
  },
  {
    stage: "publish",
    title: "Publish and send the link",
    brief: () => "Post the finished video. The work is not done while it is sitting in your camera roll.",
    duration: 10,
  },
];

function weekdayName(date: Date) {
  const day = date.getDay();
  return DAYS[day === 0 ? 6 : day - 1];
}

function localDateTime(dateKey: string, time: string) {
  const date = dateFromKey(dateKey);
  const [hours, minutes] = time.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function upcomingWorkDates(profile: CreatorProfile, now: Date) {
  const workDays = profile.workDays.length ? profile.workDays : DAYS.slice(0, 5);
  const dates: string[] = [];
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const startOffset = minutesNow >= 9 * 60 + 15 ? 1 : 0;

  for (let offset = startOffset; offset < startOffset + 14 && dates.length < workDays.length; offset += 1) {
    const candidate = addDays(now, offset);
    if (workDays.includes(weekdayName(candidate))) dates.push(localDateKey(candidate));
  }

  return dates.length ? dates : [localDateKey(now)];
}

export function ensureSingleActiveTask(tasks: CreatorTask[]) {
  const unfinished = tasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => task.status === "active" || task.status === "queued")
    .sort((a, b) => {
      const dueDifference = new Date(a.task.dueAt).getTime() - new Date(b.task.dueAt).getTime();
      return Number.isFinite(dueDifference) && dueDifference !== 0
        ? dueDifference
        : a.index - b.index;
    });
  const selectedId = unfinished[0]?.task.id;

  return tasks.map((task) => {
    if (task.status === "done" || task.status === "skipped") return task;
    const status: TaskStatus = task.id === selectedId ? "active" : "queued";
    return task.status === status ? task : { ...task, status };
  });
}

export function buildTasks(
  profile: CreatorProfile,
  idea: Idea,
  now = new Date(),
): CreatorTask[] {
  const workDates = upcomingWorkDates(profile, now);
  const batchSlots = [0, 1, 1, 2, 3, 4];
  const planWeek = weekStartKey(now);

  return PIPELINE.map((step, index) => {
    const requestedSlot = profile.scheduleStyle === "batch" ? batchSlots[index] : index;
    const scheduledDate = workDates[Math.min(requestedSlot, workDates.length - 1)];
    const time = index < 2 ? "09:30" : index < 4 ? "14:00" : "17:30";
    return {
      id: makeId("task"),
      ideaId: idea.id,
      stage: step.stage,
      title: step.title,
      brief: step.brief(idea),
      day: weekdayName(dateFromKey(scheduledDate)),
      scheduledDate,
      dueAt: localDateTime(scheduledDate, time).toISOString(),
      weekStartDate: planWeek,
      time,
      duration: step.duration,
      status: "queued" as const,
    };
  });
}

export function shiftTaskSchedule(
  task: CreatorTask,
  direction: -1 | 1,
  workDays: string[],
) {
  const allowedDays = workDays.length ? workDays : DAYS;
  let nextDate = dateFromKey(task.scheduledDate);
  for (let attempt = 0; attempt < 14; attempt += 1) {
    nextDate = addDays(nextDate, direction);
    if (allowedDays.includes(weekdayName(nextDate))) break;
  }
  const scheduledDate = localDateKey(nextDate);
  return {
    ...task,
    day: weekdayName(nextDate),
    scheduledDate,
    dueAt: localDateTime(scheduledDate, task.time).toISOString(),
  };
}

export function bossLine(
  mode: BossMode,
  task?: CreatorTask,
  kind: "welcome" | "task" | "done" | "missed" | "publish" = "task",
) {
  const taskName = task?.title.toLowerCase() || "today's assignment";
  const lines: Record<BossMode, Record<typeof kind, string>> = {
    coach: {
      welcome: "You bring the ideas. I will help you turn them into a publishing habit.",
      task: `One clear win: finish ${taskName}. Then we move the project forward.`,
      done: "That counts. Progress gets easier when you keep promises to yourself.",
      missed: "We missed the window, not the whole week. Reschedule it and recommit.",
      publish: "Ship it. Your audience cannot respond to a draft they never see.",
    },
    serious: {
      welcome: "I run the schedule. You make the content. We both care about publishing.",
      task: `Your priority is ${taskName}. Planning something else is not a substitute.`,
      done: "Accepted. The next assignment is already waiting.",
      missed: "The deadline passed. Complete it, move it, or skip it. No invisible tasks.",
      publish: "Post the video and send the link. Camera-roll content does not count.",
    },
    unhinged: {
      welcome: "Congratulations. You hired the only executive willing to live in your phone.",
      task: `Today's shareholder emergency is ${taskName}. The shareholders are also me.`,
      done: "Fine. Competence detected. I have delayed the emergency board meeting.",
      missed: "The deadline has filed a missing-person report. Fix the schedule immediately.",
      publish: "Publish it. Your camera roll is not a streaming platform.",
    },
  };
  return lines[mode][kind];
}

export function calculateWeeklyScore(
  tasks: CreatorTask[],
  published: number,
  planWeek?: string,
) {
  const weeklyTasks = planWeek
    ? tasks.filter((task) => task.weekStartDate === planWeek)
    : tasks;
  if (!weeklyTasks.length) return 0;
  const completed = weeklyTasks.filter((task) => task.status === "done").length;
  const base = Math.round((completed / weeklyTasks.length) * 70);
  const publishBonus = Math.min(30, published * 15);
  return Math.min(100, base + publishBonus);
}

export function calculateCreatorStreak(activityDates: string[], now = new Date()) {
  const activity = new Set(activityDates);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let cursor = today;
  if (!activity.has(localDateKey(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (activity.has(localDateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(dateFromKey(value).getTime());
}

function nextDateForDay(day: string | undefined, now: Date) {
  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = addDays(now, offset);
    if (weekdayName(candidate) === day) return localDateKey(candidate);
  }
  return localDateKey(now);
}

function migrateActivityDates(
  activityDates: unknown,
  legacyStreak: number,
  lastActiveDate: string,
) {
  if (Array.isArray(activityDates)) {
    return [...new Set(activityDates.filter(isDateKey))].sort();
  }
  if (!legacyStreak || !isDateKey(lastActiveDate)) return [];
  const lastActive = dateFromKey(lastActiveDate);
  return Array.from({ length: legacyStreak }, (_, index) =>
    localDateKey(addDays(lastActive, -index)),
  ).sort();
}

type StoredState = Partial<Omit<MiniCeoState, "profile" | "tasks">> & {
  profile?: Partial<CreatorProfile>;
  tasks?: Array<Partial<CreatorTask>>;
};

export function migrateMiniCeoState(input: unknown, now = new Date()): MiniCeoState {
  const base = createEmptyState(now);
  if (!input || typeof input !== "object") return base;
  const raw = input as StoredState;
  const profile: CreatorProfile = {
    ...base.profile,
    ...raw.profile,
    platforms: Array.isArray(raw.profile?.platforms)
      ? raw.profile.platforms
      : base.profile.platforms,
    topics: Array.isArray(raw.profile?.topics) ? raw.profile.topics : [],
    workDays: Array.isArray(raw.profile?.workDays)
      ? raw.profile.workDays.filter((day) => DAYS.includes(day))
      : base.profile.workDays,
    quietHours: {
      ...base.profile.quietHours,
      ...(raw.profile?.quietHours || {}),
    },
  };
  const storedWeek = isDateKey(raw.weekStartDate)
    ? raw.weekStartDate
    : base.weekStartDate;
  const tasks = (Array.isArray(raw.tasks) ? raw.tasks : [])
    .map((task, index): CreatorTask | null => {
      if (!task.id || !task.ideaId) return null;
      const scheduledDate = isDateKey(task.scheduledDate)
        ? task.scheduledDate
        : nextDateForDay(task.day, now);
      const time = typeof task.time === "string" && /^\d{2}:\d{2}$/.test(task.time)
        ? task.time
        : index < 2
          ? "09:30"
          : index < 4
            ? "14:00"
            : "17:30";
      const dueAt =
        typeof task.dueAt === "string" && !Number.isNaN(new Date(task.dueAt).getTime())
          ? task.dueAt
          : localDateTime(scheduledDate, time).toISOString();
      const status: TaskStatus = ["queued", "active", "done", "skipped"].includes(
        task.status || "",
      )
        ? (task.status as TaskStatus)
        : "queued";
      return {
        id: task.id,
        ideaId: task.ideaId,
        stage: task.stage || "research",
        title: task.title || "Creator assignment",
        brief: task.brief || "Move the approved idea one concrete step forward.",
        day: task.day || weekdayName(dateFromKey(scheduledDate)),
        scheduledDate,
        dueAt,
        weekStartDate: isDateKey(task.weekStartDate)
          ? task.weekStartDate
          : storedWeek,
        time,
        duration: typeof task.duration === "number" ? task.duration : 25,
        status,
        evidence: task.evidence,
      };
    })
    .filter((task): task is CreatorTask => Boolean(task));
  const lastActiveDate = isDateKey(raw.lastActiveDate)
    ? raw.lastActiveDate
    : base.lastActiveDate;
  const activityDates = migrateActivityDates(
    raw.activityDates,
    typeof raw.streak === "number" ? raw.streak : 0,
    lastActiveDate,
  );
  const ideas = (Array.isArray(raw.ideas) ? raw.ideas : []).filter(
    (idea) =>
      !(
        idea.source === "boss" &&
        idea.status === "suggested" &&
        !idea.provenance
      ),
  );
  const skills = (Array.isArray(raw.skills) ? raw.skills : []).filter((skill) =>
    skill.id.startsWith("demo_"),
  );
  const migrated: MiniCeoState = {
    ...base,
    ...raw,
    version: 2,
    profile,
    references: Array.isArray(raw.references) ? raw.references : [],
    skills,
    ideas,
    tasks: ensureSingleActiveTask(tasks),
    achievements: Array.isArray(raw.achievements) ? raw.achievements : [],
    lastActiveDate,
    activityDates,
    weekStartDate: storedWeek,
    streak: calculateCreatorStreak(activityDates, now),
  };
  return rolloverMiniCeoState(migrated, now);
}

export function rolloverMiniCeoState(state: MiniCeoState, now = new Date()) {
  const currentWeek = weekStartKey(now);
  const currentStreak = calculateCreatorStreak(state.activityDates, now);
  if (state.weekStartDate === currentWeek) {
    return state.streak === currentStreak ? state : { ...state, streak: currentStreak };
  }

  const tasks = ensureSingleActiveTask(
    state.tasks.map((task) =>
      task.status === "active" || task.status === "queued"
        ? { ...task, weekStartDate: currentWeek }
        : task,
    ),
  );
  return {
    ...state,
    weekStartDate: currentWeek,
    tasks,
    streak: currentStreak,
    publishedThisWeek: 0,
    weeklyScore: calculateWeeklyScore(tasks, 0, currentWeek),
  };
}

function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isQuietTime(
  quietHours: CreatorProfile["quietHours"],
  now = new Date(),
) {
  const current = now.getHours() * 60 + now.getMinutes();
  const start = minutesFromTime(quietHours.start);
  const end = minutesFromTime(quietHours.end);
  if (start === end) return false;
  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}

export interface AccountabilityReminder {
  key: string;
  label: string;
  message: string;
  cadence: string;
  urgency: "scheduled" | "due" | "missed" | "quiet";
  quiet: boolean;
}

export function getAccountabilityReminder(
  profile: CreatorProfile,
  task: CreatorTask | undefined,
  now = new Date(),
): AccountabilityReminder | null {
  if (!task) return null;
  if (isQuietTime(profile.quietHours, now)) {
    return {
      key: `${task.id}:quiet:${localDateKey(now)}`,
      label: "Quiet hours",
      message: `Mini CEO is holding reminders until ${profile.quietHours.end}. Your assignment is still waiting.`,
      cadence: "In-app follow-up resumes after quiet hours.",
      urgency: "quiet",
      quiet: true,
    };
  }

  const due = new Date(task.dueAt);
  const minutesUntilDue = Math.round((due.getTime() - now.getTime()) / 60_000);
  if (minutesUntilDue > 60) {
    const sameDay = localDateKey(due) === localDateKey(now);
    return {
      key: `${task.id}:${sameDay ? "morning" : "scheduled"}:${localDateKey(now)}`,
      label: sameDay ? "Morning assignment" : "Assignment scheduled",
      message: bossLine(profile.bossMode, task, "task"),
      cadence: "Visible while Mini CEO is open; the next check appears near the deadline.",
      urgency: "scheduled",
      quiet: false,
    };
  }

  if (minutesUntilDue >= 0) {
    const message =
      profile.bossMode === "coach"
        ? `${task.title} is due soon. One focused block can close it.`
        : profile.bossMode === "unhinged"
          ? `${task.title} is due in ${Math.max(1, minutesUntilDue)} minutes. The board has entered the chat.`
          : `${task.title} is due in ${Math.max(1, minutesUntilDue)} minutes. Finish, move, or skip it.`;
    return {
      key: `${task.id}:due:${Math.floor(minutesUntilDue / 15)}`,
      label: "Deadline approaching",
      message,
      cadence: "In-app deadline checks update every 15 minutes.",
      urgency: "due",
      quiet: false,
    };
  }

  const overdueMinutes = Math.abs(minutesUntilDue);
  const interval = profile.bossMode === "coach" ? 360 : profile.bossMode === "serious" ? 180 : 60;
  const checkpoint = Math.floor(overdueMinutes / interval);
  return {
    key: `${task.id}:missed:${checkpoint}`,
    label: checkpoint ? `Missed deadline · check ${checkpoint + 1}` : "Missed deadline",
    message: bossLine(profile.bossMode, task, "missed"),
    cadence: `Follow-up refreshes every ${interval >= 60 ? `${interval / 60} hour${interval === 60 ? "" : "s"}` : `${interval} minutes`} while Mini CEO is open.`,
    urgency: "missed",
    quiet: false,
  };
}

export function gradeForScore(score: number) {
  if (score >= 94) return "A";
  if (score >= 86) return "B+";
  if (score >= 76) return "B";
  if (score >= 66) return "C";
  return "Needs work";
}

export async function savePrivateFile(id: string, file: File) {
  if (typeof indexedDB === "undefined") return;
  if (file.size > MAX_PRIVATE_FILE_BYTES) {
    throw new Error("File exceeds the private upload limit");
  }
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("mini-ceo-private-files", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("files")) {
        db.createObjectStore("files");
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").put(file, id);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}

export async function clearPrivateFiles() {
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("mini-ceo-private-files");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Private file storage is still in use"));
  });
}
