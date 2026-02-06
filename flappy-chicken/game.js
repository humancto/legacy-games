// Flappy Chicken - Arcade Game
// Assets: 32x32 sprites, 192x240 background

const GAME_W = 288;
const GAME_H = 512;
const GRAVITY = 800;
const FLAP_FORCE = -280;
const PIPE_SPEED = 90;
const PIPE_WIDTH = 36;
const PIPE_GAP = 100;
const PIPE_SPACING = 160;
const GROUND_H = 60;
const WATER_H = 16;

// ---- Asset Loading ----
const images = {};
const imageList = [
  ["bg", "assets/bg.png"],
  ["chicken", "assets/chicken.png"],
  ["bat", "assets/bat.png"],
  ["chick", "assets/chick.png"],
  ["bomb", "assets/bomb.png"],
  ["bombExplosion", "assets/bomb-explosion.png"],
  ["explosion", "assets/explosion.png"],
  ["medusa", "assets/medusa.png"],
  ["fish", "assets/fish.png"],
  ["water1", "assets/animated-water1.png"],
  ["water2", "assets/animated-water2.png"],
  ["water3", "assets/animated-water3.png"],
  ["water4", "assets/animated-water4.png"],
  ["startScreen", "assets/start-screen.png"],
  ["instructions", "assets/instructions.png"],
  ["scrollingBg", "assets/scrolling-bg.png"],
  ["slider", "assets/slider.png"],
  ["egg", "assets/chick.png"], // reuse chick sprite for egg collectible
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

// ---- Spritesheet Frame Extraction ----
function getFrame(sheet, frameIndex, frameW, frameH) {
  return { img: sheet, sx: frameIndex * frameW, sy: 0, w: frameW, h: frameH };
}

// ---- Game Objects ----
class Chicken {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vy = 0;
    this.w = 24;
    this.h = 20;
    this.frame = 0;
    this.frameTimer = 0;
    this.alive = true;
    this.angle = 0;
    this.flapAnim = 0;
  }

  flap() {
    if (!this.alive) return;
    this.vy = FLAP_FORCE;
    this.flapAnim = 0.15;
    Audio.playTone(600, 0.05, "square");
  }

  update(dt) {
    if (!this.alive) {
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      this.angle = Math.min(Math.PI / 2, this.angle + dt * 5);
      return;
    }

    this.vy += GRAVITY * dt;
    this.y += this.vy * dt;

    // Angle based on velocity
    this.angle = Utils.clamp(this.vy / 400, -0.5, 1.2);

    // Animation
    this.flapAnim = Math.max(0, this.flapAnim - dt);
    this.frameTimer += dt;
    if (this.frameTimer > 0.1) {
      this.frameTimer = 0;
      this.frame = (this.frame + 1) % 4;
    }
  }

  draw(ctx) {
    const sheet = images.chicken;
    if (!sheet) return;
    // chicken.png is 192x32 = 6 frames, we use first 4 for flap animation
    const frameW = 32,
      frameH = 32;
    const f = getFrame(sheet, this.frame, frameW, frameH);

    ctx.save();
    ctx.translate(this.x + 16, this.y + 16);
    ctx.rotate(this.angle);
    ctx.drawImage(f.img, f.sx, f.sy, f.w, f.h, -16, -16, 32, 32);
    ctx.restore();
  }

  getRect() {
    return { x: this.x + 4, y: this.y + 6, w: this.w, h: this.h };
  }
}

class Pipe {
  constructor(x, gapY) {
    this.x = x;
    this.gapY = gapY; // center of gap
    this.w = PIPE_WIDTH;
    this.scored = false;
    this.active = true;
  }

  update(dt, speed) {
    this.x -= speed * dt;
    if (this.x + this.w < -10) this.active = false;
  }

  draw(ctx) {
    // Draw pipes as pixel art rectangles with shading
    const topH = this.gapY - PIPE_GAP / 2;
    const bottomY = this.gapY + PIPE_GAP / 2;
    const bottomH = GAME_H - GROUND_H - bottomY;

    // Top pipe
    this.drawPipe(ctx, this.x, 0, this.w, topH, true);
    // Bottom pipe
    this.drawPipe(ctx, this.x, bottomY, this.w, bottomH, false);
  }

