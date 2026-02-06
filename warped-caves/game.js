// Warped Caves - Run-and-Gun Platformer
// 384x240 canvas, 80x80 player frames, wall cling, shoot while running

const W = 384,
  H = 240;
const TILE = 16;
const COLS = 50,
  ROWS = 30; // 800x480 world
const GRAVITY = 0.45,
  MAX_FALL = 7;
const PLAYER_SPEED = 2.5,
  JUMP_FORCE = -7;

// Frame sizes
const PF = { w: 80, h: 80 }; // player frame
const CRAB_F = { w: 48, h: 32 };
const JUMPER_F = { w: 47, h: 32 };
const OCT_F = { w: 37, h: 37 }; // octopus: 112/3 ≈ 37

const TS_COLS = 24,
  TS_ROWS = 12; // tileset: 384x192, 16px tiles

const T_EMPTY = 0,
  T_SOLID = 1,
  T_SPIKE = 2;

let assets = {};
let canvas, ctx;
let camera = { x: 0, y: 0 };
let player, enemies, bullets, particles, pickups, enemyBullets;
let level = 1,
  maxLevel = 3;
let score = 0,
  bestScore = 0;
let levelData = [];
let screenShake = 0;
let deathTimer = 0;
let gameState = "menu";
let transitionTimer = 0;
let exitPortal = null;

// ---- Asset Loading ----
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(img);
    img.src = src;
  });
}

function drawFrame(img, fw, fh, fi, dx, dy, flip) {
  ctx.save();
  if (flip) {
    ctx.translate(dx + fw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, fi * fw, 0, fw, fh, 0, 0, fw, fh);
  } else {
    ctx.drawImage(img, fi * fw, 0, fw, fh, dx, dy, fw, fh);
  }
  ctx.restore();
}

function drawTile(ti, dx, dy) {
  if (ti <= 0) return;
  const t = ti - 1;
  const sx = (t % TS_COLS) * TILE;
  const sy = Math.floor(t / TS_COLS) * TILE;
  ctx.drawImage(assets.tileset, sx, sy, TILE, TILE, dx, dy, TILE, TILE);
}

// ---- Level Generation ----
function generateLevel(lvl) {
  const data = [];
  for (let r = 0; r < ROWS; r++) {
    data[r] = [];
    for (let c = 0; c < COLS; c++) {
      data[r][c] = { tile: 0, type: T_EMPTY };
    }
  }

  // Ground
  for (let c = 0; c < COLS; c++) {
    const gh = 2 + Math.floor(Math.sin(c * 0.15) * 1.5);
    for (let r = ROWS - gh; r < ROWS; r++) {
      const isTop = r === ROWS - gh;
      data[r][c] = { tile: isTop ? 1 : 5, type: T_SOLID };
    }
  }

  // Ceiling
  for (let c = 0; c < COLS; c++) {
    data[0][c] = { tile: 5, type: T_SOLID };
    if (Math.random() < 0.3) {
      data[1][c] = { tile: 5, type: T_SOLID };
    }
  }

  // Walls at edges
  for (let r = 0; r < ROWS; r++) {
    data[r][0] = { tile: 5, type: T_SOLID };
    data[r][COLS - 1] = { tile: 5, type: T_SOLID };
  }

  // Platforms
  const numPlat = 10 + lvl * 5;
  for (let i = 0; i < numPlat; i++) {
    const pw = randomInt(2, 6);
    const px = randomInt(2, COLS - pw - 2);
    const py = randomInt(4, ROWS - 5);
    let ok = true;
    for (let c = px; c < px + pw; c++) {
      if (data[py][c].type !== T_EMPTY) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    for (let c = px; c < px + pw; c++) {
      data[py][c] = { tile: 2, type: T_SOLID };
    }
  }

  // Vertical walls for wall-clinging
  const numWalls = 4 + lvl * 2;
  for (let i = 0; i < numWalls; i++) {
    const wx = randomInt(3, COLS - 4);
    const wy = randomInt(3, ROWS - 8);
    const wh = randomInt(3, 6);
    for (let r = wy; r < Math.min(wy + wh, ROWS - 3); r++) {
      if (data[r][wx].type === T_EMPTY) {
        data[r][wx] = { tile: 8, type: T_SOLID };
      }
    }
  }

  // Spikes
  const numSpikes = 2 + lvl * 2;
  for (let i = 0; i < numSpikes; i++) {
    const sx = randomInt(3, COLS - 3);
    for (let r = 2; r < ROWS - 1; r++) {
      if (data[r][sx].type === T_EMPTY && data[r + 1][sx].type === T_SOLID) {
        data[r][sx] = { tile: 10, type: T_SPIKE };
        break;
      }
    }
  }

  return data;
}

// ---- Collision ----
function tileAt(gx, gy) {
  const c = Math.floor(gx / TILE),
    r = Math.floor(gy / TILE);
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return T_SOLID;
  return levelData[r][c].type;
}
function isSolid(gx, gy) {
  return tileAt(gx, gy) === T_SOLID;
}
function isSpike(gx, gy) {
  return tileAt(gx, gy) === T_SPIKE;
}
function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}
function randomInt(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

// ---- Player ----
function createPlayer(x, y) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    w: 24,
    h: 36,
    ox: 28,
    oy: 38,
    facing: 1,
    grounded: false,
    state: "idle",
    frame: 0,
    frameTimer: 0,
    hp: 5,
    maxHp: 5,
    invincible: 0,
    shooting: false,
    shootTimer: 0,
    shootCooldown: 0.15,
    shootUp: false,
    ducking: false,
    clinging: false,
    clingDir: 0,
    dead: false,
  };
}

