// Grotto Escape - Cave Platformer
// 16x16 tile-based, side-scrolling with shooting

const GAME_W = 320;
const GAME_H = 240;
const TILE = 16;
const PLAYER_SPEED = 100;
const JUMP_FORCE = -240;
const GRAVITY = 600;
const SHOT_SPEED = 200;
const MAX_HP = 5;

// ---- Asset Loading ----
const images = {};
const sounds = {};
const imageList = [
  ["player", "assets/player.png"], // 64x32 - player spritesheet
  ["enemies", "assets/enemies.png"], // 64x48 - lizard + eye + slime
  ["items", "assets/items.png"], // 64x64 - crystals + powerups
  ["tiles", "assets/tiles.png"], // 128x80 - tileset
  ["meter", "assets/meter.png"], // 28x42 - health meter
  ["bat", "assets/bat.png"], // 48x16 - 3 frames
  ["frog", "assets/frog.png"], // 48x16
  ["ghost", "assets/ghost.png"], // 48x16
  ["skeleton", "assets/skeleton.png"], // 64x16 - 4 frames
  ["lava", "assets/lava.png"], // 96x32 - 3 frames of 32x32
  ["water", "assets/water.png"], // 96x32
  ["torch", "assets/torch.png"], // 48x32 - 3 frames of 16x32
  ["fireball", "assets/fire-ball.png"], // 48x16 - 3 frames
  ["waterfall", "assets/waterfall.png"], // 48x16
  ["lavafall", "assets/lava-fall.png"], // 48x16
  ["bg", "assets/environment-background.png"], // 448x160
];
const soundList = [
  ["jump", "assets/jump.wav"],
  ["laser", "assets/laser.wav"],
  ["pickup", "assets/pickup.wav"],
];

let loadedCount = 0;
let totalAssets = imageList.length + soundList.length;

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
  soundList.forEach(([name, src]) => {
    Audio.load(name, src)
      .then(() => {
        loadedCount++;
        if (loadedCount >= totalAssets) callback();
      })
      .catch(() => {
        loadedCount++;
        if (loadedCount >= totalAssets) callback();
      });
  });
}

// ---- Sprite helpers ----
function drawSprite(ctx, sheet, sx, sy, sw, sh, dx, dy, flip) {
  if (!sheet) return;
  ctx.save();
  if (flip) {
    ctx.translate(dx + sw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(sheet, sx, sy, sw, sh, 0, 0, sw, sh);
  } else {
    ctx.drawImage(sheet, sx, sy, sw, sh, dx, dy, sw, sh);
  }
  ctx.restore();
}

// ---- Level Data ----
// Each level is an object with a tile map, enemy placements, and item placements
// Tiles: 0=empty, 1-40=tiles from tileset (128x80 = 8cols x 5rows = 40 tiles)
// Special: 100=lava, 101=water, 102=torch placement

const LEVELS = [];

function generateLevel(index) {
  // Procedurally generate cave levels
  const cols = 40 + index * 10; // wider levels as we progress
  const rows = 15; // 15 rows * 16px = 240px
  const map = new Array(rows * cols).fill(0);
  const enemies = [];
  const items = [];
  const decorations = [];

  // Fill borders
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < 2; y++) map[y * cols + x] = 1; // ceiling
    for (let y = rows - 2; y < rows; y++) map[y * cols + x] = 2; // floor
  }
  for (let y = 0; y < rows; y++) {
    map[y * cols] = 1;
    map[y * cols + cols - 1] = 1;
  }

  // Generate platforms and terrain
  let lastPlatY = rows - 3;
  for (let x = 3; x < cols - 3; x++) {
    // Random ground height variation
    if (Math.random() < 0.15) {
      lastPlatY = Utils.clamp(
        lastPlatY + (Math.random() < 0.5 ? -1 : 1),
        rows - 5,
        rows - 3,
      );
    }
    // Floor at lastPlatY
    for (let y = lastPlatY; y < rows; y++) {
      map[y * cols + x] = y === lastPlatY ? 3 : 2;
    }

    // Floating platforms
    if (Math.random() < 0.06 && x > 5) {
      const py = Utils.randomInt(4, rows - 6);
      const pw = Utils.randomInt(3, 6);
      for (let px = 0; px < pw && x + px < cols - 1; px++) {
        map[py * cols + x + px] = 3;
      }
      // Maybe an item on platform
      if (Math.random() < 0.5) {
        items.push({
          x: (x + 1) * TILE,
          y: (py - 1) * TILE,
          type: Math.random() < 0.7 ? "crystal" : "powerup",
        });
      }
    }

    // Gaps / pits
    if (Math.random() < 0.04 && x > 8 && x < cols - 8) {
      const gapW = Utils.randomInt(2, 4);
      for (let gx = 0; gx < gapW && x + gx < cols - 2; gx++) {
        for (let y = lastPlatY; y < rows; y++) {
          map[y * cols + x + gx] = 0;
        }
        // Lava at bottom
        map[(rows - 1) * cols + x + gx] = 100;
      }
      x += gapW;
    }

    // Enemies on ground
    if (Math.random() < 0.04 && x > 4) {
      const enemyTypes = [
        "lizard",
        "slime",
        "bat",
        "frog",
        "ghost",
        "skeleton",
      ];
      const weights = [0.25, 0.2, 0.15, 0.15, 0.1, 0.15];
      let r = Math.random(),
        cumulative = 0,
        type = "lizard";
      for (let i = 0; i < weights.length; i++) {
        cumulative += weights[i];
        if (r < cumulative) {
          type = enemyTypes[i];
          break;
        }
      }
      const ey =
        type === "bat" || type === "ghost"
          ? (lastPlatY - 4) * TILE
          : (lastPlatY - 1) * TILE;
      enemies.push({ x: x * TILE, y: ey, type });
    }

    // Ground crystals
    if (Math.random() < 0.05 && x > 3) {
      items.push({ x: x * TILE, y: (lastPlatY - 1) * TILE, type: "crystal" });
    }

    // Torches on walls
    if (Math.random() < 0.03) {
      decorations.push({
        x: x * TILE,
        y: (lastPlatY - 2) * TILE,
        type: "torch",
      });
    }
  }

  // Place exit at far right
  const exitX = (cols - 3) * TILE;
  const exitY = 3 * TILE;
  // Make sure there's a platform near exit
  for (let px = cols - 5; px < cols - 1; px++) {
    map[4 * cols + px] = 3;
  }

  return {
    cols,
    rows,
    map,
    enemies,
    items,
    decorations,
    exitX,
    exitY,
    startX: 2 * TILE,
    startY: (rows - 4) * TILE,
  };
}

