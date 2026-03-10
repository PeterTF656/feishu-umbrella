# Pre-Live Checklist

## Config

- `CTI_HOME\config.env` exists on the target Windows host.
- `private\config\feishu-menu-routes.local.json` exists or `CTI_PRIVATE_MENU_ROUTE_FILE` is set explicitly.
- The route JSON is a top-level object and every enabled route has the expected target URL.

## Service Install

- `powershell -ExecutionPolicy Bypass -File .\private\runtime\bridge.ps1 install-service` completed successfully.
- `ClaudeToIMBridge` is visible in Windows Services.
- The service account is the intended operator account, not `LocalSystem`.

## Startup

- `powershell -ExecutionPolicy Bypass -File .\private\runtime\bridge.ps1 start` succeeds.
- `powershell -ExecutionPolicy Bypass -File .\private\runtime\bridge.ps1 status` reports the process as running.
- `bridge.log` contains the private-extension load line.

## Functional Smoke

- Trigger one known Feishu menu key that should hit a safe webhook endpoint.
- Confirm the webhook received the expected `event_key`, `event_id`, and operator fields.
- Confirm the Feishu operator receives the pending notification and the final success or failure notification.

## Restart Verification

- Stop the service.
- Start it again.
- Confirm the same smoke trigger still works after restart.

## Overnight Soak

- Leave the service up overnight or for a multi-hour window.
- Review `bridge.log` and `runtime\status.json` the next morning.
- Check for repeated restarts, stale PID records, or unexpected adapter failures.

## Heartbeat / Status Review

- Confirm the service remains in `Running` state in Windows Services.
- Confirm `runtime\status.json` still updates as expected for the bridge lifecycle.
- Review the most recent `bridge.ps1 logs 100` output for warnings.

## Rollback

- Keep the previous deployment copy available.
- Record the current submodule SHAs before go-live.
- If the live deployment misbehaves, stop the service, restore the previous umbrella checkout or route config, and start the service again through `private\runtime\bridge.ps1`.
