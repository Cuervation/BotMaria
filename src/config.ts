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
  ATTEMPT_RETRY_WAIT_MS: intFromEnv(60000).refine((value) => value >= 60000, {
    message: "ATTEMPT_RETRY_WAIT_MS no puede ser menor a 60000.",
  }),
  HUMAN_INTERVENTION_WAIT_MS: intFromEnv(1800000).refine((value) => value >= 60000),

  ALARM_YOUTUBE_URL: z.string().url().default("https://www.youtube.com/watch?v=vOapgSfSN1s&list=RDEMCgLb_8NFlBz0UcgoUIrqFQ&start_radio=1"),
  ALARM_COOLDOWN_MINUTES: intFromEnv(0),

  PLAYWRIGHT_USER_DATA_DIR: z.string().default(".playwright-profile"),
  PLAYWRIGHT_HEADLESS: boolFromEnv(false),
  PLAYWRIGHT_MINIMIZE_ON_START: boolFromEnv(false),
  STATE_DIR: z.string().default("state"),

  LOGIN_ENABLED: boolFromEnv(true),
  LOGIN_START_TEXT: z.string().default("Iniciar sesión"),
  LOGIN_SUBMIT_TEXT: z.string().default("Ingresar"),
  LOGIN_WAIT_MS: intFromEnv(3000),
  POST_LOGIN_WAIT_MS: intFromEnv(5000),

  QUEUE_MONITOR_ENABLED: boolFromEnv(true),
  QUEUE_CONTINUE_WHEN_AVAILABLE: boolFromEnv(true),

  ENTRY_TO_DATES_ENABLED: boolFromEnv(true),
  ENTRY_TO_DATES_BUTTON_TEXT: z.string().default("Comprar"),
  ENTRY_TO_DATES_WAIT_MS: intFromEnv(5000),

  FORCE_SPEAKERS: boolFromEnv(true),
  SPEAKER_DEVICE_NAME: z.string().default("Altavoces"),
  FORCE_SYSTEM_VOLUME: boolFromEnv(true),
  SPEAKER_SCRIPT_PATH: z.string().default("scripts/set-speakers.ps1"),

  AVAILABLE_ACTION_TEXT_REGEX: z.string().default("Seleccionar|Comprar"),

  PURCHASE_ASSIST_ENABLED: boolFromEnv(true),
  PURCHASE_CLICK_ENABLED: boolFromEnv(true),
  PURCHASE_BUTTON_TEXT: z.string().default("Comprar"),
  PURCHASE_FALLBACK_BUTTON_TEXT: z.string().default("Seleccionar"),
  PURCHASE_ACTION_COOLDOWN_MINUTES: intFromEnv(0),
});

const parsed = envSchema.parse(process.env);

try {
  new RegExp(parsed.TARGET_DAY_REGEX);
} catch {
  throw new Error(`TARGET_DAY_REGEX inválido: ${parsed.TARGET_DAY_REGEX}`);
}

try {
  new RegExp(parsed.AVAILABLE_ACTION_TEXT_REGEX);
} catch {
  throw new Error(`AVAILABLE_ACTION_TEXT_REGEX inválido: ${parsed.AVAILABLE_ACTION_TEXT_REGEX}`);
}

export const config = {
  monitorUrl: parsed.MONITOR_URL,
  targetArtist: parsed.TARGET_ARTIST,
  targetDayRegex: parsed.TARGET_DAY_REGEX,
  checkIntervalMs: parsed.CHECK_INTERVAL_MS,
  attemptRetryWaitMs: parsed.ATTEMPT_RETRY_WAIT_MS,
  humanInterventionWaitMs: parsed.HUMAN_INTERVENTION_WAIT_MS,

  alarmYoutubeUrl: parsed.ALARM_YOUTUBE_URL,
  alarmCooldownMinutes: parsed.ALARM_COOLDOWN_MINUTES,

  playwrightUserDataDir: path.resolve(parsed.PLAYWRIGHT_USER_DATA_DIR),
  playwrightHeadless: parsed.PLAYWRIGHT_HEADLESS,
  playwrightMinimizeOnStart: parsed.PLAYWRIGHT_MINIMIZE_ON_START,
  stateDir: path.resolve(parsed.STATE_DIR),

  loginEnabled: parsed.LOGIN_ENABLED,
  loginStartText: parsed.LOGIN_START_TEXT,
  loginSubmitText: parsed.LOGIN_SUBMIT_TEXT,
  loginWaitMs: parsed.LOGIN_WAIT_MS,
  postLoginWaitMs: parsed.POST_LOGIN_WAIT_MS,

  queueMonitorEnabled: parsed.QUEUE_MONITOR_ENABLED,
  queueContinueWhenAvailable: parsed.QUEUE_CONTINUE_WHEN_AVAILABLE,

  entryToDatesEnabled: parsed.ENTRY_TO_DATES_ENABLED,
  entryToDatesButtonText: parsed.ENTRY_TO_DATES_BUTTON_TEXT,
  entryToDatesWaitMs: parsed.ENTRY_TO_DATES_WAIT_MS,

  forceSpeakers: parsed.FORCE_SPEAKERS,
  speakerDeviceName: parsed.SPEAKER_DEVICE_NAME,
  forceSystemVolume: parsed.FORCE_SYSTEM_VOLUME,
  speakerScriptPath: path.resolve(parsed.SPEAKER_SCRIPT_PATH),

  availableActionTextRegex: parsed.AVAILABLE_ACTION_TEXT_REGEX,

  purchaseAssistEnabled: parsed.PURCHASE_ASSIST_ENABLED,
  purchaseClickEnabled: parsed.PURCHASE_CLICK_ENABLED,
  purchaseButtonText: parsed.PURCHASE_BUTTON_TEXT,
  purchaseFallbackButtonText: parsed.PURCHASE_FALLBACK_BUTTON_TEXT,
  purchaseActionCooldownMinutes: parsed.PURCHASE_ACTION_COOLDOWN_MINUTES,
};

export type AppConfig = typeof config;
