// Portado de agent-town (MIT): components/game/utils/MapHelpers.ts
import { FRAME_WIDTH, FRAME_HEIGHT, SHEET_COLUMNS } from "./config.js";

/** Fatia a sheet do personagem em frames numerados (linha * 56 + coluna). */
export function buildSpriteFrames(scene, key) {
  const tex = scene.textures.get(key);
  if (!tex.source.length) return;
  const rows = Math.floor(tex.source[0].height / FRAME_HEIGHT);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < SHEET_COLUMNS; col++) {
      tex.add(row * SHEET_COLUMNS + col, 0, col * FRAME_WIDTH, row * FRAME_HEIGHT, FRAME_WIDTH, FRAME_HEIGHT);
    }
  }
}

function getFacing(obj) {
  const fp = obj.properties?.find((p) => p.name === "facing");
  return fp?.value ?? "down";
}

/** Le a camada "spawns": o objeto mais a direita (ou "boss") e o chefe; os demais sao cadeiras. */
export function parseSpawns(map) {
  const layer = map.getObjectLayer("spawns");
  const fallback = { x: map.widthInPixels / 2, y: map.heightInPixels / 2, facing: "down" };
  if (!layer || layer.objects.length === 0) return { bossSpawn: fallback, workerSpawns: [] };

  let bossObj = layer.objects.find((o) => o.name === "boss");
  if (!bossObj) {
    bossObj = [...layer.objects].sort((a, b) => a.x - b.x).pop();
  }
  const bossSpawn = { x: bossObj.x, y: bossObj.y, facing: getFacing(bossObj) };
  const workerSpawns = layer.objects
    .filter((o) => o !== bossObj)
    .map((o, index) => ({
      seatId: o.name && o.name !== "boss" ? o.name : `seat-${index}`,
      x: o.x,
      y: o.y,
      facing: getFacing(o),
      index,
    }));
  return { bossSpawn, workerSpawns };
}

/** Retangulos da camada "collisions" viram corpos estaticos invisiveis. */
export function buildCollisionRects(map, group) {
  const layer = map.getObjectLayer("collisions");
  if (!layer) return;
  for (const obj of layer.objects) {
    const ox = obj.x ?? 0;
    const oy = obj.y ?? 0;
    const ow = obj.width ?? 0;
    const oh = obj.height ?? 0;
    if (ow === 0 || oh === 0) continue;
    const rect = group.create(ox + ow / 2, oy + oh / 2, undefined, undefined, false);
    rect.body.setSize(ow, oh);
    rect.setVisible(false);
    rect.setActive(true);
    rect.body.enable = true;
  }
}

/**
 * Renderiza uma camada de objetos "tile" (props soltos) como imagens.
 * `animatedProps` troca um grupo de tiles estaticos por um sprite animado.
 */
export function renderTileObjectLayer(scene, map, layerName, tilesets, depth, animatedProps) {
  const layer = map.getObjectLayer(layerName);
  if (!layer) return;

  for (const obj of layer.objects) {
    if (!obj.gid) continue;

    let tileset = null;
    for (let i = tilesets.length - 1; i >= 0; i--) {
      if (obj.gid >= tilesets[i].firstgid) {
        tileset = tilesets[i];
        break;
      }
    }
    if (!tileset) continue;

    const localId = obj.gid - tileset.firstgid;

    const anim = animatedProps?.find((a) => a.tilesetName === tileset.name && a.skipLocalIds.has(localId));
    if (anim) {
      if (localId === anim.anchorLocalId) {
        const animKey = `${anim.spriteKey}-anim`;
        if (!scene.anims.exists(animKey)) {
          scene.anims.create({
            key: animKey,
            frames: scene.anims.generateFrameNumbers(anim.spriteKey, { start: 0, end: anim.endFrame }),
            frameRate: anim.frameRate,
            repeat: -1,
          });
        }
        scene.add
          .sprite(obj.x, obj.y - anim.frameHeight + tileset.tileHeight, anim.spriteKey)
          .setOrigin(0, 0)
          .setDepth(depth)
          .play(animKey);
      }
      continue;
    }

    const tileW = tileset.tileWidth;
    const tileH = tileset.tileHeight;
    const srcX = (localId % tileset.columns) * tileW;
    const srcY = Math.floor(localId / tileset.columns) * tileH;
    const frameKey = `${tileset.name}_${localId}`;
    if (!scene.textures.exists(frameKey)) {
      scene.textures.get(tileset.name).add(localId, 0, srcX, srcY, tileW, tileH);
    }
    scene.add.image(obj.x, obj.y - tileH, tileset.name, localId).setOrigin(0, 0).setDepth(depth);
  }
}
