// Gothicvania Swamp - Platformer with ranged combat
// Player: 62x54 frames, 4-layer parallax

const GAME_W = 384;
const GAME_H = 224;
const TILE = 16;
const PLAYER_SPEED = 110;
const JUMP_FORCE = -260;
const GRAVITY = 650;
const SHOT_SPEED = 250;
const MAX_HP = 5;

// ---- Assets ----
const images = {};
const imgList = [
  ["idle", "assets/player-Idle.png"], // 372x54 = 6f of 62x54
  ["run", "assets/player-run.png"], // 868x54 = 14f of 62x54
  ["jump", "assets/player-Jump.png"], // 124x54 = 2f
  ["fall", "assets/player-Fall.png"], // 124x54 = 2f
  ["crouch", "assets/player-Crouch.png"], // 186x54 = 3f
  ["shoot", "assets/player-Shoot.png"], // 186x54 = 3f
  ["crouchShoot", "assets/player-crouch-shoot.png"], // 186x54 = 3f
  ["hurt", "assets/player-Hurt.png"], // 124x54 = 2f
  ["stand", "assets/player-Stand.png"], // 62x54 = 1f
  ["ghost", "assets/ghost.png"], // 124x44 = 4f of 31x44
  ["thing", "assets/thing.png"], // 132x45 = 4f of 33x45
  ["spider", "assets/spider.png"], // 128x21 = 4f of 32x21
  ["fire", "assets/fire.png"], // 50x6 = 2f of 25x6
  ["death", "assets/enemy-death.png"], // 234x49 = 6f of 39x49
  ["bg", "assets/background.png"], // 96x256
  ["mid1", "assets/mid-layer-01.png"], // 208x256
  ["mid2", "assets/mid-layer-02.png"], // 208x256
  ["trees", "assets/trees.png"], // 288x208
  ["tileset", "assets/tileset.png"], // 336x112
];

let loaded = 0;
const total = imgList.length;

function loadAssets(cb) {
  imgList.forEach(([n, s]) => {
    const img = new Image();
    img.onload = () => {
      images[n] = img;
      loaded++;
      if (loaded >= total) cb();
    };
    img.onerror = () => {
      loaded++;
      if (loaded >= total) cb();
    };
    img.src = s;
  });
}

