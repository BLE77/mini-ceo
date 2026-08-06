# Mini CEO Product Requirements Document

**Status:** MVP implementation specification  
**Product:** Mini CEO  
**Tagline:** Your boss in your pocket  
**Primary surface:** Mobile-first installable web app for iPhone  
**Initial audience:** Independent content creators publishing short-form video

## 1. Product vision

Mini CEO is an active, character-led productivity assistant that helps independent creators publish consistently. It turns a creator's goals, ideas, reference content, and weekly availability into a realistic production schedule, then stays involved until the work is published.

The product should not feel like a passive project-management dashboard. It should feel like an opinionated miniature boss living in the creator's pocket: visible, direct, useful, funny, and aware of the creator's current assignment.

The initial platform is an installable progressive web app (PWA) designed for iPhone and usable on other modern mobile and desktop browsers. Creators can add it to their iPhone Home Screen without downloading an App Store binary.

## 2. Problem

Independent creators often know what they want to make but fail to publish consistently because the work is fragmented across inspiration, research, writing, production, editing, and posting. Ideas are lost, large tasks feel vague, and generic to-do apps do not understand creator workflows.

Mini CEO addresses three connected problems:

- Staying consistent enough to reach a weekly publishing goal.
- Organizing ideas and moving each idea through a complete production pipeline.
- Overcoming procrastination while improving content quality through reusable creative skills.

## 3. Target users

The MVP serves creators at any experience level, while being structured enough for full-time professionals.

Priority platforms:

- TikTok
- Instagram Reels
- Facebook video and Reels
- YouTube Shorts
- X as an optional publishing destination for video or supporting posts

Mini CEO should recommend repurposing eligible video across TikTok, Instagram, Facebook, and YouTube Shorts. It should not default to assigning standalone tweets.

## 4. Product principles

1. **The character is the product.** The Mini CEO dominates the main screen, speaks directly to the creator, and presents the next meaningful assignment.
2. **Publishing matters most.** Research, scripts, and production steps are valuable only when they help a creator publish.
3. **One clear next action.** The app reduces a complex workflow to a concrete task that can be completed, skipped, replaced, or rescheduled.
4. **Pressure is chosen, not imposed.** The creator selects a boss mode that controls tone and reminder intensity.
5. **Assistance is actionable.** The boss generates hooks, scripts, bullet points, research plans, prop lists, and next steps—not generic encouragement.
6. **Inspiration becomes a skill.** References are analyzed into reusable patterns such as hooks, pacing, tone, visual format, and length, not copied word-for-word.
7. **Creator control is preserved.** Users approve ideas, adjust schedules, choose final wording, and can always skip or reprioritize work.

## 5. Core experience

### 5.1 Onboarding

The onboarding begins with: **“You're hired. Meet the boss.”**

The creator completes these steps:

1. Choose a boss mode.
2. Select platforms to grow on.
3. Set a weekly publishing target, such as two or five videos per week.
4. Define a clear creator or page goal that the boss can reference when judging ideas.
5. Select topics, niches, and preferred content styles.
6. Add existing examples, creator references, links, or files when available.
7. Set available workdays and optional batching preferences.
8. Review ideas generated from the profile and approve the ideas they want to make.
9. Review the proposed work schedule, move assignments if needed, and approve it.

Onboarding must result in an immediately usable schedule and a specific first assignment.

### 5.2 Boss modes

The MVP provides one iconic character with three behavioral modes:

| Mode | Language | Reminder behavior |
| --- | --- | --- |
| Supportive Coach | Warm, encouraging, patient, and clear | Light reminders with gentle follow-up |
| Serious Boss | Direct, professional, deadline-focused | More frequent reminders and firm missed-deadline follow-up |
| Unhinged CEO | Comedic, intense, dramatic, and playfully confrontational | Strongest allowed reminder cadence and theatrical reactions |

Boss mode changes both language and notification frequency. The Mini CEO stays on topic: creator goals, assignments, creative quality, deadlines, and publishing.

### 5.3 Character-first home screen

The Today screen is the primary surface. The Mini CEO character is visually dominant and should:

- Greet the creator using the selected boss mode.
- React to streaks, completed work, missed deadlines, and skipped assignments.
- Present today's highest-priority assignment.
- Explain why the assignment matters to the creator's stated goal.
- Offer a small number of decisive actions: start, ask for help, mark done, upload proof, skip, replace, or reschedule.
- Speak responses aloud when voice is enabled.

The calendar, Idea Vault, Content Skills, and performance analytics remain important but are secondary screens accessible from navigation.

## 6. Creator production workflow

Every approved content idea can move through this pipeline:

1. **Idea:** Capture an original idea, a promising topic, a viral pattern, or a reference video.
2. **Approval:** The creator chooses which ideas become real assignments.
3. **Research:** Gather facts, examples, angles, and source material.
4. **Writing:** Create a full script or natural bullet points according to the creator's style.
5. **Production planning:** Identify props, locations, shots, assets, people, and a shoot date.
6. **Shoot:** Record the content. The creator can upload the result or mark “Video shot.”
7. **Edit:** Assign a realistic editing deadline after shooting.
8. **Publish:** Post to the selected platform or platforms and optionally submit a public link.

