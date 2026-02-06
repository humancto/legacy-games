// Magic Cliffs - Exploration Platformer with Multi-Attack Combat
// 384x288 canvas, 128x96 player frames, vertical cliff levels

const W = 384,
  H = 288;
const TILE = 16;
const COLS = 60,
  ROWS = 36; // 960x576 world per level
const GRAVITY = 0.5,
  MAX_FALL = 8;
const PLAYER_SPEED = 2.2,
  JUMP_FORCE = -7.5;

// Asset dimensions
const PF = { w: 128, h: 96 }; // player frame
const FOX_F = { w: 80, h: 48 };
const DUDE_F = { w: 80, h: 64 };
const SHURIKEN_F = { w: 16, h: 15 };

// Tileset: 928x320, 16px tiles = 58 cols x 20 rows
const TS_COLS = 58,
  TS_ROWS = 20;

// Tile types
const T_EMPTY = 0,
  T_SOLID = 1,
  T_PLATFORM = 2,
  T_SPIKE = 3,
  T_DECO = 4;

let assets = {};
let canvas, ctx;
let camera = { x: 0, y: 0 };
let player, enemies, shurikens, particles, pickups;
let level = 1,
  maxLevel = 4;
let score = 0,
  bestScore = 0;
let levelData = [];
let screenShake = 0;
let deathTimer = 0;

// Tile definitions - which tileset tiles are solid
const SOLID_TILES = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
]);
const PLATFORM_TILES = new Set([21, 22, 23, 24, 25]);

// ---- Asset Loading ----
function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(img);
    img.src = src;
  });
}

function drawFrame(img, frameW, frameH, frameIndex, dx, dy, flip) {
  ctx.save();
  if (flip) {
    ctx.translate(dx + frameW, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(
      img,
      frameIndex * frameW,
      0,
      frameW,
      frameH,
      0,
      0,
      frameW,
      frameH,
    );
  } else {
    ctx.drawImage(
      img,
      frameIndex * frameW,
      0,
      frameW,
      frameH,
      dx,
      dy,
      frameW,
      frameH,
    );
  }
  ctx.restore();
}

function drawTile(tileIndex, dx, dy) {
  if (tileIndex <= 0) return;
  const ti = tileIndex - 1;
  const sx = (ti % TS_COLS) * TILE;
  const sy = Math.floor(ti / TS_COLS) * TILE;
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

  // Ground layer at bottom
  for (let c = 0; c < COLS; c++) {
    const groundH = 3 + Math.floor(Math.sin(c * 0.2) * 1.5);
    for (let r = ROWS - groundH; r < ROWS; r++) {
      const isTop = r === ROWS - groundH;
      data[r][c] = { tile: isTop ? 1 : 7, type: T_SOLID };
    }
  }

  // Cliff platforms - vertically stacked
  const numPlatforms = 12 + lvl * 4;
  const platforms = [];
  for (let i = 0; i < numPlatforms; i++) {
    const pw = randomInt(3, 7);
    const px = randomInt(1, COLS - pw - 1);
    const py = randomInt(4, ROWS - 6);
    // Don't overlap existing platforms too much
    let overlap = false;
    for (const p of platforms) {
      if (Math.abs(p.y - py) < 2 && px < p.x + p.w + 1 && px + pw > p.x - 1) {
        overlap = true;
        break;
      }
    }
    if (overlap) continue;
    platforms.push({ x: px, y: py, w: pw });
    for (let c = px; c < px + pw; c++) {
      data[py][c] = { tile: 2, type: T_SOLID };
      // Fill below for thickness
      if (py + 1 < ROWS && data[py + 1][c].type === T_EMPTY) {
        data[py + 1][c] = { tile: 8, type: T_SOLID };
      }
    }
  }

  // Add vertical cliff walls
  const numWalls = 3 + lvl;
  for (let i = 0; i < numWalls; i++) {
    const wx = randomInt(2, COLS - 3);
    const wy1 = randomInt(5, ROWS - 10);
    const wy2 = wy1 + randomInt(4, 8);
    for (let r = wy1; r < Math.min(wy2, ROWS - 3); r++) {
      if (data[r][wx].type === T_EMPTY) {
        data[r][wx] = { tile: 14, type: T_SOLID };
      }
    }
  }

  // Add spikes on some ground tiles
  const numSpikes = 3 + lvl * 2;
  for (let i = 0; i < numSpikes; i++) {
    const sx = randomInt(3, COLS - 3);
    // Find ground at this column
    for (let r = 0; r < ROWS - 1; r++) {
      if (data[r][sx].type === T_EMPTY && data[r + 1][sx].type === T_SOLID) {
        data[r][sx] = { tile: 18, type: T_SPIKE };
        break;
      }
    }
  }

  return { data, platforms };
}

// ---- Collision Helpers ----
function tileAt(gx, gy) {
  const c = Math.floor(gx / TILE);
  const r = Math.floor(gy / TILE);
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return T_SOLID;
  return levelData.data[r][c].type;
}

function isSolid(gx, gy) {
  return tileAt(gx, gy) === T_SOLID;
}

function isSpike(gx, gy) {
  return tileAt(gx, gy) === T_SPIKE;
}

// ---- Player ----
function createPlayer(x, y) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    w: 28,
    h: 40, // hitbox within 128x96 frame
    ox: 50,
    oy: 50, // offset from frame to hitbox
    facing: 1, // 1=right, -1=left
    grounded: false,
    state: "idle", // idle, run, jump, fall, attack, crouch, crouchAttack, jumpAttack, hurt
    frame: 0,
    frameTimer: 0,
    hp: 5,
    maxHp: 5,
    invincible: 0,
    attackTimer: 0,
    attackHit: false,
    crouching: false,
    dead: false,
    comboCount: 0,
    comboTimer: 0,
  };
}

