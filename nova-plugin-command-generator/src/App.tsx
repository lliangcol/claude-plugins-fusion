
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
type SaveFilePicker = (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
type DirectoryPicker = () => Promise<FileSystemDirectoryHandle>;

const stageLabels: Record<string, string> = {
  explore: '探索',
  plan: '规划',
  review: '评审',
  implement: '实施',
  finalize: '交付',
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
        使用命令 <code>{recommendation.command}</code>
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
        <div className="guardrail-title">建议先完成规划与评审</div>
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

type FieldOption = string | { value: string; label: string };

const normalizeOption = (option: FieldOption) =>
  typeof option === 'string' ? { value: option, label: option } : option;

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
  const draftAttachmentTargetRef = useRef<string | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [workflowStepIndex, setWorkflowStepIndex] = useState(0);
  const [workflowForms, setWorkflowForms] = useState<Record<string, FormState>>({});
  const [workflowAttachments, setWorkflowAttachments] = useState<Record<string, Attachment[]>>({});
  const [workflowVariables, setWorkflowVariables] = useState<Record<string, string>>({});
  const [workflowStepStatus, setWorkflowStepStatus] = useState<Record<string, 'pending' | 'done' | 'skipped'>>({});
  const [workflowPreviewOverrides, setWorkflowPreviewOverrides] = useState<Record<string, string>>({});
  const [workflowBindingsApplied, setWorkflowBindingsApplied] = useState<Record<string, boolean>>({});
  const [workflowStepOutputs, setWorkflowStepOutputs] = useState<Record<string, string>>({});
  const [workflowVarKey, setWorkflowVarKey] = useState('');
  const [workflowVarValue, setWorkflowVarValue] = useState('');
  const [workflowAttachmentTarget, setWorkflowAttachmentTarget] = useState('');
  const [workflowAttachmentMode, setWorkflowAttachmentMode] = useState<'path' | 'snippet' | 'full'>('snippet');
  const [commandStageFilter, setCommandStageFilter] = useState<'all' | StageKey>('all');
  const [commandRigorFilter, setCommandRigorFilter] = useState<'all' | 'weak' | 'medium' | 'strong'>('all');
  const [commandDomainFilter, setCommandDomainFilter] = useState<'all' | 'general' | 'specialized'>('all');
  const [showSpecializedCommands, setShowSpecializedCommands] = useState(false);

  const selectedCommand = useMemo(
    () => (selectedCommandId ? manifest.commands.find((c) => c.id === selectedCommandId) ?? null : null),
    [selectedCommandId],
  );
  const commandStageMap = useMemo(() => buildCommandStageMap(manifest.commands), []);
  const commandLookup = useMemo(() => new Map(manifest.commands.map((command) => [command.id, command])), []);
  const canAccessGenerator = Boolean(selectedCommandId);
  const stageLabelMap = useMemo(() => stageLabels, []);
  const workflowSuggestion = useMemo(() => {
    if (!selectedCommand) return null;
    const match = manifest.workflows.find((workflow) =>
      workflow.steps.some((step) => step.commandId === selectedCommand.id),
    );
    if (!match) return null;
    return `该命令常用于工作流：${match.title}。`;
  }, [selectedCommand]);

  useEffect(() => {
    if (!selectedCommand) return;
    setFormState(formDraft ?? initForm(selectedCommand));
    setFormDraft(null);
    if (draftRestoreRef.current) {
      draftRestoreRef.current = false;
      if (!draftAttachmentTargetRef.current) {
        setAttachmentTarget(getDefaultAttachmentTarget(selectedCommand));
      }
      draftAttachmentTargetRef.current = null;
      return;
    }
    setVariables({});
    setAttachments([]);
    setPreviewOverride(null);
    setAttachmentMode('snippet');
    setAttachmentTarget(getDefaultAttachmentTarget(selectedCommand));
  }, [selectedCommandId, selectedCommand, formDraft]);

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
    showFeedback('已生成并保存到历史记录。');
  };

  const MAX_ATTACHMENT_BYTES = 200 * 1024;

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;
    const next: Attachment[] = [];
    for (const file of Array.from(files)) {
      try {
        const text = await file.slice(0, MAX_ATTACHMENT_BYTES).text();
        const snippet = text.slice(0, 2000);
        next.push({ name: file.name, content: snippet });
      } catch {
        showFeedback(`附件读取失败：${file.name}`);
      }
    }
    setAttachments((prev) => [...prev, ...next]);
  };

  const insertAttachmentsToField = (fieldId: string, mode: 'path' | 'snippet' | 'full') => {
    if (!selectedCommand) return;
    const fieldDef = selectedCommand.fields.find((f) => f.id === fieldId);
    if (!fieldDef) return;
    if (fieldDef.type === 'list') {
      const existing = Array.isArray(formState[fieldId]) ? (formState[fieldId] as string[]) : [];
      const items = attachments.map((a) => `文件：${a.name}`);
      setFormState((prev) => ({ ...prev, [fieldId]: [...existing, ...items] }));
      return;
    }
    const field = formState[fieldId];
    const existing = typeof field === 'string' ? field : '';
    const joined = attachments
      .map((a) => {
        if (mode === 'path') return `- 文件：${a.name}`;
        if (mode === 'snippet') return `- 文件：${a.name}\n  ---\n  ${a.content}\n  ---`;
        return `- 文件：${a.name}\n  ---\n  ${a.content}\n  ---`;
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
        '已导出到下载目录。',
      );
      return;
    }
    if (mode === 'save') {
      const showSaveFilePicker = (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
      if (!showSaveFilePicker) {
        exportBlob(payload.content, payload.filename, payload.type);
        return;
      }
      try {
        const handle = await showSaveFilePicker({
          suggestedName: payload.filename,
          types: [{ description: payload.type, accept: { [payload.type]: [`.${kind}`] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(payload.content);
        await writable.close();
        showFeedback('已保存到指定位置。');
      } catch {
        exportBlob(payload.content, payload.filename, payload.type, '保存失败，已改为下载。');
      }
      return;
    }
    if (mode === 'share' && navigator.share) {
      try {
        await navigator.share({ title: selectedCommand.displayName, text: payload.content });
        showFeedback('已通过系统分享。');
        return;
      } catch {
        exportBlob(
          payload.content,
          payload.filename,
          payload.type,
          '已导出到下载目录。',
        );
        return;
      }
    }
    exportBlob(
      payload.content,
      payload.filename,
      payload.type,
      '已导出到下载目录。',
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
        type: 'workflow' as const,
        label: '工作流',
        cta: '开始引导',
        note: '该场景包含多步骤，建议用工作流保持节奏一致。',
      };
    }
    return {
      type: 'command' as const,
      label: '单命令',
      cta: '直接开始',
      note: '该场景只需单条命令即可完成。',
    };
  };

  const sceneCards = (scenarios: ScenarioDefinition[]) =>
    scenarios.map((s) => {
      const recommendation = getSceneRecommendation(s);
      const hasWorkflow = Boolean(s.recommendWorkflowId);
      const hasCommand = Boolean(s.recommendCommandId);
      const primaryCta = recommendation.cta;
      const categoryTags = Array.from(
        new Set(
          s.category
            .split(/[,/|·]/)
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ).slice(0, 2);
      const secondaryLabel =
        recommendation.type === 'workflow'
          ? hasCommand
            ? '转为单命令'
            : '查看命令'
          : hasWorkflow
            ? '进入工作流'
            : '查看工作流';
      return (
        <div
          key={s.id}
          className={`card scene-card ${s.recommendCommandId || s.recommendWorkflowId ? 'recommended' : ''}`.trim()}
        >
          <div className="scene-card-header">
            <div className="card-title">{s.title}</div>
            <div className="scene-tags">
              {categoryTags.map((tag) => (
                <span key={tag} className="scene-tag">
                  {tag}
                </span>
              ))}
            </div>
            <div className="scene-problem-label">问题类型</div>
            <div className="scene-problem">{s.category}</div>
          </div>
          <div className={`scene-path scene-path-${recommendation.type}`}>
            <div className="scene-path-label">
              <Icon name={recommendation.type === 'workflow' ? 'workflows' : 'commands'} />
              推荐路径
            </div>
            <div className="scene-path-value">{recommendation.label}</div>
            <div className="scene-path-why">{recommendation.note}</div>
          </div>
          <div className="card-actions">
            {recommendation.type === 'workflow' && s.recommendWorkflowId ? (
              <button className="btn primary" onClick={() => startWorkflow(s.recommendWorkflowId)}>
                {primaryCta}
              </button>
            ) : s.recommendCommandId ? (
              <button className="btn primary" onClick={() => setCommandAndSwitch(s.recommendCommandId)}>
                {primaryCta}
              </button>
            ) : (
              <button className="btn primary" onClick={() => setTab('commands')}>
                {primaryCta}
              </button>
            )}
            <button
              className="btn ghost"
              onClick={() => {
                if (recommendation.type === 'workflow') {
                  if (s.recommendCommandId) {
                    setCommandAndSwitch(s.recommendCommandId);
                    return;
                  }
                  setTab('commands');
                  return;
                }
                if (s.recommendWorkflowId) {
                  startWorkflow(s.recommendWorkflowId);
                  return;
                }
                setTab('workflows');
              }}
            >
              {secondaryLabel}
            </button>
          </div>
        </div>
      );
    });

  const getCommandPrerequisites = (command: CommandDefinition) => {
    const requiredFields = command.fields.filter((field) => field.required);
    const prereqLabels = requiredFields.map((field) => field.label);
    const hasStrongPrereq =
      command.constraintLevel === 'strong' ||
      requiredFields.length >= 2 ||
      requiredFields.some((field) => /APPROV|PLAN|REVIEW|SPEC|DESIGN/i.test(`${field.id} ${field.label}`));
    const hasArtifactHint = requiredFields.some((field) => /APPROV|PLAN|REVIEW|SPEC|DESIGN/i.test(`${field.id} ${field.label}`));
    return {
      requiredFields,
      prereqLabels,
      hasStrongPrereq,
      hasArtifactHint,
    };
  };

const getCommandDisplayTitle = (command: CommandDefinition) => {
    return command.displayName;
  };

  const renderCommandCard = (command: CommandDefinition) => {
    const prereq = getCommandPrerequisites(command);
    return (
      <div key={command.id} className="card">
        <div className="card-title">{getCommandDisplayTitle(command)}</div>
        <div className="command-id">
          命令标识 <code>{command.id}</code>
        </div>
        <div className="command-meta">
          <span className="badge">{stageLabels[command.stage]}</span>
          <span
            className={`badge ${
              command.constraintLevel === 'strong'
                ? 'rigor-strict'
                : command.constraintLevel === 'medium'
                  ? 'rigor-standard'
                  : 'rigor-lite'
            }`}
          >
            {constraintLabel[command.constraintLevel]}
          </span>
          {command.constraintLevel === 'strong' && <span className="badge severity-high">高影响</span>}
        </div>
        <div className="card-sub">{command.description}</div>
        {prereq.requiredFields.length > 0 && prereq.hasStrongPrereq ? (
          <div className="command-warning" title={prereq.prereqLabels.join(' + ')}>
            使用前需提供：{prereq.prereqLabels.join(' + ')}
            {prereq.hasArtifactHint && (
              <button className="link-inline" type="button" onClick={() => setTab('history')}>
                查看产出
              </button>
            )}
          </div>
        ) : prereq.requiredFields.length > 0 ? (
          <div className="command-prereq">必填：{prereq.prereqLabels.join(' + ')}</div>
        ) : null}
        <div className="card-actions">
          <button className="btn primary" onClick={() => setCommandAndSwitch(command.id)}>
            进入生成器
          </button>
        </div>
      </div>
    );
  };

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

  const isSpecializedCommand = (command: CommandDefinition) =>
    /backend|frontend|ios|android|java|spring|database|db|infra|security|ml|data/i.test(
      `${command.id} ${command.displayName} ${command.description}`,
    );

  const filteredCommands = useMemo(() => {
    return sortedCommands.filter((command) => {
      const stageOk = commandStageFilter === 'all' || command.stage === commandStageFilter;
      const rigorOk = commandRigorFilter === 'all' || command.constraintLevel === commandRigorFilter;
      return stageOk && rigorOk;
    });
  }, [sortedCommands, commandStageFilter, commandRigorFilter]);

  const filteredGeneralCommands = useMemo(
    () => filteredCommands.filter((command) => !isSpecializedCommand(command)),
    [filteredCommands],
  );
  const filteredSpecializedCommands = useMemo(
    () => filteredCommands.filter((command) => isSpecializedCommand(command)),
    [filteredCommands],
  );

  const groupedGeneralCommands = useMemo(() => {
    const groups: Record<string, CommandDefinition[]> = {};
    filteredGeneralCommands.forEach((command) => {
      groups[command.stage] = groups[command.stage] || [];
      groups[command.stage].push(command);
    });
    return groups;
  }, [filteredGeneralCommands]);

  const groupedSpecializedCommands = useMemo(() => {
    const groups: Record<string, CommandDefinition[]> = {};
    filteredSpecializedCommands.forEach((command) => {
      groups[command.stage] = groups[command.stage] || [];
      groups[command.stage].push(command);
    });
    return groups;
  }, [filteredSpecializedCommands]);

  useEffect(() => {
    if (commandDomainFilter === 'specialized') {
      setShowSpecializedCommands(true);
    }
  }, [commandDomainFilter]);

  const attachableFields = selectedCommand
    ? selectedCommand.fields.filter((f) => f.type !== 'select' && f.type !== 'boolean')
    : [];

  useEffect(() => {
    const draft = loadDraft();
    if (!draft) return;
    draftRestoreRef.current = true;
    draftAttachmentTargetRef.current = draft.attachmentTarget ?? null;
    setFormDraft(draft.formState);
    setSelectedCommandId(draft.selectedCommandId);
    setVariables(draft.variables ?? {});
    setAttachments(draft.attachments ?? []);
    const draftCommand =
      manifest.commands.find((command) => command.id === draft.selectedCommandId) ?? manifest.commands[0];
    setAttachmentTarget(draft.attachmentTarget ?? getDefaultAttachmentTarget(draftCommand));
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
    () => (activeWorkflow ? { workflowTemplate: activeWorkflow.id } : undefined),
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
      { key: 'intent', title: '意图', match: (f: FieldDefinition) => /INTENT/i.test(f.id) },
      { key: 'context', title: '上下文', match: (f: FieldDefinition) => /CONTEXT/i.test(f.id) },
      { key: 'constraints', title: '约束', match: (f: FieldDefinition) => /CONSTRAINTS/i.test(f.id) },
      { key: 'depth', title: '深度', match: (f: FieldDefinition) => f.id === 'DEPTH' },
      { key: 'export', title: '导出路径', match: (f: FieldDefinition) => f.type === 'path' },
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
      resolved.push({ key: 'details', title: '其他信息', fields: otherFields });
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
  const workflowSavedOutput = currentStep ? workflowStepOutputs[currentStep.stepId] ?? null : null;
  const workflowHasSavedOutput = Boolean(workflowSavedOutput);
  const workflowStepTotal = activeWorkflow?.steps.length ?? 0;
  const workflowCurrentNumber = workflowStepIndex + 1;
  const workflowCompletedCount = activeWorkflow
    ? activeWorkflow.steps.filter((step) => workflowStepStatus[step.stepId] === 'done').length
    : 0;
  const workflowSkippedCount = activeWorkflow
    ? activeWorkflow.steps.filter((step) => workflowStepStatus[step.stepId] === 'skipped').length
    : 0;
  const workflowRemainingCount = Math.max(workflowStepTotal - workflowCompletedCount - workflowSkippedCount, 0);
  const workflowProgressPercent = workflowStepTotal > 0 ? Math.min((workflowCurrentNumber / workflowStepTotal) * 100, 100) : 0;
  const workflowCurrentStatus = currentStep ? workflowStepStatus[currentStep.stepId] ?? 'pending' : 'pending';
  const workflowNextStep =
    activeWorkflow && workflowStepIndex < workflowStepTotal - 1 ? activeWorkflow.steps[workflowStepIndex + 1] : null;
  const workflowNextCommand = workflowNextStep ? commandLookup.get(workflowNextStep.commandId) ?? null : null;
  const workflowNextLabel = workflowNextCommand?.displayName ?? workflowNextStep?.commandId ?? '';
  const workflowPrevStep = activeWorkflow && workflowStepIndex > 0 ? activeWorkflow.steps[workflowStepIndex - 1] : null;
  const workflowPrevCommand = workflowPrevStep ? commandLookup.get(workflowPrevStep.commandId) ?? null : null;
  const workflowPrevLabel = workflowPrevCommand?.displayName ?? workflowPrevStep?.commandId ?? '';
  const workflowOptionalLabels = activeWorkflow
    ? activeWorkflow.steps
        .filter((step) => step.optional)
        .map((step) => commandLookup.get(step.commandId)?.displayName ?? step.commandId)
    : [];
  const workflowStepFraming = (() => {
    if (!workflowCommand || !currentStep) return '';
    const optionalNote = currentStep.optional ? '该可选步骤' : '该步骤';
    const prevNote = workflowPrevLabel ? '承接前序输出' : '用于奠定工作流基础';
    const nextNote = workflowNextLabel ? '以便下一步继续使用' : '以便完成工作流收尾';
    return `${optionalNote}用于产出当前阶段成果，${prevNote}，${nextNote}。`;
  })();
  useEffect(() => {
    if (!currentStep || !workflowCommand) return;
    setWorkflowForms((prev) => {
      if (prev[currentStep.stepId]) return prev;
      return { ...prev, [currentStep.stepId]: initForm(workflowCommand) };
    });
    setWorkflowAttachmentTarget(getDefaultAttachmentTarget(workflowCommand));
    setWorkflowAttachmentMode('snippet');
  }, [currentStep, workflowCommand]);

  const updateWorkflowForm = useCallback((updater: (current: FormState) => FormState) => {
    if (!currentStep || !workflowCommand) return;
    setWorkflowForms((prev) => {
      const current = prev[currentStep.stepId] ?? initForm(workflowCommand);
      const next = updater(current);
      return { ...prev, [currentStep.stepId]: next };
    });
  }, [currentStep, workflowCommand]);

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
      try {
        const text = await file.slice(0, MAX_ATTACHMENT_BYTES).text();
        next.push({ name: file.name, content: text.slice(0, 2000) });
      } catch {
        showFeedback(`附件读取失败：${file.name}`);
      }
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
      const items = workflowAttachmentsList.map((a) => `文件：${a.name}`);
      updateWorkflowForm((current) => ({ ...current, [fieldId]: [...existing, ...items] }));
      return;
    }
    const existing = typeof workflowFormState[fieldId] === 'string' ? (workflowFormState[fieldId] as string) : '';
    const joined = workflowAttachmentsList
      .map((a) => {
        if (mode === 'path') return `- 文件：${a.name}`;
        if (mode === 'snippet') return `- 文件：${a.name}\n  ---\n  ${a.content}\n  ---`;
        return `- 文件：${a.name}\n  ---\n  ${a.content}\n  ---`;
      })
      .join('\n');
    updateWorkflowField(fieldId, `${existing}\n${joined}`.trim());
  };

  useEffect(() => {
    if (!currentStep || !workflowCommand) return;
    if (workflowBindingsApplied[currentStep.stepId]) return;
    if (!currentStep.autoBindings || currentStep.autoBindings.length === 0) {
      setWorkflowBindingsApplied((prev) => ({ ...prev, [currentStep.stepId]: true }));
      return;
    }
    updateWorkflowForm((current) => {
      const next = { ...current };
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
    setWorkflowBindingsApplied((prev) => ({ ...prev, [currentStep.stepId]: true }));
  }, [currentStep, workflowCommand, workflowBindingsApplied, workflowVariables, updateWorkflowForm, activeWorkflowId]);

  const moveToWorkflowStep = (index: number, notice?: string) => {
    if (!activeWorkflow) return;
    if (index < 0 || index >= activeWorkflow.steps.length) return;
    setWorkflowStepIndex(index);
    if (tab === 'workflow-run') {
      showFeedback(notice ?? `已切换到步骤 ${index + 1}/${activeWorkflow.steps.length}。`);
    }
  };

  const scrollToWorkflowSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const showWorkflowSavedOutput = () => {
    if (!currentStep || !workflowSavedOutput) return;
    setWorkflowPreviewOverrides((prev) => ({ ...prev, [currentStep.stepId]: workflowSavedOutput }));
    showFeedback('已加载上次保存的输出。');
    scrollToWorkflowSection('workflow-preview');
  };

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
    setWorkflowStepOutputs((prev) => ({ ...prev, [currentStep.stepId]: workflowPreviewText }));
    setWorkflowStepStatus((prev) => ({ ...prev, [currentStep.stepId]: 'done' }));
    showFeedback('已生成并保存本步骤输出。');
  };

  const handleWorkflowSkip = () => {
    if (!currentStep) return;
    setWorkflowStepStatus((prev) => ({ ...prev, [currentStep.stepId]: 'skipped' }));
    if (activeWorkflow && workflowStepIndex < activeWorkflow.steps.length - 1) {
      const nextIndex = workflowStepIndex + 1;
      moveToWorkflowStep(nextIndex, `已跳过步骤 ${workflowCurrentNumber}，进入步骤 ${nextIndex + 1}。`);
      return;
    }
    showFeedback(`已跳过步骤 ${workflowCurrentNumber}/${workflowStepTotal}。`);
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
      const showSaveFilePicker = (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
      if (!showSaveFilePicker) {
        exportBlob(payload.content, payload.filename, payload.type);
        return;
      }
      try {
        const handle = await showSaveFilePicker({
          suggestedName: payload.filename,
          types: [{ description: payload.type, accept: { [payload.type]: [`.${kind}`] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(payload.content);
        await writable.close();
        showFeedback('已保存到指定位置。');
      } catch {
        exportBlob(payload.content, payload.filename, payload.type, '保存失败，已改为下载。');
      }
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
    const showDirectoryPicker = (window as unknown as { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker;
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
      showFeedback('已复制到剪贴板。');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showFeedback('已复制到剪贴板。');
    }
  };

  const renderField = (f: FieldDefinition, options?: { hideLabel?: boolean }) => {
    const inputId = `field-${selectedCommandId}-${f.id}`;
    const ariaLabel = options?.hideLabel ? f.label : undefined;
    return (
      <div key={f.id} className="field">
        {!options?.hideLabel && (
          <label className="field-label" htmlFor={inputId}>
            {f.label}
            {f.required && <span className="required">*</span>}
          </label>
        )}
        {f.type === 'select' ? (
          <select
            id={inputId}
            aria-label={ariaLabel}
            value={String(formState[f.id] ?? '')}
            onChange={(e) => handleFieldChange(f.id, e.target.value)}
            className="input"
          >
            {(f.options ?? []).map((option) => {
              const normalized = normalizeOption(option);
              return (
                <option key={normalized.value} value={normalized.value}>
                  {normalized.label}
                </option>
              );
            })}
          </select>
        ) : f.type === 'boolean' ? (
          <input
            id={inputId}
            aria-label={ariaLabel ?? f.label}
            type="checkbox"
            checked={Boolean(formState[f.id])}
            onChange={(e) => handleFieldChange(f.id, e.target.checked)}
          />
        ) : f.type === 'path' ? (
          <div className="input-row">
            <input
              id={inputId}
              aria-label={ariaLabel}
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
              id={inputId}
              aria-label={ariaLabel}
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
              id={inputId}
              aria-label={ariaLabel}
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
  };

  const checklistItems = useMemo(() => {
    const items = [
      { id: 'intent', label: '意图', sectionKey: 'intent' },
      { id: 'context', label: '上下文', sectionKey: 'context' },
      { id: 'constraints', label: '约束', sectionKey: 'constraints' },
      { id: 'paths', label: '路径', sectionKey: 'export' },
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
        <div className="title">命令生成器</div>
        <div className="tabs">
          <button type="button" className={tab === 'scenes' ? 'tab active' : 'tab'} onClick={() => setTab('scenes')}>
            <Icon name="scenes" />
            从场景开始
          </button>
          <button type="button" className={tab === 'commands' ? 'tab active' : 'tab'} onClick={() => setTab('commands')}>
            <Icon name="commands" />
            手动选择
          </button>
          <button
            type="button"
            className={tab === 'generator' ? 'tab active' : 'tab'}
            onClick={() => (canAccessGenerator ? setTab('generator') : null)}
            disabled={!canAccessGenerator}
          >
            <Icon name="generator" />
            执行工作区（非起点）
          </button>
          <button type="button" className={tab === 'workflows' ? 'tab active' : 'tab'} onClick={() => setTab('workflows')}>
            <Icon name="workflows" />
            工作流
          </button>
          {activeWorkflowId && (
            <button
              type="button"
              className={tab === 'workflow-run' ? 'tab active' : 'tab'}
              onClick={() => setTab('workflow-run')}
            >
              <Icon name="steps" />
              步骤
            </button>
          )}
          <button type="button" className={tab === 'history' ? 'tab active' : 'tab'} onClick={() => setTab('history')}>
            <Icon name="history" />
            历史
          </button>
        </div>
      </header>

      {tab === 'scenes' && (
        <div className="layout">
          <div className="panel-card scene-intro">
            <div className="panel-title">如何开始</div>
            <div className="scene-intro-text">从场景开始，获得引导路径。</div>
            <button className="btn ghost" onClick={() => setTab('commands')}>
              想手动？查看命令
            </button>
          </div>
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
          <div className="filter-bar">
            <div className="filter-group">
              <span className="filter-label">阶段</span>
              <select
                className="select"
                value={commandStageFilter}
                onChange={(e) => setCommandStageFilter(e.target.value as 'all' | StageKey)}
              >
                <option value="all">全部阶段</option>
                {stageFlow.map((stage) => (
                  <option key={stage} value={stage}>
                    {stageLabels[stage]}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <span className="filter-label">严格度</span>
              <select
                className="select"
                value={commandRigorFilter}
                onChange={(e) => setCommandRigorFilter(e.target.value as 'all' | 'weak' | 'medium' | 'strong')}
              >
                <option value="all">全部</option>
                <option value="weak">轻量</option>
                <option value="medium">标准</option>
                <option value="strong">严格</option>
              </select>
            </div>
            <div className="filter-group">
              <span className="filter-label">领域</span>
              <select
                className="select"
                value={commandDomainFilter}
                onChange={(e) => setCommandDomainFilter(e.target.value as 'all' | 'general' | 'specialized')}
              >
                <option value="all">通用 + 专项</option>
                <option value="general">通用</option>
                <option value="specialized">专项</option>
              </select>
            </div>
          </div>

          {commandDomainFilter !== 'specialized' &&
            stageFlow.map((stage) => {
              const cmds = groupedGeneralCommands[stage] ?? [];
              if (cmds.length === 0) return null;
              return (
                <section key={stage} className="section-shell">
                  <h3 className="section-title">
                    <Icon name="commands" />
                    {stageLabels[stage]}（{cmds.length}）
                  </h3>
                  <div className="card-grid">{cmds.map(renderCommandCard)}</div>
                </section>
              );
            })}

          {commandDomainFilter !== 'general' && (
            <section className="section-shell specialized-shell">
              <button
                className={`section-toggle ${filteredSpecializedCommands.length === 0 ? 'is-muted' : ''}`}
                onClick={() => setShowSpecializedCommands((prev) => !prev)}
                disabled={filteredSpecializedCommands.length === 0}
              >
                专项命令（{filteredSpecializedCommands.length}）
              </button>
              {showSpecializedCommands && filteredSpecializedCommands.length > 0 && (
                <div className="specialized-group">
                  {stageFlow.map((stage) => {
                    const cmds = groupedSpecializedCommands[stage] ?? [];
                    if (cmds.length === 0) return null;
                    return (
                      <div key={stage} className="specialized-stage">
                        <div className="specialized-stage-title">
                          {stageLabels[stage]}（{cmds.length}）
                        </div>
                        <div className="card-grid">{cmds.map(renderCommandCard)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
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
                <div className="panel-title">命令</div>
                <div className="command-title">{selectedCommand.displayName}</div>
                <div className="required-checklist">
                  <div className="panel-title">必填检查</div>
                  <div className="checklist-items">
                    {checklistItems.map((item) => {
                      const content = (
                        <>
                          <span className={`checklist-dot ${item.complete ? 'done' : 'todo'}`} />
                          <span className="checklist-label">{item.label}</span>
                          <span className={`checklist-status ${item.complete ? 'done' : 'todo'}`}>
                            {item.complete ? '已完成' : '缺失'}
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
                      {c.displayName}
                    </option>
                  ))}
                </select>
              </div>

              {basicSections.map((section) => (
                <div key={section.key} id={`section-${section.key}`} className="panel-card">
                  <div className="panel-title">{section.title}</div>
                  <div className="form">
                    {section.fields.map((f) =>
                      renderField(f, { hideLabel: section.fields.length === 1 && section.title === f.label }),
                    )}
                  </div>
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
                    ? `隐藏高级选项 · 必填 ${advancedRequiredFields.length} 项`
                    : `高级选项 · 必填 ${advancedRequiredFields.length} 项`}
                </button>
              </div>

              <div className={`advanced-panel ${showAdvanced ? 'open' : ''} ${missingAdvancedRequired.length > 0 ? 'needs-attention' : ''}`}>
                <div className="advanced-inner">
                  {advancedSections.map((section) => (
                    <div key={section.key} id={`section-${section.key}`} className="panel-card">
                      <div className="panel-title">{section.title}</div>
                      <div className="form">
                        {section.fields.map((f) =>
                          renderField(f, { hideLabel: section.fields.length === 1 && section.title === f.label }),
                        )}
                      </div>
                      {section.key === 'constraints' && constraintsFeedback && (
                        <div className={`quality-feedback ${constraintsFeedback.status}`}>{constraintsFeedback.message}</div>
                      )}
                    </div>
                  ))}

                  <div className="panel-card">
                    <div className="panel-title">附件</div>
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
                <div className="panel-title">变量</div>
                <div className="inline-actions">
                  <input
                    className="input"
                    placeholder="变量名"
                    value={newVarKey}
                    onChange={(e) => setNewVarKey(e.target.value)}
                  />
                  <input className="input" placeholder="变量值" value={newVarValue} onChange={(e) => setNewVarValue(e.target.value)} />
                  <button className="btn secondary" onClick={addVariable}>
                    添加变量
                  </button>
                </div>
                {Object.keys(variables).length > 0 && (
                  <div className="muted small">
                    当前变量 <code>{Object.entries(variables).map(([k, v]) => `${k}=${v}`).join(' | ')}</code>
                  </div>
                )}
              </div>
            </div>
            <div className="panel-card actions-panel">
              <div className="panel-title actions-kicker">下一步</div>
              <div className="actions-title">生成并保存</div>
              <div className="actions-subtitle">生成最终命令文本，可复制或导出。</div>
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
              {missingVars.length > 0 && (
                <div className="muted small">
                  缺少变量 <code>{missingVars.join(', ')}</code>
                </div>
              )}
              {draftSavedAt && <div className="muted small">草稿已自动保存：{formatDate(draftSavedAt)}。</div>}
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
                <div className="muted small preview-note">此处编辑仅影响输出，不会回写输入字段。</div>
                <textarea
                  className="preview"
                  value={previewText}
                  onChange={(e) => setPreviewOverride(e.target.value)}
                  placeholder="可直接编辑预览内容（不回写表单）"
                />
              </div>
              <div className="muted small">
                缺失变量将显示为 <code>&lt;&lt;MISSING:var&gt;&gt;</code>，必填字段缺失会阻断“生成并保存”。
              </div>
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
                      {w.intendedScenario && <div className="workflow-meta-row">适用场景：{w.intendedScenario}</div>}
                      {w.audience && <div className="workflow-meta-row">适用人群：{w.audience === 'new user' ? '新手' : '高阶用户'}</div>}
                      <div className="workflow-meta-row">
                        可选阶段：{optionalStages.length > 0 ? optionalStages.join('、') : '无'}
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
        <div className="layout workflow-layout">
          <div className="panel-card workflow-hero">
            <div className="workflow-hero-main">
              <div className="panel-title">工作流概览</div>
              <div className="workflow-hero-title">{activeWorkflow.title}</div>
              <div className="workflow-hero-subtitle">
                {activeWorkflow.description ?? activeWorkflow.intendedScenario ?? '按步骤完成工作流并保持输出一致。'}
              </div>
              {(activeWorkflow.intendedScenario || workflowOptionalLabels.length > 0) && (
                <div className="workflow-guidance">
                  {activeWorkflow.intendedScenario && (
                    <div className="workflow-guidance-line">
                      适用场景：{activeWorkflow.intendedScenario}
                    </div>
                  )}
                  {workflowOptionalLabels.length > 0 && (
                    <div className="workflow-guidance-line">
                      高阶用户常跳过：<code>{workflowOptionalLabels.join('、')}</code>
                    </div>
                  )}
                </div>
              )}
              <div className="workflow-hero-tags">
                {activeWorkflow.audience && (
                  <span className="badge">{activeWorkflow.audience === 'new user' ? '适合新手' : '适合高阶用户'}</span>
                )}
                {currentStep.optional && <span className="badge optional">可选</span>}
                <span className="badge">{stageLabels[workflowCommand.stage]}</span>
              </div>
            </div>
            <div className="workflow-hero-progress">
              <div className="workflow-progress-header">
                <div className="panel-title">进度</div>
                <div className="workflow-progress-count">
                  {workflowCurrentNumber}/{workflowStepTotal}
                </div>
              </div>
              <div className="workflow-progress-bar">
                <span style={{ width: `${workflowProgressPercent}%` }} />
              </div>
              <div className="workflow-progress-meta">
                已完成 {workflowCompletedCount} · 已跳过 {workflowSkippedCount} · 剩余 {workflowRemainingCount}
              </div>
              <div className="workflow-next-panel">
                <div className="panel-title">下一步</div>
                {workflowNextStep ? (
                  <div className="workflow-next-step">
                    <div className="workflow-next-title">
                      {workflowCurrentNumber + 1}. {workflowNextCommand?.displayName ?? workflowNextStep.commandId}
                    </div>
                    <div className="workflow-next-meta">
                      {workflowNextStep.optional && <span className="badge optional">可选</span>}
                      {workflowNextCommand && <span className="badge">{stageLabels[workflowNextCommand.stage]}</span>}
                    </div>
                  </div>
                ) : (
                  <div className="muted small">已进入最后一步，完成即可结束工作流。</div>
                )}
              </div>
            </div>
          </div>

          {feedbackMessage && <div className="success-notice workflow-feedback">{feedbackMessage}</div>}

          <div className="workflow-columns">
            <section className="workflow-rail">
              <div className="panel-card journey-panel">
                <div className="panel-title">流程地图</div>
                <div className="journey-steps">
                  {activeWorkflow.steps.map((step, idx) => {
                    const status = workflowStepStatus[step.stepId] ?? 'pending';
                    const isCurrent = idx === workflowStepIndex;
                    const command = commandLookup.get(step.commandId);
                    const label = command?.displayName ?? step.commandId;
                    const statusKey = status === 'done' || status === 'skipped' ? status : isCurrent ? 'current' : 'todo';
                    const statusLabel = status === 'done' ? '已完成' : status === 'skipped' ? '已跳过' : isCurrent ? '进行中' : '待处理';
                    const statusClass = status === 'done' ? 'done' : status === 'skipped' ? 'skipped' : isCurrent ? 'current' : 'upcoming';
                    return (
                      <button
                        key={step.stepId}
                        className={`journey-step ${statusClass} ${step.optional ? 'optional' : ''}`}
                        onClick={() => moveToWorkflowStep(idx)}
                      >
                        <div className="journey-step-index">{idx + 1}</div>
                        <div className="journey-step-body">
                          <div className="journey-step-title">
                            {command ? `${stageLabels[command.stage]} · ${label}` : label}
                            {step.optional && <span className="badge optional">可选</span>}
                          </div>
                          <div className="journey-step-meta">
                            <span className={`badge status-${statusKey}`}>{statusLabel}</span>
                            {command && <span className="badge">{stageLabels[command.stage]}</span>}
                            {step.optional && <span className="journey-step-note muted small">跳过后仍可继续工作流。</span>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="divider" />
                <div className="inline-actions">
                  <button
                    className="btn ghost"
                    onClick={() => moveToWorkflowStep(workflowStepIndex - 1)}
                    disabled={workflowStepIndex === 0}
                  >
                    上一步
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => moveToWorkflowStep(workflowStepIndex + 1)}
                    disabled={workflowStepIndex >= workflowStepTotal - 1}
                  >
                    下一步
                  </button>
                </div>
                <button className="btn ghost" onClick={handleWorkflowReset}>
                  退出工作流
                </button>
              </div>

              <div className="panel-card">
                <div className="panel-title">变量</div>
                <div className="inline-actions">
                  <input className="input" placeholder="变量名" value={workflowVarKey} onChange={(e) => setWorkflowVarKey(e.target.value)} />
                  <input className="input" placeholder="变量值" value={workflowVarValue} onChange={(e) => setWorkflowVarValue(e.target.value)} />
                  <button className="btn secondary" onClick={addWorkflowVariable}>
                    添加
                  </button>
                </div>
                {Object.keys(workflowVariables).length > 0 && (
                  <div className="muted small">
                    当前变量 <code>{Object.entries(workflowVariables).map(([k, v]) => `${k}=${v}`).join(' | ')}</code>
                  </div>
                )}
              </div>
            </section>

            <section className="workflow-main">
              <div className="panel-card">
                <div className="panel-title">当前步骤</div>
                <div className="command-title">{workflowCommand.displayName}</div>
                <div className="muted small">{workflowStepFraming}</div>
                <div className="workflow-step-meta">
                  <span
                    className={`badge status-${workflowCurrentStatus === 'pending' ? 'current' : workflowCurrentStatus}`}
                  >
                    {workflowCurrentStatus === 'done' ? '已完成' : workflowCurrentStatus === 'skipped' ? '已跳过' : '进行中'}
                  </span>
                  {currentStep.optional && <span className="badge optional">可选</span>}
                  <span className="badge">{stageLabels[workflowCommand.stage]}</span>
                </div>
                <div className="muted small">
                  步骤 {workflowCurrentNumber} / {workflowStepTotal}
                </div>
                {currentStep.optional && (
                  <div className="muted small">可选步骤，跳过不会阻断工作流。</div>
                )}
              </div>

              <div className="panel-card" id="workflow-inputs">
                <div className="panel-title">输入</div>
                <div className="form">
                  {workflowCommand.fields.map((f) => {
                    const inputId = `workflow-${currentStep?.stepId ?? 'step'}-${f.id}`;
                    return (
                      <div key={f.id} className="field">
                        <label htmlFor={inputId}>
                          {f.label}
                          {f.required && <span className="required">*</span>}
                        </label>
                        {f.type === 'select' ? (
                          <select
                            id={inputId}
                            value={String(workflowFormState[f.id] ?? '')}
                            onChange={(e) => updateWorkflowField(f.id, e.target.value)}
                            className="input"
                          >
                            {(f.options ?? []).map((option) => {
                              const normalized = normalizeOption(option);
                              return (
                                <option key={normalized.value} value={normalized.value}>
                                  {normalized.label}
                                </option>
                              );
                            })}
                          </select>
                        ) : f.type === 'boolean' ? (
                          <input
                            id={inputId}
                            aria-label={f.label}
                            type="checkbox"
                            checked={Boolean(workflowFormState[f.id])}
                            onChange={(e) => updateWorkflowField(f.id, e.target.checked)}
                          />
                        ) : f.type === 'path' ? (
                          <div className="input-row">
                            <input
                              id={inputId}
                              className="input"
                              value={(workflowFormState[f.id] as string) ?? ''}
                              placeholder="选择或输入路径"
                              onChange={(e) => updateWorkflowField(f.id, e.target.value)}
                            />
                            <button
                              className="btn secondary"
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
                              id={inputId}
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
                              id={inputId}
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
                    );
                  })}
                </div>
              </div>

              <div className="panel-card actions-panel">
                <div className="panel-title actions-kicker">操作</div>
                <div className="actions-title">
                  {workflowCurrentStatus === 'done' && workflowNextStep ? '继续' : '生成本步输出'}
                </div>
                <div className="actions-subtitle">
                  {workflowCurrentStatus === 'done' && workflowNextStep
                    ? '准备好后进入下一步。'
                    : workflowCurrentStatus === 'done'
                      ? '该工作流已全部完成。'
                      : '请先生成并保存本步输出，再继续。'}
                </div>
                <div className="inline-actions">
                  {workflowCurrentStatus === 'done' && workflowNextStep ? (
                    <button className="btn primary" onClick={() => moveToWorkflowStep(workflowStepIndex + 1)}>
                      进入下一步
                    </button>
                  ) : (
                    <button className="btn primary" disabled={!canGenerateWorkflowStep} onClick={handleWorkflowGenerate}>
                      生成本步输出
                    </button>
                  )}
                  <button className="btn secondary" onClick={() => scrollToWorkflowSection('workflow-inputs')}>
                    编辑输入
                  </button>
                  <button className="btn secondary" onClick={showWorkflowSavedOutput} disabled={!workflowHasSavedOutput}>
                    查看上次输出
                  </button>
                  <button className="btn ghost" onClick={handleWorkflowSkip}>
                    跳过步骤
                  </button>
                </div>
                {workflowMissingRequired.length > 0 && (
                  <div className="muted small">缺少必填字段：{workflowMissingRequired.map((f) => f.label).join('、')}</div>
                )}
                {workflowMissingVars.length > 0 && (
                  <div className="muted small">
                    缺少变量 <code>{workflowMissingVars.join(', ')}</code>
                  </div>
                )}
              </div>

              <div className="panel-card">
                <div className="panel-title">附件</div>
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
              </div>
            </section>

            <section className="workflow-preview" id="workflow-preview">
              <div className="preview-panel">
                <div className="preview-header">
                  <h3>预览与输出</h3>
                  <div className="preview-toolbar">
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
                </div>
                <div className="preview-surface">
                  <div className="muted small preview-note">此处编辑仅影响输出，不会回写输入字段。</div>
                  <textarea
                    className="preview"
                    value={workflowPreviewText}
                    onChange={(e) => setWorkflowPreviewOverrides((prev) => ({ ...prev, [currentStep.stepId]: e.target.value }))}
                    placeholder="可直接编辑预览内容（不回写表单）"
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
      {tab === 'history' && (
        <div className="layout">
          <section>
            <h3>历史记录</h3>
            <div className="card-grid">
              {history.length === 0 && <div className="muted">暂无历史</div>}
              {history.map((h) => {
                const commandLabel = commandLookup.get(h.commandId)?.displayName ?? h.commandId;
                return (
                <div key={h.id} className="card history-card">
                  <div className="card-title">
                    <code>{commandLabel}</code> <span className="card-sub">{formatDate(h.createdAt)}</span>
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
              );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}