The creator may rearrange stages when urgency requires it. Mini CEO should favor forward movement and posting over rigid completion of every prerequisite.

### 6.1 Batching

Creators can batch one or more types of work:

- Idea discovery and approval
- Research
- Script or bullet-point writing
- Shooting
- Editing
- Publishing and repurposing

The schedule generator must respect selected batch days and also support creators who prefer to complete the entire pipeline in one day.

### 6.2 Idea Vault

The Idea Vault stores creator-submitted and boss-generated ideas. Each idea includes:

- Working title
- Topic and intended platform
- Angle or core promise
- Proposed hook
- Source or reference, when applicable
- Relationship to the creator's stated goal
- Status: proposed, approved, scheduled, in production, published, or archived

Mini CEO generates ideas, but the creator must approve an idea before it becomes scheduled work.

### 6.3 Content Skills

References should create reusable Content Skills. A skill can summarize:

- Hook structure
- Pacing
- Tone and delivery
- Visual format
- Typical length
- Editing rhythm
- Call-to-action pattern
- Elements to adapt and elements to avoid

The skill library grows as creators add examples. Assistance should apply these patterns in the creator's voice and goals. The product must not claim ownership of reference content or encourage exact plagiarism.

## 7. Assistant and voice

Mini CEO includes an in-product assistant available from the Today screen and relevant workflow stages.

The assistant should be able to:

- Suggest ideas based on goals, topics, platforms, and Content Skills.
- Generate or improve hooks.
- Turn an idea into a research checklist.
- Draft a script or conversational bullet points.
- Create a production plan, prop list, and shot list.
- Recommend the most useful next assignment.
- Help unblock a missed or intimidating task by reducing its scope.
- Keep its tone consistent with the selected boss mode.

Voice behavior for the MVP:

- Use supported browser speech recognition for creator input.
- Use supported browser speech synthesis for Mini CEO output.
- Always provide text input and text output as a fallback.
- Require a clear user action before listening.
- Allow the creator to stop speech and disable voice.

### 7.1 AI provider adapter

The assistant must work in a zero-configuration local mode for demos and development. It should also expose a provider adapter so a hosted agent can replace or augment the local response engine.

Hermes is an optional provider, not a hard dependency. When configured, the backend sends the user's message, current task, profile, boss mode, and relevant creator context to a Hermes-compatible endpoint. Provider keys remain server-side. If the provider is unavailable, the app falls back gracefully to local contextual assistance.

The provider boundary should be generic enough to support other models or agent services later without redesigning the client.

## 8. Tasks, proof, and scheduling

Each assignment includes:

- Content idea and production stage
- Clear completion definition
- Due date and expected duration
- Related platform and Content Skills
- Status and completion time
- Optional proof file or public link

Available creator actions:

- Mark done
- Upload a file as proof
- Submit a public post link
- Mark “Video shot” to advance the pipeline
- Skip with an optional reason
- Replace with another approved assignment
- Reschedule or move earlier

Proof is encouraged but not mandatory for every stage. For the MVP, private file proof remains on the user's device unless the user explicitly submits it to a configured backend.

## 9. Notifications and escalation

With permission, notifications can include:

- Morning assignment
- Reminder before a deadline
- Follow-up after a missed deadline
- Evening accountability message
- Continued follow-up the next day

Escalation depends on boss mode, task urgency, previous reminders, and the creator's response. Notifications stop for a completed, skipped, replaced, or rescheduled task.

Requirements:

- Ask for notification permission in context, not on first page load.
- Support quiet hours.
- Avoid multiple notifications for the same state change.
- Provide a visible way to disable notifications.
- Do not use false emergencies, deceptive countdowns, or shame unrelated to the creator's chosen work.

## 10. Gamification and accountability

Gamification should reinforce consistent publishing rather than empty app engagement.

MVP systems:

- Creator streaks
- Weekly consistency score
- Performance grade
- Achievements tied to meaningful milestones
- Boss approval and character reactions
- Weekly performance review

The weekly review summarizes planned versus published work, completed stages, missed or moved assignments, current streak, earned achievements, and a focused recommendation for the next week.

Scoring must prioritize published content, followed by meaningful pipeline progress. Opening the app or dismissing reminders should not inflate the score.

## 11. Navigation and information architecture

Primary mobile navigation:

- **Today:** Character, current assignment, voice, and decisive actions
- **Ideas:** Idea Vault, proposed ideas, approval, and capture
- **Plan:** Calendar, batching, due dates, and rearrangement
- **Skills:** Reference examples and reusable content patterns
- **Review:** Streaks, score, grade, achievements, and weekly performance review

Settings can live within Review for the MVP and include boss mode, voice, notifications, quiet hours, weekly target, platforms, and creator profile.

