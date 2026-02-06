// Underwater Diving - Action game with 360-degree swimming
// Player: 80x80 frames, Fish enemies, Mines, Bubbles

const GAME_W = 384;
const GAME_H = 256;
const SWIM_SPEED = 120;
const FAST_SPEED = 200;
const DASH_SPEED = 350;
const FRICTION = 0.92;
const MAX_HP = 5;
const MAX_OXYGEN = 100;
const OXYGEN_DRAIN = 5; // per second
const BUBBLE_OXYGEN = 15;

// ---- Assets ----
const images = {};
const imageList = [
  ["idle", "assets/player-idle.png"], // 480x80 = 6 frames
  ["swim", "assets/player-swiming.png"], // 560x80 = 7 frames
  ["fast", "assets/player-fast.png"], // 400x80 = 5 frames
  ["hurt", "assets/player-hurt.png"], // 400x80 = 5 frames
  ["rush", "assets/player-rush.png"], // 560x80 = 7 frames
  ["fish", "assets/fish.png"], // 128x32 = 4 frames of 32x32
  ["fishBig", "assets/fish-big.png"], // 216x49 = ~4 frames of 54x49
  ["fishDart", "assets/fish-dart.png"], // 156x20 = ~4 frames of 39x20
  ["mine", "assets/mine.png"], // 45x45
  ["mineBig", "assets/mine-big.png"], // 69x69
  ["mineSmall", "assets/mine-small.png"], // 31x31
  ["bg", "assets/background.png"], // 288x256
  ["midground", "assets/midground.png"], // 960x512
  ["bubbles", "assets/bubbles.png"], // 92x40
  ["explosion", "assets/explosion.png"], // 660x82
  ["explosionSmall", "assets/explosion-small.png"], // 484x53
];

let loadedCount = 0;
let totalAssets = imageList.length;

function loadAllAssets(callback) {
  imageList.forEach(([name, src]) => {
    const img = new Image();
    img.onload = () => {
      images[name] = img;
      loadedCount++;
      if (loadedCount >= totalAssets) callback();
    };
    img.onerror = () => {
      loadedCount++;
      if (loadedCount >= totalAssets) callback();
    };
    img.src = src;
  });
}

function drawFrame(
  ctx,
  sheet,
  frameIndex,
  frameW,
  frameH,
  dx,
  dy,
  dw,
  dh,
  flip,
) {
  if (!sheet) return;
  ctx.save();
  if (flip) {
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(sheet, frameIndex * frameW, 0, frameW, frameH, 0, 0, dw, dh);
  } else {
    ctx.drawImage(
      sheet,
      frameIndex * frameW,
      0,
      frameW,
      frameH,
      dx,
      dy,
      dw,
      dh,
    );
  }
  ctx.restore();
}

// ---- Player ----
class Diver {
  constructor() {
    this.x = GAME_W / 2;
    this.y = 60;
    this.vx = 0;
    this.vy = 0;
    this.w = 40;
    this.h = 40;
    this.hp = MAX_HP;
    this.oxygen = MAX_OXYGEN;
    this.alive = true;
    this.facingRight = true;
    this.state = "idle"; // idle, swim, fast, hurt, rush
    this.frame = 0;
    this.frameTimer = 0;
    this.invincible = 0;
    this.dashCooldown = 0;
    this.dashTimer = 0;
    this.score = 0;
    this.depth = 0;
    this.maxDepth = 0;
  }

