# Chess Game with Rule Modification Framework

A complete chess application with all standard chess rules implemented, plus a flexible framework for creating custom chess variants and rules.

## Features

### Complete Chess Implementation
- **All Standard Rules**: Piece movement, castling, en passant, pawn promotion
- **Game State Management**: Check, checkmate, stalemate detection
- **Draw Conditions**: Insufficient material, threefold repetition, fifty-move rule
- **Interactive UI**: Drag and drop pieces, click to move, move history
- **Responsive Design**: Works on desktop and mobile devices

### Rule Modification Framework
- **Custom Pieces**: Create new piece types with unique movement patterns
- **Board Variants**: Change board size and layout
- **Victory Conditions**: Define new ways to win
- **Special Rules**: Add custom game mechanics
- **Game Variants**: Pre-built variants like Chess960, King of the Hill, Atomic Chess

## Quick Start

1. Open `index.html` in a web browser
2. Start playing immediately with standard chess rules
3. Use "New Game" to restart, "Undo Move" to take back moves

## How to Play

### Basic Controls
- **Click** a piece to select it (shows possible moves in blue)
- **Click** a highlighted square to move there
- **Drag and drop** pieces to move them
- **Pawn Promotion**: When a pawn reaches the end, choose the promotion piece

### Game Information
- Current player turn is displayed
- Game status shows check, checkmate, or draw conditions
- Move history is recorded in standard chess notation

## Rule Modification Framework

### Creating Custom Pieces

```javascript
const ruleBuilder = new RuleBuilder();

// Create an Amazon (Queen + Knight moves)
const amazonPattern = [
    // Knight moves
    ...RuleBuilder.directions.knightMoves.map(dir => ({ type: 'jump', direction: dir })),
    // Queen moves (all directions, sliding)
    { type: 'slide', direction: RuleBuilder.directions.north },
    { type: 'slide', direction: RuleBuilder.directions.south },
    { type: 'slide', direction: RuleBuilder.directions.east },
    { type: 'slide', direction: RuleBuilder.directions.west },
    { type: 'slide', direction: RuleBuilder.directions.northeast },
    { type: 'slide', direction: RuleBuilder.directions.northwest },
    { type: 'slide', direction: RuleBuilder.directions.southeast },
    { type: 'slide', direction: RuleBuilder.directions.southwest }
];

ruleBuilder.addCustomPiece('amazon', {
    symbol: '♛',
    movePattern: ruleBuilder.framework.createCustomMovePattern(amazonPattern),
    value: 15
});
```

### Movement Pattern Types

1. **Slide**: Moves in a direction until blocked
   ```javascript
   { type: 'slide', direction: [1, 0], maxDistance: 3 } // Move up to 3 squares south
   ```

2. **Jump**: Single square movement
   ```javascript
   { type: 'jump', direction: [2, 1] } // Knight-like jump
   ```

3. **Conditional**: Movement based on conditions
   ```javascript
   {
       type: 'conditional',
       condition: (board, row, col, piece) => !piece.hasMoved,
       moves: [{ type: 'slide', direction: [2, 0] }] // Only if piece hasn't moved
   }
   ```

### Available Directions

```javascript
RuleBuilder.directions = {
    north: [-1, 0],     // Up
    south: [1, 0],      // Down
    east: [0, 1],       // Right
    west: [0, -1],      // Left
    northeast: [-1, 1], // Up-right
    northwest: [-1, -1], // Up-left
    southeast: [1, 1],   // Down-right
    southwest: [1, -1],  // Down-left
    knightMoves: [       // All 8 knight moves
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
    ]
};
```

### Creating Custom Victory Conditions

```javascript
// King of the Hill - win by getting king to center
ruleBuilder.addVictoryCondition('king-of-the-hill', (board, currentPlayer) => {
    const king = findKing(board, currentPlayer);
    if (king && ((king.row === 3 || king.row === 4) && (king.col === 3 || king.col === 4))) {
        return { winner: currentPlayer };
    }
    return null;
});
```

### Adding Special Rules

