import { HistoryEntry } from '../../types';

interface HistoryPanelProps {
  history: HistoryEntry[];
  getCommandLabel: (commandId: string) => string;
  formatDate: (ts: number) => string;
  copyText: (text: string) => void;
  onReuse: (entry: HistoryEntry) => void;
  onRemove: (entryId: string) => void;
}

export const HistoryPanel = ({
  history,
  getCommandLabel,
  formatDate,
  copyText,
  onReuse,
  onRemove,
}: HistoryPanelProps) => (
  <div className="layout">
    <section>
      <h3>历史记录</h3>
      <div className="card-grid">
        {history.length === 0 && <div className="muted">暂无历史</div>}
        {history.map((entry) => (
          <div key={entry.id} className="card history-card">
            <div className="card-title">
              <code>{getCommandLabel(entry.commandId)}</code> <span className="card-sub">{formatDate(entry.createdAt)}</span>
            </div>
            <pre className="small muted code">
              {entry.commandText.slice(0, 200)}
              {entry.commandText.length > 200 ? '...' : ''}
            </pre>
            <div className="inline-actions history-actions">
              <button className="btn secondary" onClick={() => copyText(entry.commandText)}>
                复制
              </button>
              <button className="btn ghost" onClick={() => onReuse(entry)}>
                复用
              </button>
              <button className="btn danger" onClick={() => onRemove(entry.id)}>
                删除
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  </div>
);
