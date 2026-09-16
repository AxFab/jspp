// Copyright (c) 2026 Fabien Bavent
// Licensed under the MIT License. See LICENSE for details.
// ──────────────────────────────────────────────────────────────────────────

export type StringifyOptions = {
  space: number;
  compact: boolean;
  colors: boolean;
  breakLength: number;
  /** Maximum nesting depth (objects/arrays/Maps/Sets) before throwing. */
  maxDepth: number;
  /** Maximum number of elements in an array, Map, or Set before throwing. */
  maxArrayLength: number;
};

type StringifyContext = StringifyOptions & {
  style: (v:string,t:string) => string
  currentIndent: number;
  seen: Set<object>;
};

function colorStyle(value:string, type:string) {
  if (type == 'number') return `\x1b[33m${value}\x1b[39m` // yellow
  if (type == 'date') return `\x1b[35m${value}\x1b[39m` // magenta
  if (type == 'string') return `\x1b[32m${value}\x1b[39m` // green
  if (type == 'boolean') return `\x1b[33m${value}\x1b[39m` // yellow
  if (type == 'null') return `\x1b[1m${value}\x1b[22m` // bold
  // module: underline, symbol: green, undefined: grey, special: cyan
  return `${value}`
}

const DEFAULT_MAX_DEPTH = 1000;
const DEFAULT_MAX_ARRAY_LENGTH = 100_000;

export function stringify(value: unknown, opts: Partial<StringifyOptions> | null = null): string {
  const ctx: StringifyContext = {
    space: opts?.space ?? 2,
    compact: opts?.compact ?? false,
    colors: opts?.colors ?? false,
    breakLength: opts?.breakLength ?? 80,
    maxDepth: opts?.maxDepth ?? DEFAULT_MAX_DEPTH,
    maxArrayLength: opts?.maxArrayLength ?? DEFAULT_MAX_ARRAY_LENGTH,
    style: opts?.colors === true ? colorStyle : ((s) => s),
    currentIndent: 0,
    seen: new Set(),
  };
  return _stringify(ctx, value, 0);
}

function _stringify(ctx: StringifyContext, value: unknown, recurseTimes: number): string {
  // Unwrap boxed primitives (e.g. new String("hi"), new Boolean(true))
  if (value instanceof String)  return _stringifyPrimitive(value.valueOf(), ctx.style);
  if (value instanceof Number)  return _stringifyPrimitive(value.valueOf(), ctx.style);
  if (value instanceof Boolean) return _stringifyPrimitive(value.valueOf(), ctx.style);
  if (value instanceof Date) return _stringifyPrimitive(value, ctx.style);

  // Reject typed arrays
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    throw new Error(`JSON doesn't support typed arrays (got ${value.constructor.name})`);
  }

  if (value === null)            return ctx.style('null', 'null');
  if (typeof value !== 'object') return _stringifyPrimitive(value, ctx.style);

  // Cyclic reference check
  if (ctx.seen.has(value as object)) {
    throw new Error("JSON doesn't support cyclic references");
  }

  // Delegate to toJSON if available (e.g. Date)
  const toJSON = (value as Record<string, unknown>).toJSON;
  if (typeof toJSON === 'function') {
    return _stringify(ctx, toJSON.call(value), recurseTimes);
  }

  if (recurseTimes > ctx.maxDepth) {
    throw new Error(`Maximum depth (${ctx.maxDepth}) exceeded`);
  }

  if (value instanceof Map) return _stringifyMap(ctx, value, recurseTimes);
  if (value instanceof Set) return _stringifySet(ctx, value, recurseTimes);
  if (Array.isArray(value)) return _stringifyArray(ctx, value, recurseTimes);
  return _stringifyObject(ctx, value as Record<string, unknown>, recurseTimes);
}

// ---------------------------------------------------------------------------
// Array
// ---------------------------------------------------------------------------

function _stringifyArray(ctx: StringifyContext, arr: unknown[], recurseTimes: number): string {
  if (arr.length === 0) return '[]';
  if (arr.length > ctx.maxArrayLength) {
    throw new Error(`Array length (${arr.length}) exceeds maxArrayLength (${ctx.maxArrayLength})`);
  }

  ctx.seen.add(arr);

  const childCtx = { ...ctx, currentIndent: ctx.currentIndent + ctx.space };

  const items = arr.map((item) => {
    // Undefined/function/symbol inside arrays serialize to null (per JSON spec)
    if (item === undefined || typeof item === 'function' || typeof item === 'symbol') {
      return 'null';
    }
    return _stringify(childCtx, item, recurseTimes + 1);
  });

  ctx.seen.delete(arr);
  ctx.seen = childCtx.seen; // propagate cycle-detection state

  return _format(ctx, '[', ']', items, ',');
}

// ---------------------------------------------------------------------------
// Map / Set
// ---------------------------------------------------------------------------

