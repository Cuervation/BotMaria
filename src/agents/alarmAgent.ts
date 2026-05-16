import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { BrowserContext, Page } from 'playwright';
import { Logger } from '../utils/logger';
import { SpeakerAgent } from './speakerAgent';

export interface MatchedDate {
  day: string;
  month: string;
  time: string;
  rawText: string;
}

export interface AlarmState {
  firedAt: string;
  reason: string;
  matchedDate: MatchedDate;
}

export interface AlarmFireResult {
  fired: boolean;
  skipped: boolean;
  reason: string;
}

export class AlarmAgent {
  constructor(
    private readonly context: BrowserContext,
    private readonly alarmUrl: string,
    private readonly speakerAgent: SpeakerAgent,
    private readonly stateDir: string,
    private readonly cooldownMinutes: number,
    private readonly logger: Logger,
  ) {}

  async fire(reason: string, matchedDate: MatchedDate): Promise<AlarmFireResult> {
    const currentState = await this.readState();
    if (this.isInCooldown(currentState)) {
      this.logger.info('Alarm already fired recently, skipping duplicate alarm.');
      return { fired: false, skipped: true, reason: 'cooldown_active' };
    }

    this.logger.info('Intentando configurar parlantes...');
    const speakersReady = await this.speakerAgent.forceSpeakersIfEnabled();
    if (!speakersReady) {
      this.logger.warn('No se pudo forzar salida por parlantes. Windows puede seguir usando auriculares si son la salida predeterminada.');
    }

    const page = await this.context.newPage();
    try {
      await page.goto(this.alarmUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.bringToFront().catch(() => undefined);
      this.logger.info('YouTube alarm opened', { url: this.alarmUrl });

      await this.waitForYouTubeReady(page);
      await this.writeState({
        firedAt: new Date().toISOString(),
        reason,
        matchedDate,
      });
      await this.dismissCommonDialogs(page);
      await this.maximizeYouTubePlayerVolume(page);
      await this.tryAutoplayWithRetries(page);

      this.logger.warn(`Alarm fired because date matched: ${matchedDate.day} ${matchedDate.month} ${matchedDate.time}`, {
        reason,
        matchedDate,
      });

      return { fired: true, skipped: false, reason: 'alarm_fired' };
    } catch (error) {
      this.logger.warn('No se pudo reproducir la alarma en YouTube.', { error: String(error) });
      return { fired: false, skipped: false, reason: 'alarm_failed' };
    }
  }

  private async waitForYouTubeReady(page: Page): Promise<void> {
    await page.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => undefined);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    await page.waitForSelector('video', { timeout: 20_000 }).catch(() => undefined);
  }

  private async dismissCommonDialogs(page: Page): Promise<void> {
    const buttonNames = [
      /Aceptar todo/i,
      /Acepto/i,
      /Acept[ao]r/i,
      /Aceptar/i,
      /Estoy de acuerdo/i,
      /I agree/i,
      /Accept all/i,
      /Accept/i,
      /Got it/i,
      /Entendido/i,
      /Cerrar/i,
      /Close/i,
      /No gracias/i,
      /Reject all/i,
    ];

    for (const name of buttonNames) {
      const button = page.getByRole('button', { name });
      if (await button.count().catch(() => 0)) {
        await button.first().click({ timeout: 2_500 }).catch(() => undefined);
      }
    }
  }

  private async maximizeYouTubePlayerVolume(page: Page): Promise<void> {
    const adjusted = await page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement | null;
      if (video) {
        video.muted = false;
        video.volume = 1;
        void video.play().catch(() => undefined);
        return true;
      }

      return false;
    });

    if (adjusted) {
      this.logger.info('Video unmuted');
      this.logger.info('Video volume set to 100%');
    }
  }

  private async tryAutoplayWithRetries(page: Page): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      this.logger.info('Video play attempted', { attempt });

      const played = await page.evaluate(async () => {
        const video = document.querySelector('video') as HTMLVideoElement | null;
        if (!video) {
          return false;
        }

        video.muted = false;
        video.volume = 1;

        try {
          await video.play();
          return true;
        } catch {
          return false;
        }
      });

      if (played) {
        return;
      }

      await this.tryFallbackPlaybackControls(page);
    }
  }

  private async tryFallbackPlaybackControls(page: Page): Promise<void> {
    const playButtons = [
      page.getByRole('button', { name: /Play|Reproducir|Play video|Play\/pause/i }),
      page.locator('button[aria-label*="Play" i]'),
      page.locator('button[aria-label*="Reproducir" i]'),
      page.locator('.ytp-play-button'),
    ];

    for (const locator of playButtons) {
      const count = await locator.count().catch(() => 0);
      if (count > 0) {
        await locator.first().click({ timeout: 2_500 }).catch(() => undefined);
        break;
      }
    }

    await page.keyboard.press('Space').catch(() => undefined);
    await page.evaluate(async () => {
      const video = document.querySelector('video') as HTMLVideoElement | null;
      if (!video) {
        return;
      }

      video.muted = false;
      video.volume = 1;
      await video.play().catch(() => undefined);
    });
  }

  private async readState(): Promise<AlarmState | null> {
    const stateFilePath = this.getStateFilePath();
    if (!existsSync(stateFilePath)) {
      return null;
    }

    try {
      const raw = await readFile(stateFilePath, 'utf8');
      return JSON.parse(raw) as AlarmState;
    } catch {
      return null;
    }
  }

  private async writeState(state: AlarmState): Promise<void> {
    const stateDirPath = path.resolve(process.cwd(), this.stateDir);
    await mkdir(stateDirPath, { recursive: true });
    await writeFile(this.getStateFilePath(), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }

  private getStateFilePath(): string {
    return path.join(path.resolve(process.cwd(), this.stateDir), 'alarm-fired.json');
  }

  private isInCooldown(state: AlarmState | null): boolean {
    if (!state?.firedAt) {
      return false;
    }

    const firedAt = new Date(state.firedAt).getTime();
    if (Number.isNaN(firedAt)) {
      return false;
    }

    return Date.now() - firedAt < this.cooldownMinutes * 60_000;
  }
}