function updatePlayer(dt) {
  const p = player;
  if (p.dead) return;

  if (p.invincible > 0) p.invincible -= dt;
  if (p.comboTimer > 0) p.comboTimer -= dt;
  else p.comboCount = 0;

  // Attack state
  if (p.attackTimer > 0) {
    p.attackTimer -= dt;
    if (p.attackTimer <= 0) {
      p.attackTimer = 0;
      p.attackHit = false;
    }
    animatePlayer(dt);
    applyPhysics(p);
    return;
  }

  p.crouching = false;

  // Input
  const left = Keyboard.isDown("ArrowLeft") || Keyboard.isDown("a");
  const right = Keyboard.isDown("ArrowRight") || Keyboard.isDown("d");
  const down = Keyboard.isDown("ArrowDown") || Keyboard.isDown("s");
  const jumpPress =
    Keyboard.justPressed("ArrowUp") ||
    Keyboard.justPressed("w") ||
    Keyboard.justPressed(" ");
  const attackPress = Keyboard.justPressed("z") || Keyboard.justPressed("x");

  // Movement
  if (left) {
    p.vx = -PLAYER_SPEED;
    p.facing = -1;
  } else if (right) {
    p.vx = PLAYER_SPEED;
    p.facing = 1;
  } else {
    p.vx = 0;
  }

  // Crouch
  if (down && p.grounded) {
    p.crouching = true;
    p.vx = 0;
  }

  // Jump
  if (jumpPress && p.grounded) {
    p.vy = JUMP_FORCE;
    p.grounded = false;
    Audio.playTone(440, 0.1, "square");
  }

  // Attack
  if (attackPress) {
    if (!p.grounded) {
      // Jump attack
      p.state = "jumpAttack";
      p.attackTimer = 0.4;
      p.frame = 0;
      p.attackHit = false;
      Audio.playTone(330, 0.15, "sawtooth");
    } else if (p.crouching) {
      // Crouch attack
      p.state = "crouchAttack";
      p.attackTimer = 0.35;
      p.frame = 0;
      p.attackHit = false;
      p.vx = 0;
      Audio.playTone(280, 0.15, "sawtooth");
    } else {
      // Ground attack
      p.state = "attack";
      p.attackTimer = 0.5;
      p.frame = 0;
      p.attackHit = false;
      p.vx = 0;
      p.comboCount++;
      p.comboTimer = 0.6;
      Audio.playTone(350, 0.15, "sawtooth");
    }
  }

  applyPhysics(p);

  // Determine visual state
  if (p.attackTimer <= 0) {
    if (!p.grounded) {
      p.state = p.vy < 0 ? "jump" : "fall";
    } else if (p.crouching) {
      p.state = "crouch";
    } else if (Math.abs(p.vx) > 0.1) {
      p.state = "run";
    } else {
      p.state = "idle";
    }
  }

  animatePlayer(dt);

  // Spike check
  const cx = p.x + p.w / 2,
    by = p.y + p.h;
  if (isSpike(cx, by - 2) || isSpike(cx, by + 2)) {
    hurtPlayer(2);
  }

  // Fall off world
  if (p.y > ROWS * TILE + 50) {
    p.hp = 0;
    p.dead = true;
  }
}

function applyPhysics(e) {
  // Gravity
  e.vy += GRAVITY;
  if (e.vy > MAX_FALL) e.vy = MAX_FALL;

  // Horizontal movement + collision
  e.x += e.vx;
  const hbL = e.x,
    hbR = e.x + e.w,
    hbT = e.y + 2,
    hbB = e.y + e.h - 2;
  if (e.vx > 0) {
    if (isSolid(hbR, hbT) || isSolid(hbR, hbB)) {
      e.x = Math.floor(hbR / TILE) * TILE - e.w;
      e.vx = 0;
    }
  } else if (e.vx < 0) {
    if (isSolid(hbL, hbT) || isSolid(hbL, hbB)) {
      e.x = Math.floor(hbL / TILE) * TILE + TILE;
      e.vx = 0;
    }
  }

  // Vertical movement + collision
  e.y += e.vy;
  e.grounded = false;
  const nbL = e.x + 2,
    nbR = e.x + e.w - 2;
  if (e.vy > 0) {
    const feetY = e.y + e.h;
    if (isSolid(nbL, feetY) || isSolid(nbR, feetY)) {
      e.y = Math.floor(feetY / TILE) * TILE - e.h;
      e.vy = 0;
      e.grounded = true;
    }
  } else if (e.vy < 0) {
    const headY = e.y;
    if (isSolid(nbL, headY) || isSolid(nbR, headY)) {
      e.y = Math.floor(headY / TILE) * TILE + TILE;
      e.vy = 0;
    }
  }
}

