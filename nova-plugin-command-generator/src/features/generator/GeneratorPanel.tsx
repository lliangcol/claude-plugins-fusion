import type React from 'react';
import {
  Attachment,
  CommandDefinition,
  FieldDefinition,
  GuidanceRecommendation,
  StageKey,
  StageStatus,
} from '../../types';
import { QualityFeedback } from '../../utils/promptQuality';
import { GuardrailBanner } from '../../components/GuardrailBanner';
import { Icon } from '../../components/Icon';
import { NextStepCard } from '../../components/NextStepCard';
import { StageProgressBar } from '../../components/StageProgressBar';

interface ChecklistItem {
  id: string;
  label: string;
  complete: boolean;
  sectionId?: string;
}

interface SectionDefinition {
  key: string;
  title: string;
  fields: FieldDefinition[];
}

interface GeneratorPanelProps {
  guidanceStatus: Record<StageKey, StageStatus>;
  stageLabels: Record<string, string>;
  guardrailVisible: boolean;
  onGuardrailContinue: () => void;
  onGuardrailSwitch: () => void;
  feedbackMessage: string | null;
  draftRestored: boolean;
  workflowSuggestion: string | null;
  selectedCommand: CommandDefinition;
  checklistItems: ChecklistItem[];
  sortedCommands: CommandDefinition[];
  onSelectCommand: (commandId: string, bypassGuardrail?: boolean) => void;
  basicSections: SectionDefinition[];
  advancedSections: SectionDefinition[];
  renderField: (field: FieldDefinition, options: { hideLabel?: boolean }) => React.ReactNode;
  intentFeedback: QualityFeedback | null;
  contextFeedback: QualityFeedback | null;
  constraintsFeedback: QualityFeedback | null;
  advancedRequiredFields: FieldDefinition[];
  missingAdvancedRequired: FieldDefinition[];
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  handleFileUpload: (files: FileList | null) => void;
  attachmentTarget: string;
  setAttachmentTarget: (value: string) => void;
  attachableFields: FieldDefinition[];
  attachmentMode: 'path' | 'snippet' | 'full';
  setAttachmentMode: (value: 'path' | 'snippet' | 'full') => void;
  attachments: Attachment[];
  removeAttachment: (name: string) => void;
  insertAttachmentsToField: (fieldId: string, mode: 'path' | 'snippet' | 'full') => void;
  showNextCard: boolean;
  nextRecommendation: GuidanceRecommendation | null;
  onUseNextRecommendation: () => void;
  onBrowseNextRecommendation: () => void;
  newVarKey: string;
  setNewVarKey: (value: string) => void;
  newVarValue: string;
  setNewVarValue: (value: string) => void;
  addVariable: () => void;
  variables: Record<string, string>;
  canGenerate: boolean;
  handleAddHistory: () => void;
  copyText: (text: string) => void;
  previewText: string;
  handleSingleExport: (kind: 'md' | 'txt' | 'json', mode: 'save' | 'download' | 'share') => void;
  supportsSave: boolean;
  supportsShare: boolean;
  missingRequired: FieldDefinition[];
  missingVars: string[];
  draftSavedAt: number | null;
  formatDate: (ts: number) => string;
  hasUndoSnapshot: boolean;
  restoreUndoSnapshot: () => void;
  previewOverride: string | null;
  setPreviewOverride: (value: string | null) => void;
}

export const GeneratorPanel = ({
  guidanceStatus,
  stageLabels,
  guardrailVisible,
  onGuardrailContinue,
  onGuardrailSwitch,
  feedbackMessage,
  draftRestored,
  workflowSuggestion,
  selectedCommand,
  checklistItems,
  sortedCommands,
  onSelectCommand,
  basicSections,
  advancedSections,
  renderField,
  intentFeedback,
  contextFeedback,
  constraintsFeedback,
  advancedRequiredFields,
  missingAdvancedRequired,
  showAdvanced,
  onToggleAdvanced,
  handleFileUpload,
  attachmentTarget,
  setAttachmentTarget,
  attachableFields,
  attachmentMode,
  setAttachmentMode,
  attachments,
  removeAttachment,
  insertAttachmentsToField,
  showNextCard,
  nextRecommendation,
  onUseNextRecommendation,
  onBrowseNextRecommendation,
  newVarKey,
  setNewVarKey,
  newVarValue,
  setNewVarValue,
  addVariable,
  variables,
  canGenerate,
  handleAddHistory,
  copyText,
  previewText,
  handleSingleExport,
  supportsSave,
  supportsShare,
  missingRequired,
  missingVars,
  draftSavedAt,
  formatDate,
  hasUndoSnapshot,
  restoreUndoSnapshot,
  previewOverride,
  setPreviewOverride,
}: GeneratorPanelProps) => (
  <div className="layout generator-layout">
    <div className="generator-guidance">
      <StageProgressBar status={guidanceStatus} labels={stageLabels} />
      <GuardrailBanner visible={guardrailVisible} onContinue={onGuardrailContinue} onSwitch={onGuardrailSwitch} />
    </div>
    <section className="generator-inputs">
      <div className="panel-stack">
        {feedbackMessage && (
          <div className="success-notice" role="status" aria-live="polite">
            {feedbackMessage}
          </div>
        )}
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
          <select
            value={selectedCommand.id}
            onChange={(e) => onSelectCommand(e.target.value)}
            className="select"
          >
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
            onClick={onToggleAdvanced}
          >
            {showAdvanced
              ? `隐藏高级选项 · 必填 ${advancedRequiredFields.length} 项`
              : `高级选项 · 必填 ${advancedRequiredFields.length} 项`}
          </button>
        </div>

        <div
          className={`advanced-panel ${showAdvanced ? 'open' : ''} ${
            missingAdvancedRequired.length > 0 ? 'needs-attention' : ''
          }`}
        >
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
          <NextStepCard recommendation={nextRecommendation} onUse={onUseNextRecommendation} onBrowse={onBrowseNextRecommendation} />
        )}

        <div className="panel-card">
          <div className="panel-title">变量</div>
          <div className="inline-actions">
            <input className="input" placeholder="变量名" value={newVarKey} onChange={(e) => setNewVarKey(e.target.value)} />
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
            <button className="btn ghost" onClick={restoreUndoSnapshot} disabled={!hasUndoSnapshot}>
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
);
