// Portado de agent-town (MIT): components/game/systems/CameraController.ts
import {
  BG_COLOR,
  CAMERA_DRAG_THRESHOLD,
  CAMERA_LERP,
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_SENSITIVITY,
} from "./config.js";

export class CameraController {
  constructor(scene, playerSprite, mapWidth, mapHeight) {
    this.scene = scene;
    this.playerSprite = playerSprite;
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.cameraDragging = false;
    this.cameraFollowing = true;
  }

  init() {
    const cam = this.scene.cameras.main;
    cam.setBackgroundColor(BG_COLOR);
    cam.setRoundPixels(true);
    cam.setZoom(ZOOM_DEFAULT);
    this.updateCameraBounds();
    cam.startFollow(this.playerSprite, true, CAMERA_LERP, CAMERA_LERP);

    this.scene.scale.on("resize", () => this.updateCameraBounds());
    this.initWheel(cam);
    this.initCameraDrag(cam);
  }

  initWheel(cam) {
    const canvas = this.scene.game.canvas;
    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.ctrlKey ? e.deltaY * 3 : e.deltaY;
      const oldZoom = cam.zoom;
      const newZoom = Phaser.Math.Clamp(oldZoom - delta * ZOOM_SENSITIVITY, ZOOM_MIN, ZOOM_MAX);
      if (newZoom === oldZoom) return;

      if (!this.cameraFollowing) {
        const sx = e.offsetX / cam.scaleManager.displayScale.x;
        const sy = e.offsetY / cam.scaleManager.displayScale.y;
        const before = cam.getWorldPoint(sx, sy);
        cam.setZoom(newZoom);
        this.updateCameraBounds();
        const after = cam.getWorldPoint(sx, sy);
        cam.scrollX += before.x - after.x;
        cam.scrollY += before.y - after.y;
      } else {
        cam.setZoom(newZoom);
        this.updateCameraBounds();
      }
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    this.scene.events.once("shutdown", () => canvas.removeEventListener("wheel", onWheel));
  }

  initCameraDrag(cam) {
    let lastX = 0;
    let lastY = 0;
    this.scene.input.on("pointerdown", (pointer) => {
      if (pointer.leftButtonDown()) {
        this.cameraDragging = true;
        lastX = pointer.x;
        lastY = pointer.y;
      }
    });
    this.scene.input.on("pointermove", (pointer) => {
      if (!this.cameraDragging || !pointer.leftButtonDown()) return;
      const dx = lastX - pointer.x;
      const dy = lastY - pointer.y;
      lastX = pointer.x;
      lastY = pointer.y;
      if (Math.abs(dx) > CAMERA_DRAG_THRESHOLD || Math.abs(dy) > CAMERA_DRAG_THRESHOLD) {
        if (this.cameraFollowing) {
          cam.stopFollow();
          this.cameraFollowing = false;
        }
        cam.scrollX += dx / cam.zoom;
        cam.scrollY += dy / cam.zoom;
      }
    });
    this.scene.input.on("pointerup", () => {
      this.cameraDragging = false;
    });
  }

  resumeCameraFollow() {
    if (!this.cameraFollowing) {
      this.scene.cameras.main.startFollow(this.playerSprite, true, CAMERA_LERP, CAMERA_LERP);
      this.cameraFollowing = true;
    }
  }

  /** Centraliza o mapa quando o viewport e maior que o mapa no zoom atual. */
  updateCameraBounds() {
    const cam = this.scene.cameras.main;
    const viewW = cam.width / cam.zoom;
    const viewH = cam.height / cam.zoom;
    const bx = viewW > this.mapWidth ? -(viewW - this.mapWidth) / 2 : 0;
    const by = viewH > this.mapHeight ? -(viewH - this.mapHeight) / 2 : 0;
    const bw = viewW > this.mapWidth ? viewW : this.mapWidth;
    const bh = viewH > this.mapHeight ? viewH : this.mapHeight;
    cam.setBounds(bx, by, bw, bh);
  }
}
