// Space Shooter - Vertical Scrolling Shooter
// Canvas: 272x384 (matches background asset width)

const W = 272;
const H = 384;

const assets = new AssetLoader();
const audio = new AudioManager();
const particles = new ParticleEmitter();
const sm = new StateMachine();

// Game data
let player, bullets, enemies, explosions, stars;
let score, lives, wave, waveTimer, waveEnemies;
let selectedShip = 0;
let highScore = parseInt(localStorage.getItem("spaceShooterHigh") || "0");
let screenShake = 0;
let bossActive = false;

// ---- Asset Loading ----
async function loadAssets() {
  await assets.loadImages({
    player1: "assets/player/sprites/player1.png",
    player2: "assets/player/sprites/player2.png",
    player3: "assets/player/sprites/player3.png",
    enemy1: "assets/enemy/sprites/enemy1.png",
    enemy2: "assets/enemy/sprites/enemy2.png",
    enemy3: "assets/enemy/sprites/enemy3.png",
    enemy4: "assets/enemy/sprites/enemy4.png",
    enemy5: "assets/enemy/sprites/enemy5.png",
    asteroid: "assets/asteroids/asteroid.png",
    asteroidSmall: "assets/asteroids/asteroid-small.png",
    explosion1: "assets/explosion/sprites/explosion1.png",
    explosion2: "assets/explosion/sprites/explosion2.png",
    explosion3: "assets/explosion/sprites/explosion3.png",
    explosion4: "assets/explosion/sprites/explosion4.png",
    explosion5: "assets/explosion/sprites/explosion5.png",
    hit1: "assets/Hit/sprites/hit1.png",
    hit2: "assets/Hit/sprites/hit2.png",
    hit3: "assets/Hit/sprites/hit3.png",
    hit4: "assets/Hit/sprites/hit4.png",
    shoot1: "assets/shoot/shoot1.png",
    shoot2: "assets/shoot/shoot2.png",
    flash: "assets/flash/flash.png",
    bgBack: "assets/background/layered/bg-back.png",
    bgPlanet: "assets/background/layered/bg-planet.png",
    bgStars: "assets/background/layered/bg-stars.png",
  });

  // Load sounds
  await Promise.all([
    audio.loadSound("explosion", "assets/Sound FX/explosion.wav"),
    audio.loadSound("hit", "assets/Sound FX/hit.wav"),
    audio.loadSound("shot1", "assets/Sound FX/shot 1.wav"),
    audio.loadSound("shot2", "assets/Sound FX/shot 2.wav"),
  ]).catch(() => {});
}

// ---- Entity Classes ----
class Player {
  constructor(shipIndex) {
    this.img = assets.get(`player${shipIndex + 1}`);
    this.w = 26;
    this.h = 21;
    this.x = W / 2 - this.w / 2;
    this.y = H - 50;
    this.speed = 150;
    this.shootCooldown = new Cooldown(0.18);
    this.invincible = 0;
    this.powerLevel = 1; // 1 = single, 2 = double, 3 = triple
    this.powerTimer = 0;
  }

  update(dt, input) {
    // Movement
    if (input.left) this.x -= this.speed * dt;
    if (input.right) this.x += this.speed * dt;
    if (input.up) this.y -= this.speed * dt;
    if (input.down) this.y += this.speed * dt;
    this.x = Utils.clamp(this.x, 0, W - this.w);
    this.y = Utils.clamp(this.y, 0, H - this.h);

    this.shootCooldown.update(dt);
    if (this.invincible > 0) this.invincible -= dt;

    // Power timer
    if (this.powerLevel > 1) {
      this.powerTimer -= dt;
      if (this.powerTimer <= 0) this.powerLevel = 1;
    }

    // Shoot
    if (input.isDown("Space") || input.isDown("KeyZ")) {
      if (this.shootCooldown.fire()) {
        this.shoot();
      }
    }
  }