const ANIM_DATA = {
  idle: { img: "idle", frames: 4, speed: 0.15 },
  run: { img: "run", frames: 8, speed: 0.08 },
  jump: { img: "jump", frames: 3, speed: 0.12 },
  fall: { img: "fall", frames: 2, speed: 0.15 },
  attack: { img: "attack", frames: 8, speed: 0.06 },
  crouch: { img: "crouch", frames: 3, speed: 0.12 },
  crouchAttack: { img: "crouchAttack", frames: 5, speed: 0.07 },
  jumpAttack: { img: "jumpAttack", frames: 5, speed: 0.08 },
  hurt: { img: "hurt", frames: 1, speed: 0.3 },
};

function animatePlayer(dt) {
  const p = player;
  const anim = ANIM_DATA[p.state] || ANIM_DATA.idle;
  p.frameTimer += dt;
  if (p.frameTimer >= anim.speed) {
    p.frameTimer = 0;
    p.frame = (p.frame + 1) % anim.frames;
  }
}

function getAttackRect() {
  const p = player;
  const range =
    p.state === "jumpAttack" ? 40 : p.state === "crouchAttack" ? 30 : 36;
  const atkH = p.state === "crouchAttack" ? 20 : 32;
  const atkY = p.state === "crouchAttack" ? p.y + 15 : p.y;
  if (p.facing === 1) {
    return { x: p.x + p.w, y: atkY, w: range, h: atkH };
  }
  return { x: p.x - range, y: atkY, w: range, h: atkH };
}

function hurtPlayer(dmg) {
  const p = player;
  if (p.invincible > 0 || p.dead) return;
  p.hp -= dmg;
  p.invincible = 1.0;
  p.state = "hurt";
  p.frame = 0;
  screenShake = 0.2;
  Audio.playTone(150, 0.2, "sawtooth");
  // Knockback
  p.vy = -3;
  p.vx = -p.facing * 2;
  if (p.hp <= 0) {
    p.dead = true;
    p.hp = 0;
  }
}

function drawPlayer() {
  const p = player;
  if (p.dead) return;
  if (p.invincible > 0 && Math.floor(p.invincible * 10) % 2 === 0) return;

  const anim = ANIM_DATA[p.state] || ANIM_DATA.idle;
  const img = assets[anim.img];
  if (!img) return;

  const dx = p.x - p.ox - camera.x;
  const dy = p.y - p.oy - camera.y;
  drawFrame(img, PF.w, PF.h, p.frame % anim.frames, dx, dy, p.facing === -1);
}

// ---- Enemies ----
function createFox(x, y, hasSword) {
  return {
    type: hasSword ? "foxSword" : "fox",
    x,
    y,
    vx: 0,
    vy: 0,
    w: 30,
    h: 30,
    ox: 25,
    oy: 16,
    fw: FOX_F.w,
    fh: FOX_F.h,
    facing: 1,
    grounded: false,
    state: "idle",
    frame: 0,
    frameTimer: 0,
    hp: hasSword ? 3 : 2,
    maxHp: hasSword ? 3 : 2,
    speed: hasSword ? 1.5 : 1.2,
    patrol: { left: x - 60, right: x + 60 },
    attackTimer: 0,
    attackRange: hasSword ? 35 : 25,
    dead: false,
    deathTimer: 0,
    flashTimer: 0,
  };
}

function createShurikenDude(x, y) {
  return {
    type: "shurikenDude",
    x,
    y,
    vx: 0,
    vy: 0,
    w: 30,
    h: 46,
    ox: 25,
    oy: 16,
    fw: DUDE_F.w,
    fh: DUDE_F.h,
    facing: 1,
    grounded: false,
    state: "idle",
    frame: 0,
    frameTimer: 0,
    hp: 3,
    maxHp: 3,
    speed: 1.0,
    patrol: { left: x - 80, right: x + 80 },
    attackTimer: 0,
    shootCooldown: 2.0,
    shootTimer: 0,
    dead: false,
    deathTimer: 0,
    flashTimer: 0,
  };
}

