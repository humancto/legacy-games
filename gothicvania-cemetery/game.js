// Gothicvania Cemetery - Action Platformer with melee combat
// Hero: 160x90 frames, large sprites, sword combat

const GAME_W = 480;
const GAME_H = 270;
const TILE = 16;
const SPEED = 120;
const JUMP = -280;
const GRAV = 700;
const MAX_HP = 5;

const images = {};
const imgList = [
  ["idle", "assets/hero-idle.png"], // 640x90 = 4f of 160x90? Actually let me calc: 640/160=4
  ["run", "assets/hero-run.png"], // 960x90 = 6f
  ["attack", "assets/hero-attack.png"], // 800x90 = 5f (but actually might be 6f: 800/160=5)
  ["jump", "assets/hero-jump.png"], // 640x90 = 4f
  ["crouch", "assets/hero-crouch.png"], // 160x90 = 1f
  ["hurt", "assets/hero-hurt.png"], // 160x90 = 1f
  ["death", "assets/death.png"], // 1120x90 = 7f
  ["bg", "assets/background.png"], // 384x224
  ["mountains", "assets/mountains.png"], // 192x179
  ["graveyard", "assets/graveyard.png"], // 384x123
  ["tileset", "assets/tileset.png"], // 448x160
];

let loaded = 0;
function loadAssets(cb) {
  imgList.forEach(([n, s]) => {
    const img = new Image();
    img.onload = () => {
      images[n] = img;
      loaded++;
      if (loaded >= imgList.length) cb();
    };
    img.onerror = () => {
      loaded++;
      if (loaded >= imgList.length) cb();
    };
    img.src = s;
  });
}

const FW = 160,
  FH = 90;