function drawFrame(ctx, sheet, fi, fw, fh, dx, dy, flip) {
  if (!sheet) return;
  ctx.save();
  if (flip) {
    ctx.translate(dx + fw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(sheet, fi * fw, 0, fw, fh, 0, 0, fw, fh);
  } else {
    ctx.drawImage(sheet, fi * fw, 0, fw, fh, dx, dy, fw, fh);
  }
  ctx.restore();
}

// ---- Level Generation ----
function generateLevel(idx) {
  const cols = 60 + idx * 15;
  const rows = 14; // 14*16=224
  const map = new Array(rows * cols).fill(0);
  const enemies = [];
  const fires = [];

  // Fill top and bottom borders
  for (let x = 0; x < cols; x++) {
    map[(rows - 1) * cols + x] = 1; // ground
    map[(rows - 2) * cols + x] = 2; // surface
  }
  for (let y = 0; y < rows; y++) {
    map[y * cols] = 1;
    map[y * cols + cols - 1] = 1;
  }

  let groundY = rows - 2;
  for (let x = 3; x < cols - 3; x++) {
    // Terrain variation
    if (Math.random() < 0.12)
      groundY = Utils.clamp(
        groundY + (Math.random() < 0.5 ? -1 : 1),
        rows - 4,
        rows - 2,
      );

    for (let y = groundY; y < rows; y++) {
      map[y * cols + x] = y === groundY ? 2 : 1;
    }

    // Floating platforms
    if (Math.random() < 0.05 && x > 5) {
      const py = Utils.randomInt(4, rows - 5);
      const pw = Utils.randomInt(3, 7);
      for (let px = 0; px < pw && x + px < cols - 1; px++) {
        map[py * cols + x + px] = 3;
      }
    }

    // Enemies
    if (Math.random() < 0.03 && x > 5) {
      const types = ["ghost", "spider", "thing"];
      const type = types[Utils.randomInt(0, types.length - 1)];
      const ey = type === "ghost" ? (groundY - 4) * TILE : (groundY - 1) * TILE;
      enemies.push({ x: x * TILE, y: ey, type });
    }

    // Fire hazards
    if (Math.random() < 0.02 && x > 4) {
      fires.push({ x: x * TILE, y: (groundY - 1) * TILE + 10 });
    }
  }

  // Exit platform
  for (let px = cols - 6; px < cols - 1; px++) {
    map[3 * cols + px] = 3;
  }

  return {
    cols,
    rows,
    map,
    enemies,
    fires,
    exitX: (cols - 4) * TILE,
    exitY: 2 * TILE,
    startX: 2 * TILE,
    startY: (rows - 3) * TILE,
  };
}

const LEVELS = [];
for (let i = 0; i < 4; i++) LEVELS.push(generateLevel(i));

// ---- Player ----
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.w = 20;
    this.h = 40;
    this.hp = MAX_HP;
    this.alive = true;
    this.facingRight = true;
    this.onGround = false;
    this.state = "idle";
    this.frame = 0;
    this.frameTimer = 0;
    this.invincible = 0;
    this.crouching = false;
    this.shooting = false;
    this.shootTimer = 0;
  }

  update(dt, level) {
    if (!this.alive) return;
    this.invincible = Math.max(0, this.invincible - dt);
    this.shootTimer = Math.max(0, this.shootTimer - dt);

    // Movement
    this.vx = 0;
    this.crouching = Input.down && this.onGround;

    if (!this.crouching) {
      if (Input.left) this.vx = -PLAYER_SPEED;
      if (Input.right) this.vx = PLAYER_SPEED;
    }
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
      Audio.playTone(400, 0.06, "square");
    }

    // Shoot
    if (
      (Input.justPressed("KeyX") || Input.justPressed("KeyC")) &&
      this.shootTimer <= 0
    ) {
      this.shoot();
    }

    // Gravity
    this.vy += GRAVITY * dt;
    if (this.vy > 450) this.vy = 450;

    this.x += this.vx * dt;
    this.resolveX(level);
    this.y += this.vy * dt;
    this.resolveY(level);

    // State determination
    if (this.shooting && this.shootTimer > 0) {
      this.state = this.crouching ? "crouchShoot" : "shoot";
    } else if (this.crouching) {
      this.state = "crouch";
    } else if (!this.onGround && this.vy < 0) {
      this.state = "jump";
    } else if (!this.onGround && this.vy >= 0) {
      this.state = "fall";
    } else if (Math.abs(this.vx) > 10) {
      this.state = "run";
    } else {
      this.state = "idle";
    }

    // Animation
    this.frameTimer += dt;
    const rates = {
      idle: 0.15,
      run: 0.06,
      jump: 0.15,
      fall: 0.15,
      crouch: 0.15,
      shoot: 0.1,
      crouchShoot: 0.1,
      hurt: 0.15,
    };
    if (this.frameTimer > (rates[this.state] || 0.1)) {
      this.frameTimer = 0;
      this.frame++;
    }
  }

  shoot() {
    const dir = this.facingRight ? 1 : -1;
    const sx = this.facingRight ? this.x + this.w : this.x - 8;
    const sy = this.crouching ? this.y + 20 : this.y + 10;
    gs.shots.push({
      x: sx,
      y: sy,
      vx: dir * SHOT_SPEED,
      w: 8,
      h: 4,
      active: true,
      life: 1.5,
    });
    this.shootTimer = 0.25;
    this.shooting = true;
    Audio.playShoot();
    setTimeout(() => {
      this.shooting = false;
    }, 200);
  }

  resolveX(level) {
    const { cols, rows, map } = level;
    const l = Math.floor(this.x / TILE),
      r = Math.floor((this.x + this.w - 1) / TILE);
    const t = Math.floor(this.y / TILE),
      b = Math.floor((this.y + this.h - 1) / TILE);
    for (let ty = t; ty <= b; ty++)
      for (let tx = l; tx <= r; tx++) {
        if (tx < 0 || tx >= cols || ty < 0 || ty >= rows) continue;
        if (map[ty * cols + tx] > 0) {
          if (this.vx > 0) this.x = tx * TILE - this.w;
          else if (this.vx < 0) this.x = (tx + 1) * TILE;
        }
      }
  }

  resolveY(level) {
    const { cols, rows, map } = level;
    const l = Math.floor((this.x + 2) / TILE),
      r = Math.floor((this.x + this.w - 3) / TILE);
    const t = Math.floor(this.y / TILE),
      b = Math.floor((this.y + this.h - 1) / TILE);
    this.onGround = false;
    for (let ty = t; ty <= b; ty++)
      for (let tx = l; tx <= r; tx++) {
        if (tx < 0 || tx >= cols || ty < 0 || ty >= rows) continue;
        if (map[ty * cols + tx] > 0) {
          if (this.vy > 0) {
            this.y = ty * TILE - this.h;
            this.vy = 0;
            this.onGround = true;
          } else if (this.vy < 0) {
            this.y = (ty + 1) * TILE;
            this.vy = 0;
          }
        }
      }
  }

  takeDamage(n) {
    if (this.invincible > 0) return;
    this.hp -= n;
    this.invincible = 1.0;
    Audio.playHit();
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
  }

  draw(ctx, cx, cy) {
    if (this.invincible > 0 && Math.floor(this.invincible * 10) % 2) return;
    const fw = 62,
      fh = 54;
    const sheets = {
      idle: [images.idle, 6],
      run: [images.run, 14],
      jump: [images.jump, 2],
      fall: [images.fall, 2],
      crouch: [images.crouch, 3],
      shoot: [images.shoot, 3],
      crouchShoot: [images.crouchShoot, 3],
      hurt: [images.hurt, 2],
    };
    const [sheet, maxF] = sheets[this.state] || sheets.idle;
    const f = this.frame % maxF;
    drawFrame(
      ctx,
      sheet,
      f,
      fw,
      fh,
      Math.round(this.x - cx - 21),
      Math.round(this.y - cy - 14),
      !this.facingRight,
    );
  }

  getRect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}