```javascript
// Atomic Chess - pieces explode when captured
ruleBuilder.addSpecialRule('atomic-capture', (board, fromRow, fromCol, toRow, toCol) => {
    const capturedPiece = board[toRow][toCol];
    if (capturedPiece) {
        // Remove all pieces in 3x3 area around capture (except pawns)
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const r = toRow + dr, c = toCol + dc;
                if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                    const piece = board[r][c];
                    if (piece && piece.type !== 'pawn') {
                        board[r][c] = null;
                    }
                }
            }
        }
    }
});
```

### Modifying Board Size

```javascript
// Create a 10x10 board
ruleBuilder.setBoardSize(10, 10);
```

### Move Modifiers

```javascript
// Add fog of war - only see pieces near your own
ruleBuilder.addMoveModifier((moves, board, row, col, currentPlayer, moveHistory) => {
    // Filter moves based on visibility rules
    return moves.filter(move => isVisible(move, board, currentPlayer));
});
```

## Pre-built Game Variants

### Chess960 (Fischer Random)
Randomized starting positions with castling rules preserved.

### King of the Hill
Win by moving your king to the center four squares (d4, d5, e4, e5).

### Atomic Chess
When a piece is captured, it explodes, destroying all surrounding pieces (except pawns).

### Horde Chess
White has 36 pawns, Black has normal pieces. White wins by capturing the black king, Black wins by capturing all white pawns.

### Circe Chess
Captured pieces are reborn on their starting squares.

## File Structure

```
chess-app/
├── index.html              # Main game interface
├── chess.js                # Core chess game logic
├── styles.css              # Game styling
├── rule-framework.js       # Rule modification framework
├── rule-examples.js        # Example custom rules and variants
└── README.md               # This file
```

## Customization Examples

### 1. Create a Superpiece

```javascript
const ruleBuilder = new RuleBuilder();

// Create a piece that moves like all pieces combined
const superpiecePattern = [
    // All sliding directions (like Queen)
    { type: 'slide', direction: RuleBuilder.directions.north },
    { type: 'slide', direction: RuleBuilder.directions.south },
    { type: 'slide', direction: RuleBuilder.directions.east },
    { type: 'slide', direction: RuleBuilder.directions.west },
    { type: 'slide', direction: RuleBuilder.directions.northeast },
    { type: 'slide', direction: RuleBuilder.directions.northwest },
    { type: 'slide', direction: RuleBuilder.directions.southeast },
    { type: 'slide', direction: RuleBuilder.directions.southwest },
    // All knight moves
    ...RuleBuilder.directions.knightMoves.map(dir => ({ type: 'jump', direction: dir }))
];

ruleBuilder.addCustomPiece('superpiece', {
    symbol: '♔',
    movePattern: ruleBuilder.framework.createCustomMovePattern(superpiecePattern),
    value: 20
});

const customGame = ruleBuilder.createGame();
```

### 2. Custom Win Condition

```javascript
// Win by capturing all opponent pawns
ruleBuilder.addVictoryCondition('pawn-hunt', (board, currentPlayer) => {
    const opponentColor = currentPlayer === 'white' ? 'black' : 'white';
    const opponentPawns = board.flat().filter(piece =>
        piece && piece.color === opponentColor && piece.type === 'pawn'
    );
    return opponentPawns.length === 0 ? { winner: currentPlayer } : null;
});
```

### 3. Modified Movement Rules

```javascript
// Pieces can only move forward
ruleBuilder.addMoveModifier((moves, board, row, col, currentPlayer) => {
    const piece = board[row][col];
    const forwardDirection = piece.color === 'white' ? -1 : 1;

    return moves.filter(move => {
        const deltaRow = move.row - row;
        return deltaRow * forwardDirection >= 0; // Only forward moves
    });
});
```

## Technical Details

### Architecture
- **ChessGame**: Main game controller
- **ChessPiece**: Individual piece representation
- **ChessRuleEngine**: Standard rule validation
- **ChessRuleFramework**: Extensible rule system
- **RuleBuilder**: Convenient API for rule creation

### Browser Compatibility
- Modern browsers supporting ES6+
- No external dependencies required
- Responsive design for mobile devices

### Performance
- Efficient move generation and validation
- Optimized board representation
- Smooth drag and drop interactions

## Contributing

To add new features or variants:

1. Create new piece types in `rule-examples.js`
2. Add victory conditions using the framework
3. Test thoroughly with edge cases
4. Document your additions

## License

Open source - feel free to modify and extend for your own chess variants!