# Mini CEO

Mini CEO is a mobile-first creator operating system: an active character turns a creator goal, references, and ideas into a weekly production schedule, then follows up until the content is published.

## Hackathon build

- Character-first onboarding and three bossiness modes
- Creator goals, platforms, weekly output targets, availability, and batching
- Live OpenRouter idea generation with visible provenance and research requirements
- Research, script, production, shoot, edit, and publish pipeline
- Reorderable weekly production schedule
- Completion by status, private file upload, or published link
- Private reference storage without pretending unprocessed files were analyzed
- ElevenLabs character voice with supported-browser voice input
- Creator streak, consistency score, boss approval, achievements, and weekly review
- Installable PWA shell with offline caching and real Web Push subscription routes
- Authenticated cloud workspace syncing on the hosted build
- Live OpenRouter assistant with no canned response fallback

## Run locally

```bash
npm install
npm run dev
```

The development server prints the local URL. Without hosted credentials, AI and voice routes fail visibly instead of returning simulated results. Uploaded files are saved privately in IndexedDB and are not automatically analyzed.

## Verify

```bash
npm test
npm run lint
```

## Hosted services

Runtime credentials stay server-side. The production build currently uses:

- OpenRouter for the boss assistant and original idea generation
- ElevenLabs for the consistent character voice
- authenticated D1 storage for workspace syncing
- VAPID Web Push for installed PWA notifications

Never commit provider keys. Configure them in the hosting platform's protected environment settings.

## Privacy model

The browser keeps a local copy of the creator workspace. On the authenticated hosted build, structured workspace data also syncs to the user's private cloud record. Uploaded drafts and references stay in IndexedDB on that device. Mini CEO does not claim to watch or understand a file until a real analysis service processes it. Social publishing and platform analytics are not connected yet.