// ---- Enemies ----
class SwampEnemy {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.active = true;
    this.frame = 0;
    this.frameTimer = 0;
    this.facingRight = Math.random() < 0.5;
    this.patrolDir = this.facingRight ? 1 : -1;
    this.startX = x;
    this.hp = type === "thing" ? 2 : 1;
    this.flashTimer = 0;
    this.time = Math.random() * 6;

    switch (type) {
      case "ghost":
        this.w = 24;
        this.h = 36;
        this.baseY = y;
        break;
      case "thing":
        this.w = 26;
        this.h = 38;
        break;
      case "spider":
        this.w = 26;
        this.h = 16;
        break;
    }
  }

  update(dt, level, px, py) {
    this.time += dt;
    this.frameTimer += dt;
    if (this.frameTimer > 0.15) {
      this.frameTimer = 0;
      this.frame = (this.frame + 1) % 4;
    }
    this.flashTimer = Math.max(0, this.flashTimer - dt);

    switch (this.type) {
      case "ghost":
        const dx = px - this.x,
          dy = py - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150 && dist > 0) {
          this.x += (dx / dist) * 40 * dt;
          this.y += (dy / dist) * 40 * dt;
          this.facingRight = dx > 0;
        } else {
          this.y = this.baseY + Math.sin(this.time * 2) * 20;
        }
        break;
      case "thing":
        this.x += this.patrolDir * 35 * dt;
        this.facingRight = this.patrolDir > 0;
        if (Math.abs(this.x - this.startX) > 80) this.patrolDir *= -1;
        break;
      case "spider":
        this.x += this.patrolDir * 45 * dt;
        this.facingRight = this.patrolDir > 0;
        if (Math.abs(this.x - this.startX) > 60) this.patrolDir *= -1;
        break;
    }
  }

  hit(dmg) {
    this.hp -= dmg;
    this.flashTimer = 0.15;
    if (this.hp <= 0) {
      this.active = false;
      return true;
    }
    return false;
  }

  draw(ctx, cx, cy) {
    if (this.flashTimer > 0 && Math.floor(this.flashTimer * 20) % 2) return;
    let sheet, fw, fh;
    switch (this.type) {
      case "ghost":
        sheet = images.ghost;
        fw = 31;
        fh = 44;
        break;
      case "thing":
        sheet = images.thing;
        fw = 33;
        fh = 45;
        break;
      case "spider":
        sheet = images.spider;
        fw = 32;
        fh = 21;
        break;
    }
    if (this.type === "ghost") ctx.globalAlpha = 0.7;
    drawFrame(
      ctx,
      sheet,
      this.frame,
      fw,
      fh,
      Math.round(this.x - cx - 4),
      Math.round(this.y - cy - 4),
      !this.facingRight,
    );
    ctx.globalAlpha = 1;
  }

  getRect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}

