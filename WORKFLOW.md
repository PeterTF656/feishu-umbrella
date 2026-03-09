# Workflow

## Default Rule

Edit files in the parent repo by default. Treat both submodules as read-only unless you intentionally need to update one of the forked projects.

## Private Work

Keep private integration files in parent-level directories such as:

- `private/`
- `docs/`
- `scripts/`

These files belong to `feishu-umbrella`, not to either child repo.

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
