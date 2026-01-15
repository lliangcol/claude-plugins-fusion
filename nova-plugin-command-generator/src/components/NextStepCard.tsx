import { GuidanceRecommendation } from '../types';

export const NextStepCard = ({
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
