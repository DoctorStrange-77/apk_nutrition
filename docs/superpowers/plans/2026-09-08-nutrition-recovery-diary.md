# Nutrition + Recovery Diary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Nutrition + Recovery diary integrated with existing daily food records and Smart Insights.

**Architecture:** Extend `DiaryDay` with optional typed recovery and meal-feedback fields. Keep all computation in focused domain modules and use a dedicated `DiaryPanel` for editing/history; App owns date navigation and persistence through the existing snapshot.

**Tech Stack:** React, TypeScript, Vite, Vitest, existing local snapshot/SQLite layer, inline SVG/CSS.

**Spec:** `docs/superpowers/specs/2026-09-08-nutrition-recovery-diary-design.md`

## Global Constraints
- Storage is local-device only.
- Existing 1.2.0 diary data must remain readable.
- Copying food plans must never copy actual recovery or symptoms.
- No new chart dependency.
- No medication, pain, DOMS or illness tracking.
- All insight wording is associative, not causal.

---

### Task 1: Diary Types and Backward-Compatible Domain
**Files:** modify `src/types/nutrition.ts`, `src/domain/diary.ts`; test `src/domain/diary.test.ts`.
- [ ] Add typed recovery, bowel and meal-feedback interfaces.
- [ ] Add optional fields to DiaryDay.
- [ ] Make buildCurrentDiaryDay preserve current-day recovery/feedback.
- [ ] Make copyDiaryDay explicitly clear recovery/feedback.
- [ ] Test RED → GREEN and commit.

### Task 2: Diary Analytics and Smart Insights
**Files:** create `src/domain/diaryAnalytics.ts`, test `src/domain/diaryAnalytics.test.ts`.
- [ ] Daily macro adherence.
- [ ] 7/14/30-day series and rolling weight average.
- [ ] Recovery averages and digestive issue frequency.
- [ ] Bristol distribution.
- [ ] food/symptom association from meal feedback.
- [ ] evening-hunger and pre-workout digestion association when sample size is sufficient.
- [ ] Test RED → GREEN and commit.

### Task 3: Daily Diary Editor
**Files:** create `src/components/DiaryPanel.tsx`, modify `src/App.tsx`, `src/components/BottomNav.tsx`.
- [ ] Add Diario tab.
- [ ] Nutrition summary uses existing meals.
- [ ] Recovery/hunger/digestion editor.
- [ ] bowel-event editor with Bristol and preceding meals.
- [ ] per-meal feedback editor.
- [ ] notes and auto-save through App state.
- [ ] build/test and commit.

### Task 4: History, Charts and Insights UI
**Files:** create `src/components/DiaryCharts.tsx`, modify `DiaryPanel.tsx`, CSS.
- [ ] 7/14/30 range selector.
- [ ] weight + moving average chart.
- [ ] sleep/stress/energy and hunger charts.
- [ ] adherence/digestion summaries.
- [ ] Bristol distribution.
- [ ] Smart Insights cards.
- [ ] build/test and commit.

### Task 5: Integration Hardening and Release
**Files:** App/domain tests; release metadata only after full verification.
- [ ] Verify date switching preserves recovery.
- [ ] Verify copy-day does not copy recovery.
- [ ] Verify legacy snapshots.
- [ ] audit production, full tests, build, diff check.
- [ ] merge to main/develop and publish only when clean.