function drawFrame(ctx, sheet, fi, dx, dy, flip) {
  if (!sheet) return;
  const maxF = Math.floor(sheet.width / FW);
  const f = fi % maxF;
  ctx.save();
  if (flip) {
    ctx.translate(dx + FW, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(sheet, f * FW, 0, FW, FH, 0, 0, FW, FH);
  } else ctx.drawImage(sheet, f * FW, 0, FW, FH, dx, dy, FW, FH);
  ctx.restore();
}

// ---- Level Generation ----
function genLevel(idx) {
  const cols = 50 + idx * 15,
    rows = 17;
  const map = new Array(rows * cols).fill(0);
  const enemies = [];

  for (let x = 0; x < cols; x++) {
    map[(rows - 1) * cols + x] = 1;
    map[(rows - 2) * cols + x] = 2;
  }
  for (let y = 0; y < rows; y++) {
    map[y * cols] = 1;
    map[y * cols + cols - 1] = 1;
  }

  let gy = rows - 2;
  for (let x = 3; x < cols - 3; x++) {
    if (Math.random() < 0.1)
      gy = Utils.clamp(gy + (Math.random() < 0.5 ? -1 : 1), rows - 4, rows - 2);
    for (let y = gy; y < rows; y++) map[y * cols + x] = y === gy ? 2 : 1;

    if (Math.random() < 0.05 && x > 5) {
      const py = Utils.randomInt(5, rows - 5);
      for (let px = 0; px < Utils.randomInt(3, 6) && x + px < cols - 1; px++)
        map[py * cols + x + px] = 3;
    }

    if (Math.random() < 0.035 && x > 5) {
      const types = ["skeleton", "skeleton_clothed", "ghost", "hellgato"];
      const type = types[Utils.randomInt(0, types.length - 1)];
      const ey = type === "ghost" ? (gy - 5) * TILE : (gy - 1) * TILE;
      enemies.push({ x: x * TILE, y: ey, type });
    }
  }

  for (let px = cols - 6; px < cols - 1; px++) map[4 * cols + px] = 3;

  return {
    cols,
    rows,
    map,
    enemies,
    exitX: (cols - 4) * TILE,
    exitY: 3 * TILE,
    startX: 3 * TILE,
    startY: (rows - 3) * TILE,
  };
}

const LEVELS = [genLevel(0), genLevel(1), genLevel(2)];

// ---- Player ----
class Hero {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.w = 30;
    this.h = 50;
    this.hp = MAX_HP;
    this.alive = true;
    this.right = true;
    this.ground = false;
    this.state = "idle";
    this.frame = 0;
    this.ft = 0;
    this.inv = 0;
    this.attacking = false;
    this.atkTimer = 0;
    this.atkHit = false;
  }

  update(dt, lv) {
    if (!this.alive) return;
    this.inv = Math.max(0, this.inv - dt);
    this.atkTimer = Math.max(0, this.atkTimer - dt);
    if (this.atkTimer <= 0) this.attacking = false;

    this.vx = 0;
    if (!this.attacking) {
      if (Input.left) this.vx = -SPEED;
      if (Input.right) this.vx = SPEED;
    }
    if (this.vx !== 0) this.right = this.vx > 0;

    if (
      this.ground &&
      (Input.justPressed("Space") ||
        Input.justPressed("KeyZ") ||
        Input.justPressed("ArrowUp"))
    ) {
      this.vy = JUMP;
      this.ground = false;
      Audio.playTone(350, 0.06, "square");
    }

    if (
      (Input.justPressed("KeyX") || Input.justPressed("KeyC")) &&
      !this.attacking
    ) {
      this.attacking = true;
      this.atkTimer = 0.4;
      this.atkHit = false;
      this.frame = 0;
      this.ft = 0;
      Audio.playTone(200, 0.08, "sawtooth");
    }

    this.vy += GRAV * dt;
    if (this.vy > 500) this.vy = 500;
    this.x += this.vx * dt;
    this.colX(lv);
    this.y += this.vy * dt;
    this.colY(lv);

    this.state = this.attacking
      ? "attack"
      : !this.ground && this.vy < 0
        ? "jump"
        : !this.ground
          ? "jump"
          : Math.abs(this.vx) > 10
            ? "run"
            : "idle";

    this.ft += dt;
    const rate =
      this.state === "attack" ? 0.07 : this.state === "run" ? 0.08 : 0.15;
    if (this.ft > rate) {
      this.ft = 0;
      this.frame++;
    }
  }

  colX(lv) {
    const { cols, rows, map } = lv;
    for (
      let ty = Math.floor(this.y / TILE);
      ty <= Math.floor((this.y + this.h - 1) / TILE);
      ty++
    )
      for (
        let tx = Math.floor(this.x / TILE);
        tx <= Math.floor((this.x + this.w - 1) / TILE);
        tx++
      ) {
        if (tx < 0 || tx >= cols || ty < 0 || ty >= rows) continue;
        if (map[ty * cols + tx] > 0) {
          if (this.vx > 0) this.x = tx * TILE - this.w;
          else if (this.vx < 0) this.x = (tx + 1) * TILE;
        }
      }
  }

  colY(lv) {
    const { cols, rows, map } = lv;
    this.ground = false;
    for (
      let ty = Math.floor(this.y / TILE);
      ty <= Math.floor((this.y + this.h - 1) / TILE);
      ty++
    )
      for (
        let tx = Math.floor((this.x + 2) / TILE);
        tx <= Math.floor((this.x + this.w - 3) / TILE);
        tx++
      ) {
        if (tx < 0 || tx >= cols || ty < 0 || ty >= rows) continue;
        if (map[ty * cols + tx] > 0) {
          if (this.vy > 0) {
            this.y = ty * TILE - this.h;
            this.vy = 0;
            this.ground = true;
          } else if (this.vy < 0) {
            this.y = (ty + 1) * TILE;
            this.vy = 0;
          }
        }
      }
  }

  damage(n) {
    if (this.inv > 0) return;
    this.hp -= n;
    this.inv = 1;
    Audio.playHit();
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
  }

  getAtkRect() {
    if (!this.attacking || this.atkTimer < 0.1) return null;
    const ox = this.right ? this.w : -40;
    return { x: this.x + ox, y: this.y + 5, w: 40, h: 40 };
  }

  draw(ctx, cx, cy) {
    if (this.inv > 0 && Math.floor(this.inv * 10) % 2) return;
    const sheets = {
      idle: images.idle,
      run: images.run,
      attack: images.attack,
      jump: images.jump,
    };
    drawFrame(
      ctx,
      sheets[this.state] || images.idle,
      this.frame,
      Math.round(this.x - cx - 65),
      Math.round(this.y - cy - 40),
      !this.right,
    );
  }

  getRect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}

