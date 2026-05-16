import { spawn } from "node:child_process";
import path from "node:path";
import type { AppConfig } from "../config.js";
import { log } from "./logger.js";

export class WindowPlacementAgent {
  constructor(private readonly appConfig: AppConfig) {}

  async centerBrowserWindow(): Promise<void> {
    if (this.appConfig.playwrightHeadless) return;

    const scriptPath = path.resolve("scripts/center-browser.ps1");
    log("Recentrando ventana de Chrome en Windows...");

    spawn("powershell.exe", [
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
    ], {
      stdio: "ignore",
      detached: true,
      windowsHide: true,
    }).unref();
  }
}
