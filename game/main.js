import OfficeScene from "./OfficeScene.js";
import { initHud } from "./hud.js";
import { BG_COLOR, GAME_HEIGHT, GAME_WIDTH } from "./config.js";

// Portado de agent-town (MIT): components/game/config.ts
const gameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: BG_COLOR,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  scene: [OfficeScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  physics: {
    default: "arcade",
    arcade: { gravity: { x: 0, y: 0 } },
  },
};

// Os nomes dos personagens usam "Press Start 2P" dentro do canvas; sem esperar a fonte
// carregar, o Phaser desenharia o texto com a fonte de fallback.
async function waitForFonts() {
  if (!document.fonts) return;
  const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
  await Promise.race([document.fonts.load('8px "Press Start 2P"').catch(() => {}), timeout]);
}

await waitForFonts();
initHud();
// eslint-disable-next-line no-new
new Phaser.Game(gameConfig);
