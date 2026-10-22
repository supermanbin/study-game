import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { AudioService } from '../audio/AudioService';
import { getLevel } from '../core/levels';
import { applyLevelResult, recordOutcome, type ProgressData } from '../core/progress';
import { difficultyAt, type Question } from '../core/questions';
import { mulberry32 } from '../core/rng';
import { LevelSession, type ItemKind, type LevelResult } from '../core/session';
import type { ProgressStore } from '../core/store';
import type { LevelId } from '../core/types';
import type { DebuggableScene, DebugState } from '../game/debug';
import { Hud } from '../game/Hud';
import { OptionBody } from '../game/OptionBody';
import { PileOverflowTracker } from '../game/pile';
import {
  BASE_GRAVITY_Y,
  GROUND_Y,
  MAX_FRAME_DELTA_MS,
  MISS_REVEAL_MS,
  PILE_OVERFLOW_MS,
  QUESTION_AREA_BOTTOM,
  SPAWN_STAGGER_MS,
  SPAWN_X_MAX,
  SPAWN_X_MIN,
  WARNING_LINE_Y,
} from '../game/tuning';

export interface GameSceneData {
  levelId: LevelId;
}

/** Emitted on `this.events` as `'session-event'`; Task 10 maps these to effects, boss and voice. */
export type SessionEvent =
  | { type: 'questionStart'; index: number; question: Question }
  | { type: 'correct'; scoreDelta: number; combo: number; x: number; y: number; awardedItem?: ItemKind }
  | { type: 'lateCorrect'; x: number; y: number }
  | { type: 'wrong'; scoreDelta: number; x: number; y: number }
  | { type: 'miss'; answerText: string }
  | { type: 'item'; item: ItemKind }
  | { type: 'end'; result: LevelResult };

export class GameScene extends Phaser.Scene implements DebuggableScene {
  private levelId: LevelId = 1;
  private session!: LevelSession;
  private hud!: Hud;
  private options: OptionBody[] = [];
  private serial = 0;
  private tracker = new PileOverflowTracker(WARNING_LINE_Y, PILE_OVERFLOW_MS);
  private leaving = false;

  constructor() {
    super('Game');
  }

  init(data: Partial<GameSceneData>): void {
    this.levelId = data.levelId ?? 1;
    this.options = [];
    this.serial = 0;
    this.tracker = new PileOverflowTracker(WARNING_LINE_Y, PILE_OVERFLOW_MS);
    this.leaving = false;
  }

  private get progress(): ProgressData {
    return this.registry.get('progress') as ProgressData;
  }

  private set progress(p: ProgressData) {
    this.registry.set('progress', p);
  }

  private get audio(): AudioService | undefined {
    return this.registry.get('audio') as AudioService | undefined;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#e3f2fd');
    this.time.paused = false; // the scene clock survives restarts
    this.session = new LevelSession(getLevel(this.levelId), {
      rng: mulberry32(Date.now() >>> 0),
      stats: () => this.progress.stats,
      onOutcome: o => {
        this.progress = recordOutcome(this.progress, o, Date.now());
      },
    });
    this.hud = new Hud(this, kind => this.useItem(kind));
    this.buildWorld();
    this.bindInput();
    this.startQuestion();
  }

  update(_time: number, delta: number): void {
    if (this.leaving) return;
    const s = this.session;
    const dt = Math.min(delta, MAX_FRAME_DELTA_MS);
    s.tick(dt);
    const ts = s.timeScale();
    // Engine timeScale alone halves fall speed while frozen; gravity carries only the difficulty ramp.
    this.matter.world.engine.timing.timeScale = ts;
    this.matter.world.setGravity(0, BASE_GRAVITY_Y * difficultyAt(s.questionIndex).fallSpeed);

    this.hud.setScore(s.score, s.combo);
    this.hud.setItems(s.items);
    if (this.hud.setTime(s.timeLeftMs)) this.audio?.sfx('tick');

    if (s.status === 'playing') {
      let top: number | null = null;
      for (const o of this.options) {
        const y = o.onPile ? o.topY() : null;
        if (y !== null && (top === null || y < top)) top = y;
      }
      if (this.tracker.update(dt, top)) s.failByPile();
    }
    this.checkEnd();
  }

