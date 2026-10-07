// Portado de agent-town (MIT): components/game/systems/DoorManager.ts
import { DOOR_POSITIONS } from "./config.js";

export class DoorManager {
  constructor(scene, player, getWorkers) {
    this.scene = scene;
    this.player = player;
    this.getWorkers = getWorkers;
    this.doors = [];
  }

  initDoors() {
    if (!this.scene.anims.exists("door-open")) {
      this.scene.anims.create({
        key: "door-open",
        frames: this.scene.anims.generateFrameNumbers("anim-door", { start: 0, end: 4 }),
        frameRate: 10,
        repeat: 0,
      });
      this.scene.anims.create({
        key: "door-close",
        frames: this.scene.anims.generateFrameNumbers("anim-door", { start: 4, end: 0 }),
        frameRate: 10,
        repeat: 0,
      });
    }
    for (const pos of DOOR_POSITIONS) {
      const sprite = this.scene.add.sprite(pos.x, pos.y, "anim-door", 0).setOrigin(0, 0).setDepth(4);
      this.doors.push({ sprite, x: pos.x + 24, y: pos.y + 48, open: false });
    }
  }

  updateDoors() {
    const threshold = 60;
    const t2 = threshold * threshold;
    const workers = this.getWorkers();
    for (const door of this.doors) {
      const near = [this.player, ...workers].some((e) => {
        const dx = e.sprite.x - door.x;
        const dy = e.sprite.y - door.y;
        return dx * dx + dy * dy < t2;
      });
      if (near && !door.open) {
        door.open = true;
        door.sprite.play("door-open");
      } else if (!near && door.open) {
        door.open = false;
        door.sprite.play("door-close");
      }
    }
  }
}
