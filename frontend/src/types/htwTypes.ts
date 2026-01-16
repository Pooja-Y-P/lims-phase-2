// src/types/htwTypes.ts

// --- SHARED ---
export interface ReadingRow {
  readings: (number | string)[]; // Allow string for input handling, convert to number for API
}

// --- SECTION A: REPEATABILITY ---
export interface RepeatabilityStep extends ReadingRow {
  step_percent: number;
}

export interface RepeatabilityResult {
  step_percent: number;
  mean_xr: number;
  deviation_percent: number;
  corrected_mean?: number;
}

export interface RepeatabilityPayload {
  job_id: number;
  steps: { step_percent: number; readings: number[] }[];
}

// --- SECTION B: REPRODUCIBILITY ---
export interface ReproducibilitySequence extends ReadingRow {
  sequence_no: number;
}

export interface ReproducibilityPayload {
  job_id: number;
  sequences: { sequence_no: number; readings: number[] }[];
}

// --- SECTIONS C, D, E: VARIATIONS ---
// These 3 share a very similar structure
export interface VariationItem extends ReadingRow {
  // We use a union type or optional properties because different sections name the position column differently
  position_deg?: number;       // For Drive Interface & Output Drive
  loading_position_mm?: number; // For Loading Point
}

export interface VariationPayload {
  job_id: number;
  items: any[]; // Kept loose or define specific payloads per section
}