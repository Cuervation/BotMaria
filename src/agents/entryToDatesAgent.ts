import type { Page } from "playwright";
import type { AppConfig } from "../config.js";
import { log, warn } from "../utils/logger.js";
import { sleep } from "../utils/sleep.js";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class EntryToDatesAgent {
  constructor(private readonly appConfig: AppConfig) {}

  async enterIfNeeded(page: Page): Promise<boolean> {
    if (!this.appConfig.entryToDatesEnabled) {
      return false;
    }

    const buttonText = this.appConfig.entryToDatesButtonText.trim();
    if (!buttonText) return false;

    log(`Buscando botón general para entrar a fechas: ${buttonText}`);

    const locator = page.locator('button, a, [role="button"]').filter({
      hasText: new RegExp(escapeRegex(buttonText), "i"),
    });

    const total = await locator.count().catch(() => 0);

    for (let index = 0; index < Math.min(total, 10); index += 1) {
      const candidate = locator.nth(index);
      const visible = await candidate.isVisible({ timeout: 1000 }).catch(() => false);
      if (!visible) continue;

      await candidate.scrollIntoViewIfNeeded().catch(() => undefined);
      const clicked = await candidate.click({ timeout: 5000 }).then(() => true).catch((err) => {
        warn(`No pude clickear el botón general ${buttonText}.`, err);
        return false;
      });

      if (!clicked) {
        continue;
      }

      log(`Click en botón general ${buttonText} realizado`);
      await sleep(this.appConfig.entryToDatesWaitMs);
      return true;
    }

    return false;
  }
}
