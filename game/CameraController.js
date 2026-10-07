// Portado de agent-town (MIT): components/game/systems/CameraController.ts
// Adaptado: zoom inicial ajustado ao tamanho do mapa e valores vindos de config/game.js.
import { game } from "../config/index.js";
import { CAMERA_DRAG_THRESHOLD, ZOOM_SENSITIVITY } from "./constants.js";

export class CameraController {
  /** `area` = { x, y, width, height } da regiao visivel/jogavel (em px do mundo). */
  constructor(scene, playerSprite, area) {
    this.scene = scene;
    this.playerSprite = playerSprite;
    this.area = area;
    this.mapWidth = area.width;
    this.mapHeight = area.height;
    this.cameraDragging = false;
    this.cameraFollowing = true;
    /** true depois que o jogador mexe no zoom com a roda do mouse. */
    this.userZoomed = false;
  }

  /** Zoom em que o mapa inteiro cabe na janela (com margem para o HUD). */
  fitZoom() {
    const { fitMargin, zoomMin, zoomMax } = game.camera;
    const cam = this.scene.cameras.main;
    const z = Math.min(cam.width / this.mapWidth, cam.height / this.mapHeight) * fitMargin;
    return Phaser.Math.Clamp(z, zoomMin, zoomMax);
  }

  init() {
    const cam = this.scene.cameras.main;
    cam.setBackgroundColor(game.display.backgroundColor);
    cam.setRoundPixels(true);
    cam.setZoom(game.camera.fitToMap ? this.fitZoom() : 0.82);
    this.updateCameraBounds();
    cam.startFollow(this.playerSprite, true, game.camera.lerp, game.camera.lerp);

    this.scene.scale.on("resize", () => {
      if (game.camera.fitToMap && !this.userZoomed) cam.setZoom(this.fitZoom());
      this.updateCameraBounds();
    });
    this.initWheel(cam);
    this.initCameraDrag(cam);
  }

  initWheel(cam) {
    const canvas = this.scene.game.canvas;
    const { zoomMin, zoomMax } = game.camera;
    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.ctrlKey ? e.deltaY * 3 : e.deltaY;
      const oldZoom = cam.zoom;
      const newZoom = Phaser.Math.Clamp(oldZoom - delta * ZOOM_SENSITIVITY, zoomMin, zoomMax);
      if (newZoom === oldZoom) return;
      this.userZoomed = true;

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
      this.scene.cameras.main.startFollow(this.playerSprite, true, game.camera.lerp, game.camera.lerp);
      this.cameraFollowing = true;
    }
  }

  /** Centraliza o mapa quando o viewport e maior que o mapa no zoom atual. */
  updateCameraBounds() {
    const cam = this.scene.cameras.main;
    const viewW = cam.width / cam.zoom;
    const viewH = cam.height / cam.zoom;
    const { x, y } = this.area;
    const bx = viewW > this.mapWidth ? x - (viewW - this.mapWidth) / 2 : x;
    const by = viewH > this.mapHeight ? y - (viewH - this.mapHeight) / 2 : y;
    const bw = viewW > this.mapWidth ? viewW : this.mapWidth;
    const bh = viewH > this.mapHeight ? viewH : this.mapHeight;
    cam.setBounds(bx, by, bw, bh);
  }
}
