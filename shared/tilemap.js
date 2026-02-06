// Tilemap system - render and collide with tile-based levels
class TileMap {
  constructor(tilesetImage, tileSize, cols, rows) {
    this.tileset = tilesetImage;
    this.tileSize = tileSize;
    this.cols = cols; // tiles per row in tileset image
    this.rows = rows; // tiles per column in tileset image
    this.layers = [];
    this.collisionLayer = null;
    this.mapWidth = 0;
    this.mapHeight = 0;
  }

  // Add a layer: 2D array of tile indices (0 = empty)
  addLayer(data, mapWidth, mapHeight) {
    this.layers.push(data);
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
  }

  setCollisionLayer(data) {
    this.collisionLayer = data;
  }

  // Get tile index at world pixel position from collision layer
  getTileAt(worldX, worldY) {
    if (!this.collisionLayer) return 0;
    const col = Math.floor(worldX / this.tileSize);
    const row = Math.floor(worldY / this.tileSize);
    if (col < 0 || col >= this.mapWidth || row < 0 || row >= this.mapHeight)
      return 1;
    return this.collisionLayer[row * this.mapWidth + col];
  }

  isSolid(worldX, worldY) {
    return this.getTileAt(worldX, worldY) > 0;
  }

  // Render a layer
  renderLayer(ctx, layerIndex, camera) {
    const data = this.layers[layerIndex];
    if (!data) return;

    const startCol = Math.max(0, Math.floor(camera.x / this.tileSize));
    const startRow = Math.max(0, Math.floor(camera.y / this.tileSize));
    const endCol = Math.min(
      this.mapWidth,
      Math.ceil((camera.x + camera.viewWidth) / this.tileSize) + 1,
    );
    const endRow = Math.min(
      this.mapHeight,
      Math.ceil((camera.y + camera.viewHeight) / this.tileSize) + 1,
    );

    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        const tileIndex = data[row * this.mapWidth + col];
        if (tileIndex <= 0) continue;

        // Convert 1-based tile index to 0-based for tileset lookup
        const ti = tileIndex - 1;
        const sx = (ti % this.cols) * this.tileSize;
        const sy = Math.floor(ti / this.cols) * this.tileSize;
        const dx = col * this.tileSize - Math.round(camera.x);
        const dy = row * this.tileSize - Math.round(camera.y);

        ctx.drawImage(
          this.tileset,
          sx,
          sy,
          this.tileSize,
          this.tileSize,
          dx,
          dy,
          this.tileSize,
          this.tileSize,
        );
      }
    }
  }

  get pixelWidth() {
    return this.mapWidth * this.tileSize;
  }
  get pixelHeight() {
    return this.mapHeight * this.tileSize;
  }
}

// Parse a Tiled JSON map
function parseTiledMap(json, tilesetImage) {
  const tileSize = json.tilewidth;
  const mapWidth = json.width;
  const mapHeight = json.height;

  // Determine tileset columns from image
  const tilesetCols = Math.floor(tilesetImage.width / tileSize);
  const tilesetRows = Math.floor(tilesetImage.height / tileSize);

  const tilemap = new TileMap(tilesetImage, tileSize, tilesetCols, tilesetRows);
  tilemap.mapWidth = mapWidth;
  tilemap.mapHeight = mapHeight;

  for (const layer of json.layers) {
    if (layer.type === "tilelayer" && layer.data) {
      tilemap.addLayer(layer.data, mapWidth, mapHeight);
      // Use layer named "collision" or "solid" as collision
      if (
        layer.name &&
        (layer.name.toLowerCase().includes("collision") ||
          layer.name.toLowerCase().includes("solid"))
      ) {
        tilemap.setCollisionLayer(layer.data);
      }
    }
  }

  // If no explicit collision layer, use the first layer
  if (!tilemap.collisionLayer && tilemap.layers.length > 0) {
    tilemap.setCollisionLayer(tilemap.layers[0]);
  }

  return tilemap;
}