function updatePlayer(dt) {
  const p = player;
  if (p.dead) return;
  if (p.invincible > 0) p.invincible -= dt;
  if (p.shootTimer > 0) p.shootTimer -= dt;

  const left = Keyboard.isDown("ArrowLeft") || Keyboard.isDown("a");
  const right = Keyboard.isDown("ArrowRight") || Keyboard.isDown("d");
  const up = Keyboard.isDown("ArrowUp") || Keyboard.isDown("w");
  const down = Keyboard.isDown("ArrowDown") || Keyboard.isDown("s");
  const jumpPress =
    Keyboard.justPressed(" ") ||
    Keyboard.justPressed("w") ||
    Keyboard.justPressed("ArrowUp");
  const shootPress = Keyboard.isDown("z") || Keyboard.isDown("x");

  p.ducking = down && p.grounded;
  p.shootUp = up && !p.grounded;
  p.clinging = false;

  // Wall cling detection
  if (!p.grounded && p.vy > 0) {
    const wallCheckR = isSolid(p.x + p.w + 2, p.y + p.h / 2);
    const wallCheckL = isSolid(p.x - 2, p.y + p.h / 2);
    if (wallCheckR && right) {
      p.clinging = true;
      p.clingDir = 1;
    } else if (wallCheckL && left) {
      p.clinging = true;
      p.clingDir = -1;
    }
  }

  if (p.clinging) {
    p.vy = 1; // Slow slide
    p.vx = 0;
    p.facing = -p.clingDir; // Face away from wall
    // Wall jump
    if (jumpPress) {
      p.vy = JUMP_FORCE;
      p.vx = -p.clingDir * 4;
      p.clinging = false;
      Audio.playTone(500, 0.08, "square");
    }
  } else {
    // Normal movement
    if (p.ducking) {
      p.vx = 0;
    } else if (left) {
      p.vx = -PLAYER_SPEED;
      p.facing = -1;
    } else if (right) {
      p.vx = PLAYER_SPEED;
      p.facing = 1;
    } else {
      p.vx = 0;
    }

    // Jump
    if (jumpPress && p.grounded) {
      p.vy = JUMP_FORCE;
      p.grounded = false;
      Audio.playTone(400, 0.08, "square");
    }
  }

  // Shoot
  p.shooting = shootPress;
  if (shootPress && p.shootTimer <= 0) {
    p.shootTimer = p.shootCooldown;
    fireBullet();
  }

  // Physics
  p.vy += GRAVITY;
  if (p.vy > MAX_FALL) p.vy = MAX_FALL;

  p.x += p.vx;
  if (p.vx > 0) {
    if (isSolid(p.x + p.w, p.y + 2) || isSolid(p.x + p.w, p.y + p.h - 2)) {
      p.x = Math.floor((p.x + p.w) / TILE) * TILE - p.w;
      p.vx = 0;
    }
  } else if (p.vx < 0) {
    if (isSolid(p.x, p.y + 2) || isSolid(p.x, p.y + p.h - 2)) {
      p.x = Math.floor(p.x / TILE) * TILE + TILE;
      p.vx = 0;
    }
  }

  p.y += p.vy;
  p.grounded = false;
  if (p.vy > 0) {
    if (isSolid(p.x + 2, p.y + p.h) || isSolid(p.x + p.w - 2, p.y + p.h)) {
      p.y = Math.floor((p.y + p.h) / TILE) * TILE - p.h;
      p.vy = 0;
      p.grounded = true;
    }
  } else if (p.vy < 0) {
    if (isSolid(p.x + 2, p.y) || isSolid(p.x + p.w - 2, p.y)) {
      p.y = Math.floor(p.y / TILE) * TILE + TILE;
      p.vy = 0;
    }
  }

  // State
  if (p.clinging) {
    p.state = "cling";
  } else if (p.ducking) {
    p.state = "duck";
  } else if (!p.grounded) {
    p.state = "jump";
  } else if (p.shooting && Math.abs(p.vx) > 0.1) {
    p.state = "runShoot";
  } else if (Math.abs(p.vx) > 0.1) {
    p.state = "run";
  } else if (p.shootUp) {
    p.state = "shootUp";
  } else {
    p.state = p.shooting ? "stand" : "idle";
  }

  // Animate
  const anims = {
    idle: { frames: 4, speed: 0.15 },
    run: { frames: 10, speed: 0.06 },
    jump: { frames: 6, speed: 0.1 },
    stand: { frames: 3, speed: 0.12 },
    cling: { frames: 1, speed: 1 },
    duck: { frames: 1, speed: 1 },
    shootUp: { frames: 1, speed: 1 },
    hurt: { frames: 2, speed: 0.15 },
    runShoot: { frames: 10, speed: 0.06 },
  };
  const anim = anims[p.state] || anims.idle;
  p.frameTimer += dt;
  if (p.frameTimer >= anim.speed) {
    p.frameTimer = 0;
    p.frame = (p.frame + 1) % anim.frames;
  }

  // Spike check
  if (isSpike(p.x + p.w / 2, p.y + p.h - 1)) hurtPlayer(2);
  if (p.y > ROWS * TILE + 20) {
    p.hp = 0;
    p.dead = true;
  }
}