// Generate 5 levels
for (let i = 0; i < 5; i++) LEVELS.push(generateLevel(i));

// ---- Game Objects ----
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.w = 12;
    this.h = 14;
    this.hp = MAX_HP;
    this.alive = true;
    this.facingRight = true;
    this.onGround = false;
    this.frame = 0;
    this.frameTimer = 0;
    this.invincible = 0;
    this.shotLevel = 1;
    this.shotCooldown = 0;
  }

  update(dt, level) {
    if (!this.alive) return;

    // Horizontal movement
    this.vx = 0;
    if (Input.left) this.vx = -PLAYER_SPEED;
    if (Input.right) this.vx = PLAYER_SPEED;
    if (this.vx !== 0) this.facingRight = this.vx > 0;

    // Jump
    if (
      this.onGround &&
      (Input.justPressed("Space") ||
        Input.justPressed("KeyZ") ||
        Input.justPressed("ArrowUp"))
    ) {
      this.vy = JUMP_FORCE;
      this.onGround = false;
      Audio.play("jump");
    }

    // Shoot
    this.shotCooldown = Math.max(0, this.shotCooldown - dt);
    if (
      (Input.justPressed("KeyX") || Input.justPressed("KeyC")) &&
      this.shotCooldown <= 0
    ) {
      this.shoot();
    }

    // Apply gravity
    this.vy += GRAVITY * dt;
    if (this.vy > 400) this.vy = 400;

    // Move and collide
    this.x += this.vx * dt;
    this.resolveCollisionX(level);
    this.y += this.vy * dt;
    this.resolveCollisionY(level);

    // Animation
    this.frameTimer += dt;
    if (Math.abs(this.vx) > 0) {
      if (this.frameTimer > 0.1) {
        this.frameTimer = 0;
        this.frame = (this.frame + 1) % 4;
      }
    } else {
      this.frame = 0;
    }

    this.invincible = Math.max(0, this.invincible - dt);
  }

  shoot() {
    const dir = this.facingRight ? 1 : -1;
    const sx = this.facingRight ? this.x + this.w : this.x - 6;
    gameState.shots.push(new Shot(sx, this.y + 4, dir, this.shotLevel));
    this.shotCooldown = 0.2;
    Audio.play("laser");
  }

  resolveCollisionX(level) {
    const { cols, rows, map } = level;
    const left = Math.floor(this.x / TILE);
    const right = Math.floor((this.x + this.w - 1) / TILE);
    const top = Math.floor(this.y / TILE);
    const bottom = Math.floor((this.y + this.h - 1) / TILE);

    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (tx < 0 || tx >= cols || ty < 0 || ty >= rows) continue;
        const tile = map[ty * cols + tx];
        if (tile > 0 && tile < 100) {
          if (this.vx > 0) this.x = tx * TILE - this.w;
          else if (this.vx < 0) this.x = (tx + 1) * TILE;
        }
      }
    }
  }

  resolveCollisionY(level) {
    const { cols, rows, map } = level;
    const left = Math.floor((this.x + 1) / TILE);
    const right = Math.floor((this.x + this.w - 2) / TILE);
    const top = Math.floor(this.y / TILE);
    const bottom = Math.floor((this.y + this.h - 1) / TILE);

    this.onGround = false;
    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (tx < 0 || tx >= cols || ty < 0 || ty >= rows) continue;
        const tile = map[ty * cols + tx];
        if (tile > 0 && tile < 100) {
          if (this.vy > 0) {
            this.y = ty * TILE - this.h;
            this.vy = 0;
            this.onGround = true;
          } else if (this.vy < 0) {
            this.y = (ty + 1) * TILE;
            this.vy = 0;
          }
        }
        // Lava = instant damage
        if (tile === 100 && this.invincible <= 0) {
          this.takeDamage(2);
        }
      }
    }
  }

  takeDamage(amount) {
    if (this.invincible > 0) return;
    this.hp -= amount;
    this.invincible = 1.0;
    Audio.playHit();
    if (this.hp <= 0) {
      this.alive = false;
      this.hp = 0;
    }
  }

  draw(ctx, camX, camY) {
    if (this.invincible > 0 && Math.floor(this.invincible * 10) % 2) return;
    const sheet = images.player;
    if (!sheet) return;
    // player.png = 64x32, organized as 4 frames of 16x16 in top row + bottom row
    // Actually 64/16=4 frames wide, 32/16=2 rows. Let's use top row = walk, frame 0=idle
    const frameW = 16,
      frameH = 16;
    const sx = this.frame * frameW;
    const sy = 0;
    drawSprite(
      ctx,
      sheet,
      sx,
      sy,
      frameW,
      frameH,
      Math.round(this.x - camX - 2),
      Math.round(this.y - camY - 2),
      !this.facingRight,
    );
  }

  getRect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}

