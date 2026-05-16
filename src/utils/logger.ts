export function log(message: string, meta?: unknown): void {
  const timestamp = new Date().toISOString();
  if (meta === undefined) {
    console.log(`[${timestamp}] ${message}`);
    return;
  }
  console.log(`[${timestamp}] ${message}`, meta);
}

export function warn(message: string, meta?: unknown): void {
  const timestamp = new Date().toISOString();
  if (meta === undefined) {
    console.warn(`[${timestamp}] WARN: ${message}`);
    return;
  }
  console.warn(`[${timestamp}] WARN: ${message}`, meta);
}

export function error(message: string, meta?: unknown): void {
  const timestamp = new Date().toISOString();
  if (meta === undefined) {
    console.error(`[${timestamp}] ERROR: ${message}`);
    return;
  }
  console.error(`[${timestamp}] ERROR: ${message}`, meta);
}
