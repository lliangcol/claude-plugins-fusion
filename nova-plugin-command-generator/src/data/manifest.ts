import { Manifest } from '../types';

// 简化版 manifest，覆盖 15 个命令的基础字段与模板（可继续细化）。
export const manifest: Manifest = {
  version: '0.1.0',
  commands: [
    {
      id: 'senior-explore',
      displayName: '/senior-explore',
      stage: 'explore',
      constraintLevel: 'strong',
      description: '深度探索与分析（禁止方案/实现）',
      fields: [
        { id: 'INTENT', label: '意图', type: 'multiline', required: true },
        { id: 'CONTEXT', label: '上下文', type: 'multiline' },
        { id: 'CONSTRAINTS', label: '约束', type: 'multiline' },
        {
          id: 'DEPTH',
          label: '深度',
          type: 'select',
          options: [
            { value: 'quick', label: '快速' },
            { value: 'normal', label: '标准' },
            { value: 'deep', label: '深入' },
          ],
          defaultValue: 'normal',
        },
        { id: 'EXPORT_PATH', label: '导出路径', type: 'path' },
      ],
      template: `/senior-explore
INTENT: {{INTENT}}
CONTEXT:
{{CONTEXT}}
CONSTRAINTS:
{{CONSTRAINTS}}
DEPTH: {{DEPTH}}
EXPORT_PATH: {{EXPORT_PATH}}`,
      outputs: [{ id: 'analysis_export_path', sourceFieldId: 'EXPORT_PATH', type: 'path' }],
    },
    {
      id: 'explore-lite',
      displayName: '/explore-lite',
      stage: 'explore',
      constraintLevel: 'weak',
      description: '快速理解与对齐',
      fields: [{ id: 'CONTEXT', label: '上下文', type: 'multiline', required: true }],
      template: `/explore-lite
CONTEXT:
{{CONTEXT}}`,
    },
    {
      id: 'explore-review',
      displayName: '/explore-review',
      stage: 'explore',
      constraintLevel: 'medium',
      description: '评审视角梳理问题，不给方案',
      fields: [{ id: 'INPUT', label: '输入', type: 'multiline', required: true }],
      template: `/explore-review
{{INPUT}}`,
    },
    {
      id: 'plan-lite',
      displayName: '/plan-lite',
      stage: 'plan',
      constraintLevel: 'medium',
      description: '轻量计划，明确目标与风险',
      fields: [
        { id: 'GOAL', label: '目标', type: 'multiline', required: true },
        { id: 'NON_GOALS', label: '非目标', type: 'multiline' },
        { id: 'APPROACH', label: '方案选择', type: 'multiline' },
        { id: 'TRADEOFFS', label: '关键权衡', type: 'multiline' },
        { id: 'EXECUTION', label: '执行大纲', type: 'multiline' },
        { id: 'RISKS', label: '关键风险', type: 'multiline' },
      ],
      template: `/plan-lite
GOAL:
{{GOAL}}
NON-GOALS:
{{NON_GOALS}}
CHOSEN APPROACH:
{{APPROACH}}
KEY TRADE-OFFS:
{{TRADEOFFS}}
EXECUTION OUTLINE:
{{EXECUTION}}
KEY RISKS:
{{RISKS}}`,
    },
    {
      id: 'produce-plan',
      displayName: '/produce-plan',
      stage: 'plan',
      constraintLevel: 'strong',
      description: '正式设计/计划文档，写入文件',
      fields: [
        { id: 'PLAN_OUTPUT_PATH', label: '计划输出路径', type: 'path', required: true },
        { id: 'PLAN_INTENT', label: '计划目标', type: 'multiline', required: true },
        { id: 'ANALYSIS_INPUTS', label: '分析输入', type: 'list' },
        { id: 'CONSTRAINTS', label: '约束', type: 'multiline' },
      ],
      template: `/produce-plan
PLAN_OUTPUT_PATH: {{PLAN_OUTPUT_PATH}}
PLAN_INTENT: {{PLAN_INTENT}}
ANALYSIS_INPUTS:
{{ANALYSIS_INPUTS}}
CONSTRAINTS:
{{CONSTRAINTS}}`,
      outputs: [{ id: 'plan_output_path', sourceFieldId: 'PLAN_OUTPUT_PATH', type: 'path' }],
    },
    {
      id: 'backend-plan',
      displayName: '/backend-plan',
      stage: 'plan',
      constraintLevel: 'strong',
      description: '后端设计计划（写文件）',
      fields: [
        { id: 'PLAN_OUTPUT_PATH', label: '计划输出路径', type: 'path', required: true },
        { id: 'PLAN_INTENT', label: '计划目标', type: 'multiline', required: true },
        { id: 'CONTEXT', label: '上下文', type: 'multiline' },
        { id: 'CONSTRAINTS', label: '约束', type: 'multiline' },
      ],
      template: `/backend-plan
PLAN_OUTPUT_PATH: {{PLAN_OUTPUT_PATH}}
PLAN_INTENT: {{PLAN_INTENT}}
CONTEXT:
{{CONTEXT}}
CONSTRAINTS:
{{CONSTRAINTS}}`,
      outputs: [{ id: 'plan_output_path', sourceFieldId: 'PLAN_OUTPUT_PATH', type: 'path' }],
    },
    {
      id: 'plan-review',
      displayName: '/plan-review',
      stage: 'plan',
      constraintLevel: 'medium',
      description: '对计划文档做决策质量评审',
      fields: [{ id: 'PLAN_TEXT', label: '计划文本或摘要', type: 'multiline', required: true }],
      template: `/plan-review
{{PLAN_TEXT}}`,
    },
    {
      id: 'review-lite',
      displayName: '/review-lite',
      stage: 'review',
      constraintLevel: 'weak',
      description: '轻量代码评审，抓明显问题',
      fields: [{ id: 'ARGUMENTS', label: '输入（代码差异/代码/说明）', type: 'multiline', required: true }],
      template: `/review-lite
{{ARGUMENTS}}`,
    },
    {
      id: 'review-only',
      displayName: '/review-only',
      stage: 'review',
      constraintLevel: 'medium',
      description: '常规严格评审，分级输出',
      fields: [{ id: 'ARGUMENTS', label: '输入', type: 'multiline', required: true }],
      template: `/review-only
{{ARGUMENTS}}`,
    },
    {
      id: 'review-strict',
      displayName: '/review-strict',
      stage: 'review',
      constraintLevel: 'strong',
      description: '高风险审计式评审',
      fields: [{ id: 'ARGUMENTS', label: '输入', type: 'multiline', required: true }],
      template: `/review-strict
{{ARGUMENTS}}`,
    },
    {
      id: 'implement-plan',
      displayName: '/implement-plan',
      stage: 'implement',
      constraintLevel: 'strong',
      description: '按批准计划严格实施',
      fields: [
        { id: 'PLAN_INPUT_PATH', label: '计划输入路径', type: 'path', required: true },
        { id: 'PLAN_APPROVED', label: '计划已批准', type: 'text', required: true, defaultValue: '是' },
        { id: 'NOTES', label: '备注', type: 'multiline' },
      ],
      template: `/implement-plan
PLAN_INPUT_PATH: {{PLAN_INPUT_PATH}}
PLAN_APPROVED: {{PLAN_APPROVED}}
NOTES:
{{NOTES}}`,
    },
    {
      id: 'implement-standard',
      displayName: '/implement-standard',
      stage: 'implement',
      constraintLevel: 'medium',
      description: '标准受控实施，允许小纠偏',
      fields: [
        { id: 'INSTRUCTIONS', label: '指令与步骤', type: 'multiline', required: true },
        { id: 'NOTES', label: '备注', type: 'multiline' },
      ],
      template: `/implement-standard
INSTRUCTIONS:
{{INSTRUCTIONS}}
NOTES:
{{NOTES}}`,
    },
    {
      id: 'implement-lite',
      displayName: '/implement-lite',
      stage: 'implement',
      constraintLevel: 'weak',
      description: '快速实施，允许小重构',
      fields: [
        { id: 'INSTRUCTIONS', label: '指令与上下文', type: 'multiline', required: true },
        { id: 'NOTES', label: '备注', type: 'multiline' },
      ],
      template: `/implement-lite
INSTRUCTIONS:
{{INSTRUCTIONS}}
NOTES:
{{NOTES}}`,
    },
    {
      id: 'finalize-work',
      displayName: '/finalize-work',
      stage: 'finalize',
      constraintLevel: 'strong',
      description: '完整交付物总结（提交/合并请求/变更）',
      fields: [
        { id: 'CHANGES', label: '变更内容', type: 'multiline', required: true },
        { id: 'WHY', label: '原因', type: 'multiline', required: true },
        { id: 'LIMITATIONS', label: '已知限制', type: 'multiline' },
        { id: 'FOLLOW_UP', label: '后续工作', type: 'multiline' },
      ],
      template: `/finalize-work
WHAT WAS CHANGED:
{{CHANGES}}
WHY:
{{WHY}}
KNOWN LIMITATIONS:
{{LIMITATIONS}}
FOLLOW-UP WORK:
{{FOLLOW_UP}}`,
    },
    {
      id: 'finalize-lite',
      displayName: '/finalize-lite',
      stage: 'finalize',
      constraintLevel: 'weak',
      description: '极简总结（3 要素）',
      fields: [
        { id: 'CHANGES', label: '变更内容', type: 'multiline', required: true },
        { id: 'WHY', label: '原因', type: 'multiline', required: true },
        { id: 'LIMITATIONS', label: '限制', type: 'multiline' },
      ],
      template: `/finalize-lite
WHAT:
{{CHANGES}}
WHY:
{{WHY}}
LIMITATIONS:
{{LIMITATIONS}}`,
    },
  ],
  workflows: [
    {
      id: 'workflow-a',
      intendedScenario: '需求不清晰的新功能交付',
      audience: 'new user',
      title: '新需求开发（需求不清晰）',
      steps: [
        { stepId: 'wfa1', commandId: 'senior-explore' },
        { stepId: 'wfa2', commandId: 'plan-lite' },
        {
          stepId: 'wfa3',
          commandId: 'produce-plan',
          optional: true,
          autoBindings: [{ fromVar: 'analysis_export_path', toFieldId: 'ANALYSIS_INPUTS', mode: 'appendListItemIfPresent' }],
        },
        { stepId: 'wfa4', commandId: 'plan-review' },
        { stepId: 'wfa5', commandId: 'implement-standard' },
        { stepId: 'wfa6', commandId: 'finalize-work' },
      ],
    },
    {
      id: 'workflow-b',
      intendedScenario: '生产故障诊断与修复',
      audience: 'power user',
      title: '生产问题修复',
      steps: [
        { stepId: 'wfb1', commandId: 'senior-explore' },
        { stepId: 'wfb2', commandId: 'plan-lite', optional: true },
        { stepId: 'wfb3', commandId: 'implement-standard' },
        { stepId: 'wfb4', commandId: 'review-strict', optional: true },
        { stepId: 'wfb5', commandId: 'finalize-work' },
      ],
    },
    {
      id: 'workflow-c',
      intendedScenario: '合并请求评审（逐步提升严格度）',
      audience: 'new user',
      title: '合并请求评审',
      steps: [
        { stepId: 'wfc1', commandId: 'review-lite', optional: true },
        { stepId: 'wfc2', commandId: 'review-only', optional: true },
        { stepId: 'wfc3', commandId: 'review-strict', optional: true },
      ],
    },
    {
      id: 'workflow-d',
      intendedScenario: '后端规划到交付',
      audience: 'power user',
      title: '后端端到端',
      steps: [
        { stepId: 'wfd1', commandId: 'senior-explore' },
        { stepId: 'wfd2', commandId: 'backend-plan' },
        { stepId: 'wfd3', commandId: 'plan-review' },
        { stepId: 'wfd4', commandId: 'implement-plan', autoBindings: [{ fromVar: 'plan_output_path', toFieldId: 'PLAN_INPUT_PATH', mode: 'set' }] },
        { stepId: 'wfd5', commandId: 'review-strict', optional: true },
        { stepId: 'wfd6', commandId: 'finalize-work' },
      ],
    },
  ],
  scenarios: [
    { id: 'req-new-feature', category: '需求分析', title: '新功能需求分析', recommendCommandId: 'senior-explore' },
    { id: 'req-quick-align', category: '需求分析', title: '快速对齐认知', recommendCommandId: 'explore-lite' },
    { id: 'doc-review', category: '需求分析', title: '需求文档评审', recommendCommandId: 'explore-review' },
    { id: 'incident-deep', category: '故障排查', title: '生产问题深挖', recommendWorkflowId: 'workflow-b' },
    { id: 'design-formal', category: '方案规划', title: '正式设计文档', recommendCommandId: 'produce-plan' },
    { id: 'java-backend', category: '方案规划', title: '后端设计', recommendWorkflowId: 'workflow-d' },
    { id: 'plan-review', category: '计划评审', title: '计划文档评审', recommendCommandId: 'plan-review' },
    { id: 'pr-review', category: '代码评审', title: '合并请求评审', recommendWorkflowId: 'workflow-c' },
    { id: 'implement', category: '实施', title: '按计划实施', recommendCommandId: 'implement-plan' },
    { id: 'handoff', category: '交付', title: '完整交付', recommendCommandId: 'finalize-work' },
  ],
};
