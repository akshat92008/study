# MODULE UPGRADE: PULSE — Mental State Engine

## Current State: 50% → Target: 90%

## What Works Today
- 4-state friction model (focused/neutral/frustrated/overwhelmed)
- Multi-signal detection (accuracy drops, session abandonment, delayed tasks, repeated mistakes)
- Adaptive config (task caps, intensity, explanation depth, workload multiplier)
- PulseCheckIn self-report UI

## Upgrades Needed

### 1. Response-Time Signal from Revision Cards (P2, 3-4 hrs)
- Add `response_time_ms` to `reviewLogs` schema
- Track time-to-answer per card in `reviewCard()`
- Add response-time degradation as a PULSE friction signal

### 2. PULSE Weekly Dashboard (P1, 6-8 hrs)
- Create `components/pulse/PulseDashboard.tsx`
- Friction score timeline (line chart, 2 weeks)
- State distribution pie chart
- Session duration + accuracy trend overlay
- Current state animated badge

### 3. Tutor Interaction Signals (P3, 3-4 hrs)
- Log message length and response latency from tutor sessions
- Short/frustrated messages increase friction score
- Store as `tutor_interaction` signal type in `pulse_signals`

### 4. Recovery Mode UI (P2, 4-5 hrs)
- Apply `recovery-mode` CSS class to dashboard layout when overwhelmed
- Shift accent colors to calmer cyan tones
- Show recovery message in daily briefing
- Reduce visual intensity across all modules

## Total Estimated Effort: 16-21 hours