function fireBullet() {
  const p = player;
  let bvx, bvy;
  if (p.shootUp) {
    bvx = 0;
    bvy = -6;
  } else {
    bvx = p.facing * 6;
    bvy = 0;
  }
  bullets.push({
    x: p.x + p.w / 2 + (p.shootUp ? 0 : p.facing * 10),
    y: p.y + (p.shootUp ? -4 : p.h / 2 - 2),
    vx: bvx + p.vx * 0.3,
    vy: bvy,
    w: 6,
    h: 4,
    life: 1.5,
  });
  Audio.playTone(700, 0.05, "square");
}

function hurtPlayer(dmg) {
  const p = player;
  if (p.invincible > 0 || p.dead) return;
  p.hp -= dmg;
  p.invincible = 1.0;
  p.vy = -3;
  p.vx = -p.facing * 2;
  screenShake = 0.2;
  Audio.playTone(150, 0.2, "sawtooth");
  if (p.hp <= 0) {
    p.dead = true;
    p.hp = 0;
  }
}

function drawPlayer() {
  const p = player;
  if (p.dead) return;
  if (p.invincible > 0 && Math.floor(p.invincible * 10) % 2 === 0) return;

  const imgMap = {
    idle: "playerIdle",
    run: "playerRun",
    jump: "playerJump",
    stand: "playerStand",
    cling: "playerCling",
    duck: "playerDuck",
    shootUp: "playerShootUp",
    hurt: "playerHurt",
    runShoot: "playerRunShoot",
  };
  const img = assets[imgMap[p.state] || "playerIdle"];
  if (!img) return;

  const maxF = Math.floor(img.width / PF.w);
  const dx = p.x - p.ox - camera.x;
  const dy = p.y - p.oy - camera.y;
  drawFrame(img, PF.w, PF.h, p.frame % maxF, dx, dy, p.facing === -1);
}

// ---- Enemies ----
function createCrab(x, y) {
  return {
    type: "crab",
    x,
    y,
    vx: 0,
    vy: 0,
    w: 32,
    h: 24,
    ox: 8,
    oy: 6,
    fw: CRAB_F.w,
    fh: CRAB_F.h,
    facing: 1,
    grounded: false,
    state: "walk",
    frame: 0,
    frameTimer: 0,
    hp: 3,
    maxHp: 3,
    speed: 0.8,
    patrol: { left: x - 50, right: x + 50 },
    dead: false,
    deathTimer: 0,
    flashTimer: 0,
    armoredFront: true,
  };
}

function createJumper(x, y) {
  return {
    type: "jumper",
    x,
    y,
    vx: 0,
    vy: 0,
    w: 30,
    h: 24,
    ox: 8,
    oy: 6,
    fw: JUMPER_F.w,
    fh: JUMPER_F.h,
    facing: 1,
    grounded: false,
    state: "idle",
    frame: 0,
    frameTimer: 0,
    hp: 2,
    maxHp: 2,
    speed: 1.5,
    patrol: { left: x - 70, right: x + 70 },
    jumpTimer: 0,
    jumpInterval: 1.5,
    dead: false,
    deathTimer: 0,
    flashTimer: 0,
  };
}

