// Portado de agent-town (MIT): components/game/entities/Player.ts
import {
  ALL_ANIMS,
  BOSS_SPRITE_KEY,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  MOVE_SPEED,
  BODY_SIZE_RATIO_W,
  BODY_SIZE_RATIO_H,
  BODY_OFFSET_RATIO_X,
  BODY_OFFSET_RATIO_Y,
} from "./config.js";

export class Player {
  constructor(scene, x, y, facing = "left") {
    this.facing = facing;
    this.arrow = null;
    this.hasMovedOnce = false;

    this.createAnimations(scene);

    this.sprite = scene.physics.add.sprite(x, y, BOSS_SPRITE_KEY, 0);
    this.sprite.setDepth(5);
    this.sprite.body.setSize(FRAME_WIDTH * BODY_SIZE_RATIO_W, FRAME_HEIGHT * BODY_SIZE_RATIO_H);
    this.sprite.body.setOffset(FRAME_WIDTH * BODY_OFFSET_RATIO_X, FRAME_HEIGHT * BODY_OFFSET_RATIO_Y);

    this.initArrow(scene, x, y);

    const kb = scene.input.keyboard;
    this.cursors = kb.createCursorKeys();
    kb.clearCaptures();
    this.wasd = kb.addKeys(
      {
        W: Phaser.Input.Keyboard.KeyCodes.W,
        A: Phaser.Input.Keyboard.KeyCodes.A,
        S: Phaser.Input.Keyboard.KeyCodes.S,
        D: Phaser.Input.Keyboard.KeyCodes.D,
      },
      false,
    );

    this.sprite.anims.play(`idle-${this.facing}`);
  }

  /** Setinha dourada pulando sobre o chefe ate ele se mexer pela primeira vez. */
  initArrow(scene, x, y) {
    if (!scene.textures.exists("boss-arrow")) return;
    if (!scene.anims.exists("boss-arrow-bounce")) {
      scene.anims.create({
        key: "boss-arrow-bounce",
        frames: scene.anims.generateFrameNumbers("boss-arrow", { start: 0, end: 5 }),
        frameRate: 6,
        repeat: -1,
      });
    }
    this.arrow = scene.add.sprite(x, y - FRAME_HEIGHT * 0.5, "boss-arrow", 0);
    this.arrow.setDepth(25);
    this.arrow.setTint(0xffd700);
    this.arrow.play("boss-arrow-bounce");
  }

  createAnimations(scene) {
    if (scene.anims.exists("idle-down")) return;
    for (const anim of ALL_ANIMS) {
      const frames = [];
      for (let i = anim.start; i <= anim.end; i++) frames.push({ key: BOSS_SPRITE_KEY, frame: i });
      scene.anims.create({ key: anim.key, frames, frameRate: anim.frameRate, repeat: anim.repeat });
    }
  }

  isMoving() {
    const v = this.sprite.body.velocity;
    return v.x !== 0 || v.y !== 0;
  }

  update() {
    const body = this.sprite.body;
    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -MOVE_SPEED;
    else if (this.cursors.right.isDown || this.wasd.D.isDown) vx = MOVE_SPEED;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -MOVE_SPEED;
    else if (this.cursors.down.isDown || this.wasd.S.isDown) vy = MOVE_SPEED;

    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }
    body.setVelocity(vx, vy);

    const moving = vx !== 0 || vy !== 0;

    if (!this.hasMovedOnce && moving && this.arrow) {
      this.hasMovedOnce = true;
      this.arrow.destroy();
      this.arrow = null;
    }
    if (this.arrow) this.arrow.setPosition(this.sprite.x, this.sprite.y - FRAME_HEIGHT * 0.5);

    if (moving) {
      if (vx < 0) this.facing = "left";
      else if (vx > 0) this.facing = "right";
      else if (vy < 0) this.facing = "up";
      else if (vy > 0) this.facing = "down";
      const key = `walk-${this.facing}`;
      if (this.sprite.anims.currentAnim?.key !== key) this.sprite.anims.play(key);
    } else {
      const key = `idle-${this.facing}`;
      if (this.sprite.anims.currentAnim?.key !== key) this.sprite.anims.play(key);
    }
  }
}