  drawPipe(ctx, x, y, w, h, flipped) {
    // Main body
    ctx.fillStyle = "#4a8";
    ctx.fillRect(x, y, w, h);
    // Darker edge
    ctx.fillStyle = "#387";
    ctx.fillRect(x, y, 3, h);
    ctx.fillRect(x + w - 3, y, 3, h);
    // Light highlight
    ctx.fillStyle = "#5cb";
    ctx.fillRect(x + 4, y, 4, h);

    // Cap
    const capH = 8;
    const capW = w + 8;
    const capX = x - 4;
    const capY = flipped ? y + h - capH : y;
    ctx.fillStyle = "#4a8";
    ctx.fillRect(capX, capY, capW, capH);
    ctx.fillStyle = "#387";
    ctx.fillRect(capX, capY, 3, capH);
    ctx.fillRect(capX + capW - 3, capY, 3, capH);
    ctx.fillStyle = "#5cb";
    ctx.fillRect(capX + 4, capY, 4, capH);
    // Cap border
    ctx.strokeStyle = "#276";
    ctx.lineWidth = 1;
    ctx.strokeRect(capX, capY, capW, capH);
  }

  getTopRect() {
    return { x: this.x, y: 0, w: this.w, h: this.gapY - PIPE_GAP / 2 };
  }

  getBottomRect() {
    const bottomY = this.gapY + PIPE_GAP / 2;
    return { x: this.x, y: bottomY, w: this.w, h: GAME_H - GROUND_H - bottomY };
  }
}

class Bat {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.baseY = y;
    this.w = 22;
    this.h = 20;
    this.frame = 0;
    this.frameTimer = 0;
    this.time = Math.random() * Math.PI * 2;
    this.active = true;
    this.amplitude = 30 + Math.random() * 20;
    this.freq = 2 + Math.random();
  }

  update(dt, speed) {
    this.x -= speed * dt;
    this.time += dt * this.freq;
    this.y = this.baseY + Math.sin(this.time) * this.amplitude;
    this.frameTimer += dt;
    if (this.frameTimer > 0.1) {
      this.frameTimer = 0;
      this.frame = (this.frame + 1) % 4;
    }
    if (this.x + 32 < 0) this.active = false;
  }

  draw(ctx) {
    const sheet = images.bat;
    if (!sheet) return;
    const f = getFrame(sheet, this.frame, 32, 32);
    ctx.drawImage(f.img, f.sx, f.sy, f.w, f.h, this.x, this.y, 32, 32);
  }

  getRect() {
    return { x: this.x + 5, y: this.y + 6, w: this.w, h: this.h };
  }
}

class Collectible {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // "chick" or "bomb"
    this.w = 20;
    this.h = 20;
    this.frame = 0;
    this.frameTimer = 0;
    this.active = true;
    this.time = Math.random() * Math.PI * 2;
  }

  update(dt, speed) {
    this.x -= speed * dt;
    this.time += dt * 3;
    this.y += Math.sin(this.time) * 0.5;
    this.frameTimer += dt;
    if (this.frameTimer > 0.15) {
      this.frameTimer = 0;
      this.frame = (this.frame + 1) % 4;
    }
    if (this.x + 32 < 0) this.active = false;
  }

  draw(ctx) {
    const sheet = this.type === "chick" ? images.chick : images.bomb;
    if (!sheet) return;
    const frames = this.type === "chick" ? 4 : 3;
    const f = getFrame(sheet, this.frame % frames, 32, 32);
    ctx.drawImage(f.img, f.sx, f.sy, f.w, f.h, this.x, this.y, 32, 32);
  }

  getRect() {
    return { x: this.x + 6, y: this.y + 6, w: this.w, h: this.h };
  }
}

class Medusa {
  constructor() {
    this.x = GAME_W + 20;
    this.y = GAME_H / 2 - 40;
    this.targetX = GAME_W - 60;
    this.w = 26;
    this.h = 28;
    this.hp = 5;
    this.frame = 0;
    this.frameTimer = 0;
    this.active = true;
    this.entering = true;
    this.time = 0;
    this.flashTimer = 0;
  }

  update(dt) {
    if (this.entering) {
      this.x += (this.targetX - this.x) * dt * 2;
      if (Math.abs(this.x - this.targetX) < 2) this.entering = false;
    }
    this.time += dt;
    this.y = GAME_H / 2 - 40 + Math.sin(this.time * 1.5) * 60;
    this.frameTimer += dt;
    if (this.frameTimer > 0.15) {
      this.frameTimer = 0;
      this.frame = (this.frame + 1) % 4;
    }
    this.flashTimer = Math.max(0, this.flashTimer - dt);
  }

