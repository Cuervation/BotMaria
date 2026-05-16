import path from "node:path";
import type { BrowserContext, Page } from "playwright";
import type { AppConfig } from "../config.js";
import type { DateDetectionResult } from "./dateDetectorAgent.js";
import { SpeakerAgent } from "./speakerAgent.js";
import { log, warn } from "../utils/logger.js";
import { readJsonFile, writeJsonFile } from "../utils/fsState.js";
import { sleep } from "../utils/sleep.js";

type AlarmState = {
  firedAt: string;
  reason: string;
  matchedDate: {
    day: string;
    month: string | null;
    time: string | null;
    rawText: string;
  };
};

function withAutoplay(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set("autoplay", "1");
  return parsed.toString();
}

export class AlarmAgent {
  private readonly speakerAgent: SpeakerAgent;
  private readonly stateFile: string;

  constructor(private readonly context: BrowserContext, private readonly appConfig: AppConfig) {
    this.speakerAgent = new SpeakerAgent(appConfig);
    this.stateFile = path.join(appConfig.stateDir, "alarm-fired.json");
  }

  async fire(match: Extract<DateDetectionResult, { found: true }>): Promise<void> {
    const recentState = await this.getRecentAlarmState();

    if (recentState) {
      log("Alarm already fired recently, skipping duplicate alarm.", recentState);
      return;
    }

    log(`Alarm fired because date matched: ${match.rawText}`);

    await this.speakerAgent.forceSpeakersIfEnabled();

    const page = await this.context.newPage();
    await page.bringToFront();

    const alarmUrl = withAutoplay(this.appConfig.alarmYoutubeUrl);
    await page.goto(alarmUrl, { waitUntil: "domcontentloaded", timeout: 45000 });

    log("YouTube alarm opened.");

    await this.handleCommonDialogs(page);
    await this.tryStartVideo(page);

    const state: AlarmState = {
      firedAt: new Date().toISOString(),
      reason: match.reason,
      matchedDate: {
        day: match.day,
        month: match.month,
        time: match.time,
        rawText: match.rawText,
      },
    };

    await writeJsonFile(this.stateFile, state);
  }

  private async getRecentAlarmState(): Promise<AlarmState | null> {
    const state = await readJsonFile<AlarmState>(this.stateFile);
    if (!state) return null;

    const firedAtMs = new Date(state.firedAt).getTime();
    if (Number.isNaN(firedAtMs)) return null;

    const elapsedMinutes = (Date.now() - firedAtMs) / 60000;
    if (elapsedMinutes <= this.appConfig.alarmCooldownMinutes) {
      return state;
    }

    return null;
  }

  private async handleCommonDialogs(page: Page): Promise<void> {
    const labels = [
      /Aceptar todo/i,
      /Acepto/i,
      /Aceptar/i,
      /I agree/i,
      /Accept all/i,
      /No thanks/i,
      /Ahora no/i,
      /Omitir/i,
    ];

    for (const label of labels) {
      const button = page.getByRole("button", { name: label }).first();
      const visible = await button.isVisible({ timeout: 1200 }).catch(() => false);
      if (!visible) continue;

      await button.click({ timeout: 3000 }).catch(() => undefined);
      await sleep(700);
    }
  }

  private async tryStartVideo(page: Page): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      log(`Intento de reproducción de YouTube ${attempt}/3`);

      await page.evaluate(async () => {
        const video = document.querySelector("video") as HTMLVideoElement | null;
        if (!video) return;

        video.muted = false;
        video.volume = 1;

        try {
          await video.play();
        } catch {
          // Se reintenta con interacción desde Node.
        }
      });

      log("Video unmuted");
      log("Video volume set to 100%");
      log("Video play attempted");

      const isPlaying = await page.evaluate(() => {
        const video = document.querySelector("video") as HTMLVideoElement | null;
        return Boolean(video && !video.paused && video.currentTime >= 0);
      }).catch(() => false);

      if (isPlaying) return;

      await page.getByRole("button", { name: /Play|Reproducir/i }).first().click({ timeout: 3000 }).catch(() => undefined);
      await page.keyboard.press("Space").catch(() => undefined);
      await sleep(1500);
    }

    warn("No pude confirmar reproducción automática. La pestaña de YouTube quedó abierta.");
  }
}
