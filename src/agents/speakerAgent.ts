import { execFile } from "node:child_process";
import type { AppConfig } from "../config.js";
import { log, warn } from "../utils/logger.js";

export class SpeakerAgent {
  constructor(private readonly appConfig: AppConfig) {}

  async forceSpeakersIfEnabled(): Promise<void> {
    if (!this.appConfig.forceSpeakers) {
      log("FORCE_SPEAKERS=false. No intento cambiar salida de audio.");
      return;
    }

    log("Intentando cambiar salida de audio a parlantes...");

    try {
      await this.runPowerShellScript();
      log("Salida de audio forzada correctamente.");
    } catch (err) {
      warn("No se pudo forzar salida por parlantes. Windows puede seguir usando auriculares si son la salida predeterminada.", err);
    }
  }

  private runPowerShellScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      execFile(
        "powershell.exe",
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          this.appConfig.speakerScriptPath,
        ],
        {
          env: {
            ...process.env,
            SPEAKER_DEVICE_NAME: this.appConfig.speakerDeviceName,
            FORCE_SYSTEM_VOLUME: String(this.appConfig.forceSystemVolume),
          },
          windowsHide: true,
        },
        (error, stdout, stderr) => {
          if (stdout.trim()) log(stdout.trim());
          if (stderr.trim()) warn(stderr.trim());

          if (error) {
            reject(error);
            return;
          }

          resolve();
        },
      );
    });
  }
}