  shoot() {
    const bx = this.x + this.w / 2 - 3;
    const by = this.y - 4;
    if (this.powerLevel >= 3) {
      bullets.push(new Bullet(bx, by, 0, -300));
      bullets.push(new Bullet(bx - 8, by + 4, -30, -280));
      bullets.push(new Bullet(bx + 8, by + 4, 30, -280));
    } else if (this.powerLevel >= 2) {
      bullets.push(new Bullet(this.x + 3, by, 0, -300));
      bullets.push(new Bullet(this.x + this.w - 9, by, 0, -300));
    } else {
      bullets.push(new Bullet(bx, by, 0, -300));
    }
    audio.play("shot1", 0.3);
  }

  draw(ctx) {
    if (this.invincible > 0 && Math.floor(this.invincible * 10) % 2 === 0)
      return;
    ctx.drawImage(this.img, Math.round(this.x), Math.round(this.y));
  }

  get hitbox() {
    return { x: this.x + 4, y: this.y + 4, w: this.w - 8, h: this.h - 8 };
  }
}

class Bullet {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.w = 6;
    this.h = 6;
    this.dead = false;
    this.img = assets.get("shoot1");
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y < -10 || this.y > H + 10 || this.x < -10 || this.x > W + 10)
      this.dead = true;
  }

  draw(ctx) {
    ctx.drawImage(this.img, Math.round(this.x), Math.round(this.y));
  }

  get hitbox() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}

class EnemyBullet {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.w = 6;
    this.h = 6;
    this.dead = false;
    this.img = assets.get("shoot2");
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y < -10 || this.y > H + 10 || this.x < -10 || this.x > W + 10)
      this.dead = true;
  }

  draw(ctx) {
    ctx.drawImage(this.img, Math.round(this.x), Math.round(this.y));
  }

  get hitbox() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}

class Enemy {
  constructor(type, x, y, pattern) {
    this.type = type;
    this.img = assets.get(`enemy${type}`);
    this.x = x;
    this.y = y;
    this.w = 29;
    this.h = 29;
    this.pattern = pattern; // 'straight', 'sine', 'diagonal', 'swoop', 'boss'
    this.speed = 60 + type * 10;
    this.hp = type === 5 ? 30 : type >= 4 ? 3 : type >= 3 ? 2 : 1;
    this.dead = false;
    this.time = Math.random() * Math.PI * 2;
    this.startX = x;
    this.points = type === 5 ? 500 : 100 + type * 25;
    this.shootTimer = type >= 3 ? Utils.randomRange(1, 3) : 999;
    this.isBoss = type === 5;
    if (this.isBoss) {
      this.speed = 40;
      this.shootTimer = 1;
    }
  }

  update(dt) {
    this.time += dt;

    switch (this.pattern) {
      case "straight":
        this.y += this.speed * dt;
        break;
      case "sine":
        this.y += this.speed * dt;
        this.x = this.startX + Math.sin(this.time * 3) * 40;
        break;
      case "diagonal":
        this.y += this.speed * 0.7 * dt;
        this.x += this.speed * 0.5 * dt * (this.startX < W / 2 ? 1 : -1);
        break;
      case "swoop":
        this.y += this.speed * dt * (this.time < 2 ? 1 : -0.3);
        this.x = this.startX + Math.sin(this.time * 2) * 60;
        break;
      case "boss":
        // Boss moves side to side at top
        if (this.y < 40) {
          this.y += 30 * dt;
        } else {
          this.x =
            W / 2 - this.w / 2 + Math.sin(this.time * 1.5) * (W / 2 - 40);
        }
        break;
    }

    // Shooting
    this.shootTimer -= dt;
    if (this.shootTimer <= 0 && player) {
      this.shootTimer = this.isBoss
        ? Utils.randomRange(0.4, 1)
        : Utils.randomRange(2, 4);
      const angle = Utils.angleBetween(
        this.x + this.w / 2,
        this.y + this.h,
        player.x + player.w / 2,
        player.y,
      );
      const spd = 120;
      enemyBullets.push(
        new EnemyBullet(
          this.x + this.w / 2 - 3,
          this.y + this.h,
          Math.cos(angle) * spd,
          Math.sin(angle) * spd,
        ),
      );
      if (this.isBoss) {
        // Boss fires spread
        enemyBullets.push(
          new EnemyBullet(
            this.x + this.w / 2 - 3,
            this.y + this.h,
            Math.cos(angle - 0.3) * spd,
            Math.sin(angle - 0.3) * spd,
          ),
        );
        enemyBullets.push(
          new EnemyBullet(
            this.x + this.w / 2 - 3,
            this.y + this.h,
            Math.cos(angle + 0.3) * spd,
            Math.sin(angle + 0.3) * spd,
          ),
        );
      }
    }

    if (this.y > H + 30 && !this.isBoss) this.dead = true;
    this.x = Utils.clamp(this.x, 0, W - this.w);
  }

