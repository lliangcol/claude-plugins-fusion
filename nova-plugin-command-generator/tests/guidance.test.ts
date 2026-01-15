import { describe, expect, it, beforeEach } from 'vitest';
import { manifest } from '../src/data/manifest';
import {
  applyGuidanceUpdate,
  buildCommandStageMap,
  createDefaultGuidanceState,
  recommendNext,
} from '../src/utils/guidance';
import { loadGuidanceState, saveGuidanceState } from '../src/store/guidance';

const createMemoryStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

describe('guidance mapping', () => {
  it('maps known commands to stages', () => {
    const map = buildCommandStageMap(manifest.commands);
    expect(map['senior-explore']).toBe('explore');
    expect(map['plan-lite']).toBe('plan');
    expect(map['review-strict']).toBe('review');
    expect(map['implement-plan']).toBe('implement');
    expect(map['finalize-work']).toBe('finalize');
  });
});

describe('recommendNext', () => {
  it('recommends explore as the initial stage', () => {
    const state = createDefaultGuidanceState();
    const next = recommendNext(state);
    expect(next.stage).toBe('explore');
    expect(next.command).toBe('senior-explore');
  });

  it('moves to plan after explore is done', () => {
    const state = applyGuidanceUpdate(createDefaultGuidanceState(), 'senior-explore', 'explore', 1);
    const next = recommendNext(state);
    expect(next.stage).toBe('plan');
    expect(next.command).toBe('plan-lite');
  });

  it('uses workflow context for Java backend plans', () => {
    const state = applyGuidanceUpdate(createDefaultGuidanceState(), 'senior-explore', 'explore', 1);
    const next = recommendNext(state, { workflowTemplate: 'Java backend' });
    expect(next.stage).toBe('plan');
    expect(next.command).toBe('backend-plan');
  });
});

describe('guidance persistence', () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: Storage }).localStorage = createMemoryStorage() as unknown as Storage;
  });

  it('serializes and deserializes guidance state', () => {
    const state = applyGuidanceUpdate(createDefaultGuidanceState(), 'senior-explore', 'explore', 123);
    saveGuidanceState(state);
    const loaded = loadGuidanceState();
    expect(loaded.last?.command).toBe('senior-explore');
    expect(loaded.stageStatus.explore).toBe('done');
    expect(loaded.stageStatus.plan).toBe('active');
  });
});
