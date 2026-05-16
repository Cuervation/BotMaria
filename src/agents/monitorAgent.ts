import { promises as fs } from "node:fs";
import path from "node:path";
import type { BrowserContext, Page } from "playwright";
import type { AppConfig } from "../config.js";
import { DateDetectorAgent } from "./dateDetectorAgent.js";
import { EntryToDatesAgent } from "./entryToDatesAgent.js";
import { LoginAgent } from "./loginAgent.js";
import { AlarmAgent } from "./alarmAgent.js";
import { PurchaseAssistAgent } from "./purchaseAssistAgent.js";
import { WindowPlacementAgent } from "../utils/windowPlacement.js";
import { log, warn } from "../utils/logger.js";
import { sleep } from "../utils/sleep.js";

export class MonitorAgent {
  private readonly loginAgent: LoginAgent;
  private readonly dateDetectorAgent: DateDetectorAgent;
  private readonly entryToDatesAgent: EntryToDatesAgent;
  private readonly alarmAgent: AlarmAgent;
  private readonly purchaseAssistAgent: PurchaseAssistAgent;
  private readonly windowPlacementAgent: WindowPlacementAgent;

  constructor(
    private readonly context: BrowserContext,
    private readonly appConfig: AppConfig,
  ) {
    this.loginAgent = new LoginAgent(appConfig);
    this.dateDetectorAgent = new DateDetectorAgent(
      new RegExp(appConfig.targetDayRegex),
      new RegExp(appConfig.availableActionTextRegex),
    );
    this.entryToDatesAgent = new EntryToDatesAgent(appConfig);
    this.alarmAgent = new AlarmAgent(context, appConfig);
    this.purchaseAssistAgent = new PurchaseAssistAgent(appConfig);
    this.windowPlacementAgent = new WindowPlacementAgent(appConfig);
  }

  async run(): Promise<void> {
    log("MonitorAgent iniciado.");

    let attempt = 0;

    while (true) {
      attempt += 1;
      this.purchaseAssistAgent.resetAttempt();
      await this.clearLegacyStateFiles();

      const page = await this.openAttemptPage(attempt);

      try {
        const completed = await this.runAttempt(page);

        if (completed) {
          log(`Quedo esperando ${this.appConfig.humanInterventionWaitMs / 60000} minutos para intervención humana.`);
          await sleep(this.appConfig.humanInterventionWaitMs);
        } else {
          log("No encontré fecha válida. Cierro intento, espero 1 minuto y vuelvo a intentar desde cero.");
          await this.closeAttemptPages();
          await sleep(this.appConfig.attemptRetryWaitMs);
        }
      } catch (err) {
        warn("Falló un intento de monitoreo, pero el bot sigue vivo.", err);
        await this.closeAttemptPages();
        await sleep(this.appConfig.attemptRetryWaitMs);
      }
    }
  }

  private async runAttempt(page: Page): Promise<boolean> {
    while (true) {
      await this.loginAgent.loginIfNeeded(page);

      if (await this.hasBlockingScreen(page)) {
        warn("Automatización detenida: captcha, pago final o confirmación irreversible detectada.");
        await page.bringToFront().catch(() => undefined);
        return true;
      }

      if (this.appConfig.queueMonitorEnabled && await this.isQueueOrWaitingRoom(page)) {
        log("Fila virtual detectada. Monitoreo sin saltear ni refrescar agresivamente.");
        await sleep(this.appConfig.checkIntervalMs);
        continue;
      }

      if (!(await this.isDateSelectionScreen(page))) {
        const entered = await this.entryToDatesAgent.enterIfNeeded(page);
        if (entered) {
          continue;
        }

        return false;
      }

      const result = await this.dateDetectorAgent.detect(page);

      if (!result.found) {
        return false;
      }

      log(`Fecha válida detectada: ${result.rawText}`);
      await this.alarmAgent.fire(result);
      await this.windowPlacementAgent.centerBrowserWindow();
      await page.bringToFront().catch(() => undefined);

      const assistResult = await this.purchaseAssistAgent.assist(page, result);
      if (assistResult.status === "blocked") {
        await page.bringToFront().catch(() => undefined);
        return true;
      }

      if (assistResult.status === "selected") {
        await page.bringToFront().catch(() => undefined);
        return true;
      }

      return false;
    }
  }

  private async openAttemptPage(attempt: number): Promise<Page> {
    log(`Iniciando intento ${attempt}.`);

    const page = await this.context.newPage();

    if (this.appConfig.monitorUrl) {
      log(`Abriendo MONITOR_URL: ${this.appConfig.monitorUrl}`);
      await page.goto(this.appConfig.monitorUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    } else {
      log("MONITOR_URL está vacío. Uso la página activa/manual.");
      await page.goto("about:blank");
    }

    await page.bringToFront().catch(() => undefined);
    return page;
  }

  private async closeAttemptPages(): Promise<void> {
    const pages = this.context.pages().filter((page) => !page.isClosed());
    for (const page of pages) {
      await page.close().catch(() => undefined);
    }
  }

  private async clearLegacyStateFiles(): Promise<void> {
    const legacyFiles = [
      path.join(this.appConfig.stateDir, "alarm-fired.json"),
      path.join(this.appConfig.stateDir, "purchase-action-fired.json"),
    ];

    for (const file of legacyFiles) {
      await fs.rm(file, { force: true }).catch(() => undefined);
    }
  }

  private async isQueueOrWaitingRoom(page: Page): Promise<boolean> {
    const bodyText = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
    return /fila|queue|waiting room|sala de espera|esper[aá]|turno/i.test(bodyText);
  }

  private async isDateSelectionScreen(page: Page): Promise<boolean> {
    const bodyText = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
    const normalized = bodyText.replace(/\s+/g, " ").trim();
    const dateHint = /\b([0-3]?\d)\s+(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Setiembre|Octubre|Noviembre|Diciembre)\b/i;
    return /Seleccion[aá]\s+una\s+fecha/i.test(normalized)
      || (/Mar[ií]a\s+Becerra/i.test(normalized) && dateHint.test(normalized))
      || dateHint.test(normalized);
  }

  private async hasBlockingScreen(page: Page): Promise<boolean> {
    const bodyText = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
    return /captcha|recaptcha|pago final|finalizar compra|confirmaci[oó]n irreversible|checkout|payment|pagar|medio de pago|tarjeta/i.test(bodyText);
  }
}
