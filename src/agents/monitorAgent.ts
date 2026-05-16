import { Page } from 'playwright';
import { Logger } from '../utils/logger';

export interface MonitorSnapshot {
  url: string;
  title: string;
  bodyText: string;
  textBlocks: string[];
  capturedAt: string;
}

export class MonitorAgent {
  constructor(
    private readonly page: Page,
    private readonly targetUrl: string,
    private readonly logger: Logger,
  ) {}

  async capture(): Promise<MonitorSnapshot> {
    this.logger.info('MonitorAgent navigating to target page.', { url: this.targetUrl });

    await this.page.goto(this.targetUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    await this.page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {
      this.logger.debug('Network idle wait timed out; continuing with visible content snapshot.');
    });

    const title = await this.page.title().catch(() => '');
    const bodyText = await this.page.locator('body').innerText({ timeout: 15_000 }).catch(() => '');
    const textBlocks = await this.collectTextBlocks();

    return {
      url: this.page.url(),
      title,
      bodyText,
      textBlocks,
      capturedAt: new Date().toISOString(),
    };
  }

  private async collectTextBlocks(): Promise<string[]> {
    const selectors = ['main', 'article', 'section', 'li', 'button', 'a', '[role="button"]', 'div', 'span'];

    return this.page.evaluate((candidateSelectors) => {
      const seen = new Set<string>();
      const blocks: string[] = [];

      for (const selector of candidateSelectors) {
        const elements = Array.from(document.querySelectorAll(selector));

        for (const element of elements) {
          const text = (element.textContent ?? '')
            .replace(/\s+/g, ' ')
            .trim();

          if (text.length < 2 || text.length > 220) {
            continue;
          }

          if (seen.has(text)) {
            continue;
          }

          seen.add(text);
          blocks.push(text);
        }
      }

      return blocks.slice(0, 500);
    }, selectors).catch(() => []);
  }
}

