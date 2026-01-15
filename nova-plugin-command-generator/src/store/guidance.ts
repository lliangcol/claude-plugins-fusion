import { GuidanceState, StageKey } from '../types';
import { applyGuidanceUpdate, createDefaultGuidanceState } from '../utils/guidance';

const KEY = 'command-generator-guidance';

export const loadGuidanceState = (): GuidanceState => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return createDefaultGuidanceState();
    const parsed = JSON.parse(raw) as GuidanceState;
    if (!parsed || typeof parsed !== 'object') return createDefaultGuidanceState();
    return {
      stageStatus: parsed.stageStatus ?? createDefaultGuidanceState().stageStatus,
      history: Array.isArray(parsed.history) ? parsed.history : [],
      last: parsed.last ?? null,
    };
  } catch {
    return createDefaultGuidanceState();
  }
};

export const saveGuidanceState = (state: GuidanceState) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
};

export const recordGuidanceSuccess = (command: string, stage: StageKey, ts = Date.now()) => {
  const current = loadGuidanceState();
  const next = applyGuidanceUpdate(current, command, stage, ts);
  saveGuidanceState(next);
  return next;
};
