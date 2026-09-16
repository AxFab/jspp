# @axfab/jspp

`JSON.stringify` with the readability of Node's `util.inspect` — but the
output is always **valid JSON**.

Unlike `util.inspect`, `prettyjson`, or similar debug-formatters, `jspp`
never falls back to JS object-literal syntax (unquoted keys, single
quotes, trailing commas). What you get out is `JSON.parse`-able, while
still getting `util.inspect`'s smart line-wrapping (`breakLength`,
`compact`), optional ANSI colors, and a few quality-of-life conveniences
`JSON.stringify` doesn't have (boxed primitives, `Date`, `Map`, `Set`,
cyclic-reference detection).

Zero dependencies.

## Install

```sh
npm install @axfab/jspp
```

## Usage

```ts
import { stringify } from '@axfab/jspp';

stringify({ id: 1, name: 'Ada', tags: ['math', 'computing'] });
// {
//   "id": 1,
//   "name": "Ada",
//   "tags": ["math", "computing"]
// }

stringify({ id: 1, name: 'Ada' }, { compact: true });
// {"id":1,"name":"Ada"}

stringify({ id: 1, name: 'Ada' }, { colors: true });
// same as above, with ANSI color codes per value type
```

## Options

| Option           | Type      | Default   | Description                                                                 |
| ---------------- | --------- | --------- | ----------------------------------------------------------------------------- |
| `space`          | `number`  | `2`       | Indentation width used in expanded (multi-line) output.                       |
| `compact`        | `boolean` | `false`   | Force single-line output regardless of `breakLength`.                        |
| `colors`         | `boolean` | `false`   | Wrap values in ANSI color codes by type (number, string, boolean, null, date). |
| `breakLength`    | `number`  | `80`      | Max line width before an object/array is broken onto multiple lines.          |
| `maxDepth`       | `number`  | `1000`    | Max nesting depth (objects/arrays/Maps/Sets) before an error is thrown.       |
| `maxArrayLength` | `number`  | `100000`  | Max number of elements in an array, `Map`, or `Set` before an error is thrown.|

`maxDepth` and `maxArrayLength` are safety valves, not formatting knobs —
their defaults are high enough to never trigger on realistic data, but
guard against runaway output (e.g. an accidentally huge or deeply nested
structure) blowing up memory or hanging the process. Lower them if you're
serializing untrusted input.

## Behaviour notes

- Boxed primitives (`new String(...)`, `new Number(...)`, `new Boolean(...)`) are unwrapped.
- `Date` values are serialized via `toISOString()`.
- `Map` is serialized as an array of `[key, value]` pairs, e.g. `new Map([['a', 1]])` → `[["a",1]]`. This works for any key type, not just strings.
- `Set` is serialized as an array of its values, in iteration order.
- Any value with a `toJSON()` method delegates to it, same as `JSON.stringify`.
- `undefined`, functions, and symbols are dropped from objects and turned into `null` in arrays — same behaviour as `JSON.stringify`.
- Cyclic references throw, instead of silently truncating.
- Typed arrays (`Uint8Array`, etc.) throw, since they have no JSON representation.
- `bigint` throws, since JSON has no integer type for it.
- Nesting deeper than `maxDepth`, or arrays/Maps/Sets longer than `maxArrayLength`, throw.

## Why not just `util.inspect`?

`util.inspect` output is meant for humans reading a terminal, not for
tools that need to re-parse the result. `jspp` is for the times you want
both at once: a JSON log line you can pipe to `jq`, a snapshot file you
can diff, a debug dump you can copy back into a test fixture — without
giving up readable line-wrapping and color.

## Development

```sh
git clone git@github.com:AxFab/jspp.git
cd jspp
npm install
npm test          # run the test suite
npm run lint      # typecheck (tsc --noEmit)
npm run build     # emit dist/ (ESM + CJS + types)
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full workflow.

## License

MIT — see [LICENSE](./LICENSE).
