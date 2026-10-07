// Baseado em agent-town (MIT): components/game/entities/Worker.ts + worker/idle.ts.
// O worker fica na cadeira (animacao idle, nome, ponto de status e emotes aleatorios) ate
// aceitar o cafe: ai levanta e anda por uma lista de pontos ate a cafeteira (walkPath).
import {
  BUBBLE_Y_OFFSET,
  EMOTE_ANIMS,
  EMOTE_SHEET_KEY,
  EMOTE_Y_OFFSET,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  SEAT_ACTIVITIES,
  WANDER_INITIAL_MAX,
  WANDER_INITIAL_MIN,
  WANDER_MAX_DELAY,
  WANDER_MIN_DELAY,
  BODY_SIZE_RATIO_W,
  BODY_SIZE_RATIO_H,
  BODY_OFFSET_RATIO_X,
  BODY_OFFSET_RATIO_Y,
  makeAnims,
} from "./constants.js";
import { buildSpriteFrames } from "./MapHelpers.js";
import { ChatBubble } from "./ChatBubble.js";

const STATUS_COLORS = { idle: 0x888888, working: 0xfacc15, done: 0x22c55e, failed: 0xef4444 };
/** Andando, fica acima da camada "overhead" (encosto das cadeiras, profundidade 10). */
const WALK_DEPTH = 11;
const SEATED_DEPTH = 5;