  update(dt) {
    if (!this.alive) return;

    this.invincible = Math.max(0, this.invincible - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.dashTimer = Math.max(0, this.dashTimer - dt);

    // Movement
    let ax = 0,
      ay = 0;
    if (Input.left) ax = -1;
    if (Input.right) ax = 1;
    if (Input.up) ay = -1;
    if (Input.down) ay = 1;

    // Normalize diagonal
    if (ax !== 0 && ay !== 0) {
      ax *= 0.707;
      ay *= 0.707;
    }

    // Dash (rush)
    if (
      (Input.justPressed("KeyX") || Input.justPressed("KeyC")) &&
      this.dashCooldown <= 0 &&
      (ax !== 0 || ay !== 0)
    ) {
      this.dashTimer = 0.2;
      this.dashCooldown = 1.0;
      this.vx = ax * DASH_SPEED;
      this.vy = ay * DASH_SPEED;
      Audio.playTone(300, 0.1, "sawtooth");
    }

    // Normal swimming
    const speed =
      Input.isDown("ShiftLeft") || Input.isDown("ShiftRight")
        ? FAST_SPEED
        : SWIM_SPEED;
    if (this.dashTimer <= 0) {
      this.vx += ax * speed * dt * 8;
      this.vy += ay * speed * dt * 8;
    }

    // Friction
    this.vx *= FRICTION;
    this.vy *= FRICTION;

    // Clamp speed
    const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (spd > speed && this.dashTimer <= 0) {
      this.vx = (this.vx / spd) * speed;
      this.vy = (this.vy / spd) * speed;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Keep on screen horizontally, allow vertical scrolling
    this.x = Utils.clamp(this.x, 0, GAME_W - this.w);
    if (this.y < 0) {
      this.y = 0;
      this.vy = 0;
    }

    // Depth tracking (world Y)
    this.depth = Math.max(0, Math.floor(this.y / 10));
    this.maxDepth = Math.max(this.maxDepth, this.depth);

    // Oxygen depletion
    this.oxygen -= OXYGEN_DRAIN * dt;
    if (this.oxygen <= 0) {
      this.oxygen = 0;
      this.takeDamage(1);
    }

    // Determine state
    if (this.invincible > 0 && this.hp < MAX_HP) {
      this.state = "hurt";
    } else if (this.dashTimer > 0) {
      this.state = "rush";
    } else if (spd > SWIM_SPEED * 0.8) {
      this.state = "fast";
    } else if (spd > 10) {
      this.state = "swim";
    } else {
      this.state = "idle";
    }

    if (ax !== 0) this.facingRight = ax > 0;

    // Animation
    this.frameTimer += dt;
    const frameRate = this.state === "rush" ? 0.05 : 0.1;
    if (this.frameTimer > frameRate) {
      this.frameTimer = 0;
      this.frame++;
    }
  }

  takeDamage(amount) {
    if (this.invincible > 0) return;
    this.hp -= amount;
    this.invincible = 1.0;
    Audio.playHit();
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
  }

  draw(ctx, camY) {
    if (this.invincible > 0 && Math.floor(this.invincible * 10) % 2) return;
    const sheets = {
      idle: [images.idle, 6],
      swim: [images.swim, 7],
      fast: [images.fast, 5],
      hurt: [images.hurt, 5],
      rush: [images.rush, 7],
    };
    const [sheet, maxFrames] = sheets[this.state] || sheets.idle;
    const f = this.frame % maxFrames;
    drawFrame(
      ctx,
      sheet,
      f,
      80,
      80,
      this.x - 20,
      this.y - camY - 20,
      80,
      80,
      !this.facingRight,
    );
  }

  getRect() {
    return { x: this.x + 5, y: this.y + 5, w: this.w - 10, h: this.h - 10 };
  }
}

// ---- Enemies ----
class FishEnemy {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // "fish", "big", "dart"
    this.active = true;
    this.frame = 0;
    this.frameTimer = 0;
    this.facingRight = Math.random() < 0.5;
    this.speed = type === "dart" ? 100 : type === "big" ? 40 : 60;
    this.time = Math.random() * Math.PI * 2;
    this.hp = type === "big" ? 3 : 1;
    this.baseY = y;

    switch (type) {
      case "fish":
        this.w = 24;
        this.h = 24;
        break;
      case "big":
        this.w = 40;
        this.h = 36;
        break;
      case "dart":
        this.w = 30;
        this.h = 14;
        break;
    }
  }

  update(dt) {
    this.time += dt;
    const dir = this.facingRight ? 1 : -1;
    this.x += dir * this.speed * dt;
    this.y = this.baseY + Math.sin(this.time * 2) * 15;

    this.frameTimer += dt;
    if (this.frameTimer > 0.12) {
      this.frameTimer = 0;
      this.frame = (this.frame + 1) % 4;
    }

    if (this.x < -80 || this.x > GAME_W + 80) this.active = false;
  }

  draw(ctx, camY) {
    let sheet, fw, fh, dw, dh;
    switch (this.type) {
      case "fish":
        sheet = images.fish;
        fw = 32;
        fh = 32;
        dw = 32;
        dh = 32;
        break;
      case "big":
        sheet = images.fishBig;
        fw = 54;
        fh = 49;
        dw = 54;
        dh = 49;
        break;
      case "dart":
        sheet = images.fishDart;
        fw = 39;
        fh = 20;
        dw = 39;
        dh = 20;
        break;
    }
    drawFrame(
      ctx,
      sheet,
      this.frame,
      fw,
      fh,
      this.x - dw / 4,
      this.y - camY - dh / 4,
      dw,
      dh,
      !this.facingRight,
    );
  }

  getRect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}

class Mine {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // "small", "medium", "big"
    this.active = true;
    this.time = Math.random() * Math.PI * 2;
    this.baseY = y;

