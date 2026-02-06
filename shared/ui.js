// HUD and UI rendering utilities
const UI = {
  // Draw text with outline for readability
  drawText(ctx, text, x, y, options = {}) {
    const {
      font = "16px monospace",
      color = "#fff",
      outline = "#000",
      outlineWidth = 2,
      align = "left",
      baseline = "top",
    } = options;
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if (outline) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = outlineWidth;
      ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  },

  // Draw a health bar
  drawHealthBar(
    ctx,
    x,
    y,
    width,
    height,
    current,
    max,
    fgColor = "#0f0",
    bgColor = "#600",
    borderColor = "#fff",
  ) {
    const pct = Math.max(0, current / max);
    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, width, height);
    // Fill
    ctx.fillStyle = pct > 0.3 ? fgColor : "#f00";
    ctx.fillRect(x, y, width * pct, height);
    // Border
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
  },

  // Draw centered text block (for menus, game over, etc)
  drawCenteredText(ctx, text, canvasW, y, options = {}) {
    this.drawText(ctx, text, canvasW / 2, y, { align: "center", ...options });
  },

  // Draw a semi-transparent overlay
  drawOverlay(ctx, width, height, alpha = 0.5) {
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(0, 0, width, height);
  },

  // Screen flash effect
  drawFlash(ctx, width, height, color = "#fff", alpha = 0.5) {
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
  },

  // Blinking text (returns true if visible based on time)
  blink(time, rate = 2) {
    return Math.floor(time * rate) % 2 === 0;
  },
};
