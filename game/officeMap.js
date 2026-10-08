// Cenario do escritorio (public/maps/baias.json), compartilhado pelos dois modos de jogo:
// carrega o mapa, os tilesets e os sprites, desenha as camadas, a area de cafe e as colisoes,
// e devolve os pontos do mapa (spawns, cadeiras, cafe). Usado por OfficeScene e TeamScene.
import { game, spriteSheets } from "../config/index.js";
import { EMOTE_FRAME_SIZE, EMOTE_SHEET_KEY, EMOTE_SHEET_PATH, PUBLIC_PATH } from "./constants.js";
import { buildCollisionRects, buildSpriteFrames, findPoi, parseSpawns, renderTileObjectLayer } from "./MapHelpers.js";

/** Enfileira mapa, tilesets, personagens, emotes e setas (chamar no preload da cena). */
export function preloadOffice(scene) {
  const { key, path, tilesetsPath } = game.map;
  scene.load.tilemapTiledJSON(key, path);
  // Quando o JSON chega, enfileira as imagens dos tilesets referenciados por ele.
  scene.load.once(`filecomplete-tilemapJSON-${key}`, () => {
    const cached = scene.cache.tilemap.get(key);
    if (!cached?.data?.tilesets) return;
    for (const ts of cached.data.tilesets) {
      const basename = ts.image.split("/").pop();
      scene.load.image(ts.name, `${tilesetsPath}/${basename}`);
    }
  });

  for (const s of spriteSheets) scene.load.image(s.key, s.path);

  scene.load.spritesheet(EMOTE_SHEET_KEY, EMOTE_SHEET_PATH, {
    frameWidth: EMOTE_FRAME_SIZE,
    frameHeight: EMOTE_FRAME_SIZE,
  });
  scene.load.spritesheet("boss-arrow", `${PUBLIC_PATH}/sprites/arrow_down_48x48.png`, {
    frameWidth: 48,
    frameHeight: 48,
  });
  scene.load.spritesheet("anim-door", `${PUBLIC_PATH}/sprites/animated_door_big_4_48x48.png`, {
    frameWidth: 48,
    frameHeight: 144,
  });
}

/**
 * Monta o escritorio na cena. Retorna null se os tilesets nao carregaram; senao
 * { map, pf, collisionGroup, rects, bossSpawn, workerSpawns, coffeeSpots }:
 * - pf: area jogavel { x, y, width, height }
 * - rects: retangulos de colisao (px do mundo), para a grade de navegacao do modo equipe
 */
export function buildOffice(scene) {
  for (const s of spriteSheets) buildSpriteFrames(scene, s.key);

  const map = scene.make.tilemap({ key: game.map.key });
  const tilesets = [];
  for (const ts of map.tilesets) {
    const added = map.addTilesetImage(ts.name, ts.name);
    if (added) tilesets.push(added);
  }
  if (tilesets.length === 0) {
    console.error(`[${scene.scene.key}] Nenhum tileset carregado`);
    return null;
  }

  map.createLayer("floor", tilesets);
  drawCoffeeArea(scene);
  map.createLayer("walls", tilesets);
  map.createLayer("ground", tilesets);
  map.createLayer("furniture", tilesets);
  map.createLayer("objects", tilesets);

  renderTileObjectLayer(scene, map, "props", tilesets, 5);
  renderTileObjectLayer(scene, map, "props-over", tilesets, 11);

  // Camada "overhead" fica por cima dos personagens (encosto das cadeiras, divisorias...).
  const overhead = map.createLayer("overhead", tilesets);
  if (overhead) overhead.setDepth(10);

  const collisionGroup = scene.physics.add.staticGroup();
  buildCollisionRects(map, collisionGroup);
  const rects = (map.getObjectLayer("collisions")?.objects ?? [])
    .filter((o) => o.width && o.height)
    .map((o) => ({ x: o.x, y: o.y, width: o.width, height: o.height }));

  // Area jogavel: cobre o que sobra do recorte do mapa (ex.: parede da sala vizinha).
  const pf = game.map.playfield ?? { x: 0, y: 0, width: map.widthInPixels, height: map.heightInPixels };
  maskOutside(scene, pf);

  const { bossSpawn, workerSpawns } = parseSpawns(map);
  let coffeeSpots = game.coffee.spots.map((name) => findPoi(map, name)).filter(Boolean);
  if (!coffeeSpots.length) {
    console.warn(`[${scene.scene.key}] Pontos ${game.coffee.spots.join(", ")} nao existem na camada "pois"; usando o spawn do chefe`);
    coffeeSpots = [{ ...bossSpawn, facing: "up" }];
  }
  return { map, pf, collisionGroup, rects, bossSpawn, workerSpawns, coffeeSpots };
}

/** Area de cafe: faixa de piso colorida e placa na parede (config/game.js -> coffee.area). */
function drawCoffeeArea(scene) {
  const { label, x, y, width, height, color, alpha, sign } = game.coffee.area;
  const tint = Phaser.Display.Color.HexStringToColor(color).color;
  // Logo depois do piso: fica por baixo das paredes, moveis e personagens.
  scene.add.rectangle(x, y, width, height, tint, alpha).setOrigin(0, 0);
  scene.add.rectangle(x, y, width, height).setOrigin(0, 0).setStrokeStyle(2, tint, 0.55);

  const text = scene.add
    .text(sign.x, sign.y, label, {
      fontFamily: '"ArkPixel", "Press Start 2P", monospace',
      fontSize: "14px",
      fontStyle: "bold",
      color: "#fff3d6",
      padding: { x: 8, y: 6 },
      backgroundColor: "#6b4a2b",
    })
    .setOrigin(0.5)
    .setDepth(9)
    .setResolution(2);
  // Moldura da placa.
  scene.add
    .rectangle(sign.x, sign.y, text.width + 4, text.height + 4)
    .setStrokeStyle(2, 0x2b1b0e)
    .setDepth(9);
}

/** Pinta com a cor de fundo tudo que esta fora da area jogavel. */
function maskOutside(scene, pf) {
  const big = 4000;
  const g = scene.add.graphics().setDepth(12);
  g.fillStyle(Phaser.Display.Color.HexStringToColor(game.display.backgroundColor).color, 1);
  g.fillRect(pf.x - big, pf.y - big, big * 2 + pf.width, big); // acima
  g.fillRect(pf.x - big, pf.y + pf.height, big * 2 + pf.width, big); // abaixo
  g.fillRect(pf.x - big, pf.y, big, pf.height); // esquerda
  g.fillRect(pf.x + pf.width, pf.y, big, pf.height); // direita
}
