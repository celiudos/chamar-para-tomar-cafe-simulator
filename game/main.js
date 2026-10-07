import { game as gameCfg, characters } from "../config/index.js";
import OfficeScene from "./OfficeScene.js";
import { initHud } from "./hud.js";
import { loadPersonas } from "./personas.js";

// Identidade do jogo vinda de config/game.js
document.title = gameCfg.name;
document.documentElement.lang = gameCfg.language;
const logo = document.querySelector(".layout-topbar__logo");
if (logo) logo.textContent = gameCfg.name;

// Portado de agent-town (MIT): components/game/config.ts
const gameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: gameCfg.display.backgroundColor,
  width: gameCfg.display.width,
  height: gameCfg.display.height,
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

// Fontes e personas (/personas/*.md) carregam em paralelo antes do jogo comecar.
await Promise.all([waitForFonts(), loadPersonas(characters)]);
initHud();
const phaserGame = new Phaser.Game(gameConfig);

// Referencia para depuracao no console do navegador (ex.: __GAME__.scene.scenes[0]).
globalThis.__GAME__ = phaserGame;
