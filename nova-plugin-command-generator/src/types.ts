export type FieldType = 'text' | 'multiline' | 'select' | 'boolean' | 'path' | 'list';
export type StageKey = 'explore' | 'plan' | 'review' | 'implement' | 'finalize';
export type StageStatus = 'todo' | 'active' | 'done';

export interface FieldDefinition {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  defaultValue?: string | boolean | string[];
  bindable?: boolean;
  help?: string;
}

export interface OutputDefinition {
  id: string;
  sourceFieldId: string;
  type: 'path' | 'text';
}

export interface CommandDefinition {
  id: string;
  displayName: string;
  stage: StageKey;
  constraintLevel: 'strong' | 'medium' | 'weak';
  description: string;
  fields: FieldDefinition[];
  template: string;
  outputs?: OutputDefinition[];
}

export interface WorkflowStep {
  stepId: string;
  commandId: string;
  optional?: boolean;
  autoBindings?: { fromVar: string; toFieldId: string; mode?: 'set' | 'appendListItemIfPresent' }[];
}

export interface WorkflowDefinition {
  id: string;
  title: string;
  description?: string;
  intendedScenario?: string;
  audience?: 'new user' | 'power user';
  steps: WorkflowStep[];
}

export interface ScenarioDefinition {
  id: string;
  category: string;
  title: string;
  recommendCommandId?: string;
  recommendWorkflowId?: string;
}

export interface Manifest {
  version: string;
  commands: CommandDefinition[];
  workflows: WorkflowDefinition[];
  scenarios: ScenarioDefinition[];
}

export interface FormState {
  [fieldId: string]: string | boolean | string[];
}

export interface HistoryEntry {
  id: string;
  commandId: string;
  createdAt: number;
  fields: FormState;
  commandText: string;
}

export interface Attachment {
  name: string;
  content: string;
}

export interface GuidanceHistoryEntry {
  command: string;
  stage: StageKey;
  ts: number;
}

export interface GuidanceState {
  stageStatus: Record<StageKey, StageStatus>;
  history: GuidanceHistoryEntry[];
  last: GuidanceHistoryEntry | null;
}

export interface GuidanceContext {
  workflowTemplate?: string;
}

export interface GuidanceRecommendation {
  stage: StageKey;
  command: string;
  reason: string;
  severity?: 'warning';
}
