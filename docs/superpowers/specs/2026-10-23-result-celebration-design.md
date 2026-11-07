# 关卡收尾与结算页庆祝演出 设计

日期：2026-10-23。补充 `2026-10-22-multiplication-game-design.md` 第 7 节（特效）和第 9 节（结算页）。

## 1. 意图

试玩反馈两条：

1. 最后一题答完的瞬间就跳到结算页，最后一题的爆炸、飘分、连击字、Boss 倒下和答对语音全被切掉，切换很生硬。
2. 「过关啦」页面完全静态，没有庆祝感。

目标是让一关的结尾有一个完整的节奏：最后一题的效果播完 → 结算页用约 2 秒的入场演出把星星和分数"送"出来 → 页面安静下来。

## 2. 目标 / 非目标 / 反目标

目标
- 最后一题的效果和语音能完整播完再切页。
- 结算页有一次性的入场演出：标题弹入、亮星逐颗落下、数字滚动、三星撒彩纸、过关音效和语音。
- 失败页只有轻微动态，措辞和效果都保持温和。
- 按钮从结算页第一帧起就能按，演出不阻塞操作。

非目标
- 页面停留期间的常驻动画（星星呼吸、背景飘物）。
- 新的美术资源或音频文件；全部复用已烘焙的黏土纹理和合成音。
- 改任何规则（分数、星级、过关条件）。

反目标（沿用总设计）
- 不花哨：总时长 ≤ 2.5 s，之后页面静止。
- 失败页没有任何可能被理解为嘲讽的效果（不抖屏、不掉落暗星、不放"失败"音）。
- 不在场景进入时烘焙纹理（e2e `clay.spec.ts` 保证结算页不新增 `clay:` 键）。

## 3. 约束

- 纯核心、薄场景：演出的"什么时候做什么"是纯数据，可单元测试；场景只翻译成补间/粒子/音效。
- 黏土纹理来自 Boot 预烘焙：彩纸用 `bakeShape('particleStar'|'particleBall', 球色)`（`bakeAll` 已烘），星星用 `bakeStars(RESULT_STAR_SIZE)`（`prebakeScenes` 已烘）。
- e2e 通过 `window.__funyDebug` 驱动：`flow.spec.ts` 到达 Result 后立即 `press('再玩一次')` 等，演出不能改变按钮可用性；`state().stars` 仍按结果返回，与演出进度无关。
- 语音互相打断：`AudioService.voice` 会停掉上一句，所以同一时刻只排一句语音。

## 4. 方案比较

- 方案一：演出直接写在 `ResultScene.create()` 的 Phaser Timeline 里。改动最小，但"几颗星、是否撒彩纸、失败页有哪些步"只能靠肉眼或 e2e 检查。
- 方案二（已选）：`src/game/celebration.ts` 纯函数生成步骤列表 + 单元测试，`ResultScene` 用 Phaser Timeline 播放。多一个文件，但符合项目约定，时序规则可测可调。
- 弃用：按钮等演出结束再弹出。更戏剧化，但违背"按钮立刻可按"，也让 e2e 的 `press` 变得时序敏感。

## 5. 决定的做法

### 5.1 关卡收尾延迟（GameScene）

- 新常量 `LEVEL_END_HOLD_MS = 1300`（三星以外）与 `BOSS_DEFEAT_HOLD_MS = 2000`（最后一击打空 Boss 血条时），放在 `src/game/tuning.ts`。
- `checkEnd` 在状态变为 won/lost 时立即置 `leaving = true`（停止点击、停止出题、不再触发 miss），但不暂停物理，让球继续落完；`endLevel` 改为在 hold 之后执行（场景时钟 `delayedCall`，暂停时随之暂停；Esc 退出仍立即生效）。
- 结束原因为超时或堆满时同样 hold（答案揭示、最后的球都能看完）。
- `'end'` 事件仍在切页前发出，但 GameScene 不再播过关/失败语音（挪到结算页，见 5.3）。
- debug 钩子：`answerCorrect`/`missCurrent` 走的 flush 路径在最后一题时也跳过 hold，保持 e2e 速度；`state()` 新增 `levelEnding: boolean`。

### 5.2 演出脚本（纯数据）

