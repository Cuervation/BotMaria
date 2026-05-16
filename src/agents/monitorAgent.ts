import type { BrowserContext, Page } from "playwright";
import type { AppConfig } from "../config.js";
import { DateDetectorAgent } from "./dateDetectorAgent.js";
import { EntryToDatesAgent } from "./entryToDatesAgent.js";
import { LoginAgent } from "./loginAgent.js";
import { AlarmAgent } from "./alarmAgent.js";
import { PurchaseAssistAgent } from "./purchaseAssistAgent.js";
import { log, warn } from "../utils/logger.js";
import { sleep } from "../utils/sleep.js";

export class MonitorAgent {
  private readonly loginAgent: LoginAgent;
  private readonly dateDetectorAgent: DateDetectorAgent;
  private readonly entryToDatesAgent: EntryToDatesAgent;
  private readonly alarmAgent: AlarmAgent;
  private readonly purchaseAssistAgent: PurchaseAssistAgent;

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
  }

  async getActivePage(): Promise<Page> {
    const pages = this.context.pages().filter((page) => !page.isClosed());

    if (pages.length > 0) {
      return pages[pages.length - 1];
    }

    return this.context.newPage();
  }

  async isQueueOrWaitingRoom(page: Page): Promise<boolean> {
    const bodyText = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
    return /fila|queue|waiting room|sala de espera|esper[aá]|turno/i.test(bodyText);
  }

  async isDateSelectionScreen(page: Page): Promise<boolean> {
    const bodyText = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
    const normalized = bodyText.replace(/\s+/g, " ").trim();
    const dateHint = /\b([0-3]?\d)\s+(Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Setiembre|Octubre|Noviembre|Diciembre)\b/i;
    return /Seleccion[aá]\s+una\s+fecha/i.test(normalized)
      || (/Mar[ií]a\s+Becerra/i.test(normalized) && dateHint.test(normalized))
      || dateHint.test(normalized);
  }

  async run(): Promise<void> {
    log("MonitorAgent iniciado.");

    while (true) {
      try {
        const page = await this.getActivePage();

        await this.loginAgent.loginIfNeeded(page);

        if (this.appConfig.queueMonitorEnabled && await this.isQueueOrWaitingRoom(page)) {
          log("Todavía parece haber fila virtual o espera. Sigo monitoreando...");
          await sleep(this.appConfig.checkIntervalMs);
          continue;
        }

        if (!this.appConfig.queueContinueWhenAvailable && await this.isQueueOrWaitingRoom(page)) {
          log("Fila virtual detectada y queueContinueWhenAvailable=false. Espero sin intentar avanzar.");
          await sleep(this.appConfig.checkIntervalMs);
          continue;
        }

        if (!(await this.isDateSelectionScreen(page))) {
          const entered = await this.entryToDatesAgent.enterIfNeeded(page);
          if (entered) {
            continue;
          }

          log("Todavía no parece estar la pantalla de fechas. Sigo monitoreando la página activa...");
          await sleep(this.appConfig.checkIntervalMs);
          continue;
        }

        const result = await this.dateDetectorAgent.detect(page);

        if (result.found) {
          await this.alarmAgent.fire(result);
          await this.purchaseAssistAgent.assist(page, result);
        } else {
          log(`Todavía no apareció fecha veintipico disponible. reason=${result.reason}`);
        }
      } catch (err) {
        warn("Falló un ciclo de monitoreo, pero el bot sigue vivo.", err);
      }

      await sleep(this.appConfig.checkIntervalMs);
    }
  }
}