class Shot {
  constructor(x, y, dir, level) {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.level = level;
    this.w = 8;
    this.h = 4;
    this.active = true;
    this.life = 2;
    this.frame = 0;
    this.frameTimer = 0;
  }

  update(dt) {
    this.x += this.dir * SHOT_SPEED * (1 + this.level * 0.3) * dt;
    this.life -= dt;
    if (this.life <= 0) this.active = false;
    this.frameTimer += dt;
    if (this.frameTimer > 0.05) {
      this.frameTimer = 0;
      this.frame = (this.frame + 1) % 3;
    }
  }

  draw(ctx, camX, camY) {
    // Draw as colored rectangle (shot sprites are tiny)
    const colors = ["#0ff", "#ff0", "#f0f"];
    ctx.fillStyle = colors[this.frame];
    ctx.fillRect(
      Math.round(this.x - camX),
      Math.round(this.y - camY),
      this.w,
      this.h,
    );
    ctx.fillStyle = "#fff";
    ctx.fillRect(
      Math.round(this.x - camX + 1),
      Math.round(this.y - camY + 1),
      this.w - 2,
      this.h - 2,
    );
  }

  getRect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}

class Enemy {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.vx = 0;
    this.vy = 0;
    this.w = 12;
    this.h = 12;
    this.hp = type === "skeleton" ? 3 : type === "ghost" ? 2 : 1;
    this.active = true;
    this.frame = 0;
    this.frameTimer = 0;
    this.facingRight = Math.random() < 0.5;
    this.patrolDir = this.facingRight ? 1 : -1;
    this.startX = x;
    this.time = Math.random() * Math.PI * 2;
    this.flashTimer = 0;

