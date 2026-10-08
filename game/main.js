import { game as gameCfg, characters } from "../config/index.js";
import OfficeScene from "./OfficeScene.js";
import TeamScene from "./TeamScene.js";
import { initHud } from "./hud.js";
import { loadPersonas } from "./personas.js";
import { runLoading } from "./loading.js";
import { chooseMode } from "./modes.js";
import { runTeamSetup } from "./teamSetup.js";
import { startTeamMode } from "./teamHud.js";

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
  const load = (font) => document.fonts.load(font).catch(() => {});
  await Promise.race([Promise.all([load('8px "Press Start 2P"'), load('12px "ArkPixel"')]), timeout]);
}

/** Cria o Phaser com a cena do modo. Referencia para depuracao no console: __GAME__. */
function startPhaser(scene) {
  const phaserGame = new Phaser.Game({ ...gameConfig, scene: [scene] });
  globalThis.__GAME__ = phaserGame;
  return phaserGame;
}

// Fontes e personas fixas (/personas/*.md) carregam em paralelo.
await Promise.all([waitForFonts(), loadPersonas(characters)]);

// Tela inicial: escolha do modo (ou ?modo=classico / ?modo=equipe na URL).
const mode = await chooseMode();
document.body.dataset.mode = mode;

if (mode === "team") {
  // "Equipe adivinha": o escritorio carrega por tras enquanto o jogador escolhe a palavra e as dicas.
  startPhaser(TeamScene);
  startTeamMode(await runTeamSetup());
} else {
  // "Chefe adivinha": o Phaser ja carrega o cenario por tras da tela de loading, que complementa as
  // personas (palavra secreta, categoria, pistas e dificuldade) e so libera o jogo no "Comecar".
  startPhaser(OfficeScene);
  await runLoading();
  initHud();
}
