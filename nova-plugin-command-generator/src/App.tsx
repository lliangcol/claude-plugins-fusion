
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
import { readAttachments } from './utils/attachments';
import { normalizeOption } from './utils/options';
import { Icon } from './components/Icon';
import { StageProgressBar } from './components/StageProgressBar';
import { GeneratorPanel } from './features/generator/GeneratorPanel';
import { WorkflowRunPanel } from './features/workflow/WorkflowRunPanel';
import { HistoryPanel } from './features/history/HistoryPanel';
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

const MAX_ATTACHMENT_BYTES = 200 * 1024;


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

  const computedPreview = useMemo(
    () => (selectedCommand ? renderTemplate(selectedCommand, formState, variables) : ''),
    [selectedCommand, formState, variables],
  );
  const previewText = previewOverride ?? computedPreview;
  const missingVars = useMemo(() => getMissingVariables(computedPreview), [computedPreview]);

  const canGenerate = useMemo(
    () =>
      selectedCommand
        ? selectedCommand.fields.every((f) => !f.required || isFieldFilled(f.id, selectedCommand, formState[f.id]))
        : false,
    [selectedCommand, formState],
  );

  const missingRequired = useMemo(
    () =>
      selectedCommand
        ? selectedCommand.fields.filter((f) => f.required && !isFieldFilled(f.id, selectedCommand, formState[f.id]))
        : [],
    [selectedCommand, formState],
  );

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

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

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

  const handleFileUpload = async (files: FileList | null) => {
    const next = await readAttachments(files, {
      maxBytes: MAX_ATTACHMENT_BYTES,
      snippetLimit: 2000,
      onError: (filename) => showFeedback(`附件读取失败：${filename}`),
    });
    if (next.length === 0) return;
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
    if (!currentStep) return;
    const next = await readAttachments(files, {
      maxBytes: MAX_ATTACHMENT_BYTES,
      snippetLimit: 2000,
      onError: (filename) => showFeedback(`附件读取失败：${filename}`),
    });
    if (next.length === 0) return;
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
          <StageProgressBar status={guidanceState.stageStatus} labels={stageLabels} />
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
        <GeneratorPanel
          guidanceStatus={guidanceState.stageStatus}
          stageLabels={stageLabels}
          guardrailVisible={guardrailVisible}
          onGuardrailContinue={() => setGuardrailVisible(false)}
          onGuardrailSwitch={() => {
            setGuardrailVisible(false);
            if (guardrailRecommendation?.command) {
              selectCommandWithGuardrail(guardrailRecommendation.command, true);
            }
          }}
          feedbackMessage={feedbackMessage}
          draftRestored={draftRestored}
          workflowSuggestion={workflowSuggestion}
          selectedCommand={selectedCommand}
          checklistItems={checklistItems}
          sortedCommands={sortedCommands}
          onSelectCommand={selectCommandWithGuardrail}
          basicSections={basicSections}
          advancedSections={advancedSections}
          renderField={renderField}
          intentFeedback={intentFeedback}
          contextFeedback={contextFeedback}
          constraintsFeedback={constraintsFeedback}
          advancedRequiredFields={advancedRequiredFields}
          missingAdvancedRequired={missingAdvancedRequired}
          showAdvanced={showAdvanced}
          onToggleAdvanced={() => setShowAdvanced((prev) => !prev)}
          handleFileUpload={handleFileUpload}
          attachmentTarget={attachmentTarget}
          setAttachmentTarget={setAttachmentTarget}
          attachableFields={attachableFields}
          attachmentMode={attachmentMode}
          setAttachmentMode={setAttachmentMode}
          attachments={attachments}
          removeAttachment={removeAttachment}
          insertAttachmentsToField={insertAttachmentsToField}
          showNextCard={showNextCard}
          nextRecommendation={nextRecommendation}
          onUseNextRecommendation={() => {
            setShowNextCard(false);
            if (nextRecommendation) {
              selectCommandWithGuardrail(nextRecommendation.command, true);
            }
          }}
          onBrowseNextRecommendation={() => {
            setShowNextCard(false);
            setTab('commands');
          }}
          newVarKey={newVarKey}
          setNewVarKey={setNewVarKey}
          newVarValue={newVarValue}
          setNewVarValue={setNewVarValue}
          addVariable={addVariable}
          variables={variables}
          canGenerate={canGenerate}
          handleAddHistory={handleAddHistory}
          copyText={copyText}
          previewText={previewText}
          handleSingleExport={handleSingleExport}
          supportsSave={supportsSave}
          supportsShare={supportsShare}
          missingRequired={missingRequired}
          missingVars={missingVars}
          draftSavedAt={draftSavedAt}
          formatDate={formatDate}
          hasUndoSnapshot={Boolean(undoSnapshot)}
          restoreUndoSnapshot={restoreUndoSnapshot}
          previewOverride={previewOverride}
          setPreviewOverride={setPreviewOverride}
        />
      )}
      {tab === 'workflows' && (
        <div className="layout">
          <StageProgressBar status={guidanceState.stageStatus} labels={stageLabels} />
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
        <WorkflowRunPanel
          activeWorkflow={activeWorkflow}
          currentStep={currentStep}
          workflowCommand={workflowCommand}
          workflowFormState={workflowFormState}
          workflowOptionalLabels={workflowOptionalLabels}
          stageLabels={stageLabels}
          workflowCurrentNumber={workflowCurrentNumber}
          workflowStepTotal={workflowStepTotal}
          workflowProgressPercent={workflowProgressPercent}
          workflowCompletedCount={workflowCompletedCount}
          workflowSkippedCount={workflowSkippedCount}
          workflowRemainingCount={workflowRemainingCount}
          workflowNextStep={workflowNextStep}
          workflowNextCommand={workflowNextCommand}
          feedbackMessage={feedbackMessage}
          workflowStepStatus={workflowStepStatus}
          workflowStepIndex={workflowStepIndex}
          getCommand={(commandId) => commandLookup.get(commandId) ?? null}
          moveToWorkflowStep={moveToWorkflowStep}
          handleWorkflowReset={handleWorkflowReset}
          workflowVarKey={workflowVarKey}
          setWorkflowVarKey={setWorkflowVarKey}
          workflowVarValue={workflowVarValue}
          setWorkflowVarValue={setWorkflowVarValue}
          addWorkflowVariable={addWorkflowVariable}
          workflowVariables={workflowVariables}
          workflowStepFraming={workflowStepFraming}
          workflowCurrentStatus={workflowCurrentStatus}
          supportsDirectoryPicker={supportsDirectoryPicker}
          pickDirectory={pickDirectory}
          updateWorkflowField={updateWorkflowField}
          updateWorkflowList={updateWorkflowList}
          clearWorkflowFieldValue={clearWorkflowFieldValue}
          canGenerateWorkflowStep={canGenerateWorkflowStep}
          handleWorkflowGenerate={handleWorkflowGenerate}
          scrollToWorkflowSection={scrollToWorkflowSection}
          showWorkflowSavedOutput={showWorkflowSavedOutput}
          workflowHasSavedOutput={workflowHasSavedOutput}
          handleWorkflowSkip={handleWorkflowSkip}
          workflowMissingRequired={workflowMissingRequired}
          workflowMissingVars={workflowMissingVars}
          handleWorkflowFileUpload={handleWorkflowFileUpload}
          workflowAttachmentTarget={workflowAttachmentTarget}
          setWorkflowAttachmentTarget={setWorkflowAttachmentTarget}
          workflowAttachmentMode={workflowAttachmentMode}
          setWorkflowAttachmentMode={setWorkflowAttachmentMode}
          workflowAttachmentsList={workflowAttachmentsList}
          insertWorkflowAttachments={insertWorkflowAttachments}
          supportsSave={supportsSave}
          supportsShare={supportsShare}
          handleWorkflowExport={handleWorkflowExport}
          workflowPreviewText={workflowPreviewText}
          setWorkflowPreviewOverrides={setWorkflowPreviewOverrides}
        />
      )}
      {tab === 'history' && (
        <HistoryPanel
          history={history}
          getCommandLabel={(commandId) => commandLookup.get(commandId)?.displayName ?? commandId}
          formatDate={formatDate}
          copyText={copyText}
          onReuse={(entry) => {
            setFormDraft(entry.fields);
            selectCommandWithGuardrail(entry.commandId, true);
          }}
          onRemove={removeHistoryItem}
        />
      )}
    </div>
  );
}