function createNoShurikenDude(x, y) {
  return {
    type: "noShurikenDude",
    x,
    y,
    vx: 0,
    vy: 0,
    w: 30,
    h: 46,
    ox: 25,
    oy: 16,
    fw: DUDE_F.w,
    fh: DUDE_F.h,
    facing: 1,
    grounded: false,
    state: "idle",
    frame: 0,
    frameTimer: 0,
    hp: 4,
    maxHp: 4,
    speed: 1.8,
    patrol: { left: x - 100, right: x + 100 },
    attackTimer: 0,
    chargeTimer: 0,
    charging: false,
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
    const dy = player.y - e.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    e.facing = dx > 0 ? 1 : -1;

    if (e.type === "shurikenDude") {
      updateShurikenDude(e, dt, dist, dx);
    } else if (e.type === "noShurikenDude") {
      updateNoShurikenDude(e, dt, dist, dx);
    } else {
      updateFoxEnemy(e, dt, dist, dx);
    }

    // Apply physics
    e.vy += GRAVITY;
    if (e.vy > MAX_FALL) e.vy = MAX_FALL;
    e.x += e.vx;
    e.y += e.vy;

    // Ground collision
    e.grounded = false;
    const feetY = e.y + e.h;
    const eL = e.x + 2,
      eR = e.x + e.w - 2;
    if (e.vy >= 0 && (isSolid(eL, feetY) || isSolid(eR, feetY))) {
      e.y = Math.floor(feetY / TILE) * TILE - e.h;
      e.vy = 0;
      e.grounded = true;
    }
    // Wall collision
    if (isSolid(e.x + e.w, e.y + e.h / 2) || isSolid(e.x, e.y + e.h / 2)) {
      e.vx = -e.vx;
      e.facing = -e.facing;
    }

    // Check if player attacks hit this enemy
    if (player.attackTimer > 0 && !player.attackHit && !player.dead) {
      const atkR = getAttackRect();
      if (rectsOverlap(atkR, e)) {
        const dmg =
          player.state === "jumpAttack" ? 2 : player.comboCount >= 3 ? 2 : 1;
        e.hp -= dmg;
        e.flashTimer = 0.15;
        e.vx = player.facing * 3;
        e.vy = -2;
        player.attackHit = true;
        screenShake = 0.1;
        score += 25;
        Audio.playTone(500, 0.1, "square");
        spawnParticles(e.x + e.w / 2, e.y + e.h / 2, "#ff0", 5);
        if (e.hp <= 0) {
          e.dead = true;
          e.deathTimer = 0.5;
          score += 100;
          Audio.playTone(600, 0.15, "square");
          spawnParticles(e.x + e.w / 2, e.y + e.h / 2, "#f80", 12);
          // Maybe drop health pickup
          if (Math.random() < 0.3) {
            pickups.push({
              x: e.x,
              y: e.y,
              w: 12,
              h: 12,
              type: "heart",
              timer: 8,
            });
          }
        }
      }
    }

    // Enemy touches player
    if (!player.dead && player.invincible <= 0 && !e.dead) {
      if (rectsOverlap(player, e)) {
        hurtPlayer(1);
      }
    }

    // Animate
    e.frameTimer += dt;
    const fSpeed = e.state === "idle" ? 0.15 : 0.1;
    if (e.frameTimer >= fSpeed) {
      e.frameTimer = 0;
      e.frame++;
    }
  }
}

function updateFoxEnemy(e, dt, dist, dx) {
  if (dist < 120 && e.grounded) {
    // Chase player
    e.vx = e.speed * (dx > 0 ? 1 : -1);
    e.state = "run";
    // Jump at player if below
    if (player.y < e.y - 30 && Math.abs(dx) < 60 && e.grounded) {
      e.vy = -6;
      e.grounded = false;
    }
  } else {
    // Patrol
    e.vx = e.speed * 0.5 * e.facing;
    if (e.x <= e.patrol.left) {
      e.facing = 1;
      e.vx = Math.abs(e.vx);
    }
    if (e.x >= e.patrol.right) {
      e.facing = -1;
      e.vx = -Math.abs(e.vx);
    }
    e.state = "run";
    // Check for edge - turn around if no ground ahead
    if (e.grounded) {
      const aheadX = e.x + (e.facing > 0 ? e.w + 4 : -4);
      if (!isSolid(aheadX, e.y + e.h + 4)) {
        e.facing = -e.facing;
        e.vx = -e.vx;
      }
    }
  }
}

function updateShurikenDude(e, dt, dist, dx) {
  e.shootTimer += dt;
  if (dist < 160 && dist > 60) {
    e.vx = 0;
    e.state = "idle";
    // Throw shuriken
    if (e.shootTimer >= e.shootCooldown) {
      e.shootTimer = 0;
      const dir = dx > 0 ? 1 : -1;
      shurikens.push({
        x: e.x + e.w / 2,
        y: e.y + 10,
        vx: dir * 3.5,
        vy: -1.5, // arc
        w: 14,
        h: 13,
        frame: 0,
        frameTimer: 0,
        fromEnemy: true,
        life: 3,
      });
      Audio.playTone(800, 0.08, "sine");
    }
  } else if (dist < 60) {
    // Back away
    e.vx = e.speed * (dx > 0 ? -1 : 1);
    e.state = "run";
  } else {
    // Patrol
    e.vx = e.speed * 0.4 * e.facing;
    if (e.x <= e.patrol.left || e.x >= e.patrol.right) {
      e.facing = -e.facing;
    }
    e.state = "run";
    if (e.grounded) {
      const aheadX = e.x + (e.facing > 0 ? e.w + 4 : -4);
      if (!isSolid(aheadX, e.y + e.h + 4)) {
        e.facing = -e.facing;
        e.vx = -e.vx;
      }
    }
  }
}

function updateNoShurikenDude(e, dt, dist, dx) {
  if (dist < 130) {
    if (!e.charging) {
      e.chargeTimer += dt;
      if (e.chargeTimer > 0.8) {
        e.charging = true;
        e.chargeTimer = 0;
        Audio.playTone(200, 0.2, "square");
      }
      e.vx = 0;
      e.state = "idle";
    } else {
      // Charge at player
      e.vx = e.speed * 2.5 * (dx > 0 ? 1 : -1);
      e.state = "run";
      e.chargeTimer += dt;
      if (e.chargeTimer > 1.2) {
        e.charging = false;
        e.chargeTimer = 0;
      }
    }
  } else {
    e.charging = false;
    e.chargeTimer = 0;
    e.vx = e.speed * 0.5 * e.facing;
    if (e.x <= e.patrol.left || e.x >= e.patrol.right) {
      e.facing = -e.facing;
    }
    e.state = "run";
    if (e.grounded) {
      const aheadX = e.x + (e.facing > 0 ? e.w + 4 : -4);
      if (!isSolid(aheadX, e.y + e.h + 4)) {
        e.facing = -e.facing;
        e.vx = -e.vx;
      }
    }
  }
}