function createOctopus(x, y) {
  return {
    type: "octopus",
    x,
    y,
    vx: 0,
    vy: 0,
    w: 28,
    h: 28,
    ox: 5,
    oy: 5,
    fw: OCT_F.w,
    fh: OCT_F.h,
    facing: 1,
    grounded: false,
    state: "idle",
    frame: 0,
    frameTimer: 0,
    hp: 2,
    maxHp: 2,
    speed: 0.6,
    patrol: { left: x - 60, right: x + 60 },
    shootTimer: 0,
    shootCooldown: 2.5,
    dead: false,
    deathTimer: 0,
    flashTimer: 0,
  };
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.dead) {
      e.deathTimer -= dt;
      if (e.deathTimer <= 0) enemies.splice(i, 1);
      continue;
    }
    if (e.flashTimer > 0) e.flashTimer -= dt;

    const dx = player.x - e.x;
    const dist = Math.abs(dx);

    if (e.type === "crab") {
      // Patrol, armored front
      e.vx = e.speed * e.facing;
      if (e.x <= e.patrol.left) {
        e.facing = 1;
      }
      if (e.x >= e.patrol.right) {
        e.facing = -1;
      }
      if (dist < 100) e.facing = dx > 0 ? 1 : -1;
      e.state = "walk";
      if (e.grounded) {
        const ahead = e.x + (e.facing > 0 ? e.w + 4 : -4);
        if (!isSolid(ahead, e.y + e.h + 4)) {
          e.facing = -e.facing;
        }
      }
    } else if (e.type === "jumper") {
      e.jumpTimer += dt;
      if (e.grounded && e.jumpTimer >= e.jumpInterval) {
        e.jumpTimer = 0;
        e.vy = -6;
        e.vx = (dx > 0 ? 1 : -1) * e.speed * 2;
        e.facing = dx > 0 ? 1 : -1;
        Audio.playTone(300, 0.05, "sine");
      }
      if (e.grounded) {
        e.vx *= 0.8;
        e.state = "idle";
      } else {
        e.state = "jump";
      }
    } else if (e.type === "octopus") {
      e.vx = e.speed * e.facing;
      if (e.x <= e.patrol.left || e.x >= e.patrol.right) e.facing = -e.facing;
      if (dist < 140) e.facing = dx > 0 ? 1 : -1;
      e.shootTimer += dt;
      if (e.shootTimer >= e.shootCooldown && dist < 150) {
        e.shootTimer = 0;
        const dir = dx > 0 ? 1 : -1;
        enemyBullets.push({
          x: e.x + e.w / 2,
          y: e.y + e.h / 2,
          vx: dir * 2.5,
          vy: 0,
          w: 6,
          h: 4,
          life: 2,
        });
        Audio.playTone(250, 0.08, "sine");
      }
      if (e.grounded) {
        const ahead = e.x + (e.facing > 0 ? e.w + 4 : -4);
        if (!isSolid(ahead, e.y + e.h + 4)) {
          e.facing = -e.facing;
        }
      }
    }

    // Physics
    e.vy += GRAVITY;
    if (e.vy > MAX_FALL) e.vy = MAX_FALL;
    e.x += e.vx;
    e.y += e.vy;
    e.grounded = false;
    if (e.vy >= 0) {
      if (isSolid(e.x + 2, e.y + e.h) || isSolid(e.x + e.w - 2, e.y + e.h)) {
        e.y = Math.floor((e.y + e.h) / TILE) * TILE - e.h;
        e.vy = 0;
        e.grounded = true;
      }
    }
    // Wall
    if (isSolid(e.x + e.w, e.y + e.h / 2) || isSolid(e.x, e.y + e.h / 2)) {
      e.vx = -e.vx;
      e.facing = -e.facing;
    }

    // Animate
    e.frameTimer += dt;
    if (e.frameTimer >= 0.12) {
      e.frameTimer = 0;
      e.frame++;
    }

    // Player collision
    if (
      !player.dead &&
      player.invincible <= 0 &&
      !e.dead &&
      rectsOverlap(player, e)
    ) {
      hurtPlayer(1);
    }
  }
}

