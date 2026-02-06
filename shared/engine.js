// Core game engine - loop, canvas, scaling
function createGame(config) {
  const {
    width,
    height,
    init,
    update,
    render,
    parent = document.body,
    scale = "fit",
  } = config;

  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.style.imageRendering = "pixelated";
  canvas.style.imageRendering = "crisp-edges";
  parent.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  // Input
  const input = new Input();

  // Resize handler
  function resize() {
    const windowW = window.innerWidth;
    const windowH = window.innerHeight;
    let s;
    if (scale === "fit") {
      s = Math.min(windowW / width, windowH / height);
    } else if (scale === "fill") {
      s = Math.max(windowW / width, windowH / height);
    } else {
      s = Math.floor(Math.min(windowW / width, windowH / height)) || 1;
    }
    canvas.style.width = Math.floor(width * s) + "px";
    canvas.style.height = Math.floor(height * s) + "px";
    canvas.style.position = "absolute";
    canvas.style.left = Math.floor((windowW - width * s) / 2) + "px";
    canvas.style.top = Math.floor((windowH - height * s) / 2) + "px";
  }
  window.addEventListener("resize", resize);
  resize();

  // Game state
  const game = {
    canvas,
    ctx,
    input,
    width,
    height,
    time: 0,
    running: true,
    paused: false,
  };

  // Fixed timestep
  const FIXED_DT = 1 / 60;
  let accumulator = 0;
  let lastTime = 0;

  function loop(timestamp) {
    if (!game.running) return;

    const rawDt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    // Cap dt to prevent spiral of death (e.g. tab unfocus)
    const dt = Math.min(rawDt, 0.1);
    accumulator += dt;

    while (accumulator >= FIXED_DT) {
      if (!game.paused) {
        update(FIXED_DT, game);
        game.time += FIXED_DT;
      }
      input.endFrame();
      accumulator -= FIXED_DT;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;
    render(ctx, game);

    requestAnimationFrame(loop);
  }

  // Start
  if (init) init(game);
  lastTime = performance.now();
  requestAnimationFrame(loop);

  return game;
}
