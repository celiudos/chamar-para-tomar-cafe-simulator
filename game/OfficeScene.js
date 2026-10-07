import { TILE, AGENTS } from "./agents.js";
import { ensureAgentTexture, ensureAgentAnim } from "./character.js";

// Office grid size in tiles.
const COLS = 24;
const ROWS = 16;

export default class OfficeScene extends Phaser.Scene {
  constructor() {
    super("office");
  }

  create() {
    const W = COLS * TILE;
    const H = ROWS * TILE;

    this.buildFloor(W, H);
    this.buildWalls(W, H);
    this.buildRug();
    this.buildDesks();
    this.buildDecorations(W, H);
    this.buildAgents();

    // World + camera
    this.cameras.main.setBounds(0, 0, W, H);
    this.physics?.world?.setBounds?.(0, 0, W, H);
    this.cameras.main.setBackgroundColor("#0e1116");
    this.fitCamera(W, H);

    // Camera pan controls (WASD / arrows)
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys("W,A,S,D");

    this.scale.on("resize", () => this.fitCamera(W, H));
  }

  fitCamera(W, H) {
    const zoom = Math.min(this.scale.width / W, this.scale.height / H);
    this.cameras.main.setZoom(Math.max(zoom, 0.5));
    this.cameras.main.centerOn(W / 2, H / 2);
  }

  // ---- Scenery builders -------------------------------------------------

  buildFloor(W, H) {
    const g = this.add.graphics();
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const checker = (x + y) % 2 === 0;
        g.fillStyle(checker ? 0x2b3242 : 0x262c3a, 1);
        g.fillRect(x * TILE, y * TILE, TILE, TILE);
        // subtle plank line
        g.lineStyle(1, 0x1f2531, 0.5);
        g.strokeRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
  }

  buildWalls(W, H) {
    const g = this.add.graphics();
    // Top wall band
    g.fillStyle(0x343c4e, 1);
    g.fillRect(0, 0, W, TILE);
    g.fillStyle(0x2a3140, 1);
    g.fillRect(0, TILE - 6, W, 6); // baseboard shadow

    // Side wall accents
    g.fillStyle(0x343c4e, 1);
    g.fillRect(0, 0, 6, H);
    g.fillRect(W - 6, 0, 6, H);
    g.fillRect(0, H - 6, W, 6);

    // Windows on top wall
    for (let i = 2; i < COLS - 2; i += 5) {
      const wx = i * TILE;
      g.fillStyle(0x7fc7ff, 1);
      g.fillRect(wx, 5, TILE * 2, TILE - 12);
      g.fillStyle(0xbfe3ff, 0.6);
      g.fillRect(wx, 5, TILE, (TILE - 12) / 2);
      g.lineStyle(2, 0x222733, 1);
      g.strokeRect(wx, 5, TILE * 2, TILE - 12);
      g.lineBetween(wx + TILE, 5, wx + TILE, TILE - 7);
    }
  }

  buildRug() {
    const g = this.add.graphics();
    const rx = 8 * TILE, ry = 12 * TILE, rw = 8 * TILE, rh = 3 * TILE;
    g.fillStyle(0x2f3a52, 1);
    g.fillRoundedRect(rx, ry, rw, rh, 10);
    g.lineStyle(3, 0x44527a, 1);
    g.strokeRoundedRect(rx + 6, ry + 6, rw - 12, rh - 12, 8);
  }

  // A single desk + chair + monitor at tile (tx, ty), accent color.
  deskAt(tx, ty, accent) {
    const x = tx * TILE, y = ty * TILE;
    const c = this.add.container(x, y);

    const g = this.add.graphics();
    // Chair
    g.fillStyle(0x222733, 1);
    g.fillRoundedRect(TILE * 0.5, TILE * 1.1, TILE, TILE * 0.8, 4);
    // Desk top
    g.fillStyle(0x8a6a44, 1);
    g.fillRoundedRect(-TILE * 0.2, 0, TILE * 2.4, TILE, 5);
    g.fillStyle(0x6f5436, 1);
    g.fillRect(-TILE * 0.2, TILE * 0.72, TILE * 2.4, TILE * 0.28);
    // Monitor
    g.fillStyle(0x15181f, 1);
    g.fillRoundedRect(TILE * 0.55, -TILE * 0.55, TILE * 1.1, TILE * 0.7, 3);
    g.fillStyle(accent, 1);
    g.fillRect(TILE * 0.65, -TILE * 0.45, TILE * 0.9, TILE * 0.5);
    g.fillStyle(0x222733, 1);
    g.fillRect(TILE * 1.0, TILE * 0.15, TILE * 0.2, TILE * 0.12);
    // Keyboard
    g.fillStyle(0x4a5366, 1);
    g.fillRoundedRect(TILE * 0.7, TILE * 0.4, TILE * 0.8, TILE * 0.22, 2);

    c.add(g);
    return c;
  }

