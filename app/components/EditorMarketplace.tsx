"use client";

import {
  ArrowCounterClockwise,
  ArrowRight,
  Briefcase,
  Check,
  CheckCircle,
  ClockCountdown,
  CurrencyCircleDollar,
  FilmSlate,
  LinkSimple,
  LockKey,
  MagnifyingGlass,
  PaperPlaneTilt,
  ShieldCheck,
  SlidersHorizontal,
  UsersThree,
  Wallet,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { FormEvent, useMemo, useState } from "react";
import type { EditorProject, EditorProjectStatus } from "../lib/mini-ceo";
import { makeId } from "../lib/mini-ceo";

export const MARKETPLACE_FEATURES = {
  editorAccounts: false,
  cryptoPayouts: false,
} as const;

const FILTERS = ["All", "Short-form", "Long-form", "Motion", "Captions"] as const;
type EditorFilter = (typeof FILTERS)[number];

type EditorProfile = {
  id: string;
  name: string;
  studio: string;
  monogram: string;
  location: string;
  timezone: string;
  specialties: Exclude<EditorFilter, "All">[];
  rate: string;
  turnaround: string;
  availability: string;
  bio: string;
  bestFor: string;
  tools: string[];
  sampleTitle: string;
  palette: "blue" | "gold" | "green" | "rose";
};

const EDITORS: EditorProfile[] = [
  {
    id: "amina-duarte",
    name: "Amina Duarte",
    studio: "Cut Room 11",
    monogram: "AD",
    location: "Miami, FL",
    timezone: "ET",
    specialties: ["Short-form", "Captions"],
    rate: "From $95 per edit",
    turnaround: "2-3 days",
    availability: "Taking two requests",
    bio: "Fast, editorial short-form cuts with restrained captions, purposeful punch-ins, and clean sound design.",
    bestFor: "Talking-head education, creator commentary, and weekly social packages.",
    tools: ["Premiere Pro", "After Effects", "Descript"],
    sampleTitle: "Commentary cut with branded captions",
    palette: "blue",
  },
  {
    id: "koji-mercer",
    name: "Koji Mercer",
    studio: "Soft Cut Office",
    monogram: "KM",
    location: "Portland, OR",
    timezone: "PT",
    specialties: ["Long-form", "Short-form"],
    rate: "From $180 per edit",
    turnaround: "3-5 days",
    availability: "Next opening Monday",
    bio: "Story-first editing for interviews and video essays, with a strong eye for selecting moments that repurpose well.",
    bestFor: "YouTube essays, founder interviews, podcasts, and multi-format cutdowns.",
    tools: ["DaVinci Resolve", "Premiere Pro", "Frame.io"],
    sampleTitle: "Eight-minute interview narrative",
    palette: "gold",
  },
  {
    id: "noa-mensah",
    name: "Noa Mensah",
    studio: "Loop Assembly",
    monogram: "NM",
    location: "Toronto, CA",
    timezone: "ET",
    specialties: ["Motion", "Short-form"],
    rate: "From $145 per edit",
    turnaround: "3-4 days",
    availability: "Taking one request",
    bio: "Graphic-led edits that turn screen recordings, product footage, and voiceover into clear visual explanations.",
    bestFor: "Product launches, app demos, explainers, and motion-heavy vertical video.",
    tools: ["After Effects", "Premiere Pro", "Figma"],
    sampleTitle: "Product walkthrough with motion system",
    palette: "green",
  },
  {
    id: "lucia-voss",
    name: "Lucia Voss",
    studio: "Good Take Studio",
    monogram: "LV",
    location: "Madrid, ES",
    timezone: "CET",
    specialties: ["Captions", "Long-form"],
    rate: "From $120 per edit",
    turnaround: "2-4 days",
    availability: "Available this week",
    bio: "Multilingual editor focused on legible captions, natural pacing, and polished interview or course footage.",
    bestFor: "Courses, interviews, bilingual content, and accessible social video.",
    tools: ["Final Cut Pro", "Motion", "Descript"],
    sampleTitle: "Bilingual interview and social cutdown",
    palette: "rose",
  },
];

type RequestDraft = {
  title: string;
  format: string;
  budget: string;
  deadline: string;
  brief: string;
  referenceUrl: string;
};

const EMPTY_REQUEST: RequestDraft = {
  title: "",
  format: "Short-form vertical video",
  budget: "",
  deadline: "",
  brief: "",
  referenceUrl: "",
};

const STATUS_COPY: Record<EditorProjectStatus, { label: string; detail: string; step: number }> = {
  requested: { label: "Request saved", detail: "Waiting for an editor response", step: 1 },
  accepted: { label: "Editor assigned", detail: "The first cut is in progress", step: 2 },
  delivered: { label: "Ready to review", detail: "Approve the cut or request changes", step: 3 },
  changes_requested: { label: "Changes requested", detail: "Waiting for a revised delivery", step: 2 },
  approved: { label: "Final approved", detail: "Payout remains locked", step: 4 },
  cancelled: { label: "Request cancelled", detail: "This project is closed", step: 0 },
};

type EditorMarketplaceProps = {
  projects: EditorProject[];
  accountLabel: string;
  onCreateProject: (project: EditorProject) => void;
  onUpdateProject: (id: string, update: Partial<EditorProject>) => void;
};

function isSafeProjectUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function formatProjectDate(value: string) {
  if (!value) return "Not set";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function EditorMarketplace({
  projects,
  accountLabel,
  onCreateProject,
  onUpdateProject,
}: EditorMarketplaceProps) {
  const [workspaceTab, setWorkspaceTab] = useState<"directory" | "projects">("directory");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<EditorFilter>("All");
  const [selectedEditor, setSelectedEditor] = useState<EditorProfile | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [sheetMode, setSheetMode] = useState<"profile" | "request">("profile");
  const [request, setRequest] = useState<RequestDraft>(EMPTY_REQUEST);
  const [errors, setErrors] = useState<Partial<Record<keyof RequestDraft, string>>>({});
  const [submittedProjectId, setSubmittedProjectId] = useState<string | null>(null);
  const [deliveryUrl, setDeliveryUrl] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [projectError, setProjectError] = useState("");

  const visibleEditors = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return EDITORS.filter((editor) => {
      const matchesFilter = filter === "All" || editor.specialties.includes(filter);
      const matchesQuery =
        !normalizedQuery ||
        [editor.name, editor.studio, editor.location, editor.bio, editor.bestFor, ...editor.specialties, ...editor.tools]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [filter, query]);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [projects],
  );
  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null;

  const openProfile = (editor: EditorProfile) => {
    setSelectedEditor(editor);
    setSheetMode("profile");
    setSubmittedProjectId(null);
    setErrors({});
  };

  const openRequest = (editor: EditorProfile) => {
    setSelectedEditor(editor);
    setSheetMode("request");
    setSubmittedProjectId(null);
    setErrors({});
  };

  const closeEditorSheet = () => {
    setSelectedEditor(null);
    setSheetMode("profile");
    setRequest(EMPTY_REQUEST);
    setErrors({});
    setSubmittedProjectId(null);
  };

  const openProject = (project: EditorProject) => {
    setSelectedProjectId(project.id);
    setDeliveryUrl(project.deliveryUrl);
    setDeliveryNote(project.deliveryNote);
    setReviewNote(project.revisionNote);
    setProjectError("");
  };

  const closeProject = () => {
    setSelectedProjectId(null);
    setDeliveryUrl("");
    setDeliveryNote("");
    setReviewNote("");
    setProjectError("");
  };

  const updateRequest = (field: keyof RequestDraft, value: string) => {
    setRequest((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submitRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedEditor) return;
    const nextErrors: Partial<Record<keyof RequestDraft, string>> = {};
    if (!request.title.trim()) nextErrors.title = "Give the project a working title.";
    if (!request.budget.trim()) nextErrors.budget = "Add a budget so the editor can assess the request.";
    if (!request.deadline) nextErrors.deadline = "Choose the date you need the first cut.";
    if (request.brief.trim().length < 20) nextErrors.brief = "Add at least a few sentences about the footage and desired result.";
    if (!isSafeProjectUrl(request.referenceUrl)) nextErrors.referenceUrl = "Use a complete http or https link.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const now = new Date().toISOString();
    const project: EditorProject = {
      id: makeId("editor_project"),
      editorId: selectedEditor.id,
      editorName: selectedEditor.name,
      editorStudio: selectedEditor.studio,
      title: request.title.trim(),
      deliverable: request.format,
      budget: request.budget.trim(),
      deadline: request.deadline,
      brief: request.brief.trim(),
      referenceUrl: request.referenceUrl.trim(),
      status: "requested",
      deliveryUrl: "",
      deliveryNote: "",
      revisionNote: "",
      createdAt: now,
      updatedAt: now,
      approvedAt: "",
    };
    onCreateProject(project);
    setSubmittedProjectId(project.id);
  };

  const showCreatedProject = () => {
    const projectId = submittedProjectId;
    closeEditorSheet();
    setWorkspaceTab("projects");
    if (projectId) window.setTimeout(() => setSelectedProjectId(projectId), 0);
  };

  const simulateAcceptance = (project: EditorProject) => {
    onUpdateProject(project.id, { status: "accepted" });
  };

  const submitDelivery = (project: EditorProject) => {
    if (!deliveryUrl.trim() || !isSafeProjectUrl(deliveryUrl)) {
      setProjectError("Add a complete http or https delivery link.");
      return;
    }
    if (deliveryNote.trim().length < 10) {
      setProjectError("Add a short delivery note describing the cut.");
      return;
    }
    onUpdateProject(project.id, {
      status: "delivered",
      deliveryUrl: deliveryUrl.trim(),
      deliveryNote: deliveryNote.trim(),
    });
    setProjectError("");
  };

  const requestChanges = (project: EditorProject) => {
    if (reviewNote.trim().length < 10) {
      setProjectError("Describe the changes the editor should make.");
      return;
    }
    onUpdateProject(project.id, {
      status: "changes_requested",
      revisionNote: reviewNote.trim(),
    });
    setProjectError("");
  };

  const approveProject = (project: EditorProject) => {
    const now = new Date().toISOString();
    onUpdateProject(project.id, { status: "approved", approvedAt: now });
    setProjectError("");
  };

  return (
    <div className="standard-view editor-marketplace-view">
      <section className="marketplace-hero">
        <div className="marketplace-hero-copy">
          <p className="eyebrow">Editors marketplace · local beta</p>
          <h2>Hand off the edit.<br />Keep creative control.</h2>
          <p>
            Create a project, follow the edit through delivery, request revisions, and approve the final cut.
            Your workspace is functional now; editor accounts and payouts stay disconnected.
          </p>
          <div className="marketplace-hero-actions">
            <button className="button button-primary" type="button" onClick={() => setWorkspaceTab("directory")}>
              Find an editor <ArrowRight size={16} weight="bold" />
            </button>
            <span><ShieldCheck size={17} /> Saved to {accountLabel}</span>
          </div>
        </div>

        <div className="marketplace-payment-preview" aria-label="Marketplace project workflow">
          <div className="marketplace-payment-title">
            <span><Wallet size={19} weight="fill" /></span>
            <div><small>Project workflow</small><strong>Approve first. Pay later.</strong></div>
          </div>
          <ol>
            <li><span>1</span><div><strong>Request</strong><small>Save a clear brief and budget</small></div></li>
            <li><span>2</span><div><strong>Produce</strong><small>Track assignment and delivery</small></div></li>
            <li><span>3</span><div><strong>Review</strong><small>Approve or request changes</small></div></li>
            <li className="is-locked"><span>4</span><div><strong>Pay editor</strong><small>Crypto feature flag is off</small></div></li>
          </ol>
          <div className="marketplace-payment-status"><LockKey size={17} /> USDC payouts disabled</div>
        </div>
      </section>

      <nav className="marketplace-workspace-tabs" aria-label="Editor marketplace sections">
        <button type="button" className={workspaceTab === "directory" ? "is-active" : ""} onClick={() => setWorkspaceTab("directory")}>
          <UsersThree size={18} /> Find editors
        </button>
        <button type="button" className={workspaceTab === "projects" ? "is-active" : ""} onClick={() => setWorkspaceTab("projects")}>
          <Briefcase size={18} /> My projects <span>{projects.length}</span>
        </button>
      </nav>

      {workspaceTab === "directory" ? (
        <section className="marketplace-directory" id="editor-directory">
          <div className="marketplace-directory-heading">
            <div><p className="eyebrow">Directory</p><h3>Preview editors</h3></div>
            <span>{visibleEditors.length} of {EDITORS.length} profiles</span>
          </div>

          <div className="marketplace-toolbar">
            <label className="marketplace-search">
              <span className="sr-only">Search editors</span>
              <MagnifyingGlass size={18} />
              <input type="search" placeholder="Search style, tool, or location" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <div className="marketplace-filters" aria-label="Filter editors">
              <SlidersHorizontal size={17} />
              {FILTERS.map((option) => (
                <button type="button" key={option} className={filter === option ? "is-active" : ""} onClick={() => setFilter(option)}>{option}</button>
              ))}
            </div>
          </div>

          {visibleEditors.length ? (
            <motion.div className="editor-grid" layout>
              <AnimatePresence mode="popLayout">
                {visibleEditors.map((editor, index) => (
                  <motion.article
                    layout
                    key={editor.id}
                    className={`editor-card editor-card-${editor.palette}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 180, damping: 24, delay: index * 0.035 }}
                  >
                    <div className="editor-card-visual" aria-hidden="true"><span>{editor.monogram}</span><i /><i /><i /></div>
                    <div className="editor-card-copy">
                      <div className="editor-card-heading">
                        <div><small>{editor.studio}</small><h4>{editor.name}</h4></div>
                        <span>Preview profile</span>
                      </div>
                      <p>{editor.bio}</p>
                      <div className="editor-specialties">{editor.specialties.map((specialty) => <span key={specialty}>{specialty}</span>)}</div>
                      <dl>
                        <div><dt>Rate</dt><dd>{editor.rate}</dd></div>
                        <div><dt>First cut</dt><dd>{editor.turnaround}</dd></div>
                      </dl>
                      <div className="editor-availability"><span /> {editor.availability}</div>
                      <footer>
                        <button type="button" className="button button-secondary" onClick={() => openProfile(editor)}>View profile</button>
                        <button type="button" className="button button-primary" onClick={() => openRequest(editor)}>Start project</button>
                      </footer>
                    </div>
                  </motion.article>
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <div className="marketplace-empty">
              <UsersThree size={34} /><h4>No preview editors match that search.</h4><p>Try another specialty or clear the current search.</p>
              <button type="button" className="button button-secondary" onClick={() => { setQuery(""); setFilter("All"); }}>Clear filters</button>
            </div>
          )}
        </section>
      ) : (
        <section className="marketplace-projects" aria-labelledby="marketplace-projects-title">
          <div className="marketplace-directory-heading">
            <div><p className="eyebrow">Workspace</p><h3 id="marketplace-projects-title">My edit projects</h3></div>
            <span>{projects.filter((project) => !["approved", "cancelled"].includes(project.status)).length} active</span>
          </div>
          <div className="marketplace-sandbox-note">
            <ShieldCheck size={19} />
            <div><strong>Local workflow simulator</strong><p>Projects persist in your Mini CEO workspace. Editor acceptance and delivery controls are simulations until editor accounts launch.</p></div>
          </div>
          {sortedProjects.length ? (
            <div className="marketplace-project-list">
              {sortedProjects.map((project) => {
                const status = STATUS_COPY[project.status];
                return (
                  <article className={`marketplace-project-card is-${project.status}`} key={project.id}>
                    <div className="marketplace-project-card-top">
                      <span className="marketplace-project-status">{status.label}</span>
                      <small>Updated {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(project.updatedAt))}</small>
                    </div>
                    <h4>{project.title}</h4>
                    <p>{project.editorName} · {project.editorStudio}</p>
                    <div className="marketplace-project-progress" aria-label={`Project step ${status.step} of 4`}>
                      {[1, 2, 3, 4].map((step) => <span key={step} className={status.step >= step ? "is-complete" : ""}>{step}</span>)}
                    </div>
                    <dl>
                      <div><dt>Budget</dt><dd>{project.budget}</dd></div>
                      <div><dt>First cut</dt><dd>{formatProjectDate(project.deadline)}</dd></div>
                    </dl>
                    <footer>
                      <span>{status.detail}</span>
                      <button type="button" className="button button-primary" onClick={() => openProject(project)}>
                        {project.status === "delivered" ? "Review cut" : "Open project"} <ArrowRight size={15} />
                      </button>
                    </footer>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="marketplace-empty">
              <Briefcase size={34} /><h4>No edit projects yet.</h4><p>Choose an editor and save your first project brief.</p>
              <button type="button" className="button button-primary" onClick={() => setWorkspaceTab("directory")}>Find an editor</button>
            </div>
          )}
        </section>
      )}

      <section className="marketplace-boundary">
        <div><FilmSlate size={21} /><span><strong>Built now</strong><small>Persistent projects, status tracking, delivery links, revisions, and final approval</small></span></div>
        <div><Wallet size={21} /><span><strong>Not connected</strong><small>Editor accounts, messaging, file transfer, contracts, wallets, and payouts</small></span></div>
      </section>

      <AnimatePresence>
        {selectedEditor && (
          <motion.div className="marketplace-sheet-backdrop" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.currentTarget === event.target) closeEditorSheet(); }}>
            <motion.section className="marketplace-sheet" role="dialog" aria-modal="true" aria-labelledby="marketplace-sheet-title" initial={{ opacity: 0, y: 24, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.99 }} transition={{ type: "spring", stiffness: 190, damping: 25 }}>
              <header>
                <div><small>Editors marketplace</small><strong id="marketplace-sheet-title">{sheetMode === "profile" ? selectedEditor.name : `Start a project with ${selectedEditor.name}`}</strong></div>
                <button type="button" onClick={closeEditorSheet} aria-label="Close editor marketplace panel"><X size={20} /></button>
              </header>

              {sheetMode === "profile" ? (
                <div className="editor-profile-detail">
                  <div className={`editor-profile-visual editor-card-${selectedEditor.palette}`} aria-hidden="true"><span>{selectedEditor.monogram}</span><i /><i /><i /></div>
                  <div className="editor-profile-intro">
                    <p className="eyebrow">{selectedEditor.studio} · {selectedEditor.location} · {selectedEditor.timezone}</p>
                    <h3>{selectedEditor.name}</h3><p>{selectedEditor.bio}</p>
                    <div className="editor-specialties">{selectedEditor.specialties.map((specialty) => <span key={specialty}>{specialty}</span>)}</div>
                  </div>
                  <div className="editor-profile-facts">
                    <div><ClockCountdown size={19} /><span><small>First cut</small><strong>{selectedEditor.turnaround}</strong></span></div>
                    <div><CurrencyCircleDollar size={19} /><span><small>Starting rate</small><strong>{selectedEditor.rate.replace("From ", "")}</strong></span></div>
                  </div>
                  <div className="editor-profile-section"><small>Best for</small><p>{selectedEditor.bestFor}</p></div>
                  <div className="editor-profile-section"><small>Toolkit</small><p>{selectedEditor.tools.join(" · ")}</p></div>
                  <div className="editor-profile-section"><small>Sample project</small><p>{selectedEditor.sampleTitle}</p></div>
                  <footer>
                    <span><ShieldCheck size={17} /> Profile data is illustrative; no editor is contacted.</span>
                    <button type="button" className="button button-primary" onClick={() => setSheetMode("request")}>Start a project <ArrowRight size={16} /></button>
                  </footer>
                </div>
              ) : submittedProjectId ? (
                <div className="marketplace-request-success">
                  <CheckCircle size={42} weight="fill" /><p className="eyebrow">Project saved</p><h3>Your edit workspace is ready.</h3>
                  <p><strong>{request.title}</strong> is now tracked with {selectedEditor.name}. It persists in Mini CEO, but no editor has been contacted and no payment exists.</p>
                  <dl>
                    <div><dt>Budget</dt><dd>{request.budget}</dd></div>
                    <div><dt>First cut</dt><dd>{formatProjectDate(request.deadline)}</dd></div>
                    <div><dt>Payment</dt><dd>Locked until a provider is connected</dd></div>
                  </dl>
                  <button type="button" className="button button-primary" onClick={showCreatedProject}>Open project</button>
                </div>
              ) : (
                <form className="marketplace-request-form" onSubmit={submitRequest} noValidate>
                  <div className="marketplace-request-note">
                    <ShieldCheck size={19} /><div><strong>Persistent workspace</strong><p>The brief will be saved to {accountLabel}. It does not contact {selectedEditor.name} or create a payment.</p></div>
                  </div>
                  <div className="marketplace-form-grid">
                    <label className={errors.title ? "has-error" : ""}><span>Project title</span><input value={request.title} onChange={(event) => updateRequest("title", event.target.value)} placeholder="Weekly AI news recap" />{errors.title && <small>{errors.title}</small>}</label>
                    <label><span>Deliverable</span><select value={request.format} onChange={(event) => updateRequest("format", event.target.value)}><option>Short-form vertical video</option><option>Long-form YouTube edit</option><option>Podcast cutdown package</option><option>Motion graphics explainer</option><option>Captions and accessibility pass</option></select></label>
                    <label className={errors.budget ? "has-error" : ""}><span>Budget</span><input value={request.budget} onChange={(event) => updateRequest("budget", event.target.value)} placeholder="$150-$225" />{errors.budget && <small>{errors.budget}</small>}</label>
                    <label className={errors.deadline ? "has-error" : ""}><span>First-cut deadline</span><input type="date" value={request.deadline} onChange={(event) => updateRequest("deadline", event.target.value)} />{errors.deadline && <small>{errors.deadline}</small>}</label>
                  </div>
                  <label className={`marketplace-brief-field ${errors.brief ? "has-error" : ""}`}><span>Editing brief</span><textarea rows={6} value={request.brief} onChange={(event) => updateRequest("brief", event.target.value)} placeholder="Describe the footage, target platform, pacing, references, required captions, and what a successful first cut should feel like." /><small>{errors.brief || "This becomes the source of truth for review."}</small></label>
                  <label className={`marketplace-brief-field ${errors.referenceUrl ? "has-error" : ""}`}><span>Footage or reference link <em>optional</em></span><input type="url" value={request.referenceUrl} onChange={(event) => updateRequest("referenceUrl", event.target.value)} placeholder="https://drive.google.com/..." /><small>{errors.referenceUrl || "Paste a share link for now; native uploads come later."}</small></label>
                  <div className="marketplace-approval-preview"><span><Check size={17} weight="bold" /></span><div><strong>Approval rule</strong><p>The project reaches approved only when you accept a delivered cut. Payout remains disabled after approval.</p></div></div>
                  <footer><button type="button" className="button button-secondary" onClick={() => setSheetMode("profile")}>Back to profile</button><button type="submit" className="button button-primary">Save project <ArrowRight size={16} /></button></footer>
                </form>
              )}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedProject && (
          <motion.div className="marketplace-sheet-backdrop" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.currentTarget === event.target) closeProject(); }}>
            <motion.section className="marketplace-sheet marketplace-project-sheet" role="dialog" aria-modal="true" aria-labelledby="marketplace-project-title" initial={{ opacity: 0, y: 24, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.99 }}>
              <header>
                <div><small>{STATUS_COPY[selectedProject.status].label}</small><strong id="marketplace-project-title">{selectedProject.title}</strong></div>
                <button type="button" onClick={closeProject} aria-label="Close project"><X size={20} /></button>
              </header>
              <div className="marketplace-project-detail">
                <div className="marketplace-project-party"><span>{selectedProject.editorName.split(" ").map((part) => part[0]).join("")}</span><div><small>Editor</small><strong>{selectedProject.editorName}</strong><p>{selectedProject.editorStudio}</p></div></div>
                <div className="marketplace-project-timeline">
                  {["Request", "Produce", "Review", "Approve"].map((label, index) => <div className={STATUS_COPY[selectedProject.status].step >= index + 1 ? "is-complete" : ""} key={label}><span>{index + 1}</span><small>{label}</small></div>)}
                </div>
                <dl className="marketplace-project-facts">
                  <div><dt>Deliverable</dt><dd>{selectedProject.deliverable}</dd></div><div><dt>Budget</dt><dd>{selectedProject.budget}</dd></div><div><dt>First cut</dt><dd>{formatProjectDate(selectedProject.deadline)}</dd></div>
                </dl>
                <div className="editor-profile-section"><small>Brief</small><p>{selectedProject.brief}</p></div>
                {selectedProject.referenceUrl && <a className="marketplace-project-link" href={selectedProject.referenceUrl} target="_blank" rel="noreferrer"><LinkSimple size={17} /> Open footage or reference link</a>}

                {selectedProject.status === "requested" && (
                  <div className="marketplace-project-action">
                    <div className="marketplace-sandbox-note"><ShieldCheck size={19} /><div><strong>Test the editor handoff</strong><p>This advances the local workflow only. No real editor receives or accepts the request.</p></div></div>
                    <div className="marketplace-project-action-row"><button type="button" className="button button-secondary" onClick={() => onUpdateProject(selectedProject.id, { status: "cancelled" })}>Cancel request</button><button type="button" className="button button-primary" onClick={() => simulateAcceptance(selectedProject)}>Simulate acceptance <ArrowRight size={15} /></button></div>
                  </div>
                )}

                {(selectedProject.status === "accepted" || selectedProject.status === "changes_requested") && (
                  <div className="marketplace-project-action">
                    {selectedProject.revisionNote && <div className="marketplace-review-note"><ArrowCounterClockwise size={18} /><div><small>Requested changes</small><p>{selectedProject.revisionNote}</p></div></div>}
                    <p className="eyebrow">Editor-side delivery simulator</p>
                    <label><span>Delivery link</span><input type="url" value={deliveryUrl} onChange={(event) => { setDeliveryUrl(event.target.value); setProjectError(""); }} placeholder="https://frame.io/..." /></label>
                    <label><span>Delivery note</span><textarea rows={4} value={deliveryNote} onChange={(event) => { setDeliveryNote(event.target.value); setProjectError(""); }} placeholder="What changed, what to review, and any export notes." /></label>
                    {projectError && <p className="marketplace-project-error">{projectError}</p>}
                    <button type="button" className="button button-primary" onClick={() => submitDelivery(selectedProject)}><PaperPlaneTilt size={16} /> Simulate delivery</button>
                  </div>
                )}

                {selectedProject.status === "delivered" && (
                  <div className="marketplace-project-action">
                    <div className="marketplace-delivery-ready"><CheckCircle size={24} weight="fill" /><div><small>Cut delivered</small><p>{selectedProject.deliveryNote}</p></div></div>
                    <a className="marketplace-project-link" href={selectedProject.deliveryUrl} target="_blank" rel="noreferrer"><LinkSimple size={17} /> Open delivered cut</a>
                    <label><span>Revision feedback</span><textarea rows={4} value={reviewNote} onChange={(event) => { setReviewNote(event.target.value); setProjectError(""); }} placeholder="Be precise: timestamps, pacing, captions, framing, and what should stay." /></label>
                    {projectError && <p className="marketplace-project-error">{projectError}</p>}
                    <div className="marketplace-project-action-row"><button type="button" className="button button-secondary" onClick={() => requestChanges(selectedProject)}><ArrowCounterClockwise size={16} /> Request changes</button><button type="button" className="button button-primary" onClick={() => approveProject(selectedProject)}><Check size={16} weight="bold" /> Approve final cut</button></div>
                  </div>
                )}

                {selectedProject.status === "approved" && (
                  <div className="marketplace-project-action marketplace-approved-panel">
                    <CheckCircle size={35} weight="fill" /><div><p className="eyebrow">Final approved</p><h3>Creative work is complete.</h3><p>The project is approved and saved. No money moved.</p></div>
                    <button type="button" className="button button-primary" disabled><LockKey size={16} /> USDC payout disabled</button>
                    <small>Crypto payouts are off in <code>MARKETPLACE_FEATURES</code> and there is no connected wallet or payment provider.</small>
                  </div>
                )}

                {selectedProject.status === "cancelled" && <div className="marketplace-project-action marketplace-closed-panel"><X size={30} /><div><h3>Request closed</h3><p>This project remains in your workspace history, but it cannot advance.</p></div></div>}
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
