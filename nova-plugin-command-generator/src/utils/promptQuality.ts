export type QualityStatus = 'ok' | 'warning' | 'weak';

export interface QualityFeedback {
  status: QualityStatus;
  message: string;
}

const normalize = (text: string) => text.trim().toLowerCase();

const actionVerbs = [
  'build',
  'create',
  'design',
  'implement',
  'analyze',
  'summarize',
  'fix',
  'refactor',
  'test',
  'review',
  'generate',
  'plan',
  'optimize',
  'improve',
  'draft',
  'translate',
  'write',
  'make',
  'derive',
  'explain',
  'implement',
  'compare',
  'debug',
  'investigate',
  '实现',
  '生成',
  '分析',
  '设计',
  '编写',
  '优化',
  '修复',
  '整理',
  '总结',
  '评审',
  '规划',
  '制作',
  '对比',
  '排查',
  '重构',
];

const contextHints = [
  'system',
  'scope',
  'environment',
  'context',
  'background',
  'module',
  'service',
  'api',
  'database',
  '限制',
  '范围',
  '上下文',
  '背景',
  '系统',
  '环境',
  '模块',
  '服务',
  '接口',
  '数据库',
];

const hasActionVerb = (text: string) => actionVerbs.some((verb) => text.includes(verb));
const hasContextHint = (text: string) => contextHints.some((hint) => text.includes(hint));

const rule = (status: QualityStatus, message: string): QualityFeedback => ({ status, message });

export const evaluateIntent = (raw: string): QualityFeedback => {
  const text = normalize(raw);
  if (!text) return rule('weak', '⚠ Intent 还未填写，建议补充目标');
  const verb = hasActionVerb(text);
  const longEnough = text.length >= 12;
  if (verb && longEnough) return rule('ok', '✔ Intent 已包含明确目标');
  if (!verb) return rule('warning', '⚠ Intent 可加入动作动词，便于定位任务');
  return rule('warning', '⚠ Intent 信息偏短，建议补充目标细节');
};

export const evaluateContext = (raw: string): QualityFeedback => {
  const text = normalize(raw);
  if (!text) return rule('weak', '⚠ Context 还未填写，可能影响输出质量');
  const hint = hasContextHint(text);
  const longEnough = text.length >= 16;
  if (hint && longEnough) return rule('ok', '✔ Context 覆盖了系统/范围信息');
  if (!hint) return rule('warning', '⚠ Context 信息偏少，建议补充范围或系统背景');
  return rule('warning', '⚠ Context 可更具体，便于生成更贴合的结果');
};

export const evaluateConstraints = (raw: string): QualityFeedback => {
  const text = normalize(raw);
  if (!text) return rule('warning', '⚠ Constraints 可补充限制条件，提升可控性');
  if (text.length < 8) return rule('warning', '⚠ Constraints 偏短，建议补充限制细节');
  return rule('ok', '✔ Constraints 已提供关键约束');
};