  draw(ctx) {
    const sheet = images.medusa;
    if (!sheet) return;
    const f = getFrame(sheet, this.frame, 32, 32);
    if (this.flashTimer > 0 && Math.floor(this.flashTimer * 20) % 2) {
      ctx.globalAlpha = 0.5;
    }
    ctx.drawImage(f.img, f.sx, f.sy, f.w, f.h, this.x, this.y, 32, 32);
    ctx.globalAlpha = 1;

    // Health bar
    if (!this.entering) {
      UI.drawHealthBar(
        ctx,
        this.x - 4,
        this.y - 8,
        40,
        4,
        this.hp,
        5,
        "#f0f",
        "#404",
      );
    }
  }

  hit() {
    this.hp--;
    this.flashTimer = 0.2;
    if (this.hp <= 0) {
      this.active = false;
      return true;
    }
    return false;
  }

  getRect() {
    return { x: this.x + 3, y: this.y + 2, w: this.w, h: this.h };
  }
}

class Explosion {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // "normal" or "bomb"
    this.frame = 0;
    this.frameTimer = 0;
    this.active = true;
    this.maxFrames = type === "bomb" ? 6 : 4;
  }

  update(dt) {
    this.frameTimer += dt;
    if (this.frameTimer > 0.08) {
      this.frameTimer = 0;
      this.frame++;
      if (this.frame >= this.maxFrames) this.active = false;
    }
  }

  draw(ctx) {
    const sheet =
      this.type === "bomb" ? images.bombExplosion : images.explosion;
    if (!sheet) return;
    const f = getFrame(sheet, this.frame, 32, 32);
    ctx.drawImage(f.img, f.sx, f.sy, f.w, f.h, this.x, this.y, 32, 32);
  }
}

// Fish (decorative, swimming at bottom)
class Fish {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.frame = 0;
    this.frameTimer = 0;
    this.active = true;
    this.speed = 30 + Math.random() * 30;
  }

  update(dt) {
    this.x -= this.speed * dt;
    this.frameTimer += dt;
    if (this.frameTimer > 0.2) {
      this.frameTimer = 0;
      this.frame = (this.frame + 1) % 7;
    }
    if (this.x + 32 < 0) this.active = false;
  }

  draw(ctx) {
    const sheet = images.fish;
    if (!sheet) return;
    const f = getFrame(sheet, this.frame, 32, 32);
    ctx.drawImage(f.img, f.sx, f.sy, f.w, f.h, this.x, this.y, 32, 32);
  }
}

// ---- Main Game ----
let game;

const state = {
  chicken: null,
  pipes: [],
  bats: [],
  collectibles: [],
  explosions: [],
  fishes: [],
  medusa: null,
  particles: null,
  score: 0,
  bestScore: parseInt(localStorage.getItem("flappyBest")) || 0,
  lives: 1,
  pipeTimer: 0,
  batTimer: 0,
  collectibleTimer: 0,
  fishTimer: 0,
  bgScroll: 0,
  waterFrame: 0,
  waterTimer: 0,
  speed: PIPE_SPEED,
  difficulty: 1,
  pipesPassed: 0,
  gameStarted: false,
  screenShake: 0,
  flashAlpha: 0,
  showInstructions: true,
  medusaSpawned: false,
};

function resetGame() {
  state.chicken = new Chicken(60, GAME_H / 2 - 50);
  state.pipes = [];
  state.bats = [];
  state.collectibles = [];
  state.explosions = [];
  state.fishes = [];
  state.medusa = null;
  state.particles = new ParticleEmitter();
  state.score = 0;
  state.lives = 1;
  state.pipeTimer = 0;
  state.batTimer = 0;
  state.collectibleTimer = 0;
  state.fishTimer = 0;
  state.speed = PIPE_SPEED;
  state.difficulty = 1;
  state.pipesPassed = 0;
  state.gameStarted = false;
  state.screenShake = 0;
  state.flashAlpha = 0;
  state.showInstructions = true;
  state.medusaSpawned = false;
}

