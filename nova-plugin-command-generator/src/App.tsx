
import { useEffect, useMemo, useRef, useState } from 'react';
import { manifest } from './data/manifest';
import {
  Attachment,
  CommandDefinition,
  FieldDefinition,
  FormState,
  GuidanceRecommendation,
  GuidanceState,
  HistoryEntry,
  ScenarioDefinition,
  StageKey,
  StageStatus,
} from './types';
import { addHistory, loadHistory, saveHistory } from './store/history';
import { loadGuidanceState, recordGuidanceSuccess } from './store/guidance';
import { loadDraft, saveDraft } from './store/draft';
import { renderTemplate, stageOrder, constraintLabel, constraintOrder } from './utils/render';
import { evaluateConstraints, evaluateContext, evaluateIntent, QualityFeedback } from './utils/promptQuality';
import { buildCommandStageMap, recommendNext, stageFlow } from './utils/guidance';

type Tab = 'scenes' | 'commands' | 'generator' | 'workflows' | 'workflow-run' | 'history';

const stageLabels: Record<string, string> = {
  explore: 'Explore',
  plan: 'Plan',
  review: 'Review',
  implement: 'Implement',
  finalize: 'Finalize',
};

const icons = {
  scenes: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h6l2 2h8v10H4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  commands: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h14M5 12h14M5 17h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  generator: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7h12v10H6z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 10h6M9 14h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  workflows: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7h6v4H6zM12 13h6v4h-6z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 9h6M6 15h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  steps: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 6h10M7 12h10M7 18h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="5" cy="6" r="1.2" fill="currentColor" />
      <circle cx="5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="5" cy="18" r="1.2" fill="currentColor" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7h8l4 4v6H6z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10 13h4M10 17h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  folder: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h6l2 2h8v8H4z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  export: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v10M8 8l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5 14v5h14v-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v10M8 10l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5 18h14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  share: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6" cy="12" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18" cy="6" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18" cy="18" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 11l8-4M8 13l8 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12l4 4L19 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

type IconName = keyof typeof icons;

const Icon = ({ name, className }: { name: IconName; className?: string }) => (
  <span className={className ?? 'icon'}>{icons[name]}</span>
);

const StageProgressBar = ({ status }: { status: Record<StageKey, StageStatus> }) => (
  <div className="stage-progress">
    {stageFlow.map((stage) => {
      const state = status[stage] ?? 'todo';
      return (
        <div key={stage} className={`stage-item ${state}`}>
          {state === 'done' && <Icon name="check" className="stage-icon" />}
          <span className="stage-label">{stageLabels[stage]}</span>
        </div>
      );
    })}
  </div>
);

const NextStepCard = ({
  recommendation,
  onUse,
  onBrowse,
}: {
  recommendation: GuidanceRecommendation;
  onUse: () => void;
  onBrowse: () => void;
}) => (
  <div className="next-step-card">
    <div className="panel-title">下一步建议</div>
    <div className="next-step-body">{recommendation.reason}</div>
    <div className="next-step-actions">
      <button className="btn secondary" onClick={onUse}>
        使用 {recommendation.command}
      </button>
      <button className="btn ghost" onClick={onBrowse}>
        查看其它命令
      </button>
    </div>
  </div>
);

const GuardrailBanner = ({
  visible,
  onContinue,
  onSwitch,
}: {
  visible: boolean;
  onContinue: () => void;
  onSwitch: () => void;
}) =>
  visible ? (
    <div className="guardrail-banner">
      <div className="guardrail-icon">
        <Icon name="steps" />
      </div>
      <div className="guardrail-content">
        <div className="guardrail-title">建议先完成 Plan / Review</div>
        <div className="guardrail-body">这样可以降低返工风险并提升输出质量。</div>
      </div>
      <div className="guardrail-actions">
      <button className="btn secondary" onClick={onContinue}>
        继续执行
      </button>
        <button className="btn ghost" onClick={onSwitch}>
          切换到推荐步骤
        </button>
      </div>
    </div>
  ) : null;

const initForm = (cmd: CommandDefinition): FormState =>
  cmd.fields.reduce<FormState>((acc, f) => {
    acc[f.id] = f.defaultValue ?? (f.type === 'list' ? [] : '');
    return acc;
  }, {});

const formatDate = (ts: number) => new Date(ts).toLocaleString();

const isFieldFilled = (fieldId: string, cmd: CommandDefinition, value: FormState[string]) => {
  const field = cmd.fields.find((f) => f.id === fieldId);
  if (!field) return Boolean(value);
  if (field.type === 'list') return Array.isArray(value) && value.length > 0;
  if (field.type === 'boolean') return value === true;
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
};

const getMissingVariables = (text: string) => {
  const matches = Array.from(text.matchAll(/<<MISSING:([^>]+)>>/g)).map((m) => m[1]);
  return Array.from(new Set(matches));
};

const getDefaultAttachmentTarget = (cmd: CommandDefinition) =>
  cmd.fields.find((f) => f.id === 'CONTEXT')?.id ?? cmd.fields[0]?.id ?? '';

export default function App() {
  const [tab, setTab] = useState<Tab>('scenes');
  const [selectedCommandId, setSelectedCommandId] = useState<string>('');
  const [formState, setFormState] = useState<FormState>({});
  const [formDraft, setFormDraft] = useState<FormState | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory());
  const [guidanceState, setGuidanceState] = useState<GuidanceState>(() => loadGuidanceState());
  const [nextRecommendation, setNextRecommendation] = useState<GuidanceRecommendation | null>(null);
  const [showNextCard, setShowNextCard] = useState(false);
  const [guardrailVisible, setGuardrailVisible] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(() => {
    try {
      return localStorage.getItem('command-generator-advanced') === 'true';
    } catch {
      return false;
    }
  });
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentTarget, setAttachmentTarget] = useState<string>('');
  const [attachmentMode, setAttachmentMode] = useState<'path' | 'snippet' | 'full'>('snippet');
  const [previewOverride, setPreviewOverride] = useState<string | null>(null);
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const [undoSnapshot, setUndoSnapshot] = useState<{
    selectedCommandId: string;
    formState: FormState;
    variables: Record<string, string>;
    attachments: Attachment[];
    attachmentTarget: string;
    attachmentMode: 'path' | 'snippet' | 'full';
    previewOverride: string | null;
  } | null>(null);
  const draftRestoreRef = useRef(false);
  const feedbackTimerRef = useRef<number | null>(null);

  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [workflowStepIndex, setWorkflowStepIndex] = useState(0);
  const [workflowForms, setWorkflowForms] = useState<Record<string, FormState>>({});
  const [workflowAttachments, setWorkflowAttachments] = useState<Record<string, Attachment[]>>({});
  const [workflowVariables, setWorkflowVariables] = useState<Record<string, string>>({});
  const [workflowStepStatus, setWorkflowStepStatus] = useState<Record<string, 'pending' | 'done' | 'skipped'>>({});
  const [workflowPreviewOverrides, setWorkflowPreviewOverrides] = useState<Record<string, string>>({});
  const [workflowBindingsApplied, setWorkflowBindingsApplied] = useState<Record<string, boolean>>({});
  const [workflowVarKey, setWorkflowVarKey] = useState('');
  const [workflowVarValue, setWorkflowVarValue] = useState('');
  const [workflowAttachmentTarget, setWorkflowAttachmentTarget] = useState('');
  const [workflowAttachmentMode, setWorkflowAttachmentMode] = useState<'path' | 'snippet' | 'full'>('snippet');

  const selectedCommand = useMemo(
    () => (selectedCommandId ? manifest.commands.find((c) => c.id === selectedCommandId) ?? null : null),
    [selectedCommandId],
  );
  const commandStageMap = useMemo(() => buildCommandStageMap(manifest.commands), []);
  const canAccessGenerator = Boolean(selectedCommandId);
  const stageLabelMap = useMemo(() => stageLabels, []);
  const workflowSuggestion = useMemo(() => {
    if (!selectedCommand) return null;
    const match = manifest.workflows.find((workflow) =>
      workflow.steps.some((step) => step.commandId === selectedCommand.id),
    );
    if (!match) return null;
    return `This command is often used as part of ${match.title}.`;
  }, [selectedCommand]);

  useEffect(() => {
    if (!selectedCommand) return;
    setFormState(formDraft ?? initForm(selectedCommand));
    setFormDraft(null);
    if (draftRestoreRef.current) {
      draftRestoreRef.current = false;
      if (!attachmentTarget) {
        setAttachmentTarget(getDefaultAttachmentTarget(selectedCommand));
      }
      return;
    }
    setVariables({});
    setAttachments([]);
    setPreviewOverride(null);
    setAttachmentMode('snippet');
    setAttachmentTarget(getDefaultAttachmentTarget(selectedCommand));
  }, [selectedCommandId, selectedCommand]);

  const handleFieldChange = (fieldId: string, value: string | boolean) => {
    setFormState((prev) => ({ ...prev, [fieldId]: value }));
  };

  const clearFieldValue = (fieldId: string, fieldType: string) => {
    if (fieldType === 'list') {
      setFormState((prev) => ({ ...prev, [fieldId]: [] }));
      return;
    }
    handleFieldChange(fieldId, '');
  };

  const handleListChange = (fieldId: string, raw: string) => {
    const list = raw
      .split('\n')
      .map((v) => v.trim())
      .filter(Boolean);
    setFormState((prev) => ({ ...prev, [fieldId]: list }));
  };

  const computedPreview = selectedCommand ? renderTemplate(selectedCommand, formState, variables) : '';
  const previewText = previewOverride ?? computedPreview;
  const missingVars = getMissingVariables(computedPreview);

  const canGenerate = selectedCommand
    ? selectedCommand.fields.every((f) => !f.required || isFieldFilled(f.id, selectedCommand, formState[f.id]))
    : false;

  const missingRequired = selectedCommand
    ? selectedCommand.fields.filter((f) => f.required && !isFieldFilled(f.id, selectedCommand, formState[f.id]))
    : [];

  const showFeedback = (message: string) => {
    setFeedbackMessage(message);
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedbackMessage(null);
      feedbackTimerRef.current = null;
    }, 3200);
  };

  const handleAddHistory = () => {
    if (!selectedCommand) return;
    setUndoSnapshot({
      selectedCommandId,
      formState: { ...formState },
      variables: { ...variables },
      attachments: attachments.map((attachment) => ({ ...attachment })),
      attachmentTarget,
      attachmentMode,
      previewOverride,
    });
    const entry: HistoryEntry = {
      id: `${selectedCommand.id}-${Date.now()}`,
      commandId: selectedCommand.id,
      createdAt: Date.now(),
      fields: formState,
      commandText: previewText,
    };
    const list = addHistory(entry);
    setHistory(list);
    const nextGuidance = recordGuidanceSuccess(selectedCommand.id, selectedCommand.stage, entry.createdAt);
    setGuidanceState(nextGuidance);
    setNextRecommendation(recommendNext(nextGuidance, guidanceContext));
    setShowNextCard(true);
    showFeedback('Generated and saved to History (local storage).');
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;
    const next: Attachment[] = [];
    for (const file of Array.from(files)) {
      const text = await file.text();
      const snippet = text.slice(0, 2000);
      next.push({ name: file.name, content: snippet });
    }
    setAttachments((prev) => [...prev, ...next]);
  };

  const insertAttachmentsToField = (fieldId: string, mode: 'path' | 'snippet' | 'full') => {
    if (!selectedCommand) return;
    const fieldDef = selectedCommand.fields.find((f) => f.id === fieldId);
    if (!fieldDef) return;
    if (fieldDef.type === 'list') {
      const existing = Array.isArray(formState[fieldId]) ? (formState[fieldId] as string[]) : [];
      const items = attachments.map((a) => `File: ${a.name}`);
      setFormState((prev) => ({ ...prev, [fieldId]: [...existing, ...items] }));
      return;
    }
    const field = formState[fieldId];
    const existing = typeof field === 'string' ? field : '';
    const joined = attachments
      .map((a) => {
        if (mode === 'path') return `- File: ${a.name}`;
        if (mode === 'snippet') return `- File: ${a.name}\n  ---\n  ${a.content}\n  ---`;
        return `- File: ${a.name}\n  ---\n  ${a.content}\n  ---`;
      })
      .join('\n');
    handleFieldChange(fieldId, `${existing}\n${joined}`.trim());
  };

  const removeAttachment = (name: string) => {
    setAttachments((prev) => prev.filter((a) => a.name !== name));
  };

  const exportBlob = (content: string, filename: string, type = 'text/plain', feedback?: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    if (feedback) {
      showFeedback(feedback);
    }
  };

  const buildExportPayload = (cmd: CommandDefinition, fields: FormState, text: string, kind: 'md' | 'txt' | 'json') => {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const base = `${cmd.id}-${ts}`;
    if (kind === 'txt') {
      return { filename: `${base}.txt`, content: text, type: 'text/plain' };
    }
    if (kind === 'json') {
      return { filename: `${base}.json`, content: JSON.stringify({ commandId: cmd.id, fields }, null, 2), type: 'application/json' };
    }
    const md = `# ${cmd.displayName}\n\n生成时间：${ts}\n\n## 字段快照\n\`\`\`json\n${JSON.stringify(fields, null, 2)}\n\`\`\`\n\n## 命令文本\n\`\`\`\n${text}\n\`\`\`\n`;
    return { filename: `${base}.md`, content: md, type: 'text/markdown' };
  };

  const handleSingleExport = async (kind: 'md' | 'txt' | 'json', mode: 'download' | 'save' | 'share') => {
    if (!selectedCommand) return;
    const payload = buildExportPayload(selectedCommand, formState, previewText, kind);
    if (mode === 'download') {
      exportBlob(
        payload.content,
        payload.filename,
        payload.type,
        `Exported ${payload.filename} to your default downloads folder.`,
      );
      return;
    }
    if (mode === 'save') {
      const showSaveFilePicker = (window as unknown as { showSaveFilePicker?: (options?: unknown) => Promise<any> })
        .showSaveFilePicker;
      if (!showSaveFilePicker) {
        exportBlob(payload.content, payload.filename, payload.type);
        return;
      }
      const handle = await showSaveFilePicker({
        suggestedName: payload.filename,
        types: [{ description: payload.type, accept: { [payload.type]: [`.${kind}`] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(payload.content);
      await writable.close();
      showFeedback(`Exported ${payload.filename} to the selected save location.`);
      return;
    }
    if (mode === 'share' && navigator.share) {
      try {
        await navigator.share({ title: selectedCommand.displayName, text: payload.content });
        showFeedback('Shared via the system share sheet.');
        return;
      } catch {
        exportBlob(
          payload.content,
          payload.filename,
          payload.type,
          `Exported ${payload.filename} to your default downloads folder.`,
        );
        return;
      }
    }
    exportBlob(
      payload.content,
      payload.filename,
      payload.type,
      `Exported ${payload.filename} to your default downloads folder.`,
    );
  };

  const isOutOfOrder = (stage: StageKey) => {
    const stageIndex = stageFlow.indexOf(stage);
    if (stageIndex <= 0) return false;
    return stageFlow.slice(0, stageIndex).some((key) => guidanceState.stageStatus[key] === 'todo');
  };

  const selectCommandWithGuardrail = (id: string, switchTab = false) => {
    if (switchTab) setTab('generator');
    setSelectedCommandId(id);
    const stage = commandStageMap[id];
    if (stage && isOutOfOrder(stage)) {
      setGuardrailVisible(true);
    } else {
      setGuardrailVisible(false);
    }
  };

  const setCommandAndSwitch = (id: string) => {
    selectCommandWithGuardrail(id, true);
  };

  const restoreUndoSnapshot = () => {
    if (!undoSnapshot) return;
    const isSameCommand = undoSnapshot.selectedCommandId === selectedCommandId;
    draftRestoreRef.current = true;
    if (isSameCommand) {
      setFormState(undoSnapshot.formState);
      setFormDraft(null);
    } else {
      setFormDraft(undoSnapshot.formState);
    }
    setSelectedCommandId(undoSnapshot.selectedCommandId);
    setVariables(undoSnapshot.variables);
    setAttachments(undoSnapshot.attachments);
    setAttachmentTarget(undoSnapshot.attachmentTarget);
    setAttachmentMode(undoSnapshot.attachmentMode);
    setPreviewOverride(undoSnapshot.previewOverride);
    setUndoSnapshot(null);
  };

  const getSceneRecommendation = (scenario: ScenarioDefinition) => {
    if (scenario.recommendWorkflowId) {
      return {
        label: 'Workflow',
        note: 'This scenario involves multiple steps, so a workflow keeps the sequence aligned.',
      };
    }
    return {
      label: 'Single Command',
      note: 'This scenario produces a single artifact, so one command is enough.',
    };
  };

  const sceneCards = (scenarios: ScenarioDefinition[]) =>
    scenarios.map((s) => {
      const recommendation = getSceneRecommendation(s);
      return (
        <div
          key={s.id}
          className={`card scene-card ${s.recommendCommandId || s.recommendWorkflowId ? 'recommended' : ''}`.trim()}
        >
          <div className="card-title">{s.title}</div>
          <div className="card-sub">{s.category}</div>
          <div className="scene-recommend">
            <div className="scene-recommend-label">
              Recommended Path <span className="badge">{recommendation.label}</span>
            </div>
            <div className="scene-recommend-note">{recommendation.note}</div>
          </div>
          {s.recommendCommandId && (
            <button className="btn secondary" onClick={() => setCommandAndSwitch(s.recommendCommandId)}>
              用 {s.recommendCommandId}
            </button>
          )}
          {s.recommendWorkflowId && (
            <button className="btn secondary" onClick={() => startWorkflow(s.recommendWorkflowId)}>
              启动工作流
            </button>
          )}
        </div>
      );
    });

  const sortedCommands = useMemo(
    () =>
      [...manifest.commands].sort(
        (a, b) =>
          stageOrder[a.stage] - stageOrder[b.stage] ||
          constraintOrder[a.constraintLevel] - constraintOrder[b.constraintLevel] ||
          a.displayName.localeCompare(b.displayName),
      ),
    [],
  );

  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandDefinition[]> = {};
    sortedCommands.forEach((c) => {
      groups[c.stage] = groups[c.stage] || [];
      groups[c.stage].push(c);
    });
    return groups;
  }, [sortedCommands]);

  const attachableFields = selectedCommand
    ? selectedCommand.fields.filter((f) => f.type !== 'select' && f.type !== 'boolean')
    : [];

  useEffect(() => {
    const draft = loadDraft();
    if (!draft) return;
    draftRestoreRef.current = true;
    setFormDraft(draft.formState);
    setSelectedCommandId(draft.selectedCommandId);
    setVariables(draft.variables ?? {});
    setAttachments(draft.attachments ?? []);
    setAttachmentTarget(draft.attachmentTarget ?? getDefaultAttachmentTarget(selectedCommand ?? manifest.commands[0]));
    setAttachmentMode(draft.attachmentMode ?? 'snippet');
    setPreviewOverride(draft.previewOverride ?? null);
    setDraftRestored(true);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('command-generator-advanced', showAdvanced ? 'true' : 'false');
    } catch {
      // ignore
    }
  }, [showAdvanced]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      saveDraft({
        selectedCommandId,
        formState,
        variables,
        attachments,
        attachmentTarget,
        attachmentMode,
        previewOverride,
        savedAt: Date.now(),
      });
      setDraftSavedAt(Date.now());
    }, 400);
    return () => window.clearTimeout(handle);
  }, [selectedCommandId, formState, variables, attachments, attachmentTarget, attachmentMode, previewOverride]);

  const startWorkflow = (workflowId: string) => {
    const workflow = manifest.workflows.find((w) => w.id === workflowId);
    if (!workflow) return;
    setActiveWorkflowId(workflowId);
    setWorkflowStepIndex(0);
    setWorkflowForms({});
    setWorkflowAttachments({});
    setWorkflowVariables({});
    setWorkflowStepStatus({});
    setWorkflowPreviewOverrides({});
    setWorkflowBindingsApplied({});
    if (workflow.steps[0]?.commandId) {
      setSelectedCommandId(workflow.steps[0].commandId);
    }
    setTab('workflow-run');
  };

  const activeWorkflow = useMemo(
    () => (activeWorkflowId ? manifest.workflows.find((w) => w.id === activeWorkflowId) ?? null : null),
    [activeWorkflowId],
  );
  const guidanceContext = useMemo(
    () => (activeWorkflow ? { workflowTemplate: activeWorkflow.title } : undefined),
    [activeWorkflow],
  );
  const guardrailRecommendation = useMemo(() => recommendNext(guidanceState, guidanceContext), [guidanceState, guidanceContext]);
  const intentFieldId = useMemo(
    () => selectedCommand?.fields.find((f) => /INTENT/i.test(f.id))?.id ?? null,
    [selectedCommand],
  );
  const contextFieldId = useMemo(
    () => selectedCommand?.fields.find((f) => /CONTEXT/i.test(f.id))?.id ?? null,
    [selectedCommand],
  );
  const constraintsFieldId = useMemo(
    () => selectedCommand?.fields.find((f) => /CONSTRAINTS/i.test(f.id))?.id ?? null,
    [selectedCommand],
  );
  const intentFeedback: QualityFeedback | null = useMemo(() => {
    if (!intentFieldId) return null;
    return evaluateIntent(String(formState[intentFieldId] ?? ''));
  }, [intentFieldId, formState]);
  const contextFeedback: QualityFeedback | null = useMemo(() => {
    if (!contextFieldId) return null;
    return evaluateContext(String(formState[contextFieldId] ?? ''));
  }, [contextFieldId, formState]);
  const constraintsFeedback: QualityFeedback | null = useMemo(() => {
    if (!constraintsFieldId) return null;
    return evaluateConstraints(String(formState[constraintsFieldId] ?? ''));
  }, [constraintsFieldId, formState]);
  const generatorSections = useMemo(() => {
    if (!selectedCommand) return [];
    const sections = [
      { key: 'intent', title: 'Intent', match: (f: FieldDefinition) => /INTENT/i.test(f.id) },
      { key: 'context', title: 'Context', match: (f: FieldDefinition) => /CONTEXT/i.test(f.id) },
      { key: 'constraints', title: 'Constraints', match: (f: FieldDefinition) => /CONSTRAINTS/i.test(f.id) },
      { key: 'depth', title: 'Depth', match: (f: FieldDefinition) => f.id === 'DEPTH' },
      { key: 'export', title: 'Export path', match: (f: FieldDefinition) => f.type === 'path' },
    ];
    const used = new Set<string>();
    const resolved = sections
      .map((section) => {
        const fields = selectedCommand.fields.filter((f) => section.match(f));
        fields.forEach((f) => used.add(f.id));
        return { ...section, fields };
      })
      .filter((section) => section.fields.length > 0);
    const otherFields = selectedCommand.fields.filter((f) => !used.has(f.id));
    if (otherFields.length > 0) {
      resolved.push({ key: 'details', title: 'Details', fields: otherFields });
    }
    return resolved;
  }, [selectedCommand]);
  const basicSections = useMemo(
    () => generatorSections.filter((section) => section.key === 'intent' || section.key === 'context'),
    [generatorSections],
  );
  const advancedSections = useMemo(
    () => generatorSections.filter((section) => section.key !== 'intent' && section.key !== 'context'),
    [generatorSections],
  );
  const advancedRequiredFields = useMemo(
    () => advancedSections.flatMap((section) => section.fields.filter((f) => f.required)),
    [advancedSections],
  );
  const missingAdvancedRequired = useMemo(() => {
    if (!selectedCommand) return [];
    return advancedRequiredFields.filter((f) => !isFieldFilled(f.id, selectedCommand, formState[f.id]));
  }, [advancedRequiredFields, formState, selectedCommand]);

  useEffect(() => {
    if (missingAdvancedRequired.length > 0) {
      setShowAdvanced(true);
    }
  }, [missingAdvancedRequired.length]);

  const currentStep = activeWorkflow?.steps[workflowStepIndex];
  const workflowCommand = currentStep ? manifest.commands.find((c) => c.id === currentStep.commandId) ?? null : null;
  const workflowFormState = currentStep && workflowCommand ? workflowForms[currentStep.stepId] ?? initForm(workflowCommand) : null;
  const workflowAttachmentsList = currentStep ? workflowAttachments[currentStep.stepId] ?? [] : [];
  const workflowComputedPreview =
    currentStep && workflowCommand && workflowFormState ? renderTemplate(workflowCommand, workflowFormState, workflowVariables) : '';
  const workflowPreviewOverride = currentStep && currentStep.stepId in workflowPreviewOverrides ? workflowPreviewOverrides[currentStep.stepId] : null;
  const workflowPreviewText = workflowPreviewOverride ?? workflowComputedPreview;
  const workflowMissingVars = getMissingVariables(workflowComputedPreview);
  useEffect(() => {
    if (!currentStep || !workflowCommand) return;
    setWorkflowForms((prev) => {
      if (prev[currentStep.stepId]) return prev;
      return { ...prev, [currentStep.stepId]: initForm(workflowCommand) };
    });
    setWorkflowAttachmentTarget(getDefaultAttachmentTarget(workflowCommand));
    setWorkflowAttachmentMode('snippet');
  }, [currentStep?.stepId, workflowCommand?.id]);

  const updateWorkflowForm = (updater: (current: FormState) => FormState) => {
    if (!currentStep || !workflowCommand) return;
    setWorkflowForms((prev) => {
      const current = prev[currentStep.stepId] ?? initForm(workflowCommand);
      const next = updater(current);
      return { ...prev, [currentStep.stepId]: next };
    });
  };

  const updateWorkflowField = (fieldId: string, value: string | boolean) => {
    updateWorkflowForm((current) => ({ ...current, [fieldId]: value }));
  };

  const clearWorkflowFieldValue = (fieldId: string, fieldType: string) => {
    if (fieldType === 'list') {
      updateWorkflowForm((current) => ({ ...current, [fieldId]: [] }));
      return;
    }
    updateWorkflowField(fieldId, '');
  };

  const updateWorkflowList = (fieldId: string, raw: string) => {
    const list = raw
      .split('\n')
      .map((v) => v.trim())
      .filter(Boolean);
    updateWorkflowForm((current) => ({ ...current, [fieldId]: list }));
  };

  const handleWorkflowFileUpload = async (files: FileList | null) => {
    if (!files || !currentStep) return;
    const next: Attachment[] = [];
    for (const file of Array.from(files)) {
      const text = await file.text();
      next.push({ name: file.name, content: text.slice(0, 2000) });
    }
    setWorkflowAttachments((prev) => ({
      ...prev,
      [currentStep.stepId]: [...(prev[currentStep.stepId] ?? []), ...next],
    }));
  };

  const insertWorkflowAttachments = (fieldId: string, mode: 'path' | 'snippet' | 'full') => {
    if (!currentStep || !workflowCommand || !workflowFormState) return;
    const fieldDef = workflowCommand.fields.find((f) => f.id === fieldId);
    if (!fieldDef) return;
    if (fieldDef.type === 'list') {
      const existing = Array.isArray(workflowFormState[fieldId]) ? (workflowFormState[fieldId] as string[]) : [];
      const items = workflowAttachmentsList.map((a) => `File: ${a.name}`);
      updateWorkflowForm((current) => ({ ...current, [fieldId]: [...existing, ...items] }));
      return;
    }
    const existing = typeof workflowFormState[fieldId] === 'string' ? (workflowFormState[fieldId] as string) : '';
    const joined = workflowAttachmentsList
      .map((a) => {
        if (mode === 'path') return `- File: ${a.name}`;
        if (mode === 'snippet') return `- File: ${a.name}\n  ---\n  ${a.content}\n  ---`;
        return `- File: ${a.name}\n  ---\n  ${a.content}\n  ---`;
      })
      .join('\n');
    updateWorkflowField(fieldId, `${existing}\n${joined}`.trim());
  };

  const applyBindingsForStep = () => {
    if (!currentStep || !workflowCommand) return;
    if (!currentStep.autoBindings || currentStep.autoBindings.length === 0) return;
    updateWorkflowForm((current) => {
      let next = { ...current };
      let changed = false;
      currentStep.autoBindings.forEach((binding) => {
        const value = workflowVariables[binding.fromVar];
        if (!value) return;
        const fieldDef = workflowCommand.fields.find((f) => f.id === binding.toFieldId);
        if (!fieldDef) return;
        if (fieldDef.type === 'list') {
          const list = Array.isArray(next[binding.toFieldId]) ? [...(next[binding.toFieldId] as string[])] : [];
          if (!list.includes(value)) {
            list.push(value);
            next[binding.toFieldId] = list;
            changed = true;
          }
          return;
        }
        if (binding.mode === 'set' || !String(next[binding.toFieldId] ?? '').trim()) {
          next[binding.toFieldId] = value;
          changed = true;
        }
      });
      return changed ? next : current;
    });
  };

  useEffect(() => {
    if (!currentStep || !workflowCommand) return;
    if (workflowBindingsApplied[currentStep.stepId]) return;
    applyBindingsForStep();
    setWorkflowBindingsApplied((prev) => ({ ...prev, [currentStep.stepId]: true }));
  }, [currentStep?.stepId, workflowCommand?.id, activeWorkflowId]);

  const handleWorkflowGenerate = () => {
    if (!currentStep || !workflowCommand || !workflowFormState) return;
    setUndoSnapshot({
      selectedCommandId,
      formState,
      variables,
      attachments,
      attachmentTarget,
      attachmentMode,
      previewOverride,
    });
    const entry: HistoryEntry = {
      id: `${workflowCommand.id}-${Date.now()}`,
      commandId: workflowCommand.id,
      createdAt: Date.now(),
      fields: workflowFormState,
      commandText: workflowPreviewText,
    };
    const list = addHistory(entry);
    setHistory(list);
    const nextGuidance = recordGuidanceSuccess(workflowCommand.id, workflowCommand.stage, entry.createdAt);
    setGuidanceState(nextGuidance);
    setNextRecommendation(recommendNext(nextGuidance, guidanceContext));
    setShowNextCard(true);
    if (workflowCommand.outputs) {
      const next = { ...workflowVariables };
      workflowCommand.outputs.forEach((output) => {
        const value = workflowFormState[output.sourceFieldId];
        if (typeof value === 'string' && value.trim()) next[output.id] = value.trim();
      });
      setWorkflowVariables(next);
    }
    setWorkflowStepStatus((prev) => ({ ...prev, [currentStep.stepId]: 'done' }));
  };

  const handleWorkflowSkip = () => {
    if (!currentStep) return;
    setWorkflowStepStatus((prev) => ({ ...prev, [currentStep.stepId]: 'skipped' }));
    if (activeWorkflow && workflowStepIndex < activeWorkflow.steps.length - 1) {
      setWorkflowStepIndex((prev) => prev + 1);
    }
  };

  const handleWorkflowReset = () => {
    setActiveWorkflowId(null);
    setTab('workflows');
  };

  const handleWorkflowExport = async (kind: 'md' | 'txt' | 'json', mode: 'download' | 'save' | 'share') => {
    if (!workflowCommand || !workflowFormState) return;
    const payload = buildExportPayload(workflowCommand, workflowFormState, workflowPreviewText, kind);
    if (mode === 'download') {
      exportBlob(payload.content, payload.filename, payload.type);
      return;
    }
    if (mode === 'save') {
      const showSaveFilePicker = (window as unknown as { showSaveFilePicker?: (options?: unknown) => Promise<any> })
        .showSaveFilePicker;
      if (!showSaveFilePicker) {
        exportBlob(payload.content, payload.filename, payload.type);
        return;
      }
      const handle = await showSaveFilePicker({
        suggestedName: payload.filename,
        types: [{ description: payload.type, accept: { [payload.type]: [`.${kind}`] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(payload.content);
      await writable.close();
      return;
    }
    if (mode === 'share' && navigator.share) {
      try {
        await navigator.share({ title: workflowCommand.displayName, text: payload.content });
        return;
      } catch {
        exportBlob(payload.content, payload.filename, payload.type);
        return;
      }
    }
    exportBlob(payload.content, payload.filename, payload.type);
  };

  const canGenerateWorkflowStep =
    currentStep && workflowCommand && workflowFormState
      ? workflowCommand.fields.every((f) => !f.required || isFieldFilled(f.id, workflowCommand, workflowFormState[f.id]))
      : false;

  const workflowMissingRequired =
    currentStep && workflowCommand && workflowFormState
      ? workflowCommand.fields.filter((f) => f.required && !isFieldFilled(f.id, workflowCommand, workflowFormState[f.id]))
      : [];

  const supportsDirectoryPicker = Boolean((window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker);
  const supportsSave = Boolean((window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker);
  const supportsShare = Boolean(navigator.share);

  const pickDirectory = async (onPick: (value: string) => void) => {
    const showDirectoryPicker = (window as unknown as { showDirectoryPicker?: () => Promise<any> }).showDirectoryPicker;
    if (!showDirectoryPicker) return;
    const handle = await showDirectoryPicker();
    onPick(handle?.name ?? '');
  };

  const addVariable = () => {
    const key = newVarKey.trim();
    const value = newVarValue.trim();
    if (!key || !value) return;
    setVariables((prev) => ({ ...prev, [key]: value }));
    setNewVarKey('');
    setNewVarValue('');
  };

  const addWorkflowVariable = () => {
    const key = workflowVarKey.trim();
    const value = workflowVarValue.trim();
    if (!key || !value) return;
    setWorkflowVariables((prev) => ({ ...prev, [key]: value }));
    setWorkflowVarKey('');
    setWorkflowVarValue('');
  };

  const removeHistoryItem = (id: string) => {
    const next = history.filter((h) => h.id !== id);
    saveHistory(next);
    setHistory(next);
  };

  const copyText = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showFeedback('Copied to clipboard.');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showFeedback('Copied to clipboard.');
    }
  };

  const renderField = (f: FieldDefinition) => (
    <div key={f.id} className="field">
      <label className="field-label">
        {f.label}
        {f.required && <span className="required">*</span>}
      </label>
      {f.type === 'select' ? (
        <select value={String(formState[f.id] ?? '')} onChange={(e) => handleFieldChange(f.id, e.target.value)} className="input">
          {(f.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : f.type === 'boolean' ? (
        <input type="checkbox" checked={Boolean(formState[f.id])} onChange={(e) => handleFieldChange(f.id, e.target.checked)} />
      ) : f.type === 'path' ? (
        <div className="input-row">
          <input
            className="input"
            value={(formState[f.id] as string) ?? ''}
            placeholder="选择或输入路径"
            onChange={(e) => handleFieldChange(f.id, e.target.value)}
          />
          <button
            className="btn secondary"
            type="button"
            disabled={!supportsDirectoryPicker}
            onClick={() => pickDirectory((value) => handleFieldChange(f.id, value))}
          >
            <Icon name="folder" /> 选文件夹
          </button>
        </div>
      ) : f.type === 'list' ? (
        <>
          <textarea
            className="input"
            rows={3}
            placeholder="每行一项"
            value={(formState[f.id] as string[] | undefined)?.join('\n') ?? ''}
            onChange={(e) => handleListChange(f.id, e.target.value)}
          />
          <button className="btn danger" type="button" onClick={() => clearFieldValue(f.id, f.type)}>
            <Icon name="trash" /> 清空多行内容
          </button>
        </>
      ) : (
        <>
          <textarea
            className="input"
            rows={f.type === 'text' ? 2 : 4}
            value={(formState[f.id] as string) ?? ''}
            onChange={(e) => handleFieldChange(f.id, e.target.value)}
          />
          {f.type === 'multiline' && (
            <button className="btn danger" type="button" onClick={() => clearFieldValue(f.id, f.type)}>
              <Icon name="trash" /> 清空多行内容
            </button>
          )}
        </>
      )}
      {f.help && <div className="muted small">{f.help}</div>}
    </div>
  );

  const checklistItems = useMemo(() => {
    const items = [
      { id: 'intent', label: 'Intent', sectionKey: 'intent' },
      { id: 'context', label: 'Context', sectionKey: 'context' },
      { id: 'constraints', label: 'Constraints', sectionKey: 'constraints' },
      { id: 'paths', label: 'Paths', sectionKey: 'export' },
    ];
    if (!selectedCommand) {
      return items.map((item) => ({
        ...item,
        hasFields: false,
        complete: false,
        sectionId: undefined as string | undefined,
      }));
    }
    const sectionMap = new Map(generatorSections.map((section) => [section.key, section]));
    return items.map((item) => {
      const section = sectionMap.get(item.sectionKey);
      const fields = section?.fields ?? [];
      const hasFields = fields.length > 0;
      const complete = !hasFields || fields.every((f) => isFieldFilled(f.id, selectedCommand, formState[f.id]));
      return {
        ...item,
        hasFields,
        complete,
        sectionId: hasFields ? `section-${item.sectionKey}` : undefined,
      };
    });
  }, [formState, generatorSections, selectedCommand]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="title">命令生成器 Command Generator</div>
        <div className="tabs">
          <button className={tab === 'scenes' ? 'tab active' : 'tab'} onClick={() => setTab('scenes')}>
            <Icon name="scenes" />
            Start from a scenario
          </button>
          <button className={tab === 'commands' ? 'tab active' : 'tab'} onClick={() => setTab('commands')}>
            <Icon name="commands" />
            Build manually
          </button>
          <button
            className={tab === 'generator' ? 'tab active' : 'tab'}
            onClick={() => (canAccessGenerator ? setTab('generator') : null)}
            disabled={!canAccessGenerator}
          >
            <Icon name="generator" />
            Execution workspace (not a starting point)
          </button>
          <button className={tab === 'workflows' ? 'tab active' : 'tab'} onClick={() => setTab('workflows')}>
            <Icon name="workflows" />
            工作流
          </button>
          {activeWorkflowId && (
            <button className={tab === 'workflow-run' ? 'tab active' : 'tab'} onClick={() => setTab('workflow-run')}>
              <Icon name="steps" />
              步骤
            </button>
          )}
          <button className={tab === 'history' ? 'tab active' : 'tab'} onClick={() => setTab('history')}>
            <Icon name="history" />
            历史
          </button>
        </div>
      </header>

      {tab === 'scenes' && (
        <div className="layout">
          <section>
            <h3 className="section-title">
              <Icon name="workflows" /> 工作流场景
            </h3>
            <div className="card-grid">{sceneCards(manifest.scenarios.filter((s) => s.recommendWorkflowId))}</div>
          </section>
          <section>
            <h3 className="section-title">
              <Icon name="commands" /> 命令场景
            </h3>
            <div className="card-grid">{sceneCards(manifest.scenarios.filter((s) => s.recommendCommandId))}</div>
          </section>
        </div>
      )}

      {tab === 'commands' && (
        <div className="layout">
          <StageProgressBar status={guidanceState.stageStatus} />
          {Object.entries(groupedCommands).map(([stage, cmds]) => (
            <section key={stage} className="section-shell">
              <h3 className="section-title">
                <Icon name="commands" />
                {stageLabels[stage] ?? stage}（{cmds.length}）
              </h3>
              <div className="card-grid">
                {cmds.map((c) => (
                  <div key={c.id} className="card">
                    <div className="card-title">
                      {c.displayName}{' '}
                      <span
                        className={`badge ${
                          c.constraintLevel === 'strong'
                            ? 'rigor-strict'
                            : c.constraintLevel === 'medium'
                              ? 'rigor-standard'
                              : 'rigor-lite'
                        }`}
                      >
                        {constraintLabel[c.constraintLevel]}
                      </span>
                      {c.constraintLevel === 'strong' && <span className="badge severity-high">高风险</span>}
                    </div>
                    <div className="card-sub">{c.description}</div>
                    <button className="btn secondary" onClick={() => setCommandAndSwitch(c.id)}>
                      生成
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === 'generator' && selectedCommand && (
        <div className="layout generator-layout">
          <div className="generator-guidance">
            <StageProgressBar status={guidanceState.stageStatus} />
            <GuardrailBanner
              visible={guardrailVisible}
              onContinue={() => setGuardrailVisible(false)}
              onSwitch={() => {
                setGuardrailVisible(false);
                if (guardrailRecommendation?.command) {
                  selectCommandWithGuardrail(guardrailRecommendation.command, true);
                }
              }}
            />
          </div>
          <section className="generator-inputs">
            <div className="panel-stack">
              {feedbackMessage && <div className="success-notice">{feedbackMessage}</div>}
              {draftRestored && <div className="draft-notice">已恢复上次草稿</div>}
              {workflowSuggestion && <div className="suggestion-notice">{workflowSuggestion}</div>}
              <div className="panel-card">
                <div className="panel-title">Command</div>
                <div className="command-title">{selectedCommand.displayName}</div>
                <div className="required-checklist">
                  <div className="panel-title">Required Checklist</div>
                  <div className="checklist-items">
                    {checklistItems.map((item) => {
                      const content = (
                        <>
                          <span className={`checklist-dot ${item.complete ? 'done' : 'todo'}`} />
                          <span className="checklist-label">{item.label}</span>
                          <span className={`checklist-status ${item.complete ? 'done' : 'todo'}`}>
                            {item.complete ? 'Complete' : 'Missing'}
                          </span>
                        </>
                      );
                      if (item.sectionId) {
                        return (
                          <a key={item.id} className={`checklist-item ${item.complete ? 'done' : ''}`} href={`#${item.sectionId}`}>
                            {content}
                          </a>
                        );
                      }
                      return (
                        <div key={item.id} className={`checklist-item disabled ${item.complete ? 'done' : ''}`}>
                          {content}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <select value={selectedCommand.id} onChange={(e) => selectCommandWithGuardrail(e.target.value)} className="select">
                  {sortedCommands.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName} ({stageLabels[c.stage]})
                    </option>
                  ))}
                </select>
              </div>

              {basicSections.map((section) => (
                <div key={section.key} id={`section-${section.key}`} className="panel-card">
                  <div className="panel-title">{section.title}</div>
                  <div className="form">{section.fields.map((f) => renderField(f))}</div>
                  {section.key === 'intent' && intentFeedback && (
                    <div className={`quality-feedback ${intentFeedback.status}`}>{intentFeedback.message}</div>
                  )}
                  {section.key === 'context' && contextFeedback && (
                    <div className={`quality-feedback ${contextFeedback.status}`}>{contextFeedback.message}</div>
                  )}
                </div>
              ))}

              <div className="advanced-toggle">
                <button
                  className={`section-toggle ${advancedRequiredFields.length === 0 ? 'is-muted' : ''}`}
                  type="button"
                  onClick={() => setShowAdvanced((prev) => !prev)}
                >
                  {showAdvanced
                    ? `Hide advanced options · ${advancedRequiredFields.length} required`
                    : `Advanced options · ${advancedRequiredFields.length} required`}
                </button>
              </div>

              <div className={`advanced-panel ${showAdvanced ? 'open' : ''} ${missingAdvancedRequired.length > 0 ? 'needs-attention' : ''}`}>
                <div className="advanced-inner">
                  {advancedSections.map((section) => (
                    <div key={section.key} id={`section-${section.key}`} className="panel-card">
                      <div className="panel-title">{section.title}</div>
                      <div className="form">{section.fields.map((f) => renderField(f))}</div>
                      {section.key === 'constraints' && constraintsFeedback && (
                        <div className={`quality-feedback ${constraintsFeedback.status}`}>{constraintsFeedback.message}</div>
                      )}
                    </div>
                  ))}

                  <div className="panel-card">
                    <div className="panel-title">Attachments</div>
                    <label className="btn secondary file-picker">
                      选择文件
                      <input type="file" multiple className="file-input" onChange={(e) => handleFileUpload(e.target.files)} />
                    </label>
                    <div className="muted small">仅路径/片段/全文插入；片段默认前 2000 字符。</div>
                    <div className="inline-actions">
                      <select value={attachmentTarget} onChange={(e) => setAttachmentTarget(e.target.value)} className="select">
                        {attachableFields.map((f) => (
                          <option key={f.id} value={f.id}>
                            插入到：{f.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={attachmentMode}
                        onChange={(e) => setAttachmentMode(e.target.value as 'path' | 'snippet' | 'full')}
                        className="select"
                      >
                        <option value="path">仅路径</option>
                        <option value="snippet">片段</option>
                        <option value="full">全文</option>
                      </select>
                    </div>
                    <div className="attachment-list">
                      {attachments.map((a) => (
                        <button key={a.name} className="pill" onClick={() => removeAttachment(a.name)}>
                          {a.name} ×
                        </button>
                      ))}
                    </div>
                    {attachments.length > 0 && (
                    <button className="btn tertiary" onClick={() => insertAttachmentsToField(attachmentTarget, attachmentMode)}>
                      插入到字段
                    </button>
                    )}
                  </div>
                </div>
              </div>

              {showNextCard && nextRecommendation && (
                <NextStepCard
                  recommendation={nextRecommendation}
                  onUse={() => {
                    setShowNextCard(false);
                    selectCommandWithGuardrail(nextRecommendation.command, true);
                  }}
                  onBrowse={() => {
                    setShowNextCard(false);
                    setTab('commands');
                  }}
                />
              )}

              <div className="panel-card">
                <div className="panel-title">Variables</div>
                <div className="inline-actions">
                  <input
                    className="input"
                    placeholder="变量名（如 plan_output_path）"
                    value={newVarKey}
                    onChange={(e) => setNewVarKey(e.target.value)}
                  />
                  <input className="input" placeholder="变量值" value={newVarValue} onChange={(e) => setNewVarValue(e.target.value)} />
                  <button className="btn secondary" onClick={addVariable}>
                    添加变量
                  </button>
                </div>
                {Object.keys(variables).length > 0 && (
                  <div className="muted small">当前变量：{Object.entries(variables).map(([k, v]) => `${k}=${v}`).join(' | ')}</div>
                )}
              </div>
            </div>
            <div className="panel-card actions-panel">
              <div className="panel-title actions-kicker">Next step</div>
              <div className="actions-title">Generate &amp; Save</div>
              <div className="actions-subtitle">Create the final command output, then copy or export it.</div>
              <div className="inline-actions">
                <button className="btn primary" disabled={!canGenerate} onClick={handleAddHistory}>
                  生成并保存
                </button>
                <button className="btn secondary" disabled={!canGenerate} onClick={() => copyText(previewText)}>
                  复制命令
                </button>
                <button className="btn secondary" onClick={() => handleSingleExport('md', supportsSave ? 'save' : 'download')}>
                  <Icon name="export" /> 保存 .md
                </button>
                <button className="btn ghost" onClick={() => handleSingleExport('txt', 'download')}>
                  <Icon name="download" /> 下载 .txt
                </button>
                <button className="btn ghost" onClick={() => handleSingleExport('json', 'download')}>
                  <Icon name="download" /> 下载 .json
                </button>
                {supportsShare && (
                  <button className="btn ghost" onClick={() => handleSingleExport('txt', 'share')}>
                    <Icon name="share" /> 分享
                  </button>
                )}
              </div>
              {missingRequired.length > 0 && (
                <div className="muted small">缺少必填字段：{missingRequired.map((f) => f.label).join('、')}</div>
              )}
              {missingVars.length > 0 && <div className="muted small">缺少变量：{missingVars.join(', ')}</div>}
              {draftSavedAt && <div className="muted small">Draft autosaved to local storage at {formatDate(draftSavedAt)}.</div>}
            </div>
          </section>

          <section className="generator-preview">
            <div className="preview-panel">
              <div className="preview-header">
                <h3>预览</h3>
                <div className="preview-toolbar">
                  <button className="btn ghost" onClick={restoreUndoSnapshot} disabled={!undoSnapshot}>
                    撤销
                  </button>
                  {previewOverride !== null && (
                    <button className="btn ghost" onClick={() => setPreviewOverride(null)}>
                      重置预览
                    </button>
                  )}
                </div>
              </div>
              <div className="preview-surface">
                <div className="muted small preview-note">Edits here affect output only and do not update input fields.</div>
                <textarea
                  className="preview"
                  value={previewText}
                  onChange={(e) => setPreviewOverride(e.target.value)}
                  placeholder="可直接编辑预览内容（不回写表单）"
                />
              </div>
              <div className="muted small">缺失变量将显示为 &lt;&lt;MISSING:var&gt;&gt; ，必填字段缺失会阻断“生成并保存”。</div>
            </div>
          </section>
        </div>
      )}
      {tab === 'workflows' && (
        <div className="layout">
          <StageProgressBar status={guidanceState.stageStatus} />
          <section>
            <h3>工作流模板</h3>
            <div className="card-grid">
              {manifest.workflows.map((w) => {
                const optionalStages = Array.from(
                  new Set(
                    w.steps
                      .filter((s) => s.optional)
                      .map((s) => commandStageMap[s.commandId])
                      .filter(Boolean),
                  ),
                )
                  .sort((a, b) => stageFlow.indexOf(a) - stageFlow.indexOf(b))
                  .map((stage) => stageLabelMap[stage] ?? stage);
                return (
                  <div key={w.id} className="card">
                    <div className="card-title">{w.title}</div>
                    <div className="workflow-meta">
                      {w.intendedScenario && <div className="workflow-meta-row">Intended scenario: {w.intendedScenario}</div>}
                      {w.audience && <div className="workflow-meta-row">For: {w.audience === 'new user' ? 'New user' : 'Power user'}</div>}
                      <div className="workflow-meta-row">
                        Optional stages: {optionalStages.length > 0 ? optionalStages.join(', ') : 'None'}
                      </div>
                    </div>
                  <div className="workflow-steps">
                    {w.steps.map((s, idx) => (
                      <div key={s.stepId} className={`workflow-step ${idx === 0 ? 'is-first' : ''}`}>
                        <div className="workflow-step-title">
                          {idx + 1}. {s.commandId}
                        </div>
                        <div className="workflow-step-meta">
                          <span>步骤 {idx + 1}</span>
                    {idx === 0 && <span className="badge status-current">当前</span>}
                    {s.optional && <span className="badge optional">可选</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                <button className="btn secondary" onClick={() => startWorkflow(w.id)}>
                  从第 1 步开始
                </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {tab === 'workflow-run' && activeWorkflow && currentStep && workflowCommand && workflowFormState && (
        <div className="layout columns">
          <section className="column">
            <h3>{activeWorkflow.title}</h3>
            <div className="stepper">
              {activeWorkflow.steps.map((step, idx) => {
                const status = workflowStepStatus[step.stepId];
                return (
                  <button key={step.stepId} className={`step ${idx === workflowStepIndex ? 'active' : ''}`} onClick={() => setWorkflowStepIndex(idx)}>
                    {idx + 1}. {step.commandId} {step.optional ? '(可选)' : ''} {status === 'done' ? '✓' : status === 'skipped' ? '→' : ''}
                  </button>
                );
              })}
            </div>
            <div className="inline-actions">
              <button
                className="btn ghost"
                onClick={() => setWorkflowStepIndex((prev) => (prev > 0 ? prev - 1 : prev))}
              >
                上一步
              </button>
              <button
                className="btn ghost"
                onClick={() =>
                  setWorkflowStepIndex((prev) =>
                    activeWorkflow && prev < activeWorkflow.steps.length - 1 ? prev + 1 : prev,
                  )
                }
              >
                下一步
              </button>
              <button className="btn ghost" onClick={handleWorkflowReset}>
                退出工作流
              </button>
            </div>
            <div className="divider" />
            <h3>变量</h3>
            <div className="inline-actions">
              <input className="input" placeholder="变量名" value={workflowVarKey} onChange={(e) => setWorkflowVarKey(e.target.value)} />
              <input className="input" placeholder="变量值" value={workflowVarValue} onChange={(e) => setWorkflowVarValue(e.target.value)} />
              <button className="btn secondary" onClick={addWorkflowVariable}>
                添加
              </button>
            </div>
            {Object.keys(workflowVariables).length > 0 && (
              <div className="muted small">{Object.entries(workflowVariables).map(([k, v]) => `${k}=${v}`).join(' | ')}</div>
            )}
          </section>

          <section className="column">
            <h3>步骤：{workflowCommand.displayName}</h3>
            <div className="form">
              {workflowCommand.fields.map((f) => (
                <div key={f.id} className="field">
                  <label>
                    {f.label}
                    {f.required && <span className="required">*</span>}
                  </label>
                  {f.type === 'select' ? (
                    <select value={String(workflowFormState[f.id] ?? '')} onChange={(e) => updateWorkflowField(f.id, e.target.value)} className="input">
                      {(f.options ?? []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : f.type === 'boolean' ? (
                    <input type="checkbox" checked={Boolean(workflowFormState[f.id])} onChange={(e) => updateWorkflowField(f.id, e.target.checked)} />
                  ) : f.type === 'path' ? (
                    <div className="input-row">
                      <input
                        className="input"
                        value={(workflowFormState[f.id] as string) ?? ''}
                        placeholder="选择或输入路径"
                        onChange={(e) => updateWorkflowField(f.id, e.target.value)}
                      />
                      <button
                        className="btn ghost"
                        type="button"
                        disabled={!supportsDirectoryPicker}
                        onClick={() => pickDirectory((value) => updateWorkflowField(f.id, value))}
                      >
                        <Icon name="folder" /> 选文件夹
                      </button>
                    </div>
                  ) : f.type === 'list' ? (
                    <>
                      <textarea
                        className="input"
                        rows={3}
                        placeholder="每行一项"
                        value={(workflowFormState[f.id] as string[] | undefined)?.join('\n') ?? ''}
                        onChange={(e) => updateWorkflowList(f.id, e.target.value)}
                      />
                      <button className="btn danger" type="button" onClick={() => clearWorkflowFieldValue(f.id, f.type)}>
                        <Icon name="trash" /> 清空多行内容
                      </button>
                    </>
                  ) : (
                    <>
                      <textarea
                        className="input"
                        rows={f.type === 'text' ? 2 : 4}
                        value={(workflowFormState[f.id] as string) ?? ''}
                        onChange={(e) => updateWorkflowField(f.id, e.target.value)}
                      />
                      {f.type === 'multiline' && (
                        <button className="btn danger" type="button" onClick={() => clearWorkflowFieldValue(f.id, f.type)}>
                          <Icon name="trash" /> 清空多行内容
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="inline-actions" style={{ marginTop: 8 }}>
              <button className="btn primary" disabled={!canGenerateWorkflowStep} onClick={handleWorkflowGenerate}>
                生成并保存
              </button>
              <button className="btn tertiary" onClick={applyBindingsForStep}>
                应用变量绑定
              </button>
              <button className="btn tertiary" onClick={handleWorkflowSkip}>
                跳过此步
              </button>
            </div>
            {workflowMissingRequired.length > 0 && (
              <div className="muted small">缺少必填字段：{workflowMissingRequired.map((f) => f.label).join('、')}</div>
            )}
            {workflowMissingVars.length > 0 && <div className="muted small">缺少变量：{workflowMissingVars.join(', ')}</div>}
            <div className="divider" />
            <h3>附件</h3>
            <label className="btn secondary file-picker">
              选择文件
              <input type="file" multiple className="file-input" onChange={(e) => handleWorkflowFileUpload(e.target.files)} />
            </label>
            <div className="inline-actions">
              <select value={workflowAttachmentTarget} onChange={(e) => setWorkflowAttachmentTarget(e.target.value)} className="select">
                {workflowCommand.fields
                  .filter((f) => f.type !== 'select' && f.type !== 'boolean')
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      插入到：{f.label}
                    </option>
                  ))}
              </select>
              <select
                value={workflowAttachmentMode}
                onChange={(e) => setWorkflowAttachmentMode(e.target.value as 'path' | 'snippet' | 'full')}
                className="select"
              >
                <option value="path">仅路径</option>
                <option value="snippet">片段</option>
                <option value="full">全文</option>
              </select>
            </div>
            <div className="attachment-list">
              {workflowAttachmentsList.map((a) => (
                <div key={a.name} className="pill">
                  {a.name}
                </div>
              ))}
            </div>
            {workflowAttachmentsList.length > 0 && (
              <button className="btn tertiary" onClick={() => insertWorkflowAttachments(workflowAttachmentTarget, workflowAttachmentMode)}>
                插入到字段
              </button>
            )}
          </section>

          <section className="column">
            <h3>预览</h3>
            <textarea
              className="preview"
              value={workflowPreviewText}
              onChange={(e) => setWorkflowPreviewOverrides((prev) => ({ ...prev, [currentStep.stepId]: e.target.value }))}
              placeholder="可直接编辑预览内容（不回写表单）"
            />
            <div className="inline-actions">
              <button className="btn secondary" onClick={() => handleWorkflowExport('md', supportsSave ? 'save' : 'download')}>
                <Icon name="export" /> 保存 .md
              </button>
              <button className="btn ghost" onClick={() => handleWorkflowExport('txt', 'download')}>
                <Icon name="download" /> 下载 .txt
              </button>
              {supportsShare && (
                <button className="btn ghost" onClick={() => handleWorkflowExport('txt', 'share')}>
                  <Icon name="share" /> 分享
                </button>
              )}
            </div>
          </section>
        </div>
      )}
      {tab === 'history' && (
        <div className="layout">
          <section>
            <h3>历史记录</h3>
            <div className="card-grid">
              {history.length === 0 && <div className="muted">暂无历史</div>}
              {history.map((h) => (
                <div key={h.id} className="card history-card">
                  <div className="card-title">
                    {h.commandId} <span className="card-sub">{formatDate(h.createdAt)}</span>
                  </div>
                  <pre className="small muted code">
                    {h.commandText.slice(0, 200)}
                    {h.commandText.length > 200 ? '...' : ''}
                  </pre>
                  <div className="inline-actions history-actions">
                    <button className="btn secondary" onClick={() => copyText(h.commandText)}>
                      复制
                    </button>
                    <button
                      className="btn ghost"
                      onClick={() => {
                        setFormDraft(h.fields);
                        selectCommandWithGuardrail(h.commandId, true);
                      }}
                    >
                      复用
                    </button>
                    <button className="btn danger" onClick={() => removeHistoryItem(h.id)}>
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
