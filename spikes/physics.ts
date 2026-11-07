// Throwaway physics spike — not production code.
import Phaser from 'phaser';

const W = 1280, H = 720, GROUND = 700, BAND = 120, R = 40;
const COLORS = [0xff6b6b, 0xffa94d, 0xffd43b, 0x69db7c, 0x4dabf7, 0x9775fa, 0xf783ac];

const $ = (id: string) => document.getElementById(id) as HTMLInputElement;
const params = () => ({
  gravity: Number($('gravity').value),
  bounce: Number($('bounce').value),
  air: Number($('air').value),
  pegs: $('pegs').checked,
  launch: (document.getElementById('launch') as HTMLSelectElement).value,
});
for (const id of ['gravity', 'bounce', 'air']) {
  $(id).addEventListener('input', () => { (document.getElementById(id + 'V') as HTMLOutputElement).value = $(id).value; });
}

// --- tiny WebAudio blips --------------------------------------------------
let ctx: AudioContext | null = null;
let lastBlip = 0;
function blip(freq: number, dur = 0.08, type: OscillatorType = 'triangle', vol = 0.15) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur);
}

type Ball = {
  img: Phaser.Physics.Matter.Image;
  label: Phaser.GameObjects.Text;
  value: number;
  correct: boolean;
  dead: boolean;   // greyed (wrong click or missed)
  restMs: number;
  serial: number;
};

class Spike extends Phaser.Scene {
  balls: Ball[] = [];
  pegs: Phaser.GameObjects.Arc[] = [];
  serial = 0;
  answer = 0;
  score = 0;
  combo = 0;
  prompt!: Phaser.GameObjects.Text;
  scoreText!: Phaser.GameObjects.Text;
  reveal!: Phaser.GameObjects.Text;
  resolving = false;

