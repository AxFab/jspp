import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stringify } from '../src/index.ts';

test('produces valid JSON parseable by JSON.parse', () => {
  const value = { a: 1, b: 'hi', c: [1, 2, 3], d: null };
  const out = stringify(value);
  assert.deepEqual(JSON.parse(out), value);
});

test('compact mode is single-line', () => {
  const out = stringify({ a: 1, b: 2 }, { compact: true });
  assert.equal(out, '{"a":1,"b":2}');
});

test('breaks long objects onto multiple lines', () => {
  const value = { alpha: 'aaaaaaaaaa', beta: 'bbbbbbbbbb', gamma: 'cccccccccc' };
  const out = stringify(value, { breakLength: 20 });
  assert.ok(out.includes('\n'));
});

test('serializes Date via ISO string', () => {
  const date = new Date('2026-01-01T00:00:00.000Z');
  const out = stringify({ when: date });
  assert.equal(JSON.parse(out).when, '2026-01-01T00:00:00.000Z');
});

test('throws on cyclic references', () => {
  const obj: Record<string, unknown> = {};
  obj.self = obj;
  assert.throws(() => stringify(obj));
});

test('throws on typed arrays', () => {
  assert.throws(() => stringify(new Uint8Array([1, 2, 3])));
});

test('serializes Map as array of [key, value] pairs', () => {
  const map = new Map<unknown, unknown>([['a', 1], [2, 'b']]);
  const out = stringify(map, { compact: true });
  assert.equal(out, '[["a",1],[2,"b"]]');
  assert.deepEqual(JSON.parse(out), [['a', 1], [2, 'b']]);
});

test('serializes empty Map as []', () => {
  assert.equal(stringify(new Map()), '[]');
});

test('serializes Set as array of values', () => {
  const set = new Set([1, 2, 3]);
  const out = stringify(set, { compact: true });
  assert.equal(out, '[1,2,3]');
});

test('serializes empty Set as []', () => {
  assert.equal(stringify(new Set()), '[]');
});

test('throws on cyclic Map/Set references', () => {
  const map = new Map<string, unknown>();
  map.set('self', map);
  assert.throws(() => stringify(map));

  const set = new Set<unknown>();
  set.add(set);
  assert.throws(() => stringify(set));
});

test('default maxArrayLength is very high but finite', () => {
  const arr = Array.from({ length: 1000 }, (_, i) => i);
  assert.doesNotThrow(() => stringify(arr));
});

test('throws when array length exceeds maxArrayLength', () => {
  const arr = [1, 2, 3, 4, 5];
  assert.throws(() => stringify(arr, { maxArrayLength: 3 }), /maxArrayLength/);
});

test('throws when Set size exceeds maxArrayLength', () => {
  const set = new Set([1, 2, 3, 4, 5]);
  assert.throws(() => stringify(set, { maxArrayLength: 3 }), /maxArrayLength/);
});

test('throws when nesting exceeds maxDepth', () => {
  const value = { a: { b: { c: { d: 1 } } } };
  assert.throws(() => stringify(value, { maxDepth: 2 }), /Maximum depth/);
  assert.doesNotThrow(() => stringify(value, { maxDepth: 3 }));
});

test('default maxDepth is very high but finite', () => {
  let value: Record<string, unknown> = { leaf: true };
  for (let i = 0; i < 50; i++) value = { nested: value };
  assert.doesNotThrow(() => stringify(value));
});
