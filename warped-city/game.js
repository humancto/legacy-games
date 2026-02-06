// Warped City - Cyberpunk Shooting Platformer
(function () {
  const W = 384,
    H = 216;
  const TILE = 16;
  const GRAVITY = 0.35;
  const JUMP_FORCE = -6;
  const PLAYER_SPEED = 2;

  // V1 Player: 71x67 per frame
  const PW = 71,
    PH = 67;
  // Drone: 220x52 = 4 frames of 55x52
  const DRONE_W = 55,
    DRONE_H = 52;
  // Turret: 150x23 = 6 frames of 25x23
  const TURRET_FW = 25,
    TURRET_FH = 23;
  // Shot: 45x11 = 3 frames of 15x11
  const SHOT_FW = 15,
    SHOT_FH = 11;
  // Shot hit: 60x11 = 3 frames of 20x11
  const SHOTHIT_FW = 20,
    SHOTHIT_FH = 11;
  // Enemy explosion: 330x52 = 6 frames of 55x52 (approx, check)
  const EXPL_FW = 55,
    EXPL_FH = 52;
  // Cop: 61x64 per frame
  const COP_W = 61,
    COP_H = 64;
  // Egg turret: 44x62
  const EGG_W = 44,
    EGG_H = 62;
  // Enemy shot: 12x12
  const ESHOT_W = 12,
    ESHOT_H = 12;

  // Tileset: 384x256, 16x16 tiles = 24 cols
  const TS_COLS = 24;

  // ---- Assets ----
  const imgs = {};
  const sheetAssets = [
    "player-idle",
    "player-run",
    "player-jump",
    "player-shoot",
    "player-crouch",
    "player-hurt",
    "player-climb",
    "player-back-jump",
    "drone",
    "enemy-explosion",
    "shot",
    "shot-hit",
    "turret",
    "tileset",
    "skyline-a",
    "buildings-bg",
    "near-buildings-bg",
    "v-red",
    "v-yellow",
    "v-police",
    "v2-back",
    "v2-middle",
    "v2-front",
    "enemy-shot",
    "explosion-v2",
    "banner-neon-1",
    "banner-neon-2",
    "control-box-1",
    "antenna",
  ];

  // Cop frames loaded individually
  const copIdleFrames = [];
  const copRunFrames = [];
  const eggIdleFrames = [];
  const eggShootFrames = [];

  let totalAssets = 0;
  let loaded = 0;

  function loadAssets(cb) {
    totalAssets = sheetAssets.length + 3 + 10 + 2 + 4; // sheets + cop-idle + cop-run + egg-idle + egg-shoot

    sheetAssets.forEach((name) => {
      const img = new Image();
      img.onload = img.onerror = () => {
        loaded++;
        if (loaded >= totalAssets) cb();
      };
      img.src = "assets/" + name + ".png";
      imgs[name] = img;
    });

    // Cop idle (3 frames)
    for (let i = 1; i <= 3; i++) {
      const img = new Image();
      img.onload = img.onerror = () => {
        loaded++;
        if (loaded >= totalAssets) cb();
      };
      img.src = "assets/cop-idle-" + i + ".png";
      copIdleFrames.push(img);
    }

    // Cop run (10 frames)
    for (let i = 1; i <= 10; i++) {
      const img = new Image();
      img.onload = img.onerror = () => {
        loaded++;
        if (loaded >= totalAssets) cb();
      };
      img.src = "assets/cop-run-" + i + ".png";
      copRunFrames.push(img);
    }

    // Egg idle (2 frames)
    for (let i = 1; i <= 2; i++) {
      const img = new Image();
      img.onload = img.onerror = () => {
        loaded++;
        if (loaded >= totalAssets) cb();
      };
      img.src = "assets/egg-idle-" + i + ".png";
      eggIdleFrames.push(img);
    }

    // Egg shoot (4 frames)
    for (let i = 1; i <= 4; i++) {
      const img = new Image();
      img.onload = img.onerror = () => {
        loaded++;
        if (loaded >= totalAssets) cb();
      };
      img.src = "assets/egg-shoot-" + i + ".png";
      eggShootFrames.push(img);
    }
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

  function drawSingleFrame(ctx, img, dx, dy, flipX) {
    if (!img || !img.complete) return;
    ctx.save();
    if (flipX) {
      ctx.translate(dx + img.width, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
    } else {
      ctx.drawImage(img, dx, dy);
    }
    ctx.restore();
  }

  // ---- Level Generation ----
  // Tiles from tileset: first few rows are building/roof tiles
  const T = {
    EMPTY: -1,
    GROUND: 0,
    GROUND2: 1,
    GROUND3: 2,
    BRICK: 24, // row 1
    BRICK2: 25,
    BRICK3: 26,
    PLATFORM: 48, // row 2
    PLATFORM2: 49,
    METAL: 72,
    METAL2: 73,
    DARK: 96,
    PIPE: 3,
    PIPE2: 4,
    ROOF: 5,
  };

  function generateLevel(levelIndex) {
    const levelW = 60; // tiles wide
    const levelH = Math.ceil(H / TILE); // 14 tiles tall
    const tiles = [];

    for (let y = 0; y < levelH; y++) {
      tiles[y] = [];
      for (let x = 0; x < levelW; x++) {
        tiles[y][x] = T.EMPTY;
      }
    }

    // Ground floor
    for (let x = 0; x < levelW; x++) {
      tiles[levelH - 1][x] = T.GROUND;
      tiles[levelH - 2][x] = T.GROUND2;
    }

    // Platforms based on level
    const platforms = [];
    if (levelIndex === 0) {
      // City streets - low platforms, many ground enemies
      platforms.push(
        { x: 5, y: levelH - 4, w: 4 },
        { x: 12, y: levelH - 5, w: 3 },
        { x: 18, y: levelH - 4, w: 5 },
        { x: 26, y: levelH - 6, w: 3 },
        { x: 32, y: levelH - 4, w: 4 },
        { x: 38, y: levelH - 5, w: 3 },
        { x: 44, y: levelH - 4, w: 5 },
        { x: 52, y: levelH - 6, w: 3 },
      );
      // Gaps in ground
      for (let g = 0; g < 3; g++) {
        const gx = 15 + g * 15;
        tiles[levelH - 1][gx] = T.EMPTY;
        tiles[levelH - 2][gx] = T.EMPTY;
        tiles[levelH - 1][gx + 1] = T.EMPTY;
        tiles[levelH - 2][gx + 1] = T.EMPTY;
      }
    } else if (levelIndex === 1) {
      // Rooftops - higher platforms, drones
      platforms.push(
        { x: 3, y: levelH - 5, w: 6 },
        { x: 11, y: levelH - 7, w: 4 },
        { x: 17, y: levelH - 5, w: 5 },
        { x: 24, y: levelH - 8, w: 3 },
        { x: 29, y: levelH - 6, w: 4 },
        { x: 35, y: levelH - 4, w: 6 },
        { x: 43, y: levelH - 7, w: 3 },
        { x: 48, y: levelH - 5, w: 5 },
        { x: 55, y: levelH - 6, w: 4 },
      );
    } else if (levelIndex === 2) {
      // Underground - narrow with turrets
      platforms.push(
        { x: 4, y: levelH - 4, w: 3 },
        { x: 9, y: levelH - 6, w: 4 },
        { x: 15, y: levelH - 4, w: 3 },
        { x: 20, y: levelH - 7, w: 5 },
        { x: 27, y: levelH - 5, w: 3 },
        { x: 32, y: levelH - 3, w: 4 },
        { x: 38, y: levelH - 6, w: 4 },
        { x: 44, y: levelH - 4, w: 5 },
        { x: 51, y: levelH - 7, w: 3 },
      );
      // Ceiling
      for (let x = 0; x < levelW; x++) {
        tiles[0][x] = T.DARK;
        tiles[1][x] = T.METAL;
      }
    } else {
      // Tower ascent (level 3) - vertical challenge
      platforms.push(
        { x: 2, y: levelH - 4, w: 4 },
        { x: 8, y: levelH - 6, w: 3 },
        { x: 14, y: levelH - 8, w: 4 },
        { x: 20, y: levelH - 5, w: 3 },
        { x: 26, y: levelH - 7, w: 5 },
        { x: 33, y: levelH - 4, w: 3 },
        { x: 38, y: levelH - 9, w: 4 },
        { x: 45, y: levelH - 6, w: 3 },
        { x: 50, y: levelH - 8, w: 4 },
        { x: 56, y: levelH - 5, w: 3 },
      );
    }

    // Place platforms
    platforms.forEach((p) => {
      for (let x = p.x; x < p.x + p.w; x++) {
        if (x >= 0 && x < levelW) {
          tiles[p.y][x] = T.PLATFORM;
        }
      }
    });

    return { tiles, levelW, levelH, platforms };
  }

  function spawnEnemies(levelIndex, levelW, levelH, platforms) {
    const enemies = [];
    const copCount = 3 + levelIndex * 2;
    const droneCount = 1 + levelIndex;
    const turretCount = levelIndex >= 2 ? 2 + levelIndex : 0;
    const eggCount = levelIndex >= 1 ? 1 + levelIndex : 0;

    // Cops on ground
    for (let i = 0; i < copCount; i++) {
      enemies.push({
        type: "cop",
        x: 200 + i * 120 + Math.random() * 60,
        y: (levelH - 3) * TILE,
        vx: 0,
        vy: 0,
        w: 40,
        h: 60,
        hp: 3,
        dir: -1,
        frame: 0,
        timer: 0,
        state: "idle",
        stateTimer: 60,
        dying: false,
        deathFrame: 0,
        deathTimer: 0,
      });
    }

    // Drones flying
    for (let i = 0; i < droneCount; i++) {
      enemies.push({
        type: "drone",
        x: 250 + i * 200 + Math.random() * 80,
        y: 30 + Math.random() * 60,
        vx: 0,
        vy: 0,
        w: 45,
        h: 40,
        hp: 2,
        dir: -1,
        frame: 0,
        timer: 0,
        state: "fly",
        baseY: 30 + Math.random() * 60,
        flyTimer: Math.random() * 100,
        shootTimer: 60 + Math.random() * 60,
        dying: false,
        deathFrame: 0,
        deathTimer: 0,
      });
    }

    // Turrets on platforms
    for (let i = 0; i < turretCount && i < platforms.length; i++) {
      const p = platforms[i + 2]; // skip first couple
      if (!p) continue;
      enemies.push({
        type: "turret",
        x: (p.x + 1) * TILE,
        y: (p.y - 1) * TILE,
        vx: 0,
        vy: 0,
        w: 25,
        h: 23,
        hp: 4,
        dir: -1,
        frame: 0,
        timer: 0,
        state: "idle",
        shootTimer: 40 + Math.random() * 40,
        dying: false,
        deathFrame: 0,
        deathTimer: 0,
      });
    }

    // Egg turrets
    for (let i = 0; i < eggCount && i < platforms.length; i++) {
      const p = platforms[platforms.length - 1 - i];
      if (!p) continue;
      enemies.push({
        type: "egg",
        x: (p.x + 1) * TILE,
        y: (p.y - 3) * TILE,
        vx: 0,
        vy: 0,
        w: 44,
        h: 62,
        hp: 5,
        dir: -1,
        frame: 0,
        timer: 0,
        state: "idle",
        shootTimer: 80 + Math.random() * 40,
        shooting: false,
        shootFrame: 0,
        dying: false,
        deathFrame: 0,
        deathTimer: 0,
      });
    }

    return enemies;
  }

  // ---- Game State ----
  let state, player, camera;
  let levelData, enemies, playerBullets, enemyBullets, particles, effects;
  let score, hp, maxHp, ammo, currentLevel, bestScore;
  let scrollX;
  let vehicleProps;

  function initGame() {
    bestScore = parseInt(localStorage.getItem("warpedCityBest") || "0");
    resetGame();
  }

  function resetGame() {
    state = "menu";
    currentLevel = 0;
    score = 0;
    hp = 5;
    maxHp = 5;
    ammo = 30;
    loadLevel(0);
  }

  function loadLevel(idx) {
    currentLevel = idx;
    levelData = generateLevel(idx);
    enemies = spawnEnemies(
      idx,
      levelData.levelW,
      levelData.levelH,
      levelData.platforms,
    );
    playerBullets = [];
    enemyBullets = [];
    particles = [];
    effects = [];
    scrollX = 0;

    player = {
      x: 40,
      y: (levelData.levelH - 3) * TILE - PH + 10,
      vx: 0,
      vy: 0,
      w: 30,
      h: 55,
      dir: 1,
      frame: 0,
      timer: 0,
      grounded: false,
      shooting: false,
      shootTimer: 0,
      crouching: false,
      climbing: false,
      hurt: false,
      hurtTimer: 0,
      invincible: 0,
      shootCooldown: 0,
    };

    // Vehicle props
    vehicleProps = [];
    const vehicleImgs = ["v-red", "v-yellow", "v-police"];
    for (let i = 0; i < 4 + idx; i++) {
      vehicleProps.push({
        img: vehicleImgs[Math.floor(Math.random() * vehicleImgs.length)],
        x: 100 + i * 180 + Math.random() * 60,
        y: (levelData.levelH - 2) * TILE,
        flip: Math.random() < 0.5,
      });
    }

    camera = { x: 0 };
  }

  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
    );
  }

  function isSolid(tx, ty) {
    if (tx < 0 || tx >= levelData.levelW) return true;
    if (ty < 0) return false;
    if (ty >= levelData.levelH) return true;
    return levelData.tiles[ty][tx] !== T.EMPTY;
  }

  // ---- Update ----
  function update(dt) {
    if (state === "menu") {
      if (Keyboard.justPressed("Space") || Keyboard.justPressed("Enter")) {
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

    if (state === "levelcomplete") {
      if (Keyboard.justPressed("Space") || Keyboard.justPressed("Enter")) {
        if (currentLevel < 3) {
          loadLevel(currentLevel + 1);
          state = "playing";
        } else {
          if (score > bestScore) {
            bestScore = score;
            localStorage.setItem("warpedCityBest", bestScore.toString());
          }
          state = "win";
        }
      }
      return;
    }

    if (state === "win") {
      if (Keyboard.justPressed("Space") || Keyboard.justPressed("Enter")) {
        resetGame();
        state = "playing";
      }
      return;
    }

    if (state !== "playing") return;

    const p = player;

    // Invincibility
    if (p.invincible > 0) p.invincible--;
    if (p.hurtTimer > 0) p.hurtTimer--;
    if (p.shootCooldown > 0) p.shootCooldown--;

    // ---- Player input ----
    let moveX = 0;
    p.crouching = false;

    if (Keyboard.isDown("ArrowLeft") || Keyboard.isDown("KeyA")) {
      moveX = -1;
      p.dir = -1;
    }
    if (Keyboard.isDown("ArrowRight") || Keyboard.isDown("KeyD")) {
      moveX = 1;
      p.dir = 1;
    }
    if (Keyboard.isDown("ArrowDown") || Keyboard.isDown("KeyS")) {
      p.crouching = true;
    }

    // Jump
    if (
      (Keyboard.justPressed("ArrowUp") ||
        Keyboard.justPressed("KeyW") ||
        Keyboard.justPressed("Space")) &&
      p.grounded
    ) {
      p.vy = JUMP_FORCE;
      p.grounded = false;
      Audio.playTone(400, 0.08, "square");
    }

    // Shoot
    if (
      (Keyboard.justPressed("KeyZ") || Keyboard.justPressed("KeyX")) &&
      p.shootCooldown <= 0 &&
      ammo > 0
    ) {
      ammo--;
      p.shooting = true;
      p.shootTimer = 12;
      p.shootCooldown = 12;
      // Create bullet
      playerBullets.push({
        x: p.x + (p.dir === 1 ? p.w + 10 : -15),
        y: p.y + (p.crouching ? 35 : 20),
        vx: p.dir * 5,
        vy: 0,
        life: 40,
        frame: 0,
        timer: 0,
      });
      Audio.playTone(600, 0.04, "square");
      setTimeout(() => Audio.playTone(300, 0.04, "noise"), 30);
    }

    // Horizontal movement
    p.vx = moveX * PLAYER_SPEED;
    p.x += p.vx;

    // Collision box offset in sprite
    const boxOffX = 18;
    const boxOffY = 10;

    // Horizontal tile collision
    const pLeft = p.x + boxOffX;
    const pRight = pLeft + p.w;
    const pTop = p.y + boxOffY;
    const pBot = pTop + p.h;

    if (moveX < 0) {
      const tx = Math.floor(pLeft / TILE);
      const ty1 = Math.floor(pTop / TILE);
      const ty2 = Math.floor((pBot - 1) / TILE);
      for (let ty = ty1; ty <= ty2; ty++) {
        if (isSolid(tx, ty)) {
          p.x = (tx + 1) * TILE - boxOffX;
          break;
        }
      }
    } else if (moveX > 0) {
      const tx = Math.floor(pRight / TILE);
      const ty1 = Math.floor(pTop / TILE);
      const ty2 = Math.floor((pBot - 1) / TILE);
      for (let ty = ty1; ty <= ty2; ty++) {
        if (isSolid(tx, ty)) {
          p.x = tx * TILE - p.w - boxOffX;
          break;
        }
      }
    }

    // Gravity
    p.vy += GRAVITY;
    if (p.vy > 8) p.vy = 8;
    p.y += p.vy;

    // Vertical collision
    p.grounded = false;
    const newTop = p.y + boxOffY;
    const newBot = newTop + p.h;
    const newLeft = p.x + boxOffX;
    const newRight = newLeft + p.w;

    if (p.vy >= 0) {
      const ty = Math.floor(newBot / TILE);
      const tx1 = Math.floor(newLeft / TILE);
      const tx2 = Math.floor((newRight - 1) / TILE);
      for (let tx = tx1; tx <= tx2; tx++) {
        if (isSolid(tx, ty)) {
          p.y = ty * TILE - p.h - boxOffY;
          p.vy = 0;
          p.grounded = true;
          break;
        }
      }
    } else {
      const ty = Math.floor(newTop / TILE);
      const tx1 = Math.floor(newLeft / TILE);
      const tx2 = Math.floor((newRight - 1) / TILE);
      for (let tx = tx1; tx <= tx2; tx++) {
        if (isSolid(tx, ty)) {
          p.y = (ty + 1) * TILE - boxOffY;
          p.vy = 0;
          break;
        }
      }
    }

    // Fall out of world
    if (p.y > levelData.levelH * TILE + 50) {
      hp--;
      if (hp <= 0) {
        if (score > bestScore) {
          bestScore = score;
          localStorage.setItem("warpedCityBest", bestScore.toString());
        }
        state = "gameover";
      } else {
        p.x = 40;
        p.y = (levelData.levelH - 4) * TILE;
        p.vy = 0;
      }
    }

    // Clamp to level bounds
    if (p.x < 0) p.x = 0;
    if (p.x > levelData.levelW * TILE - PW) p.x = levelData.levelW * TILE - PW;

    // Animation
    if (p.shootTimer > 0) {
      p.shootTimer--;
      if (p.shootTimer <= 0) p.shooting = false;
    }

    if (p.shooting) {
      // hold shoot pose
    } else if (!p.grounded) {
      p.timer++;
      if (p.timer >= 6) {
        p.timer = 0;
        p.frame = (p.frame + 1) % 4; // jump frames
      }
    } else if (moveX !== 0) {
      p.timer++;
      if (p.timer >= 5) {
        p.timer = 0;
        p.frame = (p.frame + 1) % 8; // run frames
      }
    } else {
      p.timer++;
      if (p.timer >= 8) {
        p.timer = 0;
        p.frame = (p.frame + 1) % 4; // idle frames
      }
    }

    // Camera follow
    camera.x = p.x - W / 3;
    if (camera.x < 0) camera.x = 0;
    if (camera.x > levelData.levelW * TILE - W)
      camera.x = levelData.levelW * TILE - W;

    // ---- Player bullets ----
    for (let i = playerBullets.length - 1; i >= 0; i--) {
      const b = playerBullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.life--;
      b.timer++;
      if (b.timer >= 4) {
        b.timer = 0;
        b.frame = (b.frame + 1) % 3;
      }

      if (b.life <= 0) {
        playerBullets.splice(i, 1);
        continue;
      }

      // Hit tile
      const tx = Math.floor((b.x + 7) / TILE);
      const ty = Math.floor((b.y + 5) / TILE);
      if (isSolid(tx, ty)) {
        effects.push({
          type: "shot-hit",
          x: b.x - 5,
          y: b.y - 3,
          frame: 0,
          timer: 0,
        });
        playerBullets.splice(i, 1);
        continue;
      }

      // Hit enemies
      let hit = false;
      for (let j = 0; j < enemies.length; j++) {
        const e = enemies[j];
        if (e.dying) continue;
        if (rectsOverlap({ x: b.x, y: b.y, w: 12, h: 8 }, e)) {
          e.hp--;
          hit = true;
          effects.push({
            type: "shot-hit",
            x: b.x - 5,
            y: b.y - 3,
            frame: 0,
            timer: 0,
          });
          if (e.hp <= 0) {
            e.dying = true;
            e.deathFrame = 0;
            e.deathTimer = 0;
            score += e.type === "drone" ? 150 : e.type === "cop" ? 100 : 200;
            // Ammo drop
            ammo = Math.min(ammo + 5, 99);
            Audio.playTone(120, 0.15, "sawtooth");
          } else {
            Audio.playTone(500, 0.03, "square");
          }
          break;
        }
      }
      if (hit) playerBullets.splice(i, 1);
    }

    // ---- Enemy bullets ----
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.life--;
      if (b.life <= 0) {
        enemyBullets.splice(i, 1);
        continue;
      }

      // Hit player
      const pBox = { x: p.x + boxOffX, y: p.y + boxOffY, w: p.w, h: p.h };
      if (
        p.invincible <= 0 &&
        rectsOverlap(pBox, { x: b.x, y: b.y, w: 10, h: 10 })
      ) {
        hp--;
        p.hurtTimer = 20;
        p.invincible = 60;
        enemyBullets.splice(i, 1);
        Audio.playTone(100, 0.15, "sawtooth");
        if (hp <= 0) {
          if (score > bestScore) {
            bestScore = score;
            localStorage.setItem("warpedCityBest", bestScore.toString());
          }
          state = "gameover";
        }
      }
    }

    // ---- Enemies ----
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];

      if (e.dying) {
        e.deathTimer++;
        if (e.deathTimer >= 5) {
          e.deathTimer = 0;
          e.deathFrame++;
          if (e.deathFrame >= 6) {
            enemies.splice(i, 1);
          }
        }
        continue;
      }

      if (e.type === "cop") {
        updateCop(e, p);
      } else if (e.type === "drone") {
        updateDrone(e, p);
      } else if (e.type === "turret") {
        updateTurret(e, p);
      } else if (e.type === "egg") {
        updateEgg(e, p);
      }

      // Contact damage (cop only)
      if (e.type === "cop" && !e.dying && p.invincible <= 0) {
        const pBox = { x: p.x + boxOffX, y: p.y + boxOffY, w: p.w, h: p.h };
        if (rectsOverlap(pBox, e)) {
          hp--;
          p.hurtTimer = 20;
          p.invincible = 60;
          Audio.playTone(100, 0.15, "sawtooth");
          if (hp <= 0) {
            if (score > bestScore) {
              bestScore = score;
              localStorage.setItem("warpedCityBest", bestScore.toString());
            }
            state = "gameover";
          }
        }
      }
    }

    // Level complete: all enemies defeated and reach right side
    if (enemies.length === 0 && p.x > (levelData.levelW - 5) * TILE) {
      state = "levelcomplete";
      Audio.playTone(523, 0.15, "sine");
      setTimeout(() => Audio.playTone(659, 0.15, "sine"), 100);
      setTimeout(() => Audio.playTone(784, 0.2, "sine"), 200);
    }

    // Effects
    for (let i = effects.length - 1; i >= 0; i--) {
      const fx = effects[i];
      fx.timer++;
      if (fx.timer >= 4) {
        fx.timer = 0;
        fx.frame++;
        if (fx.frame >= 3) {
          effects.splice(i, 1);
        }
      }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.x += pt.dx;
      pt.y += pt.dy;
      pt.life--;
      if (pt.life <= 0) particles.splice(i, 1);
    }
  }

  function updateCop(e, p) {
    const dist = p.x - e.x;
    e.stateTimer--;

    if (e.stateTimer <= 0) {
      if (Math.abs(dist) < 200) {
        e.state = "run";
        e.dir = dist > 0 ? 1 : -1;
        e.stateTimer = 60 + Math.random() * 40;
      } else {
        e.state = Math.random() < 0.5 ? "idle" : "run";
        e.dir = Math.random() < 0.5 ? 1 : -1;
        e.stateTimer = 40 + Math.random() * 60;
      }
    }

    if (e.state === "run") {
      e.x += e.dir * 1.2;
      e.timer++;
      if (e.timer >= 5) {
        e.timer = 0;
        e.frame = (e.frame + 1) % 10;
      }
      // Clamp
      if (e.x < TILE) e.x = TILE;
      if (e.x > (levelData.levelW - 2) * TILE)
        e.x = (levelData.levelW - 2) * TILE;
    } else {
      e.timer++;
      if (e.timer >= 10) {
        e.timer = 0;
        e.frame = (e.frame + 1) % 3;
      }
    }
  }

  function updateDrone(e, p) {
    e.flyTimer += 0.03;
    e.y = e.baseY + Math.sin(e.flyTimer) * 20;

    // Move toward player horizontally
    const dist = p.x - e.x;
    if (Math.abs(dist) > 30) {
      e.x += (dist > 0 ? 1 : -1) * 0.8;
      e.dir = dist > 0 ? 1 : -1;
    }

    e.timer++;
    if (e.timer >= 6) {
      e.timer = 0;
      e.frame = (e.frame + 1) % 4;
    }

    // Shoot
    e.shootTimer--;
    if (e.shootTimer <= 0) {
      e.shootTimer = 80 + Math.random() * 40;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      enemyBullets.push({
        x: e.x + 20,
        y: e.y + 30,
        vx: (dx / d) * 2.5,
        vy: (dy / d) * 2.5,
        life: 80,
      });
      Audio.playTone(200, 0.05, "square");
    }
  }

  function updateTurret(e, p) {
    e.dir = p.x > e.x ? 1 : -1;
    e.timer++;
    if (e.timer >= 8) {
      e.timer = 0;
      e.frame = (e.frame + 1) % 6;
    }

    e.shootTimer--;
    if (e.shootTimer <= 0) {
      e.shootTimer = 50 + Math.random() * 30;
      enemyBullets.push({
        x: e.x + (e.dir > 0 ? 25 : -10),
        y: e.y + 10,
        vx: e.dir * 3,
        vy: 0,
        life: 60,
      });
      Audio.playTone(300, 0.05, "sawtooth");
    }
  }

  function updateEgg(e, p) {
    e.dir = p.x > e.x ? 1 : -1;

    if (e.shooting) {
      e.timer++;
      if (e.timer >= 6) {
        e.timer = 0;
        e.shootFrame++;
        if (e.shootFrame >= 4) {
          e.shooting = false;
          e.shootFrame = 0;
        }
        // Fire on frame 2
        if (e.shootFrame === 2) {
          const dx = p.x - e.x;
          const dy = p.y - e.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          enemyBullets.push({
            x: e.x + 20,
            y: e.y + 10,
            vx: (dx / d) * 2,
            vy: (dy / d) * 2,
            life: 80,
          });
          Audio.playTone(250, 0.06, "sawtooth");
        }
      }
    } else {
      e.timer++;
      if (e.timer >= 10) {
        e.timer = 0;
        e.frame = (e.frame + 1) % 2;
      }

      e.shootTimer--;
      if (e.shootTimer <= 0) {
        e.shootTimer = 80 + Math.random() * 40;
        e.shooting = true;
        e.shootFrame = 0;
        e.timer = 0;
      }
    }
  }

  // ---- Render ----
  function render(ctx) {
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, W, H);

    if (state === "menu") {
      renderMenu(ctx);
      return;
    }

    if (state === "gameover") {
      renderGameOver(ctx);
      return;
    }

    if (state === "win") {
      renderWin(ctx);
      return;
    }

    // Parallax backgrounds
    drawParallax(ctx);

    ctx.save();
    ctx.translate(-Math.floor(camera.x), 0);

    // Tiles
    const startX = Math.floor(camera.x / TILE);
    const endX = startX + Math.ceil(W / TILE) + 1;
    for (let y = 0; y < levelData.levelH; y++) {
      for (let x = startX; x <= endX && x < levelData.levelW; x++) {
        if (x >= 0) drawTile(ctx, levelData.tiles[y][x], x * TILE, y * TILE);
      }
    }

    // Vehicle props
    vehicleProps.forEach((v) => {
      const img = imgs[v.img];
      if (img) {
        ctx.save();
        if (v.flip) {
          ctx.translate(v.x + img.width, v.y - img.height + TILE);
          ctx.scale(-1, 1);
          ctx.drawImage(img, 0, 0);
        } else {
          ctx.drawImage(img, v.x, v.y - img.height + TILE);
        }
        ctx.restore();
      }
    });

    // Effects
    effects.forEach((fx) => {
      if (fx.type === "shot-hit") {
        drawFrame(
          ctx,
          imgs["shot-hit"],
          SHOTHIT_FW,
          SHOTHIT_FH,
          fx.frame,
          Math.floor(fx.x),
          Math.floor(fx.y),
          false,
        );
      }
    });

    // Enemy bullets
    enemyBullets.forEach((b) => {
      ctx.fillStyle = "#f44";
      ctx.fillRect(Math.floor(b.x), Math.floor(b.y), 6, 6);
    });

    // Player bullets
    playerBullets.forEach((b) => {
      drawFrame(
        ctx,
        imgs["shot"],
        SHOT_FW,
        SHOT_FH,
        b.frame,
        Math.floor(b.x),
        Math.floor(b.y),
        b.vx < 0,
      );
    });

    // Enemies
    enemies.forEach((e) => drawEnemySprite(ctx, e));

    // Player
    drawPlayerSprite(ctx);

    // Particles
    particles.forEach((pt) => {
      ctx.globalAlpha = pt.life / pt.maxLife;
      ctx.fillStyle = pt.color;
      ctx.fillRect(Math.floor(pt.x), Math.floor(pt.y), 2, 2);
    });
    ctx.globalAlpha = 1;

    ctx.restore();

    // Level complete overlay
    if (state === "levelcomplete") {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#0ff";
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        "STAGE " + (currentLevel + 1) + " COMPLETE!",
        W / 2,
        H / 2 - 10,
      );
      ctx.fillStyle = "#fff";
      ctx.font = "8px monospace";
      ctx.fillText("Press ENTER to continue", W / 2, H / 2 + 15);
    }

    // HUD
    drawHUD(ctx);
  }

  function drawParallax(ctx) {
    const cx = camera.x;
    // Layer 1: sky
    const sky = imgs["skyline-a"];
    if (sky && sky.complete) {
      const sw = sky.width;
      for (let x = (-(cx * 0.05) % sw) - sw; x < W + sw; x += sw) {
        ctx.drawImage(sky, Math.floor(x), H - sky.height);
      }
    }
    // Layer 2: buildings bg
    const bldg = imgs["buildings-bg"];
    if (bldg && bldg.complete) {
      const bw = bldg.width;
      for (let x = (-(cx * 0.15) % bw) - bw; x < W + bw; x += bw) {
        ctx.drawImage(bldg, Math.floor(x), H - bldg.height);
      }
    }
    // Layer 3: near buildings
    const near = imgs["near-buildings-bg"];
    if (near && near.complete) {
      const nw = near.width;
      for (let x = (-(cx * 0.3) % nw) - nw; x < W + nw; x += nw) {
        ctx.drawImage(near, Math.floor(x), H - near.height);
      }
    }
  }

  function drawEnemySprite(ctx, e) {
    if (e.dying) {
      drawFrame(
        ctx,
        imgs["enemy-explosion"],
        EXPL_FW,
        EXPL_FH,
        e.deathFrame,
        Math.floor(e.x) - 5,
        Math.floor(e.y) - 5,
        false,
      );
      return;
    }

    const flipX = e.dir === -1;

    if (e.type === "cop") {
      const frames = e.state === "run" ? copRunFrames : copIdleFrames;
      const f = frames[e.frame % frames.length];
      if (f) drawSingleFrame(ctx, f, Math.floor(e.x), Math.floor(e.y), flipX);
    } else if (e.type === "drone") {
      drawFrame(
        ctx,
        imgs["drone"],
        DRONE_W,
        DRONE_H,
        e.frame,
        Math.floor(e.x),
        Math.floor(e.y),
        flipX,
      );
    } else if (e.type === "turret") {
      drawFrame(
        ctx,
        imgs["turret"],
        TURRET_FW,
        TURRET_FH,
        e.frame,
        Math.floor(e.x),
        Math.floor(e.y),
        flipX,
      );
    } else if (e.type === "egg") {
      if (e.shooting) {
        const f = eggShootFrames[e.shootFrame % eggShootFrames.length];
        if (f) drawSingleFrame(ctx, f, Math.floor(e.x), Math.floor(e.y), flipX);
      } else {
        const f = eggIdleFrames[e.frame % eggIdleFrames.length];
        if (f) drawSingleFrame(ctx, f, Math.floor(e.x), Math.floor(e.y), flipX);
      }
    }

    // HP bar
    if (
      e.hp <
      (e.type === "cop"
        ? 3
        : e.type === "drone"
          ? 2
          : e.type === "turret"
            ? 4
            : 5)
    ) {
      const maxHpE =
        e.type === "cop"
          ? 3
          : e.type === "drone"
            ? 2
            : e.type === "turret"
              ? 4
              : 5;
      ctx.fillStyle = "#333";
      ctx.fillRect(Math.floor(e.x), Math.floor(e.y) - 4, e.w, 3);
      ctx.fillStyle = "#f33";
      ctx.fillRect(
        Math.floor(e.x),
        Math.floor(e.y) - 4,
        (e.hp / maxHpE) * e.w,
        3,
      );
    }
  }

  function drawPlayerSprite(ctx) {
    const p = player;
    if (p.invincible > 0 && p.invincible % 6 < 3) return;

    const flipX = p.dir === -1;
    let img, frame;

    if (p.hurtTimer > 0) {
      img = imgs["player-hurt"];
      frame = 0;
    } else if (p.shooting) {
      img = imgs["player-shoot"];
      frame = 0;
    } else if (p.crouching && p.grounded) {
      img = imgs["player-crouch"];
      frame = 0;
    } else if (!p.grounded) {
      img = imgs["player-jump"];
      frame = Math.min(p.frame, 4); // 355/71 = 5 frames
    } else if (Math.abs(p.vx) > 0.5) {
      img = imgs["player-run"];
      frame = p.frame; // 568/71 = 8 frames
    } else {
      img = imgs["player-idle"];
      frame = p.frame; // 284/71 = 4 frames
    }

    if (img)
      drawFrame(
        ctx,
        img,
        PW,
        PH,
        frame,
        Math.floor(p.x),
        Math.floor(p.y),
        flipX,
      );
  }

  function drawHUD(ctx) {
    // Health bar
    ctx.fillStyle = "#333";
    ctx.fillRect(4, 4, 52, 8);
    ctx.fillStyle = hp > 2 ? "#0f0" : hp > 1 ? "#ff0" : "#f00";
    ctx.fillRect(5, 5, (hp / maxHp) * 50, 6);
    ctx.strokeStyle = "#888";
    ctx.strokeRect(4, 4, 52, 8);

    // Ammo
    ctx.fillStyle = "#0ff";
    ctx.font = "7px monospace";
    ctx.textAlign = "left";
    ctx.fillText("AMMO:" + ammo, 4, 22);

    // Score
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.fillText("SCORE:" + score, W - 4, 10);

    // Level
    ctx.fillStyle = "#f0f";
    ctx.textAlign = "center";
    ctx.fillText("STAGE " + (currentLevel + 1), W / 2, 10);

    // Enemy count
    const alive = enemies.filter((e) => !e.dying).length;
    if (alive > 0) {
      ctx.fillStyle = "#f88";
      ctx.textAlign = "right";
      ctx.fillText("ENEMIES:" + alive, W - 4, 20);
    } else {
      ctx.fillStyle = "#8f8";
      ctx.textAlign = "right";
      ctx.fillText("CLEAR! ->", W - 4, 20);
    }
  }

  function renderMenu(ctx) {
    ctx.fillStyle = "#0a0a2e";
    ctx.fillRect(0, 0, W, H);

    // Neon grid effect
    ctx.strokeStyle = "rgba(0,255,255,0.1)";
    for (let y = 0; y < H; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (let x = 0; x < W; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    // Title
    ctx.fillStyle = "#0ff";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    ctx.fillText("WARPED CITY", W / 2, 50);

    ctx.fillStyle = "#f0f";
    ctx.font = "8px monospace";
    ctx.fillText("CYBERPUNK SHOOTER", W / 2, 65);

    // Controls
    ctx.fillStyle = "#aaa";
    ctx.font = "7px monospace";
    ctx.fillText("WASD/Arrows - Move & Jump", W / 2, 95);
    ctx.fillText("Z/X - Shoot", W / 2, 107);
    ctx.fillText("S/Down - Crouch", W / 2, 119);
    ctx.fillText("Defeat all enemies, reach right side", W / 2, 137);

    const blink = Math.floor(Date.now() / 500) % 2;
    if (blink) {
      ctx.fillStyle = "#0ff";
      ctx.font = "10px monospace";
      ctx.fillText("PRESS ENTER TO START", W / 2, 170);
    }

    if (bestScore > 0) {
      ctx.fillStyle = "#ff0";
      ctx.font = "7px monospace";
      ctx.fillText("BEST: " + bestScore, W / 2, 195);
    }
  }

  function renderGameOver(ctx) {
    ctx.fillStyle = "#0a0000";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#f33";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", W / 2, 60);

    ctx.fillStyle = "#fff";
    ctx.font = "10px monospace";
    ctx.fillText("Score: " + score, W / 2, 95);
    ctx.fillText("Stage: " + (currentLevel + 1), W / 2, 112);

    if (score >= bestScore && score > 0) {
      ctx.fillStyle = "#ff0";
      ctx.fillText("NEW BEST!", W / 2, 132);
    }

    const blink = Math.floor(Date.now() / 500) % 2;
    if (blink) {
      ctx.fillStyle = "#fff";
      ctx.font = "8px monospace";
      ctx.fillText("PRESS ENTER TO RETRY", W / 2, 170);
    }
  }

  function renderWin(ctx) {
    ctx.fillStyle = "#001a1a";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#0ff";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.fillText("MISSION COMPLETE", W / 2, 50);

    ctx.fillStyle = "#fff";
    ctx.font = "10px monospace";
    ctx.fillText("Final Score: " + score, W / 2, 85);

    if (score >= bestScore) {
      ctx.fillStyle = "#ff0";
      ctx.fillText("NEW BEST SCORE!", W / 2, 105);
    }

    ctx.fillStyle = "#f0f";
    ctx.font = "8px monospace";
    ctx.fillText("The city is saved... for now.", W / 2, 135);

    const blink = Math.floor(Date.now() / 500) % 2;
    if (blink) {
      ctx.fillStyle = "#0ff";
      ctx.fillText("PRESS ENTER TO PLAY AGAIN", W / 2, 175);
    }
  }

  // ---- Start ----
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
