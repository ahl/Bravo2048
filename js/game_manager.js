var Player = {
  HUMAN: "human",
  COMPUTER: "computer",
};

function AIState(grid)
{
  if (!grid)
    return;
  this.size = grid.size;
  this.player = Player.HUMAN;
  this.lastMove = null;
  this.cells = this.empty();

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      if (grid.cells[x][y])
        this.cells[x][y] = grid.cells[x][y].value;
    }
  }
}

AIState.prototype.empty = function () {
  var cells = [];

  for (var x = 0; x < this.size; x++) {
    var row = cells[x] = [];

    for (var y = 0; y < this.size; y++) {
      row.push(0);
    }
  }

  return cells;
};

AIState.prototype.copy = function () {
  var cells = [];

  for (var x = 0; x < this.size; x++) {
    var row = cells[x] = [];

    for (var y = 0; y < this.size; y++) {
      row.push(this.cells[x][y]);
    }
  }

  return cells;
};

AIState.prototype.move = function (direction) {
  var child = new AIState();
  child.size = this.size;
  child.cells = this.empty();
  child.player = Player.COMPUTER;
  child.last = direction;

  var get = [
    function (x, y) { return { x: x, y: y }; }, // u
    function (x, y) { return { x: child.size - y - 1, y: x }; }, // r
    function (x, y) { return { x: x, y: child.size - y - 1 }; }, // d
    function (x, y) { return { x: y, y: x }; }, // l
  ][direction];

  var moved = false;

  /*
   * WLOG we pretent that all moves are to the left...
   */
  for (var x = 0; x < child.size; x++) {
    var lasty = 0;
    var merged = true;
    for (var y = 0; y < child.size; y++) {
      var pos = get(x, y);

      var lpos = get(x, lasty);
      var cell = this.cells[pos.x][pos.y];

      if (cell == 0)
        continue;

      if (!merged) {
        if (child.cells[lpos.x][lpos.y] == cell) {
          child.cells[lpos.x][lpos.y] *= 2;
          merged = true;
          moved = true;
          lasty++;
          continue;
        }
        lasty++;
        lpos = get(x, lasty);
      }

      if (y != lasty)
        moved = true;

      child.cells[lpos.x][lpos.y] = cell;
      merged = false;
    }
  }

  return moved ? child : null;
};

AIState.prototype.childStates = function () {
  var states = [];
  var child;

  if (this.player == Player.COMPUTER) {
    for (var x = 0; x < this.size; x++) {
      for (var y = 0; y < this.size; y++) {
        if (!this.cells[x][y]) {
          for (var i = 0; i < 2; i++) {
            child = new AIState();
            child.size = this.size;
            child.player = Player.HUMAN;
            child.cells = this.copy();
            child.cells[x][y] = 2 << i;
            states.push(child);
          }
        }
      }
    }
  } else {
    for (var dir = 0; dir < 4; dir++) {
      child = this.move(dir);
      if (child) {
        states.push(child);
      }
    }
  }

  return states;
};

AIState.prototype.maxCorner = function () {
  var c = this.cells;
  return [[0, 0],
      [this.size - 1, 0],
      [0, this.size - 1],
      [this.size - 1, this.size - 1]].reduce(function (a, b) {
    return c[a[0]][a[1]] > c[b[0]][b[1]] ? a : b;
  });
};

AIState.prototype.staticEval = function () {
  var value = 0.0;

  var corner = this.maxCorner();
  var x = corner[0];
  var y = corner[1];
  var cv = this.cells[x][y];

  var xd = x == 0 ? 1 : -1;
  var yd = y == 0 ? 1 : -1;

  var yy, xx;

  if (this.cells[x + xd][y] > this.cells[x][y + yd]) {
    xx = xd;
    yy = 0;
  } else  {
    xx = 0;
    yy = yd;
  }

  value += 15.0 * cv;

  var chain = true;

  var last = cv;
  var lastlast = 0;

  for (var i = 0; i < this.size * this.size - 1; i++) {
    x += xx;
    y += yy;

    var turn = false;
    if (x < 0 || x >= this.size) {
      xx = -xx;
      x += xx;
      y += yd;
      turn = true;
    }
    if (y < 0 || y >= this.size) {
      yy = -yy;
      y += yy;
      x += xd;
      turn = true;
    }

    if (chain) {
      value += last + 1.0;
    } else {
      if (last == 0)
        value += 12.0 + (cv > 512 ? 2 : 0);
    }

    var val = this.cells[x][y];
    if (val > last && last != 0) {
      value -= val - last;
      chain = false;
    }

    lastlast = last;
    last = val;
  }

  return value;
};

AIState.prototype.eval = function (depth) {
  if (depth == 0)
    return this.staticEval();

  var cells = this.cells;
  var f = this.player == Player.COMPUTER ? Math.min : Math.max;

  var children = this.childStates();

  if (children.length == 0)
    return -100000;

  return children.map(function (x) {
    var e = x.eval(depth - 1) * 0.99;
    return e;
  }).reduce(function (x, y) {
    return f(x, y);
  });
};

AIState.prototype.log = function () {
  var out = "";

  for (var x = 0; x < this.size; x++) {
    var row = this.cells[x];

    for (var y = 0; y < this.size; y++) {
      var tile = this.cells[y][x];
      if (tile == 0) {
        out += "_ ";
      } else {
        out += tile + " ";
       }
    }
    out += "\n";
  }

  console.log(out);
};


function GameManager(size, InputManager, Actuator, StorageManager) {
  this.size           = size; // Size of the grid
  this.inputManager   = new InputManager;
  this.storageManager = new StorageManager;
  this.actuator       = new Actuator;

  this.startTiles     = 2;

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));

  this.setup();

  var d = 0;
  var b = this;