function drawEnemies() {
  for (const e of enemies) {
    if (e.dead) {
      // Death flash
      ctx.globalAlpha = e.deathTimer * 2;
      const dx = e.x - e.ox - camera.x;
      const dy = e.y - e.oy - camera.y;
      ctx.fillStyle = "#fff";
      ctx.fillRect(dx + e.ox - 5, dy + e.oy - 5, e.w + 10, e.h + 10);
      ctx.globalAlpha = 1;
      continue;
    }

    const imgKey =
      e.type === "foxSword"
        ? "foxSword"
        : e.type === "fox"
          ? "fox"
          : e.type === "shurikenDude"
            ? "shurikenDude"
            : "noShurikenDude";
    const img = assets[imgKey];
    if (!img) continue;

    if (e.flashTimer > 0) {
      ctx.globalCompositeOperation = "lighter";
    }

    const maxFrames = Math.floor(img.width / e.fw);
    const dx = e.x - e.ox - camera.x;
    const dy = e.y - e.oy - camera.y;
    drawFrame(img, e.fw, e.fh, e.frame % maxFrames, dx, dy, e.facing === -1);

    if (e.flashTimer > 0) {
      ctx.globalCompositeOperation = "source-over";
    }

    // HP bar
    if (e.hp < e.maxHp) {
      const bx = e.x - camera.x - 2;
      const by = e.y - camera.y - 6;
      ctx.fillStyle = "#300";
      ctx.fillRect(bx, by, e.w + 4, 3);
      ctx.fillStyle = "#f00";
      ctx.fillRect(bx, by, (e.w + 4) * (e.hp / e.maxHp), 3);
    }
  }
}

// ---- Shurikens ----
function updateShurikens(dt) {
  for (let i = shurikens.length - 1; i >= 0; i--) {
    const s = shurikens[i];
    s.vy += 0.05; // slight arc
    s.x += s.vx;
    s.y += s.vy;
    s.life -= dt;
    s.frameTimer += dt;
    if (s.frameTimer >= 0.08) {
      s.frameTimer = 0;
      s.frame = (s.frame + 1) % 2;
    }

    // Hit wall
    if (isSolid(s.x, s.y) || isSolid(s.x + s.w, s.y)) {
      shurikens.splice(i, 1);
      spawnParticles(s.x, s.y, "#888", 3);
      continue;
    }

    // Hit player
    if (s.fromEnemy && !player.dead && player.invincible <= 0) {
      if (rectsOverlap(s, player)) {
        hurtPlayer(1);
        shurikens.splice(i, 1);
        continue;
      }
    }

    if (s.life <= 0 || s.x < camera.x - 50 || s.x > camera.x + W + 50) {
      shurikens.splice(i, 1);
    }
  }
}

function drawShurikens() {
  const img = assets.shuriken;
  for (const s of shurikens) {
    if (img) {
      const dx = s.x - camera.x;
      const dy = s.y - camera.y;
      ctx.save();
      ctx.translate(dx + 8, dy + 7);
      ctx.rotate(s.frame * Math.PI);
      ctx.drawImage(img, s.frame * 16, 0, 16, 15, -8, -7, 16, 15);
      ctx.restore();
    }
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
      life: 0.3 + Math.random() * 0.4,
      maxLife: 0.3 + Math.random() * 0.4,
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
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
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
      if (pk.type === "heart" && player.hp < player.maxHp) {
        player.hp++;
        Audio.playTone(880, 0.1, "sine");
      } else if (pk.type === "gem") {
        score += 50;
        Audio.playTone(660, 0.08, "sine");
      }
      spawnParticles(pk.x, pk.y, "#0ff", 6);
      pickups.splice(i, 1);
    }
  }
}

function drawPickups() {
  for (const pk of pickups) {
    const dx = pk.x - camera.x;
    const dy = pk.y - camera.y + Math.sin(Date.now() * 0.005) * 2;
    if (pk.type === "heart") {
      ctx.fillStyle = "#f44";
      ctx.beginPath();
      // tiny heart shape
      const cx = dx + 6,
        cy = dy + 4;
      ctx.moveTo(cx, cy + 3);
      ctx.lineTo(cx - 5, cy - 1);
      ctx.lineTo(cx - 3, cy - 4);
      ctx.lineTo(cx, cy - 2);
      ctx.lineTo(cx + 3, cy - 4);
      ctx.lineTo(cx + 5, cy - 1);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = "#0ff";
      ctx.fillRect(dx, dy, 8, 8);
      ctx.fillStyle = "#aff";
      ctx.fillRect(dx + 2, dy + 2, 4, 4);
    }
  }
}

// ---- Utility ----
function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ---- Camera ----
function updateCamera() {
  const targetX = player.x + player.w / 2 - W / 2;
  const targetY = player.y + player.h / 2 - H / 2;
  camera.x += (targetX - camera.x) * 0.1;
  camera.y += (targetY - camera.y) * 0.1;
  camera.x = Math.max(0, Math.min(COLS * TILE - W, camera.x));
  camera.y = Math.max(0, Math.min(ROWS * TILE - H, camera.y));
}

