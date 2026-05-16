import type { Page } from "playwright";
import type { AppConfig } from "../config.js";
import { log, warn } from "../utils/logger.js";
import { sleep } from "../utils/sleep.js";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function clickFirstVisibleByText(page: Page, text: string): Promise<boolean> {
  const pattern = new RegExp(escapeRegExp(text), "i");

  const locators = [
    page.getByRole("button", { name: pattern }),
    page.getByRole("link", { name: pattern }),
    page.getByText(pattern),
  ];

  for (const locator of locators) {
    const count = Math.min(await locator.count().catch(() => 0), 5);

    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      const visible = await candidate.isVisible({ timeout: 800 }).catch(() => false);
      if (!visible) continue;

      await candidate.click({ timeout: 5000 });
      return true;
    }
  }

  return false;
}

export class LoginAgent {
  private completed = false;
  private lastAttemptAt = 0;

  constructor(private readonly appConfig: AppConfig) {}

  async loginIfNeeded(page: Page): Promise<void> {
    if (!this.appConfig.loginEnabled) return;
    if (this.completed) return;

    // Evita intentar clickear en cada ciclo mientras la pantalla todavía no cargó.
    const now = Date.now();
    if (now - this.lastAttemptAt < 15000) return;
    this.lastAttemptAt = now;

    log("Esperando 2 segundos antes de buscar el botón de login...");
    await sleep(2000);

    log(`Buscando botón de login: "${this.appConfig.loginStartText}"`);

    const clickedLogin = await clickFirstVisibleByText(page, this.appConfig.loginStartText);

    if (!clickedLogin) {
      log("No veo botón de Iniciar sesión. Puede que todavía no estés en Movistar Arena o que ya estés logueado.");
      return;
    }

    log(`Click en "${this.appConfig.loginStartText}" realizado.`);
    await sleep(this.appConfig.loginWaitMs);

    log(`Buscando botón de ingreso: "${this.appConfig.loginSubmitText}"`);

    const clickedSubmit = await clickFirstVisibleByText(page, this.appConfig.loginSubmitText);

    if (!clickedSubmit) {
      warn(`No encontré el botón "${this.appConfig.loginSubmitText}". Revisá si el modal cambió o si faltan credenciales precargadas.`);
      return;
    }

    log(`Click en "${this.appConfig.loginSubmitText}" realizado. Esperando post-login...`);
    await sleep(this.appConfig.postLoginWaitMs);

    this.completed = true;
  }
}
