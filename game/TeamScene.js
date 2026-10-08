// Cena do modo "Equipe adivinha": o mesmo escritorio, mas a equipe fica em pe, andando pelo
// escritorio e conversando em duplas. A rodada (game/teamChat.js) comanda a cena pelo "palco"
// (`stage`), publicado no barramento como "team:stage":
//   meet(a, b)        os dois se encontram num lugar livre e ficam frente a frente
//   thinking(id, on)  emote "..." enquanto o modelo pensa na fala
//   say(id, texto)    balao de fala (o palpite em negrito)
//   bossSay(texto)    balao do chefe (dica nova, "errado!", "ta quente!", "acertou!")
//   release(ids)      a dupla volta a andar a toa
//   celebrate(id)     todos vao para a area de cafe
//   lament()          ninguem acertou
import { game, characters, player as playerCfg, spriteKey } from "../config/index.js";
import { BODY_SIZE_RATIO_H, BODY_SIZE_RATIO_W, BUBBLE_Y_OFFSET, FRAME_HEIGHT, FRAME_WIDTH } from "./constants.js";
import { Player } from "./Player.js";
import { CameraController } from "./CameraController.js";
import { ChatBubble } from "./ChatBubble.js";
import { NavGrid } from "./NavGrid.js";
import { FEET_OFFSET_Y, Walker, depthFor } from "./Walker.js";
import { gameEvents } from "./events.js";
import { buildOffice, preloadOffice } from "./officeMap.js";

const cfg = game.team;
/** Tempo maximo (ms) esperando a dupla chegar no ponto de encontro. */
const MEET_TIMEOUT = 15000;
/** Tempo maximo (ms) esperando todo mundo chegar ao cafe. */
const COFFEE_TIMEOUT = 20000;
/** Variante do balao do chefe para cada tipo de reacao. */
const BOSS_VARIANT = { hint: "hint", start: "hint", wrong: "wrong", repeat: "wrong", lost: "wrong", close: "close", right: "right" };

export default class TeamScene extends Phaser.Scene {
  constructor() {
    super({ key: "TeamScene" });
    this.walkers = [];
    /** Dupla conversando agora (para esconder o balao de quem esta ouvindo). */
    this.pair = [];
  }

  preload() {
    preloadOffice(this);
  }

