# Smart Nutrition — Nutrition + Recovery Diary Design

## Goal
Add a fully local daily diary that combines actual nutrition already stored in DiaryDay with recovery, hunger, digestive and bowel feedback. The diary must feed local Smart Insights without duplicating food entries.

## Storage
- Local device only for this release.
- Extend existing DiaryDay with optional recovery and mealFeedback fields.
- Existing DiaryDay records from 1.2.0 remain valid without migration.
- Keep the shape synchronization-friendly so a future Supabase layer can mirror one diary record per date.
- Copying a nutrition day to another date must NOT copy recovery, bowel events or meal feedback.

## Daily Recovery
Optional DailyRecoveryLog:
- morningWeightKg
- waterLiters
- sleepHours
- sleepQuality 1–10
- stressLevel 1–10
- energyLevel 1–10
- steps
- hungerMorning 1–10
- hungerAfternoon 1–10
- hungerEvening 1–10
- satietyLevel 1–10
- cravingLevel 1–10
- digestionQuality: light | normal | heavy
- bloatingLevel 0–10
- reflux
- abdominalDiscomfort
- sleepiness
- brainFog
- bowelMovements[]
- notes

BowelMovement:
- id
- bristolType 1–7
- timestamp
- precedingMealIds[]

## Meal Feedback
Optional record keyed by meal id:
- hungerBefore 1–10
- satietyAfter 1–10
- digestionQuality light | normal | heavy
- bloatingLevel 0–10
- reflux
- sleepiness
- brainFog
- notes

## UI
Add a primary bottom-nav tab "Diario" between Oggi and Smart.

Diary screen sections:
1. date navigation and daily nutrition summary (actual vs target + adherence)
2. Recovery: morning weight, water, steps, sleep, sleep quality, stress, energy
3. Hunger: morning/afternoon/evening hunger, satiety, craving
4. Digestion: digestion quality, bloating, reflux, abdominal discomfort, sleepiness, brain fog
5. Bowel: multiple events per day with Bristol 1–7 and optional preceding meals
6. Meal feedback cards based on the meals already present in DiaryDay
7. Notes
8. History / charts for 7, 14 and 30 days
9. Smart Insights

## Smart Insights
All insights are deterministic and local. Initial rules:
- weight 7-day moving average and change
- average sleep, stress, energy, hunger, digestion issue frequency
- adherence from actual macro diary
- recurring food association with digestive symptoms from meal feedback
- evening hunger vs percentage of daily intake consumed before/after later meals where enough data exists
- pre-workout high-fat meal association with heavy digestion when enough observations exist
- no causal claims; use wording like "associato", "osservato", "segnale".

## Charts
Use lightweight inline SVG / CSS only; no new chart dependency.
Charts:
- weight trend with 7-day moving average
- sleep / stress / energy
- hunger evening
- macro adherence
- digestion/bloating trend
- Bristol distribution

## Integration
- Use current activeDiaryDate.
- Use existing dailyTrainingContexts; do not duplicate training data.
- Smart Intelligence may later consume insights, but this version only computes and displays them.
- ProgressPanel should eventually read diary morningWeightKg instead of requiring duplicate weigh-ins; for this release preserve existing check-in behavior but expose a migration path.

## Exclusions
No medications, pain, DOMS, illness tracking or coach-only fields.
No Supabase synchronization in this release.
No Health Connect changes in this release.
