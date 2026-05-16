import type { BrowserContext, Page } from "playwright";
import type { AppConfig } from "../config.js";
import { DateDetectorAgent } from "./dateDetectorAgent.js";
import { LoginAgent } from "./loginAgent.js";
import { AlarmAgent } from "./alarmAgent.js";
import { log, warn } from "../utils/logger.js";
import { sleep } from "../utils/sleep.js";

export class MonitorAgent {
  private readonly loginAgent: LoginAgent;
  private readonly dateDetectorAgent: DateDetectorAgent;
  private readonly alarmAgent: AlarmAgent;

  constructor(
    private readonly context: BrowserContext,
    private readonly appConfig: AppConfig,
  ) {
    this.loginAgent = new LoginAgent(appConfig);
    this.dateDetectorAgent = new DateDetectorAgent(new RegExp(appConfig.targetDayRegex));
    this.alarmAgent = new AlarmAgent(context, appConfig);
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
    return /Seleccion[aá]\s+una\s+fecha|Mar[ií]a\s+Becerra|Seleccionar/i.test(bodyText);
  }

  async run(): Promise<void> {
    log("MonitorAgent iniciado.");

    while (true) {
      try {
        const page = await this.getActivePage();

        await this.loginAgent.loginIfNeeded(page);

        if (await this.isQueueOrWaitingRoom(page)) {
          log("Todavía parece haber fila virtual o espera. Sigo monitoreando...");
          await sleep(this.appConfig.checkIntervalMs);
          continue;
        }

        if (!(await this.isDateSelectionScreen(page))) {
          log("Todavía no parece estar la pantalla de fechas. Sigo monitoreando la página activa...");
          await sleep(this.appConfig.checkIntervalMs);
          continue;
        }

        const result = await this.dateDetectorAgent.detect(page);

        if (result.found) {
          await this.alarmAgent.fire(result);
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
