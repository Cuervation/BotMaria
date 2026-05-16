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

export function parseDateCardText(rawText: string): ParsedDateCard {
  const normalized = normalizeText(rawText);
  const monthPattern = MONTHS.join("|");

  const dateMatch = normalized.match(new RegExp(`\\b([0-3]?\\d)\\s+(${monthPattern})\\b`, "i"));
  const timeMatch = normalized.match(/\b([0-2]?\d:[0-5]\d\s*hs?)\b/i);

  return {
    day: dateMatch?.[1] ?? null,
    month: dateMatch?.[2] ?? null,
    time: timeMatch?.[1] ?? null,
    rawText: normalized,
    hasSelect: /seleccionar/i.test(normalized),
    isSoldOut: /agotado/i.test(normalized),
  };
}

async function getLikelyCardTextFromSelect(page: Page, selectIndex: number): Promise<string | null> {
  const selectLocator = page.getByText(/Seleccionar/i).nth(selectIndex);

  for (let depth = 1; depth <= 8; depth += 1) {
    const container = selectLocator.locator(
      `xpath=ancestor::*[self::article or self::li or self::section or self::div][${depth}]`,
    );

    const text = await container.innerText({ timeout: 1500 }).catch(() => "");
    const parsed = parseDateCardText(text);

    if (parsed.day && parsed.month && parsed.hasSelect) {
      return text;
    }
  }

  const directText = await selectLocator.innerText({ timeout: 1500 }).catch(() => "");
  return directText || null;
}

export class DateDetectorAgent {
  constructor(private readonly targetDayRegex: RegExp) {}

  async detect(page: Page): Promise<DateDetectionResult> {
    log("Buscando fechas disponibles...");

    const bodyText = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");

    if (!/Seleccion[aá]\s+una\s+fecha|Mar[ií]a\s+Becerra|Seleccionar/i.test(bodyText)) {
      return { found: false, reason: "date_screen_not_loaded" };
    }

    const selectCount = await page.getByText(/Seleccionar/i).count().catch(() => 0);

    if (selectCount === 0) {
      log("No encontré botones/textos Seleccionar.");
      return { found: false, reason: "no_select_buttons" };
    }

    const maxToInspect = Math.min(selectCount, 30);

    for (let index = 0; index < maxToInspect; index += 1) {
      const rawText = await getLikelyCardTextFromSelect(page, index);
      if (!rawText) continue;

      const parsed = parseDateCardText(rawText);

      if (!parsed.hasSelect || parsed.isSoldOut || !parsed.day) {
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
