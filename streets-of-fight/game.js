// Streets of Fight - 2.5D Beat 'em Up
// 384x224 canvas, 96x63 sprite frames, Y-depth sorting

const W = 384,
  H = 224;
const FRAME = { w: 96, h: 63 };
const GROUND_TOP = 120,
  GROUND_BOTTOM = 200; // walkable Y range
const SCROLL_SPEED = 0;

let assets = {};
let canvas, ctx;
let player, enemies, particles, props;
let score = 0,
  bestScore = 0;
let screenShake = 0;
let gameState = "menu";
let stage = 1,
  maxStage = 3;
let wave = 0,
  maxWaves = 4;
let waveEnemies = 0;
let scrollX = 0,
  scrollTarget = 0;
let stageWidth = 1200;
let scrollLocked = true;
let deathTimer = 0;
let transitionTimer = 0;

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

function randomInt(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

// ---- Player ----
function createPlayer() {
  return {
    x: 60,
    y: 160,
    vx: 0,
    vy: 0,
    w: 30,
    h: 50,
    facing: 1,
    state: "idle",
    frame: 0,
    frameTimer: 0,
    hp: 10,
    maxHp: 10,
    invincible: 0,
    attackTimer: 0,
    attackHit: new Set(),
    comboChain: [],
    comboTimer: 0,
    jumping: false,
    jumpVy: 0,
    groundY: 160,
    dead: false,
  };
}

const PLAYER_ANIMS = {
  idle: { img: "idle", frames: 4, speed: 0.12 },
  walk: { img: "walk", frames: 10, speed: 0.06 },
  punch: {
    img: "punch",
    frames: 3,
    speed: 0.08,
    attack: true,
    dmg: 1,
    range: 35,
  },
  jab: { img: "jab", frames: 3, speed: 0.08, attack: true, dmg: 1, range: 30 },
  kick: {
    img: "kick",
    frames: 5,
    speed: 0.07,
    attack: true,
    dmg: 2,
    range: 38,
  },
  jump: { img: "jump", frames: 4, speed: 0.1 },
  jumpKick: {
    img: "jumpKick",
    frames: 3,
    speed: 0.08,
    attack: true,
    dmg: 2,
    range: 35,
  },
  diveKick: {
    img: "diveKick",
    frames: 5,
    speed: 0.07,
    attack: true,
    dmg: 3,
    range: 40,
  },
  hurt: { img: "hurt", frames: 2, speed: 0.15 },
};

function updatePlayer(dt) {
  const p = player;
  if (p.dead) return;
  if (p.invincible > 0) p.invincible -= dt;
  if (p.comboTimer > 0) p.comboTimer -= dt;
  else p.comboChain = [];

  const anim = PLAYER_ANIMS[p.state];

  // In attack state
  if (p.attackTimer > 0) {
    p.attackTimer -= dt;
    p.frameTimer += dt;
    if (p.frameTimer >= anim.speed) {
      p.frameTimer = 0;
      p.frame++;
      if (p.frame >= anim.frames) {
        p.attackTimer = 0;
        p.attackHit = new Set();
        p.state = "idle";
        p.frame = 0;
      }
    }
    // Check attack hits at active frame
    if (anim.attack && p.frame >= 1) {
      checkAttackHits(anim.dmg, anim.range);
    }
    updateJump(dt);
    return;
  }

  // Hurt recovery
  if (p.state === "hurt") {
    p.frameTimer += dt;
    if (p.frameTimer >= 0.4) {
      p.state = "idle";
      p.frame = 0;
    }
    return;
  }

  const left = Keyboard.isDown("ArrowLeft") || Keyboard.isDown("a");
  const right = Keyboard.isDown("ArrowRight") || Keyboard.isDown("d");
  const up = Keyboard.isDown("ArrowUp") || Keyboard.isDown("w");
  const down = Keyboard.isDown("ArrowDown") || Keyboard.isDown("s");
  const jumpPress = Keyboard.justPressed(" ");
  const atkPress = Keyboard.justPressed("z") || Keyboard.justPressed("x");

  // Movement (2.5D: x is horizontal, y is depth)
  p.vx = 0;
  p.vy = 0;
  if (!p.jumping) {
    if (left) {
      p.vx = -2;
      p.facing = -1;
    }
    if (right) {
      p.vx = 2;
      p.facing = 1;
    }
    if (up) p.vy = -1.5;
    if (down) p.vy = 1.5;
  }

  // Jump
  if (jumpPress && !p.jumping) {
    p.jumping = true;
    p.jumpVy = -5;
    p.groundY = p.y;
    Audio.playTone(400, 0.08, "square");
  }

  // Attack
  if (atkPress) {
    if (p.jumping) {
      // Jump attack
      if (Keyboard.isDown("ArrowDown") || Keyboard.isDown("s")) {
        startAttack("diveKick");
        p.vx = p.facing * 3;
      } else {
        startAttack("jumpKick");
      }
    } else {
      // Combo system
      p.comboChain.push(Date.now());
      p.comboTimer = 0.5;
      const len = p.comboChain.length % 3;
      if (len === 1) startAttack("punch");
      else if (len === 2) startAttack("jab");
      else startAttack("kick");
    }
  }

  // Apply movement
  if (!p.jumping) {
    p.x += p.vx;
    p.y += p.vy;
    p.y = Math.max(GROUND_TOP, Math.min(GROUND_BOTTOM, p.y));
  } else {
    p.x += p.vx;
  }

  // Keep in bounds
  p.x = Math.max(scrollX + 10, Math.min(scrollX + W - 40, p.x));

  updateJump(dt);

  // State
  if (!p.jumping && p.attackTimer <= 0 && p.state !== "hurt") {
    p.state = Math.abs(p.vx) > 0.1 || Math.abs(p.vy) > 0.1 ? "walk" : "idle";
  } else if (p.jumping && p.attackTimer <= 0) {
    p.state = "jump";
  }

  // Animate
  p.frameTimer += dt;
  const currentAnim = PLAYER_ANIMS[p.state];
  if (p.frameTimer >= currentAnim.speed) {
    p.frameTimer = 0;
    p.frame = (p.frame + 1) % currentAnim.frames;
  }
}

function startAttack(type) {
  const p = player;
  const anim = PLAYER_ANIMS[type];
  p.state = type;
  p.frame = 0;
  p.frameTimer = 0;
  p.attackTimer = anim.frames * anim.speed;
  p.attackHit = new Set();
  Audio.playTone(300 + Math.random() * 200, 0.1, "sawtooth");
}

function checkAttackHits(dmg, range) {
  const p = player;
  const atkX = p.facing === 1 ? p.x + p.w : p.x - range;
  const atkRect = { x: atkX, y: p.y - 10, w: range, h: p.h + 10 };

  for (const e of enemies) {
    if (e.dead || p.attackHit.has(e)) continue;
    const eRect = { x: e.x, y: e.y - 10, w: e.w, h: e.h + 10 };
    if (rectsOverlap(atkRect, eRect) && Math.abs(e.y - p.y) < 20) {
      p.attackHit.add(e);
      e.hp -= dmg;
      e.flashTimer = 0.12;
      e.vx = p.facing * 3;
      e.stunTimer = 0.3;
      screenShake = 0.1;
      score += dmg * 25;
      Audio.playTone(500, 0.08, "square");
      spawnParticles(e.x + e.w / 2, e.y - 10, "#ff0", 5);

      if (e.hp <= 0) {
        e.dead = true;
        e.deathTimer = 0.5;
        score += 200;
        Audio.playTone(600, 0.12, "square");
        spawnParticles(e.x + e.w / 2, e.y, "#f80", 10);
        waveEnemies--;
      }
    }
  }
}

function updateJump(dt) {
  const p = player;
  if (!p.jumping) return;
  p.jumpVy += 0.3;
  p.groundY += p.jumpVy;
  if (p.groundY >= p.y) {
    p.groundY = p.y;
    p.jumping = false;
    p.jumpVy = 0;
    if (
      p.state === "jump" ||
      p.state === "jumpKick" ||
      p.state === "diveKick"
    ) {
      p.state = "idle";
      p.frame = 0;
      p.attackTimer = 0;
      p.attackHit = new Set();
    }
  }
}

function hurtPlayer(dmg) {
  const p = player;
  if (p.invincible > 0 || p.dead) return;
  p.hp -= dmg;
  p.invincible = 0.8;
  p.state = "hurt";
  p.frame = 0;
  p.frameTimer = 0;
  p.attackTimer = 0;
  screenShake = 0.15;
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

  const anim = PLAYER_ANIMS[p.state];
  const img = assets[anim.img];
  if (!img) return;

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(p.x + p.w / 2 - scrollX, p.y + 3, 18, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  const jumpOffset = p.jumping ? p.groundY - p.y : 0;
  const dx = p.x - 33 - scrollX;
  const dy = p.y - 55 - jumpOffset;
  drawFrame(
    img,
    FRAME.w,
    FRAME.h,
    p.frame % anim.frames,
    dx,
    dy,
    p.facing === -1,
  );
}

// ---- Enemies ----
function createPunk(x, y) {
  return {
    type: "punk",
    x,
    y,
    vx: 0,
    w: 28,
    h: 50,
    facing: -1,
    state: "idle",
    frame: 0,
    frameTimer: 0,
    hp: 3,
    maxHp: 3,
    speed: 1.0 + Math.random() * 0.5,
    attackTimer: 0,
    attackCooldown: 1.5 + Math.random(),
    stunTimer: 0,
    aiState: "approach",
    aiTimer: 0,
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
    if (e.stunTimer > 0) {
      e.stunTimer -= dt;
      e.x += e.vx * 0.9;
      e.vx *= 0.85;
      e.state = "hurt";
      animateEnemy(e, dt);
      continue;
    }

    e.vx = 0;
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    e.facing = dx > 0 ? 1 : -1;

    // AI
    e.aiTimer += dt;
    e.attackTimer += dt;

    if (e.aiState === "approach") {
      if (dist > 35) {
        const mx = (dx / dist) * e.speed;
        const my = (dy / dist) * e.speed * 0.7;
        e.x += mx;
        e.y += my;
        e.state = "walk";
      } else if (e.attackTimer >= e.attackCooldown) {
        e.aiState = "attack";
        e.attackTimer = 0;
      } else {
        e.state = "idle";
      }
      if (e.aiTimer > 2 + Math.random() * 2) {
        e.aiTimer = 0;
        e.aiState = Math.random() < 0.4 ? "circle" : "approach";
      }
    } else if (e.aiState === "circle") {
      // Circle around player
      const angle = Math.atan2(dy, dx) + 0.03;
      e.x = player.x - Math.cos(angle) * 50;
      e.y += (Math.random() - 0.5) * 1.5;
      e.state = "walk";
      if (e.aiTimer > 1.5) {
        e.aiTimer = 0;
        e.aiState = "approach";
      }
    } else if (e.aiState === "attack") {
      // Punch
      e.state = "punch";
      e.attackTimer = 0;
      if (dist < 40 && Math.abs(dy) < 20 && e.frame === 1) {
        if (!player.dead && player.invincible <= 0) {
          hurtPlayer(1);
        }
      }
      e.aiState = "retreat";
      e.aiTimer = 0;
    } else if (e.aiState === "retreat") {
      e.x -= e.facing * e.speed * 0.8;
      e.state = "walk";
      if (e.aiTimer > 0.8) {
        e.aiTimer = 0;
        e.aiState = "approach";
      }
    }

    // Clamp to walkable area
    e.y = Math.max(GROUND_TOP, Math.min(GROUND_BOTTOM, e.y));
    e.x = Math.max(scrollX - 20, Math.min(scrollX + W + 20, e.x));

    animateEnemy(e, dt);

    // Touch damage
    if (!player.dead && player.invincible <= 0 && !e.dead) {
      if (
        Math.abs(e.x - player.x) < 20 &&
        Math.abs(e.y - player.y) < 15 &&
        e.aiState === "attack"
      ) {
        // handled above
      }
    }
  }
}

function animateEnemy(e, dt) {
  const animMap = {
    idle: { frames: 4, speed: 0.12 },
    walk: { frames: 4, speed: 0.1 },
    punch: { frames: 3, speed: 0.1 },
    hurt: { frames: 4, speed: 0.12 },
  };
  const anim = animMap[e.state] || animMap.idle;
  e.frameTimer += dt;
  if (e.frameTimer >= anim.speed) {
    e.frameTimer = 0;
    e.frame = (e.frame + 1) % anim.frames;
  }
}

function drawEnemies() {
  for (const e of enemies) {
    if (e.dead) {
      ctx.globalAlpha = e.deathTimer * 2;
      ctx.fillStyle = "#fff";
      ctx.fillRect(e.x - scrollX - 10, e.y - 45, 40, 50);
      ctx.globalAlpha = 1;
      continue;
    }

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(e.x + e.w / 2 - scrollX, e.y + 3, 16, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const imgMap = {
      idle: "punkIdle",
      walk: "punkWalk",
      punch: "punkPunch",
      hurt: "punkHurt",
    };
    const img = assets[imgMap[e.state] || "punkIdle"];
    if (!img) continue;

    if (e.flashTimer > 0) ctx.globalCompositeOperation = "lighter";
    const maxF = Math.floor(img.width / FRAME.w);
    drawFrame(
      img,
      FRAME.w,
      FRAME.h,
      e.frame % maxF,
      e.x - 33 - scrollX,
      e.y - 55,
      e.facing === -1,
    );
    if (e.flashTimer > 0) ctx.globalCompositeOperation = "source-over";

    // HP bar
    if (e.hp < e.maxHp) {
      const bx = e.x - scrollX;
      const by = e.y - 55;
      ctx.fillStyle = "#300";
      ctx.fillRect(bx, by, e.w, 2);
      ctx.fillStyle = "#f00";
      ctx.fillRect(bx, by, e.w * (e.hp / e.maxHp), 2);
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
      vy: (Math.random() - 0.5) * 3 - 1,
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
    ctx.fillRect(p.x - scrollX, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// ---- Props ----
function spawnProps() {
  props = [];
  // Cars and barrels at intervals
  for (let i = 0; i < 3; i++) {
    props.push({
      type: "car",
      x: 200 + i * 400,
      y: GROUND_BOTTOM - 10,
      w: 144,
      h: 48,
    });
  }
  for (let i = 0; i < 5; i++) {
    props.push({
      type: "barrel",
      x: 100 + i * 250 + randomInt(-30, 30),
      y: randomInt(GROUND_TOP + 10, GROUND_BOTTOM - 10),
      w: 64,
      h: 48,
      hp: 2,
    });
  }
}

function drawProps() {
  for (const p of props) {
    const dx = p.x - scrollX;
    if (dx < -150 || dx > W + 50) continue;
    if (p.type === "car" && assets.car) {
      ctx.drawImage(assets.car, dx, p.y - 35);
    } else if (p.type === "barrel" && assets.barrel) {
      ctx.drawImage(assets.barrel, dx, p.y - 38);
    }
  }
}

// ---- Wave System ----
function startWave() {
  wave++;
  if (wave > maxWaves) {
    // Stage complete
    transitionTimer = 2;
    gameState = "stageComplete";
    Audio.playTone(523, 0.3, "sine");
    setTimeout(() => Audio.playTone(659, 0.3, "sine"), 200);
    setTimeout(() => Audio.playTone(784, 0.3, "sine"), 400);
    return;
  }

  const numPunks = 2 + wave + Math.floor(stage * 0.5);
  waveEnemies = numPunks;
  scrollLocked = true;

  for (let i = 0; i < numPunks; i++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const ex = side === 1 ? scrollX + W + 20 + i * 30 : scrollX - 20 - i * 30;
    const ey = randomInt(GROUND_TOP + 10, GROUND_BOTTOM - 10);
    const punk = createPunk(ex, ey);
    punk.hp = 2 + Math.floor(stage * 0.5);
    punk.maxHp = punk.hp;
    enemies.push(punk);
  }
}

function checkWaveProgress() {
  if (waveEnemies <= 0 && enemies.filter((e) => !e.dead).length === 0) {
    scrollLocked = false;
    // Auto-scroll to next wave position
    scrollTarget = Math.min(scrollX + W * 0.6, stageWidth - W);
  }
}

// ---- Scrolling ----
function updateScroll(dt) {
  if (!scrollLocked && scrollX < scrollTarget) {
    scrollX += 1.5;
    if (scrollX >= scrollTarget) {
      scrollX = scrollTarget;
      if (wave < maxWaves) startWave();
      else if (wave >= maxWaves) {
        transitionTimer = 2;
        gameState = "stageComplete";
      }
    }
  }
}

// ---- Rendering ----
function drawBackground() {
  // Back layer (tileable)
  const bg = assets.back;
  if (bg) {
    const off = -scrollX * 0.3;
    const o = ((off % bg.width) + bg.width) % bg.width;
    for (let x = -o; x < W; x += bg.width) {
      ctx.drawImage(bg, x, H - bg.height);
    }
  }
  // Fore layer
  const fg = assets.fore;
  if (fg) {
    const off = -scrollX * 0.6;
    const o = ((off % fg.width) + fg.width) % fg.width;
    for (let x = -o; x < W; x += fg.width) {
      ctx.drawImage(fg, x, H - fg.height);
    }
  }

  // Ground
  ctx.fillStyle = "#2a1a0a";
  ctx.fillRect(0, GROUND_BOTTOM + 10, W, H - GROUND_BOTTOM - 10);
}

function drawHUD() {
  // HP bar
  ctx.fillStyle = "#300";
  ctx.fillRect(8, 8, 80, 8);
  ctx.fillStyle = "#0f0";
  ctx.fillRect(8, 8, 80 * (player.hp / player.maxHp), 8);
  ctx.strokeStyle = "#fff";
  ctx.strokeRect(8, 8, 80, 8);

  ctx.fillStyle = "#fff";
  ctx.font = "10px monospace";
  ctx.fillText("HP", 10, 7);

  ctx.textAlign = "right";
  ctx.fillText("SCORE: " + score, W - 8, 16);
  ctx.fillText(
    "STAGE " + stage + " - WAVE " + wave + "/" + maxWaves,
    W - 8,
    28,
  );
  ctx.textAlign = "left";

  // Combo
  if (player.comboChain.length >= 2 && player.comboTimer > 0) {
    ctx.fillStyle = "#ff0";
    ctx.textAlign = "center";
    ctx.fillText("COMBO x" + player.comboChain.length, W / 2, 16);
    ctx.textAlign = "left";
  }
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

// ---- Y-Sort Draw Order ----
function drawEntitiesSorted() {
  // Collect all drawable entities with their Y positions
  const drawList = [];

  // Props
  for (const p of props) {
    drawList.push({ type: "prop", entity: p, y: p.y });
  }

  // Player
  if (!player.dead) {
    drawList.push({ type: "player", entity: player, y: player.y });
  }

  // Enemies
  for (const e of enemies) {
    drawList.push({ type: "enemy", entity: e, y: e.y });
  }

  // Sort by Y
  drawList.sort((a, b) => a.y - b.y);

  // Draw in order
  for (const item of drawList) {
    if (item.type === "prop") {
      const p = item.entity;
      const dx = p.x - scrollX;
      if (dx < -150 || dx > W + 50) continue;
      if (p.type === "car" && assets.car)
        ctx.drawImage(assets.car, dx, p.y - 35);
      else if (p.type === "barrel" && assets.barrel)
        ctx.drawImage(assets.barrel, dx, p.y - 38);
    } else if (item.type === "player") {
      drawPlayer();
    } else if (item.type === "enemy") {
      drawSingleEnemy(item.entity);
    }
  }
}

function drawSingleEnemy(e) {
  if (e.dead) {
    ctx.globalAlpha = e.deathTimer * 2;
    ctx.fillStyle = "#fff";
    ctx.fillRect(e.x - scrollX - 5, e.y - 45, 35, 50);
    ctx.globalAlpha = 1;
    return;
  }

  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(e.x + e.w / 2 - scrollX, e.y + 3, 16, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  const imgMap = {
    idle: "punkIdle",
    walk: "punkWalk",
    punch: "punkPunch",
    hurt: "punkHurt",
  };
  const img = assets[imgMap[e.state] || "punkIdle"];
  if (!img) return;

  if (e.flashTimer > 0) ctx.globalCompositeOperation = "lighter";
  const maxF = Math.floor(img.width / FRAME.w);
  drawFrame(
    img,
    FRAME.w,
    FRAME.h,
    e.frame % maxF,
    e.x - 33 - scrollX,
    e.y - 55,
    e.facing === -1,
  );
  if (e.flashTimer > 0) ctx.globalCompositeOperation = "source-over";

  if (e.hp < e.maxHp) {
    const bx = e.x - scrollX;
    ctx.fillStyle = "#300";
    ctx.fillRect(bx, e.y - 55, e.w, 2);
    ctx.fillStyle = "#f00";
    ctx.fillRect(bx, e.y - 55, e.w * (e.hp / e.maxHp), 2);
  }
}

// ---- Game State ----
function initStage() {
  player = createPlayer();
  enemies = [];
  particles = [];
  props = [];
  scrollX = 0;
  scrollTarget = 0;
  wave = 0;
  waveEnemies = 0;
  scrollLocked = true;
  stageWidth = 800 + stage * 200;
  spawnProps();
  startWave();
}

function update(dt) {
  if (dt > 0.1) dt = 0.1;
  if (screenShake > 0) screenShake -= dt;

  if (gameState === "menu") {
    if (Keyboard.justPressed(" ") || Keyboard.justPressed("Enter")) {
      gameState = "playing";
      stage = 1;
      score = 0;
      initStage();
    }
    return;
  }
  if (gameState === "gameOver") {
    if (Keyboard.justPressed(" ") || Keyboard.justPressed("Enter"))
      gameState = "menu";
    return;
  }
  if (gameState === "stageComplete") {
    transitionTimer -= dt;
    if (transitionTimer <= 0) {
      stage++;
      if (stage > maxStage) {
        if (score > bestScore) {
          bestScore = score;
          try {
            localStorage.setItem("streetsOfFight_best", bestScore);
          } catch (e) {}
        }
        gameState = "gameOver";
      } else {
        initStage();
        gameState = "playing";
      }
    }
    return;
  }

  updatePlayer(dt);
  updateEnemies(dt);
  updateParticles(dt);
  updateScroll(dt);
  checkWaveProgress();

  if (player.dead) {
    deathTimer += dt;
    if (deathTimer > 2) {
      if (score > bestScore) {
        bestScore = score;
        try {
          localStorage.setItem("streetsOfFight_best", bestScore);
        } catch (e) {}
      }
      gameState = "gameOver";
      deathTimer = 0;
    }
  }
}

function render() {
  ctx.fillStyle = "#1a0822";
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  if (screenShake > 0)
    ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);

  drawBackground();
  drawEntitiesSorted();
  drawParticles();

  ctx.restore();

  if (gameState === "playing" || gameState === "stageComplete") drawHUD();
  if (gameState === "menu") drawMenuScreen();
  else if (gameState === "gameOver") drawGameOverScreen();
  else if (gameState === "stageComplete") drawStageComplete();

  // Lock indicator
  if (
    gameState === "playing" &&
    scrollLocked &&
    enemies.filter((e) => !e.dead).length > 0
  ) {
    ctx.fillStyle = "#f44";
    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    ctx.fillText("DEFEAT ALL ENEMIES!", W / 2, 38);
    ctx.textAlign = "left";
  }
}

function drawMenuScreen() {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#f80";
  ctx.font = "bold 18px monospace";
  ctx.fillText("STREETS OF FIGHT", W / 2, 50);
  ctx.fillStyle = "#fff";
  ctx.font = "10px monospace";
  ctx.fillText("Beat 'em up action!", W / 2, 75);
  ctx.fillStyle = "#ff0";
  ctx.font = "9px monospace";
  ctx.fillText("ARROWS/WASD - Move (4-direction)", W / 2, 100);
  ctx.fillText("SPACE - Jump", W / 2, 115);
  ctx.fillText("Z/X - Attack (combo!)", W / 2, 130);
  ctx.fillText("SPACE+Z - Jump Kick", W / 2, 145);
  ctx.fillText("DOWN+Z in air - Dive Kick", W / 2, 160);
  if (Math.sin(Date.now() * 0.005) > 0) {
    ctx.fillStyle = "#0ff";
    ctx.fillText("PRESS SPACE TO START", W / 2, 190);
  }
  if (bestScore > 0) {
    ctx.fillStyle = "#888";
    ctx.fillText("BEST: " + bestScore, W / 2, 210);
  }
  ctx.textAlign = "left";
}

function drawGameOverScreen() {
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  if (stage > maxStage) {
    ctx.fillStyle = "#0f0";
    ctx.font = "bold 16px monospace";
    ctx.fillText("STREETS CLEARED!", W / 2, 65);
    ctx.fillStyle = "#fff";
    ctx.font = "10px monospace";
    ctx.fillText("You cleaned up the streets!", W / 2, 90);
  } else {
    ctx.fillStyle = "#f44";
    ctx.font = "bold 16px monospace";
    ctx.fillText("GAME OVER", W / 2, 65);
  }
  ctx.fillStyle = "#fff";
  ctx.font = "12px monospace";
  ctx.fillText("SCORE: " + score, W / 2, 125);
  if (bestScore > 0) {
    ctx.fillStyle = "#ff0";
    ctx.fillText("BEST: " + bestScore, W / 2, 145);
  }
  if (Math.sin(Date.now() * 0.005) > 0) {
    ctx.fillStyle = "#0ff";
    ctx.font = "10px monospace";
    ctx.fillText("PRESS SPACE FOR MENU", W / 2, 180);
  }
  ctx.textAlign = "left";
}

function drawStageComplete() {
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#0f0";
  ctx.font = "bold 14px monospace";
  ctx.fillText("STAGE " + stage + " COMPLETE!", W / 2, H / 2 - 8);
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
    loadImage(a + "idle.png"),
    loadImage(a + "walk.png"),
    loadImage(a + "punch.png"),
    loadImage(a + "jab.png"),
    loadImage(a + "kick.png"),
    loadImage(a + "jump.png"),
    loadImage(a + "jump_kick.png"),
    loadImage(a + "dive_kick.png"),
    loadImage(a + "hurt.png"),
    loadImage(a + "punk_idle.png"),
    loadImage(a + "punk_walk.png"),
    loadImage(a + "punk_punch.png"),
    loadImage(a + "punk_hurt.png"),
    loadImage(a + "back.png"),
    loadImage(a + "fore.png"),
    loadImage(a + "tileset.png"),
    loadImage(a + "barrel.png"),
    loadImage(a + "car.png"),
  ]);
  assets = {
    idle: imgs[0],
    walk: imgs[1],
    punch: imgs[2],
    jab: imgs[3],
    kick: imgs[4],
    jump: imgs[5],
    jumpKick: imgs[6],
    diveKick: imgs[7],
    hurt: imgs[8],
    punkIdle: imgs[9],
    punkWalk: imgs[10],
    punkPunch: imgs[11],
    punkHurt: imgs[12],
    back: imgs[13],
    fore: imgs[14],
    tileset: imgs[15],
    barrel: imgs[16],
    car: imgs[17],
  };

  try {
    bestScore = parseInt(localStorage.getItem("streetsOfFight_best")) || 0;
  } catch (e) {}
  Keyboard.init();

  player = createPlayer();
  enemies = [];
  particles = [];
  props = [];

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