  buildDesks() {
    // Place a desk beneath each agent seat.
    AGENTS.forEach((a) => this.deskAt(a.seat.x - 1, a.seat.y + 1, a.color));
  }

  buildDecorations(W, H) {
    const g = this.add.graphics();

    // Plants in corners
    const plant = (px, py) => {
      g.fillStyle(0x6a4a2c, 1);
      g.fillRect(px - 7, py, 14, 12);
      g.fillStyle(0x3fa65a, 1);
      g.fillCircle(px, py - 6, 12);
      g.fillStyle(0x53c472, 1);
      g.fillCircle(px - 6, py - 2, 7);
      g.fillCircle(px + 6, py - 2, 7);
    };
    plant(TILE * 1.6, TILE * 2.4);
    plant(W - TILE * 1.6, TILE * 2.4);
    plant(TILE * 1.6, H - TILE * 1.8);
    plant(W - TILE * 1.6, H - TILE * 1.8);

    // Whiteboard on the top-right wall area
    g.fillStyle(0xf4f6fb, 1);
    g.fillRoundedRect(W - TILE * 6, TILE * 1.4, TILE * 4, TILE * 2, 4);
    g.lineStyle(2, 0x9aa6bd, 1);
    g.strokeRoundedRect(W - TILE * 6, TILE * 1.4, TILE * 4, TILE * 2, 4);
    g.lineStyle(2, 0x5ad1ff, 1);
    g.lineBetween(W - TILE * 5.6, TILE * 2.0, W - TILE * 3.2, TILE * 2.0);
    g.lineBetween(W - TILE * 5.6, TILE * 2.5, W - TILE * 4.2, TILE * 2.5);
    g.lineStyle(2, 0xff8a5a, 1);
    g.lineBetween(W - TILE * 3.0, TILE * 2.3, W - TILE * 2.3, TILE * 2.9);

    // Bookshelf (left wall)
    g.fillStyle(0x5a4027, 1);
    g.fillRect(TILE * 0.4, TILE * 4, TILE * 1.1, TILE * 4);
    const bookColors = [0xff8a5a, 0x5ad1ff, 0x7ef0a0, 0xffcc4d, 0x9b8cff];
    for (let i = 0; i < 8; i++) {
      g.fillStyle(bookColors[i % bookColors.length], 1);
      g.fillRect(TILE * 0.5 + (i % 4) * 7, TILE * 4.2 + Math.floor(i / 4) * TILE * 1.9, 6, TILE * 1.6);
    }

    // Coffee / water station (bottom-left)
    g.fillStyle(0x2a3140, 1);
    g.fillRoundedRect(TILE * 2, H - TILE * 3, TILE * 1.6, TILE * 1.6, 4);
    g.fillStyle(0x5ad1ff, 0.8);
    g.fillRect(TILE * 2.4, H - TILE * 2.7, TILE * 0.8, TILE * 1.0);
  }

  buildAgents() {
    this.agentSprites = AGENTS.map((a) => {
      const key = `agent-${a.id}`;
      ensureAgentTexture(this, key, a.color);
      const anim = ensureAgentAnim(this, key);

      const px = a.seat.x * TILE + TILE / 2;
      const py = a.seat.y * TILE + TILE / 2;

      const sprite = this.add.sprite(px, py, key, 0).setOrigin(0.5, 0.9);
      sprite.setScale(1.4);
      sprite.play(anim);

      // Name tag above the head
      const label = this.add
        .text(px, py - 44, a.name, {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#e8edf5",
          backgroundColor: "#12161ecc",
          padding: { x: 5, y: 2 },
        })
        .setOrigin(0.5, 1);

      // gentle vertical bob so idle agents feel alive
      this.tweens.add({
        targets: [sprite],
        y: py - 3,
        duration: 900 + Math.random() * 400,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });

      return { sprite, label, data: a };
    });
  }

  update() {
    const cam = this.cameras.main;
    const speed = 6 / cam.zoom;
    const c = this.cursors, w = this.wasd;
    if (c.left.isDown || w.A.isDown) cam.scrollX -= speed;
    if (c.right.isDown || w.D.isDown) cam.scrollX += speed;
    if (c.up.isDown || w.W.isDown) cam.scrollY -= speed;
    if (c.down.isDown || w.S.isDown) cam.scrollY += speed;
  }
}