  create() {
    // textures
    const g = this.add.graphics();
    COLORS.forEach((c, i) => {
      g.clear();
      g.fillStyle(0x000000, 0.18).fillCircle(R + 2, R + 4, R);
      g.fillStyle(c, 1).fillCircle(R, R, R);
      g.fillStyle(0xffffff, 0.9).fillRect(R - 4, 4, 8, 14);          // stripe shows rotation
      g.fillStyle(0xffffff, 0.35).fillCircle(R - 13, R - 14, 11);    // highlight
      g.lineStyle(4, 0xffffff, 0.9).strokeCircle(R, R, R - 2);
      g.generateTexture('ball' + i, R * 2 + 4, R * 2 + 6);
    });
    g.clear().fillStyle(0x9aa0b4, 1).fillCircle(R, R, R).lineStyle(4, 0xd0d4e0, 1).strokeCircle(R, R, R - 2);
    g.generateTexture('ballDead', R * 2 + 4, R * 2 + 6);
    g.clear().fillStyle(0xffffff, 1).fillCircle(6, 6, 6); g.generateTexture('spark', 12, 12);
    g.clear().fillStyle(0xffffff, 1);
    g.fillPoints([0, -10, 3, -3, 10, -3, 4, 2, 6, 10, 0, 5, -6, 10, -4, 2, -10, -3, -3, -3].reduce<Phaser.Types.Math.Vector2Like[]>(
      (a, v, i, arr) => (i % 2 ? a : [...a, { x: arr[i] + 10, y: arr[i + 1] + 10 }]), []), true);
    g.generateTexture('star', 20, 20);
    g.destroy();

    // background + band + ground
    this.add.rectangle(W / 2, H / 2, W, H, 0x2e3a6e);
    for (let i = 0; i < 40; i++) this.add.circle(Phaser.Math.Between(0, W), Phaser.Math.Between(BAND, GROUND), Phaser.Math.Between(1, 3), 0xffffff, 0.15);
    this.add.rectangle(W / 2, BAND / 2, W, BAND, 0x1d2440, 0.92).setDepth(50);
    this.add.rectangle(W / 2, GROUND + 10, W, 20, 0x6c4f3d).setDepth(5);
    this.prompt = this.add.text(W / 2, BAND / 2, '', { fontSize: '64px', fontStyle: 'bold', color: '#ffffff', fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif' }).setOrigin(0.5).setDepth(51);
    this.scoreText = this.add.text(24, 24, '', { fontSize: '28px', color: '#ffd166', fontStyle: 'bold' }).setDepth(51);
    this.reveal = this.add.text(W / 2, BAND + 30, '', { fontSize: '30px', color: '#69db7c', fontStyle: 'bold' }).setOrigin(0.5).setDepth(51);

    this.matter.world.setBounds(0, -600, W, GROUND + 600, 80, true, true, false, true);
    this.buildPegs();

    this.matter.world.on('collisionstart', (ev: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
      for (const p of ev.pairs) this.onHit(p.bodyA as MatterJS.BodyType, p.bodyB as MatterJS.BodyType);
    });

    this.input.on('gameobjectdown', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => this.onClick(obj));
    this.input.once('pointerdown', () => { ctx = new AudioContext(); });

    this.nextQuestion();
  }

  buildPegs() {
    this.pegs.forEach(p => p.destroy());
    this.pegs = [];
    if (!params().pegs) return;
    const rows = 4;
    for (let r = 0; r < rows; r++) {
      const y = 240 + r * 85;
      const n = r % 2 ? 9 : 10;
      for (let i = 0; i < n; i++) {
        const x = (r % 2 ? 140 : 75) + i * 125;
        const peg = this.add.circle(x, y, 9, 0xffd166).setStrokeStyle(3, 0xfff3bf);
        this.matter.add.gameObject(peg, { isStatic: true, shape: { type: 'circle', radius: 9 }, restitution: 0.9, label: 'peg' });
        this.pegs.push(peg);
      }
    }
  }

  onHit(a: MatterJS.BodyType, b: MatterJS.BodyType) {
    const speed = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
    if (speed < 1.5) return;
    const now = this.time.now;
    const peg = a.label === 'peg' ? a : b.label === 'peg' ? b : null;
    if (peg) {
      const go = peg.gameObject as Phaser.GameObjects.Arc | undefined;
      if (go) this.tweens.add({ targets: go, scale: 1.6, duration: 70, yoyo: true });
    }
    // squash on hard ground hits
    for (const body of [a, b]) {
      const ball = this.balls.find(x => x.img.body === body);
      if (ball && body.position.y > GROUND - R - 8 && speed > 5) {
        this.tweens.add({ targets: ball.img, scaleY: 0.78, scaleX: 1.15, duration: 60, yoyo: true });
      }
    }
    if (speed > 4) {
      const x = (a.position.x + b.position.x) / 2, y = (a.position.y + b.position.y) / 2;
      const e = this.add.particles(x, y, 'spark', { speed: { min: 60, max: 160 }, lifespan: 250, scale: { start: 0.6, end: 0 }, tint: 0xfff3bf, emitting: false });
      e.explode(5);
      this.time.delayedCall(300, () => e.destroy());
    }
    if (now - lastBlip > 35) {
      lastBlip = now;
      blip(peg ? 900 + Math.min(speed, 15) * 40 : 300 + Math.min(speed, 15) * 25, 0.07, peg ? 'sine' : 'triangle', Math.min(0.05 + speed * 0.012, 0.2));
    }
  }

  nextQuestion() {
    this.resolving = false;
    this.reveal.setText('');
    const p = params();
    this.matter.world.engine.gravity.y = p.gravity;
    if ((this.pegs.length > 0) !== p.pegs) this.buildPegs();

    const a = Phaser.Math.Between(2, 9), b = Phaser.Math.Between(2, 9);
    this.answer = a * b;
    this.prompt.setText(`${a} × ${b} = ?`);
    const vals = new Set<number>([this.answer]);
    const near = [this.answer + a, this.answer - a, this.answer + b, this.answer - b, this.answer + 1, this.answer - 1, this.answer + 10];
    Phaser.Utils.Array.Shuffle(near);
    for (const v of near) { if (vals.size >= 5) break; if (v > 0) vals.add(v); }
    const list = Phaser.Utils.Array.Shuffle([...vals]);
    this.serial++;
    list.forEach((v, i) => this.time.delayedCall(i * 220, () => this.spawn(v, v === this.answer, i, p)));
  }

  spawn(value: number, correct: boolean, i: number, p: ReturnType<typeof params>) {
    let x: number, y: number, vx: number, vy: number;
    if (p.launch === 'toss') {
      const left = i % 2 === 0;
      x = left ? 70 : W - 70; y = BAND + 50;
      vx = (left ? 1 : -1) * Phaser.Math.FloatBetween(5, 11); vy = Phaser.Math.FloatBetween(-7, -2);
    } else {
      x = Phaser.Math.Between(150, W - 150); y = BAND + 10; vx = Phaser.Math.FloatBetween(-2, 2); vy = 0;
    }
    const img = this.matter.add.image(x, y, 'ball' + Phaser.Math.Between(0, COLORS.length - 1), undefined, {
      shape: { type: 'circle', radius: R }, restitution: p.bounce, friction: 0.05, frictionAir: p.air, density: 0.002,
    });
    img.setVelocity(vx, vy).setAngularVelocity(Phaser.Math.FloatBetween(-0.15, 0.15)).setDepth(10).setInteractive();
    img.setScale(0.2); this.tweens.add({ targets: img, scale: 1, duration: 220, ease: 'Back.Out' });
    const label = this.add.text(x, y, String(value), { fontSize: '34px', fontStyle: 'bold', color: '#ffffff', stroke: '#00000055', strokeThickness: 6 }).setOrigin(0.5).setDepth(11);
    this.balls.push({ img, label, value, correct, dead: false, restMs: 0, serial: this.serial });
  }

  onClick(obj: Phaser.GameObjects.GameObject) {
    const ball = this.balls.find(b => b.img === obj);
    if (!ball || ball.dead || ball.serial !== this.serial || this.resolving) return;
    if (ball.correct) {
      this.resolving = true;
      this.combo++;
      this.score += 10 * (this.combo >= 5 ? 2 : this.combo >= 3 ? 1.5 : 1);
      this.explode(ball);
      blip(660, 0.12, 'square', 0.12); this.time.delayedCall(90, () => blip(990, 0.18, 'square', 0.12));
      this.time.delayedCall(700, () => {
        for (const b of this.balls.filter(b => b.serial === this.serial && !b.dead)) this.pop(b, false);
        this.time.delayedCall(250, () => this.nextQuestion());
      });
    } else {
      this.combo = 0;
      this.score = Math.max(0, this.score - 5);
      this.kill(ball);
      this.tweens.add({ targets: ball.img, x: ball.img.x + 8, duration: 50, yoyo: true, repeat: 3 });
      blip(180, 0.25, 'sawtooth', 0.12);
    }
  }

  explode(ball: Ball) {
    const { x, y } = ball.img;
    // shove neighbours away
    for (const o of this.balls) {
      if (o === ball) continue;
      const dx = o.img.x - x, dy = o.img.y - y, d = Math.hypot(dx, dy);
      if (d < 320 && d > 0) {
        const f = (1 - d / 320) * 16;
        o.img.setVelocity(o.img.body!.velocity.x + (dx / d) * f, o.img.body!.velocity.y + (dy / d) * f - 4);
      }
    }
    const e1 = this.add.particles(x, y, 'star', { speed: { min: 250, max: 650 }, lifespan: 900, scale: { start: 1.6, end: 0 }, rotate: { min: 0, max: 360 }, tint: [0xffd43b, 0xff6b6b, 0x69db7c, 0x4dabf7, 0xf783ac], gravityY: 600, emitting: false }).setDepth(20);
    e1.explode(36);
    const ring = this.add.circle(x, y, R, 0xffffff, 0).setStrokeStyle(8, 0xffffff).setDepth(20);
    this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
    const pts = this.add.text(x, y - 20, `+${10 * (this.combo >= 5 ? 2 : this.combo >= 3 ? 1.5 : 1)}`, { fontSize: '44px', fontStyle: 'bold', color: '#ffd43b', stroke: '#7a4b00', strokeThickness: 6 }).setOrigin(0.5).setDepth(21);
    this.tweens.add({ targets: pts, y: y - 120, alpha: 0, scale: 1.4, duration: 900, ease: 'Cubic.Out', onComplete: () => pts.destroy() });
    if (this.combo >= 3) {
      const c = this.add.text(W / 2, H / 2, `${this.combo} 连击！`, { fontSize: '96px', fontStyle: 'bold', color: '#ff6b6b', stroke: '#ffffff', strokeThickness: 10 }).setOrigin(0.5).setDepth(30).setScale(0.3);
      this.tweens.add({ targets: c, scale: 1.1, duration: 250, ease: 'Back.Out', yoyo: true, hold: 300, onComplete: () => c.destroy() });
    }
    this.cameras.main.shake(120, 0.004);
    this.time.delayedCall(1000, () => { e1.destroy(); });
    this.pop(ball, true);
  }

  pop(ball: Ball, instant: boolean) {
    ball.dead = true;
    this.tweens.add({ targets: [ball.img, ball.label], scale: instant ? 1.6 : 0, alpha: 0, duration: instant ? 120 : 250, onComplete: () => { ball.img.destroy(); ball.label.destroy(); } });
    this.balls = this.balls.filter(b => b !== ball);
  }

  kill(ball: Ball) {
    ball.dead = true;
    ball.img.setTexture('ballDead');
    ball.img.setDensity(0.006);
    ball.label.setColor('#5c6178');
  }

  update(_t: number, dt: number) {
    for (const b of this.balls) {
      b.label.setPosition(b.img.x, b.img.y);   // number stays upright while the ball spins
      if (b.correct && !b.dead && b.serial === this.serial) {
        const v = b.img.body!.velocity;
        const resting = b.img.y > GROUND - R - 12 && Math.hypot(v.x, v.y) < 0.8;
        b.restMs = resting ? b.restMs + dt : 0;
      }
    }
    const current = this.balls.filter(b => b.serial === this.serial && b.correct && !b.dead);
    if (!this.resolving && current.length > 0 && current.every(b => b.restMs > 1500)) {
      this.resolving = true;
      this.combo = 0;
      this.reveal.setText(`${this.prompt.text.replace('?', String(this.answer))}`);
      for (const b of this.balls.filter(b => b.serial === this.serial)) this.kill(b);
      this.time.delayedCall(1200, () => this.nextQuestion());
    }
    // keep the pile from growing forever in the spike
    const deadOld = this.balls.filter(b => b.dead);
    if (deadOld.length > 18) this.pop(deadOld[0], false);
    this.scoreText.setText(`得分 ${this.score}   连击 ${this.combo}`);
  }
}

new Phaser.Game({
  type: Phaser.AUTO, width: W, height: H, parent: 'game', backgroundColor: '#2e3a6e',
  physics: { default: 'matter', matter: { gravity: { x: 0, y: 1 } } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY, width: W, height: H },
  scene: [Spike],
});