class DeathFX {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.frame = 0;
    this.frameTimer = 0;
    this.active = true;
  }
  update(dt) {
    this.frameTimer += dt;
    if (this.frameTimer > 0.08) {
      this.frameTimer = 0;
      this.frame++;
      if (this.frame >= 6) this.active = false;
    }
  }
  draw(ctx, cx, cy) {
    drawFrame(
      ctx,
      images.death,
      this.frame,
      39,
      49,
      Math.round(this.x - cx - 10),
      Math.round(this.y - cy - 10),
      false,
    );
  }
}

// ---- Game State ----
const gs = {
  player: null,
  enemies: [],
  shots: [],
  deathFX: [],
  fires: [],
  particles: null,
  camX: 0,
  camY: 0,
  level: 0,
  score: 0,
  shake: 0,
};

function loadLevel(i) {
  const lv = LEVELS[i];
  gs.player = new Player(lv.startX, lv.startY);
  gs.enemies = lv.enemies.map((e) => new SwampEnemy(e.x, e.y, e.type));
  gs.fires = lv.fires.map((f) => ({ x: f.x, y: f.y, frame: 0, timer: 0 }));
  gs.shots = [];
  gs.deathFX = [];
  gs.particles = new ParticleEmitter();
  gs.camX = 0;
  gs.camY = 0;
}

// ---- State Machine ----
const sm = new StateMachine();
let game;

sm.add("loading", {
  render(ctx) {
    ctx.fillStyle = "#0a0510";
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    UI.drawCenteredText(ctx, "Loading...", GAME_W, GAME_H / 2, {
      font: "12px monospace",
      color: "#a8f",
    });
  },
});

sm.add("menu", {
  update() {
    if (Input.justPressed("Space") || Input.justPressed("Enter")) {
      gs.level = 0;
      gs.score = 0;
      loadLevel(0);
      sm.switch("playing", game);
    }
  },
  render(ctx) {
    ctx.fillStyle = "#0a0510";
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    drawParallax(ctx, 0);
    UI.drawOverlay(ctx, GAME_W, GAME_H, 0.4);
    UI.drawCenteredText(ctx, "GOTHICVANIA SWAMP", GAME_W, 40, {
      font: "bold 18px monospace",
      color: "#a4f",
      outline: "#201",
    });

    if (images.idle) {
      const f = Math.floor(Date.now() / 150) % 6;
      drawFrame(ctx, images.idle, f, 62, 54, GAME_W / 2 - 31, 70, false);
    }

    UI.drawCenteredText(ctx, "Arrows/WASD: Move | Down: Crouch", GAME_W, 140, {
      font: "8px monospace",
      color: "#86a",
    });
    UI.drawCenteredText(ctx, "Space/Z: Jump | X/C: Shoot", GAME_W, 155, {
      font: "8px monospace",
      color: "#86a",
    });
    UI.drawCenteredText(
      ctx,
      "4 Swamp Levels - Shoot your way out!",
      GAME_W,
      175,
      { font: "9px monospace", color: "#f80" },
    );

    if (UI.blink(Date.now() / 1000, 2))
      UI.drawCenteredText(ctx, "PRESS SPACE", GAME_W, GAME_H - 25, {
        font: "11px monospace",
        color: "#fff",
      });
  },
});