  hit(dmg) {
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.dead = true;
      score += this.points;
      spawnExplosion(this.x + this.w / 2, this.y + this.h / 2);
      audio.play("explosion", 0.5);
      screenShake = 0.15;
      // Drop power-up chance
      if (Math.random() < 0.15) {
        powerups.push(new Powerup(this.x + this.w / 2, this.y + this.h / 2));
      }
    } else {
      spawnHit(this.x + this.w / 2, this.y + this.h / 2);
      audio.play("hit", 0.4);
    }
  }

  draw(ctx) {
    ctx.drawImage(this.img, Math.round(this.x), Math.round(this.y));
    if (this.isBoss) {
      // Boss health bar
      UI.drawHealthBar(
        ctx,
        this.x - 10,
        this.y - 8,
        this.w + 20,
        4,
        this.hp,
        30,
        "#f00",
        "#400",
      );
    }
  }

  get hitbox() {
    return { x: this.x + 2, y: this.y + 2, w: this.w - 4, h: this.h - 4 };
  }
}

class Asteroid {
  constructor(x, y, small) {
    this.small = small;
    this.img = assets.get(small ? "asteroidSmall" : "asteroid");
    this.x = x;
    this.y = y;
    this.w = small ? 14 : 35;
    this.h = small ? 13 : 37;
    this.speed = Utils.randomRange(40, 80);
    this.hp = small ? 1 : 3;
    this.dead = false;
    this.rotation = 0;
    this.rotSpeed = Utils.randomRange(-3, 3);
    this.points = small ? 25 : 50;
  }

  update(dt) {
    this.y += this.speed * dt;
    this.rotation += this.rotSpeed * dt;
    if (this.y > H + 40) this.dead = true;
  }

  hit(dmg) {
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.dead = true;
      score += this.points;
      spawnExplosion(this.x + this.w / 2, this.y + this.h / 2);
      audio.play("hit", 0.3);
      // Split big asteroid
      if (!this.small) {
        for (let i = 0; i < 2; i++) {
          const a = new Asteroid(
            this.x + Utils.randomRange(-10, 10),
            this.y,
            true,
          );
          enemies.push(a);
        }
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
    ctx.rotate(this.rotation);
    ctx.drawImage(this.img, -this.w / 2, -this.h / 2);
    ctx.restore();
  }

  get hitbox() {
    return { x: this.x + 2, y: this.y + 2, w: this.w - 4, h: this.h - 4 };
  }
}

class Explosion {
  constructor(x, y) {
    this.frames = [
      assets.get("explosion1"),
      assets.get("explosion2"),
      assets.get("explosion3"),
      assets.get("explosion4"),
      assets.get("explosion5"),
    ];
    this.x = x - 16;
    this.y = y - 16;
    this.frame = 0;
    this.timer = 0;
    this.dead = false;
  }

  update(dt) {
    this.timer += dt;
    if (this.timer >= 0.06) {
      this.timer = 0;
      this.frame++;
      if (this.frame >= 5) this.dead = true;
    }
  }

  draw(ctx) {
    if (this.frame < 5) {
      ctx.drawImage(
        this.frames[this.frame],
        Math.round(this.x),
        Math.round(this.y),
      );
    }
  }
}

class HitEffect {
  constructor(x, y) {
    this.frames = [
      assets.get("hit1"),
      assets.get("hit2"),
      assets.get("hit3"),
      assets.get("hit4"),
    ];
    this.x = x - 8;
    this.y = y - 8;
    this.frame = 0;
    this.timer = 0;
    this.dead = false;
  }

  update(dt) {
    this.timer += dt;
    if (this.timer >= 0.04) {
      this.timer = 0;
      this.frame++;
      if (this.frame >= 4) this.dead = true;
    }
  }

