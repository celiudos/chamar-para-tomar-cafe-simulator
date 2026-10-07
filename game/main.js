import OfficeScene from "./OfficeScene.js";
import { AGENTS, hex } from "./agents.js";

// ---- Phaser bootstrap --------------------------------------------------
const config = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#0e1116",
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  physics: { default: "arcade", arcade: { debug: false } },
  scene: [OfficeScene],
};

// eslint-disable-next-line no-new
new Phaser.Game(config);

// ---- HUD overlay (pure DOM, mirrors the agent roster) ------------------
const list = document.getElementById("agent-list");
const count = document.getElementById("agent-count");

if (list) {
  list.innerHTML = AGENTS.map(
    (a) => `
    <li>
      <span class="swatch" style="background:${hex(a.color)}"></span>
      <span class="agent-meta">
        <span class="name">${a.name}</span>
        <span class="role">${a.role}</span>
      </span>
      <span class="agent-status">online</span>
    </li>`
  ).join("");
}
if (count) count.textContent = String(AGENTS.length);