    // Type-specific behavior
    if (type === "bat" || type === "ghost") {
      this.baseY = y;
    }
    if (type === "frog") {
      this.jumpTimer = Math.random() * 2;
      this.onGround = true;
    }
  }

  update(dt, level, playerX, playerY) {
    this.time += dt;
    this.frameTimer += dt;
    if (this.frameTimer > 0.15) {
      this.frameTimer = 0;
      this.frame = (this.frame + 1) % this.getMaxFrames();
    }
    this.flashTimer = Math.max(0, this.flashTimer - dt);

    switch (this.type) {
      case "lizard":
      case "slime":
        this.patrol(dt, level);
        break;
      case "bat":
        this.x += this.patrolDir * 30 * dt;
        this.y = this.baseY + Math.sin(this.time * 3) * 20;
        if (Math.abs(this.x - this.startX) > 60) this.patrolDir *= -1;
        this.facingRight = this.patrolDir > 0;
        break;
      case "ghost":
        // Track player
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120 && dist > 0) {
          this.x += (dx / dist) * 35 * dt;
          this.y += (dy / dist) * 35 * dt;
          this.facingRight = dx > 0;
        } else {
          this.y = this.baseY + Math.sin(this.time * 2) * 15;
        }
        break;
      case "frog":
        this.vy += GRAVITY * 0.7 * dt;
        this.y += this.vy * dt;
        this.jumpTimer -= dt;
        // Simple ground check
        const groundY = this.getGroundY(level);
        if (this.y + this.h > groundY) {
          this.y = groundY - this.h;
          this.vy = 0;
          this.onGround = true;
        }
        if (this.onGround && this.jumpTimer <= 0) {
          this.vy = -180;
          this.onGround = false;
          this.jumpTimer = 1 + Math.random() * 2;
          this.facingRight = playerX > this.x;
          this.patrolDir = this.facingRight ? 1 : -1;
        }
        if (!this.onGround) this.x += this.patrolDir * 40 * dt;
        break;
      case "skeleton":
        this.patrol(dt, level, 25);
        break;
    }
  }

  patrol(dt, level, speed = 30) {
    this.x += this.patrolDir * speed * dt;
    this.facingRight = this.patrolDir > 0;
    // Turn at edges or walls
    const checkX = this.patrolDir > 0 ? this.x + this.w + 2 : this.x - 2;
    const tileBelow = this.getTile(level, checkX, this.y + this.h + 2);
    const tileAhead = this.getTile(level, checkX, this.y + 4);
    if (
      tileBelow <= 0 ||
      tileBelow >= 100 ||
      (tileAhead > 0 && tileAhead < 100)
    ) {
      this.patrolDir *= -1;
    }
    if (Math.abs(this.x - this.startX) > 80) this.patrolDir *= -1;
  }

  getTile(level, wx, wy) {
    const col = Math.floor(wx / TILE);
    const row = Math.floor(wy / TILE);
    if (col < 0 || col >= level.cols || row < 0 || row >= level.rows) return 1;
    return level.map[row * level.cols + col];
  }

  getGroundY(level) {
    for (let row = Math.floor(this.y / TILE); row < level.rows; row++) {
      const col = Math.floor((this.x + this.w / 2) / TILE);
      if (col >= 0 && col < level.cols) {
        const t = level.map[row * level.cols + col];
        if (t > 0 && t < 100) return row * TILE;
      }
    }
    return level.rows * TILE;
  }

  getMaxFrames() {
    switch (this.type) {
      case "skeleton":
        return 4;
      default:
        return 3;
    }
  }

  hit(damage) {
    this.hp -= damage;
    this.flashTimer = 0.15;
    if (this.hp <= 0) {
      this.active = false;
      return true;
    }
    return false;
  }

  draw(ctx, camX, camY) {
    if (this.flashTimer > 0 && Math.floor(this.flashTimer * 20) % 2) return;
    let sheet,
      frameW = 16,
      frameH = 16;

    switch (this.type) {
      case "lizard":
        sheet = images.enemies;
        this.drawFromSheet(ctx, sheet, this.frame * 16, 0, 16, 16, camX, camY);
        return;
      case "eye":
        sheet = images.enemies;
        this.drawFromSheet(ctx, sheet, this.frame * 16, 16, 16, 16, camX, camY);
        return;
      case "slime":
        sheet = images.enemies;
        this.drawFromSheet(ctx, sheet, this.frame * 16, 32, 16, 16, camX, camY);
        return;
      case "bat":
        sheet = images.bat;
        break;
      case "frog":
        sheet = images.frog;
        break;
      case "ghost":
        sheet = images.ghost;
        if (sheet) ctx.globalAlpha = 0.7;
        break;
      case "skeleton":
        sheet = images.skeleton;
        frameW = 16;
        break;
    }

    if (!sheet) {
      ctx.fillStyle = "#f00";
      ctx.fillRect(
        Math.round(this.x - camX),
        Math.round(this.y - camY),
        16,
        16,
      );
      return;
    }

    const sx = this.frame * frameW;
    drawSprite(
      ctx,
      sheet,
      sx,
      0,
      frameW,
      frameH,
      Math.round(this.x - camX - 2),
      Math.round(this.y - camY - 2),
      !this.facingRight,
    );
    ctx.globalAlpha = 1;
  }

  drawFromSheet(ctx, sheet, sx, sy, sw, sh, camX, camY) {
    if (!sheet) return;
    drawSprite(
      ctx,
      sheet,
      sx,
      sy,
      sw,
      sh,
      Math.round(this.x - camX - 2),
      Math.round(this.y - camY - 2),
      !this.facingRight,
    );
  }

  getRect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}