// ---- Rendering ----
function drawBackground() {
  // Sky
  const sky = assets.sky;
  if (sky) {
    for (let x = 0; x < W; x += sky.width) {
      ctx.drawImage(sky, x, 0, sky.width, H, x, 0, sky.width, H);
    }
  }

  // Clouds - slow parallax
  const clouds = assets.clouds;
  if (clouds) {
    const cOffset = -camera.x * 0.15;
    const co = ((cOffset % clouds.width) + clouds.width) % clouds.width;
    for (let x = -co; x < W; x += clouds.width) {
      ctx.drawImage(clouds, x, H - clouds.height - 20);
    }
  }

  // Far grounds
  const fg = assets.farGrounds;
  if (fg) {
    const fOffset = -camera.x * 0.3;
    const fo = ((fOffset % fg.width) + fg.width) % fg.width;
    for (let x = -fo; x < W; x += fg.width) {
      ctx.drawImage(fg, x, H - fg.height);
    }
  }

  // Sea
  const sea = assets.sea;
  if (sea) {
    const sOffset = -camera.x * 0.05 + Math.sin(Date.now() * 0.001) * 3;
    const so = ((sOffset % sea.width) + sea.width) % sea.width;
    for (let x = -so; x < W; x += sea.width) {
      ctx.drawImage(sea, x, H - sea.height);
    }
  }
}

function drawTiles() {
  const startCol = Math.max(0, Math.floor(camera.x / TILE));
  const endCol = Math.min(COLS, startCol + Math.ceil(W / TILE) + 2);
  const startRow = Math.max(0, Math.floor(camera.y / TILE));
  const endRow = Math.min(ROWS, startRow + Math.ceil(H / TILE) + 2);

  for (let r = startRow; r < endRow; r++) {
    for (let c = startCol; c < endCol; c++) {
      const cell = levelData.data[r][c];
      if (cell.tile > 0) {
        drawTile(cell.tile, c * TILE - camera.x, r * TILE - camera.y);
      }
    }
  }
}

function drawHUD() {
  // Hearts
  for (let i = 0; i < player.maxHp; i++) {
    const hx = 8 + i * 16;
    ctx.fillStyle = i < player.hp ? "#f44" : "#333";
    ctx.fillRect(hx, 8, 12, 10);
    if (i < player.hp) {
      ctx.fillStyle = "#f88";
      ctx.fillRect(hx + 2, 10, 4, 3);
    }
  }

  // Score
  ctx.fillStyle = "#fff";
  ctx.font = "10px monospace";
  ctx.textAlign = "right";
  ctx.fillText("SCORE: " + score, W - 8, 18);
  ctx.textAlign = "left";

  // Level
  ctx.fillText("LVL " + level, 8, 28);

  // Combo indicator
  if (player.comboCount >= 2 && player.comboTimer > 0) {
    ctx.fillStyle = "#ff0";
    ctx.textAlign = "center";
    ctx.fillText("COMBO x" + player.comboCount, W / 2, 20);
    ctx.textAlign = "left";
  }
}

// ---- Level Setup ----
function spawnEnemies() {
  enemies = [];
  const numFox = 3 + level;
  const numShurikenDude = 1 + level;
  const numNoShuriken = Math.floor(level / 2) + 1;
  const numFoxSword = level;

  for (let i = 0; i < numFox; i++) {
    const pos = findSpawnPos();
    if (pos) enemies.push(createFox(pos.x, pos.y, false));
  }
  for (let i = 0; i < numFoxSword; i++) {
    const pos = findSpawnPos();
    if (pos) enemies.push(createFox(pos.x, pos.y, true));
  }
  for (let i = 0; i < numShurikenDude; i++) {
    const pos = findSpawnPos();
    if (pos) enemies.push(createShurikenDude(pos.x, pos.y));
  }
  for (let i = 0; i < numNoShuriken; i++) {
    const pos = findSpawnPos();
    if (pos) enemies.push(createNoShurikenDude(pos.x, pos.y));
  }
}

function findSpawnPos() {
  for (let attempt = 0; attempt < 50; attempt++) {
    const c = randomInt(5, COLS - 5);
    for (let r = 1; r < ROWS - 2; r++) {
      if (
        levelData.data[r][c].type === T_EMPTY &&
        levelData.data[r + 1][c].type === T_SOLID
      ) {
        const dist = Math.sqrt(
          Math.pow(c * TILE - player.x, 2) + Math.pow(r * TILE - player.y, 2),
        );
        if (dist > 100) {
          return { x: c * TILE, y: r * TILE - 30 };
        }
      }
    }
  }
  return null;
}

function findPlayerStart() {
  // Find leftmost ground position
  for (let c = 2; c < 10; c++) {
    for (let r = 0; r < ROWS - 1; r++) {
      if (
        levelData.data[r][c].type === T_EMPTY &&
        levelData.data[r + 1][c].type === T_SOLID
      ) {
        return { x: c * TILE, y: r * TILE - 40 };
      }
    }
  }
  return { x: 48, y: 100 };
}

