// Top-Down Shooter - Cyberpunk Dungeon Crawler
// Canvas: 320x320

(function () {
  const W = 320;
  const H = 320;
  const TILE = 16;
  const ROOM_COLS = 20;
  const ROOM_ROWS = 20;
  const TILESET_COLS = 18;

  // Tile indices in the tileset (row * 18 + col)
  const TILES = {
    FLOOR1: 2 * TILESET_COLS + 1,
    FLOOR2: 2 * TILESET_COLS + 2,
    FLOOR3: 2 * TILESET_COLS + 3,
    WALL_TOP: 0 * TILESET_COLS + 1,
    WALL_MID: 1 * TILESET_COLS + 1,
    WALL_LEFT: 1 * TILESET_COLS + 0,
    WALL_RIGHT: 1 * TILESET_COLS + 2,
    WALL_TL: 0 * TILESET_COLS + 0,
    WALL_TR: 0 * TILESET_COLS + 2,
    WALL_BL: 2 * TILESET_COLS + 0,
    WALL_BR: 2 * TILESET_COLS + 2,
    DOOR: 0 * TILESET_COLS + 4,
    CRATE: 3 * TILESET_COLS + 0,
    BARREL: 3 * TILESET_COLS + 1,
    PILLAR_TOP: 0 * TILESET_COLS + 5,
    PILLAR_BOT: 1 * TILESET_COLS + 5,
  };

  const assets = new AssetLoader();
  const audio = new AudioManager();
  const particles = new ParticleEmitter();
  const sm = new StateMachine();

  // Game state
  let player, bullets, enemyBullets, enemies, effects, explosions;
  let score, bestScore;
  let currentFloor, currentRoom, totalRooms;
  let roomMap, roomEnemiesCleared, doorOpen;
  let screenShake, screenShakeTimer;
  let camera;
  let gameTime;
  let bossActive, bossDefeated;

  bestScore = parseInt(localStorage.getItem("topDownShooterBest") || "0");

  // ---- Asset Loading ----
  async function loadAllAssets() {
    await assets.loadImages({
      playerWalk: "assets/player-walk.png",
      playerGunWalk: "assets/player-gun-walk.png",
      playerShot: "assets/player-shot.png",
      playerCrouch: "assets/player-crouch.png",
      playerDeath: "assets/player-death.png",
      playerDrawGun: "assets/player-draw-gun.png",
      playerPunch: "assets/player-punch.png",
      enemy01: "assets/enemy-01.png",
      enemy02: "assets/enemy-02.png",
      enemy03: "assets/enemy-03.png",
      enemyExplosion: "assets/enemy-explosion.png",
      tileset: "assets/tileset.png",
      boss: "assets/boss.png",
      bossThrust: "assets/boss-thrust.png",
      bossBolt: "assets/boss-bolt.png",
      bossHelmet: "assets/boss-helmet.png",
      fxBolt: "assets/fx-bolt.png",
      fxCharged: "assets/fx-charged.png",
      fxSpark: "assets/fx-spark.png",
      fxHit: "assets/fx-hit.png",
    });
  }

  // ---- Drawing Helpers ----
  function drawFrame(
    ctx,
    img,
    frameW,
    frameH,
    frameIndex,
    dx,
    dy,
    flipX,
    rotation,
  ) {
    var cols = Math.floor(img.width / frameW);
    var sx = (frameIndex % cols) * frameW;
    var sy = Math.floor(frameIndex / cols) * frameH;
    ctx.save();
    ctx.translate(dx + frameW / 2, dy + frameH / 2);
    if (rotation) ctx.rotate(rotation);
    if (flipX) ctx.scale(-1, 1);
    ctx.drawImage(
      img,
      sx,
      sy,
      frameW,
      frameH,
      -frameW / 2,
      -frameH / 2,
      frameW,
      frameH,
    );
    ctx.restore();
  }

  function drawTile(ctx, tileIndex, dx, dy) {
    var img = assets.get("tileset");
    var sx = (tileIndex % TILESET_COLS) * TILE;
    var sy = Math.floor(tileIndex / TILESET_COLS) * TILE;
    ctx.drawImage(img, sx, sy, TILE, TILE, dx, dy, TILE, TILE);
  }

  // ---- Direction helpers ----
  // Sprites face DOWN by default (angle 0 = down). We need rotation relative to down.
  // down = 0, right = -PI/2, up = PI, left = PI/2
  function dirToAngle(dx, dy) {
    // atan2 gives angle from right (east). Our sprite faces down (south).
    // South in atan2 is PI/2, so rotation = atan2(dy, dx) - PI/2
    if (dx === 0 && dy === 0) return 0;
    return Math.atan2(dy, dx) - Math.PI / 2;
  }

  // ---- Room Generation ----
  // Each room is a 20x20 tile grid. 0 = floor, 1 = wall, 2 = door (locked), 3 = door (open), 4 = obstacle
  function generateRoom(floor, roomIndex, totalRoomsOnFloor, isBossRoom) {
    var map = [];
    for (var r = 0; r < ROOM_ROWS; r++) {
      map[r] = [];
      for (var c = 0; c < ROOM_COLS; c++) {
        // Borders are walls
        if (r === 0 || r === ROOM_ROWS - 1 || c === 0 || c === ROOM_COLS - 1) {
          map[r][c] = 1;
        } else {
          map[r][c] = 0;
        }
      }
    }

    // Add entrance at bottom center (except first room)
    if (roomIndex > 0) {
      map[ROOM_ROWS - 1][9] = 0;
      map[ROOM_ROWS - 1][10] = 0;
    }

    // Add exit door at top center (except last room if boss room)
    if (roomIndex < totalRoomsOnFloor - 1 || !isBossRoom) {
      map[0][9] = 2; // locked door
      map[0][10] = 2;
    }

    // Add obstacles - pillars, crates
    if (!isBossRoom) {
      var numObstacles = 3 + floor + Math.floor(Math.random() * 3);
      for (var i = 0; i < numObstacles; i++) {
        var ox = 3 + Math.floor(Math.random() * (ROOM_COLS - 6));
        var oy = 3 + Math.floor(Math.random() * (ROOM_ROWS - 6));
        if (map[oy][ox] === 0) {
          map[oy][ox] = 4;
        }
      }
      // Add some symmetric pillar structures
      if (Math.random() < 0.6) {
        var py = 5 + Math.floor(Math.random() * 5);
        map[py][5] = 4;
        map[py][14] = 4;
      }
      if (Math.random() < 0.5) {
        var py2 = 10 + Math.floor(Math.random() * 5);
        map[py2][7] = 4;
        map[py2][12] = 4;
      }
    } else {
      // Boss room: sparse obstacles on sides only
      map[5][3] = 4;
      map[5][16] = 4;
      map[14][3] = 4;
      map[14][16] = 4;
    }

    return map;
  }

  function generateEnemies(floor, roomIndex, isBossRoom) {
    var list = [];
    if (isBossRoom) return list; // Boss is spawned separately

    var count = 2 + floor + Math.floor(roomIndex / 2);
    if (count > 8) count = 8;

    for (var i = 0; i < count; i++) {
      var type;
      var rand = Math.random();
      if (floor === 0) {
        type = rand < 0.7 ? 1 : 2;
      } else if (floor === 1) {
        type = rand < 0.4 ? 1 : rand < 0.75 ? 2 : 3;
      } else {
        type = rand < 0.25 ? 1 : rand < 0.55 ? 2 : 3;
      }

      // Place enemies away from entrance and exit
      var ex = 48 + Math.random() * (ROOM_COLS * TILE - 96);
      var ey = 48 + Math.random() * (ROOM_ROWS * TILE - 128);

      // Check not on obstacle tile
      var tc = Math.floor(ex / TILE);
      var tr = Math.floor(ey / TILE);
      if (
        tc >= 0 &&
        tc < ROOM_COLS &&
        tr >= 0 &&
        tr < ROOM_ROWS &&
        roomMap[tr][tc] !== 0
      ) {
        // Nudge
        ex = 80 + Math.random() * 160;
        ey = 60 + Math.random() * 160;
      }

      list.push(createEnemy(type, ex, ey));
    }
    return list;
  }

  // ---- Entity Constructors ----
  function createPlayer() {
    return {
      x: (ROOM_COLS * TILE) / 2 - 16,
      y: ROOM_ROWS * TILE - 64,
      w: 20,
      h: 20,
      speed: 100,
      hp: 10,
      maxHp: 10,
      energy: 100,
      maxEnergy: 100,
      energyRegen: 25, // per second
      shotCost: 8,
      shootCooldown: 0,
      shootRate: 0.18,
      invincible: 0,
      dead: false,
      animFrame: 0,
      animTimer: 0,
      moving: false,
      shooting: false,
      shootAnimTimer: 0,
      facing: { x: 0, y: 1 }, // facing down by default
      aimDir: { x: 0, y: 1 },
      deathTimer: 0,
      deathFrame: 0,
    };
  }

  function createEnemy(type, x, y) {
    var hp, speed, pts, w, h, fw, fh, fc;
    if (type === 1) {
      hp = 3;
      speed = 40;
      pts = 100;
      w = 28;
      h = 28;
      fw = 48;
      fh = 48;
      fc = 5;
    } else if (type === 2) {
      hp = 2;
      speed = 70;
      pts = 150;
      w = 28;
      h = 28;
      fw = 48;
      fh = 48;
      fc = 4;
    } else {
      hp = 6;
      speed = 25;
      pts = 200;
      w = 32;
      h = 32;
      fw = 48;
      fh = 48;
      fc = 4;
    }
    return {
      type: type,
      x: x,
      y: y,
      w: w,
      h: h,
      frameW: fw,
      frameH: fh,
      frameCount: fc,
      hp: hp,
      maxHp: hp,
      speed: speed,
      points: pts,
      dead: false,
      animFrame: 0,
      animTimer: 0,
      facing: { x: 0, y: 1 },
      shootTimer: type === 1 ? 2 + Math.random() * 2 : 999,
      behaviorTimer: 0,
      patrolAngle: Math.random() * Math.PI * 2,
      // Flanker vars
      flanking: false,
      flankTarget: { x: 0, y: 0 },
      // Heavy vars
      charging: false,
      chargeDir: { x: 0, y: 0 },
      chargeTimer: 0,
      stunTimer: 0,
    };
  }

  function createBoss() {
    return {
      x: (ROOM_COLS * TILE) / 2 - 48,
      y: 40,
      w: 64,
      h: 80,
      frameW: 96,
      frameH: 144,
      hp: 60,
      maxHp: 60,
      phase: 1, // 1 = idle/shoot, 2 = thrust attack, 3 = enraged
      dead: false,
      animFrame: 0,
      animTimer: 0,
      shootTimer: 2,
      attackTimer: 0,
      moveDir: 1,
      speed: 30,
      points: 2000,
      facing: { x: 0, y: 1 },
      thrustTimer: 0,
      thrustTarget: { x: 0, y: 0 },
      thrusting: false,
      thrustFrame: 0,
      invincible: 0,
    };
  }

  function createBullet(x, y, dx, dy, speed, isEnemy) {
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
    }
    return {
      x: x,
      y: y,
      vx: dx * speed,
      vy: dy * speed,
      w: 8,
      h: 8,
      dead: false,
      isEnemy: !!isEnemy,
      animFrame: 0,
      animTimer: 0,
      angle: Math.atan2(dy, dx),
    };
  }

  function createEffect(type, x, y) {
    return {
      type: type, // 'hit', 'explosion'
      x: x,
      y: y,
      frame: 0,
      timer: 0,
      dead: false,
    };
  }

  // ---- Tile Collision ----
  function isSolid(tileVal) {
    return tileVal === 1 || tileVal === 2 || tileVal === 4;
  }

  function tileCollision(x, y, w, h) {
    // Check corners and midpoints
    var points = [
      [x, y],
      [x + w, y],
      [x, y + h],
      [x + w, y + h],
      [x + w / 2, y],
      [x + w / 2, y + h],
      [x, y + h / 2],
      [x + w, y + h / 2],
    ];
    for (var i = 0; i < points.length; i++) {
      var col = Math.floor(points[i][0] / TILE);
      var row = Math.floor(points[i][1] / TILE);
      if (col < 0 || col >= ROOM_COLS || row < 0 || row >= ROOM_ROWS)
        return true;
      if (isSolid(roomMap[row][col])) return true;
    }
    return false;
  }

  function resolveEntityTileCollision(entity) {
    var margin = 2;
    var ex = entity.x + margin;
    var ey = entity.y + margin;
    var ew = entity.w - margin * 2;
    var eh = entity.h - margin * 2;

    // Horizontal
    if (tileCollision(ex, ey, ew, eh)) {
      // Try nudging
      entity.x = Math.round(entity.x);
      entity.y = Math.round(entity.y);
    }
  }

  // ---- Update Functions ----
  function updatePlayer(dt, input) {
    if (player.dead) {
      player.deathTimer += dt;
      player.animTimer += dt;
      if (player.animTimer > 0.1) {
        player.animTimer = 0;
        if (player.deathFrame < 6) player.deathFrame++;
      }
      return;
    }

    // Invincibility
    if (player.invincible > 0) player.invincible -= dt;

    // Energy regen
    player.energy = Math.min(
      player.maxEnergy,
      player.energy + player.energyRegen * dt,
    );

    // Shoot cooldown
    if (player.shootCooldown > 0) player.shootCooldown -= dt;
    if (player.shootAnimTimer > 0) player.shootAnimTimer -= dt;

    // Movement (WASD)
    var mx = 0,
      my = 0;
    if (input.isDown("KeyA")) mx -= 1;
    if (input.isDown("KeyD")) mx += 1;
    if (input.isDown("KeyW")) my -= 1;
    if (input.isDown("KeyS")) my += 1;

    player.moving = mx !== 0 || my !== 0;
    if (player.moving) {
      // Normalize diagonal
      var len = Math.sqrt(mx * mx + my * my);
      mx /= len;
      my /= len;
      player.facing.x = mx;
      player.facing.y = my;
    }

    // Move with collision
    var newX = player.x + mx * player.speed * dt;
    var newY = player.y + my * player.speed * dt;

    // Try X
    var oldX = player.x;
    player.x = newX;
    if (tileCollision(player.x + 6, player.y + 6, player.w - 4, player.h - 4)) {
      player.x = oldX;
    }
    // Try Y
    var oldY = player.y;
    player.y = newY;
    if (tileCollision(player.x + 6, player.y + 6, player.w - 4, player.h - 4)) {
      player.y = oldY;
    }

    // Check door exit (top of room)
    if (doorOpen && player.y < 4) {
      advanceRoom();
      return;
    }

    // Aiming (Arrow keys)
    var ax = 0,
      ay = 0;
    if (input.isDown("ArrowLeft")) ax -= 1;
    if (input.isDown("ArrowRight")) ax += 1;
    if (input.isDown("ArrowUp")) ay -= 1;
    if (input.isDown("ArrowDown")) ay += 1;

    if (ax !== 0 || ay !== 0) {
      var alen = Math.sqrt(ax * ax + ay * ay);
      player.aimDir.x = ax / alen;
      player.aimDir.y = ay / alen;

      // Shooting
      if (player.shootCooldown <= 0 && player.energy >= player.shotCost) {
        player.energy -= player.shotCost;
        player.shootCooldown = player.shootRate;
        player.shootAnimTimer = 0.15;
        player.shooting = true;

        var bx = player.x + player.w / 2 - 4 + player.aimDir.x * 12;
        var by = player.y + player.h / 2 - 4 + player.aimDir.y * 12;
        bullets.push(
          createBullet(bx, by, player.aimDir.x, player.aimDir.y, 200, false),
        );

        audio.playTone(800, 0.06, "square", 0.15);
        audio.playTone(1200, 0.03, "sine", 0.1);
      }
    } else {
      player.shooting = false;
      // If not aiming, aim direction follows movement direction
      if (player.moving) {
        player.aimDir.x = player.facing.x;
        player.aimDir.y = player.facing.y;
      }
    }

    // Animation
    player.animTimer += dt;
    if (player.animTimer > 0.1) {
      player.animTimer = 0;
      player.animFrame = (player.animFrame + 1) % 6;
    }
  }

  function updateEnemy(enemy, dt) {
    if (enemy.dead) return;
    if (enemy.stunTimer > 0) {
      enemy.stunTimer -= dt;
      return;
    }

    var dx = player.x + player.w / 2 - (enemy.x + enemy.w / 2);
    var dy = player.y + player.h / 2 - (enemy.y + enemy.h / 2);
    var dist = Math.sqrt(dx * dx + dy * dy);
    var ndx = dist > 0 ? dx / dist : 0;
    var ndy = dist > 0 ? dy / dist : 0;

    enemy.behaviorTimer += dt;

    if (enemy.type === 1) {
      // Patrol: move in patterns, occasionally walk toward player
      enemy.patrolAngle += dt * 0.8;
      var px, py;
      if (dist < 120 && enemy.behaviorTimer > 3) {
        // Walk toward player
        px = ndx * enemy.speed;
        py = ndy * enemy.speed;
      } else {
        px = Math.cos(enemy.patrolAngle) * enemy.speed;
        py = Math.sin(enemy.patrolAngle) * enemy.speed;
      }

      var newX = enemy.x + px * dt;
      var newY = enemy.y + py * dt;

      var exOld = enemy.x;
      enemy.x = newX;
      if (
        tileCollision(enemy.x + 10, enemy.y + 10, enemy.w - 12, enemy.h - 12)
      ) {
        enemy.x = exOld;
        enemy.patrolAngle += Math.PI * 0.5;
      }
      var eyOld = enemy.y;
      enemy.y = newY;
      if (
        tileCollision(enemy.x + 10, enemy.y + 10, enemy.w - 12, enemy.h - 12)
      ) {
        enemy.y = eyOld;
        enemy.patrolAngle += Math.PI * 0.5;
      }

      if (px !== 0 || py !== 0) {
        enemy.facing.x = px > 0 ? 1 : px < 0 ? -1 : 0;
        enemy.facing.y = py > 0 ? 1 : py < 0 ? -1 : 0;
      }

      // Shooting
      enemy.shootTimer -= dt;
      if (enemy.shootTimer <= 0 && dist < 150 && !player.dead) {
        enemy.shootTimer = 2 + Math.random() * 2;
        var bx = enemy.x + enemy.w / 2;
        var by = enemy.y + enemy.h / 2;
        enemyBullets.push(createBullet(bx, by, ndx, ndy, 100, true));
        audio.playTone(400, 0.08, "sawtooth", 0.1);
      }
    } else if (enemy.type === 2) {
      // Flanker: tries to get behind the player
      if (!enemy.flanking || enemy.behaviorTimer > 2) {
        enemy.behaviorTimer = 0;
        enemy.flanking = true;
        // Target behind the player based on their aim
        var behindX =
          player.x - player.aimDir.x * 60 + (Math.random() - 0.5) * 40;
        var behindY =
          player.y - player.aimDir.y * 60 + (Math.random() - 0.5) * 40;
        enemy.flankTarget.x = Utils.clamp(behindX, 20, ROOM_COLS * TILE - 20);
        enemy.flankTarget.y = Utils.clamp(behindY, 20, ROOM_ROWS * TILE - 20);
      }

      var fdx = enemy.flankTarget.x - enemy.x;
      var fdy = enemy.flankTarget.y - enemy.y;
      var fdist = Math.sqrt(fdx * fdx + fdy * fdy);
      if (fdist > 4) {
        var fnx = fdx / fdist;
        var fny = fdy / fdist;
        var newFX = enemy.x + fnx * enemy.speed * dt;
        var newFY = enemy.y + fny * enemy.speed * dt;

        var exOld2 = enemy.x;
        enemy.x = newFX;
        if (
          tileCollision(enemy.x + 10, enemy.y + 10, enemy.w - 12, enemy.h - 12)
        ) {
          enemy.x = exOld2;
        }
        var eyOld2 = enemy.y;
        enemy.y = newFY;
        if (
          tileCollision(enemy.x + 10, enemy.y + 10, enemy.w - 12, enemy.h - 12)
        ) {
          enemy.y = eyOld2;
        }

        enemy.facing.x = fnx > 0.3 ? 1 : fnx < -0.3 ? -1 : 0;
        enemy.facing.y = fny > 0.3 ? 1 : fny < -0.3 ? -1 : 0;
      }
    } else if (enemy.type === 3) {
      // Heavy: slow, charges at player periodically
      if (!enemy.charging) {
        // Slowly walk toward player
        var newHX = enemy.x + ndx * enemy.speed * dt;
        var newHY = enemy.y + ndy * enemy.speed * dt;

        var exOld3 = enemy.x;
        enemy.x = newHX;
        if (
          tileCollision(enemy.x + 10, enemy.y + 10, enemy.w - 12, enemy.h - 12)
        ) {
          enemy.x = exOld3;
        }
        var eyOld3 = enemy.y;
        enemy.y = newHY;
        if (
          tileCollision(enemy.x + 10, enemy.y + 10, enemy.w - 12, enemy.h - 12)
        ) {
          enemy.y = eyOld3;
        }

        enemy.facing.x = ndx;
        enemy.facing.y = ndy;

        // Charge buildup
        enemy.chargeTimer += dt;
        if (enemy.chargeTimer > 3 && dist < 130 && dist > 30) {
          enemy.charging = true;
          enemy.chargeTimer = 0;
          enemy.chargeDir.x = ndx;
          enemy.chargeDir.y = ndy;
          audio.playTone(150, 0.2, "sawtooth", 0.2);
        }
      } else {
        // Charging!
        var chargeSpeed = enemy.speed * 5;
        var newCX = enemy.x + enemy.chargeDir.x * chargeSpeed * dt;
        var newCY = enemy.y + enemy.chargeDir.y * chargeSpeed * dt;

        var exOld4 = enemy.x;
        enemy.x = newCX;
        if (
          tileCollision(enemy.x + 10, enemy.y + 10, enemy.w - 12, enemy.h - 12)
        ) {
          enemy.x = exOld4;
          enemy.charging = false;
          enemy.stunTimer = 0.8;
          screenShake = 0.1;
          screenShakeTimer = 0.1;
          audio.playTone(80, 0.15, "square", 0.3);
        }
        var eyOld4 = enemy.y;
        enemy.y = newCY;
        if (
          tileCollision(enemy.x + 10, enemy.y + 10, enemy.w - 12, enemy.h - 12)
        ) {
          enemy.y = eyOld4;
          enemy.charging = false;
          enemy.stunTimer = 0.8;
          screenShake = 0.1;
          screenShakeTimer = 0.1;
          audio.playTone(80, 0.15, "square", 0.3);
        }

        enemy.chargeTimer += dt;
        if (enemy.chargeTimer > 0.6) {
          enemy.charging = false;
          enemy.chargeTimer = 0;
        }
      }
    }

    // Animation
    enemy.animTimer += dt;
    if (enemy.animTimer > 0.12) {
      enemy.animTimer = 0;
      enemy.animFrame = (enemy.animFrame + 1) % enemy.frameCount;
    }
  }

  function updateBoss(boss, dt) {
    if (boss.dead) return;
    if (boss.invincible > 0) boss.invincible -= dt;

    boss.animTimer += dt;
    if (boss.animTimer > 0.15) {
      boss.animTimer = 0;
      boss.animFrame = (boss.animFrame + 1) % 10;
    }

    // Phase transitions
    if (boss.hp <= boss.maxHp * 0.3 && boss.phase < 3) {
      boss.phase = 3;
      boss.speed = 50;
      audio.playTone(100, 0.5, "sawtooth", 0.3);
    } else if (boss.hp <= boss.maxHp * 0.6 && boss.phase < 2) {
      boss.phase = 2;
      boss.speed = 40;
      audio.playTone(150, 0.3, "sawtooth", 0.2);
    }

    if (boss.thrusting) {
      // Thrust attack: dash toward target
      var tdx = boss.thrustTarget.x - (boss.x + boss.w / 2);
      var tdy = boss.thrustTarget.y - (boss.y + boss.h / 2);
      var tdist = Math.sqrt(tdx * tdx + tdy * tdy);

      if (tdist > 8) {
        var tspd = 180;
        boss.x += (tdx / tdist) * tspd * dt;
        boss.y += (tdy / tdist) * tspd * dt;
      } else {
        boss.thrusting = false;
        boss.attackTimer = 0;
        // Impact effect
        screenShake = 0.2;
        screenShakeTimer = 0.2;
        audio.playTone(80, 0.3, "sawtooth", 0.3);
        particles.emit({
          x: boss.x + boss.w / 2,
          y: boss.y + boss.h / 2,
          count: 15,
          speedMin: 40,
          speedMax: 120,
          colors: ["#f00", "#f80", "#ff0"],
          lifeMin: 0.2,
          lifeMax: 0.5,
        });
      }

      boss.thrustTimer += dt;
      boss.thrustFrame = Math.floor(boss.thrustTimer / 0.08) % 5;
      if (boss.thrustTimer > 1.5) {
        boss.thrusting = false;
        boss.attackTimer = 0;
      }

      // Keep in bounds
      boss.x = Utils.clamp(boss.x, 16, ROOM_COLS * TILE - boss.w - 16);
      boss.y = Utils.clamp(boss.y, 16, ROOM_ROWS * TILE - boss.h - 16);
      return;
    }

    // Move side to side
    boss.x += boss.moveDir * boss.speed * dt;
    if (boss.x < 20 || boss.x > ROOM_COLS * TILE - boss.w - 20) {
      boss.moveDir *= -1;
    }
    boss.x = Utils.clamp(boss.x, 16, ROOM_COLS * TILE - boss.w - 16);

    // Attack patterns
    boss.attackTimer += dt;
    boss.shootTimer -= dt;

    // Shoot bolts
    if (boss.shootTimer <= 0 && !player.dead) {
      var pdx = player.x + player.w / 2 - (boss.x + boss.w / 2);
      var pdy = player.y + player.h / 2 - (boss.y + boss.h / 2);
      var pdist = Math.sqrt(pdx * pdx + pdy * pdy);
      var pndx = pdist > 0 ? pdx / pdist : 0;
      var pndy = pdist > 0 ? pdy / pdist : 0;

      var boltSpeed = boss.phase >= 3 ? 140 : boss.phase >= 2 ? 120 : 100;
      enemyBullets.push(
        createBullet(
          boss.x + boss.w / 2,
          boss.y + boss.h,
          pndx,
          pndy,
          boltSpeed,
          true,
        ),
      );

      if (boss.phase >= 2) {
        // Spread shot
        var spreadAngle = 0.25;
        var cos1 = Math.cos(spreadAngle),
          sin1 = Math.sin(spreadAngle);
        enemyBullets.push(
          createBullet(
            boss.x + boss.w / 2,
            boss.y + boss.h,
            pndx * cos1 - pndy * sin1,
            pndx * sin1 + pndy * cos1,
            boltSpeed,
            true,
          ),
        );
        enemyBullets.push(
          createBullet(
            boss.x + boss.w / 2,
            boss.y + boss.h,
            pndx * cos1 + pndy * sin1,
            -pndx * sin1 + pndy * cos1,
            boltSpeed,
            true,
          ),
        );
      }

      if (boss.phase >= 3) {
        // Extra side bolts
        enemyBullets.push(
          createBullet(boss.x, boss.y + boss.h / 2, -1, 0.5, 80, true),
        );
        enemyBullets.push(
          createBullet(boss.x + boss.w, boss.y + boss.h / 2, 1, 0.5, 80, true),
        );
      }

      boss.shootTimer = boss.phase >= 3 ? 0.6 : boss.phase >= 2 ? 1.0 : 1.5;
      audio.playTone(300, 0.1, "square", 0.15);
    }

    // Thrust attack
    if (boss.phase >= 2 && boss.attackTimer > 4 && !player.dead) {
      boss.thrusting = true;
      boss.thrustTimer = 0;
      boss.thrustTarget.x = player.x + player.w / 2;
      boss.thrustTarget.y = player.y + player.h / 2;
      audio.playTone(200, 0.15, "sawtooth", 0.2);
      audio.playTone(250, 0.1, "square", 0.15);
    }
  }

  function updateBullets(dt) {
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.animTimer += dt;
      if (b.animTimer > 0.05) {
        b.animTimer = 0;
        b.animFrame = (b.animFrame + 1) % 6;
      }

      // Out of room
      if (
        b.x < -8 ||
        b.x > ROOM_COLS * TILE + 8 ||
        b.y < -8 ||
        b.y > ROOM_ROWS * TILE + 8
      ) {
        b.dead = true;
      }
      // Tile collision
      var tc = Math.floor((b.x + 4) / TILE);
      var tr = Math.floor((b.y + 4) / TILE);
      if (tc >= 0 && tc < ROOM_COLS && tr >= 0 && tr < ROOM_ROWS) {
        if (isSolid(roomMap[tr][tc])) {
          b.dead = true;
          effects.push(createEffect("hit", b.x, b.y));
        }
      }
    }
    bullets = bullets.filter(function (b) {
      return !b.dead;
    });
  }

  function updateEnemyBullets(dt) {
    for (var i = enemyBullets.length - 1; i >= 0; i--) {
      var b = enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.animTimer += dt;
      if (b.animTimer > 0.06) {
        b.animTimer = 0;
        b.animFrame = (b.animFrame + 1) % 6;
      }

      if (
        b.x < -8 ||
        b.x > ROOM_COLS * TILE + 8 ||
        b.y < -8 ||
        b.y > ROOM_ROWS * TILE + 8
      ) {
        b.dead = true;
      }
      var tc = Math.floor((b.x + 4) / TILE);
      var tr = Math.floor((b.y + 4) / TILE);
      if (tc >= 0 && tc < ROOM_COLS && tr >= 0 && tr < ROOM_ROWS) {
        if (isSolid(roomMap[tr][tc])) {
          b.dead = true;
        }
      }
    }
    enemyBullets = enemyBullets.filter(function (b) {
      return !b.dead;
    });
  }

  function updateEffects(dt) {
    for (var i = effects.length - 1; i >= 0; i--) {
      var e = effects[i];
      e.timer += dt;
      if (e.type === "hit") {
        e.frame = Math.floor(e.timer / 0.05);
        if (e.frame >= 5) e.dead = true;
      } else if (e.type === "explosion") {
        e.frame = Math.floor(e.timer / 0.06);
        if (e.frame >= 7) e.dead = true;
      }
    }
    effects = effects.filter(function (e) {
      return !e.dead;
    });
  }

  function checkCollisions() {
    // Player bullets vs enemies
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      if (b.dead) continue;

      for (var j = 0; j < enemies.length; j++) {
        var e = enemies[j];
        if (e.dead) continue;
        var bHit = { x: b.x, y: b.y, w: b.w, h: b.h };
        var eHit = { x: e.x + 6, y: e.y + 6, w: e.w - 4, h: e.h - 4 };
        if (Collision.rectRect(bHit, eHit)) {
          b.dead = true;
          e.hp -= 1;
          effects.push(createEffect("hit", b.x, b.y));
          audio.playTone(500, 0.05, "square", 0.1);

          if (e.hp <= 0) {
            e.dead = true;
            score += e.points;
            effects.push(
              createEffect("explosion", e.x + e.w / 2 - 40, e.y + e.h / 2 - 40),
            );
            particles.emit({
              x: e.x + e.w / 2,
              y: e.y + e.h / 2,
              count: 10,
              speedMin: 30,
              speedMax: 100,
              colors: ["#f80", "#ff0", "#f00", "#fff"],
              lifeMin: 0.2,
              lifeMax: 0.5,
            });
            audio.playTone(120, 0.2, "sawtooth", 0.25);
            audio.playTone(80, 0.3, "square", 0.2);
            screenShake = 0.1;
            screenShakeTimer = 0.1;
          }
          break;
        }
      }

      // Player bullets vs boss
      if (bossActive && !b.dead && boss && !boss.dead) {
        var bHit2 = { x: b.x, y: b.y, w: b.w, h: b.h };
        var bossHit = {
          x: boss.x + 10,
          y: boss.y + 20,
          w: boss.w - 20,
          h: boss.h - 30,
        };
        if (boss.invincible <= 0 && Collision.rectRect(bHit2, bossHit)) {
          b.dead = true;
          boss.hp -= 1;
          effects.push(createEffect("hit", b.x, b.y));
          audio.playTone(400, 0.06, "square", 0.12);

          if (boss.hp <= 0) {
            boss.dead = true;
            bossDefeated = true;
            score += boss.points;
            for (var k = 0; k < 5; k++) {
              effects.push(
                createEffect(
                  "explosion",
                  boss.x + Math.random() * boss.w - 40,
                  boss.y + Math.random() * boss.h - 40,
                ),
              );
            }
            particles.emit({
              x: boss.x + boss.w / 2,
              y: boss.y + boss.h / 2,
              count: 30,
              speedMin: 50,
              speedMax: 150,
              colors: ["#f80", "#ff0", "#f00", "#fff", "#f0f"],
              lifeMin: 0.3,
              lifeMax: 0.8,
            });
            screenShake = 0.4;
            screenShakeTimer = 0.4;
            audio.playTone(60, 0.5, "sawtooth", 0.4);
            audio.playTone(40, 0.7, "square", 0.3);
          }
        }
      }
    }

    // Enemy bullets vs player
    if (!player.dead && player.invincible <= 0) {
      for (var i2 = 0; i2 < enemyBullets.length; i2++) {
        var eb = enemyBullets[i2];
        if (eb.dead) continue;
        var ebHit = { x: eb.x, y: eb.y, w: eb.w, h: eb.h };
        var pHit = {
          x: player.x + 4,
          y: player.y + 4,
          w: player.w - 4,
          h: player.h - 4,
        };
        if (Collision.rectRect(ebHit, pHit)) {
          eb.dead = true;
          damagePlayer(1);
          break;
        }
      }
    }

    // Enemies body vs player
    if (!player.dead && player.invincible <= 0) {
      for (var j2 = 0; j2 < enemies.length; j2++) {
        var en = enemies[j2];
        if (en.dead) continue;
        var enHit = { x: en.x + 4, y: en.y + 4, w: en.w - 8, h: en.h - 8 };
        var pHit2 = {
          x: player.x + 4,
          y: player.y + 4,
          w: player.w - 4,
          h: player.h - 4,
        };
        if (Collision.rectRect(enHit, pHit2)) {
          damagePlayer(en.type === 3 ? 2 : 1);
          break;
        }
      }

      // Boss body vs player
      if (bossActive && boss && !boss.dead) {
        var bossBody = {
          x: boss.x + 8,
          y: boss.y + 16,
          w: boss.w - 16,
          h: boss.h - 24,
        };
        var pHit3 = {
          x: player.x + 4,
          y: player.y + 4,
          w: player.w - 4,
          h: player.h - 4,
        };
        if (Collision.rectRect(bossBody, pHit3)) {
          damagePlayer(2);
        }
      }
    }
  }

  function damagePlayer(amount) {
    player.hp -= amount;
    player.invincible = 1.0;
    screenShake = 0.15;
    screenShakeTimer = 0.15;
    audio.playTone(200, 0.15, "sawtooth", 0.25);
    effects.push(
      createEffect(
        "hit",
        player.x + player.w / 2 - 16,
        player.y + player.h / 2 - 16,
      ),
    );

    if (player.hp <= 0) {
      player.dead = true;
      player.hp = 0;
      audio.playTone(100, 0.3, "sawtooth", 0.3);
      audio.playTone(60, 0.5, "square", 0.25);
    }
  }

  function checkRoomClear() {
    if (roomEnemiesCleared) return;
    if (bossActive) {
      if (boss && boss.dead) {
        roomEnemiesCleared = true;
        doorOpen = true;
      }
      return;
    }
    var allDead = true;
    for (var i = 0; i < enemies.length; i++) {
      if (!enemies[i].dead) {
        allDead = false;
        break;
      }
    }
    if (allDead && enemies.length > 0) {
      roomEnemiesCleared = true;
      doorOpen = true;
      // Open doors
      for (var r = 0; r < ROOM_ROWS; r++) {
        for (var c = 0; c < ROOM_COLS; c++) {
          if (roomMap[r][c] === 2) roomMap[r][c] = 3;
        }
      }
      audio.playTone(600, 0.1, "sine", 0.2);
      audio.playTone(900, 0.15, "sine", 0.2);
    }
    // If room started with no enemies, open immediately
    if (enemies.length === 0 && !roomEnemiesCleared) {
      roomEnemiesCleared = true;
      doorOpen = true;
      for (var r2 = 0; r2 < ROOM_ROWS; r2++) {
        for (var c2 = 0; c2 < ROOM_COLS; c2++) {
          if (roomMap[r2][c2] === 2) roomMap[r2][c2] = 3;
        }
      }
    }
  }

  var boss;

  function advanceRoom() {
    currentRoom++;
    bullets = [];
    enemyBullets = [];
    effects = [];
    particles.clear();
    bossActive = false;
    boss = null;
    bossDefeated = false;

    if (currentRoom >= totalRooms) {
      // Next floor
      currentFloor++;
      currentRoom = 0;

      if (currentFloor >= 3) {
        // Game won!
        return "win";
      }

      totalRooms = 4 + currentFloor;
    }

    var isBossRoom = currentFloor === 2 && currentRoom === totalRooms - 1;
    roomMap = generateRoom(currentFloor, currentRoom, totalRooms, isBossRoom);
    roomEnemiesCleared = false;
    doorOpen = false;

    if (isBossRoom) {
      bossActive = true;
      boss = createBoss();
      enemies = [];
    } else {
      enemies = generateEnemies(currentFloor, currentRoom, false);
    }

    // Player position: bottom center (entrance)
    player.x = (ROOM_COLS * TILE) / 2 - 16;
    player.y = ROOM_ROWS * TILE - 48;

    return "next";
  }

  function initNewGame() {
    currentFloor = 0;
    currentRoom = 0;
    totalRooms = 4;
    score = 0;
    gameTime = 0;
    bossActive = false;
    boss = null;
    bossDefeated = false;
    screenShake = 0;
    screenShakeTimer = 0;

    player = createPlayer();
    bullets = [];
    enemyBullets = [];
    effects = [];
    explosions = [];
    particles.clear();

    var isBossRoom = currentFloor === 2 && currentRoom === totalRooms - 1;
    roomMap = generateRoom(currentFloor, currentRoom, totalRooms, isBossRoom);
    roomEnemiesCleared = false;
    doorOpen = false;
    enemies = generateEnemies(currentFloor, currentRoom, false);

    camera = { x: 0, y: 0 };
  }

  // ---- Rendering ----
  function renderRoom(ctx) {
    var tileImg = assets.get("tileset");

    for (var r = 0; r < ROOM_ROWS; r++) {
      for (var c = 0; c < ROOM_COLS; c++) {
        var tile = roomMap[r][c];
        var dx = c * TILE - camera.x;
        var dy = r * TILE - camera.y;

        // Skip tiles off screen
        if (dx < -TILE || dx > W || dy < -TILE || dy > H) continue;

        if (tile === 0) {
          // Floor - alternate pattern
          var floorTile =
            (r + c) % 3 === 0
              ? TILES.FLOOR2
              : (r + c) % 3 === 1
                ? TILES.FLOOR1
                : TILES.FLOOR3;
          drawTile(ctx, floorTile, dx, dy);
        } else if (tile === 1) {
          // Wall
          if (r === 0) {
            drawTile(ctx, TILES.WALL_TOP, dx, dy);
          } else if (r === ROOM_ROWS - 1) {
            drawTile(ctx, TILES.WALL_TOP, dx, dy);
          } else if (c === 0) {
            drawTile(ctx, TILES.WALL_LEFT, dx, dy);
          } else if (c === ROOM_COLS - 1) {
            drawTile(ctx, TILES.WALL_RIGHT, dx, dy);
          } else {
            drawTile(ctx, TILES.WALL_MID, dx, dy);
          }
        } else if (tile === 2) {
          // Locked door
          drawTile(ctx, TILES.FLOOR1, dx, dy);
          drawTile(ctx, TILES.DOOR, dx, dy);
        } else if (tile === 3) {
          // Open door (floor only)
          drawTile(ctx, TILES.FLOOR1, dx, dy);
        } else if (tile === 4) {
          // Obstacle
          drawTile(ctx, TILES.FLOOR1, dx, dy);
          drawTile(ctx, (r + c) % 2 === 0 ? TILES.CRATE : TILES.BARREL, dx, dy);
        }
      }
    }
  }

  function renderPlayer(ctx) {
    if (player.dead) {
      var deathImg = assets.get("playerDeath");
      var rotation = dirToAngle(player.aimDir.x, player.aimDir.y);
      drawFrame(
        ctx,
        deathImg,
        32,
        32,
        Math.min(player.deathFrame, 6),
        player.x - 6 - camera.x,
        player.y - 6 - camera.y,
        false,
        rotation,
      );
      return;
    }

    // Blink when invincible
    if (player.invincible > 0 && Math.floor(player.invincible * 10) % 2 === 0)
      return;

    var rotation = dirToAngle(player.aimDir.x, player.aimDir.y);
    var img;
    var frame;

    if (player.shootAnimTimer > 0) {
      img = assets.get("playerShot");
      frame = Math.min(Math.floor((0.15 - player.shootAnimTimer) / 0.05), 2);
    } else if (player.moving) {
      img = assets.get("playerGunWalk");
      frame = player.animFrame;
    } else {
      img = assets.get("playerGunWalk");
      frame = 0;
    }

    drawFrame(
      ctx,
      img,
      32,
      32,
      frame,
      player.x - 6 - camera.x,
      player.y - 6 - camera.y,
      false,
      rotation,
    );
  }

  function renderEnemies(ctx) {
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (e.dead) continue;

      var imgKey = "enemy0" + e.type;
      var img = assets.get(imgKey);
      var rotation = dirToAngle(e.facing.x, e.facing.y);

      // Draw offset to center the 48x48 frame on the entity
      var offX = (e.frameW - e.w) / 2;
      var offY = (e.frameH - e.h) / 2;

      drawFrame(
        ctx,
        img,
        e.frameW,
        e.frameH,
        e.animFrame,
        e.x - offX - camera.x,
        e.y - offY - camera.y,
        false,
        rotation,
      );

      // HP bar for enemies with more than 1 hp
      if (e.maxHp > 1 && e.hp < e.maxHp) {
        var barW = e.w;
        var barX = e.x - camera.x;
        var barY = e.y - 6 - camera.y;
        UI.drawHealthBar(
          ctx,
          barX,
          barY,
          barW,
          3,
          e.hp,
          e.maxHp,
          "#f00",
          "#400",
          "#000",
        );
      }

      // Charge indicator for heavy
      if (e.type === 3 && e.charging) {
        ctx.fillStyle = "#f00";
        ctx.globalAlpha = 0.4;
        ctx.fillRect(e.x - camera.x, e.y - camera.y, e.w, e.h);
        ctx.globalAlpha = 1;
      }
    }
  }

  function renderBoss(ctx) {
    if (!boss || boss.dead) return;

    var bossImg = assets.get("boss");
    var dx = boss.x - 16 - camera.x;
    var dy = boss.y - 32 - camera.y;

    // Flash on hit
    if (boss.invincible > 0 && Math.floor(boss.invincible * 15) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    drawFrame(
      ctx,
      bossImg,
      boss.frameW,
      boss.frameH,
      boss.animFrame,
      dx,
      dy,
      false,
      0,
    );
    ctx.globalAlpha = 1;

    // Helmet
    var helmetImg = assets.get("bossHelmet");
    if (helmetImg) {
      ctx.drawImage(
        helmetImg,
        boss.x + boss.w / 2 - 32 - camera.x,
        boss.y - 20 - camera.y,
      );
    }

    // Thrust attack visual
    if (boss.thrusting) {
      var thrustImg = assets.get("bossThrust");
      if (thrustImg) {
        drawFrame(
          ctx,
          thrustImg,
          48,
          48,
          boss.thrustFrame,
          boss.x + boss.w / 2 - 24 - camera.x,
          boss.y + boss.h - 10 - camera.y,
          false,
          0,
        );
      }
    }

    // Boss HP bar
    var bossBarW = 100;
    var bossBarX = W / 2 - bossBarW / 2;
    UI.drawHealthBar(
      ctx,
      bossBarX,
      24,
      bossBarW,
      6,
      boss.hp,
      boss.maxHp,
      "#f00",
      "#400",
      "#fff",
    );
    UI.drawCenteredText(ctx, "DUNGEON WARDEN", W, 15, {
      font: "bold 8px monospace",
      color: "#f44",
    });
  }

  function renderBullets(ctx) {
    var boltImg = assets.get("fxBolt");

    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      if (b.dead) continue;
      var rotation = b.angle - Math.PI / 2;
      drawFrame(
        ctx,
        boltImg,
        32,
        32,
        b.animFrame,
        b.x - 12 - camera.x,
        b.y - 12 - camera.y,
        false,
        rotation,
      );
    }

    // Enemy bullets use boss-bolt or tinted bolt
    var bossBoltImg = assets.get("bossBolt");
    for (var j = 0; j < enemyBullets.length; j++) {
      var eb = enemyBullets[j];
      if (eb.dead) continue;
      // Draw as a red-tinted bolt
      ctx.save();
      ctx.translate(eb.x + 4 - camera.x, eb.y + 4 - camera.y);
      ctx.rotate(eb.angle);
      if (bossBoltImg) {
        ctx.drawImage(bossBoltImg, -8, -4);
      } else {
        ctx.fillStyle = "#f44";
        ctx.fillRect(-4, -2, 8, 4);
      }
      ctx.restore();
    }
  }

  function renderEffects(ctx) {
    var hitImg = assets.get("fxHit");
    var explosionImg = assets.get("enemyExplosion");

    for (var i = 0; i < effects.length; i++) {
      var e = effects[i];
      if (e.dead) continue;

      if (e.type === "hit" && hitImg) {
        drawFrame(
          ctx,
          hitImg,
          32,
          32,
          Math.min(e.frame, 4),
          e.x - camera.x,
          e.y - camera.y,
          false,
          0,
        );
      } else if (e.type === "explosion" && explosionImg) {
        drawFrame(
          ctx,
          explosionImg,
          80,
          80,
          Math.min(e.frame, 6),
          e.x - camera.x,
          e.y - camera.y,
          false,
          0,
        );
      }
    }
  }

  function renderHUD(ctx) {
    // Health bar
    UI.drawText(ctx, "HP", 4, 4, { font: "7px monospace", color: "#f88" });
    UI.drawHealthBar(
      ctx,
      18,
      4,
      60,
      7,
      player.hp,
      player.maxHp,
      "#0f0",
      "#600",
      "#fff",
    );

    // Energy bar
    UI.drawText(ctx, "EN", 4, 14, { font: "7px monospace", color: "#8bf" });
    UI.drawHealthBar(
      ctx,
      18,
      14,
      60,
      7,
      player.energy,
      player.maxEnergy,
      "#08f",
      "#006",
      "#fff",
    );

    // Floor / Room
    UI.drawText(
      ctx,
      "F" + (currentFloor + 1) + " R" + (currentRoom + 1),
      W - 4,
      4,
      {
        font: "8px monospace",
        color: "#ff0",
        align: "right",
      },
    );

    // Score
    UI.drawText(ctx, "" + score, W - 4, 14, {
      font: "8px monospace",
      color: "#fff",
      align: "right",
    });

    // Door status
    if (!doorOpen && !bossActive) {
      var remaining = 0;
      for (var i = 0; i < enemies.length; i++) {
        if (!enemies[i].dead) remaining++;
      }
      if (remaining > 0) {
        UI.drawCenteredText(ctx, remaining + " ENEMIES REMAINING", W, H - 10, {
          font: "7px monospace",
          color: "#f88",
        });
      }
    } else if (doorOpen && !bossActive) {
      if (UI.blink(gameTime, 3)) {
        UI.drawCenteredText(ctx, "DOOR OPEN - GO NORTH", W, H - 10, {
          font: "7px monospace",
          color: "#0f0",
        });
      }
    }
  }

  // ---- Camera ----
  function updateCamera() {
    // Center camera on player, clamped to room bounds
    var targetX = player.x + player.w / 2 - W / 2;
    var targetY = player.y + player.h / 2 - H / 2;
    camera.x = Utils.clamp(targetX, 0, ROOM_COLS * TILE - W);
    camera.y = Utils.clamp(targetY, 0, ROOM_ROWS * TILE - H);
  }

  // ---- State Machine ----
  sm.add("menu", {
    enter: function () {},
    update: function (dt, game) {
      gameTime = (gameTime || 0) + dt;
      if (game.input.justPressed("Enter") || game.input.justPressed("Space")) {
        audio.init();
        audio.resume();
        sm.switch("playing", game);
      }
    },
    render: function (ctx, game) {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, W, H);

      // Decorative tiles background
      var tileImg = assets.get("tileset");
      if (tileImg) {
        ctx.globalAlpha = 0.15;
        for (var r = 0; r < 20; r++) {
          for (var c = 0; c < 20; c++) {
            var ti = (r + c) % 3 === 0 ? TILES.FLOOR2 : TILES.FLOOR1;
            drawTile(ctx, ti, c * TILE, r * TILE);
          }
        }
        ctx.globalAlpha = 1;
      }

      // Title
      UI.drawCenteredText(ctx, "TOP-DOWN", W, 60, {
        font: "bold 28px monospace",
        color: "#0ff",
      });
      UI.drawCenteredText(ctx, "SHOOTER", W, 90, {
        font: "bold 28px monospace",
        color: "#f80",
      });

      // Subtitle
      UI.drawCenteredText(ctx, "Cyberpunk Dungeon", W, 125, {
        font: "10px monospace",
        color: "#888",
      });

      // Player sprite preview
      var pImg = assets.get("playerGunWalk");
      if (pImg) {
        var previewFrame = Math.floor((gameTime || 0) * 6) % 6;
        drawFrame(ctx, pImg, 32, 32, previewFrame, W / 2 - 16, 145, false, 0);
      }

      // Controls
      UI.drawCenteredText(ctx, "CONTROLS", W, 190, {
        font: "bold 9px monospace",
        color: "#ff0",
      });
      UI.drawCenteredText(ctx, "WASD - Move", W, 205, {
        font: "8px monospace",
        color: "#ccc",
      });
      UI.drawCenteredText(ctx, "Arrow Keys - Aim & Shoot", W, 217, {
        font: "8px monospace",
        color: "#ccc",
      });
      UI.drawCenteredText(ctx, "Clear rooms, defeat the boss!", W, 232, {
        font: "8px monospace",
        color: "#aaa",
      });

      // Best score
      if (bestScore > 0) {
        UI.drawCenteredText(ctx, "BEST: " + bestScore, W, 260, {
          font: "10px monospace",
          color: "#f80",
        });
      }

      // Start prompt
      if (UI.blink(gameTime || 0, 2)) {
        UI.drawCenteredText(ctx, "PRESS ENTER TO START", W, 290, {
          font: "12px monospace",
          color: "#fff",
        });
      }
    },
  });

  sm.add("playing", {
    enter: function (game) {
      initNewGame();
    },
    update: function (dt, game) {
      var input = game.input;
      gameTime += dt;

      // Pause
      if (input.justPressed("Escape") || input.justPressed("KeyP")) {
        sm.switch("paused", game);
        return;
      }

      // Screen shake
      if (screenShakeTimer > 0) screenShakeTimer -= dt;

      // Update player
      updatePlayer(dt, input);

      if (player.dead) {
        if (player.deathTimer > 2) {
          if (score > bestScore) {
            bestScore = score;
            localStorage.setItem("topDownShooterBest", String(bestScore));
          }
          sm.switch("gameover", game);
        }
        return;
      }

      // Update enemies
      for (var i = 0; i < enemies.length; i++) {
        updateEnemy(enemies[i], dt);
      }

      // Update boss
      if (bossActive && boss && !boss.dead) {
        updateBoss(boss, dt);
      }

      // Update bullets
      updateBullets(dt);
      updateEnemyBullets(dt);

      // Update effects
      updateEffects(dt);
      particles.update(dt);

      // Collisions
      checkCollisions();

      // Check room clear
      checkRoomClear();

      // Check win after boss defeated
      if (bossDefeated && bossActive) {
        if (currentFloor >= 2) {
          // Delay before win screen
          bossActive = false;
          if (score > bestScore) {
            bestScore = score;
            localStorage.setItem("topDownShooterBest", String(bestScore));
          }
          sm.switch("win", game);
          return;
        }
      }

      // Camera
      updateCamera();
    },
    render: function (ctx, game) {
      ctx.fillStyle = "#0a0a12";
      ctx.fillRect(0, 0, W, H);

      // Screen shake
      if (screenShakeTimer > 0) {
        ctx.save();
        ctx.translate(Utils.randomRange(-2, 2), Utils.randomRange(-2, 2));
      }

      renderRoom(ctx);
      renderBullets(ctx);
      renderEnemies(ctx);
      if (bossActive) renderBoss(ctx);
      renderPlayer(ctx);
      renderEffects(ctx);

      // Particles
      ctx.save();
      ctx.translate(-camera.x, -camera.y);
      particles.draw(ctx);
      ctx.restore();

      if (screenShakeTimer > 0) {
        ctx.restore();
      }

      // HUD on top
      renderHUD(ctx);
    },
  });

  sm.add("paused", {
    update: function (dt, game) {
      if (
        game.input.justPressed("Escape") ||
        game.input.justPressed("KeyP") ||
        game.input.justPressed("Enter")
      ) {
        sm.switch("playing_resume", game);
      }
    },
    render: function (ctx, game) {
      // Render the playing state behind
      sm.states.playing.render(ctx, game);
      UI.drawOverlay(ctx, W, H, 0.6);
      UI.drawCenteredText(ctx, "PAUSED", W, H / 2 - 20, {
        font: "bold 20px monospace",
        color: "#fff",
      });
      UI.drawCenteredText(ctx, "Press ESC to resume", W, H / 2 + 10, {
        font: "10px monospace",
        color: "#aaa",
      });
    },
  });

  // Resume without reinitializing
  sm.add("playing_resume", {
    enter: function (game) {
      sm.states.playing_resume._game = game;
      // Immediately switch back to playing but don't call enter
      sm.currentName = "playing";
      sm.current = sm.states.playing;
    },
    update: function () {},
    render: function () {},
  });

  sm.add("gameover", {
    enter: function () {
      if (score > bestScore) {
        bestScore = score;
        localStorage.setItem("topDownShooterBest", String(bestScore));
      }
    },
    update: function (dt, game) {
      gameTime += dt;
      if (game.input.justPressed("Enter") || game.input.justPressed("Space")) {
        sm.switch("menu", game);
      }
    },
    render: function (ctx, game) {
      ctx.fillStyle = "#0a0a12";
      ctx.fillRect(0, 0, W, H);

      // Show last room dimmed
      if (roomMap) {
        ctx.globalAlpha = 0.3;
        renderRoom(ctx);
        ctx.globalAlpha = 1;
      }

      UI.drawOverlay(ctx, W, H, 0.5);

      UI.drawCenteredText(ctx, "GAME OVER", W, H / 2 - 60, {
        font: "bold 24px monospace",
        color: "#f00",
      });

      UI.drawCenteredText(ctx, "SCORE: " + score, W, H / 2 - 20, {
        font: "14px monospace",
        color: "#fff",
      });

      UI.drawCenteredText(
        ctx,
        "Floor " + (currentFloor + 1) + " Room " + (currentRoom + 1),
        W,
        H / 2 + 5,
        {
          font: "10px monospace",
          color: "#aaa",
        },
      );

      UI.drawCenteredText(ctx, "BEST: " + bestScore, W, H / 2 + 25, {
        font: "10px monospace",
        color: "#f80",
      });

      if (UI.blink(gameTime, 2)) {
        UI.drawCenteredText(ctx, "PRESS ENTER TO RESTART", W, H / 2 + 60, {
          font: "10px monospace",
          color: "#fff",
        });
      }
    },
  });

  sm.add("win", {
    enter: function () {
      if (score > bestScore) {
        bestScore = score;
        localStorage.setItem("topDownShooterBest", String(bestScore));
      }
    },
    update: function (dt, game) {
      gameTime += dt;
      if (game.input.justPressed("Enter") || game.input.justPressed("Space")) {
        sm.switch("menu", game);
      }
    },
    render: function (ctx, game) {
      ctx.fillStyle = "#0a0a12";
      ctx.fillRect(0, 0, W, H);

      // Victory particles background
      for (var i = 0; i < 20; i++) {
        var px = (Math.sin(gameTime * 0.5 + i * 1.3) * 0.5 + 0.5) * W;
        var py = (Math.cos(gameTime * 0.3 + i * 0.9) * 0.5 + 0.5) * H;
        ctx.fillStyle = ["#0ff", "#f80", "#ff0", "#0f0"][i % 4];
        ctx.globalAlpha = 0.3 + Math.sin(gameTime * 2 + i) * 0.2;
        ctx.fillRect(px, py, 2, 2);
      }
      ctx.globalAlpha = 1;

      UI.drawCenteredText(ctx, "VICTORY!", W, 60, {
        font: "bold 28px monospace",
        color: "#ff0",
      });

      UI.drawCenteredText(ctx, "The Dungeon Warden is defeated!", W, 100, {
        font: "9px monospace",
        color: "#0f0",
      });

      UI.drawCenteredText(ctx, "FINAL SCORE", W, 140, {
        font: "bold 10px monospace",
        color: "#aaa",
      });

      UI.drawCenteredText(ctx, "" + score, W, 160, {
        font: "bold 20px monospace",
        color: "#fff",
      });

      UI.drawCenteredText(ctx, "BEST: " + bestScore, W, 190, {
        font: "10px monospace",
        color: "#f80",
      });

      // Player sprite celebrating
      var pImg = assets.get("playerGunWalk");
      if (pImg) {
        var pf = Math.floor(gameTime * 8) % 6;
        drawFrame(ctx, pImg, 32, 32, pf, W / 2 - 16, 210, false, 0);
      }

      if (UI.blink(gameTime, 2)) {
        UI.drawCenteredText(ctx, "PRESS ENTER TO CONTINUE", W, 270, {
          font: "10px monospace",
          color: "#fff",
        });
      }
    },
  });

  // ---- Loading & Start ----
  loadAllAssets()
    .then(function () {
      gameTime = 0;
      createGame({
        width: W,
        height: H,
        init: function (game) {
          sm.switch("menu", game);
        },
        update: function (dt, game) {
          sm.update(dt, game);
        },
        render: function (ctx, game) {
          sm.render(ctx, game);
        },
      });
    })
    .catch(function (err) {
      console.error("Failed to load assets:", err);
    });
})();
