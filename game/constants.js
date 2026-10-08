// Constantes do motor, portadas de geezerrrr/agent-town (MIT):
// lib/constants.ts, components/game/config/{animations,emotes}.ts
// Valores do jogo (nome, mapa, camera, audio, personagens) ficam em /config.

/** Os assets ficam em /public (o servidor serve a raiz do projeto). */
export const PUBLIC_PATH = "/public";

// ── Sprites de personagem (48x96, 56 colunas) ─────────────
// Linha 1: idle  - right(6) up(6) left(6) down(6)
// Linha 2: walk  - right(6) up(6) left(6) down(6)
export const FRAME_WIDTH = 48;
export const FRAME_HEIGHT = 96;
export const SHEET_COLUMNS = 56;
export const FRAMES_PER_DIR = 6;
export const MOVE_SPEED = 160;
export const PORTRAIT_FRAME_INDEX = SHEET_COLUMNS + 18; // idle-down, 1o frame

export const BODY_SIZE_RATIO_W = 0.5;
export const BODY_SIZE_RATIO_H = 0.2;
export const BODY_OFFSET_RATIO_X = 0.25;
export const BODY_OFFSET_RATIO_Y = 0.75;

export const DIRECTIONS = ["right", "up", "left", "down"];

export const CAMERA_DRAG_THRESHOLD = 3;
export const ZOOM_SENSITIVITY = 0.001;

/**
 * Anima "idle"/"walk" de uma linha da sheet.
 * Sem prefixo => chaves legadas do jogador ("idle-down"); com prefixo => "<key>:idle-down".
 */
export function makeAnims(spriteKey, prefix, row, frameRate) {
  return DIRECTIONS.map((dir, i) => ({
    key: spriteKey ? `${spriteKey}:${prefix}-${dir}` : `${prefix}-${dir}`,
    start: row * SHEET_COLUMNS + i * FRAMES_PER_DIR,
    end: row * SHEET_COLUMNS + i * FRAMES_PER_DIR + FRAMES_PER_DIR - 1,
    frameRate,
    repeat: -1,
  }));
}

export const IDLE_ANIMS = makeAnims(null, "idle", 1, 8);
export const WALK_ANIMS = makeAnims(null, "walk", 2, 10);
export const ALL_ANIMS = [...IDLE_ANIMS, ...WALK_ANIMS];

// ── Emotes (sheet 480x480, 10x10 de 48x48) ────────────────
export const EMOTE_SHEET_KEY = "emotes";
export const EMOTE_SHEET_PATH = `${PUBLIC_PATH}/sprites/emotes_48x48.png`;
export const EMOTE_FRAME_SIZE = 48;
export const EMOTE_Y_OFFSET = 0.55;
export const BUBBLE_Y_OFFSET = 0.45;
export const PROMPT_Y_OFFSET = 0.5;

export const EMOTE_ANIMS = [
  { key: "emote:sleep", frames: [56, 57], frameRate: 2, repeat: -1 },
  { key: "emote:thinking", frames: [52, 53], frameRate: 2, repeat: -1 },
  { key: "emote:alert", frames: [40, 41], frameRate: 4, repeat: 3 },
  { key: "emote:fail", frames: [50, 51], frameRate: 4, repeat: 3 },
  { key: "emote:heart", frames: [54, 55], frameRate: 2, repeat: 3 },
  { key: "emote:star", frames: [64, 65], frameRate: 3, repeat: 3 },
  { key: "emote:music", frames: [66, 67], frameRate: 3, repeat: -1 },
  { key: "emote:confused", frames: [62, 63], frameRate: 2, repeat: -1 },
  { key: "emote:angry", frames: [70, 71], frameRate: 3, repeat: 3 },
  { key: "emote:wrench", frames: [74, 75], frameRate: 2, repeat: -1 },
  { key: "emote:device", frames: [58, 59], frameRate: 2, repeat: -1 },
  { key: "emote:dots", frames: [92, 93], frameRate: 2, repeat: -1 },
  // Modo equipe: reacoes do chefe aos palpites (X vermelho = errado, sol = "ta quente").
  { key: "emote:no", frames: [90, 91], frameRate: 4, repeat: 3 },
  { key: "emote:hot", frames: [82, 83], frameRate: 3, repeat: 3 },
  { key: "emote:sweat", frames: [96, 97], frameRate: 3, repeat: 3 },
];

// ── Comportamento idle na cadeira ─────────────────────────
export const WANDER_MIN_DELAY = 3000;
export const WANDER_MAX_DELAY = 10000;
export const WANDER_INITIAL_MIN = 500;
export const WANDER_INITIAL_MAX = 4000;

export const SEAT_ACTIVITIES = [
  { emote: "emote:sleep", minDuration: 6000, maxDuration: 14000 },
  { emote: "emote:sleep", minDuration: 4000, maxDuration: 8000 },
  { emote: "emote:thinking", minDuration: 5000, maxDuration: 10000 },
  { emote: "emote:thinking", minDuration: 5000, maxDuration: 10000 },
  { emote: "emote:device", minDuration: 5000, maxDuration: 12000 },
  { emote: "emote:device", minDuration: 4000, maxDuration: 8000 },
  { emote: "emote:star", minDuration: 2000, maxDuration: 4000 },
  { emote: "emote:heart", minDuration: 3000, maxDuration: 5000 },
  { emote: "emote:music", minDuration: 3000, maxDuration: 6000 },
  { emote: "emote:confused", minDuration: 3000, maxDuration: 6000 },
  { emote: "emote:angry", minDuration: 2000, maxDuration: 4000 },
];

// ── Estilo do "Press E" (igual ao original) ───────────────
export const PRESS_E_STYLE = {
  fontFamily: '"SF Mono", "Cascadia Code", Consolas, "Liberation Mono", Menlo, monospace',
  fontSize: "14px",
  color: "#c9a227",
  backgroundColor: "rgba(37, 34, 25, 0.95)",
  padding: { x: 8, y: 4 },
  align: "center",
};
