"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bell,
  BellRinging,
  Brain,
  CalendarBlank,
  CalendarDots,
  CaretRight,
  ChartLineUp,
  Check,
  CheckCircle,
  Clock,
  Fire,
  House,
  Lightbulb,
  LinkSimple,
  LockKey,
  MagicWand,
  Microphone,
  PaperPlaneTilt,
  Pause,
  Play,
  Plus,
  Repeat,
  SlidersHorizontal,
  Sparkle,
  SpeakerHigh,
  SpeakerSlash,
  Target,
  UploadSimple,
  VideoCamera,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BossCharacter } from "./components/BossCharacter";
import {
  AccountabilityReminder,
  AppView,
  BOSS_MODES,
  BossMode,
  CreatorTask,
  DAYS,
  EMPTY_STATE,
  Evidence,
  Idea,
  MAX_PRIVATE_FILE_BYTES,
  MiniCeoState,
  PLATFORMS,
  ReferenceAsset,
  STAGE_LABELS,
  STORAGE_KEY,
  bossLine,
  buildTasks,
  calculateCreatorStreak,
  calculateWeeklyScore,
  clearPrivateFiles,
  createEmptyState,
  createSkill,
  ensureSingleActiveTask,
  generateIdeas,
  getAccountabilityReminder,
  gradeForScore,
  localDateKey,
  makeId,
  migrateMiniCeoState,
  rolloverMiniCeoState,
  savePrivateFile,
  shiftTaskSchedule,
} from "./lib/mini-ceo";

type AssistantMessage = {
  id: string;
  role: "boss" | "creator";
  text: string;
};

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type RecognitionResultEvent = {
  results: ArrayLike<{ 0: { transcript: string } }>;
};

type RecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type RecognitionConstructor = new () => RecognitionInstance;

const NAV_ITEMS: Array<{
  id: AppView;
  label: string;
  icon: typeof House;
}> = [
  { id: "today", label: "Today", icon: House },
  { id: "ideas", label: "Ideas", icon: Lightbulb },
  { id: "schedule", label: "Plan", icon: CalendarBlank },
  { id: "skills", label: "Skills", icon: Brain },
  { id: "review", label: "Review", icon: ChartLineUp },
];

const COPY: Record<BossMode, { short: string; title: string }> = {
  coach: { short: "Coach", title: "Supportive Coach" },
  serious: { short: "Boss", title: "Serious Boss" },
  unhinged: { short: "CEO", title: "Unhinged CEO" },
};

function toTimeLabel(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const normalized = hour % 12 || 12;
  return `${normalized}:${String(minute).padStart(2, "0")} ${period}`;
}

function toDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

function progressForTasks(tasks: CreatorTask[]) {
  if (!tasks.length) return 0;
  return Math.round(
    (tasks.filter((task) => task.status === "done").length / tasks.length) * 100,
  );
}

function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function ClassicMacMenuBar({ section }: { section: string }) {
  return (
    <div className="mac-menu-bar" aria-label={`Mini CEO, ${section}`}>
      <span className="mac-system-mark" aria-hidden="true">MC</span>
      <strong>Mini CEO</strong>
      <span className="mac-menu-item">File</span>
      <span className="mac-menu-item">Edit</span>
      <span className="mac-menu-item">View</span>
      <span className="mac-menu-item">Boss</span>
      <span className="mac-menu-section">{section}</span>
    </div>
  );
}

function AppButton({
  children,
  className = "",
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
}) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}

