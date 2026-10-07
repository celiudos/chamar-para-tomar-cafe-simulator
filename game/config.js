// Configuracao do jogo, portada de geezerrrr/agent-town (MIT):
// lib/constants.ts, components/game/config/{animations,emotes}.ts

export const GAME_NAME = "chamar-para-tomar-cafe-simulator";

/** Os assets ficam em /public (servidor estatico serve a raiz do projeto). */
export const PUBLIC_PATH = "/public";

// ── Canvas ────────────────────────────────────────────────
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

// ── Camera ────────────────────────────────────────────────
export const CAMERA_LERP = 0.1;
export const ZOOM_SENSITIVITY = 0.001;
export const ZOOM_DEFAULT = 0.82;
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2;
export const CAMERA_DRAG_THRESHOLD = 3;
export const BG_COLOR = "#1a1814";

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

export const BOSS_SPRITE_KEY = "character_09";
export const BOSS_SPRITE_PATH = `${PUBLIC_PATH}/characters/Premade_Character_48x48_09.png`;

const ch = (n) => `${PUBLIC_PATH}/characters/Premade_Character_48x48_${n}.png`;

/** Personagens que ocupam as cadeiras (na ordem das cadeiras do mapa). */
export const WORKER_SPRITES = [
  { key: "character_02", path: ch("02"), label: "Alice", roleTitle: "Worker" },
  { key: "character_03", path: ch("03"), label: "Bob", roleTitle: "Worker" },
  { key: "character_04", path: ch("04"), label: "Carol", roleTitle: "Worker" },
  { key: "character_05", path: ch("05"), label: "Dave", roleTitle: "Worker" },
  { key: "character_01", path: ch("01"), label: "Eve", roleTitle: "Worker" },
  { key: "character_06", path: ch("06"), label: "Frank", roleTitle: "Worker" },
];

/**
 * Anima "idle"/"walk" de uma linha da sheet.
 * Sem prefixo => chaves legadas do boss ("idle-down"); com prefixo => "<key>:idle-down".
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

// ── Portas animadas (posicoes fixas do mapa office2) ──────
export const DOOR_POSITIONS = [
  { x: 528, y: 528 },
  { x: 960, y: 528 },
];

// ── Persistencia ──────────────────────────────────────────
export const LS_BGM_VOLUME = "chamar-para-tomar-cafe:bgm-volume";
export const DEFAULT_BGM_VOLUME = 0.45;
export const BGM_SRC = `${PUBLIC_PATH}/audio/bgm.mp3`;
