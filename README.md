# Mini CEO

Mini CEO is a mobile-first creator operating system: an active character turns a creator goal, references, and ideas into a weekly production schedule, then follows up until the content is published.

## MVP capabilities

- Character-first onboarding and three bossiness modes
- Creator goals, platforms, weekly output targets, availability, and batching
- Goal-aware idea generation and explicit idea approval
- Research, script, production, shoot, edit, and publish pipeline
- Reorderable weekly production schedule
- Completion by status, private file upload, or published link
- Content Skills learned from hooks, pacing, tone, format, and length
- Voice output and supported-browser voice input
- Creator streak, consistency score, boss approval, achievements, and weekly review
- Installable PWA shell with offline caching and notification permission flow
- Assistant API with a zero-config local engine and optional Hermes-compatible provider

## Run locally

```bash
npm install
npm run dev
```

The development server prints the local URL. Creator data is stored on the current device; uploaded files are saved privately in IndexedDB.

## Verify

```bash
npm test
npm run lint
```

## Optional Hermes provider

Copy `.env.example` to `.env.local` and set:

```bash
HERMES_API_URL=https://your-hermes-endpoint.example/chat
HERMES_API_KEY=
```

The endpoint receives `{ agent, message, context, system }` and should return `{ reply }`, `{ message }`, or `{ content }`. Without this configuration, the built-in assistant still provides hooks, scripts, research plans, shot lists, and next-step guidance.

## Privacy model

The hackathon build does not require an account. Profile data and the creator workflow persist in local browser storage, while uploaded drafts and references persist in IndexedDB on the current device. Platform analytics, cross-device sync, and social account integrations remain future work.
