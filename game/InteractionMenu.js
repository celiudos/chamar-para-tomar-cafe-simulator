// Portado de agent-town (MIT): components/game/entities/InteractionMenu.ts
// Menu estilo RPG: W/S ou setas navegam, E/Enter confirmam, Esc fecha, mouse tambem funciona.

const MENU_WIDTH = 240;
const ITEM_HEIGHT = 30;
const FONT_SIZE = "14px";
const PAD_X = 10;
const PAD_Y = 6;
const BG_COLOR = 0x252219;
const BG_ALPHA = 0.96;
const BORDER_COLOR = 0x4a4238;
const HIGHLIGHT_FILL = 0x4a4238;
const HIGHLIGHT_ALPHA = 0.9;
const HIGHLIGHT_BORDER = 0xc9a227;
const TEXT_COLOR = "#e8e2d8";
const TEXT_HIGHLIGHT = "#f5e6b3";
const DISABLED_COLOR = "#a09888";
const DEPTH = 30;

export class InteractionMenu {
  constructor(scene) {
    this.scene = scene;
    this.options = [];
    this.items = [];
    this.highlights = [];
    this.hitZones = [];
    this.selectedIndex = 0;
    this._visible = false;
    this.openFrame = 0;
    this.onClose = null;

    this.bg = scene.add.graphics();
    this.container = scene.add.container(0, 0, [this.bg]);
    this.container.setDepth(DEPTH);
    this.container.setVisible(false);

    const kb = scene.input.keyboard;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.upKey = kb.addKey(K.W, false);
    this.downKey = kb.addKey(K.S, false);
    this.upArrow = kb.addKey(K.UP, false);
    this.downArrow = kb.addKey(K.DOWN, false);
    this.confirmKey = kb.addKey(K.E, false);
    this.enterKey = kb.addKey(K.ENTER, false);
    this.escKey = kb.addKey(K.ESC, false);
  }

  get visible() {
    return this._visible;
  }

  /** options: [{ label, enabled, action }]; (worldX, worldY) ancora o menu na tela. */
  show(worldX, worldY, options) {
    this.options = options;
    this.selectedIndex = Math.max(0, options.findIndex((o) => o.enabled));
    this.openFrame = this.scene.game.getFrame();
    this.clearItems();

    const totalH = options.length * ITEM_HEIGHT + PAD_Y * 2;
    this.bg.clear();
    this.bg.fillStyle(BG_COLOR, BG_ALPHA);
    this.bg.fillRoundedRect(0, 0, MENU_WIDTH, totalH, 6);
    this.bg.lineStyle(2, BORDER_COLOR, 1);
    this.bg.strokeRoundedRect(0, 0, MENU_WIDTH, totalH, 6);

    options.forEach((opt, i) => {
      const y = PAD_Y + i * ITEM_HEIGHT;

      const highlight = this.scene.add.graphics();
      highlight.setPosition(MENU_WIDTH / 2, y + ITEM_HEIGHT / 2);
      const w = MENU_WIDTH - 4;
      const h = ITEM_HEIGHT - 2;
      highlight.fillStyle(HIGHLIGHT_FILL, HIGHLIGHT_ALPHA);
      highlight.fillRoundedRect(-w / 2, -h / 2, w, h, 4);
      highlight.lineStyle(2, HIGHLIGHT_BORDER, 0.95);
      highlight.strokeRoundedRect(-w / 2, -h / 2, w, h, 4);
      highlight.setVisible(false);
      this.highlights.push(highlight);
      this.container.add(highlight);

      const txt = this.scene.add.text(PAD_X, y + ITEM_HEIGHT / 2, opt.label, {
        fontFamily: '"SF Mono", "Cascadia Code", Consolas, "Liberation Mono", Menlo, monospace',
        fontSize: FONT_SIZE,
        color: opt.enabled ? TEXT_COLOR : DISABLED_COLOR,
      });
      txt.setResolution(window.devicePixelRatio * 2);
      txt.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      txt.setOrigin(0, 0.5);
      this.items.push(txt);
      this.container.add(txt);

      const hit = this.scene.add.rectangle(MENU_WIDTH / 2, y + ITEM_HEIGHT / 2, MENU_WIDTH, ITEM_HEIGHT, 0x000000, 0);
      hit.setInteractive({ useHandCursor: opt.enabled });
      hit.on("pointerover", () => {
        if (opt.enabled) {
          this.selectedIndex = i;
          this.updateHighlight();
        }
      });
      hit.on("pointerdown", () => {
        if (opt.enabled) {
          this.hide();
          opt.action();
        }
      });
      this.hitZones.push(hit);
      this.container.add(hit);
    });

    this.updateHighlight();

    // Posiciona acima do alvo, mantendo o menu dentro da tela. Fica em coordenadas de mundo
    // com escala 1/zoom, assim o tamanho na tela independe do zoom da camera.
    const cam = this.scene.cameras.main;
    const z = cam.zoom;
    const view = cam.worldView;
    const margin = 10 / z;
    const menuW = MENU_WIDTH / z;
    const menuH = totalH / z;
    const x = Math.max(Math.min(worldX - menuW / 2, view.right - menuW - margin), view.x + margin);
    const y = Math.max(worldY - menuH - margin, view.y + margin);
    this.container.setScale(1 / z);
    this.container.setPosition(x, y);
    this.container.setVisible(true);
    this._visible = true;
  }

  hide() {
    this.container.setVisible(false);
    this._visible = false;
    this.clearItems();
  }

  update() {
    if (!this._visible) return;
    // Ignora os 2 primeiros frames para a tecla "E" que abriu o menu nao confirmar a 1a opcao.
    if (this.scene.game.getFrame() - this.openFrame < 2) return;

    const J = Phaser.Input.Keyboard.JustDown;
    if (J(this.upKey) || J(this.upArrow)) this.moveSelection(-1);
    else if (J(this.downKey) || J(this.downArrow)) this.moveSelection(1);

    if (J(this.confirmKey) || J(this.enterKey)) {
      const opt = this.options[this.selectedIndex];
      if (opt?.enabled) {
        this.hide();
        opt.action();
      }
    }

    if (J(this.escKey)) {
      this.hide();
      this.onClose?.();
    }
  }

  moveSelection(dir) {
    const len = this.options.length;
    if (len === 0) return;
    let next = this.selectedIndex;
    for (let attempt = 0; attempt < len; attempt++) {
      next = (next + dir + len) % len;
      if (this.options[next].enabled) {
        this.selectedIndex = next;
        this.updateHighlight();
        return;
      }
    }
  }

  updateHighlight() {
    this.highlights.forEach((h, i) => {
      const selected = i === this.selectedIndex && this.options[i]?.enabled;
      h.setVisible(selected);
      if (this.options[i]?.enabled) this.items[i].setColor(selected ? TEXT_HIGHLIGHT : TEXT_COLOR);
    });
  }

  clearItems() {
    this.items.forEach((t) => t.destroy());
    this.highlights.forEach((h) => h.destroy());
    this.hitZones.forEach((z) => {
      z.removeAllListeners();
      z.destroy();
    });
    this.items = [];
    this.highlights = [];
    this.hitZones = [];
  }

  destroy() {
    this.clearItems();
    this.container.destroy();
    const kb = this.scene.input.keyboard;
    if (kb) {
      [this.upKey, this.downKey, this.upArrow, this.downArrow, this.confirmKey, this.enterKey, this.escKey].forEach((k) =>
        kb.removeKey(k, true),
      );
    }
    this.onClose = null;
  }
}
