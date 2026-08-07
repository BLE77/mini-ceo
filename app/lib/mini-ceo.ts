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
  goalFit: number;
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

const topicOrFallback = (profile: CreatorProfile, index: number) =>
  profile.topics[index % Math.max(profile.topics.length, 1)] || "your niche";

export function generateIdeas(
  profile: CreatorProfile,
  skills: ContentSkill[],
  count = Math.max(4, profile.videosPerWeek),
): Idea[] {
  const firstSkill = skills[0];
  const goal = profile.goal || "build a consistent creator brand";
  const templates = [
    {
      title: (topic: string) => `The ${topic} update everyone is explaining wrong`,
      hook: "You are not behind. The popular explanation is missing the part that matters.",
      angle: `Break down one timely change, correct the common take, and connect it directly to the goal: ${goal}.`,
    },
    {
      title: (topic: string) => `Three ${topic} signals worth watching this week`,
      hook: "Ignore the loudest prediction. These three signals tell a better story.",
      angle: "A saveable rapid-fire list with one proof point and one practical takeaway per signal.",
    },
    {
      title: (topic: string) => `I tried the popular ${topic} advice so you do not have to`,
      hook: "This sounded smart until I tested it in a real workflow.",
      angle: "Use a first-person experiment to turn a familiar claim into an original lesson.",
    },
    {
      title: (topic: string) => `The beginner's shortcut to understanding ${topic}`,
      hook: "Give me 35 seconds and this will finally make sense.",
      angle: "Teach one confusing concept with a visual analogy and a single next action.",
    },
    {
      title: (topic: string) => `What actually changed in ${topic} this week`,
      hook: "The headline is not the useful part. Here is what changes for you.",
      angle: "Turn a timely signal into a concise before-and-after explanation with a practical next move.",
    },
    {
      title: (topic: string) => `Before you use the popular ${topic} playbook, check this`,
      hook: "This advice works, but only if one condition is true.",
      angle: "Add a useful constraint to familiar advice and demonstrate it with a concrete example.",
    },
    {
      title: (topic: string) => `${topic}: the myth, the reality, and the move`,
      hook: "The myth is catchy. The reality is more useful.",
      angle: "Use a three-beat contrast that ends with one action the audience can take today.",
    },
  ];

  const lenses = ["field test", "creator response", "practical breakdown"];
  return Array.from({ length: Math.max(1, count) }, (_, index) => {
    const template = templates[index % templates.length];
    const cycle = Math.floor(index / templates.length);
    const topic = topicOrFallback(profile, index);
    const baseTitle = template.title(topic);
    return {
      id: makeId("idea"),
      title: cycle ? `${baseTitle} — ${lenses[(cycle - 1) % lenses.length]}` : baseTitle,
      hook: template.hook,
      angle: template.angle,
      topic,
      goalFit: Math.max(82, 96 - index * 3),
      source: "boss" as const,
      status: "suggested" as const,
      skillId: firstSkill?.id,
    };
  });
}

export function createSkill(
  profile: CreatorProfile,
  reference?: ReferenceAsset,
): ContentSkill {
  const topic = profile.topics[0] || "Creator";
  const label = reference?.label || `${topic} signal breakdown`;
  return {
    id: makeId("skill"),
    name: `${topic} - Hard Hook Breakdown`,
    hook: `Start with a disputed claim or costly mistake tied to ${label}.`,
    pacing: "Immediate hook, proof by second 8, practical turn by second 22",
    tone: "Direct, informed, conversational",
    visualFormat: "Face-to-camera with two bold evidence cutaways",
    length: "30-45 seconds",
    examples: reference ? 1 : 0,
    confidence: reference ? 72 : 58,
  };
}

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
  const migrated: MiniCeoState = {
    ...base,
    ...raw,
    version: 2,
    profile,
    references: Array.isArray(raw.references) ? raw.references : [],
    skills: Array.isArray(raw.skills) ? raw.skills : [],
    ideas: Array.isArray(raw.ideas) ? raw.ideas : [],
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
