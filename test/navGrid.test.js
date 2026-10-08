import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { game } from "../config/index.js";
import { NavGrid } from "../game/NavGrid.js";

const body = { width: 24, height: 19.2 };

/** Sala 240x240 com uma parede no meio (com passagem embaixo). */
function room() {
  return new NavGrid({
    rects: [{ x: 110, y: 0, width: 20, height: 190 }],
    bounds: { x: 0, y: 0, width: 240, height: 240 },
    cell: 24,
    body,
  });
}

test("findPath contorna a parede e nao atravessa colisoes", () => {
  const g = room();
  const from = { x: 40, y: 40 };
  const to = { x: 200, y: 40 };
  const path = g.findPath(from, to);
  assert.ok(path && path.length >= 2, "precisa de pelo menos uma curva");
  assert.deepEqual(path.at(-1), to);
  let prev = from;
  for (const p of path) {
    assert.ok(g.lineFree(prev, p), `trecho livre ${JSON.stringify(prev)} -> ${JSON.stringify(p)}`);
    prev = p;
  }
  assert.ok(path.some((p) => p.y > 190), "passa por baixo da parede");
});

test("destino inalcancavel: vai ate o ponto alcancavel mais perto; grade sem espaco livre: null", () => {
  const g = new NavGrid({
    rects: [{ x: 110, y: 0, width: 20, height: 240 }],
    bounds: { x: 0, y: 0, width: 240, height: 240 },
    cell: 24,
    body,
  });
  // A parede divide a sala: so a maior regiao fica na grade, e o caminho para encostado na parede.
  const path = g.findPath({ x: 40, y: 40 }, { x: 200, y: 40 });
  assert.ok(path);
  assert.ok(path.at(-1).x < 110, "nao atravessa a parede");
  const full = new NavGrid({ rects: [{ x: 0, y: 0, width: 240, height: 240 }], bounds: { x: 0, y: 0, width: 240, height: 240 }, cell: 24, body });
  assert.equal(full.findPath({ x: 40, y: 40 }, { x: 200, y: 40 }), null);
});

test("ponto de partida dentro de um movel: sai pela celula livre mais proxima", () => {
  const g = room();
  const path = g.findPath({ x: 120, y: 60 }, { x: 40, y: 220 });
  assert.ok(path);
  assert.ok(g.isFree(path[0].x, path[0].y));
});

test("meetingSpots devolve dois lugares livres lado a lado, longe de quem esta perto", () => {
  const g = room();
  const spots = g.meetingSpots(60, 60, 48);
  assert.ok(spots);
  assert.equal(spots.right.x - spots.left.x, 48);
  assert.equal(spots.left.y, spots.right.y);
  assert.ok(g.isFree(spots.left.x, spots.left.y) && g.isFree(spots.right.x, spots.right.y));
  const avoided = g.meetingSpots(60, 60, 48, { avoid: [spots.left], radius: 40 });
  assert.ok(avoided && Math.hypot(avoided.left.x - spots.left.x, avoided.left.y - spots.left.y) > 0);
});

test("mapa real: uma regiao andavel conectada, caminhos entre quaisquer pontos", () => {
  const map = JSON.parse(readFileSync(new URL("../public/maps/baias.json", import.meta.url), "utf8"));
  const rects = map.layers.find((l) => l.name === "collisions").objects.filter((o) => o.width && o.height);
  const g = new NavGrid({ rects, bounds: game.map.playfield, cell: 24, body });
  let rng = 7;
  const random = () => ((rng = (rng * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 100; i++) {
    const a = g.randomWalkable(480, 300, 600, random);
    const b = g.randomWalkable(480, 300, 600, random);
    assert.ok(g.findPath(a, b), `caminho ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
  }
  // Todos os spawns (cadeiras e chefe) tem saida para a regiao andavel.
  for (const s of map.layers.find((l) => l.name === "spawns").objects) {
    assert.ok(g.nearestWalkable(s.x, s.y + 33.6), s.name);
  }
  // A area de cafe comporta a equipe inteira na comemoracao.
  const area = game.coffee.area;
  assert.equal(g.spreadSpots(area, { x: area.x + area.width / 2, y: area.y + area.height / 2 }, 6, 52).length, 6);
});
