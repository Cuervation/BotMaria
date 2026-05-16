import "dotenv/config";
import path from "node:path";
import { z } from "zod";

function boolFromEnv(defaultValue: boolean) {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return defaultValue;
    if (typeof value === "boolean") return value;
    return String(value).toLowerCase() === "true";
  }, z.boolean());
}

function intFromEnv(defaultValue: number) {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return defaultValue;
    return Number(value);
  }, z.number().int());
}

const envSchema = z.object({
  MONITOR_URL: z.string().default(""),
  TARGET_ARTIST: z.string().default("María Becerra"),
  TARGET_DAY_REGEX: z.string().default("^2\\d$"),
  CHECK_INTERVAL_MS: intFromEnv(30000).refine((value) => value >= 30000, {
    message: "CHECK_INTERVAL_MS no puede ser menor a 30000 para no spamear el sitio.",
  }),

  ALARM_YOUTUBE_URL: z.string().url().default("https://www.youtube.com/watch?v=Terd4qKkb6k"),
  ALARM_COOLDOWN_MINUTES: intFromEnv(60).refine((value) => value >= 1),

  PLAYWRIGHT_USER_DATA_DIR: z.string().default(".playwright-profile"),
  STATE_DIR: z.string().default("state"),

  LOGIN_ENABLED: boolFromEnv(true),
  LOGIN_START_TEXT: z.string().default("Iniciar sesión"),
  LOGIN_SUBMIT_TEXT: z.string().default("Ingresar"),
  LOGIN_WAIT_MS: intFromEnv(3000),
  POST_LOGIN_WAIT_MS: intFromEnv(5000),

  FORCE_SPEAKERS: boolFromEnv(true),
  SPEAKER_DEVICE_NAME: z.string().default("Altavoces"),
  FORCE_SYSTEM_VOLUME: boolFromEnv(true),
  SPEAKER_SCRIPT_PATH: z.string().default("scripts/set-speakers.ps1"),
});

const parsed = envSchema.parse(process.env);

try {
  new RegExp(parsed.TARGET_DAY_REGEX);
} catch {
  throw new Error(`TARGET_DAY_REGEX inválido: ${parsed.TARGET_DAY_REGEX}`);
}

export const config = {
  monitorUrl: parsed.MONITOR_URL,
  targetArtist: parsed.TARGET_ARTIST,
  targetDayRegex: parsed.TARGET_DAY_REGEX,
  checkIntervalMs: parsed.CHECK_INTERVAL_MS,

  alarmYoutubeUrl: parsed.ALARM_YOUTUBE_URL,
  alarmCooldownMinutes: parsed.ALARM_COOLDOWN_MINUTES,

  playwrightUserDataDir: path.resolve(parsed.PLAYWRIGHT_USER_DATA_DIR),
  stateDir: path.resolve(parsed.STATE_DIR),

  loginEnabled: parsed.LOGIN_ENABLED,
  loginStartText: parsed.LOGIN_START_TEXT,
  loginSubmitText: parsed.LOGIN_SUBMIT_TEXT,
  loginWaitMs: parsed.LOGIN_WAIT_MS,
  postLoginWaitMs: parsed.POST_LOGIN_WAIT_MS,

  forceSpeakers: parsed.FORCE_SPEAKERS,
  speakerDeviceName: parsed.SPEAKER_DEVICE_NAME,
  forceSystemVolume: parsed.FORCE_SYSTEM_VOLUME,
  speakerScriptPath: path.resolve(parsed.SPEAKER_SCRIPT_PATH),
};

export type AppConfig = typeof config;