// ---- Enemy ----
class CemeteryEnemy {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.active = true;
    this.frame = 0;
    this.ft = 0;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.right = this.dir > 0;
    this.startX = x;
    this.hp =
      type === "skeleton_clothed"
        ? 2
        : type === "ghost"
          ? 2
          : type === "hellgato"
            ? 2
            : 1;
    this.flash = 0;
    this.time = Math.random() * 6;

    switch (type) {
      case "skeleton":
      case "skeleton_clothed":
        this.w = 30;
        this.h = 44;
        this.speed = 30;
        break;
      case "ghost":
        this.w = 28;
        this.h = 50;
        this.speed = 40;
        this.baseY = y;
        break;
      case "hellgato":
        this.w = 50;
        this.h = 40;
        this.speed = 70;
        break;
    }
  }

  update(dt, px, py) {
    this.time += dt;
    this.ft += dt;
    this.flash = Math.max(0, this.flash - dt);
    if (this.ft > 0.15) {
      this.ft = 0;
      this.frame = (this.frame + 1) % 4;
    }

    if (this.type === "ghost") {
      const dx = px - this.x,
        dy = py - this.y,
        d = Math.sqrt(dx * dx + dy * dy);
      if (d < 180 && d > 0) {
        this.x += (dx / d) * this.speed * dt;
        this.y += (dy / d) * this.speed * dt;
        this.right = dx > 0;
      } else this.y = this.baseY + Math.sin(this.time * 2) * 20;
    } else {
      this.x += this.dir * this.speed * dt;
      this.right = this.dir > 0;
      if (Math.abs(this.x - this.startX) > 80) this.dir *= -1;
    }
  }

  hit(n) {
    this.hp -= n;
    this.flash = 0.15;
    if (this.hp <= 0) {
      this.active = false;
      return true;
    }
    return false;
  }

  draw(ctx, cx, cy) {
    if (this.flash > 0 && Math.floor(this.flash * 20) % 2) return;
    // Draw enemies as colored rectangles with type label since individual sprite frames vary
    const colors = {
      skeleton: "#aaa",
      skeleton_clothed: "#88a",
      ghost: "#88f",
      hellgato: "#f44",
    };
    if (this.type === "ghost") ctx.globalAlpha = 0.6;
    ctx.fillStyle = colors[this.type] || "#f00";
    const dx = Math.round(this.x - cx),
      dy = Math.round(this.y - cy);
    ctx.fillRect(dx, dy, this.w, this.h);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.strokeRect(dx, dy, this.w, this.h);
    // Eyes
    ctx.fillStyle = this.type === "ghost" ? "#fff" : "#f00";
    const eyeX = this.right ? dx + this.w - 12 : dx + 4;
    ctx.fillRect(eyeX, dy + 8, 4, 4);
    ctx.fillRect(eyeX + 6, dy + 8, 4, 4);
    ctx.globalAlpha = 1;
  }

  getRect() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
}

// ---- Game State ----
const gs = {
  hero: null,
  enemies: [],
  particles: null,
  deathFX: [],
  cx: 0,
  cy: 0,
  lv: 0,
  score: 0,
  shake: 0,
};

function loadLv(i) {
  const l = LEVELS[i];
  gs.hero = new Hero(l.startX, l.startY);
  gs.enemies = l.enemies.map((e) => new CemeteryEnemy(e.x, e.y, e.type));
  gs.particles = new ParticleEmitter();
  gs.deathFX = [];
  gs.cx = 0;
  gs.cy = 0;
}

const sm = new StateMachine();
let game;

sm.add("loading", {
  render(ctx) {
    ctx.fillStyle = "#0a0508";
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    UI.drawCenteredText(ctx, "Loading...", GAME_W, GAME_H / 2, {
      font: "12px monospace",
      color: "#a88",
    });
  },
});