  draw(ctx) {
    if (this.frame < 4) {
      ctx.drawImage(
        this.frames[this.frame],
        Math.round(this.x),
        Math.round(this.y),
      );
    }
  }
}

class Powerup {
  constructor(x, y) {
    this.x = x - 6;
    this.y = y;
    this.w = 12;
    this.h = 12;
    this.speed = 50;
    this.dead = false;
    this.time = 0;
  }

  update(dt) {
    this.y += this.speed * dt;
    this.time += dt;
    if (this.y > H + 20) this.dead = true;
  }

  draw(ctx) {
    // Pulsing diamond shape
    const pulse = 1 + Math.sin(this.time * 8) * 0.2;
    const s = 6 * pulse;
    ctx.save();
    ctx.translate(this.x + 6, this.y + 6);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#0ff";
    ctx.shadowColor = "#0ff";
    ctx.shadowBlur = 8;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  get hitbox() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}

// Helper spawners
let enemyBullets = [];
let powerups = [];
let hitEffects = [];

function spawnExplosion(x, y) {
  explosions.push(new Explosion(x, y));
  particles.emit({
    x,
    y,
    count: 12,
    speedMin: 30,
    speedMax: 100,
    colors: ["#ff0", "#f80", "#f00", "#fff"],
    lifeMin: 0.2,
    lifeMax: 0.5,
    sizeMin: 1,
    sizeMax: 3,
  });
}

function spawnHit(x, y) {
  hitEffects.push(new HitEffect(x, y));
}

// ---- Parallax Background ----
let bgScrollY = 0;
function drawBackground(ctx) {
  bgScrollY += 0.3;
  const imgs = [
    assets.get("bgBack"),
    assets.get("bgPlanet"),
    assets.get("bgStars"),
  ];
  const speeds = [0.2, 0.5, 1.0];
  for (let i = 0; i < 3; i++) {
    const img = imgs[i];
    if (!img) continue;
    const sy = (bgScrollY * speeds[i]) % img.height;
    ctx.drawImage(img, 0, sy - img.height, W, img.height);
    ctx.drawImage(img, 0, sy, W, img.height);
    ctx.drawImage(img, 0, sy + img.height, W, img.height);
  }
}

// ---- Wave System ----
const waves = [
  // Wave 1: Basic straight enemies
  {
    type: "enemies",
    enemies: [{ type: 1, count: 5, pattern: "straight", delay: 0.6 }],
  },
  // Wave 2: Sine wave enemies
  {
    type: "enemies",
    enemies: [{ type: 2, count: 6, pattern: "sine", delay: 0.5 }],
  },
  // Asteroid break
  { type: "asteroids", count: 8, delay: 0.4 },
  // Wave 3: Mixed
  {
    type: "enemies",
    enemies: [
      { type: 1, count: 3, pattern: "straight", delay: 0.4 },
      { type: 3, count: 3, pattern: "diagonal", delay: 0.5 },
    ],
  },
  // Wave 4: Swooping
  {
    type: "enemies",
    enemies: [
      { type: 3, count: 4, pattern: "swoop", delay: 0.6 },
      { type: 2, count: 4, pattern: "sine", delay: 0.4 },
    ],
  },
  // Asteroid break
  { type: "asteroids", count: 12, delay: 0.3 },
  // Wave 5: Heavy
  {
    type: "enemies",
    enemies: [
      { type: 4, count: 3, pattern: "straight", delay: 0.8 },
      { type: 3, count: 5, pattern: "sine", delay: 0.4 },
    ],
  },
  // Wave 6: Fast swarm
  {
    type: "enemies",
    enemies: [
      { type: 1, count: 10, pattern: "straight", delay: 0.25 },
      { type: 2, count: 5, pattern: "diagonal", delay: 0.3 },
    ],
  },
  // Wave 7: Asteroids + enemies
  {
    type: "mixed",
    asteroids: 6,
    enemies: [{ type: 4, count: 4, pattern: "swoop", delay: 0.7 }],
  },
  // Boss wave
  { type: "boss" },
];

let currentWave = 0;
let spawnQueue = [];
let spawnTimer = 0;
let waveComplete = false;
let waveClearTimer = 0;

function startWave(index) {
  if (index >= waves.length) {
    // Loop waves with harder difficulty
    index = index % waves.length;
  }
  currentWave = index;
  const w = waves[index % waves.length];
  spawnQueue = [];
  waveComplete = false;
  bossActive = false;

  if (w.type === "enemies") {
    for (const group of w.enemies) {
      for (let i = 0; i < group.count; i++) {
        spawnQueue.push({
          delay: group.delay,
          spawn: () => {
            const x = Utils.randomRange(20, W - 50);
            enemies.push(new Enemy(group.type, x, -30, group.pattern));
          },
        });
      }
    }
  } else if (w.type === "asteroids") {
    for (let i = 0; i < w.count; i++) {
      spawnQueue.push({
        delay: w.delay,
        spawn: () => {
          const x = Utils.randomRange(10, W - 40);
          const small = Math.random() < 0.4;
          enemies.push(new Asteroid(x, -40, small));
        },
      });
    }
  } else if (w.type === "mixed") {
    for (let i = 0; i < w.asteroids; i++) {
      spawnQueue.push({
        delay: 0.5,
        spawn: () =>
          enemies.push(
            new Asteroid(
              Utils.randomRange(10, W - 40),
              -40,
              Math.random() < 0.4,
            ),
          ),
      });
    }
    for (const group of w.enemies) {
      for (let i = 0; i < group.count; i++) {
        spawnQueue.push({
          delay: group.delay,
          spawn: () =>
            enemies.push(
              new Enemy(
                group.type,
                Utils.randomRange(20, W - 50),
                -30,
                group.pattern,
              ),
            ),
        });
      }
    }
  } else if (w.type === "boss") {
    bossActive = true;
    enemies.push(new Enemy(5, W / 2 - 15, -40, "boss"));
  }

  spawnTimer = 0.5; // Initial delay
}

function updateWaveSpawning(dt) {
  if (spawnQueue.length > 0) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      const item = spawnQueue.shift();
      item.spawn();
      spawnTimer = item.delay || 0.5;
    }
  }

