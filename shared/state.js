// Game state machine
class StateMachine {
  constructor() {
    this.states = {};
    this.current = null;
    this.currentName = "";
  }

  add(name, state) {
    // state: { enter(game), update(dt, game), render(ctx, game), exit(game) }
    this.states[name] = state;
  }

  switch(name, game) {
    if (this.current && this.current.exit) {
      this.current.exit(game);
    }
    this.currentName = name;
    this.current = this.states[name];
    if (this.current && this.current.enter) {
      this.current.enter(game);
    }
  }

  update(dt, game) {
    if (this.current && this.current.update) {
      this.current.update(dt, game);
    }
  }

  render(ctx, game) {
    if (this.current && this.current.render) {
      this.current.render(ctx, game);
    }
  }
}