export default function MiniCeoApp() {
  const [state, setState] = useState<MiniCeoState>(EMPTY_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<AppView>("today");
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [topicDraft, setTopicDraft] = useState("");
  const [referenceDraft, setReferenceDraft] = useState("");
  const [manualIdea, setManualIdea] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [proofTask, setProofTask] = useState<CreatorTask | null>(null);
  const [proofLink, setProofLink] = useState("");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "welcome",
      role: "boss",
      text: "I can help with ideas, hooks, scripts, research plans, production checklists, and the next best task. What are we making?",
    },
  ]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const lastReminderKeyRef = useRef("");

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          setState(migrateMiniCeoState(JSON.parse(saved)));
        } else {
          setState(createEmptyState());
        }
      } catch {
        setToast("Your saved workspace could not be read. A clean workspace is open.");
      } finally {
        setHydrated(true);
      }

      if ("Notification" in window) {
        setNotificationPermission(Notification.permission);
      } else {
        setNotificationPermission("unsupported");
      }
    });

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const handleInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleInstall);
    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", handleInstall);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  useEffect(() => {
    if (!hydrated) return;
    const refresh = () => {
      const now = new Date();
      setClock(now);
      setState((current) => rolloverMiniCeoState(current, now));
    };
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(interval);
  }, [hydrated]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3300);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const approvedIdeas = useMemo(
    () => state.ideas.filter((idea) => idea.status === "approved"),
    [state.ideas],
  );
  const activeTask = useMemo(
    () =>
      state.tasks.find((task) => task.status === "active") ||
      state.tasks.find((task) => task.status === "queued"),
    [state.tasks],
  );
  const activeIdea = useMemo(
    () => state.ideas.find((idea) => idea.id === activeTask?.ideaId),
    [activeTask?.ideaId, state.ideas],
  );
  const activeIdeaTasks = useMemo(
    () => state.tasks.filter((task) => task.ideaId === activeIdea?.id),
    [activeIdea?.id, state.tasks],
  );
  const taskProgress = progressForTasks(activeIdeaTasks);
  const bossMode = state.profile.bossMode;
  const reminder = useMemo(
    () => getAccountabilityReminder(state.profile, activeTask, clock),
    [activeTask, clock, state.profile],
  );
  const speech = bossLine(
    bossMode,
    activeTask,
    activeTask?.stage === "publish" ? "publish" : "task",
  );

  useEffect(() => {
    if (!hydrated || !state.onboardingComplete || !reminder || reminder.quiet) return;
    if (lastReminderKeyRef.current === reminder.key) return;
    lastReminderKeyRef.current = reminder.key;
    setToast(reminder.message);
  }, [hydrated, reminder, state.onboardingComplete]);

  const updateProfile = <K extends keyof MiniCeoState["profile"]>(
    key: K,
    value: MiniCeoState["profile"][K],
  ) => {
    setState((current) => ({
      ...current,
      profile: { ...current.profile, [key]: value },
    }));
  };

  const speak = useCallback(
    (text: string) => {
      if (!voiceEnabled || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (voice) =>
          voice.lang.startsWith("en") &&
          /samantha|ava|daniel|aaron|serena|moira/i.test(voice.name),
      );
      if (preferred) utterance.voice = preferred;
      utterance.rate = bossMode === "unhinged" ? 1.08 : bossMode === "coach" ? 0.94 : 1;
      utterance.pitch = bossMode === "unhinged" ? 1.04 : 0.96;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [bossMode, voiceEnabled],
  );

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  };

  const showToast = (message: string) => setToast(message);

  const requestNotifications = async () => {
    if (!("Notification" in window)) {
      showToast("This browser does not support notifications.");
      return;
    }
    const result = await Notification.requestPermission();
    setNotificationPermission(result);
    if (result === "granted") {
      if (reminder?.quiet) {
        showToast("Browser notifications are enabled. Quiet hours are active, so no preview was sent.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("Mini CEO is on duty", {
        body: reminder?.message || bossLine(bossMode, activeTask, "task"),
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "mini-ceo-preview",
      });
      showToast("Browser preview sent. The reminder ladder runs while Mini CEO is open.");
    }
  };

  const installApp = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstallPrompt(null);
      return;
    }
    showToast("On iPhone: Share, then Add to Home Screen.");
  };

  const prepareIdeas = () => {
    const topics = topicDraft
      .split(",")
      .map((topic) => topic.trim())
      .filter(Boolean);
    const profile = {
      ...state.profile,
      topics: topics.length ? topics : state.profile.topics,
    };
    const reference: ReferenceAsset | undefined = referenceDraft.trim()
      ? {
          id: makeId("ref"),
          label: referenceDraft.trim(),
          sourceType: "link",
          sourceValue: referenceDraft.trim(),
          createdAt: new Date().toISOString(),
        }
      : undefined;
    const skill = createSkill(profile, reference);
    const ideas = generateIdeas(profile, [skill], Math.max(4, profile.videosPerWeek));
    setState((current) => ({
      ...current,
      profile,
      references: reference ? [...current.references, reference] : current.references,
      skills: [skill],
      ideas,
    }));
    setOnboardingStep(5);
  };

  const approveIdea = (ideaId: string) => {
    const alreadyScheduled = state.tasks.some((task) => task.ideaId === ideaId);
    const scheduledProjects = new Set(
      state.tasks
        .filter((task) => task.weekStartDate === state.weekStartDate)
        .map((task) => task.ideaId),
    ).size;
    if (!alreadyScheduled && scheduledProjects >= state.profile.videosPerWeek) {
      showToast(`Weekly target reached: ${state.profile.videosPerWeek} projects are already scheduled.`);
      return;
    }
    setState((current) => {
      const idea = current.ideas.find((candidate) => candidate.id === ideaId);
      if (!idea) return current;
      const exists = current.tasks.some((task) => task.ideaId === ideaId);
      const ideas = current.ideas.map((candidate) =>
        candidate.id === ideaId
          ? { ...candidate, status: "approved" as const }
          : candidate,
      );
      return {
        ...current,
        ideas,
        tasks: exists
          ? ensureSingleActiveTask(current.tasks)
          : ensureSingleActiveTask([
              ...current.tasks,
              ...buildTasks(current.profile, idea),
            ]),
        bossApproval: Math.min(100, current.bossApproval + 4),
      };
    });
    showToast("Approved. I turned it into a production plan.");
  };

  const rejectIdea = (ideaId: string) => {
    setState((current) => ({
      ...current,
      ideas: current.ideas.map((idea) =>
        idea.id === ideaId ? { ...idea, status: "rejected" as const } : idea,
      ),
    }));
  };

  const finishOnboarding = () => {
    setState((current) => ({
      ...current,
      onboardingComplete: true,
      streak: calculateCreatorStreak(current.activityDates),
      bossApproval: 62,
      lastActiveDate: localDateKey(),
      achievements: [
        {
          id: makeId("achievement"),
          title: "Hired",
          detail: "Committed to a creator goal and approved the first assignment.",
          unlockedAt: new Date().toISOString(),
        },
      ],
    }));
    speak(bossLine(state.profile.bossMode, activeTask, "welcome"));
  };

  const completeTask = (
    taskId: string,
    evidence: Evidence = {
      type: "done",
      value: "Marked complete",
      createdAt: new Date().toISOString(),
    },
  ) => {
    let completedTask: CreatorTask | undefined;
    setState((current) => {
      completedTask = current.tasks.find((task) => task.id === taskId);
      if (!completedTask) return current;
      let tasks = current.tasks.map((task) =>
        task.id === taskId
          ? { ...task, status: "done" as const, evidence }
          : task,
      );
      tasks = ensureSingleActiveTask(tasks);
      const published =
        completedTask.stage === "publish"
          ? current.publishedThisWeek + 1
          : current.publishedThisWeek;
      const today = localDateKey();
      const activityDates = [...new Set([...current.activityDates, today])].sort();
      const achievements = [...current.achievements];
      if (
        completedTask.stage === "publish" &&
        !achievements.some((achievement) => achievement.title === "First publish")
      ) {
        achievements.push({
          id: makeId("achievement"),
          title: "First publish",
          detail: "Moved a project through the full Mini CEO pipeline.",
          unlockedAt: new Date().toISOString(),
        });
      }
      return {
        ...current,
        tasks,
        achievements,
        activityDates,
        lastActiveDate: today,
        streak: calculateCreatorStreak(activityDates),
        publishedThisWeek: published,
        weeklyScore: calculateWeeklyScore(tasks, published, current.weekStartDate),
        bossApproval: Math.min(
          100,
          current.bossApproval + (completedTask.stage === "publish" ? 12 : 3),
        ),
      };
    });
    setProofTask(null);
    setProofLink("");
    const line = bossLine(
      bossMode,
      completedTask,
      completedTask?.stage === "publish" ? "publish" : "done",
    );
    showToast(completedTask?.stage === "publish" ? "Published. That is the metric." : "Task accepted. Next assignment unlocked.");
    speak(line);
  };

  const skipTask = (task: CreatorTask) => {
    setState((current) => {
      let tasks = current.tasks.map((candidate) =>
        candidate.id === task.id
          ? { ...candidate, status: "skipped" as const }
          : candidate,
      );
      tasks = ensureSingleActiveTask(tasks);
      return {
        ...current,
        tasks,
        weeklyScore: calculateWeeklyScore(
          tasks,
          current.publishedThisWeek,
          current.weekStartDate,
        ),
        bossApproval: Math.max(0, current.bossApproval - 2),
      };
    });
    showToast("Skipped. The publishing target is still active.");
  };

  const moveTask = (taskId: string, direction: -1 | 1) => {
    setState((current) => ({
      ...current,
      tasks: ensureSingleActiveTask(
        current.tasks.map((task) =>
          task.id === taskId
            ? shiftTaskSchedule(task, direction, current.profile.workDays)
            : task,
        ),
      ),
    }));
    showToast(direction < 0 ? "Moved earlier." : "Moved later.");
  };

  const handleProofFile = async (task: CreatorTask, file: File) => {
    if (file.size > MAX_PRIVATE_FILE_BYTES) {
      showToast("That file is over 100 MB. Export a smaller draft or submit a link.");
      return;
    }
    try {
      await savePrivateFile(task.id, file);
      completeTask(task.id, {
        type: "file",
        value: file.name,
        createdAt: new Date().toISOString(),
      });
    } catch {
      showToast("The file could not be saved on this device. Try a smaller file or submit a link.");
    }
  };

  const addReferenceFile = async (file: File) => {
    if (file.size > MAX_PRIVATE_FILE_BYTES) {
      showToast("That reference is over 100 MB. Add a smaller clip, script, or notes file.");
      return;
    }
    const reference: ReferenceAsset = {
      id: makeId("ref"),
      label: file.name,
      sourceType: file.type.startsWith("video") ? "video" : "script",
      sourceValue: file.name,
      createdAt: new Date().toISOString(),
    };
    try {
      await savePrivateFile(reference.id, file);
      setState((current) => {
        const skill = current.skills[0]
          ? {
              ...current.skills[0],
              examples: current.skills[0].examples + 1,
              confidence: Math.min(96, current.skills[0].confidence + 8),
            }
          : createSkill(current.profile, reference);
        return {
          ...current,
          references: [...current.references, reference],
          skills: current.skills[0]
            ? [skill, ...current.skills.slice(1)]
            : [skill],
        };
      });
      showToast("Example saved privately. Your Content Skill grew.");
    } catch {
      showToast("The reference could not be saved on this device. Try a smaller file.");
    }
  };

  const generateMoreIdeas = async () => {
    setIsGenerating(true);
    await new Promise((resolve) => window.setTimeout(resolve, 850));
    setState((current) => ({
      ...current,
      ideas: [
        ...generateIdeas(
          current.profile,
          current.skills,
          Math.max(
            1,
            current.profile.videosPerWeek -
              new Set(
                current.tasks
                  .filter((task) => task.weekStartDate === current.weekStartDate)
                  .map((task) => task.ideaId),
              ).size,
          ),
        ),
        ...current.ideas,
      ],
    }));
    setIsGenerating(false);
    showToast("Fresh ideas are ready for approval.");
  };

  const addManualIdea = (event: FormEvent) => {
    event.preventDefault();
    if (!manualIdea.trim()) return;
    const idea: Idea = {
      id: makeId("idea"),
      title: manualIdea.trim(),
      hook: "Hook not locked yet. Ask Mini CEO for three options.",
      angle: `Creator-submitted idea aligned to: ${state.profile.goal}`,
      topic: state.profile.topics[0] || "Creator idea",
      goalFit: 88,
      source: "creator",
      status: "suggested",
      skillId: state.skills[0]?.id,
    };
    setState((current) => ({ ...current, ideas: [idea, ...current.ideas] }));
    setManualIdea("");
    showToast("Idea captured. Approve it when you are ready to commit.");
  };

  const sendAssistant = useCallback(
    async (promptOverride?: string) => {
      const prompt = (promptOverride ?? assistantInput).trim();
      if (!prompt || assistantBusy) return;
      const creatorMessage: AssistantMessage = {
        id: makeId("message"),
        role: "creator",
        text: prompt,
      };
      setMessages((current) => [...current, creatorMessage]);
      setAssistantInput("");
      setAssistantBusy(true);
      try {
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: prompt,
            context: {
              goal: state.profile.goal,
              topics: state.profile.topics,
              bossMode,
              task: activeTask,
              idea: activeIdea,
              skill: state.skills[0],
              references: state.references.slice(-3).map((reference) => ({
                name: reference.label,
                type: reference.sourceType,
                url: reference.sourceType === "link" ? reference.sourceValue : undefined,
              })),
            },
          }),
        });
        if (!response.ok) throw new Error("Assistant unavailable");
        const data = (await response.json()) as { reply: string; provider: string };
        const reply: AssistantMessage = {
          id: makeId("message"),
          role: "boss",
          text: data.reply,
        };
        setMessages((current) => [...current, reply]);
        speak(data.reply);
      } catch {
        const fallback = "I could not reach the assistant service. Your schedule is safe; try again in a moment.";
        setMessages((current) => [
          ...current,
          { id: makeId("message"), role: "boss", text: fallback },
        ]);
      } finally {
        setAssistantBusy(false);
      }
    }, [activeIdea, activeTask, assistantBusy, assistantInput, bossMode, speak, state.profile.goal, state.profile.topics, state.references, state.skills],
  );

  const startListening = () => {
    const browserWindow = window as typeof window & {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };
    const Recognition =
      browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      showToast("Voice input is not supported in this browser. You can still type to the boss.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || "";
      setAssistantInput(transcript);
      setIsListening(false);
      window.setTimeout(() => void sendAssistant(transcript), 80);
    };
    recognition.onerror = () => {
      setIsListening(false);
      showToast("I could not hear that. Try again or type your request.");
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const resetWorkspace = async () => {
    localStorage.removeItem(STORAGE_KEY);
    let filesCleared = true;
    try {
      await clearPrivateFiles();
    } catch {
      filesCleared = false;
    }
    setState(createEmptyState());
    setOnboardingStep(0);
    setView("today");
    showToast(
      filesCleared
        ? "Workspace and private device files reset."
        : "Workspace reset, but this browser could not clear one private file store.",
    );
  };

  if (!hydrated) {
    return (
      <main className="loading-shell" aria-busy="true">
        <div className="loading-character" />
        <div className="loading-line loading-line-wide" />
        <div className="loading-line" />
        <p>Mini CEO is reviewing the schedule.</p>
      </main>
    );
  }

  if (!state.onboardingComplete) {
    return (
      <Onboarding
        state={state}
        step={onboardingStep}
        topicDraft={topicDraft}
        referenceDraft={referenceDraft}
        approvedIdeas={approvedIdeas}
        setStep={setOnboardingStep}
        updateProfile={updateProfile}
        setTopicDraft={setTopicDraft}
        setReferenceDraft={setReferenceDraft}
        prepareIdeas={prepareIdeas}
        approveIdea={approveIdea}
        rejectIdea={rejectIdea}
        finish={finishOnboarding}
        installApp={installApp}
        speak={speak}
        isSpeaking={isSpeaking}
        stopSpeaking={stopSpeaking}
      />
    );
  }

  return (
    <main className={`app-shell mode-${bossMode}`}>
      <ClassicMacMenuBar section={COPY[bossMode].title} />
      <div className="desktop-rail">
        <div className="brand-mark"><span>MC</span></div>
        <p>MINI CEO</p>
        <small>small guy. big plans.</small>
        <ul className="desktop-boss-notes">
          <li>low tolerance for nonsense</li>
          <li>coffee powered</li>
          <li>publishing over planning</li>
        </ul>
        <div className="desktop-rail-status">
          <span />
          On duty
        </div>
      </div>

      <section className="phone-app">
        <header className="app-topbar">
          <span className="mac-window-box" aria-hidden="true"><i /></span>
          <div className="app-topbar-copy">
            <p className="eyebrow">Week one</p>
            <strong>{state.profile.name ? `${state.profile.name}'s studio` : "Creator studio"}</strong>
          </div>
          <button
            className="icon-button notification-button"
            aria-label="Preview boss notification"
            onClick={requestNotifications}
          >
            {notificationPermission === "granted" ? <BellRinging size={22} weight="fill" /> : <Bell size={22} />}
            {activeTask && <span className="notification-dot" />}
          </button>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            className="view-container"
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ type: "spring", stiffness: 180, damping: 23 }}
          >
            {view === "today" && (
              <TodayView
                state={state}
                activeTask={activeTask}
                activeIdea={activeIdea}
                progress={taskProgress}
                speech={speech}
                reminder={reminder}
                isSpeaking={isSpeaking}
                speak={speak}
                stopSpeaking={stopSpeaking}
                completeTask={completeTask}
                skipTask={skipTask}
                moveTask={moveTask}
                openProof={setProofTask}
                openAssistant={() => setAssistantOpen(true)}
                setView={setView}
              />
            )}
            {view === "ideas" && (
              <IdeasView
                state={state}
                manualIdea={manualIdea}
                setManualIdea={setManualIdea}
                addManualIdea={addManualIdea}
                approveIdea={approveIdea}
                rejectIdea={rejectIdea}
                generateMore={generateMoreIdeas}
                isGenerating={isGenerating}
              />
            )}
            {view === "schedule" && (
              <ScheduleView state={state} moveTask={moveTask} />
            )}
            {view === "skills" && (
              <SkillsView state={state} addReferenceFile={addReferenceFile} openAssistant={() => setAssistantOpen(true)} />
            )}
            {view === "review" && (
              <ReviewView
                state={state}
                updateProfile={updateProfile}
                requestNotifications={requestNotifications}
                notificationPermission={notificationPermission}
                voiceEnabled={voiceEnabled}
                setVoiceEnabled={setVoiceEnabled}
                installApp={installApp}
                resetWorkspace={resetWorkspace}
              />
            )}
          </motion.div>
        </AnimatePresence>

        <button className="assistant-fab" onClick={() => setAssistantOpen(true)} aria-label="Ask Mini CEO">
          <Sparkle size={20} weight="fill" />
          <span>Ask boss</span>
        </button>

        <nav className="bottom-nav" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.id === view;
            return (
              <button
                key={item.id}
                className={active ? "is-active" : ""}
                onClick={() => setView(item.id)}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={21} weight={active ? "fill" : "regular"} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </section>

      <AnimatePresence>
        {assistantOpen && (
          <AssistantSheet
            messages={messages}
            input={assistantInput}
            setInput={setAssistantInput}
            busy={assistantBusy}
            send={sendAssistant}
            close={() => setAssistantOpen(false)}
            isListening={isListening}
            startListening={startListening}
            stopListening={stopListening}
            bossMode={bossMode}
            isSpeaking={isSpeaking}
            stopSpeaking={stopSpeaking}
          />
        )}
        {proofTask && (
          <ProofSheet
            task={proofTask}
            link={proofLink}
            setLink={setProofLink}
            close={() => setProofTask(null)}
            submitLink={() =>
              completeTask(proofTask.id, {
                type: "link",
                value: proofLink,
                createdAt: new Date().toISOString(),
              })
            }
            submitFile={(file) => void handleProofFile(proofTask, file)}
            markDone={() => completeTask(proofTask.id)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            role="status"
          >
            <CheckCircle size={20} weight="fill" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function Onboarding({
  state,
  step,
  topicDraft,
  referenceDraft,
  approvedIdeas,
  setStep,
  updateProfile,
  setTopicDraft,
  setReferenceDraft,
  prepareIdeas,
  approveIdea,
  rejectIdea,
  finish,
  installApp,
  speak,
  isSpeaking,
  stopSpeaking,
}: {
  state: MiniCeoState;
  step: number;
  topicDraft: string;
  referenceDraft: string;
  approvedIdeas: Idea[];
  setStep: (step: number) => void;
  updateProfile: <K extends keyof MiniCeoState["profile"]>(key: K, value: MiniCeoState["profile"][K]) => void;
  setTopicDraft: (value: string) => void;
  setReferenceDraft: (value: string) => void;
  prepareIdeas: () => void;
  approveIdea: (id: string) => void;
  rejectIdea: (id: string) => void;
  finish: () => void;
  installApp: () => void;
  speak: (text: string) => void;
  isSpeaking: boolean;
  stopSpeaking: () => void;
}) {
  const profile = state.profile;
  const selectedIdea = approvedIdeas[0];
  const previewTasks = selectedIdea
    ? state.tasks.filter((task) => task.ideaId === selectedIdea.id)
    : [];
  const nextDisabled =
    (step === 2 && (!profile.goal.trim() || !profile.platforms.length)) ||
    (step === 3 && !profile.workDays.length);

  return (
    <main className={`onboarding-shell onboarding-step-${step}`}>
      <ClassicMacMenuBar section="Setup Assistant" />
      <header className="onboarding-header">
        <span className="mac-window-box" aria-hidden="true"><i /></span>
        <div className="mini-wordmark"><span>MC</span> Mini CEO</div>
        <div className="onboarding-progress" aria-label={`Onboarding step ${step + 1} of 6`}>
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index} className={index <= step ? "is-filled" : ""} />
          ))}
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.section
          key={step}
          className="onboarding-stage"
          initial={{ opacity: 0, x: 22 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -18 }}
          transition={{ type: "spring", stiffness: 190, damping: 24 }}
        >
          {step === 0 && (
            <div className="welcome-layout">
              <div className="welcome-copy">
                <p className="eyebrow">Your application was reviewed</p>
                <h1>You&apos;re hired.<br />Meet the boss.</h1>
                <p>
                  Mini CEO turns your creator goal into a production schedule and keeps showing up until the work gets posted.
                </p>
                <div className="welcome-actions">
                  <AppButton onClick={() => setStep(1)}>
                    Clock in <ArrowRight size={18} />
                  </AppButton>
                  <AppButton variant="quiet" onClick={installApp}>
                    Add to Home Screen
                  </AppButton>
                </div>
              </div>
              <div className="welcome-boss">
                <div className="boss-intro-card">
                  <BossCharacter mode="serious" mood="focused" speaking={isSpeaking} />
                  <button
                    className="voice-preview"
                    onClick={() =>
                      isSpeaking
                        ? stopSpeaking()
                        : speak("You bring the ideas. I run the schedule. We both care about publishing.")
                    }
                  >
                    {isSpeaking ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
                    Hear the boss
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="onboarding-form-stage">
              <div className="onboarding-heading">
                <p className="eyebrow">Management style</p>
                <h1>How much pressure gets results?</h1>
                <p>You can change this anytime. The mode controls both language and reminder frequency.</p>
              </div>
              <div className="mode-list">
                {BOSS_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    className={`mode-option ${profile.bossMode === mode.id ? "is-selected" : ""}`}
                    onClick={() => updateProfile("bossMode", mode.id)}
                  >
                    <div className="mode-character-mini">
                      <BossCharacter mode={mode.id} mood={mode.id === "coach" ? "pleased" : mode.id === "unhinged" ? "impatient" : "focused"} compact />
                    </div>
                    <div>
                      <span>{mode.label}</span>
                      <strong>{mode.name}</strong>
                      <p>{mode.description}</p>
                      <small>{mode.reminderCadence}</small>
                    </div>
                    <div className="selection-ring">{profile.bossMode === mode.id && <Check size={14} weight="bold" />}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="onboarding-form-stage compact-form-stage">
              <div className="onboarding-heading">
                <p className="eyebrow">Your north star</p>
                <h1>What is this content here to do?</h1>
                <p>The boss will use this goal to judge ideas, hooks, and priorities.</p>
              </div>
              <div className="field-grid">
                <label className="field-block">
                  <span>Your name <small>Optional</small></span>
                  <input
                    value={profile.name}
                    onChange={(event) => updateProfile("name", event.target.value)}
                    placeholder="What should the boss call you?"
                  />
                </label>
                <label className="field-block field-block-wide">
                  <span>Clear creator goal</span>
                  <textarea
                    value={profile.goal}
                    onChange={(event) => updateProfile("goal", event.target.value)}
                    placeholder="Example: Make AI news understandable, useful, and entertaining for working creators."
                    rows={4}
                  />
                  <small>Specific goals produce stronger ideas.</small>
                </label>
              </div>
              <div className="choice-section">
                <div>
                  <strong>Where are we publishing?</strong>
                  <p>We recommend a video-first multi-platform workflow.</p>
                </div>
                <div className="chip-grid">
                  {PLATFORMS.map((platform) => {
                    const selected = profile.platforms.includes(platform);
                    return (
                      <button
                        key={platform}
                        className={`choice-chip ${selected ? "is-selected" : ""}`}
                        onClick={() =>
                          updateProfile(
                            "platforms",
                            selected
                              ? profile.platforms.filter((item) => item !== platform)
                              : [...profile.platforms, platform],
                          )
                        }
                      >
                        {selected && <Check size={14} weight="bold" />}
                        {platform}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="onboarding-form-stage compact-form-stage">
              <div className="onboarding-heading">
                <p className="eyebrow">Operating cadence</p>
                <h1>Build a schedule you can actually keep.</h1>
                <p>Publishing targets drive the plan. Tasks flex around how you work.</p>
              </div>
              <div className="cadence-row">
                <div className="quota-control">
                  <span>Videos per week</span>
                  <div>
                    <button onClick={() => updateProfile("videosPerWeek", Math.max(1, profile.videosPerWeek - 1))}>-</button>
                    <strong>{profile.videosPerWeek}</strong>
                    <button onClick={() => updateProfile("videosPerWeek", Math.min(14, profile.videosPerWeek + 1))}>+</button>
                  </div>
                  <small>{profile.videosPerWeek <= 2 ? "Sustainable start" : profile.videosPerWeek <= 5 ? "Working creator pace" : "High-output studio"}</small>
                </div>
                <div className="schedule-style-control">
                  <button
                    className={profile.scheduleStyle === "batch" ? "is-selected" : ""}
                    onClick={() => updateProfile("scheduleStyle", "batch")}
                  >
                    <Repeat size={20} />
                    <strong>Batch production</strong>
                    <span>Group ideas, scripts, shoots, and edits.</span>
                  </button>
                  <button
                    className={profile.scheduleStyle === "daily" ? "is-selected" : ""}
                    onClick={() => updateProfile("scheduleStyle", "daily")}
                  >
                    <CalendarDots size={20} />
                    <strong>Daily creation</strong>
                    <span>Move one project forward each workday.</span>
                  </button>
                </div>
              </div>
              <div className="choice-section">
                <div>
                  <strong>Available creator days</strong>
                  <p>Choose at least one. You can rearrange every assignment later.</p>
                </div>
                <div className="day-picker">
                  {DAYS.map((day) => {
                    const selected = profile.workDays.includes(day);
                    return (
                      <button
                        key={day}
                        className={selected ? "is-selected" : ""}
                        onClick={() =>
                          updateProfile(
                            "workDays",
                            selected
                              ? profile.workDays.filter((item) => item !== day)
                              : [...profile.workDays, day],
                          )
                        }
                      >
                        <span>{day.slice(0, 1)}</span>
                        <small>{day.slice(0, 3)}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="onboarding-form-stage compact-form-stage">
              <div className="onboarding-heading">
                <p className="eyebrow">Train your boss</p>
                <h1>What should your content feel like?</h1>
                <p>Topics set the territory. Examples teach Mini CEO your hooks, pacing, tone, format, and length.</p>
              </div>
              <label className="field-block field-block-wide">
                <span>Topics and content lanes</span>
                <input
                  value={topicDraft}
                  onChange={(event) => setTopicDraft(event.target.value)}
                  placeholder="AI news, creator tools, tech culture"
                />
                <small>Separate topics with commas.</small>
              </label>
              <div className="reference-inputs">
                <label className="field-block">
                  <span>Example link or creator</span>
                  <div className="input-with-icon">
                    <LinkSimple size={18} />
                    <input
                      value={referenceDraft}
                      onChange={(event) => setReferenceDraft(event.target.value)}
                      placeholder="Paste a video link or creator name"
                    />
                  </div>
                </label>
                <label className="upload-tile">
                  <UploadSimple size={23} />
                  <strong>Upload later</strong>
                  <span>Add a video or script after onboarding.</span>
                </label>
              </div>
              <div className="skill-preview-line">
                <Sparkle size={19} weight="fill" />
                <div>
                  <strong>Content Skills grow with every example.</strong>
                  <p>Mini CEO learns reusable structures instead of copying someone&apos;s exact expression.</p>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="onboarding-form-stage ideas-approval-stage">
              <div className="onboarding-heading">
                <p className="eyebrow">First planning meeting</p>
                <h1>Choose what we are actually making.</h1>
                <p>The boss suggests. You commit up to your {profile.videosPerWeek}-video target. Approved ideas become dated production plans.</p>
              </div>
              <div className="approval-layout">
                <div className="onboarding-idea-stack">
                  {state.ideas.slice(0, Math.max(4, profile.videosPerWeek)).map((idea, index) => (
                    <motion.article
                      key={idea.id}
                      className={`onboarding-idea ${idea.status === "approved" ? "is-approved" : ""}`}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: idea.status === "rejected" ? 0.42 : 1, y: 0 }}
                      transition={{ delay: index * 0.08 }}
                    >
                      <div className="idea-fit"><Target size={15} /> {idea.goalFit}% goal fit</div>
                      <h3>{idea.title}</h3>
                      <p>{idea.hook}</p>
                      <div className="idea-approval-actions">
                        <AppButton
                          variant={idea.status === "approved" ? "secondary" : "primary"}
                          onClick={() => approveIdea(idea.id)}
                          disabled={idea.status === "approved"}
                        >
                          {idea.status === "approved" ? <><Check size={16} /> Approved</> : "Approve idea"}
                        </AppButton>
                        <AppButton variant="quiet" onClick={() => rejectIdea(idea.id)}>Not this one</AppButton>
                      </div>
                    </motion.article>
                  ))}
                </div>
                <aside className="schedule-preview-panel">
                  <p className="eyebrow">Proposed week</p>
                  <h3>{selectedIdea ? "Schedule ready" : "Approve an idea"}</h3>
                  {selectedIdea ? (
                    <>
                      <p>{COPY[profile.bossMode].title} built this around your {profile.scheduleStyle} workflow.</p>
                      <div className="preview-timeline">
                        {previewTasks.map((task) => (
                          <div key={task.id}>
                            <span>{toDateLabel(task.scheduledDate)}</span>
                            <div><strong>{task.title}</strong><small>{task.duration} min</small></div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="empty-mini-state"><CalendarBlank size={28} /><p>Your first production plan appears here.</p></div>
                  )}
                </aside>
              </div>
            </div>
          )}
        </motion.section>
      </AnimatePresence>

      {step > 0 && (
        <footer className="onboarding-footer">
          <AppButton variant="quiet" onClick={() => setStep(Math.max(0, step - 1))}>
            <ArrowLeft size={17} /> Back
          </AppButton>
          {step < 4 && (
            <AppButton onClick={() => setStep(step + 1)} disabled={nextDisabled}>
              Continue <ArrowRight size={17} />
            </AppButton>
          )}
          {step === 4 && (
            <AppButton onClick={prepareIdeas} disabled={!topicDraft.trim()}>
              Build my ideas <MagicWand size={17} />
            </AppButton>
          )}
          {step === 5 && (
            <AppButton onClick={finish} disabled={!approvedIdeas.length}>
              Start with {approvedIdeas.length}/{profile.videosPerWeek} projects <Check size={17} />
            </AppButton>
          )}
        </footer>
      )}
    </main>
  );
}

function TodayView({
  state,
  activeTask,
  activeIdea,
  progress,
  speech,
  reminder,
  isSpeaking,
  speak,
  stopSpeaking,
  completeTask,
  skipTask,
  moveTask,
  openProof,
  openAssistant,
  setView,
}: {
  state: MiniCeoState;
  activeTask?: CreatorTask;
  activeIdea?: Idea;
  progress: number;
  speech: string;
  reminder: AccountabilityReminder | null;
  isSpeaking: boolean;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  completeTask: (taskId: string) => void;
  skipTask: (task: CreatorTask) => void;
  moveTask: (taskId: string, direction: -1 | 1) => void;
  openProof: (task: CreatorTask) => void;
  openAssistant: () => void;
  setView: (view: AppView) => void;
}) {
  const mode = state.profile.bossMode;
  const ideaTasks = activeIdea
    ? state.tasks.filter((task) => task.ideaId === activeIdea.id)
    : [];

  return (
    <div className="today-view">
      <section className="boss-stage">
        <div className="boss-stage-copy">
          <div className="boss-status"><span /> {COPY[mode].title} is on duty</div>
          <motion.div className="speech-bubble" layout>
            <p>{speech}</p>
            <button onClick={() => isSpeaking ? stopSpeaking() : speak(speech)} aria-label={isSpeaking ? "Stop Mini CEO voice" : "Hear Mini CEO voice"}>
              {isSpeaking ? <SpeakerSlash size={18} /> : <SpeakerHigh size={18} />}
            </button>
          </motion.div>
          <button className="ask-inline" onClick={openAssistant}>
            <Sparkle size={16} weight="fill" /> Ask for help
          </button>
        </div>
        <div className="boss-stage-character">
          <BossCharacter mode={mode} mood={activeTask ? "focused" : "pleased"} speaking={isSpeaking} />
        </div>
      </section>

      <section className="score-strip" aria-label="Weekly creator performance">
        <div><Fire size={18} weight="fill" /><span><strong>{state.streak}</strong> day streak</span></div>
        <div><ChartLineUp size={18} /><span><strong>{state.weeklyScore}</strong> weekly score</span></div>
        <div><Target size={18} /><span><strong>{state.publishedThisWeek}/{state.profile.videosPerWeek}</strong> published</span></div>
      </section>

      <section className="today-content">
        {reminder && (
          <div className="skill-preview-line" role="status">
            <BellRinging size={19} weight="fill" />
            <div>
              <strong>{reminder.label}</strong>
              <p>{reminder.message} {reminder.cadence}</p>
            </div>
          </div>
        )}
        <SectionTitle
          eyebrow="Highest priority"
          title="Today’s assignment"
          action={<button className="text-button" onClick={() => setView("schedule")}>Full plan <CaretRight size={15} /></button>}
        />

        {activeTask ? (
          <motion.article className="assignment-card" layout>
            <div className="assignment-meta">
              <span className={`stage-tag stage-${activeTask.stage}`}>{STAGE_LABELS[activeTask.stage]}</span>
              <span><Clock size={15} /> {activeTask.duration} min</span>
              <span>{toDateLabel(activeTask.scheduledDate)} at {toTimeLabel(activeTask.time)}</span>
            </div>
            <h3>{activeTask.title}</h3>
            <p>{activeTask.brief}</p>
            {activeIdea && (
              <div className="assignment-project">
                <VideoCamera size={18} />
                <div><small>Content project</small><strong>{activeIdea.title}</strong></div>
              </div>
            )}
            <div className="assignment-actions">
              <AppButton onClick={() => activeTask.stage === "publish" || activeTask.stage === "shoot" || activeTask.stage === "edit" ? openProof(activeTask) : completeTask(activeTask.id)}>
                <Check size={17} weight="bold" /> {activeTask.stage === "publish" ? "Submit publish" : activeTask.stage === "shoot" ? "Video shot" : "Complete"}
              </AppButton>
              <AppButton variant="secondary" onClick={() => openProof(activeTask)}>
                <UploadSimple size={17} /> Add proof
              </AppButton>
            </div>
            <div className="assignment-quiet-actions">
              <button onClick={() => moveTask(activeTask.id, 1)}><CalendarBlank size={16} /> Move to next workday</button>
              <button onClick={() => skipTask(activeTask)}>Skip assignment</button>
            </div>
          </motion.article>
        ) : (
          <div className="empty-state">
            <CheckCircle size={36} weight="fill" />
            <h3>The board is clear.</h3>
            <p>Approve another idea or let the boss generate a fresh assignment.</p>
            <AppButton onClick={() => setView("ideas")}>Open idea inbox</AppButton>
          </div>
        )}

        <div className="project-progress-header">
          <div><span>Project progress</span><strong>{progress}%</strong></div>
          <div className="progress-track"><motion.span initial={{ width: 0 }} animate={{ width: `${progress}%` }} /></div>
        </div>
        <div className="pipeline-strip">
          {ideaTasks.map((task) => (
            <div key={task.id} className={`pipeline-step is-${task.status}`}>
              <span>{task.status === "done" ? <Check size={13} weight="bold" /> : STAGE_LABELS[task.stage].slice(0, 1)}</span>
              <small>{STAGE_LABELS[task.stage]}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function IdeasView({
  state,
  manualIdea,
  setManualIdea,
  addManualIdea,
  approveIdea,
  rejectIdea,
  generateMore,
  isGenerating,
}: {
  state: MiniCeoState;
  manualIdea: string;
  setManualIdea: (value: string) => void;
  addManualIdea: (event: FormEvent) => void;
  approveIdea: (id: string) => void;
  rejectIdea: (id: string) => void;
  generateMore: () => void;
  isGenerating: boolean;
}) {
  const visibleIdeas = state.ideas.filter((idea) => idea.status !== "rejected");
  return (
    <div className="standard-view ideas-view">
      <SectionTitle
        eyebrow="Goal-aware pipeline"
        title="Idea inbox"
        action={
          <AppButton variant="secondary" onClick={generateMore} disabled={isGenerating}>
            <MagicWand size={17} /> {isGenerating ? "Thinking" : "Generate"}
          </AppButton>
        }
      />
      <p className="section-lead">Every suggestion is scored against your creator goal before it reaches the schedule.</p>

      <form className="quick-capture" onSubmit={addManualIdea}>
        <Plus size={18} />
        <input value={manualIdea} onChange={(event) => setManualIdea(event.target.value)} placeholder="Drop an idea before you forget it" aria-label="New content idea" />
        <button type="submit" aria-label="Save idea"><ArrowRight size={18} /></button>
      </form>

      {isGenerating && (
        <div className="idea-skeleton-list" aria-busy="true">
          {[0, 1].map((item) => <div key={item}><span /><span /><span /></div>)}
        </div>
      )}

      <div className="idea-list">
        {visibleIdeas.map((idea, index) => {
          const skill = state.skills.find((item) => item.id === idea.skillId);
          return (
            <motion.article
              key={idea.id}
              className={`idea-row ${idea.status === "approved" ? "is-approved" : ""}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index, 6) * 0.05 }}
              layout
            >
              <div className="idea-row-top">
                <span className="idea-source">{idea.source === "creator" ? "Your idea" : "Boss suggestion"}</span>
                <span className="goal-fit"><Target size={14} /> {idea.goalFit}% fit</span>
              </div>
              <h3>{idea.title}</h3>
              <div className="hook-line"><strong>Hook</strong><p>{idea.hook}</p></div>
              <p className="idea-angle">{idea.angle}</p>
              {skill && <div className="skill-reference"><Brain size={15} /> Built with {skill.name}</div>}
              <div className="idea-row-actions">
                {idea.status === "approved" ? (
                  <span className="approved-label"><CheckCircle size={17} weight="fill" /> Approved and scheduled</span>
                ) : (
                  <>
                    <AppButton onClick={() => approveIdea(idea.id)}>Approve</AppButton>
                    <AppButton variant="quiet" onClick={() => rejectIdea(idea.id)}>Pass</AppButton>
                  </>
                )}
              </div>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}

function ScheduleView({ state, moveTask }: { state: MiniCeoState; moveTask: (id: string, direction: -1 | 1) => void }) {
  const planTasks = state.tasks.filter(
    (task) => task.weekStartDate === state.weekStartDate,
  );
  const scheduledDates = [...new Set(planTasks.map((task) => task.scheduledDate))].sort();
  return (
    <div className="standard-view schedule-view">
      <SectionTitle eyebrow={`${state.profile.scheduleStyle} workflow`} title="Production plan" />
      <div className="schedule-goal-line">
        <div><Target size={19} /><span>Weekly target</span><strong>{state.profile.videosPerWeek} videos</strong></div>
        <div><Repeat size={19} /><span>Work style</span><strong>{state.profile.scheduleStyle === "batch" ? "Batching" : "Daily"}</strong></div>
      </div>

      <div className="schedule-days">
        {scheduledDates.map((scheduledDate) => {
          const dateTasks = planTasks
            .filter((task) => task.scheduledDate === scheduledDate)
            .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
          return (
          <section key={scheduledDate} className="schedule-day">
            <div className="schedule-day-heading"><span>{dateTasks[0]?.day.slice(0, 3)}</span><div><strong>{toDateLabel(scheduledDate)}</strong><small>{dateTasks.length} assignments</small></div></div>
            <div className="schedule-task-list">
              {dateTasks.map((task) => (
                <div key={task.id} className={`schedule-task is-${task.status}`}>
                  <div className="schedule-time">{toTimeLabel(task.time)}</div>
                  <div className="schedule-task-copy">
                    <span>{STAGE_LABELS[task.stage]} · {task.duration} min</span>
                    <strong>{task.title}</strong>
                  </div>
                  <div className="move-controls">
                    <button onClick={() => moveTask(task.id, -1)} aria-label={`Move ${task.title} earlier`}><ArrowUp size={14} /></button>
                    <button onClick={() => moveTask(task.id, 1)} aria-label={`Move ${task.title} later`}><ArrowDown size={14} /></button>
                  </div>
                  {task.status === "done" && <CheckCircle className="task-done-icon" size={18} weight="fill" />}
                </div>
              ))}
            </div>
          </section>
          );
        })}
      </div>
    </div>
  );
}

function SkillsView({
  state,
  addReferenceFile,
  openAssistant,
}: {
  state: MiniCeoState;
  addReferenceFile: (file: File) => void;
  openAssistant: () => void;
}) {
  return (
    <div className="standard-view skills-view">
      <SectionTitle eyebrow="Your creative playbooks" title="Content Skills" />
      <p className="section-lead">Examples teach the boss what works for you. Every upload strengthens a reusable skill without copying exact expression.</p>
      {state.skills.map((skill) => (
        <article key={skill.id} className="skill-detail">
          <div className="skill-detail-head">
            <div className="skill-icon"><Brain size={24} weight="fill" /></div>
            <div><span>Active Content Skill</span><h3>{skill.name}</h3></div>
            <strong>{skill.confidence}%</strong>
          </div>
          <div className="skill-confidence"><span style={{ width: `${skill.confidence}%` }} /></div>
          <dl>
            <div><dt>Hook</dt><dd>{skill.hook}</dd></div>
            <div><dt>Pacing</dt><dd>{skill.pacing}</dd></div>
            <div><dt>Tone</dt><dd>{skill.tone}</dd></div>
            <div><dt>Visual</dt><dd>{skill.visualFormat}</dd></div>
            <div><dt>Length</dt><dd>{skill.length}</dd></div>
          </dl>
          <footer><span>{skill.examples} reference {skill.examples === 1 ? "example" : "examples"}</span><small>Private to this device</small></footer>
        </article>
      ))}

      <label className="reference-dropzone">
        <input type="file" accept="video/*,.txt,.md,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void addReferenceFile(file); }} />
        <UploadSimple size={25} />
        <div><strong>Add a reference</strong><span>Upload a video, script, or notes file.</span></div>
        <CaretRight size={18} />
      </label>

      <section className="assistant-capabilities">
        <div><Sparkle size={20} weight="fill" /><span>Mini CEO assistant</span></div>
        <h3>Put the skill to work.</h3>
        <div className="capability-chips">
          <button onClick={openAssistant}>Write three hooks</button>
          <button onClick={openAssistant}>Draft a natural script</button>
          <button onClick={openAssistant}>Build a shot list</button>
        </div>
      </section>
    </div>
  );
}

function ReviewView({
  state,
  updateProfile,
  requestNotifications,
  notificationPermission,
  voiceEnabled,
  setVoiceEnabled,
  installApp,
  resetWorkspace,
}: {
  state: MiniCeoState;
  updateProfile: <K extends keyof MiniCeoState["profile"]>(key: K, value: MiniCeoState["profile"][K]) => void;
  requestNotifications: () => void;
  notificationPermission: NotificationPermission | "unsupported";
  voiceEnabled: boolean;
  setVoiceEnabled: (value: boolean) => void;
  installApp: () => void;
  resetWorkspace: () => void;
}) {
  const grade = gradeForScore(state.weeklyScore);
  const completed = state.tasks.filter((task) => task.status === "done").length;
  return (
    <div className="standard-view review-view">
      <SectionTitle eyebrow="Friday board meeting" title="Weekly performance review" />
      <section className="review-hero">
        <div className="grade-orbit"><span>{grade}</span><small>Performance grade</small></div>
        <div className="review-hero-copy">
          <p className="eyebrow">Boss assessment</p>
          <h3>{state.publishedThisWeek ? "You moved work all the way to the audience." : "Good planning. The publishing result is still outstanding."}</h3>
          <p>{completed} assignments completed, {state.publishedThisWeek} published, and {state.bossApproval}% boss approval.</p>
        </div>
      </section>
      <div className="review-metrics">
        <div><Fire size={21} weight="fill" /><strong>{state.streak}</strong><span>day streak</span></div>
        <div><Target size={21} /><strong>{state.weeklyScore}</strong><span>consistency</span></div>
        <div><CheckCircle size={21} /><strong>{completed}</strong><span>tasks done</span></div>
      </div>

      <section className="achievement-section">
        <h3>Achievements</h3>
        <div className="achievement-list">
          {state.achievements.map((achievement) => (
            <div key={achievement.id}><span><Check size={16} weight="bold" /></span><div><strong>{achievement.title}</strong><p>{achievement.detail}</p></div></div>
          ))}
          {!state.achievements.some((achievement) => achievement.title === "First publish") && (
            <div className="is-locked"><span><LockKey size={16} /></span><div><strong>First publish</strong><p>Finish the pipeline and send the published link.</p></div></div>
          )}
        </div>
      </section>

      <section className="settings-section">
        <h3>Boss settings</h3>
        <div className="setting-row">
          <div><SlidersHorizontal size={19} /><span><strong>Management style</strong><small>Controls language and reminder pressure.</small></span></div>
          <select value={state.profile.bossMode} onChange={(event) => updateProfile("bossMode", event.target.value as BossMode)} aria-label="Management style">
            {BOSS_MODES.map((mode) => <option key={mode.id} value={mode.id}>{mode.name}</option>)}
          </select>
        </div>
        <button className="setting-row" onClick={requestNotifications}>
          <div><Bell size={19} /><span><strong>Browser notification preview</strong><small>{notificationPermission === "granted" ? "Enabled; reminders run while the app is open" : "Optional preview; in-app reminders need no permission"}</small></span></div>
          <CaretRight size={18} />
        </button>
        <div className="setting-row">
          <div><Clock size={19} /><span><strong>Quiet hours</strong><small>In-app pressure pauses during this window.</small></span></div>
          <div>
            <input
              type="time"
              value={state.profile.quietHours.start}
              aria-label="Quiet hours start"
              onChange={(event) => updateProfile("quietHours", { ...state.profile.quietHours, start: event.target.value })}
            />
            <input
              type="time"
              value={state.profile.quietHours.end}
              aria-label="Quiet hours end"
              onChange={(event) => updateProfile("quietHours", { ...state.profile.quietHours, end: event.target.value })}
            />
          </div>
        </div>
        <button className="setting-row" onClick={() => setVoiceEnabled(!voiceEnabled)}>
          <div>{voiceEnabled ? <SpeakerHigh size={19} /> : <SpeakerSlash size={19} />}<span><strong>Mini CEO voice</strong><small>{voiceEnabled ? "Replies can speak out loud" : "Voice replies are muted"}</small></span></div>
          <span className={`toggle ${voiceEnabled ? "is-on" : ""}`}><i /></span>
        </button>
        <button className="setting-row" onClick={installApp}>
          <div><UploadSimple size={19} /><span><strong>Add to Home Screen</strong><small>Install Mini CEO like an iPhone app.</small></span></div>
          <CaretRight size={18} />
        </button>
      </section>

      <button className="reset-link" onClick={resetWorkspace}>Reset demo workspace</button>
    </div>
  );
}

function AssistantSheet({
  messages,
  input,
  setInput,
  busy,
  send,
  close,
  isListening,
  startListening,
  stopListening,
  bossMode,
  isSpeaking,
  stopSpeaking,
}: {
  messages: AssistantMessage[];
  input: string;
  setInput: (value: string) => void;
  busy: boolean;
  send: (promptOverride?: string) => void;
  close: () => void;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  bossMode: BossMode;
  isSpeaking: boolean;
  stopSpeaking: () => void;
}) {
  return (
    <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <motion.section className="assistant-sheet" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 190, damping: 25 }}>
        <header>
          <div className="assistant-boss-mini"><BossCharacter mode={bossMode} mood="talking" speaking={isSpeaking} compact /></div>
          <div><span>Mini CEO assistant</span><strong>What are we solving?</strong></div>
          {isSpeaking && <button onClick={stopSpeaking} aria-label="Stop voice"><SpeakerSlash size={18} /></button>}
          <button onClick={close} aria-label="Close assistant"><X size={20} /></button>
        </header>
        <div className="assistant-suggestions">
          {["Give me three stronger hooks", "Turn this into bullet points", "What props do I need?"].map((suggestion) => (
            <button key={suggestion} onClick={() => void send(suggestion)}>{suggestion}</button>
          ))}
        </div>
        <div className="message-list">
          {messages.map((message) => (
            <div key={message.id} className={`message message-${message.role}`}>{message.text}</div>
          ))}
          {busy && <div className="message message-boss typing-message"><span /><span /><span /></div>}
        </div>
        <form className="assistant-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
          <button type="button" className={isListening ? "is-listening" : ""} onClick={isListening ? stopListening : startListening} aria-label={isListening ? "Stop listening" : "Talk to Mini CEO"}>
            {isListening ? <Pause size={19} weight="fill" /> : <Microphone size={19} weight="fill" />}
          </button>
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={isListening ? "Listening..." : "Ask about the idea, script, or shoot"} />
          <button type="submit" disabled={!input.trim() || busy} aria-label="Send to Mini CEO"><PaperPlaneTilt size={19} weight="fill" /></button>
        </form>
        <footer><LockKey size={13} /> The assistant adapter can connect to Hermes without changing this experience.</footer>
      </motion.section>
    </motion.div>
  );
}

function ProofSheet({
  task,
  link,
  setLink,
  close,
  submitLink,
  submitFile,
  markDone,
}: {
  task: CreatorTask;
  link: string;
  setLink: (value: string) => void;
  close: () => void;
  submitLink: () => void;
  submitFile: (file: File) => void;
  markDone: () => void;
}) {
  return (
    <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <motion.section className="proof-sheet" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 190, damping: 25 }}>
        <header><div><span>{STAGE_LABELS[task.stage]} evidence</span><h3>Show me the work.</h3></div><button onClick={close} aria-label="Close"><X size={20} /></button></header>
        <p>{task.stage === "publish" ? "Send the live link so Mini CEO can count the result." : "Upload the draft or mark the assignment complete. Proof is useful, not mandatory."}</p>
        <label className="proof-upload">
          <input type="file" accept="video/*,image/*,.txt,.md,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) submitFile(file); }} />
          <UploadSimple size={25} />
          <div><strong>Upload draft or video</strong><span>Saved privately on this device.</span></div>
        </label>
        <div className="proof-divider"><span>or</span></div>
        <label className="field-block">
          <span>Published link</span>
          <div className="input-with-icon"><LinkSimple size={18} /><input value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://..." /></div>
        </label>
        <AppButton className="full-button" onClick={submitLink} disabled={!link.trim()}>Submit link</AppButton>
        <AppButton className="full-button" variant="quiet" onClick={markDone}>Mark complete without proof</AppButton>
      </motion.section>
    </motion.div>
  );
}
