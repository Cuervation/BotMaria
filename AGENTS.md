# movistar-arena-watchdog

## Purpose

This project watches a Movistar Arena page with Playwright and alerts when a target date appears.

## Agent roles

- **MonitorAgent**: opens the configured page, navigates it, and captures a deterministic snapshot.
- **DateDetectorAgent**: inspects the snapshot and detects dates that match `TARGET_DAY_REGEX`.
- **SpeakerAgent**: best-effort configures the audio output and system volume on Windows.
- **AlarmAgent**: opens the YouTube alarm video in a visible browser tab.
- **index.ts**: coordinates the loop, cooldown, state persistence, and shutdown.

## Safety constraints

- No ticket purchases.
- No purchase clicks.
- No virtual queue bypass.
- No captcha bypass.
- No login automation.
- Monitoring only, with local visible browser execution on Windows.
- No LLM in runtime. The agents are deterministic code.