// Map has no native JSON representation, so it is rendered as an array of
// [key, value] pairs — this works regardless of key type (string, number,
// object, ...), unlike collapsing to a plain object which would only work
// for string keys.
function _stringifyMap(ctx: StringifyContext, map: Map<unknown, unknown>, recurseTimes: number): string {
  if (map.size === 0) return '[]';
  if (map.size > ctx.maxArrayLength) {
    throw new Error(`Map size (${map.size}) exceeds maxArrayLength (${ctx.maxArrayLength})`);
  }

  ctx.seen.add(map);

  const childCtx = { ...ctx, currentIndent: ctx.currentIndent + ctx.space };

  const items = Array.from(map.entries()).map(([key, val]) => {
    const keyStr = _stringify(childCtx, key, recurseTimes + 1);
    const valStr = _stringify(childCtx, val, recurseTimes + 1);
    return _format(childCtx, '[', ']', [keyStr, valStr], ',');
  });

  ctx.seen.delete(map);
  ctx.seen = childCtx.seen;

  return _format(ctx, '[', ']', items, ',');
}

// Set has no native JSON representation either, so it is rendered as a
// plain array of its values, in iteration order.
function _stringifySet(ctx: StringifyContext, set: Set<unknown>, recurseTimes: number): string {
  if (set.size === 0) return '[]';
  if (set.size > ctx.maxArrayLength) {
    throw new Error(`Set size (${set.size}) exceeds maxArrayLength (${ctx.maxArrayLength})`);
  }

  ctx.seen.add(set);

  const childCtx = { ...ctx, currentIndent: ctx.currentIndent + ctx.space };

  const items = Array.from(set.values()).map((val) => _stringify(childCtx, val, recurseTimes + 1));

  ctx.seen.delete(set);
  ctx.seen = childCtx.seen;

  return _format(ctx, '[', ']', items, ',');
}

// ---------------------------------------------------------------------------
// Object
// ---------------------------------------------------------------------------

function _stringifyObject(
  ctx: StringifyContext,
  obj: Record<string, unknown>,
  recurseTimes: number,
): string {
  const keys = Object.keys(obj);
  if (keys.length === 0) return '{}';

  ctx.seen.add(obj);

  const childCtx = { ...ctx, currentIndent: ctx.currentIndent + ctx.space };

  const entries: string[] = [];
  for (const key of keys) {
    const val = obj[key];
    // Skip undefined, function, and symbol values (per JSON spec)
    if (val === undefined || typeof val === 'function' || typeof val === 'symbol') continue;
    const serialisedVal = _stringify(childCtx, val, recurseTimes + 1);
    if (ctx.compact)
      entries.push(`${strQuoteAndEscape(key)}:${serialisedVal}`);
    else
      entries.push(`${strQuoteAndEscape(key)}: ${serialisedVal}`);
  }

  ctx.seen.delete(obj);
  ctx.seen = childCtx.seen;

  if (entries.length === 0) return '{}';

  return _format(ctx, '{', '}', entries, ',');
}

// ---------------------------------------------------------------------------
// Layout engine — decides compact vs expanded based on breakLength
// ---------------------------------------------------------------------------

/**
 * Renders a bracket-delimited list either on one line or broken across lines.
 *
 * compact === true  → always single-line, breakLength ignored.
 * compact === false → try single-line first.  Break if the total width
 *                     (currentIndent + line length) exceeds breakLength, or if
 *                     any item is itself already multi-line.
 *                     A primitive string that alone exceeds breakLength is
 *                     left on one line — we can't split a scalar.
 */
function _format(
  ctx: StringifyContext,
  open: string,
  close: string,
  items: string[],
  sep: string,
): string {
  if (ctx.compact) {
    return `${open}${items.join(sep)}${close}`;
  }

  if (ctx.breakLength > 0) {
    const oneLiner = `${open}${items.join(`${sep} `)}${close}`;
    const oneLinerLength = ctx.colors ? oneLiner.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').length : oneLiner.length
    const fitsOnOneLine =
      ctx.currentIndent + oneLinerLength <= ctx.breakLength &&
      !items.some((it) => it.includes('\n'));

    if (fitsOnOneLine) return oneLiner;
  }

  // Expanded form
  const childIndent   = ' '.repeat(ctx.currentIndent + ctx.space);
  const closingIndent = ' '.repeat(ctx.currentIndent);
  const body = items.map((it) => `${childIndent}${it}`).join(`${sep}\n`);
  return `${open}\n${body}\n${closingIndent}${close}`;
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function _stringifyPrimitive(value: unknown, fn:(v:string,t:string)=>string): string {
  if (value instanceof Date)
    return fn(strQuoteAndEscape(value.toISOString()), 'date');
  else if (typeof value === 'string')
    return fn(strQuoteAndEscape(value), 'string');
  else if (typeof value === 'number')
    return fn(`${value}`, 'number');
  else if (typeof value === 'bigint')
    throw new Error(`JSON doesn't support big-integer`);
  else if (typeof value === 'boolean')
    return fn(`${value}`, 'boolean');
  else if (typeof value === 'undefined')
    return fn('null', 'null');
  throw new Error(`JSON doesn't support '${typeof value}' as primitive`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function strQuoteAndEscape(str: string): string {
  let result = '"';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const code = str.charCodeAt(i);
    if      (ch === '"')  result += '\\"';
    else if (ch === '\\') result += '\\\\';
    else if (ch === '\b') result += '\\b';
    else if (ch === '\f') result += '\\f';
    else if (ch === '\n') result += '\\n';
    else if (ch === '\r') result += '\\r';
    else if (ch === '\t') result += '\\t';
    else if (code < 0x20) result += `\\u${code.toString(16).padStart(4, '0')}`;
    else                  result += ch;
  }
  return result + '"';
}
