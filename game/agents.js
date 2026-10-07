// Shared agent roster. Used by the Phaser scene (to place sprites)
// and by the HUD overlay (to render the team list).
// Grid coords are tile indices in the office; colors drive the pixel sprite.

export const TILE = 32;

export const AGENTS = [
  { id: "nova",   name: "Nova",   role: "Planner",   color: 0xffcc4d, seat: { x: 5,  y: 5 } },
  { id: "pixel",  name: "Pixel",  role: "Coder",     color: 0x5ad1ff, seat: { x: 11, y: 5 } },
  { id: "sage",   name: "Sage",   role: "Reviewer",  color: 0x9b8cff, seat: { x: 17, y: 5 } },
  { id: "echo",   name: "Echo",   role: "Writer",    color: 0x7ef0a0, seat: { x: 5,  y: 10 } },
  { id: "flux",   name: "Flux",   role: "Ops",       color: 0xff8a5a, seat: { x: 11, y: 10 } },
];

export function hex(n) {
  return "#" + n.toString(16).padStart(6, "0");
}