function spawnPipe() {
  const minGapY = 60 + PIPE_GAP / 2;
  const maxGapY = GAME_H - GROUND_H - 60 - PIPE_GAP / 2;
  const gapY = Utils.randomRange(minGapY, maxGapY);
  state.pipes.push(new Pipe(GAME_W + 10, gapY));
}

function spawnBat() {
  const y = Utils.randomRange(40, GAME_H - GROUND_H - 80);
  state.bats.push(new Bat(GAME_W + 10, y));
}

function spawnCollectible() {
  const y = Utils.randomRange(60, GAME_H - GROUND_H - 100);
  const type = Math.random() < 0.7 ? "chick" : "bomb";
  state.collectibles.push(new Collectible(GAME_W + 10, y, type));
}

function spawnFish() {
  const y = GAME_H - GROUND_H + Utils.randomRange(5, 30);
  state.fishes.push(new Fish(GAME_W + 10, y));
}

function killChicken() {
  if (!state.chicken.alive) return;
  state.lives--;
  if (state.lives <= 0) {
    state.chicken.alive = false;
    state.screenShake = 0.3;
    state.flashAlpha = 0.6;
    Audio.playExplosion();
    state.explosions.push(
      new Explosion(state.chicken.x - 8, state.chicken.y - 8, "normal"),
    );
    state.particles.emit(state.chicken.x + 16, state.chicken.y + 16, {
      count: 20,
      speed: 150,
      colors: ["#ff0", "#f80", "#f00", "#fff"],
      life: 0.6,
      gravity: 200,
    });
  }
}

function getDifficultyGap() {
  // Gap shrinks with difficulty
  return Math.max(70, PIPE_GAP - state.difficulty * 3);
}

// ---- State Machine ----
const sm = new StateMachine();

sm.add("loading", {
  enter() {},
  update() {},
  render(ctx) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    const pct = loadedCount / totalAssets;
    UI.drawCenteredText(ctx, "Loading...", GAME_W, GAME_H / 2 - 20, {
      font: "12px monospace",
      color: "#fff",
    });
    ctx.fillStyle = "#333";
    ctx.fillRect(GAME_W / 4, GAME_H / 2, GAME_W / 2, 8);
    ctx.fillStyle = "#0f0";
    ctx.fillRect(GAME_W / 4, GAME_H / 2, (GAME_W / 2) * pct, 8);
  },
});

sm.add("menu", {
  enter() {
    resetGame();
  },
  update(dt) {
    state.bgScroll += 20 * dt;
    state.waterTimer += dt;
    if (state.waterTimer > 0.2) {
      state.waterTimer = 0;
      state.waterFrame = (state.waterFrame + 1) % 4;
    }
    if (
      Input.justPressed("Space") ||
      Input.justPressed("KeyZ") ||
      Input.justPressed("ArrowUp")
    ) {
      sm.switch("playing", game);
    }
  },
  render(ctx) {
    drawBackground(ctx);
    drawGround(ctx);
    drawWater(ctx);

    // Title
    UI.drawOverlay(ctx, GAME_W, GAME_H, 0.3);
    UI.drawCenteredText(ctx, "FLAPPY CHICKEN", GAME_W, 100, {
      font: "bold 24px monospace",
      color: "#ff0",
      outline: "#840",
    });

    // Draw chicken preview
    if (images.chicken) {
      const f = getFrame(
        images.chicken,
        Math.floor(Date.now() / 150) % 4,
        32,
        32,
      );
      ctx.drawImage(f.img, f.sx, f.sy, f.w, f.h, GAME_W / 2 - 24, 150, 48, 48);
    }

    UI.drawCenteredText(ctx, "Best: " + state.bestScore, GAME_W, 220, {
      font: "14px monospace",
      color: "#adf",
    });

    if (UI.blink(Date.now() / 1000, 2)) {
      UI.drawCenteredText(ctx, "SPACE / UP to Flap", GAME_W, 280, {
        font: "12px monospace",
        color: "#fff",
      });
    }

    UI.drawCenteredText(ctx, "Avoid pipes & bats", GAME_W, 320, {
      font: "10px monospace",
      color: "#8af",
    });
    UI.drawCenteredText(ctx, "Collect chicks +50pts", GAME_W, 340, {
      font: "10px monospace",
      color: "#ff0",
    });
    UI.drawCenteredText(ctx, "Watch out for bombs!", GAME_W, 360, {
      font: "10px monospace",
      color: "#f88",
    });
  },
});

