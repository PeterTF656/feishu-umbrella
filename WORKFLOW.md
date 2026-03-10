# Workflow

## Default Rule

Edit files in the parent repo by default. Treat both submodules as read-only unless you intentionally need to update one of the forked projects.

Primary architecture reference:

- `docs/architecture/private-umbrella-architecture.md`

## Private Work

Keep private integration files in parent-level directories such as:

- `private/`
- `docs/`
- `scripts/`

These files belong to `feishu-umbrella`, not to either child repo.

## Production Entry Point

Use one supported production entry point only:

- macOS or Linux: `bash private/runtime/bridge.sh ...`
- Windows: `powershell -ExecutionPolicy Bypass -File .\private\runtime\bridge.ps1 ...`

Those wrappers are responsible for:

- building `private/cti-extension` when needed
- setting `CTI_PRIVATE_EXTENSION_ENTRY`
- setting `CTI_PRIVATE_MENU_ROUTE_FILE`
- delegating to the skill daemon scripts

Raw `Claude-to-IM-skill/scripts/daemon.*` commands are development-only. Do not use them directly for production service operations because they bypass the umbrella-owned private extension wiring.

## Working With Submodules

Inspect child repos:

```bash
git -C Claude-to-IM status -sb
git -C Claude-to-IM-skill status -sb
```

Update a child repo intentionally:

```bash
git -C Claude-to-IM pull --ff-only
git -C Claude-to-IM-skill pull --ff-only
```

Record a submodule pointer update in the parent repo:

```bash
git add Claude-to-IM Claude-to-IM-skill
git commit -m "chore: update submodule pointers"
```

## Guardrail

If you find yourself editing files under `Claude-to-IM/` or `Claude-to-IM-skill/`, stop and decide whether that change belongs in the child repo instead of the parent repo.
