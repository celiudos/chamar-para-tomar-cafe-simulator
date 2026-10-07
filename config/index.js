// Ponto de entrada da configuracao do jogo.
import { game } from "./game.js";
import { characters, player } from "./characters.js";

export { game, characters, player };

const sheet = (n) => `/public/characters/Premade_Character_48x48_${n}.png`;

/** Chave de textura do Phaser para uma sheet de personagem. */
export const spriteKey = (n) => `character_${n}`;
/** Caminho da sheet de um personagem. */
export const spritePath = sheet;

/** Todas as sheets que precisam ser carregadas (jogador + personagens). */
export const spriteSheets = [player, ...characters].map((c) => ({
  key: spriteKey(c.sprite),
  path: sheet(c.sprite),
}));
