// Interacao do chefe (de pe) com os personagens sentados nas baias.
// Baseado em agent-town (MIT): components/game/systems/InteractionManager.ts
//
// Fluxo: chegar perto -> aparece "Press E" -> E abre o menu -> escolher uma opcao.
// As opcoes vem de config/game.js (interaction.options); o comportamento de cada `id`
// esta em `handlers` abaixo. Para criar novas mecanicas, adicione um id na config
// e um handler aqui (ou escute o evento "interaction" em game/events.js).
import { game } from "../config/index.js";
import { FRAME_HEIGHT, PRESS_E_STYLE, PROMPT_Y_OFFSET } from "./constants.js";
import { InteractionMenu } from "./InteractionMenu.js";
import { gameEvents } from "./events.js";

/** Comportamento de cada opcao do menu. `worker` e o personagem alvo. */
const handlers = {
  talk(worker) {
    worker.showBubble(worker.pickLine("talk"), game.interaction.bubbleMs);
  },

  invite(worker) {
    const accepted = Math.random() < 0.5;
    worker.showBubble(worker.pickLine(accepted ? "inviteAccept" : "inviteDecline"), game.interaction.bubbleMs);
    return { accepted };
  },

  cancel() {},
};

export class InteractionManager {
  constructor(scene, player, workers, cameraController) {
    this.scene = scene;
    this.player = player;
    this.workers = workers;
    this.cameraController = cameraController;
    this.nearestWorker = null;
    this.promptText = null;
    this.menu = null;
  }

  initUI() {
    this.promptText = this.scene.add
      .text(0, 0, game.interaction.promptText, PRESS_E_STYLE)
      .setResolution(window.devicePixelRatio * 2)
      .setOrigin(0.5, 1)
      .setDepth(25)
      .setVisible(false);
    this.promptText.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

    this.menu = new InteractionMenu(this.scene);
    this.menu.onClose = () => this.cameraController.resumeCameraFollow();
  }

  get menuVisible() {
    return this.menu.visible;
  }

  findNearestWorker() {
    let nearest = null;
    let min = Infinity;
    for (const worker of this.workers) {
      const d = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, worker.sprite.x, worker.sprite.y);
      if (d < game.interaction.distance && d < min) {
        min = d;
        nearest = worker;
      }
    }
    return nearest;
  }

  openMenu(worker) {
    this.player.faceTo(worker.sprite.x, worker.sprite.y);
    const options = game.interaction.options.map((opt) => ({
      label: opt.label,
      enabled: opt.enabled !== false,
      action: () => this.run(opt.id, worker),
    }));
    this.menu.show(worker.sprite.x, worker.sprite.y, options);
  }

  run(optionId, worker) {
    const result = handlers[optionId]?.(worker) ?? {};
    gameEvents.emit("interaction", { option: optionId, characterId: worker.character.id, ...result });
  }

  /** Chamar a cada frame (menu fechado). Retorna true se abriu o menu. */
  updateProximity(eKey) {
    const nearest = this.findNearestWorker();
    this.nearestWorker = nearest;

    if (nearest) {
      this.promptText.setPosition(nearest.sprite.x, nearest.sprite.y - FRAME_HEIGHT * PROMPT_Y_OFFSET);
      this.promptText.setVisible(true);
      if (Phaser.Input.Keyboard.JustDown(eKey)) {
        this.promptText.setVisible(false);
        this.openMenu(nearest);
        return true;
      }
    } else {
      this.promptText.setVisible(false);
    }
    return false;
  }

  destroy() {
    this.menu?.destroy();
    this.nearestWorker = null;
  }
}
