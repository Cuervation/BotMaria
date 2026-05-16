import { chromium } from "playwright";
import { config } from "./config.js";
import { MonitorAgent } from "./agents/monitorAgent.js";
import { log, warn } from "./utils/logger.js";
import { printStartupAscii } from "./utils/startupAscii.js";

async function main(): Promise<void> {
  printStartupAscii();
  log("Iniciando BotMaria...");
  log(`CHECK_INTERVAL_MS=${config.checkIntervalMs}`);
  log(`TARGET_DAY_REGEX=${config.targetDayRegex}`);
  log(`LOGIN_ENABLED=${config.loginEnabled}`);

  const context = await chromium.launchPersistentContext(config.playwrightUserDataDir, {
    headless: false,
    args: [
      "--autoplay-policy=no-user-gesture-required",
      "--disable-features=PreloadMediaEngagementData,MediaEngagementBypassAutoplayPolicies",
    ],
  });

  let shuttingDown = false;

  async function shutdown(): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;

    log("Cerrando navegador...");
    await context.close().catch((err) => warn("No pude cerrar contexto limpiamente.", err));
    process.exit(0);
  }

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  const monitorAgent = new MonitorAgent(context, config);
  await monitorAgent.run();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