function addGemPickups() {
  // Scatter gem pickups on platforms
  const numGems = 5 + level * 2;
  for (let i = 0; i < numGems; i++) {
    const c = randomInt(3, COLS - 3);
    for (let r = 1; r < ROWS - 2; r++) {
      if (
        levelData.data[r][c].type === T_EMPTY &&
        levelData.data[r + 1][c].type === T_SOLID
      ) {
        pickups.push({
          x: c * TILE + 4,
          y: r * TILE - 10,
          w: 8,
          h: 8,
          type: "gem",
          timer: 999,
        });
        break;
      }
    }
  }
}

// ---- Exit Portal ----
let exitPortal = null;

function placeExitPortal() {
  // Place at far right of level on a platform
  for (let c = COLS - 5; c > COLS - 15; c--) {
    for (let r = 2; r < ROWS - 2; r++) {
      if (
        levelData.data[r][c].type === T_EMPTY &&
        levelData.data[r + 1][c].type === T_SOLID
      ) {
        exitPortal = { x: c * TILE, y: r * TILE - 24, w: 16, h: 24 };
        return;
      }
    }
  }
  exitPortal = { x: (COLS - 4) * TILE, y: (ROWS - 6) * TILE, w: 16, h: 24 };
}

function drawExitPortal() {
  if (!exitPortal) return;
  const dx = exitPortal.x - camera.x;
  const dy = exitPortal.y - camera.y;
  const pulse = Math.sin(Date.now() * 0.005) * 0.3 + 0.7;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = "#80f";
  ctx.fillRect(dx - 2, dy - 2, 20, 28);
  ctx.fillStyle = "#c4f";
  ctx.fillRect(dx + 2, dy + 2, 12, 20);
  ctx.fillStyle = "#fff";
  ctx.fillRect(dx + 5, dy + 5, 6, 14);
  ctx.globalAlpha = 1;

  // Arrow indicator
  ctx.fillStyle = "#ff0";
  ctx.font = "8px monospace";
  ctx.textAlign = "center";
  ctx.fillText("EXIT", dx + 8, dy - 6);
  ctx.textAlign = "left";
}

// ---- State Machine ----
let gameState = "menu"; // menu, playing, levelComplete, gameOver
let transitionTimer = 0;