sm.add("playing", {
  enter() {
    resetGame();
    state.gameStarted = true;
    state.chicken.flap();
  },
  update(dt) {
    const ch = state.chicken;

    // Flap input
    if (
      Input.justPressed("Space") ||
      Input.justPressed("KeyZ") ||
      Input.justPressed("ArrowUp")
    ) {
      ch.flap();
    }

    // Pause
    if (Input.justPressed("Escape") || Input.justPressed("KeyP")) {
      sm.switch("paused", game);
      return;
    }

    ch.update(dt);

    // Background scroll
    state.bgScroll += state.speed * 0.3 * dt;

    // Water animation
    state.waterTimer += dt;
    if (state.waterTimer > 0.2) {
      state.waterTimer = 0;
      state.waterFrame = (state.waterFrame + 1) % 4;
    }

    // Screen shake
    state.screenShake = Math.max(0, state.screenShake - dt);
    state.flashAlpha = Math.max(0, state.flashAlpha - dt * 2);

    // Speed increases with difficulty
    state.speed = PIPE_SPEED + state.difficulty * 5;
    const currentGap = getDifficultyGap();

    // Spawn pipes
    state.pipeTimer += dt;
    const pipeInterval = PIPE_SPACING / state.speed;
    if (state.pipeTimer > pipeInterval) {
      state.pipeTimer = 0;
      spawnPipe();
    }

    // Spawn bats (after passing 5 pipes)
    if (state.pipesPassed > 5) {
      state.batTimer += dt;
      if (state.batTimer > 3 + Math.random() * 2) {
        state.batTimer = 0;
        spawnBat();
      }
    }

    // Spawn collectibles
    state.collectibleTimer += dt;
    if (state.collectibleTimer > 4 + Math.random() * 3) {
      state.collectibleTimer = 0;
      spawnCollectible();
    }

    // Spawn fish (decorative)
    state.fishTimer += dt;
    if (state.fishTimer > 2 + Math.random() * 3) {
      state.fishTimer = 0;
      spawnFish();
    }

    // Medusa boss every 20 pipes
    if (
      state.pipesPassed > 0 &&
      state.pipesPassed % 20 === 0 &&
      !state.medusa &&
      !state.medusaSpawned
    ) {
      state.medusa = new Medusa();
      state.medusaSpawned = true;
    }
    if (state.pipesPassed % 20 !== 0) {
      state.medusaSpawned = false;
    }

    // Update pipes
    for (const pipe of state.pipes) {
      pipe.update(dt, state.speed);

      // Score when passing pipe
      if (!pipe.scored && pipe.x + pipe.w < ch.x) {
        pipe.scored = true;
        state.score++;
        state.pipesPassed++;
        Audio.playTone(880, 0.05, "sine");

        // Increase difficulty every 10 pipes
        if (state.pipesPassed % 10 === 0) {
          state.difficulty = Math.min(10, state.difficulty + 1);
        }
      }

      // Collision with pipes
      if (ch.alive) {
        const cr = ch.getRect();
        if (
          Collision.rectRect(cr, pipe.getTopRect()) ||
          Collision.rectRect(cr, pipe.getBottomRect())
        ) {
          killChicken();
        }
      }
    }

    // Update bats
    for (const bat of state.bats) {
      bat.update(dt, state.speed * 0.8);
      if (ch.alive && Collision.rectRect(ch.getRect(), bat.getRect())) {
        killChicken();
        bat.active = false;
        state.explosions.push(new Explosion(bat.x - 4, bat.y - 4, "normal"));
      }
    }

    // Update collectibles
    for (const col of state.collectibles) {
      col.update(dt, state.speed);
      if (ch.alive && Collision.rectRect(ch.getRect(), col.getRect())) {
        col.active = false;
        if (col.type === "chick") {
          state.score += 50;
          Audio.playTone(1200, 0.08, "sine");
          state.particles.emit(col.x + 16, col.y + 16, {
            count: 8,
            speed: 80,
            colors: ["#ff0", "#ffa", "#fff"],
            life: 0.4,
          });
        } else {
          // Bomb
          killChicken();
          state.explosions.push(new Explosion(col.x - 4, col.y - 4, "bomb"));
          state.screenShake = 0.4;
          Audio.playExplosion();
        }
      }
    }

    // Update medusa
    if (state.medusa) {
      state.medusa.update(dt);
      if (
        ch.alive &&
        Collision.rectRect(ch.getRect(), state.medusa.getRect())
      ) {
        // Player hits medusa - damage medusa and bounce off
        if (state.medusa.hit()) {
          state.score += 200;
          state.explosions.push(
            new Explosion(state.medusa.x - 4, state.medusa.y - 4, "bomb"),
          );
          state.particles.emit(state.medusa.x + 16, state.medusa.y + 16, {
            count: 25,
            speed: 180,
            colors: ["#f0f", "#f8f", "#fff", "#80f"],
            life: 0.7,
            gravity: 100,
          });
          state.medusa = null;
          Audio.playExplosion();
          state.screenShake = 0.5;
        } else {
          Audio.playHit();
          state.chicken.vy = FLAP_FORCE * 0.7;
          state.medusa.flashTimer = 0.15;
        }
      }
    }

    // Update explosions
    for (const exp of state.explosions) exp.update(dt);

    // Update fish
    for (const fish of state.fishes) fish.update(dt);

    // Update particles
    state.particles.update(dt);

    // Cleanup
    state.pipes = state.pipes.filter((p) => p.active);
    state.bats = state.bats.filter((b) => b.active);
    state.collectibles = state.collectibles.filter((c) => c.active);
    state.explosions = state.explosions.filter((e) => e.active);
    state.fishes = state.fishes.filter((f) => f.active);

    // Ground and ceiling collision
    if (ch.alive) {
      if (ch.y + 32 > GAME_H - GROUND_H) {
        killChicken();
      }
      if (ch.y < -10) {
        ch.y = -10;
        ch.vy = 0;
      }
    }

    // Game over when chicken falls off screen
    if (!ch.alive && ch.y > GAME_H + 50) {
      if (state.score > state.bestScore) {
        state.bestScore = state.score;
        localStorage.setItem("flappyBest", state.bestScore);
      }
      sm.switch("gameover", game);
    }
  },
  render(ctx) {
    ctx.save();
    // Screen shake
    if (state.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * 6;
      const shakeY = (Math.random() - 0.5) * 6;
      ctx.translate(shakeX, shakeY);
    }

    drawBackground(ctx);

    // Draw pipes behind chicken
    for (const pipe of state.pipes) pipe.draw(ctx);

    // Draw collectibles
    for (const col of state.collectibles) col.draw(ctx);

    // Draw bats
    for (const bat of state.bats) bat.draw(ctx);

    // Draw medusa
    if (state.medusa) state.medusa.draw(ctx);

    // Draw chicken
    state.chicken.draw(ctx);

    // Draw explosions
    for (const exp of state.explosions) exp.draw(ctx);

    // Draw particles
    state.particles.draw(ctx);

    // Ground and water (in front)
    drawGround(ctx);
    drawWater(ctx);

    // Fish in water
    for (const fish of state.fishes) fish.draw(ctx);

    // Flash effect
    if (state.flashAlpha > 0) {
      UI.drawFlash(ctx, GAME_W, GAME_H, "#fff", state.flashAlpha);
    }

    ctx.restore();

    // HUD
    drawHUD(ctx);
  },
});

