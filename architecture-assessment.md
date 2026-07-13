# Open-MCAT Architecture Assessment

## Current Architecture

Open-MCAT is a static GitHub Pages-compatible app with two HTML files:

- `index.html`: landing page, live sample question, theme persistence.
- `app.html`: single-file application containing styles, question data, navigation, quiz flow, formula drills, schedules, resources, analytics, and local persistence.

There is no build step, backend, package manager, or framework. The application depends on browser APIs only.

## Data Schema

The canonical question bank is the `BANK` array in `app.html`. Each testable idea contains section/category metadata and a `questions` array. Current question fields are:

- idea level: `id`, `section`, `sectionCode`, `category`, `categoryCode`, `idea`
- question level: `tag`, `stem`, `choices`, `answer`, `rationale`, `why`, `takeaway`

Baseline audit: 284 testable ideas, 1,274 questions, 57 section/category groupings, and no malformed existing choice/rationale sets detected.

## Routing And UI Flow

Routing is in-memory through `state.view`, with optional hash bootstrapping for resources, schedules, Anki, and drills. Quiz navigation is handled by `go`, `renderQuiz`, `doSubmit`, `doNext`, and `renderResults`. There are no persistent URLs for individual questions beyond the static app URL.

The visual system is embedded CSS: near-monochrome, dark by default, low glare, compact tables, restrained cards/panels, and keyboard-first controls.

## Persistence Model

Existing progress is stored directly in localStorage through `store` helpers:

- `omcat_theme`
- `omcat_prog_v2`
- `omcat_stats`
- `omcat_streak`
- `omcat_flags`
- `omcat_plan`

Before Phase 1, progress stores only quiz-level summaries and best attempts. It does not store normalized question attempts, confidence, timing, answer changes, error categories, or schema versions.

## Risks And Technical Debt

- The app is a large single HTML file, so broad refactors carry high regression risk.
- Quiz questions are reshuffled on every render; attempt recording must use the rendered/shuffled item state, not source indexes.
- Existing progress must remain readable. New learner state should live beside legacy keys and migrate summaries without deleting data.
- Current mastery is best-score percentage. Replacing it needs a transparent model while preserving simple list/sidebar semantics.
- Static deployment and no-dependency operation are core product constraints.

## Phase Plan

1. Add a versioned learner-state model and safe localStorage wrapper.
2. Record normalized attempts with confidence, timing, answer-change, hierarchy, concept tags, difficulty, due-review, and question version fields.
3. Keep legacy quiz progress summaries in sync for backward compatibility.
4. Replace mastery displays with a confidence-aware evidence estimate.
5. Add tests for migration, corrupted storage recovery, validation, and mastery scoring.
6. Build later phases as vertical slices: error journal, spaced review, weakness map, adaptive practice, timing analytics, concept graph, dashboard, and calibration.
