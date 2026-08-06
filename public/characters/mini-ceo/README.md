# Mini CEO character assets

This set contains transparent, text-free PNGs generated from the approved Mini CEO character reference. Each individual asset uses a square 512 by 512 canvas so the files can be swapped without layout jumps.

## Expression assets

Use the waist-up expressions for assistant messages, compact cards, reactions, notification artwork, and status feedback:

- `focused`: active assignment or serious boss state
- `approving`: accepted idea, steady progress, or supportive feedback
- `thinking`: idea generation, research, or an assistant waiting state
- `celebrating`: completion, publishing, streak, or achievement
- `concerned`: blocked task, risky schedule, or proof needed
- `disappointed`: missed work or skipped commitment
- `impatient`: deadline reminder or escalation
- `surprised`: urgent update, alert, or animated speaking fallback

## Action assets

Use the full-body actions for the Today hero, onboarding, large empty states, and workflow milestones:

- `welcome`: “You’re hired” onboarding
- `assignment`: today’s next action
- `working`: assistant or in-progress work
- `reminder`: due-soon and notification moments
- `complete`: completed or published work
- `missed-deadline`: overdue follow-up

Import the typed paths from `app/lib/boss-assets.ts`. The atlas files are included for animation tooling or sprite-based rendering; individual files are recommended for normal React image rendering.

Example:

```tsx
import Image from "next/image";
import { BOSS_EXPRESSION_ASSETS } from "@/app/lib/boss-assets";

<Image
  src={BOSS_EXPRESSION_ASSETS.focused}
  alt="Mini CEO focused on the current assignment"
  width={256}
  height={256}
  priority
/>
```

Keep `object-fit: contain` when placing these images in differently sized cards. The emotion is intentionally led by eyes, gaze, eyelids, and eyebrows so it remains readable at small sizes.
