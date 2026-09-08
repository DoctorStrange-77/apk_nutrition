# Smart Nutrition Intelligence 1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all fifteen Smart Nutrition premium intelligence capabilities as one backward-compatible release.

**Architecture:** Add small deterministic domain modules under `src/domain/intelligence/` and persist their state through `NutritionAppSnapshot`. Reuse the existing Nutrition Engine for macro solving; intelligence modules filter/rank inputs, compute residual targets, add explanations and manage pantry/training/variety context instead of duplicating the solver.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Capacitor, local SQLite/IndexedDB, existing Nutrition Engine.

**Spec:** `docs/superpowers/specs/2026-09-08-smart-nutrition-intelligence-1.0-design.md`

## Global Constraints
- Preserve existing Android app ID `com.builderstrength.nutrition`.
- Preserve existing diary, recipe, menu and user data.
- Open Food Facts remains the only external commercial product source.
- Do not claim real-time retailer stock or prices.
- Macro targets and timing remain hard constraints.
- New snapshot fields must be optional for backward compatibility.
- No new charting or state-management dependency.

---

### Task 1: Intelligence Types and Persistence

**Files:**
- Modify: `src/types/nutrition.ts`
- Modify: `src/App.tsx`
- Test: `src/domain/intelligence/intelligenceState.test.ts`

**Interfaces:**
- Produces `SmartNutritionSettings`, `PantryItem`, `FoodPreferenceSignal`, `TrainingContext`, `EmergencyMode`, `MealArchitectureId`.
- Snapshot fields: `smartSettings?`, `pantryItems?`, `foodPreferenceSignals?`, `dailyTrainingContexts?`.

- [ ] **Step 1: Write failing snapshot-default test** covering missing legacy fields.
- [ ] **Step 2: Run** `npm test -- src/domain/intelligence/intelligenceState.test.ts` and verify RED.
- [ ] **Step 3: Add types and default constructors**:
  `defaultSmartNutritionSettings(): SmartNutritionSettings`,
  `normalizeSmartNutritionSettings(value): SmartNutritionSettings`.
- [ ] **Step 4: Wire load/save in App snapshot persistence.**
- [ ] **Step 5: Run test and commit.**

### Task 2: Data Confidence and Raw/Cooked Intelligence

**Files:**
- Create: `src/domain/intelligence/dataConfidence.ts`
- Create: `src/domain/intelligence/rawCooked.ts`
- Test: `src/domain/intelligence/dataConfidence.test.ts`
- Test: `src/domain/intelligence/rawCooked.test.ts`
- Modify: `src/components/FoodEditorModal.tsx`

**Interfaces:**
- `scoreFoodDataConfidence(food: LocalFood): { score:number; label:'alta'|'media'|'bassa'; reasons:string[] }`
- `convertFoodWeight(food, grams, from:'raw'|'cooked', to:'raw'|'cooked'): number | null`

- [ ] **Step 1: Add tests for Core/OFF/manual confidence and missing conversion factor.**
- [ ] **Step 2: Run tests RED.**
- [ ] **Step 3: Implement confidence scoring and raw/cooked conversions.**
- [ ] **Step 4: Show confidence badge and raw/cooked status in food detail.**
- [ ] **Step 5: Run tests and commit.**

### Task 3: Meal Architecture, Smart Alternatives and Explanations

**Files:**
- Create: `src/domain/intelligence/mealArchitecture.ts`
- Create: `src/domain/intelligence/mealExplain.ts`
- Modify: `src/engine/nutritionEngine.ts`
- Modify: `src/types/nutrition.ts`
- Test: `src/domain/intelligence/mealArchitecture.test.ts`

**Interfaces:**
- `selectMealArchitecture(tag, workoutTiming, foods): MealArchitectureId`
- `architectureAllowsFood(architecture, food, existingFoods): boolean`
- Add optional `architecture?`, `explanations?` to `GeneratedMeal`.
- Add optional `reason?`, `kind?` to `GeneratedFoodAlternative`, where kind is `equivalent|easy_digest|fast|no_cook|whole_food`.

- [ ] **Step 1: Test realistic archetypes and forbidden powder/savory mixes.**
- [ ] **Step 2: Run RED.**
- [ ] **Step 3: Implement archetype selection/filtering and alternative classification.**
- [ ] **Step 4: Attach deterministic meal/food explanations.**
- [ ] **Step 5: Run engine regression tests and commit.**

### Task 4: Autopilot, Training-Aware and Emergency Modes

