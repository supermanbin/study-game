import { safeLocalStorage } from '../core/store';
import {
  DEFAULT_TUNING,
  TUNING_RANGES,
  loadTuning,
  saveTuning,
  type LaunchMode,
  type PhysicsTuning,
} from './physicsTuning';

type NumericKey = 'gravity' | 'bounce' | 'air';

const SLIDERS: { key: NumericKey; label: string; step: number; digits: number }[] = [
  { key: 'gravity', label: '重力', step: 0.1, digits: 1 },
  { key: 'bounce', label: '弹性', step: 0.05, digits: 2 },
  { key: 'air', label: '空气阻力', step: 0.002, digits: 3 },
];

const PANEL_HEIGHT_PX = 64;

/** Debug-only tuning panel below the canvas. A no-op unless the URL has `debug`. Changes apply from the next question. */
export function mountTuningPanel(): void {
  if (!location.search.includes('debug') || document.getElementById('tuning-panel')) return;
  const storage = safeLocalStorage();
  let tuning: PhysicsTuning = loadTuning(storage);

  const style = document.createElement('style');
  style.textContent = `
    body { height: calc(100% - ${PANEL_HEIGHT_PX}px) !important; }
    #tuning-panel { position: fixed; left: 0; right: 0; bottom: 0; height: ${PANEL_HEIGHT_PX}px; box-sizing: border-box;
      display: flex; flex-wrap: wrap; gap: 6px 18px; align-items: center; justify-content: center; padding: 6px 14px;
      background: rgba(43, 53, 96, 0.85); color: #fff; font: 14px "PingFang SC", "Microsoft YaHei", sans-serif; z-index: 10; }
    #tuning-panel label { display: flex; align-items: center; gap: 6px; }
    #tuning-panel output { min-width: 40px; color: #ffd166; }
  `;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.id = 'tuning-panel';

  const refreshers: (() => void)[] = [];
  const commit = (): void => saveTuning(storage, tuning);

  for (const s of SLIDERS) {
    const [min, max] = TUNING_RANGES[s.key];
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(s.step);
    input.dataset.key = s.key;
    const out = document.createElement('output');
    const refresh = (): void => {
      input.value = String(tuning[s.key]);
      out.textContent = tuning[s.key].toFixed(s.digits);
    };
    input.addEventListener('input', () => {
      const v = Number(input.value);
      if (!Number.isFinite(v)) return;
      tuning = { ...tuning, [s.key]: v };
      out.textContent = v.toFixed(s.digits);
      commit();
    });
    refreshers.push(refresh);
    label.append(s.label + ' ', input, out);
    panel.appendChild(label);
  }

  const pegsLabel = document.createElement('label');
  const pegs = document.createElement('input');
  pegs.type = 'checkbox';
  pegs.dataset.key = 'pegs';
  pegs.addEventListener('change', () => {
    tuning = { ...tuning, pegs: pegs.checked };
    commit();
  });
  refreshers.push(() => (pegs.checked = tuning.pegs));
  pegsLabel.append(pegs, ' 弹珠钉');
  panel.appendChild(pegsLabel);

  const launchLabel = document.createElement('label');
  const launch = document.createElement('select');
  launch.dataset.key = 'launch';
  for (const [value, text] of [
    ['toss', '从两侧抛进来'],
    ['drop', '从上方掉下来'],
  ] as const) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = text;
    launch.appendChild(o);
  }
  launch.addEventListener('change', () => {
    tuning = { ...tuning, launch: launch.value as LaunchMode };
    commit();
  });
  refreshers.push(() => (launch.value = tuning.launch));
  launchLabel.append('出场方式 ', launch);
  panel.appendChild(launchLabel);

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = '恢复默认';
  reset.addEventListener('click', () => {
    tuning = { ...DEFAULT_TUNING };
    commit();
    refreshers.forEach(r => r());
  });
  panel.appendChild(reset);

  const tip = document.createElement('span');
  tip.style.opacity = '0.75';
  tip.textContent = '改了参数后，下一题生效。';
  panel.appendChild(tip);

  refreshers.forEach(r => r());
  document.body.appendChild(panel);
}
