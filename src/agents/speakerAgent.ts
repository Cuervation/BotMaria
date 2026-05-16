import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { AppConfig } from '../config';
import { Logger } from '../utils/logger';

export class SpeakerAgent {
  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
  ) {}

  async configure(): Promise<void> {
    await this.forceSpeakersIfEnabled();
  }

  async forceSpeakersIfEnabled(): Promise<boolean> {
    if (!this.config.forceSpeakers) {
      this.logger.info('SpeakerAgent disabled by configuration.');
      return true;
    }

    const scriptPath = path.resolve(process.cwd(), this.config.speakerScriptPath);
    if (!existsSync(scriptPath)) {
      this.logger.warn('Speaker script not found; skipping audio setup.', { scriptPath });
      return false;
    }

    this.logger.info('SpeakerAgent invoking PowerShell setup script.', { scriptPath });

    return await new Promise<boolean>((resolve) => {
      const child = spawn('powershell.exe', [
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath,
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          SPEAKER_DEVICE_NAME: this.config.speakerDeviceName,
        },
      });

      child.stdout.on('data', (chunk) => {
        this.logger.info(String(chunk).trim());
      });

      child.stderr.on('data', (chunk) => {
        this.logger.warn(String(chunk).trim());
      });

      child.on('close', (code) => {
        if (code === 0) {
          this.logger.info('Salida de audio forzada correctamente.');
          resolve(true);
        } else {
          this.logger.warn('No se pudo forzar salida por parlantes. Windows puede seguir usando auriculares si son la salida predeterminada.', { code });
          resolve(false);
        }
      });

      child.on('error', (error) => {
        this.logger.warn('No se pudo forzar salida por parlantes. Windows puede seguir usando auriculares si son la salida predeterminada.', { error: String(error) });
        resolve(false);
      });
    });
  }
}
