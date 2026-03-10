# Private Runtime

Use these wrappers as the supported entrypoints for the Feishu umbrella deployment:

- `private/runtime/bridge.sh`
- `private/runtime/bridge.ps1`

They do three things before handing off to the skill daemon:

1. build `private/cti-extension` if `dist/index.js` is missing or stale
2. sync `private/config/runtime.env.local` into `CTI_HOME/config.env` when that private runtime file exists
3. set `CTI_PRIVATE_EXTENSION_ENTRY` to the built private extension
4. set `CTI_PRIVATE_MENU_ROUTE_FILE` to the local menu-route file unless you already provided an override

Commands are passed through to the underlying skill daemon:

```bash
bash private/runtime/bridge.sh start
bash private/runtime/bridge.sh status
bash private/runtime/bridge.sh logs 100
bash private/runtime/bridge.sh stop
```

```powershell
powershell -ExecutionPolicy Bypass -File .\private\runtime\bridge.ps1 start
powershell -ExecutionPolicy Bypass -File .\private\runtime\bridge.ps1 status
powershell -ExecutionPolicy Bypass -File .\private\runtime\bridge.ps1 logs 100
powershell -ExecutionPolicy Bypass -File .\private\runtime\bridge.ps1 stop
```

Override the menu route file by setting `CTI_PRIVATE_MENU_ROUTE_FILE` before invoking the wrapper. Relative override paths are resolved from `private/cti-extension/`.

Credential/config file support:

- tracked template: `private/config/runtime.env.example`
- private local file: `private/config/runtime.env.local`

The local file uses normal `.env` syntax. For convenience the sync step also accepts lines in the form `- KEY=VALUE`.
