# AI Kanban Refactor Roadmap

This repository contains an experimental AI-assisted Kanban board. The current priority is to untangle the large `App.js` file so that the React entry point only coordinates state and rendering, while dedicated modules encapsulate prompts, analytics, and storage concerns.

## Why restructure `App.js`?
* Improve readability by separating configuration, AI prompt schemas, metrics, and UI.
* Allow future iterations (e.g. richer prompt orchestration, task dependency reasoning) to evolve independently.
* Reduce merge conflicts by keeping responsibilities isolated.

## Step-by-step plan
1. **Create foundational modules**
   * Extract utility helpers (date formatting, cloning, etc.).
   * Move static constants such as app modes, column colours, and task point weights.
   * Publish default board data from a dedicated data module.
2. **Isolate AI integration**
   * Relocate DeepSeek configuration, schema definitions, and the `generatePatch` service into a `/services` directory.
   * Prepare a future `/prompts` folder so that different prompt versions can coexist without touching the entry point.
3. **Split analytic logic**
   * Place metrics, insights, and chart data builders into `/logic` files so that task-level calculations can be unit tested later.
4. **Modularise UI components**
   * Keep pure presentational components under `src/components` and move the world info setup wizard into its own file.
   * Ensure `App.js` only wires state, handlers, and props.
5. **Progressive enhancements** (future work)
   * Add prompt variants per task level (Epic/Story/Task) once the prompt module is ready.
   * Introduce dependency resolution helpers to score and visualise blockers.
   * Layer in scenario-based simulations (e.g. WIP limit tuning) without modifying `App.js`.

This plan turns `App.js` into a lean entry point and lays the groundwork for future AI prompt experiments.
