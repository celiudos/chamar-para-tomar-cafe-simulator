// Gera public/maps/baias.json a partir de public/maps/office2.json.
// O novo cenario contem apenas a sala das baias (6 pessoas trabalhando).
//
// Uso: node scripts/build-baias-map.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(root, "public/maps/office2.json");
const OUT = resolve(root, "public/maps/baias.json");

// Recorte em tiles (inclusivo) da sala das baias no mapa original.
const CROP = { x0: 2, y0: 2, x1: 16, y1: 12 };

// Cadeiras (posicao no mapa ORIGINAL, em pixels) na ordem usada por config/characters.js.
const SEATS = [
  { name: "seat-1", x: 264.172, y: 335.842, facing: "down" },
  { name: "seat-2", x: 408.054, y: 334.674, facing: "down" },
  { name: "seat-3", x: 551.97, y: 336.339, facing: "down" },
  { name: "seat-4", x: 263.373, y: 458.687, facing: "up" },
  { name: "seat-5", x: 408.355, y: 459.566, facing: "up" },
  { name: "seat-6", x: 551.97, y: 459.396, facing: "up" },
];
// Chefe: de pe no corredor a direita das baias (posicao no mapa ORIGINAL).
const BOSS = { name: "boss", x: 650, y: 410, facing: "left" };

const src = JSON.parse(readFileSync(SRC, "utf8"));
const T = src.tilewidth; // 48
const W = CROP.x1 - CROP.x0 + 1;
const H = CROP.y1 - CROP.y0 + 1;
const left = CROP.x0 * T;
const top = CROP.y0 * T;
const right = (CROP.x1 + 1) * T;
const bottom = (CROP.y1 + 1) * T;
const shift = (o) => ({ ...o, x: o.x - left, y: o.y - top });
const inside = (x, y) => x >= left && x < right && y >= top && y < bottom;

const usedGids = new Set();
let nextObjectId = src.nextobjectid;

// Aberturas da sala original (para o corredor da esquerda e para a biblioteca na direita)
// sao fechadas com os tiles de parede vertical da propria tileset "room_builder".
const WALL_LEFT_GID = 40; // parede vertical (borda esquerda da sala)
const WALL_RIGHT_GID = 28; // parede vertical (borda direita da sala)
const WALL_BOTTOM_GID = 146; // parede horizontal (borda inferior da sala)
const CLOSE = [
  { name: "esquerda", cells: [5, 6, 7, 8].map((row) => [2, row]), gid: WALL_LEFT_GID },
  { name: "direita", cells: [6, 7, 8, 9].map((row) => [16, row]), gid: WALL_RIGHT_GID },
  // Porta para a sala de baixo (a porta animada nao existe neste cenario).
  { name: "porta inferior", cells: [10, 11, 12].map((col) => [col, 12]), gid: WALL_BOTTOM_GID },
];

const tileLayers = src.layers.filter((l) => l.type === "tilelayer");
const cropped = new Map();
for (const layer of tileLayers) {
  const data = [];
  for (let y = CROP.y0; y <= CROP.y1; y++) {
    for (let x = CROP.x0; x <= CROP.x1; x++) data.push(layer.data[y * src.width + x]);
  }
  cropped.set(layer.name, data);
}
for (const { cells, gid } of CLOSE) {
  for (const [col, row] of cells) {
    const i = (row - CROP.y0) * W + (col - CROP.x0);
    for (const [name, data] of cropped) data[i] = name === "floor" ? gid : 0;
  }
}
for (const data of cropped.values()) for (const gid of data) if (gid) usedGids.add(gid & 0x1fffffff);

const layers = src.layers.map((layer) => {
  if (layer.type === "tilelayer") {
    return { ...layer, data: cropped.get(layer.name), width: W, height: H, x: 0, y: 0 };
  }

  if (layer.type !== "objectgroup") return layer;

  let objects = layer.objects;
  switch (layer.name) {
    case "collisions":
      objects = objects.flatMap((o) => {
        if (!o.width || !o.height) return [];
        const x0 = Math.max(o.x, left);
        const y0 = Math.max(o.y, top);
        const x1 = Math.min(o.x + o.width, right);
        const y1 = Math.min(o.y + o.height, bottom);
        if (x1 <= x0 || y1 <= y0) return [];
        return [{ ...o, x: x0 - left, y: y0 - top, width: x1 - x0, height: y1 - y0 }];
      });
      break;
    case "props":
    case "props-over":
      // Objetos "tile" tem a origem no canto inferior esquerdo.
      objects = objects.filter((o) => inside(o.x, o.y - T)).map(shift);
      objects.forEach((o) => o.gid && usedGids.add(o.gid & 0x1fffffff));
      break;
    case "pois":
      objects = objects.filter((o) => inside(o.x, o.y)).map(shift);
      break;
    case "spawns": {
      const mk = (s) => ({
        id: nextObjectId++,
        name: s.name,
        type: "",
        point: true,
        rotation: 0,
        visible: true,
        width: 0,
        height: 0,
        x: s.x - left,
        y: s.y - top,
        properties: [{ name: "facing", type: "string", value: s.facing }],
      });
      objects = [BOSS, ...SEATS].map(mk);
      break;
    }
    default:
      objects = objects.filter((o) => inside(o.x ?? 0, o.y ?? 0)).map(shift);
  }
  return { ...layer, objects };
});

// Mantem somente os tilesets realmente usados (evita baixar imagens desnecessarias).
const tilesets = src.tilesets.filter((ts, i) => {
  const next = src.tilesets[i + 1]?.firstgid ?? Infinity;
  for (const gid of usedGids) if (gid >= ts.firstgid && gid < next) return true;
  return false;
});

const out = { ...src, width: W, height: H, layers, tilesets, nextobjectid: nextObjectId };
writeFileSync(OUT, JSON.stringify(out));

console.log(`baias.json: ${W}x${H} tiles (${W * T}x${H * T}px)`);
console.log("tilesets:", tilesets.map((t) => t.name).join(", "));
for (const l of layers.filter((l) => l.type === "objectgroup")) {
  console.log(`  ${l.name}: ${l.objects.length} objetos`);
}
