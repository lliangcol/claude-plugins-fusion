export type FieldOption = string | { value: string; label: string };

export const normalizeOption = (option: FieldOption) =>
  typeof option === 'string' ? { value: option, label: option } : option;
