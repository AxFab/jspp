# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-09-16

### Initial features

- `stringify()`: `JSON.stringify`-compatible output with `util.inspect`-style formatting (smart line wrapping via `breakLength`/`compact`, optional ANSI `colors`).
- Boxed primitives (`String`, `Number`, `Boolean`) unwrapped.
- `Date` serialized via `toISOString()`.
- `toJSON()` delegation, same as `JSON.stringify`.
- Cyclic-reference detection (throws instead of silently truncating).
- Typed arrays and `bigint` throw, since neither has a JSON representation.
- `maxDepth` option (default `1000`): throws once nesting exceeds this depth, as a guard against runaway or accidentally deep structures.
- `maxArrayLength` option (default `100000`): throws once an array, `Map`, or `Set` exceeds this many elements, as a guard against runaway output.
- Support for `Map`, serialized as an array of `[key, value]` pairs.
- Support for `Set`, serialized as an array of its values.

[Unreleased]: https://github.com/AxFab/jspp/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/AxFab/jspp/releases/tag/v0.1.0