function drawEnemies() {
  for (const e of enemies) {
    if (e.dead) {
      const img = assets.enemyDeath;
      if (img) {
        ctx.globalAlpha = e.deathTimer * 2;
        const dfi = Math.floor((0.5 - e.deathTimer) / 0.1);
        const maxF = Math.floor(img.width / 67);
        drawFrame(
          img,
          67,
          48,
          Math.min(dfi, maxF - 1),
          e.x - 18 - camera.x,
          e.y - 12 - camera.y,
          false,
        );
        ctx.globalAlpha = 1;
      }
      continue;
    }

    let imgKey, fw, fh;
    if (e.type === "crab") {
      imgKey = e.state === "walk" ? "crabWalk" : "crabIdle";
      fw = CRAB_F.w;
      fh = CRAB_F.h;
    } else if (e.type === "jumper") {
      imgKey = e.state === "jump" ? "jumperJump" : "jumperIdle";
      fw = JUMPER_F.w;
      fh = JUMPER_F.h;
    } else {
      imgKey = "octopus";
      fw = OCT_F.w;
      fh = OCT_F.h;
    }

    const img = assets[imgKey];
    if (!img) continue;

    if (e.flashTimer > 0) ctx.globalCompositeOperation = "lighter";
    const maxF = Math.max(1, Math.floor(img.width / fw));
    drawFrame(
      img,
      fw,
      fh,
      e.frame % maxF,
      e.x - e.ox - camera.x,
      e.y - e.oy - camera.y,
      e.facing === -1,
    );
    if (e.flashTimer > 0) ctx.globalCompositeOperation = "source-over";

    if (e.hp < e.maxHp) {
      const bx = e.x - camera.x;
      const by = e.y - camera.y - 5;
      ctx.fillStyle = "#300";
      ctx.fillRect(bx, by, e.w, 2);
      ctx.fillStyle = "#f00";
      ctx.fillRect(bx, by, e.w * (e.hp / e.maxHp), 2);
    }
  }
}

// ---- Bullets ----
function updateBullets(dt) {
  // Player bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    b.life -= dt;
    if (isSolid(b.x, b.y) || isSolid(b.x + b.w, b.y)) {
      spawnParticles(b.x, b.y, "#ff0", 3);
      bullets.splice(i, 1);
      continue;
    }
    if (b.life <= 0) {
      bullets.splice(i, 1);
      continue;
    }

    // Hit enemies
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (e.dead) continue;
      if (rectsOverlap(b, e)) {
        // Crab armor check: if bullet hits from front, deflect
        if (e.type === "crab" && e.armoredFront) {
          const hitFromFront =
            (b.vx > 0 && e.facing === -1) || (b.vx < 0 && e.facing === 1);
          if (hitFromFront) {
            // Deflect
            b.vx = -b.vx;
            spawnParticles(b.x, b.y, "#888", 3);
            Audio.playTone(200, 0.05, "square");
            continue;
          }
        }
        e.hp--;
        e.flashTimer = 0.12;
        score += 25;
        spawnParticles(b.x, b.y, "#ff0", 4);
        Audio.playTone(500, 0.06, "square");
        bullets.splice(i, 1);
        if (e.hp <= 0) {
          e.dead = true;
          e.deathTimer = 0.5;
          score += 100;
          Audio.playTone(600, 0.12, "square");
          spawnParticles(e.x + e.w / 2, e.y + e.h / 2, "#f80", 10);
          if (Math.random() < 0.25) {
            pickups.push({
              x: e.x,
              y: e.y,
              w: 12,
              h: 12,
              type: "health",
              timer: 8,
            });
          }
        }
        break;
      }
    }
  }

  // Enemy bullets
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    b.x += b.vx;
    b.y += b.vy;
    b.life -= dt;
    if (isSolid(b.x, b.y) || b.life <= 0) {
      enemyBullets.splice(i, 1);
      continue;
    }
    if (!player.dead && player.invincible <= 0 && rectsOverlap(b, player)) {
      hurtPlayer(1);
      enemyBullets.splice(i, 1);
    }
  }
}

function drawBullets() {
  const shotImg = assets.shot;
  for (const b of bullets) {
    if (shotImg) {
      ctx.drawImage(shotImg, 0, 0, 6, 4, b.x - camera.x, b.y - camera.y, 6, 4);
    } else {
      ctx.fillStyle = "#ff0";
      ctx.fillRect(b.x - camera.x, b.y - camera.y, 6, 3);
    }
  }
  for (const b of enemyBullets) {
    ctx.fillStyle = "#f44";
    ctx.fillRect(b.x - camera.x, b.y - camera.y, 6, 4);
  }
}

// ---- Particles ----
function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4 - 1,
      life: 0.3 + Math.random() * 0.3,
      maxLife: 0.6,
      color,
      size: 2 + Math.random() * 2,
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - camera.x, p.y - camera.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// ---- Pickups ----
function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const pk = pickups[i];
    pk.timer -= dt;
    if (pk.timer <= 0) {
      pickups.splice(i, 1);
      continue;
    }
    if (!player.dead && rectsOverlap(player, pk)) {
      if (pk.type === "health" && player.hp < player.maxHp) {
        player.hp++;
        Audio.playTone(880, 0.1, "sine");
      }
      spawnParticles(pk.x, pk.y, "#0f0", 5);
      pickups.splice(i, 1);
    }
  }
}

