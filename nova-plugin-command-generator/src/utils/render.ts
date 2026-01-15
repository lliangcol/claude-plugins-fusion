import { CommandDefinition, FieldDefinition, FormState } from '../types';

const listify = (value: unknown) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
};

const stringifyField = (field: FieldDefinition, value: unknown) => {
  if (field.type === 'list') {
    const items = listify(value);
    return items.length ? items.map((item) => `- ${item}`).join('\n') : '';
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return value ? String(value) : '';
};

export const renderTemplate = (command: CommandDefinition, form: FormState, variables: Record<string, string> = {}) => {
  const filled = command.template.replace(/{{(.*?)}}/g, (_, rawKey) => {
    const key = String(rawKey).trim();
    const field = command.fields.find((f) => f.id === key);
    if (field) {
      return stringifyField(field, form[key] ?? '');
    }
    if (variables[key]) return variables[key];
    return `<<MISSING:${key}>>`;
  });
  return filled;
};

export const stageOrder: Record<string, number> = {
  explore: 1,
  plan: 2,
  review: 3,
  implement: 4,
  finalize: 5,
};

export const constraintLabel: Record<string, string> = {
  strong: '严格',
  medium: '标准',
  weak: '轻量',
};

export const constraintOrder: Record<string, number> = {
  weak: 1,
  medium: 2,
  strong: 3,
};

