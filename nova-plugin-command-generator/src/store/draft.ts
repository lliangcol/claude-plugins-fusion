import { Attachment, FormState } from '../types';

export interface GeneratorDraft {
  selectedCommandId: string;
  formState: FormState;
  variables: Record<string, string>;
  attachments: Attachment[];
  attachmentTarget: string;
  attachmentMode: 'path' | 'snippet' | 'full';
  previewOverride: string | null;
  savedAt: number;
}

const KEY = 'command-generator-draft';

export const loadDraft = (): GeneratorDraft | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GeneratorDraft;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
};

export const saveDraft = (draft: GeneratorDraft) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // ignore
  }
};
