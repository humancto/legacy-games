// Keyboard input manager
class Input {
  constructor() {
    this.keys = {};
    this.justPressedKeys = {};
    this.justReleasedKeys = {};

    window.addEventListener("keydown", (e) => {
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
          e.code,
        )
      ) {
        e.preventDefault();
      }
      if (!this.keys[e.code]) {
        this.justPressedKeys[e.code] = true;
      }
      this.keys[e.code] = true;
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
      this.justReleasedKeys[e.code] = true;
    });
  }

  isDown(key) {
    return !!this.keys[key];
  }

  justPressed(key) {
    return !!this.justPressedKeys[key];
  }

  justReleased(key) {
    return !!this.justReleasedKeys[key];
  }

  // Directional helpers (WASD + arrows)
  get left() {
    return this.isDown("ArrowLeft") || this.isDown("KeyA");
  }
  get right() {
    return this.isDown("ArrowRight") || this.isDown("KeyD");
  }
  get up() {
    return this.isDown("ArrowUp") || this.isDown("KeyW");
  }
  get down() {
    return this.isDown("ArrowDown") || this.isDown("KeyS");
  }

  // Action buttons
  get action1() {
    return this.justPressed("Space") || this.justPressed("KeyZ");
  }
  get action2() {
    return this.justPressed("KeyX");
  }
  get action3() {
    return this.justPressed("KeyC");
  }
  get pause() {
    return this.justPressed("Escape") || this.justPressed("KeyP");
  }
  get confirm() {
    return this.justPressed("Enter") || this.justPressed("Space");
  }

  // Call at end of each frame
  endFrame() {
    this.justPressedKeys = {};
    this.justReleasedKeys = {};
  }
}

// Global Keyboard compatibility layer for games that use Keyboard.isDown/justPressed/update
const Keyboard = {
  _input: new Input(),
  init() {},
  isDown(key) {
    return this._input.isDown(key);
  },
  justPressed(key) {
    return this._input.justPressed(key);
  },
  justReleased(key) {
    return this._input.justReleased(key);
  },
  update() {
    this._input.endFrame();
  },
};
