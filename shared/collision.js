// Collision detection utilities
const Collision = {
  // Axis-Aligned Bounding Box intersection
  rectRect(a, b) {
    return (
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
    );
  },

  // Circle vs Circle
  circleCircle(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < a.r + b.r;
  },

  // Point in rectangle
  pointRect(px, py, rect) {
    return (
      px >= rect.x &&
      px <= rect.x + rect.w &&
      py >= rect.y &&
      py <= rect.y + rect.h
    );
  },

  // Circle vs Rectangle
  circleRect(circle, rect) {
    const closestX = Utils.clamp(circle.x, rect.x, rect.x + rect.w);
    const closestY = Utils.clamp(circle.y, rect.y, rect.y + rect.h);
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    return dx * dx + dy * dy < circle.r * circle.r;
  },

  // Check if position is solid in a tilemap
  tileAt(tilemap, x, y, tileSize) {
    const col = Math.floor(x / tileSize);
    const row = Math.floor(y / tileSize);
    if (
      row < 0 ||
      row >= tilemap.length ||
      col < 0 ||
      col >= tilemap[0].length
    ) {
      return 1; // Out of bounds = solid
    }
    return tilemap[row][col];
  },
};