class Item {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // "crystal" or "powerup"
    this.w = 12;
    this.h = 12;
    this.active = true;
    this.frame = 0;
    this.frameTimer = 0;
    this.time = Math.random() * Math.PI * 2;
    this.baseY = y;
  }

  update(dt) {
    this.time += dt;
    this.y = this.baseY + Math.sin(this.time * 3) * 2;
    this.frameTimer += dt;
    const maxF = this.type === "crystal" ? 5 : 4;
    if (this.frameTimer > 0.12) {
      this.frameTimer = 0;
      this.frame = (this.frame + 1) % maxF;
    }
  }

  draw(ctx, camX, camY) {
    const sheet = images.items;
    if (!sheet) return;
    // items.png = 64x64 = 4x4 grid of 16x16
    // crystal: row 0 (5 frames in first row + wraps)
    // powerup: row 1
    let sx, sy;
    if (this.type === "crystal") {
      sx = (this.frame % 4) * 16;
      sy = this.frame >= 4 ? 16 : 0;
    } else {
      sx = (this.frame % 4) * 16;
      sy = 32;
    }
    ctx.drawImage(
      sheet,
      sx,
      sy,
      16,
      16,
      Math.round(this.x - camX - 2),
      Math.round(this.y - camY - 2),
      16,
      16,
    );
  }

  getRect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}

// ---- Game State ----
const gameState = {
  player: null,
  enemies: [],
  items: [],
  shots: [],
  particles: null,
  currentLevel: 0,
  score: 0,
  cameraX: 0,
  cameraY: 0,
  screenShake: 0,
  flashAlpha: 0,
  lavaFrame: 0,
  lavaTimer: 0,
  waterFrame: 0,
  waterTimer: 0,
  torchFrame: 0,
  torchTimer: 0,
};

function loadLevel(index) {
  const level = LEVELS[index];
  gameState.player = new Player(level.startX, level.startY);
  gameState.enemies = level.enemies.map((e) => new Enemy(e.x, e.y, e.type));
  gameState.items = level.items.map((i) => new Item(i.x, i.y, i.type));
  gameState.shots = [];
  gameState.particles = new ParticleEmitter();
  gameState.cameraX = 0;
  gameState.cameraY = 0;
}

// ---- Tile Rendering ----
function drawTiles(ctx, level, camX, camY) {
  const tileSheet = images.tiles;
  const { cols, rows, map } = level;
  const startCol = Math.max(0, Math.floor(camX / TILE));
  const startRow = Math.max(0, Math.floor(camY / TILE));
  const endCol = Math.min(cols, Math.ceil((camX + GAME_W) / TILE) + 1);
  const endRow = Math.min(rows, Math.ceil((camY + GAME_H) / TILE) + 1);

  for (let row = startRow; row < endRow; row++) {
    for (let col = startCol; col < endCol; col++) {
      const tile = map[row * cols + col];
      if (tile <= 0) continue;

      const dx = col * TILE - Math.round(camX);
      const dy = row * TILE - Math.round(camY);

      if (tile === 100) {
        // Lava
        drawAnimatedTile(
          ctx,
          images.lava,
          gameState.lavaFrame,
          32,
          32,
          dx,
          dy,
          16,
        );
        continue;
      }
      if (tile === 101) {
        // Water
        drawAnimatedTile(
          ctx,
          images.water,
          gameState.waterFrame,
          32,
          32,
          dx,
          dy,
          16,
        );
        continue;
      }

      if (tileSheet && tile < 100) {
        // tiles.png = 128x80 = 8 cols x 5 rows, tile indices 1-40
        const ti = tile - 1;
        const tsx = (ti % 8) * TILE;
        const tsy = Math.floor(ti / 8) * TILE;
        ctx.drawImage(tileSheet, tsx, tsy, TILE, TILE, dx, dy, TILE, TILE);
      } else {
        // Fallback colored tiles
        ctx.fillStyle = tile === 1 ? "#444" : tile === 2 ? "#654" : "#565";
        ctx.fillRect(dx, dy, TILE, TILE);
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(dx, dy, TILE, TILE);
      }
    }
  }
}

function drawAnimatedTile(ctx, sheet, frame, fw, fh, dx, dy, size) {
  if (sheet) {
    ctx.drawImage(sheet, frame * fw, 0, fw, fh, dx, dy, size, size);
  } else {
    ctx.fillStyle = "#f40";
    ctx.fillRect(dx, dy, size, size);
  }
}