  // Check wave complete
  if (spawnQueue.length === 0 && enemies.length === 0 && !waveComplete) {
    waveComplete = true;
    waveClearTimer = 1.5;
  }

  if (waveComplete) {
    waveClearTimer -= dt;
    if (waveClearTimer <= 0) {
      startWave(currentWave + 1);
    }
  }
}

// ---- Game States ----
sm.add("menu", {
  enter() {
    selectedShip = 0;
  },
  update(dt, game) {
    const input = game.input;
    if (input.justPressed("ArrowLeft") || input.justPressed("KeyA")) {
      selectedShip = (selectedShip + 2) % 3;
    }
    if (input.justPressed("ArrowRight") || input.justPressed("KeyD")) {
      selectedShip = (selectedShip + 1) % 3;
    }
    if (input.justPressed("Enter") || input.justPressed("Space")) {
      audio.init();
      audio.resume();
      sm.switch("playing", game);
    }
  },
  render(ctx, game) {
    drawBackground(ctx);
    UI.drawOverlay(ctx, W, H, 0.4);

    // Title
    UI.drawCenteredText(ctx, "SPACE SHOOTER", W, 60, {
      font: "bold 24px monospace",
      color: "#0ff",
    });

    // Ship selection
    UI.drawCenteredText(ctx, "SELECT YOUR SHIP", W, 130, {
      font: "10px monospace",
      color: "#aaa",
    });

    for (let i = 0; i < 3; i++) {
      const img = assets.get(`player${i + 1}`);
      const sx = W / 2 - 60 + i * 45;
      const sy = 155;
      if (i === selectedShip) {
        ctx.strokeStyle = "#0ff";
        ctx.lineWidth = 2;
        ctx.strokeRect(sx - 5, sy - 5, 36, 31);
      }
      ctx.drawImage(img, sx, sy);
    }

    // Arrow indicators
    const arrowY = 167;
    ctx.fillStyle = "#0ff";
    ctx.font = "16px monospace";
    ctx.fillText("<", W / 2 - 75, arrowY);
    ctx.fillText(">", W / 2 + 65, arrowY);

    // Controls
    const cy = 220;
    UI.drawCenteredText(ctx, "CONTROLS", W, cy, {
      font: "bold 12px monospace",
      color: "#ff0",
    });
    UI.drawCenteredText(ctx, "WASD / ARROWS - Move", W, cy + 20, {
      font: "9px monospace",
      color: "#ccc",
    });
    UI.drawCenteredText(ctx, "SPACE / Z - Shoot", W, cy + 35, {
      font: "9px monospace",
      color: "#ccc",
    });

    // High score
    UI.drawCenteredText(ctx, `HIGH SCORE: ${highScore}`, W, 300, {
      font: "10px monospace",
      color: "#f80",
    });

    // Start prompt
    if (UI.blink(game.time, 2)) {
      UI.drawCenteredText(ctx, "PRESS ENTER TO START", W, 340, {
        font: "12px monospace",
        color: "#fff",
      });
    }
  },
});

