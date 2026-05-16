const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDateCardText } = require('../src/agents/dateCardParser');

test('parseDateCardText parses an available card', () => {
  const parsed = parseDateCardText('20 Noviembre 19:00 hs Puertas 21:00 hs Show Comprar');

  assert.deepEqual(parsed, {
    day: '20',
    month: 'Noviembre',
    time: '21:00 hs',
    rawText: '20 Noviembre 19:00 hs Puertas 21:00 hs Show Comprar',
  });
});

test('parseDateCardText ignores sold out cards', () => {
  const parsed = parseDateCardText('23 Noviembre 21:00 hs Agotado');

  assert.equal(parsed, null);
});

test('parseDateCardText tolerates extra whitespace', () => {
  const parsed = parseDateCardText('  21   Noviembre   19:00   hs   Puertas   21:00   hs   Show   Comprar  ');

  assert.deepEqual(parsed, {
    day: '21',
    month: 'Noviembre',
    time: '21:00 hs',
    rawText: '21 Noviembre 19:00 hs Puertas 21:00 hs Show Comprar',
  });
});
