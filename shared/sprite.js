// Sprite loading and animation system
class SpriteSheet {
  constructor(image, frameWidth, frameHeight) {
    this.image = image;
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;
    this.cols = Math.floor(image.width / frameWidth);
    this.rows = Math.floor(image.height / frameHeight);
    this.totalFrames = this.cols * this.rows;
  }

  getFrame(index) {
    const col = index % this.cols;
    const row = Math.floor(index / this.cols);
    return {
      sx: col * this.frameWidth,
      sy: row * this.frameHeight,
      sw: this.frameWidth,
      sh: this.frameHeight,
    };
  }

  draw(ctx, index, x, y, flipX = false, scale = 1) {
    const frame = this.getFrame(index);
    const w = this.frameWidth * scale;
    const h = this.frameHeight * scale;
    ctx.save();
    if (flipX) {
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(
        this.image,
        frame.sx,
        frame.sy,
        frame.sw,
        frame.sh,
        0,
        0,
        w,
        h,
      );
    } else {
      ctx.drawImage(
        this.image,
        frame.sx,
        frame.sy,
        frame.sw,
        frame.sh,
        x,
        y,
        w,
        h,
      );
    }
    ctx.restore();
  }
}

class AnimatedSprite {
  constructor(frames, frameRate = 10, loop = true) {
    // frames can be: array of Image objects, or { sheet: SpriteSheet, start, count }
    this.frameRate = frameRate;
    this.loop = loop;
    this.currentFrame = 0;
    this.elapsed = 0;
    this.finished = false;
    this.flipX = false;
    this.scale = 1;

    if (Array.isArray(frames)) {
      this.mode = "images";
      this.images = frames;
      this.totalFrames = frames.length;
      this.width = frames[0] ? frames[0].width : 0;
      this.height = frames[0] ? frames[0].height : 0;
    } else {
      this.mode = "sheet";
      this.sheet = frames.sheet;
      this.startFrame = frames.start || 0;
      this.totalFrames = frames.count || this.sheet.totalFrames;
      this.width = this.sheet.frameWidth;
      this.height = this.sheet.frameHeight;
    }
  }

  reset() {
    this.currentFrame = 0;
    this.elapsed = 0;
    this.finished = false;
  }

  update(dt) {
    if (this.finished) return;
    this.elapsed += dt;
    const frameDuration = 1 / this.frameRate;
    if (this.elapsed >= frameDuration) {
      this.elapsed -= frameDuration;
      this.currentFrame++;
      if (this.currentFrame >= this.totalFrames) {
        if (this.loop) {
          this.currentFrame = 0;
        } else {
          this.currentFrame = this.totalFrames - 1;
          this.finished = true;
        }
      }
    }
  }

  draw(ctx, x, y) {
    if (this.mode === "images") {
      const img = this.images[this.currentFrame];
      if (!img) return;
      const w = this.width * this.scale;
      const h = this.height * this.scale;
      ctx.save();
      if (this.flipX) {
        ctx.translate(x + w, y);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, w, h);
      } else {
        ctx.drawImage(img, x, y, w, h);
      }
      ctx.restore();
    } else {
      this.sheet.draw(
        ctx,
        this.startFrame + this.currentFrame,
        x,
        y,
        this.flipX,
        this.scale,
      );
    }
  }
}

// Asset loader - preload images with a manifest
class AssetLoader {
  constructor() {
    this.images = {};
    this.audio = {};
  }

  loadImage(key, src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.images[key] = img;
        resolve(img);
      };
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });
  }

  loadImages(manifest) {
    // manifest: { key: src, ... }
    const promises = Object.entries(manifest).map(([key, src]) =>
      this.loadImage(key, src),
    );
    return Promise.all(promises);
  }

  loadAudio(key, src) {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.oncanplaythrough = () => {
        this.audio[key] = audio;
        resolve(audio);
      };
      audio.onerror = () => reject(new Error(`Failed to load audio: ${src}`));
      audio.src = src;
    });
  }

  get(key) {
    return this.images[key];
  }

  getAudio(key) {
    return this.audio[key];
  }
}