function drawPickups() {
  const puImg = assets.powerUp;
  for (const pk of pickups) {
    const dx = pk.x - camera.x;
    const dy = pk.y - camera.y + Math.sin(Date.now() * 0.005) * 2;
    if (puImg) {
      const fi = Math.floor(Date.now() / 100) % Math.floor(puImg.width / 23);
      ctx.drawImage(puImg, fi * 23, 0, 23, 21, dx - 5, dy - 5, 23, 21);
    } else {
      ctx.fillStyle = "#0f0";
      ctx.fillRect(dx, dy, 10, 10);
    }
  }
}

// ---- Camera ----
function updateCamera() {
  const tx = player.x + player.w / 2 - W / 2;
  const ty = player.y + player.h / 2 - H / 2;
  camera.x += (tx - camera.x) * 0.12;
  camera.y += (ty - camera.y) * 0.12;
  camera.x = Math.max(0, Math.min(COLS * TILE - W, camera.x));
  camera.y = Math.max(0, Math.min(ROWS * TILE - H, camera.y));
}

// ---- Rendering ----
function drawBackground() {
  const bg = assets.background;
  if (bg) {
    const off = -camera.x * 0.2;
    const o = ((off % bg.width) + bg.width) % bg.width;
    for (let x = -o; x < W; x += bg.width) ctx.drawImage(bg, x, H - bg.height);
  }
  const mg = assets.middleground;
  if (mg) {
    const off = -camera.x * 0.4;
    const o = ((off % mg.width) + mg.width) % mg.width;
    for (let x = -o; x < W; x += mg.width) ctx.drawImage(mg, x, H - mg.height);
  }
}

function drawTiles() {
  const sc = Math.max(0, Math.floor(camera.x / TILE));
  const ec = Math.min(COLS, sc + Math.ceil(W / TILE) + 2);
  const sr = Math.max(0, Math.floor(camera.y / TILE));
  const er = Math.min(ROWS, sr + Math.ceil(H / TILE) + 2);
  for (let r = sr; r < er; r++) {
    for (let c = sc; c < ec; c++) {
      const cell = levelData[r][c];
      if (cell.tile > 0)
        drawTile(cell.tile, c * TILE - camera.x, r * TILE - camera.y);
    }
  }
}

function drawHUD() {
  for (let i = 0; i < player.maxHp; i++) {
    ctx.fillStyle = i < player.hp ? "#0f0" : "#333";
    ctx.fillRect(8 + i * 14, 8, 10, 8);
  }
  ctx.fillStyle = "#fff";
  ctx.font = "10px monospace";
  ctx.textAlign = "right";
  ctx.fillText("SCORE: " + score, W - 8, 16);
  ctx.textAlign = "left";
  ctx.fillText("LVL " + level, 8, 26);
}

// ---- Level Setup ----
function spawnEnemies() {
  enemies = [];
  const numCrab = 3 + level * 2;
  const numJumper = 2 + level;
  const numOct = 1 + level;

  for (let i = 0; i < numCrab; i++) {
    const pos = findSpawnPos();
    if (pos) enemies.push(createCrab(pos.x, pos.y));
  }
  for (let i = 0; i < numJumper; i++) {
    const pos = findSpawnPos();
    if (pos) enemies.push(createJumper(pos.x, pos.y));
  }
  for (let i = 0; i < numOct; i++) {
    const pos = findSpawnPos();
    if (pos) enemies.push(createOctopus(pos.x, pos.y));
  }
}

function findSpawnPos() {
  for (let a = 0; a < 50; a++) {
    const c = randomInt(5, COLS - 5);
    for (let r = 2; r < ROWS - 2; r++) {
      if (
        levelData[r][c].type === T_EMPTY &&
        levelData[r + 1][c].type === T_SOLID
      ) {
        const d = Math.abs(c * TILE - player.x) + Math.abs(r * TILE - player.y);
        if (d > 100) return { x: c * TILE, y: r * TILE - 24 };
      }
    }
  }
  return null;
}

function findPlayerStart() {
  for (let c = 2; c < 10; c++) {
    for (let r = 2; r < ROWS - 1; r++) {
      if (
        levelData[r][c].type === T_EMPTY &&
        levelData[r + 1][c].type === T_SOLID
      ) {
        return { x: c * TILE, y: r * TILE - 36 };
      }
    }
  }
  return { x: 48, y: 100 };
}

function placeExitPortal() {
  for (let c = COLS - 5; c > COLS - 15; c--) {
    for (let r = 2; r < ROWS - 2; r++) {
      if (
        levelData[r][c].type === T_EMPTY &&
        levelData[r + 1][c].type === T_SOLID
      ) {
        exitPortal = { x: c * TILE, y: r * TILE - 20, w: 16, h: 20 };
        return;
      }
    }
  }
  exitPortal = { x: (COLS - 4) * TILE, y: (ROWS - 5) * TILE, w: 16, h: 20 };
}

