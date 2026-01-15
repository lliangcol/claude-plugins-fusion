import { Icon } from './Icon';

export const GuardrailBanner = ({
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