function initLevel() {
  levelData = generateLevel(level);
  const start = findPlayerStart();
  player = createPlayer(start.x, start.y);
  enemies = [];
  shurikens = [];
  particles = [];
  pickups = [];
  spawnEnemies();
  addGemPickups();
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
    if (Keyboard.justPressed(" ") || Keyboard.justPressed("Enter")) {
      gameState = "menu";
    }
    return;
  }

  if (gameState === "levelComplete") {
    transitionTimer -= dt;
    if (transitionTimer <= 0) {
      level++;
      if (level > maxLevel) {
        // Won the game!
        if (score > bestScore) {
          bestScore = score;
          try {
            localStorage.setItem("magicCliffs_best", bestScore);
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

  // Playing state
  updatePlayer(dt);
  updateEnemies(dt);
  updateShurikens(dt);
  updateParticles(dt);
  updatePickups(dt);
  updateCamera();

  // Check exit portal
  if (
    exitPortal &&
    !player.dead &&
    rectsOverlap(player, exitPortal) &&
    enemies.filter((e) => !e.dead).length === 0
  ) {
    gameState = "levelComplete";
    transitionTimer = 1.5;
    Audio.playTone(523, 0.3, "sine");
    setTimeout(() => Audio.playTone(659, 0.3, "sine"), 150);
    setTimeout(() => Audio.playTone(784, 0.3, "sine"), 300);
  }

  // Player death
  if (player.dead) {
    deathTimer += dt;
    if (deathTimer > 2) {
      if (score > bestScore) {
        bestScore = score;
        try {
          localStorage.setItem("magicCliffs_best", bestScore);
        } catch (e) {}
      }
      gameState = "gameOver";
      deathTimer = 0;
    }
  }
}

function render() {
  ctx.save();

  // Screen shake
  if (screenShake > 0) {
    ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
  }

  drawBackground();
  drawTiles();
  drawPickups();
  drawExitPortal();
  drawShurikens();
  drawEnemies();
  drawPlayer();
  drawParticles();

  ctx.restore();

  // HUD always on top, no shake
  if (gameState === "playing" || gameState === "levelComplete") {
    drawHUD();
  }

  if (gameState === "menu") {
    drawMenuScreen();
  } else if (gameState === "gameOver") {
    drawGameOverScreen();
  } else if (gameState === "levelComplete") {
    drawLevelComplete();
  }

  // Enemies remaining indicator
  if (gameState === "playing") {
    const alive = enemies.filter((e) => !e.dead).length;
    if (alive > 0) {
      ctx.fillStyle = "#fff";
      ctx.font = "8px monospace";
      ctx.textAlign = "right";
      ctx.fillText("ENEMIES: " + alive, W - 8, 30);
      ctx.textAlign = "left";
    } else {
      ctx.fillStyle = "#0f0";
      ctx.font = "8px monospace";
      ctx.textAlign = "center";
      ctx.fillText(">> FIND THE EXIT >>", W / 2, 40);
      ctx.textAlign = "left";
    }
  }
}

function drawMenuScreen() {
  // Parallax background is drawn by render
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";

  ctx.fillStyle = "#c4f";
  ctx.font = "bold 20px monospace";
  ctx.fillText("MAGIC CLIFFS", W / 2, 80);

  ctx.fillStyle = "#fff";
  ctx.font = "10px monospace";
  ctx.fillText("Explore the cliffs and defeat all enemies!", W / 2, 115);

  ctx.fillStyle = "#ff0";
  ctx.font = "10px monospace";
  ctx.fillText("ARROWS / WASD - Move & Jump", W / 2, 145);
  ctx.fillText("Z / X - Attack", W / 2, 160);
  ctx.fillText("DOWN + Attack - Crouch Attack", W / 2, 175);
  ctx.fillText("Air + Attack - Jump Attack", W / 2, 190);

  const blink = Math.sin(Date.now() * 0.005) > 0;
  if (blink) {
    ctx.fillStyle = "#0ff";
    ctx.fillText("PRESS SPACE TO START", W / 2, 230);
  }

  if (bestScore > 0) {
    ctx.fillStyle = "#888";
    ctx.fillText("BEST: " + bestScore, W / 2, 260);
  }

  ctx.textAlign = "left";
}

function drawGameOverScreen() {
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";

  if (level > maxLevel) {
    ctx.fillStyle = "#0f0";
    ctx.font = "bold 18px monospace";
    ctx.fillText("VICTORY!", W / 2, 90);
    ctx.fillStyle = "#fff";
    ctx.font = "10px monospace";
    ctx.fillText("You conquered the Magic Cliffs!", W / 2, 120);
  } else {
    ctx.fillStyle = "#f44";
    ctx.font = "bold 18px monospace";
    ctx.fillText("GAME OVER", W / 2, 90);
  }

  ctx.fillStyle = "#fff";
  ctx.font = "12px monospace";
  ctx.fillText("SCORE: " + score, W / 2, 155);

  if (bestScore > 0) {
    ctx.fillStyle = "#ff0";
    ctx.fillText("BEST: " + bestScore, W / 2, 175);
  }

  const blink = Math.sin(Date.now() * 0.005) > 0;
  if (blink) {
    ctx.fillStyle = "#0ff";
    ctx.font = "10px monospace";
    ctx.fillText("PRESS SPACE FOR MENU", W / 2, 215);
  }

  ctx.textAlign = "left";
}

function drawLevelComplete() {
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.fillStyle = "#0f0";
  ctx.font = "bold 16px monospace";
  ctx.fillText("LEVEL " + level + " COMPLETE!", W / 2, H / 2 - 10);
  ctx.fillStyle = "#fff";
  ctx.font = "10px monospace";
  ctx.fillText("SCORE: " + score, W / 2, H / 2 + 15);
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

  // Responsive scaling
  function resize() {
    const scaleX = window.innerWidth / W;
    const scaleY = window.innerHeight / H;
    const scale = Math.floor(Math.max(1, Math.min(scaleX, scaleY)));
    canvas.style.width = W * scale + "px";
    canvas.style.height = H * scale + "px";
    canvas.style.position = "absolute";
    canvas.style.left = (window.innerWidth - W * scale) / 2 + "px";
    canvas.style.top = (window.innerHeight - H * scale) / 2 + "px";
  }
  window.addEventListener("resize", resize);
  resize();

  // Load assets
  const assetPath = "assets/";
  const [
    idle,
    run,
    jump,
    fall,
    attack,
    crouch,
    crouchAttack,
    jumpAttack,
    hurt,
    fox,
    foxSword,
    shurikenDude,
    noShurikenDude,
    shuriken,
    tileset,
    skyImg,
    cloudsImg,
    farGroundsImg,
    seaImg,
  ] = await Promise.all([
    loadImage(assetPath + "idle.png"),
    loadImage(assetPath + "run.png"),
    loadImage(assetPath + "jump.png"),
    loadImage(assetPath + "fall.png"),
    loadImage(assetPath + "attack.png"),
    loadImage(assetPath + "crouch.png"),
    loadImage(assetPath + "crouch-attack.png"),
    loadImage(assetPath + "jump-attack.png"),
    loadImage(assetPath + "hurt.png"),
    loadImage(assetPath + "fox.png"),
    loadImage(assetPath + "fox-sword.png"),
    loadImage(assetPath + "shuriken-dude.png"),
    loadImage(assetPath + "no-shuriken-dude.png"),
    loadImage(assetPath + "shuriken.png"),
    loadImage(assetPath + "tileset.png"),
    loadImage(assetPath + "sky.png"),
    loadImage(assetPath + "clouds.png"),
    loadImage(assetPath + "far-grounds.png"),
    loadImage(assetPath + "sea.png"),
  ]);

  assets = {
    idle,
    run,
    jump,
    fall,
    attack,
    crouch,
    crouchAttack,
    jumpAttack,
    hurt,
    fox,
    foxSword,
    shurikenDude,
    noShurikenDude,
    shuriken,
    tileset,
    sky: skyImg,
    clouds: cloudsImg,
    farGrounds: farGroundsImg,
    sea: seaImg,
  };

  // Load best score
  try {
    bestScore = parseInt(localStorage.getItem("magicCliffs_best")) || 0;
  } catch (e) {}

  // Init keyboard
  Keyboard.init();

  // Init dummy level for menu background
  levelData = generateLevel(1);
  const start = findPlayerStart();
  player = createPlayer(start.x, start.y);
  enemies = [];
  shurikens = [];
  particles = [];
  pickups = [];

  // Game loop
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
