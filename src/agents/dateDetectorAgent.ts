import { Locator, Page } from 'playwright';
import { Logger } from '../utils/logger';
const { parseDateCardText } = require('./dateCardParser');

export interface ParsedDateCard {
  day: string;
  month: string;
  time: string;
  rawText: string;
}

export interface DateDetectionResult {
  found: boolean;
  reason: 'available_date_matching_regex' | 'no_matching_available_date';
  day?: string;
  month?: string;
  time?: string;
  rawText?: string;
}

interface DateCardCandidate {
  rawText: string;
  source: string;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function stripWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function uniqueByRawText(items: DateCardCandidate[]): DateCardCandidate[] {
  const seen = new Set<string>();
  const output: DateCardCandidate[] = [];

  for (const item of items) {
    const key = stripWhitespace(item.rawText);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push({ ...item, rawText: key });
  }

  return output;
}

export { parseDateCardText };

export class DateDetectorAgent {
  private readonly dayRegex: RegExp;

  constructor(
    private readonly targetArtist: string,
    private readonly targetDayRegex: RegExp,
    private readonly logger: Logger,
  ) {
    this.dayRegex = new RegExp(this.targetDayRegex.source, this.targetDayRegex.flags.replace(/[gy]/g, ''));
  }

  async inspect(page: Page): Promise<DateDetectionResult> {
    this.logger.info('Buscando fechas disponibles...', { targetArtist: this.targetArtist });

    const artistVisible = await this.pageContainsTargetArtist(page);
    if (!artistVisible) {
      this.logger.info('No hay fechas veintipico disponibles todavia');
      return { found: false, reason: 'no_matching_available_date' };
    }

    const candidates = await this.collectSelectableCards(page);

    if (candidates.length === 0) {
      this.logger.info('No hay fechas veintipico disponibles todavia');
      return { found: false, reason: 'no_matching_available_date' };
    }

    for (const candidate of uniqueByRawText(candidates)) {
      if (normalizeText(candidate.rawText).includes('agotado')) {
        continue;
      }

      const parsed = parseDateCardText(candidate.rawText);
      if (!parsed) {
        continue;
      }

      if (this.dayRegex.test(parsed.day)) {
        this.logger.info(`Fecha disponible detectada: ${parsed.day} ${parsed.month} ${parsed.time}`, {
          rawText: parsed.rawText,
          source: candidate.source,
        });

        return {
          found: true,
          reason: 'available_date_matching_regex',
          day: parsed.day,
          month: parsed.month,
          time: parsed.time,
          rawText: parsed.rawText,
        };
      }

      this.logger.info(`Fecha disponible no matchea regex: ${parsed.day} ${parsed.month} ${parsed.time}`, {
        rawText: parsed.rawText,
        source: candidate.source,
        targetDayRegex: this.dayRegex.source,
      });
    }

    this.logger.info('No hay fechas veintipico disponibles todavia');
    return { found: false, reason: 'no_matching_available_date' };
  }

  private async collectSelectableCards(page: Page): Promise<DateCardCandidate[]> {
    const locators: Array<{ label: string; locator: Locator }> = [
      { label: 'role-link', locator: page.getByRole('link', { name: /Seleccionar|Comprar/i }) },
      { label: 'role-button', locator: page.getByRole('button', { name: /Seleccionar|Comprar/i }) },
      { label: 'text', locator: page.getByText(/Seleccionar|Comprar/i) },
    ];

    const candidates: DateCardCandidate[] = [];

    for (const { label, locator } of locators) {
      const count = await locator.count().catch(() => 0);

      for (let index = 0; index < count; index += 1) {
        const item = locator.nth(index);
        const container = await this.findReasonableContainer(item);
        const rawText = await container.innerText({ timeout: 5_000 }).catch(() => '');
        if (!stripWhitespace(rawText)) {
          continue;
        }

        candidates.push({
          rawText,
          source: label,
        });
      }
    }

    return candidates;
  }

  private async findReasonableContainer(locator: Locator): Promise<Locator> {
    const container = locator.locator(
      'xpath=ancestor-or-self::*[self::li or self::article or self::section or self::tr or self::div or self::button or @role="listitem" or @data-testid][1]',
    );

    const count = await container.count().catch(() => 0);
    if (count > 0) {
      return container.first();
    }

    return locator;
  }

  private async pageContainsTargetArtist(page: Page): Promise<boolean> {
    const target = normalizeText(this.targetArtist);

    const bodyText = await page.locator('body').innerText({ timeout: 10_000 }).catch(() => '');
    if (normalizeText(bodyText).includes(target)) {
      return true;
    }

    const exact = page.getByText(new RegExp(this.escapeRegex(this.targetArtist), 'i'));
    return (await exact.count().catch(() => 0)) > 0;
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
