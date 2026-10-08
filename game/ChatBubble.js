// Portado de agent-town (MIT): components/game/entities/ChatBubble.ts
// Adaptado: limite de caracteres configuravel, trecho em destaque (o palpite do modo equipe)
// e variantes de cor (reacoes do chefe: errado, quente, acertou, dica).
const BUBBLE_MAX_WIDTH = 300;
const FADE_DURATION = 400;
const DEFAULT_TTL = 5000;
const DEFAULT_MAX_CHARS = 100;

/** Cores de fundo/borda/texto de cada variante (a padrao e o balao branco do Agent Town). */
const VARIANTS = {
  default: { bg: "rgba(255, 255, 255, 0.95)", border: "rgba(26, 26, 46, 0.3)", color: "#1a1a2e" },
  hint: { bg: "rgba(255, 243, 214, 0.97)", border: "#c9a227", color: "#3b2a10" },
  wrong: { bg: "rgba(254, 226, 226, 0.97)", border: "#ef4444", color: "#7f1d1d" },
  close: { bg: "rgba(255, 237, 213, 0.97)", border: "#f97316", color: "#7c2d12" },
  right: { bg: "rgba(220, 252, 231, 0.97)", border: "#22c55e", color: "#14532d" },
};

export class ChatBubble {
  constructor(scene, { maxWidth = BUBBLE_MAX_WIDTH } = {}) {
    this.scene = scene;
    this.worldX = 0;
    this.worldY = 0;
    this._visible = false;
    this.fadeTimeout = null;

    this.el = document.createElement("div");
    this.el.className = "game-bubble";
    this.el.style.cssText = `
      position: absolute; pointer-events: none;
      max-width: ${maxWidth}px; padding: 6px 10px; border-radius: 8px;
      border: 1px solid;
      font-family: var(--pixel-font-chat); font-size: 13px; line-height: 1.5;
      word-break: break-word; white-space: pre-wrap;
      transform: translate(-50%, -100%);
      z-index: 15; opacity: 0;
      transition: opacity ${FADE_DURATION}ms ease;
      display: none;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
    `;
    this.textEl = document.createElement("span");
    this.el.appendChild(this.textEl);

    // Rabinho do balao
    this.tail = document.createElement("div");
    this.tail.style.cssText = `
      position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%);
      width: 0; height: 0;
      border-left: 6px solid transparent; border-right: 6px solid transparent;
      border-top: 6px solid;
    `;
    this.el.appendChild(this.tail);
    this.setVariant("default");

    const parent = scene.game.canvas.parentElement;
    if (parent) {
      parent.style.position = "relative";
      parent.appendChild(this.el);
    }
  }

  get visible() {
    return this._visible;
  }

  setVariant(name) {
    const v = VARIANTS[name] ?? VARIANTS.default;
    this.el.style.background = v.bg;
    this.el.style.borderColor = v.border;
    this.el.style.color = v.color;
    this.tail.style.borderTopColor = v.bg;
  }

  /**
   * Mostra `message` ancorado em (anchorX, anchorY) do mundo por `ttl` ms (0 = ate esconder).
   * Opcoes: `maxChars` (corta com "..."), `highlight` (trecho em negrito, ex.: o palpite) e
   * `variant` (default | hint | wrong | close | right).
   */
  show(message, anchorX, anchorY, ttl = DEFAULT_TTL, { maxChars = DEFAULT_MAX_CHARS, highlight = "", variant = "default" } = {}) {
    this.clearTimers();
    const text = message.length > maxChars ? message.slice(0, maxChars - 3) + "..." : message;
    this.renderText(text, highlight);
    this.setVariant(variant);

    this.worldX = anchorX;
    this.worldY = anchorY;
    this._visible = true;
    this.el.style.display = "block";
    void this.el.offsetHeight; // forca reflow para a transicao de opacidade
    this.el.style.opacity = "1";
    this.syncPosition();

    if (ttl > 0) {
      this.fadeTimeout = setTimeout(() => {
        this.el.style.opacity = "0";
        this.fadeTimeout = setTimeout(() => {
          this.el.style.display = "none";
          this._visible = false;
          this.fadeTimeout = null;
        }, FADE_DURATION);
      }, ttl);
    }
  }

  /** Texto puro (textContent, sem HTML), com a 1a ocorrencia de `highlight` em negrito. */
  renderText(text, highlight) {
    const at = highlight ? text.toLowerCase().indexOf(highlight.toLowerCase()) : -1;
    if (at < 0) {
      this.textEl.textContent = text;
      return;
    }
    const strong = document.createElement("strong");
    strong.textContent = text.slice(at, at + highlight.length);
    this.textEl.replaceChildren(text.slice(0, at), strong, text.slice(at + highlight.length));
  }

  updatePosition(anchorX, anchorY) {
    this.worldX = anchorX;
    this.worldY = anchorY;
    if (this._visible) this.syncPosition();
  }

  hide() {
    this.clearTimers();
    this.el.style.opacity = "0";
    this.el.style.display = "none";
    this._visible = false;
  }

  destroy() {
    this.clearTimers();
    this.el.remove();
  }

  /** Converte mundo -> tela considerando scroll, zoom e a origem do viewport. */
  syncPosition() {
    const cam = this.scene.cameras.main;
    const sx = (this.worldX - cam.worldView.x) * cam.zoom + cam.x;
    const sy = (this.worldY - cam.worldView.y) * cam.zoom + cam.y;
    this.el.style.left = `${sx}px`;
    this.el.style.top = `${sy}px`;
  }

  clearTimers() {
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
    }
  }
}
