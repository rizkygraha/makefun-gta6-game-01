// Keyboard + mouse input. Held keys steer and drive; one-shot presses (enter a
// car, pause, map, camera, radio, reload, weapon switch, interact) are queued
// as bit flags and taken once by the loop, so a press between two frames is
// never lost and never counted twice. A press that toggles something is an
// edge, never a held repeat.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MAP = 4;
export const ACTION_CAMERA = 8;
export const ACTION_ENTER = 16;
export const ACTION_INTERACT = 32;
export const ACTION_RADIO_PREV = 64;
export const ACTION_RADIO_NEXT = 128;
export const ACTION_RELOAD = 256;
export const ACTION_W1 = 512;
export const ACTION_W2 = 1024;
export const ACTION_W3 = 2048;
export const ACTION_W4 = 4096;

const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MAP = new Set(['KeyM']);
const CAMERA = new Set(['KeyV']);
const ENTER = new Set(['KeyF']);
const INTERACT = new Set(['KeyE']);
const RADIO_PREV = new Set(['KeyQ']);
const RADIO_NEXT = new Set(['KeyC']);
const RELOAD = new Set(['KeyR']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false, clicked: false, moved: false };

  window.addEventListener('keydown', (event) => {
    held.add(event.code);
    if (event.repeat) return;
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (MAP.has(event.code)) actions |= ACTION_MAP;
    else if (CAMERA.has(event.code)) actions |= ACTION_CAMERA;
    else if (ENTER.has(event.code)) actions |= ACTION_ENTER;
    else if (INTERACT.has(event.code)) actions |= ACTION_INTERACT;
    else if (RADIO_PREV.has(event.code)) actions |= ACTION_RADIO_PREV;
    else if (RADIO_NEXT.has(event.code)) actions |= ACTION_RADIO_NEXT;
    else if (RELOAD.has(event.code)) actions |= ACTION_RELOAD;
    else if (event.code === 'Digit1') actions |= ACTION_W1;
    else if (event.code === 'Digit2') actions |= ACTION_W2;
    else if (event.code === 'Digit3') actions |= ACTION_W3;
    else if (event.code === 'Digit4') actions |= ACTION_W4;
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    mouse.moved = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    mouse.down = true;
    mouse.clicked = true;
  });
  window.addEventListener('pointerup', () => { mouse.down = false; });

  return {
    mouse,
    isDown(code) { return held.has(code); },
    /** Forward/back/left/right from WASD or arrows, in camera space. */
    move() {
      const f = (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) - (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0);
      const r = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      return { f, r };
    },
    sprint() { return held.has('ShiftLeft') || held.has('ShiftRight'); },
    handbrake() { return held.has('Space'); },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** True once per click; consumed by combat. */
    takeClick() {
      const c = mouse.clicked;
      mouse.clicked = false;
      return c;
    },
    /** Test/autopilot hook: press a key edge without a real keyboard. */
    press(code) { actions |= 0; held.add(code); },
    release(code) { held.delete(code); },
    queueAction(flag) { actions |= flag; },
  };
}
