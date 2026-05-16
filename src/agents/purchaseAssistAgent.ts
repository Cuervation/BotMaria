import path from "node:path";
import type { Page } from "playwright";
import type { AppConfig } from "../config.js";
import type { DateDetectionResult } from "./dateDetectorAgent.js";
import { parseDateCardText } from "./dateDetectorAgent.js";
import { log, warn } from "../utils/logger.js";
import { readJsonFile, writeJsonFile } from "../utils/fsState.js";
import { sleep } from "../utils/sleep.js";

type PurchaseActionState = {
  firedAt: string;
  reason: string;
  buttonText: string;
  matchedDate: {
    day: string;
    month: string | null;
    time: string | null;
    rawText: string;
  };
};

type ButtonCandidate = {
  label: string;
  click: () => Promise<void>;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return true;
  return normalizeText(a) === normalizeText(b);
}

export class PurchaseAssistAgent {
  private readonly stateFile: string;

  constructor(private readonly appConfig: AppConfig) {
    this.stateFile = path.join(appConfig.stateDir, "purchase-action-fired.json");
  }

  async assist(page: Page, match: Extract<DateDetectionResult, { found: true }>): Promise<void> {
    if (!this.appConfig.purchaseAssistEnabled) {
      log("PurchaseAssistAgent deshabilitado por configuración.");
      return;
    }

    if (!this.appConfig.purchaseClickEnabled) {
      log("PurchaseAssistAgent habilitado, pero PURCHASE_CLICK_ENABLED=false. No hago click.");
      return;
    }

    const recentState = await this.getRecentState();
    if (recentState) {
      log("Purchase assist already fired recently, skipping duplicate action.", recentState);
      return;
    }

    await page.bringToFront().catch(() => undefined);
    await this.handleCommonDialogs(page);

    if (await this.pageHasBlockingScreen(page)) {
      warn("Encontré captcha, pago final o confirmación irreversible. Dejo intervención humana.");
      return;
    }

    const button = await this.findMatchingButton(page, match);
    if (!button) {
      log("No encontré un botón de compra/selección dentro de la card detectada.");
      return;
    }

    log("Intentando click de compra asistida...");

    await button.click().catch((err) => {
      warn(`No pude clickear el botón ${button.label}.`, err);
      throw err;
    });

    log("Click de compra asistida realizado sobre fecha detectada");

    const state: PurchaseActionState = {
      firedAt: new Date().toISOString(),
      reason: "purchase_button_clicked",
      buttonText: button.label,
      matchedDate: {
        day: match.day,
        month: match.month,
        time: match.time,
        rawText: match.rawText,
      },
    };

    await writeJsonFile(this.stateFile, state);
    await sleep(500);
  }

  private async getRecentState(): Promise<PurchaseActionState | null> {
    const state = await readJsonFile<PurchaseActionState>(this.stateFile);
    if (!state) return null;

    const firedAtMs = new Date(state.firedAt).getTime();
    if (Number.isNaN(firedAtMs)) return null;

    const elapsedMinutes = (Date.now() - firedAtMs) / 60000;
    if (elapsedMinutes <= this.appConfig.purchaseActionCooldownMinutes) {
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
      const visible = await button.isVisible({ timeout: 800 }).catch(() => false);
      if (!visible) continue;

      await button.click({ timeout: 2000 }).catch(() => undefined);
      await sleep(300);
    }
  }

  private async pageHasBlockingScreen(page: Page): Promise<boolean> {
    const bodyText = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
    return /captcha|recaptcha|pago final|finalizar compra|confirmaci[oó]n irreversible|checkout|payment/i.test(bodyText);
  }

  private async findMatchingButton(
    page: Page,
    match: Extract<DateDetectionResult, { found: true }>,
  ): Promise<ButtonCandidate | null> {
    const actionRegex = new RegExp(this.appConfig.availableActionTextRegex);

    const allButtons = page.locator('button, a, [role="button"]');
    const total = await allButtons.count().catch(() => 0);

    for (let index = 0; index < Math.min(total, 60); index += 1) {
      const candidate = allButtons.nth(index);
      const visible = await candidate.isVisible({ timeout: 1000 }).catch(() => false);
      if (!visible) continue;

      const container = candidate.locator('xpath=ancestor::*[self::article or self::li or self::section or self::div][1]');
      const containerText = await container.innerText({ timeout: 2000 }).catch(() => "");
      if (!containerText) continue;

      const parsed = parseDateCardText(containerText, actionRegex);
      if (!parsed.day || !parsed.hasActionText || parsed.isSoldOut) continue;
      if (parsed.day !== match.day) continue;
      if (!sameText(parsed.month, match.month)) continue;
      if (!sameText(parsed.time, match.time)) continue;

      const preferredLabels = normalizeText(containerText).includes("seleccionar")
        ? ["Seleccionar", this.appConfig.purchaseButtonText, this.appConfig.purchaseFallbackButtonText]
        : [this.appConfig.purchaseButtonText, this.appConfig.purchaseFallbackButtonText, "Seleccionar"];

      for (const label of preferredLabels) {
        const trimmed = label.trim();
        if (!trimmed) continue;

        const labelMatchesButton = new RegExp(escapeRegex(trimmed), "i");
        const buttonText = await candidate.textContent().catch(() => "");
        const isLabelMatch = buttonText ? labelMatchesButton.test(buttonText) : false;

        if (isLabelMatch || normalizeText(containerText).includes(normalizeText(trimmed))) {
          return {
            label: trimmed,
            click: async () => {
              await candidate.scrollIntoViewIfNeeded().catch(() => undefined);
              await candidate.click({ timeout: 5000 });
            },
          };
        }
      }
    }

    return null;
  }
}
