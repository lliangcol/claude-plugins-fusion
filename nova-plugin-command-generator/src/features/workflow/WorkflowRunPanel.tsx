import type React from 'react';
import {
  Attachment,
  CommandDefinition,
  FieldDefinition,
  FormState,
  WorkflowDefinition,
  WorkflowStep,
} from '../../types';
import { Icon } from '../../components/Icon';
import { normalizeOption } from '../../utils/options';

interface WorkflowRunPanelProps {
  activeWorkflow: WorkflowDefinition;
  currentStep: WorkflowStep;
  workflowCommand: CommandDefinition;
  workflowFormState: FormState;
  workflowOptionalLabels: string[];
  stageLabels: Record<string, string>;
  workflowCurrentNumber: number;
  workflowStepTotal: number;
  workflowProgressPercent: number;
  workflowCompletedCount: number;
  workflowSkippedCount: number;
  workflowRemainingCount: number;
  workflowNextStep: WorkflowStep | null;
  workflowNextCommand: CommandDefinition | null;
  feedbackMessage: string | null;
  workflowStepStatus: Record<string, 'pending' | 'done' | 'skipped'>;
  workflowStepIndex: number;
  getCommand: (commandId: string) => CommandDefinition | null;
  moveToWorkflowStep: (index: number) => void;
  handleWorkflowReset: () => void;
  workflowVarKey: string;
  setWorkflowVarKey: (value: string) => void;
  workflowVarValue: string;
  setWorkflowVarValue: (value: string) => void;
  addWorkflowVariable: () => void;
  workflowVariables: Record<string, string>;
  workflowStepFraming: string;
  workflowCurrentStatus: 'pending' | 'done' | 'skipped';
  supportsDirectoryPicker: boolean;
  pickDirectory: (onSelect: (value: string) => void) => void;
  updateWorkflowField: (fieldId: string, value: string | boolean) => void;
  updateWorkflowList: (fieldId: string, raw: string) => void;
  clearWorkflowFieldValue: (fieldId: string, fieldType: string) => void;
  canGenerateWorkflowStep: boolean;
  handleWorkflowGenerate: () => void;
  scrollToWorkflowSection: (id: string) => void;
  showWorkflowSavedOutput: () => void;
  workflowHasSavedOutput: boolean;
  handleWorkflowSkip: () => void;
  workflowMissingRequired: FieldDefinition[];
  workflowMissingVars: string[];
  handleWorkflowFileUpload: (files: FileList | null) => void;
  workflowAttachmentTarget: string;
  setWorkflowAttachmentTarget: (value: string) => void;
  workflowAttachmentMode: 'path' | 'snippet' | 'full';
  setWorkflowAttachmentMode: (value: 'path' | 'snippet' | 'full') => void;
  workflowAttachmentsList: Attachment[];
  insertWorkflowAttachments: (fieldId: string, mode: 'path' | 'snippet' | 'full') => void;
  supportsSave: boolean;
  supportsShare: boolean;
  handleWorkflowExport: (kind: 'md' | 'txt', mode: 'save' | 'download' | 'share') => void;
  workflowPreviewText: string;
  setWorkflowPreviewOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export const WorkflowRunPanel = ({
  activeWorkflow,
  currentStep,
  workflowCommand,
  workflowFormState,
  workflowOptionalLabels,
  stageLabels,
  workflowCurrentNumber,
  workflowStepTotal,
  workflowProgressPercent,
  workflowCompletedCount,
  workflowSkippedCount,
  workflowRemainingCount,
  workflowNextStep,
  workflowNextCommand,
  feedbackMessage,
  workflowStepStatus,
  workflowStepIndex,
  getCommand,
  moveToWorkflowStep,
  handleWorkflowReset,
  workflowVarKey,
  setWorkflowVarKey,
  workflowVarValue,
  setWorkflowVarValue,
  addWorkflowVariable,
  workflowVariables,
  workflowStepFraming,
  workflowCurrentStatus,
  supportsDirectoryPicker,
  pickDirectory,
  updateWorkflowField,
  updateWorkflowList,
  clearWorkflowFieldValue,
  canGenerateWorkflowStep,
  handleWorkflowGenerate,
  scrollToWorkflowSection,
  showWorkflowSavedOutput,
  workflowHasSavedOutput,
  handleWorkflowSkip,
  workflowMissingRequired,
  workflowMissingVars,
  handleWorkflowFileUpload,
  workflowAttachmentTarget,
  setWorkflowAttachmentTarget,
  workflowAttachmentMode,
  setWorkflowAttachmentMode,
  workflowAttachmentsList,
  insertWorkflowAttachments,
  supportsSave,
  supportsShare,
  handleWorkflowExport,
  workflowPreviewText,
  setWorkflowPreviewOverrides,
}: WorkflowRunPanelProps) => (
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
              <div className="workflow-guidance-line">适用场景：{activeWorkflow.intendedScenario}</div>
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

    {feedbackMessage && (
      <div className="success-notice workflow-feedback" role="status" aria-live="polite">
        {feedbackMessage}
      </div>
    )}

    <div className="workflow-columns">
      <section className="workflow-rail">
        <div className="panel-card journey-panel">
          <div className="panel-title">流程地图</div>
          <div className="journey-steps">
            {activeWorkflow.steps.map((step, idx) => {
              const status = workflowStepStatus[step.stepId] ?? 'pending';
              const isCurrent = idx === workflowStepIndex;
              const command = getCommand(step.commandId);
              const label = command?.displayName ?? step.commandId;
              const statusKey = status === 'done' || status === 'skipped' ? status : isCurrent ? 'current' : 'todo';
              const statusLabel =
                status === 'done' ? '已完成' : status === 'skipped' ? '已跳过' : isCurrent ? '进行中' : '待处理';
              const statusClass =
                status === 'done' ? 'done' : status === 'skipped' ? 'skipped' : isCurrent ? 'current' : 'upcoming';
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
            <button className="btn ghost" onClick={() => moveToWorkflowStep(workflowStepIndex - 1)} disabled={workflowStepIndex === 0}>
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
            <span className={`badge status-${workflowCurrentStatus === 'pending' ? 'current' : workflowCurrentStatus}`}>
              {workflowCurrentStatus === 'done' ? '已完成' : workflowCurrentStatus === 'skipped' ? '已跳过' : '进行中'}
            </span>
            {currentStep.optional && <span className="badge optional">可选</span>}
            <span className="badge">{stageLabels[workflowCommand.stage]}</span>
          </div>
          <div className="muted small">
            步骤 {workflowCurrentNumber} / {workflowStepTotal}
          </div>
          {currentStep.optional && <div className="muted small">可选步骤，跳过不会阻断工作流。</div>}
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
);