**Files:**
- Create: `src/domain/intelligence/autopilot.ts`
- Create: `src/domain/intelligence/trainingAware.ts`
- Test: `src/domain/intelligence/autopilot.test.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- `rebalanceRemainingDay({ menu, completedMealIndexes, actualCompletedMacros, timing, foods, target, emergencyMode, trainingContext, variety }): GeneratedMenu`
- `deriveTrainingAwareTiming(timing, context): TimingTemplate`
- `filterFoodsForEmergency(foods, mode): LocalFood[]`

- [ ] **Step 1: Test preserved completed meals and residual macro regeneration.**
- [ ] **Step 2: Test low-time/outside/skipped-meal filters and training total preservation.**
- [ ] **Step 3: Implement residual macro math and regenerate only remaining meals.**
- [ ] **Step 4: Wire actions into Smart panel state.**
- [ ] **Step 5: Run tests and commit.**

### Task 5: Pantry, Zero Waste and Supermarket Mode

**Files:**
- Create: `src/domain/intelligence/pantry.ts`
- Test: `src/domain/intelligence/pantry.test.ts`
- Create: `src/components/SmartPantryPanel.tsx`

**Interfaces:**
- `pantryAvailableFoods(pantry, foods): LocalFood[]`
- `consumePantryForMenu(pantry, menu): PantryItem[]`
- `buildPackageAwareShoppingList(menuOrWeek, pantry): PackageShoppingItem[]`
- `rankFoodsForRetailer(foods, retailer): LocalFood[]`

- [ ] **Step 1: Test pantry-first filtering, package rounding and no fake stock.**
- [ ] **Step 2: Run RED.**
- [ ] **Step 3: Implement pantry math and retailer ranking.**
- [ ] **Step 4: Add pantry editor with grams/package/store/optional price.**
- [ ] **Step 5: Run tests and commit.**

### Task 6: Personal Food Intelligence and Variety Control

**Files:**
- Create: `src/domain/intelligence/personalFoodIntelligence.ts`
- Test: `src/domain/intelligence/personalFoodIntelligence.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/engine/nutritionEngine.ts`

**Interfaces:**
- `updateFoodSignal(signals, foodId, event:'use'|'favorite'|'replace_in'|'replace_out'|'like'|'dislike'): FoodPreferenceSignal[]`
- `preferenceScore(foodId, signals): number`
- `rankFoodsByIntelligence(foods, signals, variety, recentFoodIds): LocalFood[]`

- [ ] **Step 1: Test repeated replacements and variety extremes.**
- [ ] **Step 2: Run RED.**
- [ ] **Step 3: Implement bounded scoring and ranking.**
- [ ] **Step 4: Hook favorites/replacements/generated usage into signals.**
- [ ] **Step 5: Run regression tests and commit.**

### Task 7: Adaptive Weekly Planner

**Files:**
- Modify: `src/types/nutrition.ts`
- Modify: `src/domain/weeklyPlanner.ts`
- Modify: `src/components/WeeklyPlannerPanel.tsx`
- Test: `src/domain/weeklyPlanner.test.ts`

**Interfaces:**
- Add optional per-day `trainingContext`.
- Add planner options `variety`, `templateReuse`, `pantryFirst`.
- Reuse prior-day meal architectures at low variety while preserving day macro/timing.

- [ ] **Step 1: Test training/rest mixed week and low-variety reuse.**
- [ ] **Step 2: Run RED.**
- [ ] **Step 3: Extend planner config and generation inputs.**
- [ ] **Step 4: Expose controls in weekly UI.**
- [ ] **Step 5: Run tests and commit.**

### Task 8: Recipe Macro Solver

**Files:**
- Create: `src/domain/intelligence/recipeSolver.ts`
- Test: `src/domain/intelligence/recipeSolver.test.ts`
- Modify: `src/components/RecipeEditorModal.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- `solveRecipeToTarget(recipe, target): { recipe:Recipe; actual:MacroTarget; residuals:MacroTarget; status:'solved'|'best_feasible' }`

- [ ] **Step 1: Test pancake-style recipe convergence and practical gram bounds.**
- [ ] **Step 2: Run RED.**
- [ ] **Step 3: Implement coordinate-search solver using ingredient macro densities.**
- [ ] **Step 4: Add target C/P/F fields and “Ottimizza ricetta” UI.**
- [ ] **Step 5: Run tests and commit.**

### Task 9: Smart Intelligence UI

**Files:**
- Create: `src/components/SmartIntelligencePanel.tsx`
- Modify: `src/components/BottomNav.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles-v07.css`

**Interfaces:**
- New tab `smart`.
- Panel consumes settings, training context, pantry, menu, target and callbacks.
- Sections: Autopilot, Training, Emergency, Pantry, Supermarket, Variety, What-I-have, Why-this-meal.

- [ ] **Step 1: Add Smart tab and panel rendering.**
- [ ] **Step 2: Wire all domain actions and persistent controls.**
- [ ] **Step 3: Add responsive premium styling with no new dependency.**
- [ ] **Step 4: Build and manually inspect desktop/mobile layout.**
- [ ] **Step 5: Commit.**

### Task 10: Full Verification and Release

**Files:**
- Modify: `package.json`
- Modify: `public/sw.js`
- Modify: `src/components/BetaAccessGate.tsx`

- [ ] **Step 1:** bump release version and PWA cache.
- [ ] **Step 2:** run `npm audit --omit=dev --audit-level=high`.
- [ ] **Step 3:** run `npm test`.
- [ ] **Step 4:** run `npm run build` and `git diff --check`.
- [ ] **Step 5:** selective commit, push `main`, align `develop`, verify Vercel/GitHub Actions, install APK if Samsung is connected.