function drawBackground(ctx, camX) {
  const bg = images.bg;
  if (bg) {
    const scrollX = camX * 0.3;
    const bgW = bg.width;
    const startX = -(scrollX % bgW);
    for (let x = startX; x < GAME_W; x += bgW) {
      ctx.drawImage(bg, x, 0, bgW, GAME_H);
    }
  } else {
    ctx.fillStyle = "#1a0a2e";
    ctx.fillRect(0, 0, GAME_W, GAME_H);
  }
}

// ---- State Machine ----
const sm = new StateMachine();
let game;

sm.add("loading", {
  enter() {},
  update() {},
  render(ctx) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    const pct = loadedCount / totalAssets;
    UI.drawCenteredText(ctx, "Loading...", GAME_W, GAME_H / 2 - 10, {
      font: "10px monospace",
      color: "#fff",
    });
    ctx.fillStyle = "#333";
    ctx.fillRect(GAME_W / 4, GAME_H / 2 + 5, GAME_W / 2, 6);
    ctx.fillStyle = "#0f0";
    ctx.fillRect(GAME_W / 4, GAME_H / 2 + 5, (GAME_W / 2) * pct, 6);
  },
});

sm.add("menu", {
  enter() {},
  update(dt) {
    if (
      Input.justPressed("Space") ||
      Input.justPressed("Enter") ||
      Input.justPressed("KeyZ")
    ) {
      gameState.currentLevel = 0;
      gameState.score = 0;
      loadLevel(0);
      sm.switch("playing", game);
    }
  },
  render(ctx) {
    ctx.fillStyle = "#1a0a2e";
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // Draw some decorative tiles
    if (images.tiles) {
      for (let x = 0; x < GAME_W; x += TILE) {
        ctx.drawImage(
          images.tiles,
          0,
          0,
          TILE,
          TILE,
          x,
          GAME_H - TILE * 2,
          TILE,
          TILE,
        );
        ctx.drawImage(
          images.tiles,
          TILE,
          0,
          TILE,
          TILE,
          x,
          GAME_H - TILE,
          TILE,
          TILE,
        );
      }
    }

    UI.drawCenteredText(ctx, "GROTTO ESCAPE", GAME_W, 40, {
      font: "bold 18px monospace",
      color: "#0ff",
      outline: "#004",
    });

    if (images.player) {
      const f = Math.floor(Date.now() / 200) % 4;
      ctx.drawImage(
        images.player,
        f * 16,
        0,
        16,
        16,
        GAME_W / 2 - 16,
        75,
        32,
        32,
      );
    }

    UI.drawCenteredText(ctx, "Arrow Keys / WASD: Move", GAME_W, 125, {
      font: "9px monospace",
      color: "#8af",
    });
    UI.drawCenteredText(ctx, "Space / Z: Jump", GAME_W, 140, {
      font: "9px monospace",
      color: "#8af",
    });
    UI.drawCenteredText(ctx, "X / C: Shoot", GAME_W, 155, {
      font: "9px monospace",
      color: "#8af",
    });

    UI.drawCenteredText(ctx, "5 Levels - Find the Exit!", GAME_W, 180, {
      font: "9px monospace",
      color: "#ff0",
    });

    if (UI.blink(Date.now() / 1000, 2)) {
      UI.drawCenteredText(ctx, "PRESS SPACE TO START", GAME_W, GAME_H - 50, {
        font: "10px monospace",
        color: "#fff",
      });
    }
  },
});

