# 九九乘法闯关

给二年级小朋友练习九九乘法表的网页小游戏，基于 Phaser 3 + TypeScript + Vite。

数字或算式从天上落下来，点击正确答案；答对有连击、道具和爆炸特效，还有语音鼓励。游戏包含：

- 看题目点得数、看得数点算式（反向）两种玩法
- 按顺序解锁的关卡，第 3 关和第 6 关是 Boss 关，按表现评星
- 错题回流：做错的口诀会更常出现
- 口诀卡收集，以及可以调整的设置
- 进度保存在浏览器本地（localStorage）

## 开发

```bash
npm install
npm run dev        # 本地开发服务器
npm run build      # 类型检查并构建到 dist/
npm test           # 单元测试 (vitest)
npm run test:e2e   # 端到端测试 (Playwright，自动启动 5199 端口)
```

首次运行 e2e 可能需要先执行 `npx playwright install chromium`。

## 重新生成语音

语音文件在 `public/audio/voice/`，由 `content/voice-lines.json` 中的文案用 edge-tts 生成。

```bash
python3 -m venv .venv-tts && .venv-tts/bin/pip install edge-tts   # 只需一次
# 修改 content/voice-lines.json 后：
node scripts/tts/generate.mjs           # 只生成缺少的
node scripts/tts/generate.mjs --force   # 全部重新生成
```

也可以用环境变量 `EDGE_TTS_BIN` 指定 edge-tts 可执行文件。每条语音 id 都必须有对应的 mp3，单元测试会检查。

## 调试模式

在地址后加 `?debug`（例如 `http://localhost:5173/?debug`），页面上会出现 `window.__funyDebug`，可以直接答对/答错、开始指定关卡、解锁全部关卡、读取当前状态。端到端测试就是通过它来操作游戏的。带 `?debug` 时页面底部还会出现物理调参面板（重力、弹性、空气阻力、弹珠钉、出场方式、恢复默认），参数存在本机，下一题生效。

## 文档

需求与设计：`docs/superpowers/specs/2026-10-22-multiplication-game-design.md`
