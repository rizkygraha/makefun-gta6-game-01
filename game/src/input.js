// Keyboard and mouse input. Held keys give movement and driving; one-shot
// presses (interact, enter a car, reload, map, camera, radio, pause) are
// queued as bit flags and taken once by the loop, so a press between two
// frames is never lost and never counted twice. The mouse aims on foot:
// its screen position is read by the game and raycast onto the ground.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_ENTER = 8;
export const ACTION_RELOAD = 16;
export const ACTION_MAP = 32;
export const ACTION_CAMERA = 64;
export const ACTION_RADIO = 128;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const HANDBRAKE = new Set(['Space']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0.5;
  let mouseY = 0.5;
  let mouseDown = false;
  let mouseClicked = false;
  let weaponKey = -1;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyE') actions |= ACTION_INTERACT;
    if (event.code === 'KeyF') actions |= ACTION_ENTER;
    if (event.code === 'KeyR') actions |= ACTION_RELOAD;
    if (event.code === 'KeyM') actions |= ACTION_MAP;
    if (event.code === 'KeyV') actions |= ACTION_CAMERA;
    if (event.code === 'KeyQ') actions |= ACTION_RADIO;
    if (event.code === 'Digit1') weaponKey = 0;
    if (event.code === 'Digit2') weaponKey = 1;
    if (event.code === 'Digit3') weaponKey = 2;
    if (event.code === 'Digit4') weaponKey = 3;
    if (event.code === 'Escape' || event.code === 'KeyP') actions |= ACTION_PAUSE;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (event.clientX - rect.left) / rect.width;
    mouseY = (event.clientY - rect.top) / rect.height;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouseDown = true;
      mouseClicked = true;
    }
  });
  window.addEventListener('mouseup', () => {
    mouseDown = false;
  });

  const has = (set) => {
    for (const code of set) if (keys.has(code)) return true;
    return false;
  };

  return {
    /** -1 back / 1 forward, from W/S or arrows. */
    throttle() {
      return (has(FORWARD) ? 1 : 0) - (has(BACK) ? 1 : 0);
    },
    /** -1 left / 1 right, from A/D or arrows. */
    steer() {
      return (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
    },
    sprint() { return has(SPRINT); },
    handbrake() { return has(HANDBRAKE); },
    /** Mouse position as a fraction of the canvas, 0..1. */
    mouse() { return { x: mouseX, y: mouseY }; },
    mouseHeld() { return mouseDown; },
    /** True once per click since the last call. */
    takeClick() {
      const clicked = mouseClicked;
      mouseClicked = false;
      return clicked;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** A weapon slot key (0-3) pressed since the last call, else -1. */
    takeWeapon() {
      const w = weaponKey;
      weaponKey = -1;
      return w;
    },
  };
}
