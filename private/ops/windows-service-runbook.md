# Windows Service Runbook

## Purpose

Run the umbrella-owned Feishu bridge through the private wrapper, not by invoking the skill daemon directly. The wrapper makes sure the private extension is built, loaded, and pointed at the right menu-route file before the skill service logic starts.

## Prerequisites

- Windows host with Node.js 20+ on `PATH`
- Git checkout of `feishu-umbrella`
- PowerShell access with `-ExecutionPolicy Bypass` available for local invocation
- `Claude-to-IM-skill` dependencies installed
- `CTI_HOME` config present, typically `%USERPROFILE%\.claude-to-im\config.env`
- private route config present as either:
  - `private\config\feishu-menu-routes.local.json`
  - or a custom file path via `CTI_PRIVATE_MENU_ROUTE_FILE`
- One Windows service manager available if you want persistent service install:
  - `WinSW.exe` preferred
  - `nssm.exe` acceptable

## Supported Entry Point

Use only:

```powershell
powershell -ExecutionPolicy Bypass -File .\private\runtime\bridge.ps1 ...
```

Do not use `Claude-to-IM-skill\scripts\daemon.ps1` directly for production operations. That bypasses the umbrella-owned extension wiring.

## Install Flow

From the umbrella repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\private\runtime\bridge.ps1 install-service
```

Notes:

- The underlying skill supervisor installs the Windows service as `ClaudeToIMBridge`.
- The install flow prompts for the current Windows user password so the service can run with the same profile that owns `CTI_HOME`, auth state, and local tool credentials.
- The wrapper sets:
  - `CTI_PRIVATE_EXTENSION_ENTRY`
  - `CTI_PRIVATE_MENU_ROUTE_FILE`
  - `CTI_HOME` if not already provided

## Start / Stop / Status / Logs

Start:

```powershell
powershell -ExecutionPolicy Bypass -File .\private\runtime\bridge.ps1 start
```

Stop:

```powershell
powershell -ExecutionPolicy Bypass -File .\private\runtime\bridge.ps1 stop
```

Status:

```powershell
powershell -ExecutionPolicy Bypass -File .\private\runtime\bridge.ps1 status
```

Logs:

```powershell
powershell -ExecutionPolicy Bypass -File .\private\runtime\bridge.ps1 logs 100
```

Uninstall service:

```powershell
powershell -ExecutionPolicy Bypass -File .\private\runtime\bridge.ps1 uninstall-service
```

## Runtime Files

Default `CTI_HOME`:

```text
%USERPROFILE%\.claude-to-im
```

Important paths under `CTI_HOME`:

- `logs\bridge.log`
- `runtime\status.json`
- `runtime\bridge.pid`

If WinSW is used, service-manager logs are also written under:

- `%USERPROFILE%\.claude-to-im\logs\bridge-service.log`

## How To Confirm The Private Extension Loaded

Check the bridge log:

```powershell
Select-String -Path "$env:USERPROFILE\.claude-to-im\logs\bridge.log" -Pattern "private settings loaded"
```

Expected line shape:

```text
[cti-extension] private settings loaded (env|local-json|base-env) from ...
```

That line confirms both:

- the umbrella private extension was imported
- the menu-route config source was resolved

## Health Checks

After `start`, confirm:

1. `bridge.ps1 status` reports the service or process as running
2. `runtime\status.json` has `"running": true`
3. `bridge.log` contains the private-extension load line
4. one known Feishu menu trigger reaches the expected webhook endpoint

## Troubleshooting

If the service fails immediately:

1. Run `bridge.ps1 logs 100`
2. Check `runtime\status.json` for `lastExitReason`
3. Confirm `CTI_PRIVATE_MENU_ROUTE_FILE` points at a valid JSON object
4. Confirm `private\cti-extension\dist\index.js` exists or rerun `bridge.ps1 start`
5. Confirm the configured Windows user still has access to `CTI_HOME` and any tool auth state
