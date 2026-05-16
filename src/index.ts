import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { chromium, BrowserContext } from 'playwright';
import { loadConfig } from './config';
import { DateDetectorAgent } from './agents/dateDetectorAgent';
import { MonitorAgent } from './agents/monitorAgent';
import { AlarmAgent } from './agents/alarmAgent';
import { SpeakerAgent } from './agents/speakerAgent';
import { createLogger } from './utils/logger';
import { sleep } from './utils/sleep';

async function ensureDirectory(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

function resolvePath(inputPath: string): string {
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
}

async function launchPersistentContext(userDataDir: string): Promise<BrowserContext> {
  const resolvedUserDataDir = resolvePath(userDataDir);
  await ensureDirectory(path.dirname(resolvedUserDataDir));

  try {
    return await chromium.launchPersistentContext(resolvedUserDataDir, {
      headless: false,
      channel: 'chrome',
    });
  } catch {
    return chromium.launchPersistentContext(resolvedUserDataDir, {
      headless: false,
    });
  }
}

async function main(): Promise<void> {
  const logger = createLogger();
  const config = loadConfig();

  logger.info('Starting movistar-arena-watchdog.', {
    monitorUrl: config.monitorUrl,
    targetArtist: config.targetArtist,
    targetDayRegex: config.targetDayRegex.source,
    checkIntervalMs: config.checkIntervalMs,
  });

  await ensureDirectory(resolvePath(config.stateDir));
  await ensureDirectory(resolvePath(config.playwrightUserDataDir));

  const speakerAgent = new SpeakerAgent(config, logger);

  const context = await launchPersistentContext(config.playwrightUserDataDir);
  const page = context.pages()[0] ?? (await context.newPage());
  const monitorAgent = new MonitorAgent(page, config.monitorUrl, logger);
  const detectorAgent = new DateDetectorAgent(config.targetArtist, config.targetDayRegex, logger);
  const alarmAgent = new AlarmAgent(
    context,
    config.alarmYoutubeUrl,
    speakerAgent,
    config.stateDir,
    config.alarmCooldownMinutes,
    logger,
  );

  const shutdown = async () => {
    logger.info('Shutting down browser context.');
    await context.close().catch(() => undefined);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  while (true) {
    try {
      await monitorAgent.capture();
      const detection = await detectorAgent.inspect(page);

      if (detection.found) {
        logger.warn('Matching date detected.', {
          day: detection.day,
          month: detection.month,
          time: detection.time,
          reason: detection.reason,
        });

        await alarmAgent.fire(detection.reason, {
          day: detection.day ?? '',
          month: detection.month ?? '',
          time: detection.time ?? '',
          rawText: detection.rawText ?? '',
        });
      } else {
        logger.info('No matching date found.', { reason: detection.reason });
      }
    } catch (error) {
      logger.error('Monitor loop error.', { error: String(error) });
    }

    await sleep(config.checkIntervalMs);
  }
}

main().catch((error) => {
  const logger = createLogger();
  logger.error('Fatal startup error.', { error: String(error) });
  process.exit(1);
});