    switch (type) {
      case "small":
        this.w = 20;
        this.h = 20;
        this.img = "mineSmall";
        break;
      case "medium":
        this.w = 30;
        this.h = 30;
        this.img = "mine";
        break;
      case "big":
        this.w = 45;
        this.h = 45;
        this.img = "mineBig";
        break;
    }
  }

  update(dt) {
    this.time += dt;
    this.y = this.baseY + Math.sin(this.time) * 5;
  }

  draw(ctx, camY) {
    const img = images[this.img];
    if (img) {
      ctx.drawImage(
        img,
        this.x - this.w / 4,
        this.y - camY - this.h / 4,
        this.w + this.w / 2,
        this.h + this.h / 2,
      );
    } else {
      ctx.fillStyle = "#f00";
      ctx.beginPath();
      ctx.arc(
        this.x + this.w / 2,
        this.y - camY + this.h / 2,
        this.w / 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  getRect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}

class Bubble {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 12;
    this.h = 12;
    this.active = true;
    this.time = Math.random() * Math.PI * 2;
    this.baseX = x;
  }

  update(dt) {
    this.time += dt;
    this.x = this.baseX + Math.sin(this.time * 3) * 5;
    this.y -= 15 * dt;
  }

  draw(ctx, camY) {
    const dy = this.y - camY;
    ctx.strokeStyle = "#8df";
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(this.x + 6, dy + 6, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(150, 220, 255, 0.3)";
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  getRect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}

class ExplosionFX {
  constructor(x, y, big) {
    this.x = x;
    this.y = y;
    this.big = big;
    this.frame = 0;
    this.frameTimer = 0;
    this.active = true;
    this.maxFrames = big ? 8 : 6;
  }

  update(dt) {
    this.frameTimer += dt;
    if (this.frameTimer > 0.07) {
      this.frameTimer = 0;
      this.frame++;
      if (this.frame >= this.maxFrames) this.active = false;
    }
  }

  draw(ctx, camY) {
    const sheet = this.big ? images.explosion : images.explosionSmall;
    if (!sheet) return;
    const fw = Math.floor(sheet.width / this.maxFrames);
    const fh = sheet.height;
    drawFrame(
      ctx,
      sheet,
      this.frame,
      fw,
      fh,
      this.x - fw / 2,
      this.y - camY - fh / 2,
      fw,
      fh,
      false,
    );
  }
}

// ---- Game State ----
const gs = {
  diver: null,
  enemies: [],
  mines: [],
  bubbles: [],
  explosions: [],
  particles: null,
  cameraY: 0,
  spawnTimer: 0,
  bubbleSpawnTimer: 0,
  mineSpawnTimer: 0,
  depthZone: 0,
  bestScore: parseInt(localStorage.getItem("divingBest")) || 0,
  bgScroll: 0,
};

function resetGame() {
  gs.diver = new Diver();
  gs.enemies = [];
  gs.mines = [];
  gs.bubbles = [];
  gs.explosions = [];
  gs.particles = new ParticleEmitter();
  gs.cameraY = 0;
  gs.spawnTimer = 0;
  gs.bubbleSpawnTimer = 0;
  gs.mineSpawnTimer = 0;
  gs.depthZone = 0;
}

function spawnEnemies() {
  const zone = gs.depthZone;
  const types =
    zone < 2 ? ["fish"] : zone < 4 ? ["fish", "dart"] : ["fish", "dart", "big"];
  const type = types[Utils.randomInt(0, types.length - 1)];
  const fromRight = Math.random() < 0.5;
  const x = fromRight ? GAME_W + 40 : -40;
  const y = gs.cameraY + Utils.randomRange(20, GAME_H - 40);
  const enemy = new FishEnemy(x, y, type);
  enemy.facingRight = !fromRight;
  gs.enemies.push(enemy);
}

function spawnMine() {
  const types = ["small", "medium", "big"];
  const type = types[Utils.randomInt(0, types.length - 1)];
  const x = Utils.randomRange(20, GAME_W - 60);
  const y = gs.cameraY + GAME_H + Utils.randomRange(50, 200);
  gs.mines.push(new Mine(x, y, type));
}

function spawnBubble() {
  const x = Utils.randomRange(20, GAME_W - 20);
  const y = gs.cameraY + GAME_H + Utils.randomRange(20, 100);
  gs.bubbles.push(new Bubble(x, y));
}

// ---- State Machine ----
const sm = new StateMachine();
let game;

sm.add("loading", {
  render(ctx) {
    ctx.fillStyle = "#001828";
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    const pct = loadedCount / totalAssets;
    UI.drawCenteredText(ctx, "Loading...", GAME_W, GAME_H / 2 - 10, {
      font: "12px monospace",
      color: "#8df",
    });
    ctx.fillStyle = "#123";
    ctx.fillRect(GAME_W / 4, GAME_H / 2 + 5, GAME_W / 2, 6);
    ctx.fillStyle = "#0af";
    ctx.fillRect(GAME_W / 4, GAME_H / 2 + 5, (GAME_W / 2) * pct, 6);
  },
});

sm.add("menu", {
  enter() {
    resetGame();
  },
  update(dt) {
    gs.bgScroll += 10 * dt;
    if (
      Input.justPressed("Space") ||
      Input.justPressed("Enter") ||
      Input.justPressed("KeyZ")
    ) {
      sm.switch("playing", game);
    }
  },
  render(ctx) {
    drawOceanBg(ctx, 0);
    UI.drawOverlay(ctx, GAME_W, GAME_H, 0.3);

    UI.drawCenteredText(ctx, "UNDERWATER DIVING", GAME_W, 40, {
      font: "bold 20px monospace",
      color: "#0df",
      outline: "#024",
    });

    if (images.idle) {
      const f = Math.floor(Date.now() / 150) % 6;
      drawFrame(
        ctx,
        images.idle,
        f,
        80,
        80,
        GAME_W / 2 - 40,
        70,
        80,
        80,
        false,
      );
    }

    UI.drawCenteredText(ctx, "Best Depth: " + gs.bestScore + "m", GAME_W, 165, {
      font: "12px monospace",
      color: "#8df",
    });

    UI.drawCenteredText(ctx, "WASD/Arrows: Swim", GAME_W, 190, {
      font: "9px monospace",
      color: "#6ae",
    });
    UI.drawCenteredText(ctx, "Shift: Speed Boost", GAME_W, 204, {
      font: "9px monospace",
      color: "#6ae",
    });
    UI.drawCenteredText(ctx, "X: Dash Attack", GAME_W, 218, {
      font: "9px monospace",
      color: "#6ae",
    });

    if (UI.blink(Date.now() / 1000, 2)) {
      UI.drawCenteredText(ctx, "PRESS SPACE TO DIVE", GAME_W, GAME_H - 20, {
        font: "11px monospace",
        color: "#fff",
      });
    }
  },
});

sm.add("playing", {
  enter() {
    resetGame();
  },
  update(dt) {
    const d = gs.diver;
    d.update(dt);

    // Camera follows diver downward
    const targetCamY = d.y - GAME_H * 0.35;
    gs.cameraY = Utils.lerp(gs.cameraY, Math.max(0, targetCamY), dt * 4);

    // Depth zone (every 50m)
    gs.depthZone = Math.floor(d.depth / 50);

    // Spawn enemies
    gs.spawnTimer += dt;
    const spawnRate = Math.max(0.5, 2 - gs.depthZone * 0.2);
    if (gs.spawnTimer > spawnRate) {
      gs.spawnTimer = 0;
      spawnEnemies();
    }

    // Spawn mines
    gs.mineSpawnTimer += dt;
    if (gs.mineSpawnTimer > 3 + Math.random() * 2) {
      gs.mineSpawnTimer = 0;
      spawnMine();
    }

    // Spawn oxygen bubbles
    gs.bubbleSpawnTimer += dt;
    if (gs.bubbleSpawnTimer > 2 + Math.random()) {
      gs.bubbleSpawnTimer = 0;
      spawnBubble();
    }

    // Update enemies
    for (const enemy of gs.enemies) {
      enemy.update(dt);
      if (d.alive && Collision.rectRect(d.getRect(), enemy.getRect())) {
        if (d.dashTimer > 0) {
          // Dash kills enemies
          enemy.hp--;
          if (enemy.hp <= 0) {
            enemy.active = false;
            d.score += enemy.type === "big" ? 200 : 100;
            gs.explosions.push(
              new ExplosionFX(
                enemy.x + enemy.w / 2,
                enemy.y + enemy.h / 2,
                enemy.type === "big",
              ),
            );
            gs.particles.emit(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, {
              count: 10,
              speed: 80,
              colors: ["#f80", "#ff0", "#f00"],
              life: 0.4,
              gravity: 50,
            });
            Audio.playExplosion();
          }
        } else if (d.invincible <= 0) {
          d.takeDamage(1);
        }
      }
    }

    // Update mines
    for (const mine of gs.mines) {
      mine.update(dt);
      if (
        d.alive &&
        d.invincible <= 0 &&
        Collision.rectRect(d.getRect(), mine.getRect())
      ) {
        mine.active = false;
        d.takeDamage(2);
        gs.explosions.push(
          new ExplosionFX(mine.x + mine.w / 2, mine.y + mine.h / 2, true),
        );
        gs.particles.emit(mine.x + mine.w / 2, mine.y + mine.h / 2, {
          count: 20,
          speed: 120,
          colors: ["#f00", "#f80", "#ff0", "#fff"],
          life: 0.5,
          gravity: 80,
        });
        Audio.playExplosion();
      }
    }

    // Update bubbles
    for (const bubble of gs.bubbles) {
      bubble.update(dt);
      if (d.alive && Collision.rectRect(d.getRect(), bubble.getRect())) {
        bubble.active = false;
        d.oxygen = Math.min(MAX_OXYGEN, d.oxygen + BUBBLE_OXYGEN);
        d.score += 10;
        Audio.playTone(600, 0.05, "sine");
      }
      if (bubble.y < gs.cameraY - 20) bubble.active = false;
    }

    // Update FX
    for (const exp of gs.explosions) exp.update(dt);
    gs.particles.update(dt);

    // Cleanup
    gs.enemies = gs.enemies.filter((e) => e.active);
    gs.mines = gs.mines.filter(
      (m) =>
        m.active && m.y > gs.cameraY - 100 && m.y < gs.cameraY + GAME_H + 200,
    );
    gs.bubbles = gs.bubbles.filter((b) => b.active);
    gs.explosions = gs.explosions.filter((e) => e.active);

    // Score = max depth
    d.score = Math.max(d.score, d.maxDepth);

    // Pause
    if (Input.justPressed("Escape") || Input.justPressed("KeyP")) {
      sm.switch("paused", game);
    }

    // Death
    if (!d.alive) {
      if (d.maxDepth > gs.bestScore) {
        gs.bestScore = d.maxDepth;
        localStorage.setItem("divingBest", gs.bestScore);
      }
      sm.switch("gameover", game);
    }
  },

  render(ctx) {
    drawOceanBg(ctx, gs.cameraY);

    // Mines
    for (const mine of gs.mines) mine.draw(ctx, gs.cameraY);

    // Bubbles
    for (const bubble of gs.bubbles) bubble.draw(ctx, gs.cameraY);

    // Enemies
    for (const enemy of gs.enemies) enemy.draw(ctx, gs.cameraY);

    // Diver
    gs.diver.draw(ctx, gs.cameraY);

    // Explosions
    for (const exp of gs.explosions) exp.draw(ctx, gs.cameraY);

    // Particles
    ctx.save();
    ctx.translate(0, -gs.cameraY);
    gs.particles.draw(ctx);
    ctx.restore();

    // HUD
    drawHUD(ctx);
  },
});

sm.add("paused", {
  update() {
    if (
      Input.justPressed("Escape") ||
      Input.justPressed("KeyP") ||
      Input.justPressed("Space")
    ) {
      sm.switch("resume", game);
    }
  },
  render(ctx) {
    sm.states.playing.render(ctx);
    UI.drawOverlay(ctx, GAME_W, GAME_H, 0.5);
    UI.drawCenteredText(ctx, "PAUSED", GAME_W, GAME_H / 2 - 10, {
      font: "bold 18px monospace",
      color: "#fff",
    });
  },
});

sm.add("resume", {
  enter() {
    sm.currentName = "playing";
    sm.current = sm.states.playing;
  },
});

sm.add("gameover", {
  enter() {
    this.timer = 0;
  },
  update(dt) {
    this.timer += dt;
    if (
      this.timer > 1 &&
      (Input.justPressed("Space") || Input.justPressed("Enter"))
    ) {
      sm.switch("menu", game);
    }
  },
  render(ctx) {
    drawOceanBg(ctx, 0);
    UI.drawOverlay(ctx, GAME_W, GAME_H, 0.6);
    UI.drawCenteredText(ctx, "GAME OVER", GAME_W, 60, {
      font: "bold 22px monospace",
      color: "#f44",
    });
    UI.drawCenteredText(ctx, "Depth: " + gs.diver.maxDepth + "m", GAME_W, 100, {
      font: "bold 16px monospace",
      color: "#0df",
    });
    UI.drawCenteredText(ctx, "Score: " + gs.diver.score, GAME_W, 130, {
      font: "14px monospace",
      color: "#ff0",
    });
    UI.drawCenteredText(ctx, "Best: " + gs.bestScore + "m", GAME_W, 160, {
      font: "12px monospace",
      color: "#8df",
    });
    if (gs.diver.maxDepth >= gs.bestScore && gs.diver.maxDepth > 0) {
      UI.drawCenteredText(ctx, "NEW RECORD!", GAME_W, 190, {
        font: "bold 14px monospace",
        color: "#f0f",
      });
    }
    if (this.timer > 1 && UI.blink(Date.now() / 1000, 2)) {
      UI.drawCenteredText(ctx, "SPACE to retry", GAME_W, GAME_H - 30, {
        font: "11px monospace",
        color: "#fff",
      });
    }
  },
});

// ---- Drawing ----
function drawOceanBg(ctx, camY) {
  // Depth-based color gradient
  const depthPct = Utils.clamp(camY / 3000, 0, 1);
  const r = Math.floor(Utils.lerp(0, 0, depthPct));
  const g = Math.floor(Utils.lerp(40, 5, depthPct));
  const b = Math.floor(Utils.lerp(80, 20, depthPct));
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, GAME_W, GAME_H);

  // Background layer
  const bg = images.bg;
  if (bg) {
    ctx.globalAlpha = 0.3;
    const bgScrollY = (camY * 0.1) % bg.height;
    for (let y = -bgScrollY; y < GAME_H; y += bg.height) {
      for (let x = 0; x < GAME_W; x += bg.width) {
        ctx.drawImage(bg, x, y);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Midground layer
  const mid = images.midground;
  if (mid) {
    ctx.globalAlpha = 0.2;
    const midScrollY = (camY * 0.3) % mid.height;
    ctx.drawImage(
      mid,
      0,
      -midScrollY,
      GAME_W,
      mid.height * (GAME_W / mid.width),
    );
    ctx.globalAlpha = 1;
  }

  // Light rays from surface
  if (camY < 800) {
    const rayAlpha = Utils.lerp(0.15, 0, camY / 800);
    ctx.globalAlpha = rayAlpha;
    ctx.fillStyle = "#4af";
    for (let i = 0; i < 5; i++) {
      const rx = 50 + i * 80 + Math.sin(Date.now() / 2000 + i) * 20;
      ctx.beginPath();
      ctx.moveTo(rx - 15, 0);
      ctx.lineTo(rx + 15, 0);
      ctx.lineTo(rx + 40, GAME_H);
      ctx.lineTo(rx - 40, GAME_H);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawHUD(ctx) {
  const d = gs.diver;

  // HP
  UI.drawHealthBar(ctx, 4, 4, 60, 6, d.hp, MAX_HP, "#0f0", "#600");
  UI.drawText(ctx, "HP", 4, 12, { font: "7px monospace", color: "#fff" });

  // Oxygen bar
  UI.drawHealthBar(ctx, 4, 22, 60, 6, d.oxygen, MAX_OXYGEN, "#08f", "#024");
  UI.drawText(ctx, "O2", 4, 30, { font: "7px monospace", color: "#8df" });

  // Depth
  UI.drawText(ctx, d.depth + "m", GAME_W - 4, 4, {
    font: "bold 12px monospace",
    color: "#0df",
    align: "right",
  });

  // Score
  UI.drawText(ctx, "Score: " + d.score, GAME_W - 4, 20, {
    font: "9px monospace",
    color: "#ff0",
    align: "right",
  });

  // Zone
  UI.drawText(ctx, "Zone " + (gs.depthZone + 1), GAME_W / 2, 4, {
    font: "8px monospace",
    color: "#8af",
    align: "center",
  });

  // Dash cooldown
  if (d.dashCooldown > 0) {
    UI.drawText(ctx, "Dash: " + d.dashCooldown.toFixed(1), 4, GAME_H - 12, {
      font: "7px monospace",
      color: "#888",
    });
  } else {
    UI.drawText(ctx, "Dash: READY", 4, GAME_H - 12, {
      font: "7px monospace",
      color: "#0f0",
    });
  }
}

// ---- Init ----
game = createGame({
  width: GAME_W,
  height: GAME_H,
  init() {
    sm.switch("loading", this);
    loadAllAssets(() => sm.switch("menu", this));
  },
  update(dt) {
    sm.update(dt, this);
  },
  render(ctx) {
    sm.render(ctx, this);
  },
});
