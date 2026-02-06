// Lightweight particle system
class Particle {
  constructor(x, y, vx, vy, life, color, size, gravity = 0) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.color = color;
    this.size = size;
    this.gravity = gravity;
    this.alpha = 1;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += this.gravity * dt;
    this.life -= dt;
    this.alpha = Math.max(0, this.life / this.maxLife);
  }

  get dead() {
    return this.life <= 0;
  }
}

class ParticleEmitter {
  constructor() {
    this.particles = [];
  }

  emit(config) {
    const {
      x,
      y,
      count = 10,
      speedMin = 20,
      speedMax = 80,
      lifeMin = 0.3,
      lifeMax = 0.8,
      colors = ["#fff", "#ff0", "#f80"],
      sizeMin = 1,
      sizeMax = 3,
      gravity = 0,
      angle = 0, // center angle in radians
      spread = Math.PI * 2, // full circle by default
    } = config;

    for (let i = 0; i < count; i++) {
      const a = angle - spread / 2 + Math.random() * spread;
      const speed = Utils.randomRange(speedMin, speedMax);
      const vx = Math.cos(a) * speed;
      const vy = Math.sin(a) * speed;
      const life = Utils.randomRange(lifeMin, lifeMax);
      const color = colors[Utils.randomInt(0, colors.length - 1)];
      const size = Utils.randomRange(sizeMin, sizeMax);
      this.particles.push(
        new Particle(x, y, vx, vy, life, color, size, gravity),
      );
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (this.particles[i].dead) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(
        Math.round(p.x - p.size / 2),
        Math.round(p.y - p.size / 2),
        p.size,
        p.size,
      );
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.particles = [];
  }
}
