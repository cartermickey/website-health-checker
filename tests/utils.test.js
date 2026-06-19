const { test } = require('node:test');
const assert = require('node:assert/strict');
const { detectPageType } = require('../crawler/utils');

test('detectPageType - homepage', () => {
  assert.equal(detectPageType('https://example.com/'), 'homepage');
  assert.equal(detectPageType('https://example.com'), 'homepage');
});

test('detectPageType - srp', () => {
  assert.equal(detectPageType('https://example.com/new-vehicles'), 'srp');
  assert.equal(detectPageType('https://example.com/inventory'), 'srp');
});

test('detectPageType - vdp', () => {
  assert.equal(detectPageType('https://example.com/vehicles/2024-honda-civic-abc123'), 'vdp');
});

test('detectPageType - specials', () => {
  assert.equal(detectPageType('https://example.com/specials'), 'specials');
  assert.equal(detectPageType('https://example.com/offers'), 'specials');
});

test('detectPageType - service', () => {
  assert.equal(detectPageType('https://example.com/service'), 'service');
});

test('detectPageType - finance', () => {
  assert.equal(detectPageType('https://example.com/finance'), 'finance');
  assert.equal(detectPageType('https://example.com/financing'), 'finance');
});
