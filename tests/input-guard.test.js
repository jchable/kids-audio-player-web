import test from 'node:test';
import assert from 'node:assert/strict';
import { createInputGuard } from '../js/input-guard.js';

test('après un changement d\'écran, les touchers sont ignorés 400 ms', () => {
  let time = 1000;
  const guard = createInputGuard(() => time);
  assert.equal(guard.allows(), true);
  guard.hold(400);
  time = 1399;
  assert.equal(guard.allows(), false);
  time = 1400;
  assert.equal(guard.allows(), true);
});
