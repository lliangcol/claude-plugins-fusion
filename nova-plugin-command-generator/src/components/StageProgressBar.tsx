import { StageKey, StageStatus } from '../types';
import { stageFlow } from '../utils/guidance';
import { Icon } from './Icon';

export const StageProgressBar = ({
  status,
  labels,
}: {
  status: Record<StageKey, StageStatus>;
  labels: Record<string, string>;
}) => (
  <div className="stage-progress">
    {stageFlow.map((stage) => {
      const state = status[stage] ?? 'todo';
      return (
        <div key={stage} className={`stage-item ${state}`}>
          {state === 'done' && <Icon name="check" className="stage-icon" />}
          <span className="stage-label">{labels[stage]}</span>
        </div>
      );
    })}
  </div>
);