export class Worker {
  /** `character` e o objeto de config/characters.js (nome, genero, persona, ...). */
  constructor(scene, x, y, spriteKey, seatId, character, facing = "up") {
    this.scene = scene;
    this.seatId = seatId;
    this.character = character;
    this.label = character.name;
    this.spriteKey = spriteKey;
    this.facing = facing;
    this.status = "idle";
    this.currentEmoteKey = null;
    this.timer = null;
    /** true depois que levantou da cadeira (andando ou ja no cafe). */
    this.leftSeat = false;
    const label = this.label;

    this.ensureAnims(scene, spriteKey);

    this.sprite = scene.physics.add.sprite(x, y, spriteKey, 0);
    this.sprite.setDepth(SEATED_DEPTH);
    this.sprite.body.setSize(FRAME_WIDTH * BODY_SIZE_RATIO_W, FRAME_HEIGHT * BODY_SIZE_RATIO_H);
    this.sprite.body.setOffset(FRAME_WIDTH * BODY_OFFSET_RATIO_X, FRAME_HEIGHT * BODY_OFFSET_RATIO_Y);
    this.sprite.body.allowGravity = false;
    this.sprite.body.setImmovable(true);
    this.sprite.anims.play(`${spriteKey}:idle-${facing}`);

    const nameY = y + FRAME_HEIGHT / 2 + 2;
    this.nameTag = scene.add
      .text(x, nameY, label, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: "8px",
        color: "#e0e0e0",
        backgroundColor: "rgba(0,0,0,0.7)",
        padding: { x: 4, y: 2 },
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setDepth(20);
    this.statusDot = scene.add
      .circle(x - this.nameTag.width / 2 - 6, nameY + 4, 3, STATUS_COLORS.idle)
      .setDepth(20);

    this.emoteSprite = scene.add
      .sprite(x, y - FRAME_HEIGHT * EMOTE_Y_OFFSET, EMOTE_SHEET_KEY, 0)
      .setDepth(22)
      .setVisible(false);
    this.registerEmoteAnims();
    this.bubble = new ChatBubble(scene);

    const initial = Phaser.Math.Between(WANDER_INITIAL_MIN, WANDER_INITIAL_MAX);
    this.timer = scene.time.delayedCall(initial, () => this.nextActivity());
  }

  ensureAnims(scene, spriteKey) {
    if (scene.anims.exists(`${spriteKey}:idle-down`)) return;
    buildSpriteFrames(scene, spriteKey);
    const anims = [...makeAnims(spriteKey, "idle", 1, 8), ...makeAnims(spriteKey, "walk", 2, 10)];
    for (const a of anims) {
      const frames = [];
      for (let i = a.start; i <= a.end; i++) frames.push({ key: spriteKey, frame: i });
      scene.anims.create({ key: a.key, frames, frameRate: a.frameRate, repeat: a.repeat });
    }
  }

  registerEmoteAnims() {
    for (const def of EMOTE_ANIMS) {
      if (this.scene.anims.exists(def.key)) continue;
      this.scene.anims.create({
        key: def.key,
        frames: def.frames.map((f) => ({ key: EMOTE_SHEET_KEY, frame: f })),
        frameRate: def.frameRate,
        repeat: def.repeat,
      });
    }
  }

  setStatus(status) {
    this.status = status;
    this.statusDot.setFillStyle(STATUS_COLORS[status]);
  }

  showEmote(key) {
    if (this.currentEmoteKey === key) return;
    this.bubble.hide();
    this.emoteSprite.removeAllListeners("animationcomplete");
    this.currentEmoteKey = key;
    this.emoteSprite.setVisible(true);
    this.emoteSprite.play(key);

    const def = EMOTE_ANIMS.find((a) => a.key === key);
    if (def && def.repeat >= 0) {
      this.emoteSprite.once("animationcomplete", () => {
        this.emoteSprite.setVisible(false);
        this.currentEmoteKey = null;
      });
    }
  }

  hideEmote() {
    this.emoteSprite.removeAllListeners("animationcomplete");
    this.emoteSprite.setVisible(false);
    this.emoteSprite.stop();
    this.currentEmoteKey = null;
  }

  /** Escolhe um emote de atividade, mostra por um tempo e agenda o proximo. */
  nextActivity() {
    const def = Phaser.Utils.Array.GetRandom(SEAT_ACTIVITIES);
    const duration = Phaser.Math.Between(def.minDuration, def.maxDuration);
    this.showEmote(def.emote);
    this.timer = this.scene.time.delayedCall(duration, () => {
      this.hideEmote();
      const pause = Phaser.Math.Between(WANDER_MIN_DELAY, WANDER_MAX_DELAY);
      this.timer = this.scene.time.delayedCall(pause, () => this.nextActivity());
    });
  }

  /** Para o ciclo de emotes aleatorios (durante a conversa, a caminhada...). */
  pauseActivities() {
    this.timer?.remove(false);
    this.timer = null;
  }

  /** Retoma o ciclo de emotes aleatorios depois de `delay` ms. */
  resumeActivities(delay = Phaser.Math.Between(WANDER_MIN_DELAY, WANDER_MAX_DELAY)) {
    this.pauseActivities();
    this.timer = this.scene.time.delayedCall(delay, () => this.nextActivity());
  }

  /** Mostra um balao de fala sobre o personagem (substitui o emote atual). */
  showBubble(message, ttl = 5000) {
    this.hideEmote();
    this.bubble.show(message, this.sprite.x, this.sprite.y - FRAME_HEIGHT * BUBBLE_Y_OFFSET, ttl);
  }

  /**
   * Levanta e anda pelos pontos `points` ({ x, y } em px do mundo) a `speed` px/s.
   * Termina parado, virado para `facing`, e chama `onArrive`.
   */
  walkPath(points, facing, speed, onArrive) {
    this.pauseActivities();
    this.hideEmote();
    this.leftSeat = true;
    // Sem corpo fisico no caminho: nao empurra o chefe nem fica preso nos moveis.
    this.sprite.body.enable = false;
    this.sprite.setDepth(WALK_DEPTH);

    const step = (i) => {
      if (i >= points.length) {
        this.facing = facing;
        this.sprite.anims.play(`${this.spriteKey}:idle-${facing}`);
        this.sprite.setDepth(SEATED_DEPTH);
        this.sprite.body.enable = true;
        this.sprite.body.reset(this.sprite.x, this.sprite.y);
        onArrive?.();
        return;
      }
      const { x, y } = points[i];
      const dx = x - this.sprite.x;
      const dy = y - this.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) {
        step(i + 1);
        return;
      }
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
      this.sprite.anims.play(`${this.spriteKey}:walk-${dir}`, true);
      this.scene.tweens.add({
        targets: this.sprite,
        x,
        y,
        duration: (dist / speed) * 1000,
        onComplete: () => step(i + 1),
      });
    };
    step(0);
  }

  /** Mantem nome, status, emote e balao acompanhando o personagem (chamar a cada frame). */
  update() {
    const { x, y } = this.sprite;
    const nameY = y + FRAME_HEIGHT / 2 + 2;
    this.nameTag.setPosition(x, nameY);
    this.statusDot.setPosition(x - this.nameTag.width / 2 - 6, nameY + 4);
    this.emoteSprite.setPosition(x, y - FRAME_HEIGHT * EMOTE_Y_OFFSET);
    this.bubble.updatePosition(x, y - FRAME_HEIGHT * BUBBLE_Y_OFFSET);
  }

  destroy() {
    this.scene.tweens.killTweensOf(this.sprite);
    this.timer?.destroy();
    this.bubble.destroy();
    this.emoteSprite.removeAllListeners();
    this.emoteSprite.destroy();
    this.sprite.destroy();
    this.nameTag.destroy();
    this.statusDot.destroy();
  }
}
