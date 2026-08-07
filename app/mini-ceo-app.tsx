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
  CurrencyCircleDollar,
  Fire,
  House,
  Lightbulb,
  LinkSimple,
  LockKey,
  MagicWand,
  MagnifyingGlass,
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
  UsersThree,
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
import { EditorMarketplace } from "./components/EditorMarketplace";
import {
  resolveConversationBossExpression,
  type BossConversationPhase,
} from "./lib/boss-assets";
import {
  AccountabilityReminder,
  AppView,
  BOSS_MODES,
  BossMode,
  CreatorTask,
  DAYS,
  DEMO_MISSED_DAYS,
  DEMO_STORAGE_KEY,
  EMPTY_STATE,
  EditorProject,
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
  createDemoState,
  createEmptyState,
  ensureSingleActiveTask,
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

type VoiceConnection = {
  status: "checking" | "elevenlabs" | "device" | "error";
  selectedVoice?: string;
};

type BrainConnection = {
  status: "checking" | "openrouter" | "hermes" | "error";
  model?: string;
};

type CloudConnection = {
  status: "checking" | "synced" | "local" | "error";
  email?: string;
  name?: string;
};

type PushConnection = {
  status: "checking" | "ready" | "subscribed" | "needs-install" | "unsupported" | "error";
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
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type RecordedListeningSession = {
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  timeoutId: number;
  cancelled: boolean;
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
  { id: "editors", label: "Editors", icon: UsersThree },
  { id: "skills", label: "Skills", icon: Brain },
  { id: "review", label: "Review", icon: ChartLineUp },
];

const COPY: Record<BossMode, { short: string; title: string }> = {
  coach: { short: "Coach", title: "Supportive Coach" },
  serious: { short: "Boss", title: "Serious Boss" },
  unhinged: { short: "CEO", title: "Unhinged CEO" },
};

const DEFAULT_ASSISTANT_MESSAGE: AssistantMessage = {
  id: "welcome",
  role: "boss",
  text: "I can help with ideas, hooks, scripts, research plans, production checklists, and the next best task. What are we making?",
};

const DEMO_KICKOFF_PROMPT =
  "Start the conversation now. I just opened Mini CEO after missing the current publish task for three days. Call out the actual missed task in Unhinged CEO mode, then tell me the single next action. Do not mention that this is a demo or repeat these instructions.";

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

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

async function requestGeneratedIdeas({
  profile,
  references,
  count,
  existingTitles,
}: {
  profile: MiniCeoState["profile"];
  references: ReferenceAsset[];
  count: number;
  existingTitles: string[];
}) {
  const response = await fetch("/api/ideas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      goal: profile.goal,
      topics: profile.topics,
      platforms: profile.platforms,
      bossMode: profile.bossMode,
      count,
      referenceLabels: references.map(
        (reference) => `${reference.label} (${reference.sourceType})`,
      ),
      existingTitles,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    model?: string;
    ideas?: Array<{
      title: string;
      hook: string;
      angle: string;
      topic: string;
      fitReason: string;
      verificationNote: string;
      provenance: NonNullable<Idea["provenance"]>;
    }>;
  };
  if (!response.ok || !Array.isArray(data.ideas) || !data.ideas.length) {
    throw new Error(data.error || "The live idea engine returned no ideas.");
  }
  return {
    model: data.model,
    ideas: data.ideas.map(
      (idea): Idea => ({
        ...idea,
        id: makeId("idea"),
        source: "boss",
        status: "suggested",
      }),
    ),
  };
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

type MacMenuCommand = {
  label: string;
  onClick: () => void;
  active?: boolean;
};

function ClassicMacMenuBar({
  section,
  commands,
  onBrand,
  sectionAction,
}: {
  section: string;
  commands: MacMenuCommand[];
  onBrand: () => void;
  sectionAction?: () => void;
}) {
  return (
    <div className="mac-menu-bar" aria-label={`Mini CEO, ${section}`}>
      <span className="mac-system-mark" aria-hidden="true">MC</span>
      <button type="button" className="mac-brand-command" onClick={onBrand}>Mini CEO</button>
      {commands.map((command) => (
        <button
          type="button"
          key={command.label}
          className={`mac-menu-command ${command.active ? "is-active" : ""}`}
          onClick={command.onClick}
          aria-current={command.active ? "page" : undefined}
        >
          {command.label}
        </button>
      ))}
      {sectionAction ? (
        <button type="button" className="mac-menu-section mac-menu-section-button" onClick={sectionAction}>
          {section}
        </button>
      ) : (
        <span className="mac-menu-section">{section}</span>
      )}
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
  const [isDemoMode, setIsDemoMode] = useState(false);
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
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([DEFAULT_ASSISTANT_MESSAGE]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceConnection, setVoiceConnection] = useState<VoiceConnection>({ status: "checking" });
  const [brainConnection, setBrainConnection] = useState<BrainConnection>({ status: "checking" });
  const [cloudConnection, setCloudConnection] = useState<CloudConnection>({ status: "checking" });
  const [cloudReady, setCloudReady] = useState(false);
  const [pushConnection, setPushConnection] = useState<PushConnection>({ status: "checking" });
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceConversationActive, setVoiceConversationActive] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const recordedListeningRef = useRef<RecordedListeningSession | null>(null);
  const lastReminderKeyRef = useRef("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const voiceRequestRef = useRef<AbortController | null>(null);
  const demoKickoffRequestedRef = useRef(false);
  const stateRef = useRef(state);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const demoMode = new URLSearchParams(window.location.search).get("demo") === "1";
        const storageKey = demoMode ? DEMO_STORAGE_KEY : STORAGE_KEY;
        const saved = localStorage.getItem(storageKey);
        setIsDemoMode(demoMode);
        if (demoMode) {
          setCloudConnection({ status: "local" });
          setCloudReady(true);
          setVoiceConnection({ status: "checking" });
          setBrainConnection({ status: "checking" });
          setPushConnection({ status: "ready" });
          setMessages([]);
          setAssistantError(null);
          setAssistantOpen(true);
          setVoiceConversationActive(false);
        }
        if (saved) {
          setState(migrateMiniCeoState(JSON.parse(saved)));
        } else {
          setState(demoMode ? createDemoState() : createEmptyState());
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
    localStorage.setItem(
      isDemoMode ? DEMO_STORAGE_KEY : STORAGE_KEY,
      JSON.stringify(state),
    );
  }, [hydrated, isDemoMode, state]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!hydrated) return;
    if (isDemoMode) return;
    let cancelled = false;

    const connectCloud = async () => {
      try {
        const response = await fetch("/api/sync", { cache: "no-store" });
        if (response.status === 401) {
          if (!cancelled) setCloudConnection({ status: "local" });
          return;
        }
        if (!response.ok) throw new Error("Cloud unavailable");
        const data = (await response.json()) as {
          state?: MiniCeoState | null;
          user?: { email?: string | null; name?: string | null };
        };
        if (cancelled) return;

        if (data.state) {
          const cloudState = migrateMiniCeoState(data.state);
          stateRef.current = cloudState;
          setState(cloudState);
        } else {
          const saveResponse = await fetch("/api/sync", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ version: 1, state: stateRef.current }),
          });
          if (!saveResponse.ok) throw new Error("Initial cloud save failed");
        }

        if (!cancelled) {
          setCloudConnection({
            status: "synced",
            email: data.user?.email || undefined,
            name: data.user?.name || undefined,
          });
        }
      } catch {
        if (!cancelled) setCloudConnection({ status: "error" });
      } finally {
        if (!cancelled) setCloudReady(true);
      }
    };

    void connectCloud();
    return () => {
      cancelled = true;
    };
  }, [hydrated, isDemoMode]);

  useEffect(() => {
    if (!hydrated || isDemoMode || !cloudReady || cloudConnection.status === "local") return;
    const timeout = window.setTimeout(() => {
      void fetch("/api/sync", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: 1, state }),
      })
        .then((response) => {
          if (!response.ok) throw new Error("Cloud save failed");
          setCloudConnection((current) => ({ ...current, status: "synced" }));
        })
        .catch(() => setCloudConnection((current) => ({ ...current, status: "error" })));
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [cloudConnection.status, cloudReady, hydrated, isDemoMode, state]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    void fetch("/api/voice", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as {
          connected?: boolean;
          selectedVoice?: string | null;
        };
        if (cancelled) return;
        if (response.ok && data.connected) {
          setVoiceConnection({
            status: "elevenlabs",
            selectedVoice: data.selectedVoice || "ElevenLabs voice",
          });
          return;
        }
        setVoiceConnection(
          isDemoMode
            ? { status: "error" }
            : { status: "speechSynthesis" in window ? "device" : "error" },
        );
      })
      .catch(() => {
        if (!cancelled) {
          setVoiceConnection(
            isDemoMode
              ? { status: "error" }
              : { status: "speechSynthesis" in window ? "device" : "error" },
          );
        }
      });

    void fetch("/api/assistant", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as {
          connected?: boolean;
          configured?: boolean;
          provider?: "openrouter" | "hermes" | "unavailable";
          model?: string | null;
        };
        if (cancelled) return;
        if (response.ok && data.connected) {
          setBrainConnection({
            status: data.provider === "hermes" ? "hermes" : "openrouter",
            model: data.model || undefined,
          });
          return;
        }
        setBrainConnection({ status: "error", model: data.model || undefined });
      })
      .catch(() => {
        if (!cancelled) setBrainConnection({ status: "error" });
      });

    if (!isDemoMode) void fetch("/api/push", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          if (!cancelled) setPushConnection({ status: "ready" });
          return;
        }
        const data = (await response.json()) as {
          configured?: boolean;
          subscribed?: boolean;
        };
        if (cancelled) return;
        if (!response.ok || !data.configured) {
          setPushConnection({ status: "error" });
          return;
        }
        setPushConnection({ status: data.subscribed ? "subscribed" : "ready" });
      })
      .catch(() => {
        if (!cancelled) setPushConnection({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, isDemoMode]);

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
  const assistantIdeaBacklog = useMemo(
    () =>
      state.ideas
        .filter((idea) => idea.status !== "rejected")
        .map((idea, originalIndex) => {
          const ideaTasks = state.tasks.filter((task) => task.ideaId === idea.id);
          const nextTask = ideaTasks
            .filter((task) => task.status === "active" || task.status === "queued")
            .sort((left, right) => new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime())[0];
          const current = idea.id === activeIdea?.id;
          const priority = current
            ? 0
            : idea.status === "approved" && nextTask
              ? 1
              : idea.status === "approved"
                ? 2
                : 3;
          return {
            title: idea.title,
            hook: idea.hook,
            angle: idea.angle,
            topic: idea.topic,
            status: idea.status,
            fitReason: idea.fitReason,
            verificationNote: idea.verificationNote,
            current,
            completedTasks: ideaTasks.filter((task) => task.status === "done").length,
            totalTasks: ideaTasks.length,
            nextTask: nextTask
              ? {
                  title: nextTask.title,
                  stage: nextTask.stage,
                  scheduledDate: nextTask.scheduledDate,
                  dueAt: nextTask.dueAt,
                  status: nextTask.status,
                }
              : undefined,
            priority,
            originalIndex,
          };
        })
        .sort(
          (left, right) =>
            left.priority - right.priority ||
            (left.nextTask && right.nextTask
              ? new Date(left.nextTask.dueAt).getTime() - new Date(right.nextTask.dueAt).getTime()
              : 0) ||
            left.originalIndex - right.originalIndex,
        ),
    [activeIdea?.id, state.ideas, state.tasks],
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
    reminder?.urgency === "missed"
      ? "missed"
      : activeTask?.stage === "publish"
        ? "publish"
        : "task",
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

  const stopSpeaking = useCallback(() => {
    voiceRequestRef.current?.abort();
    voiceRequestRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  const speakWithDevice = useCallback(
    (text: string, modeOverride?: BossMode) => {
      if (!("speechSynthesis" in window)) {
        setVoiceConnection({ status: "error" });
        setIsSpeaking(false);
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voiceMode = modeOverride || bossMode;
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (voice) =>
          voice.lang.startsWith("en") &&
          /samantha|ava|daniel|aaron|serena|moira/i.test(voice.name),
      );
      if (preferred) utterance.voice = preferred;
      utterance.rate = voiceMode === "unhinged" ? 1.25 : voiceMode === "coach" ? 1.05 : 1.12;
      utterance.pitch = voiceMode === "unhinged" ? 1.04 : 0.96;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [bossMode],
  );

  const speak = useCallback(
    (text: string, modeOverride?: BossMode) => {
      if (!voiceEnabled) return;
      stopSpeaking();
      const voiceMode = modeOverride || bossMode;

      const controller = new AbortController();
      voiceRequestRef.current = controller;
      setIsSpeaking(true);

      void fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 900), bossMode: voiceMode }),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("ElevenLabs unavailable");
          const blob = await response.blob();
          if (controller.signal.aborted) return;

          const voiceName = decodeURIComponent(
            response.headers.get("X-Mini-CEO-Voice") || "ElevenLabs voice",
          );
          const audioUrl = URL.createObjectURL(blob);
          const audio = new Audio(audioUrl);
          audioRef.current = audio;
          audioUrlRef.current = audioUrl;
          audio.onended = stopSpeaking;
          audio.onerror = () => {
            stopSpeaking();
            if (isDemoMode) {
              setVoiceConnection({ status: "error" });
              setToast("The real ElevenLabs character voice could not play. No device voice was substituted.");
            } else {
              speakWithDevice(text, voiceMode);
            }
          };
          setVoiceConnection({ status: "elevenlabs", selectedVoice: voiceName });
          await audio.play();
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          stopSpeaking();
          if (isDemoMode) {
            setVoiceConnection({ status: "error" });
            setVoiceConversationActive(false);
            setToast("Connect ElevenLabs to hear the real Unhinged CEO voice. No fake voice was used.");
          } else {
            setVoiceConnection({ status: "speechSynthesis" in window ? "device" : "error" });
            speakWithDevice(text, voiceMode);
          }
        });
    },
    [bossMode, isDemoMode, speakWithDevice, stopSpeaking, voiceEnabled],
  );

  useEffect(() => stopSpeaking, [stopSpeaking]);

  const showToast = (message: string) => setToast(message);

  const createEditorProject = (project: EditorProject) => {
    setState((current) => ({
      ...current,
      editorProjects: [project, ...current.editorProjects],
    }));
    showToast("Edit project saved to your Mini CEO workspace.");
  };

  const updateEditorProject = (id: string, update: Partial<EditorProject>) => {
    const updatedAt = new Date().toISOString();
    setState((current) => ({
      ...current,
      editorProjects: current.editorProjects.map((project) =>
        project.id === id ? { ...project, ...update, updatedAt } : project,
      ),
    }));
    if (update.status === "approved") showToast("Final cut approved. Payout is still disabled.");
    else if (update.status === "changes_requested") showToast("Revision notes saved to the project.");
    else if (update.status === "delivered") showToast("Delivery saved. The project is ready for review.");
  };

  const requestNotifications = async () => {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
      setPushConnection({ status: "needs-install" });
      showToast("On iPhone, add Mini CEO to your Home Screen first, then enable notifications inside the app.");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      if (!("pushManager" in registration)) {
        setPushConnection({ status: "unsupported" });
        showToast("This browser does not support Web Push.");
        return;
      }

      const result = await Notification.requestPermission();
      setNotificationPermission(result);
      if (result !== "granted") {
        showToast("Notifications were not enabled. You can change this in your device settings.");
        return;
      }

      const statusResponse = await fetch("/api/push", { cache: "no-store" });
      const status = (await statusResponse.json()) as {
        configured?: boolean;
        publicKey?: string | null;
      };
      if (!statusResponse.ok || !status.configured || !status.publicKey) {
        throw new Error("Push backend unavailable");
      }

      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(status.publicKey),
        }));
      const saveResponse = await fetch("/api/push", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!saveResponse.ok) throw new Error("Subscription save failed");

      const testResponse = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: reminder?.message || bossLine(bossMode, activeTask, "task"),
        }),
      });
      if (!testResponse.ok) throw new Error("Test push failed");
      setPushConnection({ status: "subscribed" });
      showToast("Real Web Push is connected. A closed-app test notification was sent.");
    } catch {
      setPushConnection({ status: "error" });
      showToast("Web Push could not connect yet. Your workspace and in-app reminders are still safe.");
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

  const prepareIdeas = async () => {
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
    const references = reference ? [...state.references, reference] : state.references;
    setIsGenerating(true);
    try {
      const generated = await requestGeneratedIdeas({
        profile,
        references,
        count: Math.max(4, profile.videosPerWeek),
        existingTitles: state.ideas.map((idea) => idea.title),
      });
      setBrainConnection({ status: "openrouter", model: generated.model });
      setState((current) => ({
        ...current,
        profile,
        references,
        ideas: [
          ...generated.ideas,
          ...current.ideas.filter(
            (idea) => idea.status === "approved" || idea.source === "creator",
          ),
        ],
      }));
      setOnboardingStep(5);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "The live idea engine failed. No canned suggestions were added.",
      );
    } finally {
      setIsGenerating(false);
    }
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
      setState((current) => ({
        ...current,
        references: [...current.references, reference],
      }));
      showToast("Reference saved privately. Mini CEO has not analyzed the file contents.");
    } catch {
      showToast("The reference could not be saved on this device. Try a smaller file.");
    }
  };

  const generateMoreIdeas = async () => {
    setIsGenerating(true);
    const scheduledCount = new Set(
      state.tasks
        .filter((task) => task.weekStartDate === state.weekStartDate)
        .map((task) => task.ideaId),
    ).size;
    try {
      const generated = await requestGeneratedIdeas({
        profile: state.profile,
        references: state.references,
        count: Math.max(1, state.profile.videosPerWeek - scheduledCount),
        existingTitles: state.ideas.map((idea) => idea.title),
      });
      setBrainConnection({ status: "openrouter", model: generated.model });
      setState((current) => ({
        ...current,
        ideas: [...generated.ideas, ...current.ideas],
      }));
      showToast("The live model generated new original ideas.");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "The live idea engine failed. No canned suggestions were added.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const addManualIdea = (event: FormEvent) => {
    event.preventDefault();
    if (!manualIdea.trim()) return;
    const idea: Idea = {
      id: makeId("idea"),
      title: manualIdea.trim(),
      hook: "Hook not locked yet. Ask Mini CEO for three options.",
      angle: "Creator-submitted concept. The angle has not been developed yet.",
      topic: state.profile.topics[0] || "Creator idea",
      fitReason: "You submitted this idea directly; Mini CEO has not assigned a numeric score.",
      verificationNote: "Any factual or trend claims still need research before scripting.",
      provenance: {
        kind: "creator-input",
        label: "Submitted by you",
        detail: "Saved exactly from your own idea entry.",
      },
      source: "creator",
      status: "suggested",
      skillId: state.skills[0]?.id,
    };
    setState((current) => ({ ...current, ideas: [idea, ...current.ideas] }));
    setManualIdea("");
    showToast("Idea captured. Approve it when you are ready to commit.");
  };

  const sendAssistant = useCallback(
    async (
      promptOverride?: string,
      options: { hideCreator?: boolean } = {},
    ) => {
      const prompt = (promptOverride ?? assistantInput).trim();
      if (!prompt || assistantBusy) return;
      const creatorMessage: AssistantMessage = {
        id: makeId("message"),
        role: "creator",
        text: prompt,
      };
      if (!options.hideCreator) {
        setMessages((current) => [...current, creatorMessage]);
      }
      setAssistantInput("");
      setAssistantError(null);
      setAssistantBusy(true);
      try {
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: prompt,
            demo: isDemoMode,
            history: messages.slice(-10),
            context: {
              goal: state.profile.goal,
              topics: state.profile.topics,
              bossMode,
              missedDays:
                isDemoMode && activeTask
                  ? Math.max(
                      DEMO_MISSED_DAYS,
                      Math.floor((Date.now() - new Date(activeTask.dueAt).getTime()) / 86_400_000),
                    )
                  : undefined,
              task: activeTask,
              idea: activeIdea,
              ideas: assistantIdeaBacklog,
              skill: state.skills[0],
              references: state.references.slice(-3).map((reference) => ({
                name: reference.label,
                type: reference.sourceType,
                url: reference.sourceType === "link" ? reference.sourceValue : undefined,
              })),
            },
          }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          reply?: string;
          provider: string;
          model?: string;
          error?: string;
        };
        if (!response.ok || !data.reply) {
          throw new Error(data.error || "Live Mini CEO agent unavailable");
        }
        setBrainConnection(
          data.provider === "openrouter"
            ? { status: "openrouter", model: data.model }
            : data.provider === "hermes"
              ? { status: "hermes", model: data.model }
              : { status: "error" },
        );
        const reply: AssistantMessage = {
          id: makeId("message"),
          role: "boss",
          text: data.reply,
        };
        setMessages((current) => [...current, reply]);
        speak(data.reply);
      } catch (error) {
        setBrainConnection({ status: "error" });
        if (isDemoMode) {
          setVoiceConversationActive(false);
          setAssistantError(
            error instanceof Error
              ? `${error.message}. Connect OpenRouter or Hermes to continue the real conversation.`
              : "The live Mini CEO agent is unavailable. No canned reply was substituted.",
          );
          return;
        }
        const fallback = "I could not reach the assistant service. Your schedule is safe; try again in a moment.";
        setMessages((current) => [
          ...current,
          { id: makeId("message"), role: "boss", text: fallback },
        ]);
        speak(fallback);
      } finally {
        setAssistantBusy(false);
      }
    }, [activeIdea, activeTask, assistantBusy, assistantIdeaBacklog, assistantInput, bossMode, isDemoMode, messages, speak, state.profile.goal, state.profile.topics, state.references, state.skills],
  );

  useEffect(() => {
    const liveBrainConnected =
      brainConnection.status === "openrouter" || brainConnection.status === "hermes";
    if (
      !hydrated ||
      !isDemoMode ||
      !assistantOpen ||
      !liveBrainConnected ||
      voiceConnection.status !== "elevenlabs" ||
      demoKickoffRequestedRef.current
    ) {
      return;
    }
    demoKickoffRequestedRef.current = true;
    void sendAssistant(DEMO_KICKOFF_PROMPT, { hideCreator: true });
  }, [assistantOpen, brainConnection.status, hydrated, isDemoMode, sendAssistant, voiceConnection.status]);

  const startRecordedListening = useCallback(async () => {
    if (
      isListening ||
      isTranscribing ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        showToast("This browser cannot open the microphone. Check browser microphone permissions or type to the boss.");
        setVoiceConversationActive(false);
      }
      return;
    }

    setIsListening(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const supportedType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/webm",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(
        stream,
        supportedType ? { mimeType: supportedType } : undefined,
      );
      const session: RecordedListeningSession = {
        recorder,
        stream,
        chunks: [],
        timeoutId: 0,
        cancelled: false,
      };
      recordedListeningRef.current = session;

      recorder.ondataavailable = (event) => {
        if (event.data.size) session.chunks.push(event.data);
      };
      recorder.onerror = () => {
        session.cancelled = true;
        stream.getTracks().forEach((track) => track.stop());
        recordedListeningRef.current = null;
        setIsListening(false);
        setVoiceConversationActive(false);
        showToast("The microphone stopped unexpectedly. Check its browser permission and try again.");
      };
      recorder.onstop = async () => {
        window.clearTimeout(session.timeoutId);
        stream.getTracks().forEach((track) => track.stop());
        recordedListeningRef.current = null;
        setIsListening(false);
        if (session.cancelled) return;

        const audio = new Blob(session.chunks, {
          type: recorder.mimeType || supportedType || "audio/webm",
        });
        if (audio.size < 100) {
          showToast("I did not hear anything. Tap the microphone and try again.");
          return;
        }

        setIsTranscribing(true);
        try {
          const form = new FormData();
          const extension = audio.type.includes("mp4") ? "m4a" : "webm";
          form.append("audio", audio, `mini-ceo-voice.${extension}`);
          const response = await fetch("/api/transcribe", { method: "POST", body: form });
          const data = (await response.json().catch(() => ({}))) as {
            text?: string;
            error?: string;
          };
          if (!response.ok || !data.text?.trim()) {
            throw new Error(data.error || "The boss could not transcribe that recording.");
          }
          const transcript = data.text.trim();
          setAssistantInput(transcript);
          setIsTranscribing(false);
          await sendAssistant(transcript);
        } catch (error) {
          setIsTranscribing(false);
          setVoiceConversationActive(false);
          showToast(
            error instanceof Error
              ? error.message
              : "The live transcription service could not hear that.",
          );
        }
      };

      recorder.start(250);
      session.timeoutId = window.setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 7_000);
    } catch {
      setIsListening(false);
      setVoiceConversationActive(false);
      showToast("Microphone permission is blocked. Allow it for Mini CEO, then tap Talk again.");
    }
  }, [isListening, isTranscribing, sendAssistant]);

  const startListening = useCallback(() => {
    if (assistantBusy || isListening || isTranscribing) return;
    if (
      typeof navigator.mediaDevices?.getUserMedia === "function" &&
      typeof MediaRecorder !== "undefined"
    ) {
      void startRecordedListening();
      return;
    }
    const browserWindow = window as typeof window & {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };
    const Recognition =
      browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      void startRecordedListening();
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
      recognitionRef.current = null;
      window.setTimeout(() => void sendAssistant(transcript), 80);
    };
    recognition.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
      void startRecordedListening();
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    setIsListening(true);
    try {
      recognition.start();
    } catch {
      setIsListening(false);
      recognitionRef.current = null;
      setVoiceConversationActive(false);
      showToast("Microphone permission is blocked. Allow it for Mini CEO, then tap Talk again.");
    }
  }, [assistantBusy, isListening, isTranscribing, sendAssistant, startRecordedListening]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    const recorded = recordedListeningRef.current;
    if (recorded) {
      recorded.cancelled = true;
      window.clearTimeout(recorded.timeoutId);
      if (recorded.recorder.state !== "inactive") recorded.recorder.stop();
      recorded.stream.getTracks().forEach((track) => track.stop());
      recordedListeningRef.current = null;
    }
    setIsListening(false);
    setIsTranscribing(false);
  }, []);

  const startVoiceConversation = useCallback(() => {
    if (
      isDemoMode &&
      (voiceConnection.status !== "elevenlabs" ||
        (brainConnection.status !== "openrouter" && brainConnection.status !== "hermes"))
    ) {
      const missing = [
        voiceConnection.status !== "elevenlabs" ? "ElevenLabs voice" : null,
        brainConnection.status !== "openrouter" && brainConnection.status !== "hermes"
          ? "OpenRouter or Hermes agent"
          : null,
      ].filter(Boolean).join(" and ");
      const message = `Connect ${missing} before starting the real voice conversation.`;
      setAssistantError(message);
      showToast(message);
      return;
    }
    if (!voiceEnabled) setVoiceEnabled(true);
    setAssistantError(null);
    setVoiceConversationActive(true);
    startListening();
  }, [brainConnection.status, isDemoMode, startListening, voiceConnection.status, voiceEnabled]);

  const stopVoiceConversation = useCallback(() => {
    setVoiceConversationActive(false);
    stopListening();
  }, [stopListening]);

  useEffect(() => {
    if (
      !voiceConversationActive ||
      !assistantOpen ||
      assistantBusy ||
      isTranscribing ||
      isSpeaking ||
      isListening
    ) {
      return;
    }
    const timeout = window.setTimeout(startListening, 420);
    return () => window.clearTimeout(timeout);
  }, [assistantBusy, assistantOpen, isListening, isSpeaking, isTranscribing, startListening, voiceConversationActive]);

  const resetWorkspace = async () => {
    if (isDemoMode) {
      localStorage.removeItem(DEMO_STORAGE_KEY);
      demoKickoffRequestedRef.current = false;
      setState(createDemoState());
      setView("today");
      setMessages([]);
      setAssistantError(null);
      setAssistantOpen(true);
      setVoiceConversationActive(false);
      setProofTask(null);
      showToast("Demo story reset. Waiting for the live agent and ElevenLabs voice.");
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
    await fetch("/api/sync", { method: "DELETE" }).catch(() => undefined);
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

  const launchDemo = () => {
    localStorage.removeItem(DEMO_STORAGE_KEY);
    demoKickoffRequestedRef.current = false;
    setState(createDemoState());
    setIsDemoMode(true);
    setView("today");
    setMessages([]);
    setAssistantError(null);
    setAssistantOpen(true);
    setVoiceConversationActive(false);
    setCloudConnection({ status: "local" });
    setCloudReady(true);
    setBrainConnection({ status: "checking" });
    setVoiceConnection({ status: "checking" });
    const url = new URL(window.location.href);
    url.searchParams.set("demo", "1");
    window.history.replaceState({}, "", url);
    setVoiceEnabled(true);
  };

  const exitDemo = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("demo");
    window.location.href = url.toString();
  };

  const exportWorkspace = () => {
    const payload = JSON.stringify(state, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mini-ceo-workspace-${localDateKey()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast("Workspace backup downloaded. Private uploaded files stay on this device.");
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
        isGenerating={isGenerating}
        setStep={setOnboardingStep}
        updateProfile={updateProfile}
        setTopicDraft={setTopicDraft}
        setReferenceDraft={setReferenceDraft}
        prepareIdeas={prepareIdeas}
        approveIdea={approveIdea}
        rejectIdea={rejectIdea}
        finish={finishOnboarding}
        installApp={installApp}
        launchDemo={launchDemo}
        speak={speak}
        isSpeaking={isSpeaking}
        stopSpeaking={stopSpeaking}
      />
    );
  }

  return (
    <main className={`app-shell mode-${bossMode} ${isDemoMode ? "is-demo-mode" : ""}`}>
      <ClassicMacMenuBar
        section={isDemoMode ? "Demo mode" : "Connections"}
        onBrand={() => setView("today")}
        sectionAction={isDemoMode ? resetWorkspace : () => setView("connections")}
        commands={[
          { label: "Today", onClick: () => setView("today"), active: view === "today" },
          { label: "Ideas", onClick: () => setView("ideas"), active: view === "ideas" },
          { label: "Plan", onClick: () => setView("schedule"), active: view === "schedule" },
          { label: "Boss", onClick: () => setAssistantOpen(true), active: assistantOpen },
          ...(isDemoMode ? [{ label: "Exit demo", onClick: exitDemo }] : []),
        ]}
      />
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

        {isDemoMode && (
          <div className="demo-mode-ribbon" role="status">
            <span><Fire size={15} weight="fill" /> Unhinged CEO rehearsal</span>
            <p>3 missed days · AI dog pooper scooper publish overdue · live agent and ElevenLabs only</p>
            <div>
              <button type="button" onClick={resetWorkspace}>Reset story</button>
              <button type="button" onClick={exitDemo}>Exit</button>
            </div>
          </div>
        )}

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
            {view === "editors" && (
              <EditorMarketplace
                projects={state.editorProjects}
                accountLabel={
                  isDemoMode
                    ? "this demo workspace"
                    : cloudConnection.status === "synced"
                      ? "your account workspace"
                      : "this device"
                }
                onCreateProject={createEditorProject}
                onUpdateProject={updateEditorProject}
              />
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
                voiceConnection={voiceConnection}
                setVoiceEnabled={setVoiceEnabled}
                installApp={installApp}
                resetWorkspace={resetWorkspace}
                isDemoMode={isDemoMode}
                openConnections={() => setView("connections")}
              />
            )}
            {view === "connections" && (
              <ConnectionsView
                notificationPermission={notificationPermission}
                requestNotifications={requestNotifications}
                installApp={installApp}
                openAssistant={() => setAssistantOpen(true)}
                testVoice={() => speak("Mini CEO voice check. I am on duty, and your next assignment is waiting.")}
                voiceEnabled={voiceEnabled}
                voiceConnection={voiceConnection}
                brainConnection={brainConnection}
                cloudConnection={cloudConnection}
                pushConnection={pushConnection}
                exportWorkspace={exportWorkspace}
                openMarketplace={() => setView("editors")}
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
            error={assistantError}
            input={assistantInput}
            setInput={setAssistantInput}
            busy={assistantBusy}
            send={sendAssistant}
            close={() => {
              stopVoiceConversation();
              stopSpeaking();
              setAssistantOpen(false);
            }}
            isListening={isListening}
            isTranscribing={isTranscribing}
            voiceConversationActive={voiceConversationActive}
            startVoiceConversation={startVoiceConversation}
            stopVoiceConversation={stopVoiceConversation}
            brainConnection={brainConnection}
            voiceConnection={voiceConnection}
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
  isGenerating,
  setStep,
  updateProfile,
  setTopicDraft,
  setReferenceDraft,
  prepareIdeas,
  approveIdea,
  rejectIdea,
  finish,
  installApp,
  launchDemo,
  speak,
  isSpeaking,
  stopSpeaking,
}: {
  state: MiniCeoState;
  step: number;
  topicDraft: string;
  referenceDraft: string;
  approvedIdeas: Idea[];
  isGenerating: boolean;
  setStep: (step: number) => void;
  updateProfile: <K extends keyof MiniCeoState["profile"]>(key: K, value: MiniCeoState["profile"][K]) => void;
  setTopicDraft: (value: string) => void;
  setReferenceDraft: (value: string) => void;
  prepareIdeas: () => Promise<void>;
  approveIdea: (id: string) => void;
  rejectIdea: (id: string) => void;
  finish: () => void;
  installApp: () => void;
  launchDemo: () => void;
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
      <ClassicMacMenuBar
        section={`Setup ${step + 1} of 6`}
        onBrand={() => setStep(0)}
        commands={[
          { label: "Welcome", onClick: () => setStep(0), active: step === 0 },
          { label: "Boss", onClick: () => setStep(1), active: step === 1 },
          { label: "Goal", onClick: () => setStep(2), active: step === 2 },
          { label: "Schedule", onClick: () => setStep(3), active: step === 3 },
        ]}
      />
      <header className="onboarding-header">
        <span className="mac-window-box" aria-hidden="true"><i /></span>
        <div className="mini-wordmark"><span>MC</span> Mini CEO</div>
        <button type="button" className="onboarding-demo-button" onClick={launchDemo}>
          <Play size={14} weight="fill" /> Try the live demo
        </button>
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
                  <BossCharacter mode="serious" mood="focused" action="welcome" speaking={isSpeaking} />
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
                    aria-pressed={profile.bossMode === mode.id}
                  >
                    <div className="mode-character-mini">
                      <BossCharacter
                        mode={mode.id}
                        mood={mode.id === "coach" ? "pleased" : mode.id === "unhinged" ? "impatient" : "focused"}
                        expression={mode.id === "coach" ? "approving" : mode.id === "unhinged" ? "impatient" : "focused"}
                        compact
                      />
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
                <p>Topics set the territory. Reference labels give the live model context without pretending it watched content it cannot access.</p>
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
                  <strong>No imaginary analysis.</strong>
                  <p>Mini CEO records the reference label honestly. File or video analysis will appear only after a real analysis request succeeds.</p>
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
                  {isGenerating && (
                    <div className="idea-skeleton-list" aria-busy="true">
                      {[0, 1, 2].map((item) => <div key={item}><span /><span /><span /></div>)}
                    </div>
                  )}
                  {!isGenerating && !state.ideas.length && (
                    <div className="empty-mini-state honest-empty-state">
                      <Sparkle size={28} />
                      <p>No real ideas have been generated yet. Mini CEO will not substitute templates.</p>
                      <AppButton onClick={() => void prepareIdeas()}>Try the live model again</AppButton>
                    </div>
                  )}
                  {state.ideas.slice(0, Math.max(4, profile.videosPerWeek)).map((idea, index) => (
                    <motion.article
                      key={idea.id}
                      className={`onboarding-idea ${idea.status === "approved" ? "is-approved" : ""}`}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: idea.status === "rejected" ? 0.42 : 1, y: 0 }}
                      transition={{ delay: index * 0.08 }}
                    >
                      <div className="idea-fit"><Sparkle size={15} /> {idea.provenance?.label || (idea.source === "creator" ? "Submitted by you" : "Legacy approved idea")}</div>
                      <h3>{idea.title}</h3>
                      <p>{idea.hook}</p>
                      {idea.fitReason && <p className="idea-fit-reason"><strong>Why it fits:</strong> {idea.fitReason}</p>}
                      {idea.verificationNote && <p className="idea-verification"><strong>Verify:</strong> {idea.verificationNote}</p>}
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
            <AppButton onClick={() => void prepareIdeas()} disabled={!topicDraft.trim() || isGenerating}>
              {isGenerating ? "Asking the live model…" : "Generate real ideas"} <MagicWand size={17} />
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
  const bossAction = !activeTask
    ? "complete"
    : reminder?.urgency === "missed"
      ? "missedDeadline"
      : reminder?.urgency === "due"
        ? "reminder"
        : "assignment";

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
          <BossCharacter
            mode={mode}
            mood={activeTask ? reminder?.urgency === "missed" ? "impatient" : "focused" : "pleased"}
            action={bossAction}
            speaking={isSpeaking}
          />
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
      <p className="section-lead">Every boss suggestion must come from the connected live model. Mini CEO shows why it fits and what still needs verification.</p>

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
          const sourceLabel = idea.provenance?.label || (idea.source === "creator" ? "Your idea" : "Legacy approved idea");
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
                <span className="idea-source">{sourceLabel}</span>
              </div>
              <h3>{idea.title}</h3>
              <div className="hook-line"><strong>Hook</strong><p>{idea.hook}</p></div>
              <p className="idea-angle">{idea.angle}</p>
              {idea.fitReason && <p className="idea-fit-reason"><Target size={15} /><span><strong>Why it fits:</strong> {idea.fitReason}</span></p>}
              {idea.verificationNote && <p className="idea-verification"><MagnifyingGlass size={15} /><span><strong>Verify:</strong> {idea.verificationNote}</span></p>}
              {idea.provenance?.detail && <p className="idea-provenance-detail">{idea.provenance.detail}</p>}
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
      <SectionTitle eyebrow="Real creator context" title="Reference vault" />
      <p className="section-lead">Files saved here stay private to this device. Mini CEO does not claim to understand a file until a real transcript or media-analysis service has processed it.</p>
      {state.skills.filter((skill) => skill.id.startsWith("demo_")).map((skill) => (
        <article key={skill.id} className="skill-detail">
          <div className="skill-detail-head">
            <div className="skill-icon"><Brain size={24} weight="fill" /></div>
            <div><span>Demo-only example</span><h3>{skill.name}</h3></div>
            <strong>Demo</strong>
          </div>
          <dl>
            <div><dt>Hook</dt><dd>{skill.hook}</dd></div>
            <div><dt>Pacing</dt><dd>{skill.pacing}</dd></div>
            <div><dt>Tone</dt><dd>{skill.tone}</dd></div>
            <div><dt>Visual</dt><dd>{skill.visualFormat}</dd></div>
            <div><dt>Length</dt><dd>{skill.length}</dd></div>
          </dl>
          <footer><span>Illustrative data</span><small>Never used in a real workspace</small></footer>
        </article>
      ))}

      {!state.skills.some((skill) => skill.id.startsWith("demo_")) && (
        <div className="honest-empty-state">
          <Brain size={24} />
          <div><strong>No analyzed Content Skill yet</strong><span>Your saved references remain reference metadata until real analysis completes.</span></div>
        </div>
      )}

      <label className="reference-dropzone">
        <input type="file" accept="video/*,.txt,.md,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void addReferenceFile(file); }} />
        <UploadSimple size={25} />
        <div><strong>Save a private reference</strong><span>Stored on this device; not automatically analyzed.</span></div>
        <CaretRight size={18} />
      </label>

      <section className="assistant-capabilities">
        <div><Sparkle size={20} weight="fill" /><span>Mini CEO assistant</span></div>
        <h3>Use your real creator context.</h3>
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
  voiceConnection,
  setVoiceEnabled,
  installApp,
  resetWorkspace,
  isDemoMode,
  openConnections,
}: {
  state: MiniCeoState;
  updateProfile: <K extends keyof MiniCeoState["profile"]>(key: K, value: MiniCeoState["profile"][K]) => void;
  requestNotifications: () => void;
  notificationPermission: NotificationPermission | "unsupported";
  voiceEnabled: boolean;
  voiceConnection: VoiceConnection;
  setVoiceEnabled: (value: boolean) => void;
  installApp: () => void;
  resetWorkspace: () => void;
  isDemoMode: boolean;
  openConnections: () => void;
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
          <div><Bell size={19} /><span><strong>iPhone Web Push</strong><small>{notificationPermission === "granted" ? "Permission enabled; tap to send a server test" : "Install to Home Screen, then enable closed-app notifications"}</small></span></div>
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
          <div>{voiceEnabled ? <SpeakerHigh size={19} /> : <SpeakerSlash size={19} />}<span><strong>Mini CEO voice</strong><small>{!voiceEnabled ? "Voice replies are muted" : voiceConnection.status === "elevenlabs" ? `${voiceConnection.selectedVoice || "ElevenLabs"} is the hosted character voice` : isDemoMode ? "Demo voice is locked to real ElevenLabs audio" : "Device voice fallback is active"}</small></span></div>
          <span className={`toggle ${voiceEnabled ? "is-on" : ""}`}><i /></span>
        </button>
        <button className="setting-row" onClick={installApp}>
          <div><UploadSimple size={19} /><span><strong>Add to Home Screen</strong><small>Install Mini CEO like an iPhone app.</small></span></div>
          <CaretRight size={18} />
        </button>
        <button className="setting-row" onClick={openConnections}>
          <div><LinkSimple size={19} /><span><strong>Connections</strong><small>See exactly what is live, local, or not connected.</small></span></div>
          <CaretRight size={18} />
        </button>
      </section>

      <button className="reset-link" onClick={resetWorkspace}>
        {isDemoMode ? "Reset demo story" : "Reset workspace"}
      </button>
    </div>
  );
}

function ConnectionsView({
  notificationPermission,
  requestNotifications,
  installApp,
  openAssistant,
  testVoice,
  voiceEnabled,
  voiceConnection,
  brainConnection,
  cloudConnection,
  pushConnection,
  exportWorkspace,
  openMarketplace,
}: {
  notificationPermission: NotificationPermission | "unsupported";
  requestNotifications: () => void;
  installApp: () => void;
  openAssistant: () => void;
  testVoice: () => void;
  voiceEnabled: boolean;
  voiceConnection: VoiceConnection;
  brainConnection: BrainConnection;
  cloudConnection: CloudConnection;
  pushConnection: PushConnection;
  exportWorkspace: () => void;
  openMarketplace: () => void;
}) {
  const notificationActive = notificationPermission === "granted";
  const deviceVoiceAvailable = typeof window !== "undefined" && "speechSynthesis" in window;
  const voiceAvailable = voiceConnection.status === "elevenlabs" || deviceVoiceAvailable;
  const voiceStatus = !voiceEnabled
    ? "Muted"
    : voiceConnection.status === "checking"
      ? "Checking"
      : voiceConnection.status === "elevenlabs"
        ? "Active"
        : voiceConnection.status === "device"
          ? "Device fallback"
          : "Unavailable";
  const voiceDetail = voiceConnection.status === "elevenlabs"
    ? `${voiceConnection.selectedVoice || "ElevenLabs"} is selected as the consistent Mini CEO character voice.`
    : voiceConnection.status === "checking"
      ? "Mini CEO is verifying the hosted ElevenLabs connection."
      : "The hosted voice is unavailable, so Mini CEO will use a voice installed on this device when possible.";
  const brainStatus = brainConnection.status === "openrouter"
    ? "Active"
    : brainConnection.status === "hermes"
      ? "Active"
    : brainConnection.status === "checking"
      ? "Checking"
      : "Connection error";
  const cloudStatus = cloudConnection.status === "synced"
    ? "Synced"
    : cloudConnection.status === "checking"
      ? "Checking"
      : cloudConnection.status === "local"
        ? "Device only"
        : "Sync error";
  const pushStatus = pushConnection.status === "subscribed"
    ? "Subscribed"
    : pushConnection.status === "checking"
      ? "Checking"
      : pushConnection.status === "ready"
        ? "Ready to enable"
        : pushConnection.status === "needs-install"
          ? "Install first"
          : pushConnection.status === "unsupported"
            ? "Unsupported"
            : "Connection error";

  return (
    <div className="standard-view connections-view">
      <SectionTitle eyebrow="No pretend integrations" title="What is actually connected" />
      <p className="connections-intro">
        A green status means the feature works now. A blue status means it works only on this device.
        Anything marked not connected has no hidden button or simulated data behind it.
      </p>

      <section className="connection-group" aria-labelledby="working-now-title">
        <div className="connection-group-heading">
          <div>
            <p className="eyebrow">Working now</p>
            <h3 id="working-now-title">Live connections</h3>
          </div>
          <span className="connection-summary">Checked live</span>
        </div>

        <div className="connection-list">
          <article className="connection-row">
            <div className="connection-icon"><LockKey size={20} /></div>
            <div className="connection-copy">
              <div><h4>Account and creator workspace</h4><span className={`connection-badge ${cloudConnection.status === "synced" ? "is-live" : cloudConnection.status === "checking" || cloudConnection.status === "local" ? "is-device" : "is-off"}`}>{cloudStatus}</span></div>
              <p>{cloudConnection.status === "synced" ? `Goals, ideas, tasks, streaks, and settings sync to your private account${cloudConnection.email ? ` (${cloudConnection.email})` : ""}. Uploaded source files remain private to this device.` : "This browser keeps a local copy. Cloud sync becomes authoritative after private account authentication is available."}</p>
            </div>
            <AppButton variant="secondary" onClick={exportWorkspace}>Export backup</AppButton>
          </article>

          <article className="connection-row">
            <div className="connection-icon"><Brain size={20} /></div>
            <div className="connection-copy">
              <div><h4>Live boss agent</h4><span className={`connection-badge ${brainConnection.status === "openrouter" || brainConnection.status === "hermes" ? "is-live" : brainConnection.status === "checking" ? "is-device" : "is-off"}`}>{brainStatus}</span></div>
              <p>{brainConnection.status === "openrouter" || brainConnection.status === "hermes" ? `${brainConnection.model || (brainConnection.status === "hermes" ? "The configured Hermes agent" : "The configured OpenRouter model")} writes each boss reply from the current task data and conversation history.` : "The live boss agent is unavailable. Mini CEO will show the connection failure instead of substituting canned replies."}</p>
            </div>
            <AppButton variant="secondary" onClick={openAssistant}>Open boss</AppButton>
          </article>

          <article className="connection-row">
            <div className="connection-icon">{voiceEnabled ? <SpeakerHigh size={20} /> : <SpeakerSlash size={20} />}</div>
            <div className="connection-copy">
              <div><h4>ElevenLabs character voice</h4><span className={`connection-badge ${voiceConnection.status === "elevenlabs" && voiceEnabled ? "is-live" : voiceConnection.status === "checking" ? "is-device" : "is-off"}`}>{voiceStatus}</span></div>
              <p>{voiceDetail}</p>
            </div>
            <AppButton variant="secondary" onClick={testVoice} disabled={!voiceAvailable || !voiceEnabled}>Test voice</AppButton>
          </article>

          <article className="connection-row">
            <div className="connection-icon"><Bell size={20} /></div>
            <div className="connection-copy">
              <div><h4>iPhone Web Push</h4><span className={`connection-badge ${pushConnection.status === "subscribed" ? "is-live" : pushConnection.status === "checking" || pushConnection.status === "ready" ? "is-device" : "is-off"}`}>{pushStatus}</span></div>
              <p>{pushConnection.status === "subscribed" ? "This device has a real server-held push subscription, and notifications can arrive after the Home Screen app closes." : "Install Mini CEO to the iPhone Home Screen, then tap Enable to create a real push subscription and receive a server-sent test."}</p>
            </div>
            <AppButton variant="secondary" onClick={requestNotifications}>{notificationActive ? "Send test" : "Enable"}</AppButton>
          </article>

          <article className="connection-row">
            <div className="connection-icon"><UsersThree size={20} /></div>
            <div className="connection-copy">
              <div><h4>Mini CEO editors marketplace</h4><span className="connection-badge is-device">Preview only</span></div>
              <p>The directory, filters, profiles, and request form work locally with clearly labeled sample data. No editor is contacted and no request leaves this browser.</p>
            </div>
            <AppButton variant="secondary" onClick={openMarketplace}>Browse</AppButton>
          </article>
        </div>
      </section>

      <section className="connection-group" aria-labelledby="setup-next-title">
        <div className="connection-group-heading">
          <div>
            <p className="eyebrow">Requires backend setup</p>
            <h3 id="setup-next-title">Not connected yet</h3>
          </div>
          <AppButton variant="quiet" onClick={installApp}><UploadSimple size={17} /> Install app</AppButton>
        </div>

        <div className="connection-list connection-list-pending">
          <article className="connection-row">
            <div className="connection-icon"><LinkSimple size={20} /></div>
            <div className="connection-copy">
              <div><h4>Automatic reminder dispatch</h4><span className="connection-badge is-off">Awaiting scheduler</span></div>
              <p>The subscription, service worker, secure dispatch route, quiet hours, and reminder deduplication are built. A separate recurring trigger must call the private dispatch route.</p>
            </div>
            <span className="connection-requirement">External cron trigger required</span>
          </article>

          <article className="connection-row">
            <div className="connection-icon"><VideoCamera size={20} /></div>
            <div className="connection-copy">
              <div><h4>Creator platforms</h4><span className="connection-badge is-off">Not connected</span></div>
              <p>TikTok, Instagram, YouTube, Facebook, and X are planning targets only. Mini CEO does not post or read analytics yet.</p>
            </div>
            <span className="connection-requirement">Platform approval required</span>
          </article>

          <article className="connection-row">
            <div className="connection-icon"><CurrencyCircleDollar size={20} /></div>
            <div className="connection-copy">
              <div><h4>Editor wallet payouts</h4><span className="connection-badge is-off">Not connected</span></div>
              <p>The marketplace shows the planned approve-then-pay workflow, but it has no wallet, QuickNode, OKX, escrow contract, or transaction endpoint.</p>
            </div>
            <span className="connection-requirement">Payment integration intentionally disabled</span>
          </article>
        </div>
      </section>
    </div>
  );
}

function AssistantSheet({
  messages,
  error,
  input,
  setInput,
  busy,
  send,
  close,
  isListening,
  isTranscribing,
  voiceConversationActive,
  startVoiceConversation,
  stopVoiceConversation,
  brainConnection,
  voiceConnection,
  bossMode,
  isSpeaking,
  stopSpeaking,
}: {
  messages: AssistantMessage[];
  error: string | null;
  input: string;
  setInput: (value: string) => void;
  busy: boolean;
  send: (promptOverride?: string) => void;
  close: () => void;
  isListening: boolean;
  isTranscribing: boolean;
  voiceConversationActive: boolean;
  startVoiceConversation: () => void;
  stopVoiceConversation: () => void;
  brainConnection: BrainConnection;
  voiceConnection: VoiceConnection;
  bossMode: BossMode;
  isSpeaking: boolean;
  stopSpeaking: () => void;
}) {
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const unhinged = bossMode === "unhinged";
  const liveBrainConnected =
    brainConnection.status === "openrouter" || brainConnection.status === "hermes";
  const liveVoiceConnected = voiceConnection.status === "elevenlabs";
  const checkingConnections =
    brainConnection.status === "checking" || voiceConnection.status === "checking";
  const suggestions = unhinged
    ? ["What task should I do today?", "What's the next idea?", "Why am I three days late?"]
    : ["Give me three stronger hooks", "Turn this into bullet points", "What props do I need?"];
  const latestBossMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "boss")?.text,
    [messages],
  );
  const conversationPhase: BossConversationPhase = error
    ? "error"
    : isListening
      ? "listening"
      : busy || isTranscribing
        ? "thinking"
        : checkingConnections
          ? "connecting"
          : isSpeaking
            ? "speaking"
            : "idle";
  const conversationExpression = useMemo(
    () =>
      resolveConversationBossExpression({
        message: latestBossMessage,
        mode: bossMode,
        phase: conversationPhase,
      }),
    [bossMode, conversationPhase, latestBossMessage],
  );

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [busy, messages]);

  return (
    <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <motion.section className="assistant-sheet" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 190, damping: 25 }}>
        <header>
          <div className="assistant-boss-mini">
            <BossCharacter
              mode={bossMode}
              mood={conversationExpression}
              expression={conversationExpression}
              speaking={isSpeaking}
              compact
            />
          </div>
          <div>
            <span>{voiceConversationActive ? "Live voice conversation" : checkingConnections ? "Connecting live CEO" : "Mini CEO assistant"}</span>
            <strong>{unhinged ? "The board is furious." : "What are we solving?"}</strong>
          </div>
          {isSpeaking && <button onClick={stopSpeaking} aria-label="Stop voice"><SpeakerSlash size={18} /></button>}
          <button onClick={close} aria-label="Close assistant"><X size={20} /></button>
        </header>
        <div className={`voice-conversation-status ${voiceConversationActive ? "is-active" : ""}`} role="status">
          <span aria-hidden="true" />
          <strong>{voiceConversationActive ? isListening ? "Listening to you" : isTranscribing ? "Transcribing your voice" : isSpeaking ? "ElevenLabs CEO is talking" : busy ? "Live agent is thinking" : "Keeping the mic open" : checkingConnections ? "Checking live services" : liveBrainConnected && liveVoiceConnected ? "Live agent and voice ready" : "Live connections required"}</strong>
          <small>{voiceConversationActive ? "Speak naturally for up to seven seconds. Mini CEO sends it, answers, then reopens the microphone." : liveBrainConnected && liveVoiceConnected ? "Tap the microphone to start the real continuous conversation." : "Demo mode never substitutes canned dialogue or a browser voice."}</small>
        </div>
        <div className="assistant-suggestions">
          {suggestions.map((suggestion) => (
            <button key={suggestion} onClick={() => void send(suggestion)} disabled={!liveBrainConnected || busy}>{suggestion}</button>
          ))}
        </div>
        <div className="message-list">
          {!messages.length && !busy && (
            <div className="assistant-live-state">
              <Brain size={25} weight="fill" />
              <h3>{checkingConnections ? "Calling the real Mini CEO" : liveBrainConnected ? "Live agent connected" : "Live agent connection required"}</h3>
              <p>{checkingConnections ? "Checking OpenRouter or Hermes and the ElevenLabs character voice." : liveBrainConnected ? liveVoiceConnected ? "The agent has the three missed days and overdue AI dog pooper scooper task as context." : "The live agent is ready, but ElevenLabs must connect before voice mode can begin." : "Configure OpenRouter or Hermes. The demo will not manufacture a boss reply."}</p>
            </div>
          )}
          {error && <div className="assistant-live-error" role="alert">{error}</div>}
          {messages.map((message) => (
            <div key={message.id} className={`message message-${message.role}`}>{message.text}</div>
          ))}
          {busy && <div className="message message-boss typing-message"><span /><span /><span /></div>}
          <div ref={messageEndRef} />
        </div>
        <form className="assistant-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
          <button type="button" className={voiceConversationActive ? "is-listening" : ""} onClick={voiceConversationActive ? stopVoiceConversation : startVoiceConversation} aria-label={voiceConversationActive ? "End voice conversation" : "Start voice conversation"}>
            {voiceConversationActive ? <Pause size={19} weight="fill" /> : <Microphone size={19} weight="fill" />}
          </button>
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={isListening ? "Listening..." : isTranscribing ? "Transcribing..." : voiceConversationActive ? "Talk or type your reply" : "Ask about the idea, script, or shoot"} />
          <button type="submit" disabled={!input.trim() || busy || isTranscribing || !liveBrainConnected} aria-label="Send to Mini CEO"><PaperPlaneTilt size={19} weight="fill" /></button>
        </form>
        <footer><LockKey size={13} /> Every CEO reply is a live agent response · demo speech uses ElevenLabs only</footer>
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