sm.add("playing", {
  enter(game) {
    player = new Player(selectedShip);
    bullets = [];
    enemies = [];
    explosions = [];
    hitEffects = [];
    enemyBullets = [];
    powerups = [];
    particles.clear();
    score = 0;
    lives = 3;
    currentWave = 0;
    bossActive = false;
    startWave(0);
  },
  update(dt, game) {
    const input = game.input;

    // Pause
    if (input.pause) {
      sm.switch("paused", game);
      return;
    }

    // Screen shake decay
    if (screenShake > 0) screenShake -= dt;

    // Player
    player.update(dt, input);

    // Bullets
    for (const b of bullets) b.update(dt);
    bullets = bullets.filter((b) => !b.dead);

    // Enemy bullets
    for (const b of enemyBullets) b.update(dt);
    enemyBullets = enemyBullets.filter((b) => !b.dead);

    // Enemies
    for (const e of enemies) e.update(dt);
    enemies = enemies.filter((e) => !e.dead);

    // Explosions
    for (const e of explosions) e.update(dt);
    explosions = explosions.filter((e) => !e.dead);

    // Hit effects
    for (const h of hitEffects) h.update(dt);
    hitEffects = hitEffects.filter((h) => !h.dead);

    // Powerups
    for (const p of powerups) p.update(dt);
    powerups = powerups.filter((p) => !p.dead);

    // Particles
    particles.update(dt);

    // Collision: bullets vs enemies
    for (const b of bullets) {
      for (const e of enemies) {
        if (!b.dead && !e.dead && Collision.rectRect(b.hitbox, e.hitbox)) {
          b.dead = true;
          e.hit(1);
        }
      }
    }

    // Collision: enemies vs player
    if (player.invincible <= 0) {
      for (const e of enemies) {
        if (!e.dead && Collision.rectRect(player.hitbox, e.hitbox)) {
          lives--;
          player.invincible = 2;
          screenShake = 0.3;
          spawnExplosion(player.x + player.w / 2, player.y + player.h / 2);
          audio.play("explosion", 0.6);
          if (lives <= 0) {
            sm.switch("gameover", game);
            return;
          }
        }
      }

      // Enemy bullets vs player
      for (const b of enemyBullets) {
        if (!b.dead && Collision.rectRect(player.hitbox, b.hitbox)) {
          b.dead = true;
          lives--;
          player.invincible = 2;
          screenShake = 0.3;
          spawnHit(player.x + player.w / 2, player.y + player.h / 2);
          audio.play("hit", 0.6);
          if (lives <= 0) {
            sm.switch("gameover", game);
            return;
          }
        }
      }
    }

    // Collision: powerups vs player
    for (const p of powerups) {
      if (!p.dead && Collision.rectRect(player.hitbox, p.hitbox)) {
        p.dead = true;
        player.powerLevel = Math.min(3, player.powerLevel + 1);
        player.powerTimer = 10;
        audio.playPickup();
      }
    }

    // Wave management
    updateWaveSpawning(dt);
  },
  render(ctx, game) {
    // Apply screen shake
    if (screenShake > 0) {
      ctx.save();
      ctx.translate(Utils.randomRange(-2, 2), Utils.randomRange(-2, 2));
    }

    drawBackground(ctx);

    // Powerups
    for (const p of powerups) p.draw(ctx);

    // Player
    player.draw(ctx);

    // Bullets
    for (const b of bullets) b.draw(ctx);

    // Enemy bullets
    ctx.globalAlpha = 0.9;
    for (const b of enemyBullets) b.draw(ctx);
    ctx.globalAlpha = 1;

    // Enemies
    for (const e of enemies) e.draw(ctx);

    // Explosions
    for (const e of explosions) e.draw(ctx);

    // Hit effects
    for (const h of hitEffects) h.draw(ctx);

    // Particles
    particles.draw(ctx);

    if (screenShake > 0) ctx.restore();

    // HUD
    UI.drawText(ctx, `SCORE: ${score}`, 4, 4, { font: "10px monospace" });
    UI.drawText(ctx, `WAVE ${currentWave + 1}`, W - 4, 4, {
      font: "10px monospace",
      align: "right",
    });

    // Lives as ship icons
    for (let i = 0; i < lives; i++) {
      ctx.drawImage(
        assets.get(`player${selectedShip + 1}`),
        4 + i * 20,
        18,
        16,
        13,
      );
    }

    // Power level indicator
    if (player.powerLevel > 1) {
      const pw = player.powerLevel === 3 ? "TRIPLE" : "DOUBLE";
      UI.drawText(ctx, pw, W / 2, H - 14, {
        font: "8px monospace",
        color: "#0ff",
        align: "center",
      });
    }

    // Wave clear message
    if (waveComplete && waveClearTimer > 0.5) {
      UI.drawCenteredText(ctx, "WAVE CLEAR!", W, H / 2 - 10, {
        font: "bold 16px monospace",
        color: "#0f0",
      });
    }
  },
});