  create() {
    const office = buildOffice(this);
    if (!office) return;
    const { pf, collisionGroup, rects, bossSpawn, workerSpawns } = office;

    // Chefe: de pe, controlado pelo teclado (so assiste e reage aos palpites).
    this.player = new Player(this, bossSpawn.x, bossSpawn.y, bossSpawn.facing, spriteKey(playerCfg.sprite));
    this.physics.add.collider(this.player.sprite, collisionGroup);
    this.physics.world.setBounds(pf.x, pf.y, pf.width, pf.height);
    this.player.sprite.setCollideWorldBounds(true);
    this.input.keyboard.disableGlobalCapture();
    this.bossBubble = new ChatBubble(this, { maxWidth: 260 });

    this.cameraController = new CameraController(this, this.player.sprite, pf);
    this.cameraController.init();

    // Grade de navegacao: mesmas colisoes do mapa, corpo do tamanho dos pes do personagem.
    this.grid = new NavGrid({
      rects,
      bounds: pf,
      cell: 24,
      body: { width: FRAME_WIDTH * BODY_SIZE_RATIO_W, height: FRAME_HEIGHT * BODY_SIZE_RATIO_H },
    });

    // Cada um comeca na propria cadeira, levanta e sai andando (em momentos diferentes).
    characters.forEach((c, i) => {
      const seat = workerSpawns.find((s) => s.seatId === c.seat) ?? { x: bossSpawn.x, y: bossSpawn.y, facing: "down" };
      const walker = new Walker(this, seat.x, seat.y, spriteKey(c.sprite), c, seat.facing, {
        grid: this.grid,
        config: cfg,
        crowd: () => this.crowdExcept(walker),
      });
      this.walkers.push(walker);
      const exit = this.grid.nearestWalkable(seat.x, seat.y + FEET_OFFSET_Y);
      this.time.delayedCall(400 + i * 350, () => {
        if (!exit) return walker.startWandering();
        walker.walkTo(exit).then(() => {
          if (!walker.engaged) walker.startWandering();
        });
      });
    });

    // Lugares da comemoracao: espalhados pela area de cafe, perto da mesa.
    const area = game.coffee.area;
    this.coffeeFocus = { x: area.x + area.width / 2, y: area.y + area.height / 2 };
    this.coffeeSpots = this.grid.spreadSpots(area, this.coffeeFocus, characters.length, 52);

    this.stage = {
      meet: (a, b) => this.meet(a, b),
      thinking: (id, on) => this.thinking(id, on),
      say: (id, text, opts) => this.say(id, text, opts),
      bossSay: (text, kind) => this.bossSay(text, kind),
      release: (ids) => this.release(ids),
      celebrate: (id) => this.celebrate(id),
      lament: () => this.lament(),
    };
    gameEvents.emit("team:stage", this.stage);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.walkers.forEach((w) => w.destroy());
      this.bossBubble.destroy();
    });
  }

  walkerById(id) {
    return this.walkers.find((w) => w.character.id === id);
  }

  /** Onde os outros estao (e para onde vao): ninguem escolhe o mesmo lugar para parar. */
  crowdExcept(self) {
    const points = [{ x: this.player.sprite.x, y: this.player.sprite.y + FEET_OFFSET_Y }];
    for (const w of this.walkers) {
      if (w === self) continue;
      points.push(w.feet);
      if (w.target) points.push(w.target);
    }
    return points;
  }

  wait(ms) {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  // ── Palco (chamado pela rodada) ──────────────────────────
  async meet(aId, bId) {
    const a = this.walkerById(aId);
    const b = this.walkerById(bId);
    if (!a || !b) return;
    this.pair = [a, b];
    for (const w of this.pair) {
      w.engage();
      w.setStatus("working");
    }
    const fa = a.feet;
    const fb = b.feet;
    const avoid = this.walkers.filter((w) => w !== a && w !== b).flatMap((w) => [w.feet, w.target].filter(Boolean));
    const spots = this.grid.meetingSpots((fa.x + fb.x) / 2, (fa.y + fb.y) / 2, cfg.talkGap, { avoid, radius: 44 });
    if (spots) {
      const [left, right] = fa.x <= fb.x ? [a, b] : [b, a];
      await Promise.race([Promise.all([left.walkTo(spots.left), right.walkTo(spots.right)]), this.wait(MEET_TIMEOUT)]);
      left.stopWalking();
      right.stopWalking();
    }
    a.faceTo(b.sprite.x, b.sprite.y);
    b.faceTo(a.sprite.x, a.sprite.y);
  }

  thinking(id, on) {
    const w = this.walkerById(id);
    if (!w) return;
    if (on) w.showEmote("emote:dots");
    else if (w.currentEmoteKey === "emote:dots") w.hideEmote();
  }

  say(id, text, { highlight = "" } = {}) {
    const w = this.walkerById(id);
    if (!w) return;
    // Na dupla, so o balao de quem esta falando fica na tela.
    for (const other of this.pair) if (other !== w) other.bubble.hide();
    const ttl = Math.max(cfg.bubbleMs, text.length * cfg.bubbleMsPerChar);
    w.showBubble(text, ttl, { maxChars: cfg.maxLineChars + 40, highlight });
  }

  bossSay(text, kind = "") {
    const ttl = Math.max(2600, text.length * cfg.bubbleMsPerChar);
    const { x, y } = this.player.sprite;
    this.bossBubble.show(text, x, y - FRAME_HEIGHT * BUBBLE_Y_OFFSET, ttl, { maxChars: 200, variant: BOSS_VARIANT[kind] ?? "default" });
  }

  release(ids) {
    this.pair = [];
    for (const id of ids) {
      const w = this.walkerById(id);
      if (w && w.engaged) w.startWandering(Phaser.Math.Between(300, 1500));
    }
  }

  /** Todo mundo para o cafe: quem acertou vai na frente. Resolve quando todos chegam. */
  async celebrate(winnerId) {
    this.pair = [];
    const order = [...this.walkers].sort((a, b) => (a.character.id === winnerId ? -1 : b.character.id === winnerId ? 1 : 0));
    const trips = order.map(async (w, i) => {
      w.engage();
      w.setStatus("done");
      if (w.character.id === winnerId) w.showEmote("emote:star");
      await this.wait(i * 250);
      const spot = this.coffeeSpots[i] ?? this.coffeeSpots.at(-1);
      if (spot) await w.walkTo(spot, { speed: game.coffee.walkSpeed });
      w.faceTo(this.coffeeFocus.x, this.coffeeFocus.y - FEET_OFFSET_Y);
      w.showEmote(i % 2 ? "emote:music" : "emote:heart");
      gameEvents.emit("coffee:arrived", { id: w.character.id });
    });
    await Promise.race([Promise.all(trips), this.wait(COFFEE_TIMEOUT)]);
  }

  /** Ninguem acertou: todos suam frio e voltam a andar. */
  lament() {
    this.pair = [];
    this.walkers.forEach((w, i) => {
      w.engage();
      w.setStatus("failed");
      w.faceTo(this.player.sprite.x, this.player.sprite.y);
      this.time.delayedCall(i * 150, () => w.showEmote("emote:sweat"));
      this.time.delayedCall(3500 + i * 300, () => w.startWandering());
    });
  }

  update() {
    if (!this.player) return;
    this.player.update();
    this.player.sprite.setDepth(depthFor(this.player.sprite.y));
    this.walkers.forEach((w) => w.update());
    this.bossBubble.updatePosition(this.player.sprite.x, this.player.sprite.y - FRAME_HEIGHT * BUBBLE_Y_OFFSET);
    if (!this.cameraController.cameraFollowing && this.player.isMoving()) {
      this.cameraController.resumeCameraFollow();
    }
  }
}
