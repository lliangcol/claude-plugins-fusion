import { CommandDefinition, GuidanceContext, GuidanceRecommendation, GuidanceState, StageKey, StageStatus } from '../types';

export const stageFlow: StageKey[] = ['explore', 'plan', 'review', 'implement', 'finalize'];

export const buildCommandStageMap = (commands: CommandDefinition[]) =>
  commands.reduce<Record<string, StageKey>>((acc, cmd) => {
    acc[cmd.id] = cmd.stage;
    return acc;
  }, {});

export const createDefaultGuidanceState = (): GuidanceState => ({
  stageStatus: {
    explore: 'active',
    plan: 'todo',
    review: 'todo',
    implement: 'todo',
    finalize: 'todo',
  },
  history: [],
  last: null,
});

const normalizeStageStatus = (status?: Partial<Record<StageKey, StageStatus>>) => ({
  explore: status?.explore ?? 'active',
  plan: status?.plan ?? 'todo',
  review: status?.review ?? 'todo',
  implement: status?.implement ?? 'todo',
  finalize: status?.finalize ?? 'todo',
});

const stageLabel: Record<StageKey, string> = {
  explore: '探索',
  plan: '规划',
  review: '评审',
  implement: '实施',
  finalize: '交付',
};

const defaultCommandsByStage: Record<StageKey, string[]> = {
  explore: ['senior-explore', 'explore-lite'],
  plan: ['plan-lite', 'produce-plan'],
  review: ['review-lite', 'review-only', 'review-strict'],
  implement: ['implement-standard', 'implement-plan', 'implement-lite'],
  finalize: ['finalize-work', 'finalize-lite'],
};

const selectCommandForStage = (stage: StageKey, context?: GuidanceContext) => {
  if (context?.workflowTemplate === 'workflow-d') {
    if (stage === 'plan') return 'backend-plan';
  }
  return defaultCommandsByStage[stage][0];
};

export const recommendNext = (state: GuidanceState, context?: GuidanceContext): GuidanceRecommendation => {
  const normalized = { ...state, stageStatus: normalizeStageStatus(state.stageStatus) };
  const activeStage = stageFlow.find((stage) => normalized.stageStatus[stage] === 'active');
  const targetStage = activeStage ?? stageFlow.find((stage) => normalized.stageStatus[stage] !== 'done') ?? 'finalize';
  const command = selectCommandForStage(targetStage, context);
  const reason = activeStage
    ? `根据当前进行阶段，建议继续${stageLabel[targetStage]}。`
    : `下一步建议进入${stageLabel[targetStage]}。`;
  const severity = targetStage === 'review' ? 'warning' : undefined;
  return { stage: targetStage, command, reason, severity };
};

export const applyGuidanceUpdate = (state: GuidanceState, command: string, stage: StageKey, ts: number): GuidanceState => {
  const normalized = { ...state, stageStatus: normalizeStageStatus(state.stageStatus) };
  const historyEntry = { command, stage, ts };
  const nextStatus: Record<StageKey, StageStatus> = { ...normalized.stageStatus };
  nextStatus[stage] = 'done';
  stageFlow.forEach((key) => {
    if (key !== stage && nextStatus[key] === 'active') nextStatus[key] = 'todo';
  });
  const nextStage = stageFlow[stageFlow.indexOf(stage) + 1];
  if (nextStage && nextStatus[nextStage] !== 'done') {
    nextStatus[nextStage] = 'active';
  } else {
    const remaining = stageFlow.find((key) => nextStatus[key] !== 'done');
    if (remaining) nextStatus[remaining] = 'active';
  }
  return {
    stageStatus: nextStatus,
    history: [historyEntry, ...normalized.history].slice(0, 100),
    last: historyEntry,
  };
};