/*
  var m = function () {
    b.move(d);
    d++;
    d %= 2;
    window.setTimeout(m, 0);
  };

  window.setTimeout(m, 0);
*/
}

// Restart the game
GameManager.prototype.restart = function () {
  this.storageManager.clearGameState();
  this.actuator.continueGame(); // Clear the game won/lost message
  this.setup();
};

// Keep playing after winning (allows going over 2048)
GameManager.prototype.keepPlaying = function () {
  this.keepPlaying = true;
  this.actuator.continueGame(); // Clear the game won/lost message
};

// Return true if the game is lost, or has won and the user hasn't kept playing
GameManager.prototype.isGameTerminated = function () {
  return this.over || (this.won && !this.keepPlaying);
};

// Set up the game
GameManager.prototype.setup = function () {
  var previousState = this.storageManager.getGameState();

  // Reload the game from a previous game if present
  if (previousState) {
    this.grid        = new Grid(previousState.grid.size,
                                previousState.grid.cells); // Reload grid
    this.score       = previousState.score;
    this.over        = previousState.over;
    this.won         = previousState.won;
    this.keepPlaying = previousState.keepPlaying;
  } else {
    this.grid        = new Grid(this.size);
    this.score       = 0;
    this.over        = false;
    this.won         = false;
    this.keepPlaying = false;

    // Add the initial tiles
    this.addStartTiles();
  }

  // Update the actuator
  this.actuate();
};

// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i++) {
    this.addRandomTile();
  }
};

// Adds a tile in a random position
GameManager.prototype.addRandomTile = function () {
  if (this.grid.cellsAvailable()) {
    var value = Math.random() < 0.9 ? 2 : 4;
    var tile = new Tile(this.grid.randomAvailableCell(), value);

    this.grid.insertTile(tile);
  }
};

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  if (this.storageManager.getBestScore() < this.score) {
    this.storageManager.setBestScore(this.score);
  }

  // Clear the state when the game is over (game over only, not win)
  if (this.over) {
    this.storageManager.clearGameState();
  } else {
    this.storageManager.setGameState(this.serialize());
  }

  this.actuator.actuate(this.grid, {
    score:      this.score,
    over:       this.over,
    won:        this.won,
    bestScore:  this.storageManager.getBestScore(),
    terminated: this.isGameTerminated()
  });

};

// Represent the current game as an object
GameManager.prototype.serialize = function () {
  return {
    grid:        this.grid.serialize(),
    score:       this.score,
    over:        this.over,
    won:         this.won,
    keepPlaying: this.keepPlaying
  };
};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

// Move a tile and its representation
GameManager.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction) {
  // 0: up, 1: right, 2: down, 3: left
  var self = this;

  if (this.isGameTerminated()) return; // Don't do anything if the game's over

  if (direction == -1) {
    this.bestMove();
    return;
  }
  if (direction == -2) {
    var s = new AIState(this.grid);
    s.log();
    console.log("value = " + s.eval(0));
    return;
  }

  var cell, tile;

  var vector     = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved      = false;

  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = { x: x, y: y };
      tile = self.grid.cellContent(cell);

      if (tile) {
        var positions = self.findFarthestPosition(cell, vector);
        var next      = self.grid.cellContent(positions.next);

        // Only one merger per row traversal?
        if (next && next.value === tile.value && !next.mergedFrom) {
          var merged = new Tile(positions.next, tile.value * 2);
          merged.mergedFrom = [tile, next];

          self.grid.insertTile(merged);
          self.grid.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);

          // Update the score
          self.score += merged.value;

          // The mighty 2048 tile
          if (merged.value === 2048) self.won = true;
        } else {
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          moved = true; // The tile moved from its original cell!
        }
      }
    });
  });

  if (moved) {
    this.addRandomTile();

    if (!this.movesAvailable()) {
      this.over = true; // Game over!
    }

    this.actuate();
  }

};

GameManager.prototype.bestMove = function () {
  console.log("child states");
  var s = new AIState(this.grid);

  var children = s.childStates();

  children.forEach(function (x) {
    x.log();
  });

  var cc = children.map(function (x) {
    return [x.eval(3), x.last];
  });

  console.log(cc);

  var nextMove = cc.reduce(function (x, y) {
    return x[0] > y[0] ? x : y;
  }, [-10000000, -1])[1];

  if (nextMove == -1)
    return;

  console.log("next move = " + nextMove);

  this.move(nextMove);
};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  var map = {
    0: { x: 0,  y: -1 }, // Up
    1: { x: 1,  y: 0 },  // Right
    2: { x: 0,  y: 1 },  // Down
    3: { x: -1, y: 0 }   // Left
  };

  return map[direction];
};

// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [] };

  for (var pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }

  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();

  return traversals;
};

GameManager.prototype.findFarthestPosition = function (cell, vector) {
  var previous;

  // Progress towards the vector direction until an obstacle is found
  do {
    previous = cell;
    cell     = { x: previous.x + vector.x, y: previous.y + vector.y };
  } while (this.grid.withinBounds(cell) &&
           this.grid.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell // Used to check if a merge is required
  };
};

GameManager.prototype.movesAvailable = function () {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

// Check for available matches between tiles (more expensive check)
GameManager.prototype.tileMatchesAvailable = function () {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      tile = this.grid.cellContent({ x: x, y: y });

      if (tile) {
        for (var direction = 0; direction < 4; direction++) {
          var vector = self.getVector(direction);
          var cell   = { x: x + vector.x, y: y + vector.y };

          var other  = self.grid.cellContent(cell);

          if (other && other.value === tile.value) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }

  return false;
};

GameManager.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};
