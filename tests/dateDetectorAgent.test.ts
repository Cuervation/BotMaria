import test from "node:test";
import assert from "node:assert/strict";
import { parseDateCardText } from "../src/agents/dateDetectorAgent.js";

test("parsea card disponible de noviembre", () => {
  const parsed = parseDateCardText("20 Noviembre 21:00 hs Seleccionar");

  assert.equal(parsed.day, "20");
  assert.equal(parsed.month, "Noviembre");
  assert.equal(parsed.time, "21:00 hs");
  assert.equal(parsed.hasSelect, true);
  assert.equal(parsed.isSoldOut, false);
});

test("marca agotado", () => {
  const parsed = parseDateCardText("23 Noviembre 21:00 hs Agotado");

  assert.equal(parsed.day, "23");
  assert.equal(parsed.hasSelect, false);
  assert.equal(parsed.isSoldOut, true);
});

test("soporta saltos de línea", () => {
  const parsed = parseDateCardText(`
    21
    Noviembre
    21:00 hs
    Seleccionar
  `);

  assert.equal(parsed.day, "21");
  assert.equal(parsed.month, "Noviembre");
  assert.equal(parsed.time, "21:00 hs");
  assert.equal(parsed.hasSelect, true);
});

test("soporta acción Comprar como texto válido", () => {
  const parsed = parseDateCardText("19 Noviembre 21:00 hs Comprar", /Seleccionar|Comprar/i);

  assert.equal(parsed.day, "19");
  assert.equal(parsed.month, "Noviembre");
  assert.equal(parsed.time, "21:00 hs");
  assert.equal(parsed.hasActionText, true);
});