`src/game/celebration.ts`：

```ts
export type CelebrationStep =
  | { at: number; kind: 'title' }                       // 标题弹入
  | { at: number; kind: 'reason' }                      // 失败原因淡入（仅失败页）
  | { at: number; kind: 'star'; index: 0 | 1 | 2 }      // 第 index 颗亮星落下
  | { at: number; kind: 'count'; line: 'correct' | 'score' | 'bonus'; durationMs: number } // 数字滚动
  | { at: number; kind: 'confetti' }                    // 彩纸（仅三星）
  | { at: number; kind: 'sfx'; name: 'pass' | 'correct' }
  | { at: number; kind: 'voice'; category: 'threeStars' | 'levelPass' | 'levelFail' };

export function celebrationSteps(result: LevelResult): CelebrationStep[]; // 按 at 升序
export function celebrationDurationMs(steps: CelebrationStep[]): number;  // 最后一步的 at + 该步自身时长
export const CELEBRATION_MAX_MS = 2500;
```

过关页时间表（毫秒）：

| at | 步骤 |
|----|------|
| 0 | title；sfx `pass` |
| 300 | count correct（500 ms） |
| 500 + 350·i | star i（i < stars），每颗同时 sfx `correct` |
| 700 | count score（600 ms） |
| 900 | count bonus（600 ms） |
| 最后一颗星 + 250 | 三星时 confetti；voice `threeStars`，否则 voice `levelPass` |

失败页：title（0）、reason（200）、count correct（300，500 ms）、voice `levelFail`（600）。没有 star、confetti、sfx `pass`。

单元测试（`celebration.test.ts`）：步骤按时间升序；star 步数等于 `stars`；只有三星有 confetti；失败页没有 star/confetti/pass，且有 reason 与 `levelFail`；每张表恰好一条 voice；`celebrationDurationMs ≤ CELEBRATION_MAX_MS`。

### 5.3 场景播放（ResultScene）

- 布局不变（面板、三行数字、按钮位置和尺寸沿用现有常量）。按钮在 `create()` 里照常创建，不受演出影响。
- 三颗星先全部放暗星；每个 `star` 步把对应的亮星从上方 140 px、放大 1.6、透明 0 落到位（250 ms，Back.Out），落地时在星星处放一圈 `shockwave`，相机轻抖（80 ms，0.002）。
- `count` 步用补间把 0 滚到目标值，文本每帧更新（同一个 Text 对象，不新建）。
- `confetti` 从面板上方左右两点各撒 30 粒（彩纸纹理：球色的 particleStar/particleBall，寿命 1200 ms，向下重力），深度在面板之上、按钮之下。
- `title` 步：标题从 0.6 缩放弹到 1（300 ms，Back.Out）；`reason` 步：原因文字 300 ms 淡入。
- `voice`/`sfx` 步直接调用 `getAudio()`。
- 用 `this.add.timeline` 播放，`at` 直接映射；场景 shutdown 时销毁 timeline。
- `effects.ts` 增加不把 y 钳在题目区以下的 `confettiBurst`，`shockwave` 增加可选参数去掉钳位（或在结算页坐标本来就在 140 以下时直接复用，由实现者决定）。
- `debugState()` 新增 `celebrating: boolean`，便于 e2e 等演出结束再做截图类断言。

### 5.4 音效

`synth.ts` 新增 `SfxName` `'pass'`：三到四个上行音（如 523/659/784/1047 Hz，各 0.12 s，间隔 0.1 s，sine），总长约 0.5 s。落星复用 `'correct'`。

## 6. 留给实现者

- 落星缓动和彩纸粒子的具体参数，以好看为准，但不改时间表。
- `shockwave` 钳位的处理方式。
- hold 期间是否淡出 HUD 倒计时（可不做）。

## 7. 验证

- `npx vitest run`：新增 `celebration.test.ts`、`levels`/`session` 不变。
- `npm run test:e2e`：`flow.spec.ts` 不改断言；`clay.spec.ts` 的"Result 不新增 clay 键"必须继续通过。
- 手动：第 1 关打满三星看完整演出；故意失败看失败页；Boss 关最后一击打空血条时能看到 Boss 倒下再切页。