function drawExitPortal() {
  if (!exitPortal) return;
  const dx = exitPortal.x - camera.x,
    dy = exitPortal.y - camera.y;
  const pulse = Math.sin(Date.now() * 0.005) * 0.3 + 0.7;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = "#0ff";
  ctx.fillRect(dx - 1, dy - 1, 18, 22);
  ctx.fillStyle = "#0aa";
  ctx.fillRect(dx + 2, dy + 2, 12, 16);
  ctx.fillStyle = "#fff";
  ctx.fillRect(dx + 5, dy + 5, 6, 10);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#ff0";
  ctx.font = "7px monospace";
  ctx.textAlign = "center";
  ctx.fillText("EXIT", dx + 8, dy - 4);
  ctx.textAlign = "left";
}

// ---- Game State ----
function initLevel() {
  levelData = generateLevel(level);
  const start = findPlayerStart();
  player = createPlayer(start.x, start.y);
  enemies = [];
  bullets = [];
  enemyBullets = [];
  particles = [];
  pickups = [];
  spawnEnemies();
  placeExitPortal();
  camera.x = 0;
  camera.y = 0;
}

function update(dt) {
  if (dt > 0.1) dt = 0.1;
  if (screenShake > 0) screenShake -= dt;

  if (gameState === "menu") {
    if (Keyboard.justPressed(" ") || Keyboard.justPressed("Enter")) {
      gameState = "playing";
      level = 1;
      score = 0;
      initLevel();
    }
    return;
  }
  if (gameState === "gameOver") {
    if (Keyboard.justPressed(" ") || Keyboard.justPressed("Enter"))
      gameState = "menu";
    return;
  }
  if (gameState === "levelComplete") {
    transitionTimer -= dt;
    if (transitionTimer <= 0) {
      level++;
      if (level > maxLevel) {
        if (score > bestScore) {
          bestScore = score;
          try {
            localStorage.setItem("warpedCaves_best", bestScore);
          } catch (e) {}
        }
        gameState = "gameOver";
      } else {
        initLevel();
        gameState = "playing";
      }
    }
    return;
  }

  updatePlayer(dt);
  updateEnemies(dt);
  updateBullets(dt);
  updateParticles(dt);
  updatePickups(dt);
  updateCamera();

  if (
    exitPortal &&
    !player.dead &&
    rectsOverlap(player, exitPortal) &&
    enemies.filter((e) => !e.dead).length === 0
  ) {
    gameState = "levelComplete";
    transitionTimer = 1.5;
    Audio.playTone(523, 0.2, "sine");
    setTimeout(() => Audio.playTone(659, 0.2, "sine"), 150);
    setTimeout(() => Audio.playTone(784, 0.2, "sine"), 300);
  }

  if (player.dead) {
    deathTimer += dt;
    if (deathTimer > 2) {
      if (score > bestScore) {
        bestScore = score;
        try {
          localStorage.setItem("warpedCaves_best", bestScore);
        } catch (e) {}
      }
      gameState = "gameOver";
      deathTimer = 0;
    }
  }
}

function render() {
  ctx.fillStyle = "#1a0a2e";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  if (screenShake > 0)
    ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);

  drawBackground();
  drawTiles();
  drawPickups();
  drawExitPortal();
  drawBullets();
  drawEnemies();
  drawPlayer();
  drawParticles();
  ctx.restore();

  if (gameState === "playing" || gameState === "levelComplete") {
    drawHUD();
    const alive = enemies.filter((e) => !e.dead).length;
    ctx.fillStyle = alive > 0 ? "#fff" : "#0f0";
    ctx.font = "8px monospace";
    ctx.textAlign = "right";
    ctx.fillText(alive > 0 ? "ENEMIES: " + alive : ">> EXIT >>", W - 8, 28);
    ctx.textAlign = "left";
  }

  if (gameState === "menu") drawMenuScreen();
  else if (gameState === "gameOver") drawGameOverScreen();
  else if (gameState === "levelComplete") drawLevelCompleteScreen();
}

function drawMenuScreen() {
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#0ff";
  ctx.font = "bold 18px monospace";
  ctx.fillText("WARPED CAVES", W / 2, 55);
  ctx.fillStyle = "#fff";
  ctx.font = "10px monospace";
  ctx.fillText("Run, gun, and wall-jump!", W / 2, 80);
  ctx.fillStyle = "#ff0";
  ctx.font = "9px monospace";
  ctx.fillText("ARROWS/WASD - Move & Jump", W / 2, 105);
  ctx.fillText("Z/X - Shoot", W / 2, 118);
  ctx.fillText("UP - Shoot Upward (in air)", W / 2, 131);
  ctx.fillText("Hold toward wall - Wall Cling", W / 2, 144);
  ctx.fillText("Jump from wall - Wall Jump", W / 2, 157);
  ctx.fillText("DOWN - Duck", W / 2, 170);
  if (Math.sin(Date.now() * 0.005) > 0) {
    ctx.fillStyle = "#0ff";
    ctx.fillText("PRESS SPACE TO START", W / 2, 200);
  }
  if (bestScore > 0) {
    ctx.fillStyle = "#888";
    ctx.fillText("BEST: " + bestScore, W / 2, 225);
  }
  ctx.textAlign = "left";
}

