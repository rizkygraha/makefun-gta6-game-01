// input.js — keyboard + mouse state, with edge-triggered presses and a
// virtual input the autopilot (shots) and tests drive instead of the keys.

const GAME_KEYS = [
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'Space',
  'KeyF', 'KeyE', 'KeyQ', 'KeyR', 'KeyM', 'KeyV', 'Digit1', 'Digit2',
  'Digit3', 'Digit4', 'Escape', 'Enter', 'ArrowUp', 'ArrowDown',
];

export class Input {
  constructor(target) {
    this.target = target;
    this.keys = new Set();
    this.pressedKeys = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.virtual = new Set();
    this._onKeyDown = (e) => {
      if (!GAME_KEYS.includes(e.code)) return;
      if (!e.repeat) this.pressedKeys.add(e.code);
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
    };
    this._onMouseMove = (e) => {
      const r = this.target.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    };
    this._onMouseDown = (e) => {
      if (e.button !== 0) return;
      this.mouse.down = true;
      this.mouse.clicked = true;
    };
    this._onMouseUp = (e) => {
      if (e.button !== 0) return;
      this.mouse.down = false;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouse.down = false;
    };
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    this.target.addEventListener('mousemove', this._onMouseMove);
    this.target.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.target.removeEventListener('mousemove', this._onMouseMove);
    this.target.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
  }

  /** Held down, real or virtual. */
  down(code) {
    return this.keys.has(code) || this.virtual.has(code);
  }

  /** Pressed since the last endFrame(), real keys only. */
  pressed(code) {
    return this.pressedKeys.has(code);
  }

  /** The mouse was clicked since the last endFrame(). */
  clicked() {
    return this.mouse.clicked;
  }

  /** Drive a key from the autopilot instead of the keyboard. */
  setVirtual(code, on) {
    if (on) this.virtual.add(code);
    else this.virtual.delete(code);
  }

  clearVirtual() {
    this.virtual.clear();
  }

  /** Call once per frame after the game has read the input. */
  endFrame() {
    this.pressedKeys.clear();
    this.mouse.clicked = false;
  }

  /** WASD drive/walk axes: x = strafe/right, y = forward. */
  axes() {
    let x = 0;
    let y = 0;
    if (this.down('KeyA')) x -= 1;
    if (this.down('KeyD')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    return { x, y };
  }
}
