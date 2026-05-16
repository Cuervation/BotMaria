import type { Page } from "playwright";
import type { AppConfig } from "../config.js";
import type { DateDetectionResult } from "./dateDetectorAgent.js";
import { parseDateCardText } from "./dateDetectorAgent.js";
import { log, warn } from "../utils/logger.js";
import { sleep } from "../utils/sleep.js";

type ButtonCandidate = {
  label: string;
  click: () => Promise<void>;
};

export type PurchaseAssistResult =
  | { status: "selected" }
  | { status: "disabled" }
  | { status: "blocked"; reason: "captcha_or_payment_or_final_confirmation" }
  | { status: "not_found" };

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
  private firedInCurrentAttempt = false;

  constructor(private readonly appConfig: AppConfig) {}

  resetAttempt(): void {
    this.firedInCurrentAttempt = false;
  }

  async assist(page: Page, match: Extract<DateDetectionResult, { found: true }>): Promise<PurchaseAssistResult> {
    if (!this.appConfig.purchaseAssistEnabled || !this.appConfig.purchaseClickEnabled) {
      log("PurchaseAssistAgent deshabilitado por configuración.");
      return { status: "disabled" };
    }

    if (this.firedInCurrentAttempt) {
      log("Purchase assist already fired in this attempt, skipping duplicate action.");
      return { status: "disabled" };
    }

    await page.bringToFront().catch(() => undefined);
    await this.handleCommonDialogs(page);

    if (await this.pageHasBlockingScreen(page)) {
      warn("Automatización detenida: captcha, pago final o confirmación irreversible detectada.");
      return { status: "blocked", reason: "captcha_or_payment_or_final_confirmation" };
    }

    const firstButton = await this.findMatchingButton(page, match, [
      this.appConfig.purchaseButtonText,
      this.appConfig.purchaseFallbackButtonText,
      "Seleccionar",
    ]);

    if (!firstButton) {
      log("No encontré botón Comprar/Seleccionar dentro de la card detectada.");
      return { status: "not_found" };
    }

    log(`Intentando click de compra asistida sobre ${firstButton.label}...`);
    await firstButton.click();
    this.firedInCurrentAttempt = true;
    log(`Click de compra asistida realizado sobre fecha detectada: ${firstButton.label}`);

    if (/seleccionar/i.test(firstButton.label)) {
      log("Fecha seleccionada. Quedo detenido para intervención humana.");
      return { status: "selected" };
    }

    await this.waitForNonBlockingControls(page);

    if (await this.pageHasBlockingScreen(page)) {
      warn("Automatización detenida después de Comprar: captcha, pago final o confirmación irreversible detectada.");
      return { status: "blocked", reason: "captcha_or_payment_or_final_confirmation" };
    }

    const selectButton = await this.findMatchingButton(page, match, ["Seleccionar", this.appConfig.purchaseFallbackButtonText]);
    if (!selectButton) {
      log("No encontré botón Seleccionar para la fecha detectada después de Comprar.");
      return { status: "not_found" };
    }

    log("Intentando click en Seleccionar sobre fecha detectada...");
    await selectButton.click();
    log("Click en Seleccionar realizado sobre fecha detectada");

    return { status: "selected" };
  }

  private async waitForNonBlockingControls(page: Page): Promise<void> {
    for (let attempt = 1; attempt <= 60; attempt += 1) {
      await page.bringToFront().catch(() => undefined);

      if (await this.pageHasBlockingScreen(page)) return;

      const bodyText = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
      if (/Seleccion[aá]\s+una\s+fecha|Seleccionar/i.test(bodyText)) {
        return;
      }

      if (/fila|queue|waiting room|sala de espera|esper[aá]|turno/i.test(bodyText)) {
        log("Fila virtual detectada. Monitoreo sin saltear ni refrescar agresivamente.");
        await sleep(this.appConfig.checkIntervalMs);
        continue;
      }

      await sleep(1000);
    }
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
    return /captcha|recaptcha|pago final|finalizar compra|confirmaci[oó]n irreversible|checkout|payment|pagar|medio de pago|tarjeta/i.test(bodyText);
  }

  private async findMatchingButton(
    page: Page,
    match: Extract<DateDetectionResult, { found: true }>,
    labels: string[],
  ): Promise<ButtonCandidate | null> {
    const actionRegex = new RegExp(this.appConfig.availableActionTextRegex);
    const seen = new Set<string>();

    for (const label of labels) {
      const trimmed = label.trim();
      if (!trimmed || seen.has(trimmed.toLowerCase())) continue;
      seen.add(trimmed.toLowerCase());

      const locator = page.locator('button, a, [role="button"]').filter({
        hasText: new RegExp(escapeRegex(trimmed), "i"),
      });
      const total = await locator.count().catch(() => 0);

      for (let index = 0; index < Math.min(total, 60); index += 1) {
        const candidate = locator.nth(index);
        const visible = await candidate.isVisible({ timeout: 1000 }).catch(() => false);
        if (!visible) continue;

        for (let depth = 1; depth <= 8; depth += 1) {
          const container = candidate.locator(
            `xpath=ancestor::*[self::article or self::li or self::section or self::div][${depth}]`,
          );
          const containerText = await container.innerText({ timeout: 1500 }).catch(() => "");
          if (!containerText) continue;

          const parsed = parseDateCardText(containerText, actionRegex);
          if (!parsed.day || parsed.isSoldOut) continue;
          if (parsed.day !== match.day) continue;
          if (!sameText(parsed.month, match.month)) continue;
          if (!sameText(parsed.time, match.time)) continue;

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