sm.add("playing", {
  update(dt) {
    const gs = gameState;
    const level = LEVELS[gs.currentLevel];
    const p = gs.player;

    // Pause
    if (Input.justPressed("Escape") || Input.justPressed("KeyP")) {
      sm.switch("paused", game);
      return;
    }

    p.update(dt, level);

    // Camera follow player
    gs.cameraX = Utils.lerp(gs.cameraX, p.x - GAME_W / 2 + 8, dt * 5);
    gs.cameraY = Utils.lerp(gs.cameraY, p.y - GAME_H / 2, dt * 5);
    gs.cameraX = Utils.clamp(gs.cameraX, 0, level.cols * TILE - GAME_W);
    gs.cameraY = Utils.clamp(gs.cameraY, 0, level.rows * TILE - GAME_H);

    // Animated tiles
    gs.lavaTimer += dt;
    if (gs.lavaTimer > 0.2) {
      gs.lavaTimer = 0;
      gs.lavaFrame = (gs.lavaFrame + 1) % 3;
    }
    gs.waterTimer += dt;
    if (gs.waterTimer > 0.25) {
      gs.waterTimer = 0;
      gs.waterFrame = (gs.waterFrame + 1) % 3;
    }
    gs.torchTimer += dt;
    if (gs.torchTimer > 0.15) {
      gs.torchTimer = 0;
      gs.torchFrame = (gs.torchFrame + 1) % 3;
    }

    // Screen effects
    gs.screenShake = Math.max(0, gs.screenShake - dt);
    gs.flashAlpha = Math.max(0, gs.flashAlpha - dt * 2);

    // Update shots
    for (const shot of gs.shots) {
      shot.update(dt);
      // Check shot vs tiles
      const col = Math.floor(shot.x / TILE);
      const row = Math.floor(shot.y / TILE);
      if (col >= 0 && col < level.cols && row >= 0 && row < level.rows) {
        const t = level.map[row * level.cols + col];
        if (t > 0 && t < 100) shot.active = false;
      }
    }

    // Update enemies
    for (const enemy of gs.enemies) {
      enemy.update(dt, level, p.x, p.y);

      // Enemy vs player
      if (
        p.alive &&
        p.invincible <= 0 &&
        Collision.rectRect(p.getRect(), enemy.getRect())
      ) {
        p.takeDamage(1);
        gs.screenShake = 0.2;
      }

      // Shots vs enemies
      for (const shot of gs.shots) {
        if (
          shot.active &&
          Collision.rectRect(shot.getRect(), enemy.getRect())
        ) {
          shot.active = false;
          if (enemy.hit(gs.player.shotLevel)) {
            gs.score += enemy.type === "skeleton" ? 200 : 100;
            gs.particles.emit(enemy.x + 6, enemy.y + 6, {
              count: 12,
              speed: 100,
              colors: ["#f80", "#ff0", "#f00"],
              life: 0.5,
              gravity: 150,
            });
            Audio.playExplosion();
          } else {
            Audio.playHit();
          }
        }
      }
    }

    // Update items
    for (const item of gs.items) {
      item.update(dt);
      if (Collision.rectRect(p.getRect(), item.getRect())) {
        item.active = false;
        if (item.type === "crystal") {
          gs.score += 50;
          Audio.play("pickup");
          gs.particles.emit(item.x + 6, item.y + 6, {
            count: 6,
            speed: 60,
            colors: ["#0ff", "#08f", "#fff"],
            life: 0.3,
          });
        } else {
          // Powerup
          if (p.hp < MAX_HP) p.hp = Math.min(MAX_HP, p.hp + 1);
          else p.shotLevel = Math.min(3, p.shotLevel + 1);
          Audio.playTone(800, 0.1, "sine");
          gs.particles.emit(item.x + 6, item.y + 6, {
            count: 10,
            speed: 80,
            colors: ["#f0f", "#ff0", "#0ff"],
            life: 0.4,
          });
        }
      }
    }

    gs.particles.update(dt);

    // Cleanup
    gs.shots = gs.shots.filter((s) => s.active);
    gs.enemies = gs.enemies.filter((e) => e.active);
    gs.items = gs.items.filter((i) => i.active);

    // Check exit
    if (
      p.alive &&
      Math.abs(p.x - level.exitX) < 20 &&
      Math.abs(p.y - level.exitY) < 20
    ) {
      if (gs.currentLevel < LEVELS.length - 1) {
        gs.currentLevel++;
        loadLevel(gs.currentLevel);
        // Keep score and shot level
        gs.player.shotLevel = p.shotLevel;
        gs.player.hp = p.hp;
        gs.score += 500; // level completion bonus
      } else {
        sm.switch("victory", game);
      }
    }

    // Death
    if (!p.alive || p.y > level.rows * TILE + 50) {
      sm.switch("gameover", game);
    }
  },

  render(ctx) {
    const gs = gameState;
    const level = LEVELS[gs.currentLevel];

    ctx.save();
    if (gs.screenShake > 0) {
      ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
    }

    drawBackground(ctx, gs.cameraX);
    drawTiles(ctx, level, gs.cameraX, gs.cameraY);

    // Draw decorations (torches)
    if (level.decorations) {
      for (const dec of level.decorations) {
        if (dec.type === "torch" && images.torch) {
          const sx = gs.torchFrame * 16;
          ctx.drawImage(
            images.torch,
            sx,
            0,
            16,
            32,
            Math.round(dec.x - gs.cameraX),
            Math.round(dec.y - gs.cameraY),
            16,
            32,
          );
        }
      }
    }

    // Draw exit
    const exitScreenX = level.exitX - gs.cameraX;
    const exitScreenY = level.exitY - gs.cameraY;
    ctx.fillStyle = `rgba(0, 255, 255, ${0.3 + Math.sin(Date.now() / 200) * 0.2})`;
    ctx.fillRect(exitScreenX, exitScreenY, 16, 16);
    ctx.strokeStyle = "#0ff";
    ctx.lineWidth = 1;
    ctx.strokeRect(exitScreenX, exitScreenY, 16, 16);
    UI.drawText(ctx, "EXIT", exitScreenX - 4, exitScreenY - 10, {
      font: "7px monospace",
      color: "#0ff",
    });

    // Items
    for (const item of gs.items) item.draw(ctx, gs.cameraX, gs.cameraY);

    // Enemies
    for (const enemy of gs.enemies) enemy.draw(ctx, gs.cameraX, gs.cameraY);

    // Shots
    for (const shot of gs.shots) shot.draw(ctx, gs.cameraX, gs.cameraY);

    // Player
    gs.player.draw(ctx, gs.cameraX, gs.cameraY);

    // Particles
    ctx.save();
    ctx.translate(-gs.cameraX, -gs.cameraY);
    gs.particles.draw(ctx);
    ctx.restore();

    if (gs.flashAlpha > 0) {
      UI.drawFlash(ctx, GAME_W, GAME_H, "#fff", gs.flashAlpha);
    }

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
      sm.switch("playing_resume", game);
    }
  },
  render(ctx) {
    sm.states.playing.render(ctx);
    UI.drawOverlay(ctx, GAME_W, GAME_H, 0.5);
    UI.drawCenteredText(ctx, "PAUSED", GAME_W, GAME_H / 2 - 10, {
      font: "bold 16px monospace",
      color: "#fff",
    });
    if (UI.blink(Date.now() / 1000, 2)) {
      UI.drawCenteredText(ctx, "ESC to resume", GAME_W, GAME_H / 2 + 15, {
        font: "9px monospace",
        color: "#aaa",
      });
    }
  },
});

