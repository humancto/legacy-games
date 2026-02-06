// Shared utility functions
const Utils = {
  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  },

  randomRange(min, max) {
    return Math.random() * (max - min) + min;
  },

  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  },

  angleBetween(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
  },

  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  // Simple easing functions
  easeInQuad(t) {
    return t * t;
  },
  easeOutQuad(t) {
    return t * (2 - t);
  },
  easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  },
};

class Timer {
  constructor(duration, callback, loop = false) {
    this.duration = duration;
    this.callback = callback;
    this.loop = loop;
    this.elapsed = 0;
    this.active = true;
  }

  update(dt) {
    if (!this.active) return;
    this.elapsed += dt;
    if (this.elapsed >= this.duration) {
      this.callback();
      if (this.loop) {
        this.elapsed -= this.duration;
      } else {
        this.active = false;
      }
    }
  }

  reset() {
    this.elapsed = 0;
    this.active = true;
  }

  get progress() {
    return Utils.clamp(this.elapsed / this.duration, 0, 1);
  }
}

class Cooldown {
  constructor(duration) {
    this.duration = duration;
    this.remaining = 0;
  }

  update(dt) {
    if (this.remaining > 0) this.remaining -= dt;
  }

  fire() {
    if (this.remaining <= 0) {
      this.remaining = this.duration;
      return true;
    }
    return false;
  }

  get ready() {
    return this.remaining <= 0;
  }
}