sm.add("playing", {
  update(dt) {
    const p = gs.player,
      lv = LEVELS[gs.level];
    if (Input.justPressed("Escape")) {
      sm.switch("paused", game);
      return;
    }

    p.update(dt, lv);

    // Camera
    gs.camX = Utils.lerp(gs.camX, p.x - GAME_W / 2, dt * 5);
    gs.camY = Utils.lerp(gs.camY, p.y - GAME_H / 2, dt * 5);
    gs.camX = Utils.clamp(gs.camX, 0, lv.cols * TILE - GAME_W);
    gs.camY = Utils.clamp(gs.camY, 0, Math.max(0, lv.rows * TILE - GAME_H));
    gs.shake = Math.max(0, gs.shake - dt);

    // Shots
    for (const s of gs.shots) {
      s.x += s.vx * dt;
      s.life -= dt;
      if (s.life <= 0) s.active = false;
      const col = Math.floor(s.x / TILE),
        row = Math.floor(s.y / TILE);
      if (
        col >= 0 &&
        col < lv.cols &&
        row >= 0 &&
        row < lv.rows &&
        lv.map[row * lv.cols + col] > 0
      )
        s.active = false;
    }

    // Enemies
    for (const e of gs.enemies) {
      e.update(dt, lv, p.x, p.y);
      if (
        p.alive &&
        p.invincible <= 0 &&
        Collision.rectRect(p.getRect(), e.getRect())
      ) {
        p.takeDamage(1);
        gs.shake = 0.2;
      }
      for (const s of gs.shots) {
        if (
          s.active &&
          Collision.rectRect({ x: s.x, y: s.y, w: s.w, h: s.h }, e.getRect())
        ) {
          s.active = false;
          if (e.hit(1)) {
            gs.score += 150;
            gs.deathFX.push(new DeathFX(e.x, e.y));
            gs.particles.emit(e.x + e.w / 2, e.y + e.h / 2, {
              count: 12,
              speed: 100,
              colors: ["#f0f", "#80f", "#f08"],
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

    // Fire hazards
    for (const f of gs.fires) {
      f.timer += dt;
      if (f.timer > 0.15) {
        f.timer = 0;
        f.frame = (f.frame + 1) % 2;
      }
      if (p.alive && p.invincible <= 0) {
        if (Collision.rectRect(p.getRect(), { x: f.x, y: f.y, w: 20, h: 6 })) {
          p.takeDamage(1);
        }
      }
    }

    gs.particles.update(dt);
    for (const d of gs.deathFX) d.update(dt);

    gs.shots = gs.shots.filter((s) => s.active);
    gs.enemies = gs.enemies.filter((e) => e.active);
    gs.deathFX = gs.deathFX.filter((d) => d.active);

    // Exit check
    if (
      p.alive &&
      Math.abs(p.x - lv.exitX) < 20 &&
      Math.abs(p.y - lv.exitY) < 20
    ) {
      gs.score += 500;
      if (gs.level < LEVELS.length - 1) {
        gs.level++;
        const hp = p.hp;
        loadLevel(gs.level);
        gs.player.hp = hp;
      } else sm.switch("victory", game);
    }

    if (!p.alive || p.y > lv.rows * TILE + 50) sm.switch("gameover", game);
  },

  render(ctx) {
    ctx.save();
    if (gs.shake > 0)
      ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);

    drawParallax(ctx, gs.camX);
    drawTiles(ctx, LEVELS[gs.level], gs.camX, gs.camY);

    // Fires
    for (const f of gs.fires) {
      if (images.fire) {
        ctx.drawImage(
          images.fire,
          f.frame * 25,
          0,
          25,
          6,
          Math.round(f.x - gs.camX),
          Math.round(f.y - gs.camY),
          25,
          6,
        );
      } else {
        ctx.fillStyle = f.frame ? "#f80" : "#f00";
        ctx.fillRect(f.x - gs.camX, f.y - gs.camY, 20, 6);
      }
    }

    // Exit
    const ex = LEVELS[gs.level].exitX - gs.camX,
      ey = LEVELS[gs.level].exitY - gs.camY;
    ctx.fillStyle = `rgba(160, 100, 255, ${0.4 + Math.sin(Date.now() / 200) * 0.2})`;
    ctx.fillRect(ex, ey, 16, 16);
    UI.drawText(ctx, "EXIT", ex - 2, ey - 8, {
      font: "6px monospace",
      color: "#a8f",
    });

    // Enemies
    for (const e of gs.enemies) e.draw(ctx, gs.camX, gs.camY);
    // Death FX
    for (const d of gs.deathFX) d.draw(ctx, gs.camX, gs.camY);
    // Shots
    for (const s of gs.shots) {
      ctx.fillStyle = "#ff0";
      ctx.fillRect(
        Math.round(s.x - gs.camX),
        Math.round(s.y - gs.camY),
        s.w,
        s.h,
      );
      ctx.fillStyle = "#fff";
      ctx.fillRect(
        Math.round(s.x - gs.camX + 1),
        Math.round(s.y - gs.camY + 1),
        s.w - 2,
        s.h - 2,
      );
    }
    // Player
    gs.player.draw(ctx, gs.camX, gs.camY);
    // Particles
    ctx.save();
    ctx.translate(-gs.camX, -gs.camY);
    gs.particles.draw(ctx);
    ctx.restore();
    ctx.restore();

    // HUD
    UI.drawHealthBar(ctx, 4, 4, 50, 6, gs.player.hp, MAX_HP, "#0f0", "#600");
    UI.drawText(ctx, "Score: " + gs.score, GAME_W - 4, 4, {
      font: "8px monospace",
      color: "#ff0",
      align: "right",
    });
    UI.drawText(ctx, "Lv " + (gs.level + 1) + "/4", 4, 14, {
      font: "7px monospace",
      color: "#a8f",
    });
  },
});

sm.add("paused", {
  update() {
    if (Input.justPressed("Escape") || Input.justPressed("Space")) {
      sm.currentName = "playing";
      sm.current = sm.states.playing;
    }
  },
  render(ctx) {
    sm.states.playing.render(ctx);
    UI.drawOverlay(ctx, GAME_W, GAME_H, 0.5);
    UI.drawCenteredText(ctx, "PAUSED", GAME_W, GAME_H / 2, {
      font: "bold 16px monospace",
      color: "#fff",
    });
  },
});

sm.add("gameover", {
  enter() {
    this.t = 0;
  },
  update(dt) {
    this.t += dt;
    if (this.t > 1 && Input.justPressed("Space")) sm.switch("menu", game);
  },
  render(ctx) {
    ctx.fillStyle = "#0a0510";
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    UI.drawCenteredText(ctx, "GAME OVER", GAME_W, 70, {
      font: "bold 20px monospace",
      color: "#f44",
    });
    UI.drawCenteredText(ctx, "Score: " + gs.score, GAME_W, 110, {
      font: "14px monospace",
      color: "#ff0",
    });
    if (this.t > 1 && UI.blink(Date.now() / 1000, 2))
      UI.drawCenteredText(ctx, "SPACE to retry", GAME_W, 160, {
        font: "10px monospace",
        color: "#fff",
      });
  },
});

sm.add("victory", {
  enter() {
    this.t = 0;
  },
  update(dt) {
    this.t += dt;
    if (this.t > 2 && Input.justPressed("Space")) sm.switch("menu", game);
  },
  render(ctx) {
    ctx.fillStyle = "#050a10";
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    UI.drawCenteredText(ctx, "VICTORY!", GAME_W, 50, {
      font: "bold 22px monospace",
      color: "#0f0",
    });
    UI.drawCenteredText(ctx, "The swamp is cleared!", GAME_W, 90, {
      font: "12px monospace",
      color: "#8f8",
    });
    UI.drawCenteredText(ctx, "Final Score: " + gs.score, GAME_W, 130, {
      font: "bold 16px monospace",
      color: "#ff0",
    });
    if (this.t > 2 && UI.blink(Date.now() / 1000, 2))
      UI.drawCenteredText(ctx, "SPACE to play again", GAME_W, 180, {
        font: "10px monospace",
        color: "#fff",
      });
  },
});

// ---- Drawing Helpers ----
function drawParallax(ctx, camX) {
  // 4 layers
  const layers = [
    [images.bg, 0.05],
    [images.mid1, 0.2],
    [images.mid2, 0.4],
    [images.trees, 0.7],
  ];
  for (const [img, speed] of layers) {
    if (!img) continue;
    const scroll = (camX * speed) % img.width;
    for (let x = -scroll; x < GAME_W; x += img.width) {
      ctx.drawImage(img, x, GAME_H - img.height);
    }
  }
}

function drawTiles(ctx, level, cx, cy) {
  const { cols, rows, map } = level;
  const ts = images.tileset;
  const sc = Math.max(0, Math.floor(cx / TILE));
  const sr = Math.max(0, Math.floor(cy / TILE));
  const ec = Math.min(cols, Math.ceil((cx + GAME_W) / TILE) + 1);
  const er = Math.min(rows, Math.ceil((cy + GAME_H) / TILE) + 1);

  for (let r = sr; r < er; r++) {
    for (let c = sc; c < ec; c++) {
      const t = map[r * cols + c];
      if (t <= 0) continue;
      const dx = c * TILE - Math.round(cx);
      const dy = r * TILE - Math.round(cy);
      if (ts) {
        // tileset is 336x112 = 21 cols x 7 rows of 16x16
        const ti = (t - 1) % 21;
        const tr2 = Math.floor((t - 1) / 21);
        ctx.drawImage(
          ts,
          ti * TILE,
          tr2 * TILE,
          TILE,
          TILE,
          dx,
          dy,
          TILE,
          TILE,
        );
      } else {
        ctx.fillStyle = t === 1 ? "#342" : t === 2 ? "#453" : "#564";
        ctx.fillRect(dx, dy, TILE, TILE);
      }
    }
  }
}

// ---- Init ----
game = createGame({
  width: GAME_W,
  height: GAME_H,
  init() {
    sm.switch("loading", this);
    loadAssets(() => sm.switch("menu", this));
  },
  update(dt) {
    sm.update(dt, this);
  },
  render(ctx) {
    sm.render(ctx, this);
  },
});
