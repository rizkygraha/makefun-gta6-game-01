// NEON TIDE — input.js
// Keyboard + mouse state. Two views of a key: held (down) and just pressed
// this frame (pressed). The main loop calls endFrame() after each step so a
// press is only ever seen once. Pointer lock gives mouse-look; it is optional
// and never required for the game to run.

export class Input {
  constructor() {
    this.down = new Set();     // codes held right now
    this.pressed = new Set();  // codes pressed since the last endFrame
    this.mouseDX = 0;          // accumulated mouse movement since last frame
    this.mouseDY = 0;
    this.mouseDown = false;    // left button held
    this.mouseClicked = false; // left button pressed since last endFrame
    this.pointerLocked = false;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => { this.down.delete(e.code); };
    this._onMouseMove = (e) => {
      if (!this.pointerLocked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    };
    this._onMouseDown = (e) => {
      if (e.button !== 0) return;
      this.mouseDown = true;
      this.mouseClicked = true;
    };
    this._onMouseUp = (e) => { if (e.button === 0) this.mouseDown = false; };
    this._onLockChange = () => {
      this.pointerLocked = document.pointerLockElement != null;
    };
    this._onBlur = () => { this.down.clear(); this.mouseDown = false; };
  }

  attach(canvas) {
    this.canvas = canvas;
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('pointerlockchange', this._onLockChange);
  }

  // Ask the browser to lock the pointer to the canvas (mouse-look). Safe to
  // call any time; a failure is swallowed.
  lockPointer() {
    try {
      if (this.canvas && !this.pointerLocked) this.canvas.requestPointerLock();
    } catch (e) { /* pointer lock is a nicety, never a requirement */ }
  }

  unlockPointer() {
    try { if (this.pointerLocked) document.exitPointerLock(); } catch (e) { /* ignore */ }
  }

  isDown(code) { return this.down.has(code); }
  wasPressed(code) { return this.pressed.has(code); }

  // Call once per rendered frame, after the sim steps, to clear edges.
  endFrame() {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseClicked = false;
  }
}
