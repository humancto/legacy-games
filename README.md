# Legacy Games Collection

Built by [Human CTO](https://www.linkedin.com/in/archithr/) | [GitHub](https://github.com/humancto)

A collection of 12 retro-style HTML5 Canvas games built with vanilla JavaScript. No frameworks, no build tools -- just open in a browser and play.

## Games

| #   | Game                 | Genre                  | Controls      |
| --- | -------------------- | ---------------------- | ------------- |
| 1   | Space Shooter        | Vertical Shooter       | WASD + Space  |
| 2   | Flappy Chicken       | Arcade                 | Space to flap |
| 3   | Grotto Escape        | Cave Platformer        | WASD + Z/X    |
| 4   | Underwater Diving    | Action                 | WASD + Shift  |
| 5   | Gothicvania Swamp    | Platformer             | WASD + Z/X    |
| 6   | Gothicvania Cemetery | Action Platformer      | WASD + Z      |
| 7   | Magic Cliffs         | Exploration Platformer | WASD + Z/X    |
| 8   | Warped Caves         | Run-and-Gun            | WASD + Z/X    |
| 9   | Streets of Fight     | Beat 'em Up            | WASD + Z/X/C  |
| 10  | Tiny RPG Forest      | Top-Down RPG           | WASD + Z/X/C  |
| 11  | Warped City          | Cyberpunk Platformer   | WASD + Z/X    |
| 12  | Top-Down Shooter     | Twin-Stick Shooter     | WASD + Arrows |

## Play

Open `index.html` in a browser to access the game launcher, or open any individual game's `index.html` directly.

```
# Serve locally (optional, for asset loading)
python3 -m http.server 8000
# Then open http://localhost:8000
```

## Project Structure

```
games/
  index.html              # Game launcher hub
  shared/                 # Shared engine modules
    engine.js             # Game loop, canvas, responsive scaling
    sprite.js             # Sprite loading, animation, spritesheets
    input.js              # Keyboard input (WASD + arrows + action keys)
    audio.js              # Web Audio API sound effects
    collision.js          # AABB and circle collision detection
    particles.js          # Particle emitter system
    ui.js                 # HUD rendering (health, score, text)
    state.js              # Game state machine
    utils.js              # Math helpers (lerp, clamp, random)
  space-shooter/          # Each game has its own folder
  flappy-chicken/         #   with index.html, game.js,
  grotto-escape/          #   and an assets/ directory
  ...
```

## Tech

- Pure HTML5 Canvas + vanilla JavaScript
- No dependencies, no build step
- Web Audio API for procedural sound effects
- Pixel art rendered with `imageSmoothingEnabled = false`
- Responsive canvas scaling

## Asset Credits

All pixel art assets are from the **Legacy Collection** by **Ansimuz**.

Browse and support the artist: [https://itch.io/c/392202/ansimuz-games](https://itch.io/c/392202/ansimuz-games)

Assets are used under the terms provided by the artist on itch.io. Please visit the link above to support the creator and review the asset license terms.

## License

The **game code** (all `.js` and `.html` files) is released under the [MIT License](LICENSE).

The **pixel art assets** in `*/assets/` directories are created by [Ansimuz](https://itch.io/c/392202/ansimuz-games) and are subject to their own license terms. See the itch.io page for details.