  // ---- setup ----

  private buildWorld(): void {
    this.matter.add.rectangle(GAME_WIDTH / 2, GROUND_Y + 50, GAME_WIDTH + 400, 100, { isStatic: true, label: 'ground' });
    const wallH = GAME_HEIGHT + 1000;
    this.matter.add.rectangle(-25, GAME_HEIGHT - wallH / 2, 50, wallH, { isStatic: true, label: 'wall' });
    this.matter.add.rectangle(GAME_WIDTH + 25, GAME_HEIGHT - wallH / 2, 50, wallH, { isStatic: true, label: 'wall' });

    const onCollide = (e: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
      for (const p of e.pairs) {
        this.markLanded(p.bodyA, p.bodyB);
        this.markLanded(p.bodyB, p.bodyA);
      }
      this.checkAllCorrectLanded();
    };
    this.matter.world.on('collisionstart', onCollide);
    this.matter.world.on('collisionactive', onCollide);
    // The Matter world is destroyed (with its listeners) on scene shutdown.
  }

  private bindInput(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (p.worldY < QUESTION_AREA_BOTTOM || over.some(o => this.hud.isItemButton(o))) return;
      const hit = this.currentOptions().find(o => o.clickable && o.contains(p.worldX, p.worldY));
      if (hit) this.onOptionPointer(hit);
    });
    const kb = this.input.keyboard!;
    kb.addCapture('SPACE');
    kb.on('keydown-SPACE', () => this.setPaused(this.session.status !== 'paused'));
    kb.on('keydown-ESC', () => void this.exitToLevelSelect());
    kb.on('keydown-ONE', () => this.useItem('freeze'));
    kb.on('keydown-TWO', () => this.useItem('magnifier'));

    const autoPause = () => this.setPaused(true);
    this.game.events.on(Phaser.Core.Events.BLUR, autoPause);
    this.game.events.on(Phaser.Core.Events.HIDDEN, autoPause);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, autoPause);
      this.game.events.off(Phaser.Core.Events.HIDDEN, autoPause);
    });
  }

  // ---- questions ----

  private currentOptions(): OptionBody[] {
    return this.options.filter(o => o.questionSerial === this.serial);
  }

  private startQuestion(): void {
    this.serial++;
    this.options = this.options.filter(o => o.state !== 'removed');
    const q = this.session.question;
    this.hud.setPrompt(q.prompt);
    const n = q.options.length;
    const slotW = (SPAWN_X_MAX - SPAWN_X_MIN) / n;
    const slots = Phaser.Utils.Array.Shuffle([...Array(n).keys()]);
    q.options.forEach((spec, k) => {
      const x = SPAWN_X_MIN + slotW * (slots[k] + 0.5) + Phaser.Math.FloatBetween(-0.25, 0.25) * slotW;
      const opt = new OptionBody(this, {
        questionSerial: this.serial,
        optionId: spec.id,
        label: spec.label,
        correct: spec.correct,
        x,
        colorIndex: this.serial + k,
      });
      this.options.push(opt);
      if (k === 0) opt.drop();
      else this.time.delayedCall(k * SPAWN_STAGGER_MS, () => opt.drop());
    });
    this.emitEvent({ type: 'questionStart', index: this.session.questionIndex, question: q });
  }

  /** Single entry point for pointer clicks and debug answers. */
  private onOptionPointer(opt: OptionBody): void {
    // Review Focus 3: option ids restart every question, so only the serial guards stale/double clicks.
    if (this.leaving || opt.questionSerial !== this.serial || !opt.clickable) return;
    const r = this.session.click(opt.optionId, this.time.now);
    if (r.kind === 'ignored') return;
    if (r.kind === 'wrong') {
      opt.setGrey();
      opt.shake();
      this.emitEvent({ type: 'wrong', scoreDelta: r.scoreDelta, x: opt.x, y: opt.y });
      return;
    }
    if (r.kind === 'correct') {
      this.emitEvent({ type: 'correct', scoreDelta: r.scoreDelta, combo: r.combo, x: opt.x, y: opt.y, awardedItem: r.awardedItem });
    } else {
      this.emitEvent({ type: 'lateCorrect', x: opt.x, y: opt.y });
    }
    for (const o of this.currentOptions()) o.vanish();
    this.afterQuestion();
  }

  private markLanded(body: MatterJS.BodyType, other: MatterJS.BodyType): void {
    const opt = OptionBody.fromBody(body);
    if (!opt || opt.onPile || opt.state === 'removed') return;
    const otherOpt = OptionBody.fromBody(other);
    if ((other.parent ?? other).label !== 'ground' && !otherOpt?.onPile) return;
    opt.onPile = true;
    if (opt.state === 'falling') opt.state = 'landed';
  }

  private checkAllCorrectLanded(): void {
    const correct = this.currentOptions().filter(o => o.correct);
    if (correct.length > 0 && correct.every(o => o.onPile)) this.handleMiss();
  }

  private handleMiss(): void {
    if (this.leaving || this.session.status !== 'playing') return;
    const q = this.session.question;
    this.session.miss();
    this.hud.showAnswer(q.answerText, MISS_REVEAL_MS);
    for (const o of this.currentOptions()) o.setGrey();
    this.emitEvent({ type: 'miss', answerText: q.answerText });
    this.afterQuestion();
  }

  private afterQuestion(): void {
    if (this.session.status === 'playing') this.startQuestion();
    else this.checkEnd();
  }

  private useItem(kind: ItemKind): void {
    if (this.leaving || this.session.status !== 'playing') return;
    if (kind === 'freeze') {
      if (this.session.useFreeze()) this.emitEvent({ type: 'item', item: 'freeze' });
      return;
    }
    const active = this.currentOptions().filter(o => o.clickable);
    const id = this.session.useMagnifier(active.map(o => o.optionId));
    if (id === null) return;
    active.find(o => o.optionId === id)?.vanish();
    this.emitEvent({ type: 'item', item: 'magnifier' });
  }

  // ---- pause / exit / end ----

  private setPaused(paused: boolean): void {
    if (this.leaving) return;
    const s = this.session;
    if (paused && s.status === 'playing') {
      s.pause();
      this.matter.world.pause();
      this.time.paused = true;
      this.tweens.pauseAll();
      this.hud.setPaused(true);
    } else if (!paused && s.status === 'paused') {
      s.resume();
      this.matter.world.resume();
      this.time.paused = false;
      this.tweens.resumeAll();
      this.hud.setPaused(false);
    }
  }

  private async exitToLevelSelect(): Promise<void> {
    if (this.leaving) return;
    this.leaving = true;
    this.matter.world.pause();
    await (this.registry.get('store') as ProgressStore).save(this.progress);
    // LevelSelect arrives in Task 11; until then restart the level.
    if (this.game.scene.getScene('LevelSelect')) this.scene.start('LevelSelect');
    else this.scene.restart({ levelId: this.levelId });
  }

  private checkEnd(): void {
    const st = this.session.status;
    if (this.leaving || (st !== 'won' && st !== 'lost')) return;
    this.leaving = true;
    void this.endLevel();
  }

  private async endLevel(): Promise<void> {
    this.matter.world.pause();
    const result = this.session.result();
    this.emitEvent({ type: 'end', result });
    this.progress = applyLevelResult(this.progress, result, Date.now());
    await (this.registry.get('store') as ProgressStore).save(this.progress);
    this.scene.start('Result', { result });
  }

  private emitEvent(e: SessionEvent): void {
    this.events.emit('session-event', e);
  }

  // ---- debug hook ----

  debugState(): Partial<DebugState> {
    const s = this.session;
    if (!s) return {};
    return {
      questionIndex: s.questionIndex,
      score: s.score,
      status: s.status,
      timeLeftMs: s.timeLeftMs,
      ...(s.level.boss ? { bossHp: s.bossHp() } : {}),
    };
  }

  debugAnswer(correct: boolean): void {
    const opt = this.currentOptions().find(o => o.clickable && o.correct === correct);
    if (opt) this.onOptionPointer(opt);
  }

  debugDoubleClickCorrect(): void {
    const opt = this.currentOptions().find(o => o.clickable && o.correct);
    if (!opt) return;
    this.onOptionPointer(opt);
    this.onOptionPointer(opt);
  }

  debugMiss(): void {
    this.handleMiss();
  }
}