## 12. MVP scope

The hackathon-ready MVP includes:

- Mobile-first responsive interface
- Installable iPhone PWA with manifest, icons, and service worker
- One iconic Mini CEO character
- Three boss modes
- Complete onboarding and schedule approval
- Character-led Today screen
- Idea generation, manual idea capture, and approval
- Full creator workflow from idea through publish
- Batching preferences and schedule rearrangement
- Content Skills derived from creator references
- Contextual text assistant
- Browser voice input and spoken output where supported
- Optional Hermes-compatible provider adapter with local fallback
- Task completion, skip, replace, reschedule, file proof, and link proof
- Creator streak, weekly score, performance grade, achievements, boss reactions, and weekly review
- Local persistence for profile, plans, progress, and private files
- Notification permission flow and reminder-ready PWA behavior

## 13. Future scope

The following are intentionally post-MVP:

- Secure accounts and cross-device synchronization
- Hosted storage for scripts, reference files, and proof
- Direct social platform publishing
- Automatic post verification through platform APIs
- Imported post analytics and performance trends
- Idea recommendations informed by live trend data
- Automated video analysis of hooks, pacing, tone, visuals, and length
- Team workspaces, approvals, and role permissions
- Multiple character designs or custom boss personas
- Native iOS and Android applications
- Advanced notification scheduling through push infrastructure
- Subscription billing

## 14. Safety, trust, and privacy

The character may be forceful or comedic, but its pressure is limited to the creator's opted-in work.

The Mini CEO must never insult or target:

- Protected traits
- Appearance or body
- Disability or medical conditions
- Mental health
- Trauma
- Family or relationships
- Financial hardship
- Other sensitive personal circumstances

Unhinged CEO may roast procrastination, missed creator deadlines, or the work itself in a playful way. It may not bully the person. Users can change boss mode, disable voice, disable notifications, skip work, or reset their plan at any time.

Reference content and uploaded files must be treated as private. Provider calls send only the context needed for the requested assistance, and API keys must never ship to the browser.

## 15. Accessibility and quality requirements

- Primary controls must be usable by touch and keyboard.
- Interactive elements need visible focus states and accessible labels.
- Text and essential controls must meet WCAG AA contrast targets.
- The interface must respect reduced-motion preferences.
- Character animation cannot block task completion or navigation.
- Voice features require equivalent text controls.
- The app should remain usable if notifications, speech recognition, speech synthesis, or the external AI provider are unavailable.
- Core state changes must persist across refreshes on the same device.

## 16. Success metrics

MVP product metrics:

- Onboarding completion rate
- Percentage of onboarded users who approve at least one idea
- Percentage who complete their first assignment within 24 hours
- Weekly publishing goal completion rate
- Number of published videos per active creator per week
- Week-one and week-four creator retention
- Percentage of active users who return for the weekly review
- Task reschedule/skip rate and subsequent completion rate
- Assistant requests that lead to task progress
- Notification opt-in rate and completion following a reminder

Primary outcome metric: **the percentage of active creators who meet their chosen weekly publishing goal.**

## 17. MVP acceptance criteria

The MVP is acceptable when all of the following are true:

### Onboarding and planning

- A new creator can choose a boss mode, platforms, goal, output cadence, topics, references, availability, and batching preferences.
- The app proposes ideas and requires explicit creator approval before scheduling them.
- The creator can review and rearrange a generated weekly schedule.
- Finishing onboarding leads directly to a specific assignment on Today.

### Character and assistance

- The Mini CEO character is the dominant visual element on Today.
- Copy and reactions change across Supportive Coach, Serious Boss, and Unhinged CEO modes.
- The creator can request an idea, hook, script or bullet points, research checklist, production plan, or next action.
- Text assistance works without external credentials.
- Voice input/output works in supported browsers and fails gracefully to text.
- A configured Hermes-compatible endpoint can respond through the server adapter without exposing its key to the client.

### Workflow and accountability

- An approved idea can progress through research, writing, production planning, shoot, edit, and publish.
- The creator can mark work done, upload proof, add a post link, skip, replace, or reschedule an assignment.
- The creator can batch work and move scheduled tasks earlier or later.
- Completed and published work updates the streak, score, grade, achievements, boss response, and weekly review.

### PWA, persistence, and resilience

- The app is responsive at iPhone viewport sizes and can be added to the iPhone Home Screen.
- The manifest, icons, service worker, and standalone display behavior are present.
- Profile, ideas, plan, progress, and preferences survive a refresh on the same device.
- Private proof/reference files remain device-local in the MVP.
- Missing notification, speech, or AI-provider support does not prevent core task management.
- The production build, type checks, tests, linting, and dependency security audit pass.

## 18. Definition of done

The MVP is done when it delivers a coherent loop—not just disconnected screens:

**Meet the boss → define the goal → approve ideas → approve a schedule → receive one clear assignment → get contextual help → complete or rearrange the work → publish → receive a character reaction and updated performance review → begin the next assignment.**
