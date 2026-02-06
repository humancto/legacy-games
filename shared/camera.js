// Camera/viewport system with parallax support
class Camera {
  constructor(viewWidth, viewHeight, worldWidth, worldHeight) {
    this.x = 0;
    this.y = 0;
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    // Deadzone: area around target where camera doesn't move
    this.deadzone = { x: 0, y: 0, w: viewWidth * 0.3, h: viewHeight * 0.3 };
    this.deadzone.x = (viewWidth - this.deadzone.w) / 2;
    this.deadzone.y = (viewHeight - this.deadzone.h) / 2;
  }

  follow(target, lerp = 1) {
    const targetScreenX = target.x - this.x;
    const targetScreenY = target.y - this.y;

    let dx = 0,
      dy = 0;

    if (targetScreenX < this.deadzone.x) {
      dx = targetScreenX - this.deadzone.x;
    } else if (targetScreenX > this.deadzone.x + this.deadzone.w) {
      dx = targetScreenX - (this.deadzone.x + this.deadzone.w);
    }

    if (targetScreenY < this.deadzone.y) {
      dy = targetScreenY - this.deadzone.y;
    } else if (targetScreenY > this.deadzone.y + this.deadzone.h) {
      dy = targetScreenY - (this.deadzone.y + this.deadzone.h);
    }

    this.x += dx * lerp;
    this.y += dy * lerp;

    // Clamp to world bounds
    this.x = Utils.clamp(
      this.x,
      0,
      Math.max(0, this.worldWidth - this.viewWidth),
    );
    this.y = Utils.clamp(
      this.y,
      0,
      Math.max(0, this.worldHeight - this.viewHeight),
    );
  }

  // Center camera on a point
  centerOn(x, y) {
    this.x = x - this.viewWidth / 2;
    this.y = y - this.viewHeight / 2;
    this.x = Utils.clamp(
      this.x,
      0,
      Math.max(0, this.worldWidth - this.viewWidth),
    );
    this.y = Utils.clamp(
      this.y,
      0,
      Math.max(0, this.worldHeight - this.viewHeight),
    );
  }

  // Apply camera transform for drawing
  begin(ctx) {
    ctx.save();
    ctx.translate(-Math.round(this.x), -Math.round(this.y));
  }

  end(ctx) {
    ctx.restore();
  }

  // Draw a parallax layer (scrolls at fraction of camera speed)
  drawParallax(ctx, image, speedX = 0.5, speedY = 0.5) {
    const px = -(this.x * speedX) % image.width;
    const py = -(this.y * speedY) % image.height;

    // Tile the image to fill the viewport
    for (let x = px - image.width; x < this.viewWidth; x += image.width) {
      for (let y = py - image.height; y < this.viewHeight; y += image.height) {
        ctx.drawImage(image, x, y);
      }
    }
  }

  // Draw a parallax layer that only tiles horizontally
  drawParallaxH(ctx, image, speedX = 0.5, y = 0) {
    const px = -(this.x * speedX) % image.width;
    for (let x = px - image.width; x < this.viewWidth; x += image.width) {
      ctx.drawImage(image, x, y);
    }
  }

  // Check if a world-position rect is visible
  isVisible(x, y, w, h) {
    return (
      x + w > this.x &&
      x < this.x + this.viewWidth &&
      y + h > this.y &&
      y < this.y + this.viewHeight
    );
  }
}