sm.add("menu", {
  update() {
    if (Input.justPressed("Space") || Input.justPressed("Enter")) {
      gs.lv = 0;
      gs.score = 0;
      loadLv(0);
      sm.switch("playing", game);
    }
  },
  render(ctx) {
    drawBg(ctx, 0);
    UI.drawOverlay(ctx, GAME_W, GAME_H, 0.4);
    UI.drawCenteredText(ctx, "GOTHICVANIA CEMETERY", GAME_W, 50, {
      font: "bold 20px monospace",
      color: "#c44",
      outline: "#200",
    });
    if (images.idle) {
      const f = Math.floor(Date.now() / 150) % 4;
      drawFrame(ctx, images.idle, f, GAME_W / 2 - 80, 80, false);
    }
    UI.drawCenteredText(
      ctx,
      "Arrows: Move | Space: Jump | X: Attack",
      GAME_W,
      190,
      { font: "9px monospace", color: "#a86" },
    );
    UI.drawCenteredText(ctx, "3 Levels - Defeat the undead!", GAME_W, 210, {
      font: "9px monospace",
      color: "#f80",
    });
    if (UI.blink(Date.now() / 1000, 2))
      UI.drawCenteredText(ctx, "PRESS SPACE", GAME_W, GAME_H - 25, {
        font: "11px monospace",
        color: "#fff",
      });
  },
});

