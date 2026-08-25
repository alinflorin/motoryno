# Vendored from @cardog/corgi

`decode.ts`, `pattern.ts`, `db.ts`, `db/adapter.ts`, `types.ts`, `enums.ts` and
`logger.ts` are copied unmodified from
[cardog-ai/corgi](https://github.com/cardog-ai/corgi) (`lib/`), ISC-licensed
(see `LICENSE`).

corgi's own npm package only targets Node.js, browsers, and Cloudflare
Workers - none of which is React Native - because its published entry point
(`lib/index.ts`) wires in Node/browser/D1-specific database adapters and a
Node-only `getDatabasePath` helper (gzip decompression via `zlib`, cache
directory via `os.homedir()`, etc). The files vendored here are the actual
decode logic underneath that: they only depend on the `DatabaseAdapter`
interface (`exec(sql, params)` / `close()`), with no Node built-ins, so they
run unchanged against our own `expo-sqlite`-backed adapter - see
`../expoSqliteAdapter.ts` and `../database.ts`.

The database itself (`assets/data/vpic.lite.db.gz`) is corgi's own public
`vpic.lite.db` build (NHTSA vPIC data), downloaded from their CDN
(`https://corgi.cardog.io/vpic.lite.db.gz`).

**Do not hand-edit these files.** To pick up a corgi update, re-download
`lib/{decode,pattern,db,types,enums,logger}.ts` and `lib/db/adapter.ts` from
their `master` branch and re-apply the vendoring header comment.