sm.add("paused", {
  update(dt) {
    if (
      Input.justPressed("Escape") ||
      Input.justPressed("KeyP") ||
      Input.justPressed("Space")
    ) {
      sm.switch("playing_resume", game);
    }
  },
  render(ctx) {
    // Draw the game state underneath
    sm.states.playing.render(ctx);
    UI.drawOverlay(ctx, GAME_W, GAME_H, 0.5);
    UI.drawCenteredText(ctx, "PAUSED", GAME_W, GAME_H / 2 - 20, {
      font: "bold 20px monospace",
      color: "#fff",
    });
    if (UI.blink(Date.now() / 1000, 2)) {
      UI.drawCenteredText(ctx, "Press ESC to resume", GAME_W, GAME_H / 2 + 20, {
        font: "12px monospace",
        color: "#aaa",
      });
    }
  },
});

// Resume state that immediately goes back to playing (to avoid re-entering playing which resets)
sm.add("playing_resume", {
  enter() {
    sm.currentName = "playing";
    sm.current = sm.states.playing;
    // Don't call enter - just resume
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
      (Input.justPressed("Space") ||
        Input.justPressed("KeyZ") ||
        Input.justPressed("Enter"))
    ) {
      sm.switch("menu", game);
    }
  },
  render(ctx) {
    drawBackground(ctx);
    drawGround(ctx);
    drawWater(ctx);

    UI.drawOverlay(ctx, GAME_W, GAME_H, 0.6);

    UI.drawCenteredText(ctx, "GAME OVER", GAME_W, 140, {
      font: "bold 24px monospace",
      color: "#f44",
    });

    UI.drawCenteredText(ctx, "Score: " + state.score, GAME_W, 200, {
      font: "bold 18px monospace",
      color: "#ff0",
    });

    UI.drawCenteredText(ctx, "Best: " + state.bestScore, GAME_W, 240, {
      font: "14px monospace",
      color: "#adf",
    });

    UI.drawCenteredText(ctx, "Pipes: " + state.pipesPassed, GAME_W, 275, {
      font: "12px monospace",
      color: "#8f8",
    });

    if (state.score >= state.bestScore && state.score > 0) {
      UI.drawCenteredText(ctx, "NEW BEST!", GAME_W, 310, {
        font: "bold 16px monospace",
        color: "#f0f",
      });
    }

    if (this.timer > 1 && UI.blink(Date.now() / 1000, 2)) {
      UI.drawCenteredText(ctx, "SPACE to restart", GAME_W, 370, {
        font: "12px monospace",
        color: "#fff",
      });
    }
  },
});