sm.add("playing_resume", {
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
    ctx.fillStyle = "#1a0a2e";
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    UI.drawOverlay(ctx, GAME_W, GAME_H, 0.7);
    UI.drawCenteredText(ctx, "GAME OVER", GAME_W, GAME_H / 2 - 30, {
      font: "bold 18px monospace",
      color: "#f44",
    });
    UI.drawCenteredText(ctx, "Score: " + gameState.score, GAME_W, GAME_H / 2, {
      font: "14px monospace",
      color: "#ff0",
    });
    UI.drawCenteredText(
      ctx,
      "Level: " + (gameState.currentLevel + 1),
      GAME_W,
      GAME_H / 2 + 20,
      { font: "10px monospace", color: "#8af" },
    );
    if (this.timer > 1 && UI.blink(Date.now() / 1000, 2)) {
      UI.drawCenteredText(ctx, "SPACE to retry", GAME_W, GAME_H / 2 + 50, {
        font: "10px monospace",
        color: "#fff",
      });
    }
  },
});

sm.add("victory", {
  enter() {
    this.timer = 0;
  },
  update(dt) {
    this.timer += dt;
    if (
      this.timer > 2 &&
      (Input.justPressed("Space") || Input.justPressed("Enter"))
    ) {
      sm.switch("menu", game);
    }
  },
  render(ctx) {
    ctx.fillStyle = "#0a1a0e";
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    UI.drawCenteredText(ctx, "VICTORY!", GAME_W, 50, {
      font: "bold 22px monospace",
      color: "#0f0",
    });
    UI.drawCenteredText(ctx, "You escaped the grotto!", GAME_W, 90, {
      font: "12px monospace",
      color: "#8f8",
    });
    UI.drawCenteredText(ctx, "Final Score: " + gameState.score, GAME_W, 130, {
      font: "bold 16px monospace",
      color: "#ff0",
    });
    if (this.timer > 2 && UI.blink(Date.now() / 1000, 2)) {
      UI.drawCenteredText(ctx, "SPACE to play again", GAME_W, 180, {
        font: "10px monospace",
        color: "#fff",
      });
    }
  },
});

function drawHUD(ctx) {
  const p = gameState.player;
  // Health bar
  UI.drawHealthBar(ctx, 4, 4, 50, 6, p.hp, MAX_HP, "#0f0", "#600");

  // Score
  UI.drawText(ctx, "Score: " + gameState.score, GAME_W - 4, 4, {
    font: "8px monospace",
    color: "#ff0",
    align: "right",
  });

  // Level
  UI.drawText(ctx, "Lv " + (gameState.currentLevel + 1) + "/5", 4, 14, {
    font: "7px monospace",
    color: "#8af",
  });

  // Shot level
  if (p.shotLevel > 1) {
    UI.drawText(ctx, "Shot Lv" + p.shotLevel, 4, 24, {
      font: "7px monospace",
      color: "#f0f",
    });
  }
}

// ---- Init ----
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
