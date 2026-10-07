// Procedurally draws a tiny pixel-art agent as a spritesheet texture.
// No external image assets required. Each agent gets a 2-frame "bob" idle
// animation built from Graphics -> generateTexture.

const FW = 20; // frame width
const FH = 26; // frame height

function shade(color, amt) {
  const r = Math.max(0, Math.min(255, ((color >> 16) & 0xff) + amt));
  const g = Math.max(0, Math.min(255, ((color >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (color & 0xff) + amt));
  return (r << 16) | (g << 8) | b;
}

// Draw one character frame into a Graphics at offset (ox, oy).
// legPhase shifts the feet to fake a walking/idle bob.
function drawAgent(g, ox, oy, color, legPhase) {
  const skin = 0xf1c7a0;
  const hair = 0x3a2d26;
  const shoe = 0x222733;
  const bodyDark = shade(color, -40);

  const px = (x, y, w, h, c) => { g.fillStyle(c, 1); g.fillRect(ox + x, oy + y, w, h); };

  // Shadow
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(ox + FW / 2, oy + FH - 2, 16, 5);

  // Legs (phase makes them alternate)
  px(6, 20, 3, 5 - legPhase, shoe);
  px(11, 20, 3, 5 + legPhase, shoe);

  // Body / torso
  px(5, 12, 10, 9, color);
  px(5, 12, 10, 2, shade(color, 25)); // highlight collar
  px(5, 18, 10, 3, bodyDark);         // belt area

  // Arms
  px(3, 13, 2, 6, bodyDark);
  px(15, 13, 2, 6, bodyDark);

  // Head
  px(6, 4, 8, 8, skin);
  // Hair
  px(5, 3, 10, 3, hair);
  px(5, 4, 2, 4, hair);
  px(13, 4, 2, 4, hair);
  // Eyes
  px(8, 8, 1, 2, 0x222222);
  px(11, 8, 1, 2, 0x222222);
}

// Build (or reuse) a 2-frame texture for a given agent color.
export function ensureAgentTexture(scene, key, color) {
  if (scene.textures.exists(key)) return key;

  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  // Frame 0: idle up, Frame 1: idle down (slight bob) -> used as a loop
  drawAgent(g, 0, 0, color, 0);
  drawAgent(g, FW, 0, color, 1);

  g.generateTexture(key, FW * 2, FH);
  g.destroy();

  // Register the two frames
  const tex = scene.textures.get(key);
  tex.add(0, 0, 0, 0, FW, FH);
  tex.add(1, 0, FW, 0, FW, FH);

  return key;
}

export function ensureAgentAnim(scene, key) {
  const animKey = key + "-idle";
  if (scene.anims.exists(animKey)) return animKey;
  scene.anims.create({
    key: animKey,
    frames: [
      { key, frame: 0 },
      { key, frame: 1 },
    ],
    frameRate: 2.2,
    repeat: -1,
  });
  return animKey;
}

export const FRAME = { W: FW, H: FH };
