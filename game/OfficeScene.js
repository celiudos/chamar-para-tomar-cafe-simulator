// Portado de agent-town (MIT): components/game/scenes/OfficeScene.ts
// Cenario principal: sala das baias (public/maps/baias.json).
// O chefe fica de pe e controla pelo teclado; os 6 personagens ficam sentados nas baias.
// O chat (HUD) avisa por eventos quando um personagem esta pensando/respondendo; quem aceitar
// o cafe levanta e anda ate a area de cafe (objetos "coffee", "coffee-2"... da camada "pois" do mapa).
import { game, characters, player as playerCfg, spriteKey, spriteSheets } from "../config/index.js";
import { EMOTE_FRAME_SIZE, EMOTE_SHEET_KEY, EMOTE_SHEET_PATH, PUBLIC_PATH } from "./constants.js";
import { Player } from "./Player.js";
import { Worker } from "./Worker.js";
import { CameraController } from "./CameraController.js";
import { DoorManager } from "./DoorManager.js";
import { InteractionManager } from "./interactions.js";
import { gameEvents } from "./events.js";
import { buildCollisionRects, buildSpriteFrames, findPoi, parseSpawns, renderTileObjectLayer } from "./MapHelpers.js";

/** Tempo (ms) lendo o "sim" antes de levantar da cadeira. */
const STAND_UP_DELAY = 1500;

export default class OfficeScene extends Phaser.Scene {
  constructor() {
    super({ key: "OfficeScene" });
    this.workers = [];
    /** Quantos personagens ja foram (ou estao indo) para o cafe: define o lugar na fila. */
    this.coffeeQueue = 0;
  }

  preload() {
    const { key, path, tilesetsPath } = game.map;
    this.load.tilemapTiledJSON(key, path);
    // Quando o JSON chega, enfileira as imagens dos tilesets referenciados por ele.
    this.load.once(`filecomplete-tilemapJSON-${key}`, () => {
      const cached = this.cache.tilemap.get(key);
      if (!cached?.data?.tilesets) return;
      for (const ts of cached.data.tilesets) {
        const basename = ts.image.split("/").pop();
        this.load.image(ts.name, `${tilesetsPath}/${basename}`);
      }
    });

    for (const s of spriteSheets) this.load.image(s.key, s.path);

    this.load.spritesheet(EMOTE_SHEET_KEY, EMOTE_SHEET_PATH, {
      frameWidth: EMOTE_FRAME_SIZE,
      frameHeight: EMOTE_FRAME_SIZE,
    });
    this.load.spritesheet("boss-arrow", `${PUBLIC_PATH}/sprites/arrow_down_48x48.png`, {
      frameWidth: 48,
      frameHeight: 48,
    });
    this.load.spritesheet("anim-door", `${PUBLIC_PATH}/sprites/animated_door_big_4_48x48.png`, {
      frameWidth: 48,
      frameHeight: 144,
    });
  }

  create() {
    for (const s of spriteSheets) buildSpriteFrames(this, s.key);

    const map = this.make.tilemap({ key: game.map.key });
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
    this.drawCoffeeArea();
    map.createLayer("walls", tilesets);
    map.createLayer("ground", tilesets);
    map.createLayer("furniture", tilesets);
    map.createLayer("objects", tilesets);

    renderTileObjectLayer(this, map, "props", tilesets, 5);
    renderTileObjectLayer(this, map, "props-over", tilesets, 11);

    // Camada "overhead" fica por cima dos personagens (encosto das cadeiras, divisorias...).
    const overhead = map.createLayer("overhead", tilesets);
    if (overhead) overhead.setDepth(10);

    const collisionGroup = this.physics.add.staticGroup();
    buildCollisionRects(map, collisionGroup);

    // Area jogavel: cobre o que sobra do recorte do mapa (ex.: parede da sala vizinha).
    const pf = game.map.playfield ?? { x: 0, y: 0, width: map.widthInPixels, height: map.heightInPixels };
    this.maskOutside(pf);

    const { bossSpawn, workerSpawns } = parseSpawns(map);
    this.coffeeSpots = game.coffee.spots.map((name) => findPoi(map, name)).filter(Boolean);
    if (!this.coffeeSpots.length) {
      console.warn(`[OfficeScene] Pontos ${game.coffee.spots.join(", ")} nao existem na camada "pois"; usando o spawn do chefe`);
      this.coffeeSpots = [{ ...bossSpawn, facing: "up" }];
    }

    // Chefe: de pe, controlado pelo teclado.
    this.player = new Player(this, bossSpawn.x, bossSpawn.y, bossSpawn.facing, spriteKey(playerCfg.sprite));
    this.physics.add.collider(this.player.sprite, collisionGroup);
    this.physics.world.setBounds(pf.x, pf.y, pf.width, pf.height);
    this.player.sprite.setCollideWorldBounds(true);
    this.input.keyboard.disableGlobalCapture();
    this.eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E, false);

    this.cameraController = new CameraController(this, this.player.sprite, pf);
    this.cameraController.init();

    // Personagens sentados: cada um ocupa a cadeira indicada em config/characters.js.
    const seats = characters.map((cfg) => {
      const spawn = workerSpawns.find((s) => s.seatId === cfg.seat);
      if (!spawn) {
        console.warn(`[OfficeScene] Cadeira "${cfg.seat}" de ${cfg.name} nao existe no mapa`);
        return null;
      }
      const worker = new Worker(this, spawn.x, spawn.y, spriteKey(cfg.sprite), spawn.seatId, cfg, spawn.facing);
      this.physics.add.collider(this.player.sprite, worker.sprite);
      this.workers.push(worker);
      return {
        seatId: spawn.seatId,
        id: cfg.id,
        assigned: true,
        label: cfg.name,
        gender: cfg.gender,
        roleTitle: cfg.role,
        spritePath: `${PUBLIC_PATH}/characters/Premade_Character_48x48_${cfg.sprite}.png`,
        status: "idle",
      };
    });

