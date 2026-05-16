import type { Page } from "playwright";
import { log } from "../utils/logger.js";

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Setiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export type ParsedDateCard = {
  day: string | null;
  month: string | null;
  time: string | null;
  rawText: string;
  hasSelect: boolean;
  hasActionText: boolean;
  isSoldOut: boolean;
};

export type DateDetectionResult =
  | {
      found: true;
      day: string;
      month: string | null;
      time: string | null;
      rawText: string;
      reason: "available_date_matching_regex";
    }
  | {
      found: false;
      reason:
        | "no_select_buttons"
        | "no_matching_available_date"
        | "date_screen_not_loaded";
    };

function normalizeText(rawText: string): string {
  return rawText.replace(/\s+/g, " ").trim();
}

export function parseDateCardText(rawText: string, actionTextRegex: RegExp = /Seleccionar/i): ParsedDateCard {
  const normalized = normalizeText(rawText);
  const monthPattern = MONTHS.join("|");

  const dateMatch = normalized.match(new RegExp(`\\b([0-3]?\\d)\\s+(${monthPattern})\\b`, "i"));
  const timeMatches = [...normalized.matchAll(/\b([0-2]?\d:[0-5]\d\s*hs?)\b/gi)];
  const time = timeMatches.length > 0 ? timeMatches[timeMatches.length - 1]?.[1] ?? null : null;
  const hasActionText = actionTextRegex.test(normalized);

  return {
    day: dateMatch?.[1] ?? null,
    month: dateMatch?.[2] ?? null,
    time,
    rawText: normalized,
    hasSelect: hasActionText,
    hasActionText,
    isSoldOut: /agotado/i.test(normalized),
  };
}

function isDateScreenText(bodyText: string, actionTextRegex: RegExp): boolean {
  const normalized = normalizeText(bodyText);
  const dateHint = /\b([0-3]?\d)\s+(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Setiembre|Octubre|Noviembre|Diciembre)\b/i;
  const explicitDatePrompt = /Seleccion[aá]\s+una\s+fecha/i;
  const artistAndDates = /Mar[ií]a\s+Becerra/i.test(normalized) && dateHint.test(normalized);

  return explicitDatePrompt.test(normalized) || artistAndDates || dateHint.test(normalized);
}

async function getLikelyCardTextFromAction(page: Page, actionIndex: number, actionTextRegex: RegExp): Promise<string | null> {
  const actionLocator = page.getByText(actionTextRegex).nth(actionIndex);

  for (let depth = 1; depth <= 8; depth += 1) {
    const container = actionLocator.locator(
      `xpath=ancestor::*[self::article or self::li or self::section or self::div][${depth}]`,
    );

    const text = await container.innerText({ timeout: 1500 }).catch(() => "");
    const parsed = parseDateCardText(text, actionTextRegex);

    if (parsed.day && parsed.month && parsed.hasActionText) {
      return text;
    }
  }

  const directText = await actionLocator.innerText({ timeout: 1500 }).catch(() => "");
  return directText || null;
}

export class DateDetectorAgent {
  constructor(
    private readonly targetDayRegex: RegExp,
    private readonly actionTextRegex: RegExp,
  ) {}

  async detect(page: Page): Promise<DateDetectionResult> {
    log("Buscando fechas disponibles...");

    const bodyText = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");

    if (!isDateScreenText(bodyText, this.actionTextRegex)) {
      return { found: false, reason: "date_screen_not_loaded" };
    }

    const actionCount = await page.getByText(this.actionTextRegex).count().catch(() => 0);

    if (actionCount === 0) {
      log("No encontré botones/textos de acción.");
      return { found: false, reason: "no_select_buttons" };
    }

    const maxToInspect = Math.min(actionCount, 30);

    for (let index = 0; index < maxToInspect; index += 1) {
      const rawText = await getLikelyCardTextFromAction(page, index, this.actionTextRegex);
      if (!rawText) continue;

      const parsed = parseDateCardText(rawText, this.actionTextRegex);

      if (!parsed.hasActionText || parsed.isSoldOut || !parsed.day) {
        continue;
      }

      if (!this.targetDayRegex.test(parsed.day)) {
        log(`Fecha disponible no matchea regex: ${parsed.rawText}`);
        continue;
      }

      log(`Fecha disponible detectada: ${parsed.rawText}`);

      return {
        found: true,
        day: parsed.day,
        month: parsed.month,
        time: parsed.time,
        rawText: parsed.rawText,
        reason: "available_date_matching_regex",
      };
    }

    log("No hay fechas veintipico disponibles todavía.");
    return { found: false, reason: "no_matching_available_date" };
  }
}
