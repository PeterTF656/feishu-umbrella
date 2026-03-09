# feishu-umbrella

Private parent repository for local integration work around two forked upstream projects:

- `Claude-to-IM`
- `Claude-to-IM-skill`

## Layout

```text
feishu-umbrella/
  Claude-to-IM/         # submodule
  Claude-to-IM-skill/   # submodule
  private/              # parent-level private files
  WORKFLOW.md
```

## Intent

The child repos are treated as dependency repos by default. Put private code, notes, config, scripts, and glue logic in the parent repo. Only change a child repo intentionally by working inside that child repo directly.

## Typical Commands

```bash
git submodule status
git -C Claude-to-IM status -sb
git -C Claude-to-IM-skill status -sb
```

## Publishing

This repo is initialized locally. To publish it as a private GitHub repo later, create an empty private repository and push this parent repo to it.
