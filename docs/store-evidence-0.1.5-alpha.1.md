# Store evidence — install / start / uninstall on `@deepseek-ai/dsh@0.1.5-alpha.1`

Captured 2026-09-09 by `scripts/store-evidence.mjs 0.1.5-alpha.1` (reproducible).

Method: a **disposable profile** under a fresh temp `$DSH_HOME` was bootstrapped with
`@deepseek-ai/dsh@0.1.5-alpha.1` (the exact pinned CLI version) + the matching
`@deepseek-ai/dsh-base` / `@deepseek-ai/dsh-web-app` bundles. The plugin tarball
(`dsh-achievements-0.2.0.tgz`) was installed into that profile, the composed config was
checked, the web app was booted headless until it listened, then the plugin was removed
and the disposable profile deleted. Nothing touched the real `web` profile.

## Result: PASSED

```
[evidence] npm pack
[evidence] bootstrap disposable profile with @deepseek-ai/dsh-web-app@0.1.5-alpha.1
[evidence] install plugin tarball
[evidence] composed config
  name: dsh-achievements            ← entry present with plugin-owned id `dsh-achievements`
[evidence] boot web headless on dsh@0.1.5-alpha.1
dsh web: http://127.0.0.1:52268/?token=…   ← server reached the listening state
[evidence] uninstall plugin + remove disposable profile
[evidence] OK: install/start/uninstall passed on @deepseek-ai/dsh@0.1.5-alpha.1
```

## Why this run matters

The first fixed-commit run against 0.1.5-alpha.1 failed at host import:

```
The requested module '@deepseek-ai/dsh-settings' does not provide an export named 'settingsNamespace'
```

Newer DSH releases removed the `settingsNamespace()` branding helper (namespaces became plain
strings). dsh-achievements now brands the namespace through a compatibility shim
(`src/index.ts` and the shipped `lib/index.js`): when the helper is present it is used,
otherwise an identity fallback applies — one code path across the rc and alpha release
lines. After the shim, the disposable-profile boot reached a listening state with the
plugin installed, and uninstall completed cleanly.

## Scope of this evidence

- Verified: package install, composed-config presence, host entry load, web-app start
  (listening), plugin uninstall — all on the exact official `@deepseek-ai/dsh@0.1.5-alpha.1`.
- Not covered by a headless run: browser-side rendering of the client plugin and the
  settings-page panel. Those ride the standard web client bundle path and are exercised in
  interactive use; declare client-only behaviour as `unknown` until browser-tested on this
  release line.
- This is disposable-profile evidence (store "partial" class), not a full security audit.