sm.add("paused", {
  update(dt, game) {
    if (game.input.pause || game.input.confirm) {
      sm.switch("playing", game);
    }
  },
  render(ctx, game) {
    // Render the playing state behind
    sm.states.playing.render(ctx, game);
    UI.drawOverlay(ctx, W, H, 0.6);
    UI.drawCenteredText(ctx, "PAUSED", W, H / 2 - 20, {
      font: "bold 20px monospace",
      color: "#fff",
    });
    UI.drawCenteredText(ctx, "Press ESC to resume", W, H / 2 + 10, {
      font: "10px monospace",
      color: "#aaa",
    });
  },
});

sm.add("gameover", {
  enter(game) {
    if (score > highScore) {
      highScore = score;
      localStorage.setItem("spaceShooterHigh", String(highScore));
    }
  },
  update(dt, game) {
    if (game.input.confirm) {
      sm.switch("menu", game);
    }
  },
  render(ctx, game) {
    drawBackground(ctx);
    UI.drawOverlay(ctx, W, H, 0.6);
    UI.drawCenteredText(ctx, "GAME OVER", W, H / 2 - 60, {
      font: "bold 24px monospace",
      color: "#f00",
    });
    UI.drawCenteredText(ctx, `SCORE: ${score}`, W, H / 2 - 20, {
      font: "14px monospace",
      color: "#fff",
    });
    UI.drawCenteredText(ctx, `HIGH SCORE: ${highScore}`, W, H / 2 + 10, {
      font: "10px monospace",
      color: "#f80",
    });
    UI.drawCenteredText(ctx, `WAVE ${currentWave + 1}`, W, H / 2 + 30, {
      font: "10px monospace",
      color: "#aaa",
    });

    if (UI.blink(game.time, 2)) {
      UI.drawCenteredText(ctx, "PRESS ENTER TO RESTART", W, H / 2 + 70, {
        font: "10px monospace",
        color: "#fff",
      });
    }
  },
});

// ---- Loading & Start ----
sm.add("loading", {
  update(dt, game) {},
  render(ctx, game) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    UI.drawCenteredText(ctx, "LOADING...", W, H / 2, {
      font: "14px monospace",
      color: "#555",
    });
  },
});

loadAssets()
  .then(() => {
    const game = createGame({
      width: W,
      height: H,
      init(game) {
        sm.switch("menu", game);
      },
      update(dt, game) {
        sm.update(dt, game);
      },
      render(ctx, game) {
        sm.render(ctx, game);
      },
    });
  })
  .catch((err) => {
    console.error("Failed to load assets:", err);
  });
