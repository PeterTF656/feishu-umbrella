# Task Plan

## Goal

Design and implement private umbrella-owned Feishu card-button follow-up behavior so a menu response card can show the caller's user profile without breaking the current capability boundaries or modifying vendored submodules by default.

## Current Phase

Phase 2: Design and approval

## Phases

| Phase | Status | Notes |
| --- | --- | --- |
| 1. Requirements and architecture discovery | complete | Read architecture docs, current implementation, recent design docs, bridge logs, and SDK callback docs |
| 2. Design and approval | in_progress | Summarize runtime flow, compare implementation approaches, capture risks and open questions |
| 3. TDD red/green/refactor | pending | Add failing tests first, then implement the approved callback/profile-card flow |
| 4. Verification | pending | Run targeted tests and broader package verification for touched private extension code |
| 5. Delivery | pending | Report outcome with evidence and any residual risks |

## Key Questions

1. What callback/event path should own interactive card button handling in the existing private Feishu architecture?
2. Should the profile follow-up card be built from callback payload identity, stored state, or a fresh Contact lookup?
3. Can the feature remain entirely in `private/`, or is there a genuine missing seam in vendored code?

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Treat this as a new private umbrella feature, separate from the earlier route-level enrichment work | The current task adds interactive follow-up behavior after the initial menu result card |
| Keep the existing planning files and update them for the new task instead of creating duplicates | The repo already uses these files as persistent task context |
| Prefer a stateless follow-up profile flow keyed by callback actor identity plus a fresh Contact lookup | This reuses the existing Contact capability and avoids storing callback state unless future actions require correlation |

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| Planning skill catchup script path `/Users/zelinpu/.claude/plugins/planning-with-files/scripts/session-catchup.py` was missing in this environment | 1 | Read the existing planning files directly and continue with manual session recovery |
