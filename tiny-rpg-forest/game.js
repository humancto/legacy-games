// Tiny RPG Forest - Top-Down RPG
(function () {
  const W = 320,
    H = 240;
  const TILE = 16;
  const COLS = 20,
    ROWS = 15;
  // Hero: 32x32 per frame, walk sheets 192x32 = 6 frames, attack sheets 96x32 = 3 frames
  const HERO_W = 32,
    HERO_H = 32;
  // Mole: 24x24, walk 96x24 = 4 frames
  const MOLE_W = 24,
    MOLE_H = 24;
  // Treant: 31x35, walk 124x35 = 4 frames
  const TREANT_W = 31,
    TREANT_H = 35;
  // Coin: 20x7 = 4 frames of 5x7
  const COIN_FW = 5,
    COIN_FH = 7;
  // Gem: 28x7 = 4 frames of 7x7
  const GEM_FW = 7,
    GEM_FH = 7;
  // Arrow: 5x19
  const ARROW_W = 5,
    ARROW_H = 19;
  // Enemy death: 180x32 = 6 frames of 30x32
  const DEATH_FW = 30,
    DEATH_FH = 32;
  // Heart: 7x6
  const HEART_W = 7,
    HEART_H = 6;

  // Tileset: 544x512, 16x16 tiles = 34 cols
  const TS_COLS = 34;

  // Directions
  const DIR = { DOWN: 0, UP: 1, LEFT: 2, RIGHT: 3 };

  // ---- Assets ----
  const imgs = {};
  const assetList = [
    "hero-idle-front",
    "hero-idle-back",
    "hero-idle-side",
    "hero-walk-front",
    "hero-walk-back",
    "hero-walk-side",
    "hero-attack-front",
    "hero-attack-back",
    "hero-attack-side",
    "hero-attack-front-weapon",
    "hero-attack-back-weapon",
    "hero-attack-side-weapon",
    "coin",
    "gem",
    "enemy-death",
    "mole-idle-front",
    "mole-idle-back",
    "mole-idle-side",
    "mole-walk-front",
    "mole-walk-back",
    "mole-walk-side",
    "treant-idle-front",
    "treant-idle-back",
    "treant-idle-side",
    "treant-walk-front",
    "treant-walk-back",
    "treant-walk-side",
    "tileset",
    "arrow",
    "heart-full",
    "heart-empty",
    "tree-orange",
    "tree-pink",
    "bush",
    "rock",
    "sign",
    "waterfall-1",
    "waterfall-2",
    "waterfall-3",
  ];

  let loaded = 0;
  function loadAssets(cb) {
    assetList.forEach((name) => {
      const img = new Image();
      img.onload = () => {
        loaded++;
        if (loaded >= assetList.length) cb();
      };
      img.onerror = () => {
        loaded++;
        if (loaded >= assetList.length) cb();
      };
      img.src = "assets/" + name + ".png";
      imgs[name] = img;
    });
  }

  // ---- Draw helpers ----
  function drawFrame(ctx, img, fw, fh, frame, dx, dy, flipX) {
    ctx.save();
    if (flipX) {
      ctx.translate(dx + fw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(img, frame * fw, 0, fw, fh, 0, 0, fw, fh);
    } else {
      ctx.drawImage(img, frame * fw, 0, fw, fh, dx, dy, fw, fh);
    }
    ctx.restore();
  }

  function drawTile(ctx, tileId, dx, dy) {
    if (tileId < 0) return;
    const sx = (tileId % TS_COLS) * TILE;
    const sy = Math.floor(tileId / TS_COLS) * TILE;
    ctx.drawImage(imgs["tileset"], sx, sy, TILE, TILE, dx, dy, TILE, TILE);
  }

  // ---- Level Generation ----
  // Each area is COLS x ROWS tiles
  // Tile IDs from the tileset:
  // Looking at the tileset (544x512, 34 cols):
  // Row 0 (y=0): grass variations
  // We'll use a few tile IDs for the terrain
  const T = {
    GRASS1: 0, // top-left grass
    GRASS2: 1,
    GRASS3: 2,
    GRASS4: 34, // row 1
    GRASS5: 35,
    GRASS6: 36,
    PATH1: 3,
    PATH2: 4,
    WATER1: 7,
    WATER2: 8,
    WALL1: 68, // row 2
    WALL2: 69,
    TREE: 10,
    FLOWER1: 5,
    FLOWER2: 6,
    DARK_GRASS: 70,
    DIRT1: 37,
    DIRT2: 38,
    BRIDGE: 39,
  };

  const SOLID_TILES = new Set([T.WATER1, T.WATER2, T.WALL1, T.WALL2, T.TREE]);

  function generateArea(areaIndex) {
    const tiles = [];
    // Base grass fill
    for (let y = 0; y < ROWS; y++) {
      tiles[y] = [];
      for (let x = 0; x < COLS; x++) {
        const r = Math.random();
        if (r < 0.6) tiles[y][x] = T.GRASS1;
        else if (r < 0.75) tiles[y][x] = T.GRASS2;
        else if (r < 0.85) tiles[y][x] = T.GRASS4;
        else if (r < 0.92) tiles[y][x] = T.FLOWER1;
        else tiles[y][x] = T.FLOWER2;
      }
    }

    // Border walls (top/bottom)
    for (let x = 0; x < COLS; x++) {
      tiles[0][x] = T.WALL1;
      tiles[ROWS - 1][x] = T.WALL2;
    }
    for (let y = 0; y < ROWS; y++) {
      tiles[y][0] = T.WALL1;
      tiles[y][COLS - 1] = T.WALL2;
    }

    // Path through center
    const pathY = Math.floor(ROWS / 2);
    for (let x = 1; x < COLS - 1; x++) {
      tiles[pathY][x] = T.PATH1;
      if (pathY - 1 > 0) tiles[pathY - 1][x] = T.DIRT1;
      if (pathY + 1 < ROWS - 1) tiles[pathY + 1][x] = T.DIRT2;
    }

    // Area-specific features
    if (areaIndex === 0) {
      // Starting meadow - pond
      for (let y = 3; y <= 5; y++) {
        for (let x = 12; x <= 15; x++) {
          tiles[y][x] = T.WATER1;
        }
      }
      // Bridge over pond
      tiles[pathY][13] = T.BRIDGE;
      tiles[pathY][14] = T.BRIDGE;
      // Openings for exits
      tiles[pathY][COLS - 1] = T.PATH1; // right exit
      tiles[ROWS - 1][10] = T.PATH1; // bottom exit
    } else if (areaIndex === 1) {
      // Dense forest
      for (let i = 0; i < 8; i++) {
        const tx = 2 + Math.floor(Math.random() * (COLS - 4));
        const ty = 2 + Math.floor(Math.random() * (ROWS - 4));
        if (ty !== pathY && ty !== pathY - 1 && ty !== pathY + 1) {
          tiles[ty][tx] = T.TREE;
        }
      }
      tiles[pathY][0] = T.PATH1; // left entrance
      tiles[pathY][COLS - 1] = T.PATH1; // right exit
      tiles[0][10] = T.PATH1; // top exit
    } else if (areaIndex === 2) {
      // Mystic clearing
      // Water stream
      for (let y = 2; y < ROWS - 2; y++) {
        tiles[y][8] = T.WATER1;
        tiles[y][9] = T.WATER2;
      }
      tiles[pathY][8] = T.BRIDGE;
      tiles[pathY][9] = T.BRIDGE;
      tiles[pathY][0] = T.PATH1; // left entrance
      tiles[0][10] = T.PATH1; // top exit
      tiles[ROWS - 1][10] = T.PATH1; // bottom exit from area 0
    }

    return tiles;
  }

  // ---- Decorations (drawn above tiles) ----
  function generateDecorations(areaIndex) {
    const decs = [];
    const count = 5 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      const types = ["tree-orange", "tree-pink", "bush", "rock"];
      const type = types[Math.floor(Math.random() * types.length)];
      const x = 24 + Math.random() * (COLS * TILE - 80);
      const y = 24 + Math.random() * (ROWS * TILE - 80);
      // Don't place on path
      const ty = Math.floor(y / TILE);
      if (ty >= Math.floor(ROWS / 2) - 1 && ty <= Math.floor(ROWS / 2) + 1)
        continue;
      decs.push({ type, x, y });
    }
    return decs;
  }

  // ---- Collectibles ----
  function generateCollectibles(areaIndex) {
    const items = [];
    const coinCount = 5 + areaIndex * 3;
    for (let i = 0; i < coinCount; i++) {
      const x = 24 + Math.random() * (COLS * TILE - 48);
      const y = 24 + Math.random() * (ROWS * TILE - 48);
      const ty = Math.floor(y / TILE);
      const tx = Math.floor(x / TILE);
      if (ty === 0 || ty === ROWS - 1 || tx === 0 || tx === COLS - 1) continue;
      items.push({
        type: Math.random() < 0.3 ? "gem" : "coin",
        x,
        y,
        frame: 0,
        timer: 0,
        collected: false,
      });
    }
    return items;
  }

  // ---- Enemy spawning ----
  function spawnEnemies(areaIndex) {
    const enemies = [];
    const moleCount = 2 + areaIndex;
    const treantCount = 1 + areaIndex;

    for (let i = 0; i < moleCount; i++) {
      enemies.push(createMole(areaIndex));
    }
    for (let i = 0; i < treantCount; i++) {
      enemies.push(createTreant(areaIndex));
    }
    return enemies;
  }

  function createMole(areaIndex) {
    const pathY = Math.floor(ROWS / 2);
    let x, y;
    do {
      x = 40 + Math.random() * (COLS * TILE - 80);
      y = 40 + Math.random() * (ROWS * TILE - 80);
    } while (
      Math.abs(Math.floor(y / TILE) - pathY) < 2 ||
      Math.floor(y / TILE) === 0 ||
      Math.floor(y / TILE) === ROWS - 1
    );

    return {
      type: "mole",
      x,
      y,
      w: MOLE_W,
      h: MOLE_H,
      hp: 2,
      maxHp: 2,
      speed: 1.2,
      dir: DIR.DOWN,
      frame: 0,
      timer: 0,
      state: "idle",
      moveTimer: 0,
      moveDir: { x: 0, y: 0 },
      hurtTimer: 0,
      dying: false,
      deathFrame: 0,
      deathTimer: 0,
      xp: 10,
    };
  }

  function createTreant(areaIndex) {
    const pathY = Math.floor(ROWS / 2);
    let x, y;
    do {
      x = 40 + Math.random() * (COLS * TILE - 80);
      y = 40 + Math.random() * (ROWS * TILE - 80);
    } while (
      Math.abs(Math.floor(y / TILE) - pathY) < 2 ||
      Math.floor(y / TILE) === 0 ||
      Math.floor(y / TILE) === ROWS - 1
    );

    return {
      type: "treant",
      x,
      y,
      w: TREANT_W,
      h: TREANT_H,
      hp: 5,
      maxHp: 5,
      speed: 0.5,
      dir: DIR.DOWN,
      frame: 0,
      timer: 0,
      state: "idle",
      moveTimer: 0,
      moveDir: { x: 0, y: 0 },
      hurtTimer: 0,
      dying: false,
      deathFrame: 0,
      deathTimer: 0,
      xp: 25,
    };
  }

  // ---- Game State ----
  let state, player, areas, currentArea, camera;
  let arrows, particles, collectibles, enemies, decorations;
  let score, xp, level, maxHp, bestScore;
  let screenFlash, screenFlashTimer;
  let levelUpTimer;

  function initGame() {
    bestScore = parseInt(localStorage.getItem("tinyRpgBest") || "0");
    resetGame();
  }

  function resetGame() {
    state = "menu";
    player = {
      x: 80,
      y: ROWS * TILE * 0.5,
      w: 16,
      h: 16, // collision box (smaller than sprite)
      dir: DIR.DOWN,
      frame: 0,
      timer: 0,
      moving: false,
      attacking: false,
      attackTimer: 0,
      attackFrame: 0,
      weaponAttack: false,
      hp: 5,
      hurtTimer: 0,
      speed: 1.5,
      invincible: 0,
    };
    maxHp = 5;
    score = 0;
    xp = 0;
    level = 1;
    screenFlash = 0;
    screenFlashTimer = 0;
    levelUpTimer = 0;
    arrows = [];
    particles = [];

    // Generate 3 areas
    areas = [];
    for (let i = 0; i < 3; i++) {
      areas.push({
        tiles: generateArea(i),
        enemies: spawnEnemies(i),
        collectibles: generateCollectibles(i),
        decorations: generateDecorations(i),
        cleared: false,
      });
    }
    currentArea = 0;
    collectibles = areas[0].collectibles;
    enemies = areas[0].enemies;
    decorations = areas[0].decorations;

    camera = { x: 0, y: 0 };
  }

  function switchArea(newArea, spawnX, spawnY) {
    currentArea = newArea;
    collectibles = areas[newArea].collectibles;
    enemies = areas[newArea].enemies;
    decorations = areas[newArea].decorations;
    player.x = spawnX;
    player.y = spawnY;
    arrows = [];
    Audio.playTone(440, 0.1, "sine");
    setTimeout(() => Audio.playTone(554, 0.1, "sine"), 100);
    setTimeout(() => Audio.playTone(660, 0.1, "sine"), 200);
  }

  // ---- Collision with tiles ----
  function isSolid(tx, ty) {
    if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return true;
    const tile = areas[currentArea].tiles[ty][tx];
    return SOLID_TILES.has(tile);
  }

  function canMove(x, y, w, h) {
    // Check all 4 corners of the collision box
    const margin = 2;
    const l = x + margin,
      r = x + w - margin;
    const t = y + margin,
      b = y + h - margin;
    return (
      !isSolid(Math.floor(l / TILE), Math.floor(t / TILE)) &&
      !isSolid(Math.floor(r / TILE), Math.floor(t / TILE)) &&
      !isSolid(Math.floor(l / TILE), Math.floor(b / TILE)) &&
      !isSolid(Math.floor(r / TILE), Math.floor(b / TILE))
    );
  }

  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
    );
  }

  // ---- XP / Level Up ----
  function addXP(amount) {
    xp += amount;
    const needed = level * 50;
    if (xp >= needed) {
      xp -= needed;
      level++;
      maxHp++;
      player.hp = Math.min(player.hp + 2, maxHp);
      levelUpTimer = 120;
      Audio.playTone(523, 0.15, "sine");
      setTimeout(() => Audio.playTone(659, 0.15, "sine"), 100);
      setTimeout(() => Audio.playTone(784, 0.15, "sine"), 200);
      setTimeout(() => Audio.playTone(1047, 0.2, "sine"), 300);
    }
  }

  // ---- Update ----
  function update(dt) {
    if (state === "menu") {
      if (Keyboard.justPressed("Space") || Keyboard.justPressed("Enter")) {
        state = "playing";
        resetGame();
        state = "playing";
      }
      return;
    }

    if (state === "gameover") {
      if (Keyboard.justPressed("Space") || Keyboard.justPressed("Enter")) {
        resetGame();
        state = "playing";
      }
      return;
    }

    if (state !== "playing") return;

    // Level up display
    if (levelUpTimer > 0) levelUpTimer--;

    // Screen flash
    if (screenFlashTimer > 0) screenFlashTimer--;

    // Player invincibility
    if (player.invincible > 0) player.invincible--;
    if (player.hurtTimer > 0) player.hurtTimer--;

    // ---- Player movement ----
    let dx = 0,
      dy = 0;
    if (!player.attacking) {
      if (Keyboard.isDown("ArrowLeft") || Keyboard.isDown("KeyA")) {
        dx = -1;
        player.dir = DIR.LEFT;
      }
      if (Keyboard.isDown("ArrowRight") || Keyboard.isDown("KeyD")) {
        dx = 1;
        player.dir = DIR.RIGHT;
      }
      if (Keyboard.isDown("ArrowUp") || Keyboard.isDown("KeyW")) {
        dy = -1;
        player.dir = DIR.UP;
      }
      if (Keyboard.isDown("ArrowDown") || Keyboard.isDown("KeyS")) {
        dy = 1;
        player.dir = DIR.DOWN;
      }

      // Normalize diagonal
      if (dx !== 0 && dy !== 0) {
        dx *= 0.707;
        dy *= 0.707;
      }

      player.moving = dx !== 0 || dy !== 0;

      if (player.moving) {
        const newX = player.x + dx * player.speed;
        const newY = player.y + dy * player.speed;
        // Collision box offset (centered in 32x32 sprite)
        const boxOffX = 8,
          boxOffY = 12;
        if (canMove(newX + boxOffX, player.y + boxOffY, player.w, player.h)) {
          player.x = newX;
        }
        if (canMove(player.x + boxOffX, newY + boxOffY, player.w, player.h)) {
          player.y = newY;
        }
      }

      // Walk animation
      if (player.moving) {
        player.timer++;
        if (player.timer >= 8) {
          player.timer = 0;
          player.frame = (player.frame + 1) % 6;
        }
      } else {
        player.frame = 0;
        player.timer = 0;
      }

      // Attack: Z = melee, X = weapon melee, C = arrow
      if (Keyboard.justPressed("KeyZ") || Keyboard.justPressed("Space")) {
        player.attacking = true;
        player.weaponAttack = false;
        player.attackFrame = 0;
        player.attackTimer = 0;
        Audio.playTone(200, 0.08, "sawtooth");
      } else if (Keyboard.justPressed("KeyX")) {
        player.attacking = true;
        player.weaponAttack = true;
        player.attackFrame = 0;
        player.attackTimer = 0;
        Audio.playTone(300, 0.1, "square");
      } else if (Keyboard.justPressed("KeyC")) {
        // Shoot arrow
        let adx = 0,
          ady = 0;
        if (player.dir === DIR.UP) ady = -3;
        else if (player.dir === DIR.DOWN) ady = 3;
        else if (player.dir === DIR.LEFT) adx = -3;
        else adx = 3;
        arrows.push({
          x: player.x + 14,
          y: player.y + 10,
          dx: adx,
          dy: ady,
          life: 60,
          dir: player.dir,
        });
        Audio.playTone(800, 0.06, "triangle");
      }
    } else {
      // Attack animation
      player.attackTimer++;
      if (player.attackTimer >= 6) {
        player.attackTimer = 0;
        player.attackFrame++;
        if (player.attackFrame >= 3) {
          player.attacking = false;
          player.attackFrame = 0;
        }
      }

      // Hitbox on frame 1
      if (player.attackFrame === 1 && player.attackTimer === 0) {
        const hitRange = player.weaponAttack ? 22 : 18;
        let hx = player.x + 8,
          hy = player.y + 8;
        if (player.dir === DIR.UP) hy -= hitRange;
        else if (player.dir === DIR.DOWN) hy += hitRange;
        else if (player.dir === DIR.LEFT) hx -= hitRange;
        else hx += hitRange;

        const hitBox = { x: hx, y: hy, w: 16, h: 16 };
        const dmg = player.weaponAttack ? 3 : 1;

        enemies.forEach((e) => {
          if (e.dying || e.hp <= 0) return;
          const eBox = { x: e.x, y: e.y, w: e.w, h: e.h };
          if (rectsOverlap(hitBox, eBox)) {
            e.hp -= dmg;
            e.hurtTimer = 10;
            if (e.hp <= 0) {
              e.dying = true;
              e.deathFrame = 0;
              e.deathTimer = 0;
              score += e.type === "treant" ? 200 : 100;
              addXP(e.xp);
              Audio.playTone(150, 0.15, "sawtooth");
              // Drop coin
              collectibles.push({
                type: "coin",
                x: e.x,
                y: e.y,
                frame: 0,
                timer: 0,
                collected: false,
              });
            } else {
              Audio.playTone(400, 0.05, "square");
            }
          }
        });
      }
    }

    // ---- Arrows ----
    for (let i = arrows.length - 1; i >= 0; i--) {
      const a = arrows[i];
      a.x += a.dx;
      a.y += a.dy;
      a.life--;
      if (a.life <= 0) {
        arrows.splice(i, 1);
        continue;
      }
      // Check tile collision
      const tx = Math.floor((a.x + 2) / TILE);
      const ty = Math.floor((a.y + 2) / TILE);
      if (isSolid(tx, ty)) {
        arrows.splice(i, 1);
        continue;
      }
      // Check enemy collision
      let hit = false;
      enemies.forEach((e) => {
        if (e.dying || e.hp <= 0) return;
        if (a.x > e.x && a.x < e.x + e.w && a.y > e.y && a.y < e.y + e.h) {
          e.hp -= 2;
          e.hurtTimer = 10;
          hit = true;
          if (e.hp <= 0) {
            e.dying = true;
            e.deathFrame = 0;
            e.deathTimer = 0;
            score += e.type === "treant" ? 200 : 100;
            addXP(e.xp);
            Audio.playTone(150, 0.15, "sawtooth");
            collectibles.push({
              type: Math.random() < 0.3 ? "gem" : "coin",
              x: e.x,
              y: e.y,
              frame: 0,
              timer: 0,
              collected: false,
            });
          } else {
            Audio.playTone(400, 0.05, "square");
          }
        }
      });
      if (hit) arrows.splice(i, 1);
    }

    // ---- Enemies ----
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];

      if (e.dying) {
        e.deathTimer++;
        if (e.deathTimer >= 6) {
          e.deathTimer = 0;
          e.deathFrame++;
          if (e.deathFrame >= 6) {
            enemies.splice(i, 1);
            continue;
          }
        }
        continue;
      }

      if (e.hurtTimer > 0) {
        e.hurtTimer--;
        continue;
      }

      // AI: random wander + chase player when close
      const distX = player.x - e.x;
      const distY = player.y - e.y;
      const dist = Math.sqrt(distX * distX + distY * distY);
      const chaseRange = e.type === "mole" ? 80 : 60;

      if (dist < chaseRange) {
        // Chase player
        e.state = "walk";
        const nd = Math.sqrt(distX * distX + distY * distY) || 1;
        e.moveDir.x = (distX / nd) * e.speed;
        e.moveDir.y = (distY / nd) * e.speed;

        // Update direction
        if (Math.abs(distX) > Math.abs(distY)) {
          e.dir = distX > 0 ? DIR.RIGHT : DIR.LEFT;
        } else {
          e.dir = distY > 0 ? DIR.DOWN : DIR.UP;
        }
      } else {
        // Random wander
        e.moveTimer--;
        if (e.moveTimer <= 0) {
          if (Math.random() < 0.4) {
            e.state = "idle";
            e.moveDir.x = 0;
            e.moveDir.y = 0;
          } else {
            e.state = "walk";
            const angle = Math.random() * Math.PI * 2;
            e.moveDir.x = Math.cos(angle) * e.speed;
            e.moveDir.y = Math.sin(angle) * e.speed;
            if (Math.abs(e.moveDir.x) > Math.abs(e.moveDir.y)) {
              e.dir = e.moveDir.x > 0 ? DIR.RIGHT : DIR.LEFT;
            } else {
              e.dir = e.moveDir.y > 0 ? DIR.DOWN : DIR.UP;
            }
          }
          e.moveTimer = 30 + Math.random() * 60;
        }
      }

      // Move
      if (e.state === "walk") {
        const newX = e.x + e.moveDir.x;
        const newY = e.y + e.moveDir.y;
        // Clamp to area
        if (newX > TILE && newX < (COLS - 1) * TILE - e.w) e.x = newX;
        if (newY > TILE && newY < (ROWS - 1) * TILE - e.h) e.y = newY;

        e.timer++;
        if (e.timer >= 10) {
          e.timer = 0;
          e.frame = (e.frame + 1) % 4;
        }
      } else {
        e.frame = 0;
      }

      // Damage player on contact
      if (player.invincible <= 0 && !player.attacking) {
        const pBox = {
          x: player.x + 8,
          y: player.y + 12,
          w: player.w,
          h: player.h,
        };
        const eBox = { x: e.x, y: e.y, w: e.w, h: e.h };
        if (rectsOverlap(pBox, eBox)) {
          player.hp--;
          player.hurtTimer = 20;
          player.invincible = 60;
          screenFlash = 1;
          screenFlashTimer = 6;
          Audio.playTone(100, 0.2, "sawtooth");
          if (player.hp <= 0) {
            if (score > bestScore) {
              bestScore = score;
              localStorage.setItem("tinyRpgBest", bestScore.toString());
            }
            state = "gameover";
          }
        }
      }
    }

    // ---- Collectibles ----
    collectibles.forEach((c) => {
      if (c.collected) return;
      c.timer++;
      if (c.timer >= 10) {
        c.timer = 0;
        c.frame = (c.frame + 1) % 4;
      }
      // Pickup
      const pBox = {
        x: player.x + 8,
        y: player.y + 12,
        w: player.w,
        h: player.h,
      };
      const cBox = { x: c.x, y: c.y, w: 8, h: 8 };
      if (rectsOverlap(pBox, cBox)) {
        c.collected = true;
        if (c.type === "coin") {
          score += 10;
          Audio.playTone(880, 0.06, "sine");
          setTimeout(() => Audio.playTone(1100, 0.06, "sine"), 60);
        } else {
          score += 50;
          // Gems restore 1 HP
          player.hp = Math.min(player.hp + 1, maxHp);
          Audio.playTone(660, 0.08, "sine");
          setTimeout(() => Audio.playTone(880, 0.08, "sine"), 60);
          setTimeout(() => Audio.playTone(1100, 0.08, "sine"), 120);
        }
      }
    });
    // Remove collected
    for (let i = collectibles.length - 1; i >= 0; i--) {
      if (collectibles[i].collected) collectibles.splice(i, 1);
    }

    // ---- Area transitions ----
    const boxX = player.x + 8,
      boxY = player.y + 12;
    if (currentArea === 0) {
      // Right exit -> area 1
      if (boxX + player.w > COLS * TILE - 4) {
        switchArea(1, TILE + 4, Math.floor(ROWS / 2) * TILE);
      }
      // Bottom exit -> area 2
      if (boxY + player.h > ROWS * TILE - 4) {
        switchArea(2, 10 * TILE, TILE + 4);
      }
    } else if (currentArea === 1) {
      // Left exit -> area 0
      if (boxX < 4) {
        switchArea(0, (COLS - 2) * TILE, Math.floor(ROWS / 2) * TILE);
      }
      // Top exit -> area 2
      if (boxY < 4) {
        switchArea(2, 10 * TILE, (ROWS - 2) * TILE);
      }
    } else if (currentArea === 2) {
      // Left exit -> area 1 (via top)
      if (boxY + player.h > ROWS * TILE - 4) {
        switchArea(1, 10 * TILE, TILE + 4);
      }
      // Top exit -> area 0 (via bottom)
      if (boxY < 4) {
        switchArea(0, 10 * TILE, (ROWS - 2) * TILE);
      }
    }

    // ---- Particles ----
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.dx;
      p.y += p.dy;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  // ---- Render ----
  function render(ctx) {
    ctx.fillStyle = "#1a472a";
    ctx.fillRect(0, 0, W, H);

    if (state === "menu") {
      renderMenu(ctx);
      return;
    }

    if (state === "gameover") {
      renderGameOver(ctx);
      return;
    }

    // Draw tiles
    const tiles = areas[currentArea].tiles;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        drawTile(ctx, tiles[y][x], x * TILE, y * TILE);
      }
    }

    // Collect all drawable entities sorted by Y for proper overlapping
    const drawList = [];

    // Decorations
    decorations.forEach((d) => {
      drawList.push({ type: "deco", y: d.y + 40, data: d });
    });

    // Collectibles
    collectibles.forEach((c) => {
      if (!c.collected) {
        drawList.push({ type: "collect", y: c.y, data: c });
      }
    });

    // Arrows
    arrows.forEach((a) => {
      drawList.push({ type: "arrow", y: a.y, data: a });
    });

    // Enemies
    enemies.forEach((e) => {
      drawList.push({ type: "enemy", y: e.y + e.h, data: e });
    });

    // Player
    drawList.push({ type: "player", y: player.y + HERO_H, data: player });

    // Sort by y
    drawList.sort((a, b) => a.y - b.y);

    // Draw all
    drawList.forEach((item) => {
      switch (item.type) {
        case "deco":
          drawDecoration(ctx, item.data);
          break;
        case "collect":
          drawCollectible(ctx, item.data);
          break;
        case "arrow":
          drawArrow(ctx, item.data);
          break;
        case "enemy":
          drawEnemy(ctx, item.data);
          break;
        case "player":
          drawPlayer(ctx);
          break;
      }
    });

    // Particles
    particles.forEach((p) => {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 2, 2);
    });
    ctx.globalAlpha = 1;

    // Screen flash
    if (screenFlashTimer > 0) {
      ctx.fillStyle = "rgba(255,0,0,0.3)";
      ctx.fillRect(0, 0, W, H);
    }

    // HUD
    drawHUD(ctx);

    // Level up notification
    if (levelUpTimer > 0) {
      ctx.save();
      ctx.fillStyle = "#FFD700";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      const alpha = Math.min(1, levelUpTimer / 30);
      ctx.globalAlpha = alpha;
      ctx.fillText(
        "LEVEL UP! Lv." + level,
        W / 2,
        60 - (120 - levelUpTimer) * 0.3,
      );
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  function drawDecoration(ctx, d) {
    const img = imgs[d.type];
    if (img) {
      ctx.drawImage(img, Math.floor(d.x), Math.floor(d.y));
    }
  }

  function drawCollectible(ctx, c) {
    if (c.type === "coin") {
      drawFrame(
        ctx,
        imgs["coin"],
        COIN_FW,
        COIN_FH,
        c.frame,
        Math.floor(c.x),
        Math.floor(c.y),
        false,
      );
    } else {
      drawFrame(
        ctx,
        imgs["gem"],
        GEM_FW,
        GEM_FH,
        c.frame,
        Math.floor(c.x),
        Math.floor(c.y),
        false,
      );
    }
  }

  function drawArrow(ctx, a) {
    ctx.save();
    const cx = Math.floor(a.x);
    const cy = Math.floor(a.y);
    ctx.translate(cx + ARROW_W / 2, cy + ARROW_H / 2);
    // Rotate based on direction
    if (a.dir === DIR.UP) ctx.rotate(0);
    else if (a.dir === DIR.DOWN) ctx.rotate(Math.PI);
    else if (a.dir === DIR.LEFT) ctx.rotate(-Math.PI / 2);
    else ctx.rotate(Math.PI / 2);
    ctx.drawImage(imgs["arrow"], -ARROW_W / 2, -ARROW_H / 2);
    ctx.restore();
  }

  function drawEnemy(ctx, e) {
    if (e.dying) {
      drawFrame(
        ctx,
        imgs["enemy-death"],
        DEATH_FW,
        DEATH_FH,
        e.deathFrame,
        Math.floor(e.x) - 4,
        Math.floor(e.y) - 4,
        false,
      );
      return;
    }

    // Hurt flash
    if (e.hurtTimer > 0 && e.hurtTimer % 4 < 2) return;

    const prefix = e.type;
    const fw = e.type === "mole" ? MOLE_W : TREANT_W;
    const fh = e.type === "mole" ? MOLE_H : TREANT_H;
    let imgKey,
      flipX = false;

    if (e.state === "walk") {
      if (e.dir === DIR.DOWN) imgKey = prefix + "-walk-front";
      else if (e.dir === DIR.UP) imgKey = prefix + "-walk-back";
      else {
        imgKey = prefix + "-walk-side";
        flipX = e.dir === DIR.LEFT;
      }
    } else {
      if (e.dir === DIR.DOWN) imgKey = prefix + "-idle-front";
      else if (e.dir === DIR.UP) imgKey = prefix + "-idle-back";
      else {
        imgKey = prefix + "-idle-side";
        flipX = e.dir === DIR.LEFT;
      }
    }

    const img = imgs[imgKey];
    if (!img) return;

    if (e.state === "walk") {
      drawFrame(
        ctx,
        img,
        fw,
        fh,
        e.frame % 4,
        Math.floor(e.x),
        Math.floor(e.y),
        flipX,
      );
    } else {
      // Idle is single frame
      ctx.save();
      if (flipX) {
        ctx.translate(Math.floor(e.x) + fw, Math.floor(e.y));
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
      } else {
        ctx.drawImage(img, Math.floor(e.x), Math.floor(e.y));
      }
      ctx.restore();
    }

    // HP bar
    if (e.hp < e.maxHp) {
      const bx = Math.floor(e.x);
      const by = Math.floor(e.y) - 4;
      ctx.fillStyle = "#333";
      ctx.fillRect(bx, by, fw, 3);
      ctx.fillStyle = "#e33";
      ctx.fillRect(bx, by, (e.hp / e.maxHp) * fw, 3);
    }
  }

  function drawPlayer(ctx) {
    const p = player;
    // Hurt flash
    if (p.invincible > 0 && p.invincible % 6 < 3) return;

    let imgKey,
      flipX = false;
    const fw = HERO_W,
      fh = HERO_H;

    if (p.attacking) {
      const prefix = p.weaponAttack ? "hero-attack-" : "hero-attack-";
      const suffix = p.weaponAttack ? "-weapon" : "";
      if (p.dir === DIR.DOWN) imgKey = "hero-attack-front" + suffix;
      else if (p.dir === DIR.UP) imgKey = "hero-attack-back" + suffix;
      else {
        imgKey = "hero-attack-side" + suffix;
        flipX = p.dir === DIR.LEFT;
      }
      drawFrame(
        ctx,
        imgs[imgKey],
        fw,
        fh,
        p.attackFrame % 3,
        Math.floor(p.x),
        Math.floor(p.y),
        flipX,
      );
    } else if (p.moving) {
      if (p.dir === DIR.DOWN) imgKey = "hero-walk-front";
      else if (p.dir === DIR.UP) imgKey = "hero-walk-back";
      else {
        imgKey = "hero-walk-side";
        flipX = p.dir === DIR.LEFT;
      }
      drawFrame(
        ctx,
        imgs[imgKey],
        fw,
        fh,
        p.frame % 6,
        Math.floor(p.x),
        Math.floor(p.y),
        flipX,
      );
    } else {
      if (p.dir === DIR.DOWN) imgKey = "hero-idle-front";
      else if (p.dir === DIR.UP) imgKey = "hero-idle-back";
      else {
        imgKey = "hero-idle-side";
        flipX = p.dir === DIR.LEFT;
      }
      const img = imgs[imgKey];
      if (img) {
        ctx.save();
        if (flipX) {
          ctx.translate(Math.floor(p.x) + fw, Math.floor(p.y));
          ctx.scale(-1, 1);
          ctx.drawImage(img, 0, 0);
        } else {
          ctx.drawImage(img, Math.floor(p.x), Math.floor(p.y));
        }
        ctx.restore();
      }
    }
  }

  function drawHUD(ctx) {
    // Hearts
    for (let i = 0; i < maxHp; i++) {
      const img = i < player.hp ? imgs["heart-full"] : imgs["heart-empty"];
      ctx.drawImage(img, 4 + i * 10, 4, HEART_W, HEART_H);
    }

    // Score
    ctx.fillStyle = "#fff";
    ctx.font = "8px monospace";
    ctx.textAlign = "right";
    ctx.fillText("SCORE:" + score, W - 4, 10);

    // Level + XP
    ctx.textAlign = "left";
    ctx.fillText("LV:" + level, 4, 18);

    // XP bar
    const xpNeeded = level * 50;
    const barW = 50;
    ctx.fillStyle = "#333";
    ctx.fillRect(30, 13, barW, 4);
    ctx.fillStyle = "#4a4";
    ctx.fillRect(30, 13, (xp / xpNeeded) * barW, 4);

    // Area indicator
    ctx.textAlign = "center";
    ctx.fillStyle = "#aaa";
    const areaNames = ["Meadow", "Dark Forest", "Mystic Stream"];
    ctx.fillText(areaNames[currentArea], W / 2, 10);

    // Coins
    ctx.textAlign = "right";
    ctx.fillStyle = "#FFD700";
    ctx.fillText("$" + score, W - 4, 20);

    // Controls hint
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "6px monospace";
    ctx.fillText("Z:punch X:weapon C:arrow", W / 2, H - 4);
  }

  function renderMenu(ctx) {
    ctx.fillStyle = "#1a472a";
    ctx.fillRect(0, 0, W, H);

    // Draw some decorative tiles
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        drawTile(ctx, y % 2 === 0 ? T.GRASS1 : T.GRASS4, x * TILE, y * TILE);
      }
    }

    // Draw some trees
    if (imgs["tree-orange"].complete)
      ctx.drawImage(imgs["tree-orange"], 20, 60);
    if (imgs["tree-pink"].complete)
      ctx.drawImage(imgs["tree-pink"], W - 90, 80);

    // Title
    ctx.fillStyle = "#000";
    ctx.fillRect(W / 2 - 90, 30, 180, 50);
    ctx.strokeStyle = "#8B4513";
    ctx.lineWidth = 2;
    ctx.strokeRect(W / 2 - 90, 30, 180, 50);

    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("TINY RPG FOREST", W / 2, 52);
    ctx.fillStyle = "#8B4513";
    ctx.font = "8px monospace";
    ctx.fillText("A Forest Adventure", W / 2, 68);

    // Controls
    ctx.fillStyle = "#000";
    ctx.fillRect(W / 2 - 80, 105, 160, 80);
    ctx.strokeStyle = "#555";
    ctx.strokeRect(W / 2 - 80, 105, 160, 80);

    ctx.fillStyle = "#ddd";
    ctx.font = "7px monospace";
    ctx.fillText("WASD / Arrows - Move", W / 2, 120);
    ctx.fillText("Z / Space - Melee Attack", W / 2, 132);
    ctx.fillText("X - Weapon Attack", W / 2, 144);
    ctx.fillText("C - Shoot Arrow", W / 2, 156);
    ctx.fillText("Explore 3 Forest Areas!", W / 2, 172);

    // Start
    const blink = Math.floor(Date.now() / 500) % 2;
    if (blink) {
      ctx.fillStyle = "#fff";
      ctx.font = "10px monospace";
      ctx.fillText("PRESS ENTER TO START", W / 2, 210);
    }

    // Best score
    if (bestScore > 0) {
      ctx.fillStyle = "#FFD700";
      ctx.font = "7px monospace";
      ctx.fillText("BEST: " + bestScore, W / 2, 228);
    }
  }

  function renderGameOver(ctx) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#c33";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", W / 2, 60);

    ctx.fillStyle = "#fff";
    ctx.font = "10px monospace";
    ctx.fillText("Score: " + score, W / 2, 100);
    ctx.fillText("Level: " + level, W / 2, 118);

    if (score >= bestScore && score > 0) {
      ctx.fillStyle = "#FFD700";
      ctx.fillText("NEW BEST SCORE!", W / 2, 140);
    } else {
      ctx.fillStyle = "#888";
      ctx.fillText("Best: " + bestScore, W / 2, 140);
    }

    const blink = Math.floor(Date.now() / 500) % 2;
    if (blink) {
      ctx.fillStyle = "#fff";
      ctx.font = "8px monospace";
      ctx.fillText("PRESS ENTER TO RETRY", W / 2, 180);
    }
  }

  // ---- Start game ----
  loadAssets(() => {
    createGame({
      width: W,
      height: H,
      update: (dt) => {
        update(dt);
        Keyboard.update();
      },
      render: render,
      init: initGame,
    });
  });
})();
