// Portado de agent-town (MIT): components/game/scenes/OfficeScene.ts
// Carrega o mapa Tiled do escritorio, o chefe (jogador) e os workers nas cadeiras.
import {
  EMOTE_FRAME_SIZE,
  EMOTE_SHEET_KEY,
  EMOTE_SHEET_PATH,
  BOSS_SPRITE_KEY,
  BOSS_SPRITE_PATH,
  PUBLIC_PATH,
  WORKER_SPRITES,
} from "./config.js";
import { Player } from "./Player.js";
import { Worker } from "./Worker.js";
import { CameraController } from "./CameraController.js";
import { DoorManager } from "./DoorManager.js";
import { gameEvents } from "./events.js";
import { buildCollisionRects, buildSpriteFrames, parseSpawns, renderTileObjectLayer } from "./MapHelpers.js";

export default class OfficeScene extends Phaser.Scene {
  constructor() {
    super({ key: "OfficeScene" });
    this.workers = [];
  }

  preload() {
    this.load.tilemapTiledJSON("office", `${PUBLIC_PATH}/maps/office2.json`);
    // Quando o JSON chega, enfileira as imagens dos tilesets referenciados por ele.
    this.load.once("filecomplete-tilemapJSON-office", () => {
      const cached = this.cache.tilemap.get("office");
      if (!cached?.data?.tilesets) return;
      for (const ts of cached.data.tilesets) {
        const basename = ts.image.split("/").pop();
        this.load.image(ts.name, `${PUBLIC_PATH}/tilesets/${basename}`);
      }
    });

    this.load.image(BOSS_SPRITE_KEY, BOSS_SPRITE_PATH);
    for (const ws of WORKER_SPRITES) this.load.image(ws.key, ws.path);

    this.load.spritesheet(EMOTE_SHEET_KEY, EMOTE_SHEET_PATH, {
      frameWidth: EMOTE_FRAME_SIZE,
      frameHeight: EMOTE_FRAME_SIZE,
    });
    this.load.spritesheet("boss-arrow", `${PUBLIC_PATH}/sprites/arrow_down_48x48.png`, {
      frameWidth: 48,
      frameHeight: 48,
    });
    this.load.spritesheet("anim-cauldron", `${PUBLIC_PATH}/sprites/animated_witch_cauldron_48x48.png`, {
      frameWidth: 96,
      frameHeight: 96,
    });
    this.load.spritesheet("anim-door", `${PUBLIC_PATH}/sprites/animated_door_big_4_48x48.png`, {
      frameWidth: 48,
      frameHeight: 144,
    });
  }

  create() {
    buildSpriteFrames(this, BOSS_SPRITE_KEY);
    for (const ws of WORKER_SPRITES) buildSpriteFrames(this, ws.key);

    const map = this.make.tilemap({ key: "office" });
    const tilesets = [];
    for (const ts of map.tilesets) {
      const added = map.addTilesetImage(ts.name, ts.name);
      if (added) tilesets.push(added);
    }
    if (tilesets.length === 0) {
      console.error("[OfficeScene] Nenhum tileset carregado");
      return;
    }

    map.createLayer("floor", tilesets);
    map.createLayer("walls", tilesets);
    map.createLayer("ground", tilesets);
    map.createLayer("furniture", tilesets);
    map.createLayer("objects", tilesets);

    // Caldeirao animado: troca 4 tiles estaticos da tileset Halloween por um sprite.
    const animatedProps = [
      {
        tilesetName: "11_Halloween_48x48",
        anchorLocalId: 130,
        skipLocalIds: new Set([130, 131, 146, 147]),
        spriteKey: "anim-cauldron",
        frameWidth: 96,
        frameHeight: 96,
        endFrame: 11,
        frameRate: 8,
      },
    ];
    renderTileObjectLayer(this, map, "props", tilesets, 5, animatedProps);
    renderTileObjectLayer(this, map, "props-over", tilesets, 11);

    const overhead = map.createLayer("overhead", tilesets);
    if (overhead) overhead.setDepth(10);

    const collisionGroup = this.physics.add.staticGroup();
    buildCollisionRects(map, collisionGroup);

    const { bossSpawn, workerSpawns } = parseSpawns(map);

    this.player = new Player(this, bossSpawn.x, bossSpawn.y, bossSpawn.facing);
    this.physics.add.collider(this.player.sprite, collisionGroup);
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.player.sprite.setCollideWorldBounds(true);
    this.input.keyboard.disableGlobalCapture();

    this.cameraController = new CameraController(this, this.player.sprite, map.widthInPixels, map.heightInPixels);
    this.cameraController.init();

    // Workers sentados nas cadeiras; as cadeiras sobrando ficam vagas.
    const seats = workerSpawns.map((spawn, i) => {
      const cfg = WORKER_SPRITES[i];
      if (!cfg) {
        return { seatId: spawn.seatId, assigned: false, label: "Vacant Seat", status: "empty" };
      }
      const worker = new Worker(this, spawn.x, spawn.y, cfg.key, spawn.seatId, cfg.label, spawn.facing);
      this.physics.add.collider(this.player.sprite, worker.sprite);
      this.workers.push(worker);
      return {
        seatId: spawn.seatId,
        assigned: true,
        label: cfg.label,
        roleTitle: cfg.roleTitle,
        spritePath: cfg.path,
        status: "idle",
      };
    });

    this.doorManager = new DoorManager(this, this.player, () => this.workers);
    this.doorManager.initDoors();

    gameEvents.emit("seats", seats);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.workers.forEach((w) => w.destroy()));
  }

  update() {
    if (!this.player) return;
    this.player.update();
    if (!this.cameraController.cameraFollowing && this.player.isMoving()) {
      this.cameraController.resumeCameraFollow();
    }
    this.doorManager.updateDoors();
  }
}