function drawGameOverScreen() {
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  if (level > maxLevel) {
    ctx.fillStyle = "#0f0";
    ctx.font = "bold 16px monospace";
    ctx.fillText("VICTORY!", W / 2, 70);
    ctx.fillStyle = "#fff";
    ctx.font = "10px monospace";
    ctx.fillText("You escaped the Warped Caves!", W / 2, 95);
  } else {
    ctx.fillStyle = "#f44";
    ctx.font = "bold 16px monospace";
    ctx.fillText("GAME OVER", W / 2, 70);
  }
  ctx.fillStyle = "#fff";
  ctx.font = "12px monospace";
  ctx.fillText("SCORE: " + score, W / 2, 130);
  if (bestScore > 0) {
    ctx.fillStyle = "#ff0";
    ctx.fillText("BEST: " + bestScore, W / 2, 150);
  }
  if (Math.sin(Date.now() * 0.005) > 0) {
    ctx.fillStyle = "#0ff";
    ctx.font = "10px monospace";
    ctx.fillText("PRESS SPACE FOR MENU", W / 2, 185);
  }
  ctx.textAlign = "left";
}

function drawLevelCompleteScreen() {
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#0f0";
  ctx.font = "bold 14px monospace";
  ctx.fillText("LEVEL " + level + " COMPLETE!", W / 2, H / 2 - 8);
  ctx.fillStyle = "#fff";
  ctx.font = "10px monospace";
  ctx.fillText("SCORE: " + score, W / 2, H / 2 + 12);
  ctx.textAlign = "left";
}

// ---- Init ----
async function main() {
  canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  document.body.appendChild(canvas);
  ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  function resize() {
    const s = Math.floor(
      Math.max(1, Math.min(window.innerWidth / W, window.innerHeight / H)),
    );
    canvas.style.width = W * s + "px";
    canvas.style.height = H * s + "px";
    canvas.style.position = "absolute";
    canvas.style.left = (window.innerWidth - W * s) / 2 + "px";
    canvas.style.top = (window.innerHeight - H * s) / 2 + "px";
  }
  window.addEventListener("resize", resize);
  resize();

  const a = "assets/";
  const imgs = await Promise.all([
    loadImage(a + "player-idle.png"),
    loadImage(a + "player-run.png"),
    loadImage(a + "player-jump.png"),
    loadImage(a + "player-stand.png"),
    loadImage(a + "player-cling.png"),
    loadImage(a + "player-duck.png"),
    loadImage(a + "player-hurt.png"),
    loadImage(a + "player-shoot-up.png"),
    loadImage(a + "player-run-shoot.png"),
    loadImage(a + "crab-idle.png"),
    loadImage(a + "crab-walk.png"),
    loadImage(a + "jumper-idle.png"),
    loadImage(a + "jumper-jump.png"),
    loadImage(a + "octopus.png"),
    loadImage(a + "shot.png"),
    loadImage(a + "impact.png"),
    loadImage(a + "enemy-death.png"),
    loadImage(a + "power-up.png"),
    loadImage(a + "tilesets.png"),
    loadImage(a + "background.png"),
    loadImage(a + "middleground.png"),
    loadImage(a + "walls.png"),
  ]);
  assets = {
    playerIdle: imgs[0],
    playerRun: imgs[1],
    playerJump: imgs[2],
    playerStand: imgs[3],
    playerCling: imgs[4],
    playerDuck: imgs[5],
    playerHurt: imgs[6],
    playerShootUp: imgs[7],
    playerRunShoot: imgs[8],
    crabIdle: imgs[9],
    crabWalk: imgs[10],
    jumperIdle: imgs[11],
    jumperJump: imgs[12],
    octopus: imgs[13],
    shot: imgs[14],
    impact: imgs[15],
    enemyDeath: imgs[16],
    powerUp: imgs[17],
    tileset: imgs[18],
    background: imgs[19],
    middleground: imgs[20],
    walls: imgs[21],
  };

  try {
    bestScore = parseInt(localStorage.getItem("warpedCaves_best")) || 0;
  } catch (e) {}
  Keyboard.init();

  levelData = generateLevel(1);
  const start = findPlayerStart();
  player = createPlayer(start.x, start.y);
  enemies = [];
  bullets = [];
  enemyBullets = [];
  particles = [];
  pickups = [];

  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    update(dt);
    render();
    Keyboard.update();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

main();
