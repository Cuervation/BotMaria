import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

function parseBoolean(value: unknown): unknown {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'n', 'off', ''].includes(normalized)) {
    if (normalized === '') {
      return undefined;
    }

    return false;
  }

  return value;
}

const EnvSchema = z.object({
  MONITOR_URL: z.string().trim().min(1, 'MONITOR_URL is required'),
  TARGET_ARTIST: z.string().trim().min(1).default('María Becerra'),
  TARGET_DAY_REGEX: z.string().trim().min(1).default('^2\\d$'),
  CHECK_INTERVAL_MS: z.coerce.number().int().min(30_000, 'CHECK_INTERVAL_MS must be at least 30000').default(30_000),
  ALARM_YOUTUBE_URL: z.string().trim().url().default('https://www.youtube.com/watch?v=Terd4qKkb6k'),
  PLAYWRIGHT_USER_DATA_DIR: z.string().trim().min(1).default('.playwright-profile'),
  FORCE_SPEAKERS: z.preprocess(parseBoolean, z.boolean()).default(true),
  SPEAKER_DEVICE_NAME: z.string().trim().min(1).default('Altavoces'),
  FORCE_SYSTEM_VOLUME: z.preprocess(parseBoolean, z.boolean()).default(true),
  SPEAKER_SCRIPT_PATH: z.string().trim().min(1).default('scripts/set-speakers.ps1'),
  ALARM_COOLDOWN_MINUTES: z.coerce.number().int().positive().default(60),
  STATE_DIR: z.string().trim().min(1).default('state'),
});

export interface AppConfig {
  monitorUrl: string;
  targetArtist: string;
  targetDayRegex: RegExp;
  checkIntervalMs: number;
  alarmYoutubeUrl: string;
  playwrightUserDataDir: string;
  forceSpeakers: boolean;
  speakerDeviceName: string;
  forceSystemVolume: boolean;
  speakerScriptPath: string;
  alarmCooldownMinutes: number;
  stateDir: string;
}

export function loadConfig(): AppConfig {
  const parsed = EnvSchema.parse(process.env);

  let targetDayRegex: RegExp;
  try {
    targetDayRegex = new RegExp(parsed.TARGET_DAY_REGEX);
  } catch (error) {
    throw new Error(`Invalid TARGET_DAY_REGEX: ${parsed.TARGET_DAY_REGEX}`);
  }

  return {
    monitorUrl: parsed.MONITOR_URL,
    targetArtist: parsed.TARGET_ARTIST,
    targetDayRegex,
    checkIntervalMs: parsed.CHECK_INTERVAL_MS,
    alarmYoutubeUrl: parsed.ALARM_YOUTUBE_URL,
    playwrightUserDataDir: parsed.PLAYWRIGHT_USER_DATA_DIR,
    forceSpeakers: parsed.FORCE_SPEAKERS,
    speakerDeviceName: parsed.SPEAKER_DEVICE_NAME,
    forceSystemVolume: parsed.FORCE_SYSTEM_VOLUME,
    speakerScriptPath: parsed.SPEAKER_SCRIPT_PATH,
    alarmCooldownMinutes: parsed.ALARM_COOLDOWN_MINUTES,
    stateDir: parsed.STATE_DIR,
  };
}