sm.add("playing", {
  update(dt) {
    const h = gs.hero,
      lv = LEVELS[gs.lv];
    if (Input.justPressed("Escape")) {
      sm.switch("paused", game);
      return;
    }

    h.update(dt, lv);
    gs.cx = Utils.lerp(gs.cx, h.x - GAME_W / 2, dt * 5);
    gs.cy = Utils.lerp(gs.cy, h.y - GAME_H / 2, dt * 5);
    gs.cx = Utils.clamp(gs.cx, 0, lv.cols * TILE - GAME_W);
    gs.cy = Utils.clamp(gs.cy, 0, Math.max(0, lv.rows * TILE - GAME_H));
    gs.shake = Math.max(0, gs.shake - dt);

    const atkRect = h.getAtkRect();
    for (const e of gs.enemies) {
      e.update(dt, h.x, h.y);
      if (
        h.alive &&
        h.inv <= 0 &&
        Collision.rectRect(h.getRect(), e.getRect())
      ) {
        h.damage(1);
        gs.shake = 0.2;
      }
      if (atkRect && !h.atkHit && Collision.rectRect(atkRect, e.getRect())) {
        h.atkHit = true;
        if (e.hit(1)) {
          gs.score += 200;
          gs.particles.emit(e.x + e.w / 2, e.y + e.h / 2, {
            count: 15,
            speed: 120,
            colors: ["#f44", "#f80", "#ff0"],
            life: 0.5,
            gravity: 200,
          });
          Audio.playExplosion();
        } else Audio.playHit();
      }
    }

    gs.particles.update(dt);
    gs.enemies = gs.enemies.filter((e) => e.active);

    if (
      h.alive &&
      Math.abs(h.x - lv.exitX) < 24 &&
      Math.abs(h.y - lv.exitY) < 24
    ) {
      gs.score += 500;
      if (gs.lv < LEVELS.length - 1) {
        gs.lv++;
        const hp = h.hp;
        loadLv(gs.lv);
        gs.hero.hp = hp;
      } else sm.switch("victory", game);
    }
    if (!h.alive || h.y > lv.rows * TILE + 50) sm.switch("gameover", game);
  },
  render(ctx) {
    ctx.save();
    if (gs.shake > 0)
      ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
    drawBg(ctx, gs.cx);
    drawTiles(ctx, LEVELS[gs.lv], gs.cx, gs.cy);

    const lv = LEVELS[gs.lv];
    const ex = lv.exitX - gs.cx,
      ey = lv.exitY - gs.cy;
    ctx.fillStyle = `rgba(255, 100, 100, ${0.4 + Math.sin(Date.now() / 200) * 0.2})`;
    ctx.fillRect(ex, ey, 20, 20);
    UI.drawText(ctx, "EXIT", ex - 2, ey - 8, {
      font: "7px monospace",
      color: "#f88",
    });

    for (const e of gs.enemies) e.draw(ctx, gs.cx, gs.cy);
    gs.hero.draw(ctx, gs.cx, gs.cy);

    // Attack hitbox visualization (debug-style)
    const ar = gs.hero.getAtkRect();
    if (ar) {
      ctx.strokeStyle = "rgba(255,255,0,0.3)";
      ctx.lineWidth = 1;
      ctx.strokeRect(ar.x - gs.cx, ar.y - gs.cy, ar.w, ar.h);
    }

    ctx.save();
    ctx.translate(-gs.cx, -gs.cy);
    gs.particles.draw(ctx);
    ctx.restore();
    ctx.restore();

    UI.drawHealthBar(ctx, 4, 4, 60, 8, gs.hero.hp, MAX_HP, "#f00", "#400");
    UI.drawText(ctx, "Score: " + gs.score, GAME_W - 4, 4, {
      font: "9px monospace",
      color: "#ff0",
      align: "right",
    });
    UI.drawText(ctx, "Lv " + (gs.lv + 1) + "/3", 4, 16, {
      font: "8px monospace",
      color: "#c88",
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
    ctx.fillStyle = "#0a0508";
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    UI.drawCenteredText(ctx, "GAME OVER", GAME_W, 80, {
      font: "bold 22px monospace",
      color: "#f44",
    });
    UI.drawCenteredText(ctx, "Score: " + gs.score, GAME_W, 130, {
      font: "16px monospace",
      color: "#ff0",
    });
    if (this.t > 1 && UI.blink(Date.now() / 1000, 2))
      UI.drawCenteredText(ctx, "SPACE to retry", GAME_W, 180, {
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
    ctx.fillStyle = "#050a08";
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    UI.drawCenteredText(ctx, "VICTORY!", GAME_W, 60, {
      font: "bold 22px monospace",
      color: "#0f0",
    });
    UI.drawCenteredText(ctx, "The cemetery is cleansed!", GAME_W, 100, {
      font: "12px monospace",
      color: "#8f8",
    });
    UI.drawCenteredText(ctx, "Final Score: " + gs.score, GAME_W, 140, {
      font: "bold 16px monospace",
      color: "#ff0",
    });
    if (this.t > 2 && UI.blink(Date.now() / 1000, 2))
      UI.drawCenteredText(ctx, "SPACE to play again", GAME_W, 200, {
        font: "10px monospace",
        color: "#fff",
      });
  },
});

function drawBg(ctx, camX) {
  // 3-layer parallax: background, mountains, graveyard
  const layers = [
    [images.bg, 0.05],
    [images.mountains, 0.2],
    [images.graveyard, 0.5],
  ];
  for (const [img, spd] of layers) {
    if (!img) continue;
    const scroll = (camX * spd) % img.width;
    for (let x = -scroll; x < GAME_W; x += img.width)
      ctx.drawImage(img, x, GAME_H - img.height);
  }
}

function drawTiles(ctx, lv, cx, cy) {
  const { cols, rows, map } = lv;
  const ts = images.tileset;
  const tCols = ts ? Math.floor(ts.width / TILE) : 1;
  const sc = Math.max(0, Math.floor(cx / TILE)),
    sr = Math.max(0, Math.floor(cy / TILE));
  const ec = Math.min(cols, Math.ceil((cx + GAME_W) / TILE) + 1);
  const er = Math.min(rows, Math.ceil((cy + GAME_H) / TILE) + 1);

  for (let r = sr; r < er; r++)
    for (let c = sc; c < ec; c++) {
      const t = map[r * cols + c];
      if (t <= 0) continue;
      const dx = c * TILE - Math.round(cx),
        dy = r * TILE - Math.round(cy);
      if (ts) {
        const ti = (t - 1) % tCols,
          tr2 = Math.floor((t - 1) / tCols);
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
        ctx.fillStyle = t === 1 ? "#333" : t === 2 ? "#444" : "#555";
        ctx.fillRect(dx, dy, TILE, TILE);
      }
    }
}

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
