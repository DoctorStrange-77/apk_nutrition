# Smart Nutrition Intelligence 1.0 Design

## Goal
Turn Smart Nutrition from a food logger/menu generator into an adaptive nutrition system that builds, explains, corrects and optimizes meals around the user's real day.

## Product principles
- Macro targets and timing remain hard constraints.
- Meals must be realistic, preparable and internally coherent.
- Features must work offline where possible.
- No fake live retailer inventory or prices. Retailer mode uses known product/store tags and user-entered package/price data.
- Existing diary, menus, recipes, preferences and Android data must remain readable.
- Open Food Facts remains the external product source.
- Smart Nutrition Core remains the curated generic food source.

## Scope

### 1. Smart Autopilot
Recalculate the unconsumed part of the day after a meal is changed, skipped or logged differently. Preserve completed meals and regenerate only the remainder.

### 2. Meal Architecture Engine
Generate meals from named archetypes before solving grams: bowl, rice/pasta plate, sandwich/wrap, shake, snack, yogurt bowl and savory plate. Architectures constrain incompatible combinations.

### 3. Smart Alternatives 2.0
Classify replacement options as equivalent, easier digestion, faster/no-cook, whole-food and lower-complexity. Alternatives keep meal context and macro fit.

### 4. Pantry / “What I have”
Persist pantry items with available grams, package size and optional price/store. Allow generation from pantry-first foods and show missing foods.

### 5. Zero Waste
Subtract planned consumption from pantry quantities and build a package-aware shopping list using package sizes.

### 6. Supermarket Mode
Persist preferred retailer/store. Boost products tagged for that store/brand. Never claim real-time stock unless a future retailer connector provides it.

### 7. Personal Food Intelligence
Learn lightweight preference scores from favorites, recent usage, replacements and explicit likes/dislikes. Use scores only as ranking boosts, never as hard macro constraints.

### 8. “Why this meal?”
Every generated meal exposes short deterministic reasons for each food and the meal architecture.

### 9. Nutrition Data Confidence
Every food receives a 0–100 confidence score and label based on source, macro completeness, source reference and plausibility checks.

### 10. Raw/Cooked Intelligence
Use existing nutritionWeightBasis/cookedWeightFactor fields. Provide raw↔cooked conversion helpers and UI labels. Never silently convert unless a factor exists.

### 11. Training-Aware Nutrition
Persist a training profile for the day: training/rest, clock time, duration and session type. Adapt meal timing context and carb placement while preserving daily totals.

### 12. Emergency Mode
Modes: low_time, outside_home, skipped_meal. Rebuild only remaining meals using constraints appropriate to the mode.

### 13. Adaptive Weekly Planner
Support per-day training context, variety target and template reuse. Reduce needless food churn across the week while keeping day targets.

### 14. Variety Control
Persist 0–100 variety. Low values deliberately reuse staples; high values increase rotation. The control affects ranking/rotation only.

### 15. Recipe Macro Solver
Given a recipe and target macros, optimize ingredient grams inside practical min/max bounds and return a solved recipe plus residuals.

## UI
Add a new “Smart” tab to the bottom navigation. The Smart Intelligence panel is the central place for Autopilot, training context, emergency mode, pantry, retailer, variety and explanations. Recipe solver stays in the recipe editor. Data confidence/raw-cooked metadata appear in food detail and generated meal context.

## Persistence
Extend NutritionAppSnapshot with:
- smartSettings
- pantryItems
- foodPreferenceSignals
- dailyTrainingContexts

All fields are optional for backward compatibility.

## Testing
Each domain module gets deterministic Vitest coverage. Existing tests must remain green. Add integration tests for residual-day autopilot, architecture realism, pantry/zero-waste, confidence scoring, raw/cooked conversion, training-aware timing, emergency modes, variety ranking and recipe solver.
