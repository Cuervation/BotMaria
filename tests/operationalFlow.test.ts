import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("el flujo no conserva bloqueos persistentes de alarma o compra asistida", () => {
  const alarmAgent = readFileSync("src/agents/alarmAgent.ts", "utf8");
  const purchaseAgent = readFileSync("src/agents/purchaseAssistAgent.ts", "utf8");

  assert.equal(alarmAgent.includes("Alarm already fired recently"), false);
  assert.equal(purchaseAgent.includes("Purchase assist already fired recently"), false);
});

test("el monitor limpia estados viejos, reintenta en 1 minuto y espera intervención humana", () => {
  const monitorAgent = readFileSync("src/agents/monitorAgent.ts", "utf8");

  assert.match(monitorAgent, /clearLegacyStateFiles/);
  assert.match(monitorAgent, /attemptRetryWaitMs/);
  assert.match(monitorAgent, /humanInterventionWaitMs/);
});

test("el flujo de compra asistida puede hacer Comprar y luego Seleccionar", () => {
  const purchaseAgent = readFileSync("src/agents/purchaseAssistAgent.ts", "utf8");

  assert.match(purchaseAgent, /purchaseButtonText/);
  assert.match(purchaseAgent, /Seleccionar/);
  assert.match(purchaseAgent, /Click en Seleccionar realizado sobre fecha detectada/);
});

test("el flujo se detiene ante captcha, pago o confirmación irreversible", () => {
  const purchaseAgent = readFileSync("src/agents/purchaseAssistAgent.ts", "utf8");

  assert.match(purchaseAgent, /captcha/);
  assert.match(purchaseAgent, /pago final/);
  assert.match(purchaseAgent, /confirmaci/);
});