// ---- Drawing Helpers ----
function drawBackground(ctx) {
  const bg = images.bg;
  if (!bg) {
    ctx.fillStyle = "#3af";
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    return;
  }

  // Tile the background (192x240) across the screen
  const scrollX = state.bgScroll % bg.width;
  for (let x = -scrollX; x < GAME_W; x += bg.width) {
    // Fill the height - bg is 240px, canvas is 512
    ctx.drawImage(bg, x, 0, bg.width, bg.height);
    ctx.drawImage(bg, x, bg.height, bg.width, bg.height);
    ctx.drawImage(bg, x, bg.height * 2, bg.width, bg.height);
  }
}

function drawGround(ctx) {
  const groundY = GAME_H - GROUND_H;
  // Brown ground with pattern
  ctx.fillStyle = "#654321";
  ctx.fillRect(0, groundY, GAME_W, GROUND_H);

  // Grass top
  ctx.fillStyle = "#4a2";
  ctx.fillRect(0, groundY, GAME_W, 4);
  ctx.fillStyle = "#5c3";
  ctx.fillRect(0, groundY, GAME_W, 2);

  // Dirt texture lines
  ctx.fillStyle = "#543210";
  for (let y = groundY + 10; y < GAME_H; y += 12) {
    ctx.fillRect(0, y, GAME_W, 1);
  }
}

function drawWater(ctx) {
  const waterY = GAME_H - GROUND_H - WATER_H;
  const waterImgs = [
    images.water1,
    images.water2,
    images.water3,
    images.water4,
  ];
  const waterImg = waterImgs[state.waterFrame];

  if (waterImg) {
    // Tile water across the bottom above ground
    const scrollX = (state.bgScroll * 0.5) % waterImg.width;
    for (let x = -scrollX; x < GAME_W; x += waterImg.width) {
      ctx.drawImage(waterImg, x, waterY, waterImg.width, WATER_H);
    }
  } else {
    ctx.fillStyle = "#26a";
    ctx.fillRect(0, waterY, GAME_W, WATER_H);
  }
}

function drawHUD(ctx) {
  // Score (large, centered)
  UI.drawCenteredText(ctx, String(state.score), GAME_W, 20, {
    font: "bold 28px monospace",
    color: "#fff",
    outline: "#000",
    outlineWidth: 3,
  });

  // Difficulty indicator
  UI.drawText(ctx, "Lv " + state.difficulty, 8, 8, {
    font: "10px monospace",
    color: "#8f8",
  });
}

// ---- Game Init ----
game = createGame({
  width: GAME_W,
  height: GAME_H,
  init() {
    sm.switch("loading", this);
    loadAllAssets(() => {
      sm.switch("menu", this);
    });
  },
  update(dt) {
    sm.update(dt, this);
  },
  render(ctx) {
    sm.render(ctx, this);
  },
});