    // Cadeiras do mapa sem personagem configurado aparecem como vagas no HUD.
    const used = new Set(characters.map((c) => c.seat));
    const vacant = workerSpawns
      .filter((s) => !used.has(s.seatId))
      .map((s) => ({ seatId: s.seatId, assigned: false, label: "Vacant Seat", status: "empty" }));

    this.doorManager = new DoorManager(this, this.player, () => this.workers);
    this.doorManager.initDoors();

    this.interactions = new InteractionManager(this, this.player, this.workers, this.cameraController);
    this.interactions.initUI();

    gameEvents.emit("seats", [...seats.filter(Boolean), ...vacant]);

    const unsubscribe = [
      gameEvents.on("character:thinking", ({ id, thinking }) => this.onThinking(id, thinking)),
      gameEvents.on("character:reply", ({ id, text, accepted }) => this.onReply(id, text, accepted)),
    ];

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribe.forEach((off) => off());
      this.workers.forEach((w) => w.destroy());
      this.interactions.destroy();
    });
  }

  workerById(id) {
    return this.workers.find((w) => w.character.id === id);
  }

  /** Enquanto o Ollama responde: emote "..." sobre o personagem. */
  onThinking(id, thinking) {
    const worker = this.workerById(id);
    if (!worker || worker.leftSeat) return;
    if (thinking) {
      worker.pauseActivities();
      worker.showEmote("emote:dots");
      worker.setStatus("working");
    } else {
      worker.hideEmote();
      worker.setStatus("idle");
      worker.resumeActivities();
    }
  }

  /** Resposta do personagem: balao de fala e, se aceitou, levanta e vai ate a cafeteira. */
  onReply(id, text, accepted) {
    const worker = this.workerById(id);
    if (!worker || worker.leftSeat) return;
    const ttl = Math.max(game.interaction.bubbleMs, text.length * 60);
    worker.showBubble(text, ttl);
    if (!accepted) {
      worker.setStatus("idle");
      worker.resumeActivities(ttl);
      return;
    }
    worker.setStatus("done");
    worker.leftSeat = true;
    this.time.delayedCall(STAND_UP_DELAY, () => {
      const { points, facing } = this.coffeePath(worker);
      worker.walkPath(points, facing, game.coffee.walkSpeed, () => {
        worker.showEmote("emote:heart");
        gameEvents.emit("coffee:arrived", { id });
      });
    });
  }

  /**
   * Caminho baia -> area de cafe pelos corredores de config/game.js (coffee.aisles).
   * Os 2 primeiros ocupam os pontos da area (coffee.spots); os proximos fazem fila a esquerda do ultimo.
   */
  coffeePath(worker) {
    const { aisles, queueGap, corridorX } = game.coffee;
    const spots = this.coffeeSpots;
    const place = this.coffeeQueue++;
    const last = spots[spots.length - 1];
    const target =
      place < spots.length ? spots[place] : { x: last.x - (place - spots.length + 1) * queueGap, y: last.y, facing: last.facing };
    const aisleY = worker.facing === "down" ? aisles.top : aisles.bottom;

    const points = [{ x: worker.sprite.x, y: aisleY }];
    if (aisleY !== aisles.top) points.push({ x: corridorX, y: aisleY }, { x: corridorX, y: aisles.top });
    points.push({ x: target.x, y: aisles.top }, { x: target.x, y: target.y });
    return { points, facing: target.facing };
  }

  /** Area de cafe: faixa de piso colorida e placa na parede (config/game.js -> coffee.area). */
  drawCoffeeArea() {
    const { label, x, y, width, height, color, alpha, sign } = game.coffee.area;
    const tint = Phaser.Display.Color.HexStringToColor(color).color;
    // Logo depois do piso: fica por baixo das paredes, moveis e personagens.
    this.add.rectangle(x, y, width, height, tint, alpha).setOrigin(0, 0);
    this.add.rectangle(x, y, width, height).setOrigin(0, 0).setStrokeStyle(2, tint, 0.55);

    const text = this.add
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
    this.add
      .rectangle(sign.x, sign.y, text.width + 4, text.height + 4)
      .setStrokeStyle(2, 0x2b1b0e)
      .setDepth(9);
  }

  /** Pinta com a cor de fundo tudo que esta fora da area jogavel. */
  maskOutside(pf) {
    const big = 4000;
    const g = this.add.graphics().setDepth(12);
    g.fillStyle(Phaser.Display.Color.HexStringToColor(game.display.backgroundColor).color, 1);
    g.fillRect(pf.x - big, pf.y - big, big * 2 + pf.width, big); // acima
    g.fillRect(pf.x - big, pf.y + pf.height, big * 2 + pf.width, big); // abaixo
    g.fillRect(pf.x - big, pf.y, big, pf.height); // esquerda
    g.fillRect(pf.x + pf.width, pf.y, big, pf.height); // direita
  }

  update() {
    if (!this.player) return;

    const menuOpen = this.interactions.menuVisible;
    if (menuOpen) this.interactions.menu.update();

    // Com o menu aberto o chefe fica parado (mas continua animado em idle).
    this.player.locked = this.interactions.menuVisible;
    this.player.update();
    this.workers.forEach((w) => w.update());

    if (!this.cameraController.cameraFollowing && this.player.isMoving()) {
      this.cameraController.resumeCameraFollow();
    }
    this.doorManager.updateDoors();

    if (!this.interactions.menuVisible) this.interactions.updateProximity(this.eKey);
  }
}
