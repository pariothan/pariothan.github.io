const examples = {
    customPieceExample: function() {
        const ruleBuilder = new RuleBuilder();

        const amazonPattern = [
            ...RuleBuilder.directions.knightMoves.map(dir => ({ type: 'jump', direction: dir })),
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

        return ruleBuilder.createGame();
    },

    kingOfTheHillExample: function() {
        const ruleBuilder = new RuleBuilder();

        ruleBuilder.addVictoryCondition('king-of-the-hill', (board, currentPlayer) => {
            const king = ruleBuilder.framework.findKing ? ruleBuilder.framework.findKing(board, currentPlayer) : null;
            if (king && ((king.row === 3 || king.row === 4) && (king.col === 3 || king.col === 4))) {
                return { winner: currentPlayer };
            }
            return null;
        });

        return ruleBuilder.createGame();
    },

    atomicChessExample: function() {
        const ruleBuilder = new RuleBuilder();

        ruleBuilder.addSpecialRule('atomic-capture', (board, fromRow, fromCol, toRow, toCol) => {
            const capturedPiece = board[toRow][toCol];
            if (capturedPiece) {
                const explosionSquares = [
                    [toRow - 1, toCol - 1], [toRow - 1, toCol], [toRow - 1, toCol + 1],
                    [toRow, toCol - 1],     [toRow, toCol],     [toRow, toCol + 1],
                    [toRow + 1, toCol - 1], [toRow + 1, toCol], [toRow + 1, toCol + 1]
                ];

                for (const [row, col] of explosionSquares) {
                    if (row >= 0 && row < 8 && col >= 0 && col < 8) {
                        const piece = board[row][col];
                        if (piece && piece.type !== 'pawn') {
                            board[row][col] = null;
                        }
                    }
                }
            }
        });

        return ruleBuilder.createGame({
            customMoveValidation: (moves, board, row, col, currentPlayer, moveHistory) => {
                return moves;
            }
        });
    },

    circeChessExample: function() {
        const ruleBuilder = new RuleBuilder();

        ruleBuilder.addSpecialRule('circe-capture', (board, capturedPiece) => {
            const homeSquares = {
                'white': {
                    'pawn': [6, 0], 'rook': [7, 0], 'knight': [7, 1],
                    'bishop': [7, 2], 'queen': [7, 3], 'king': [7, 4]
                },
                'black': {
                    'pawn': [1, 0], 'rook': [0, 0], 'knight': [0, 1],
                    'bishop': [0, 2], 'queen': [0, 3], 'king': [0, 4]
                }
            };

            const homeSquare = homeSquares[capturedPiece.color][capturedPiece.type];
            if (homeSquare && !board[homeSquare[0]][homeSquare[1]]) {
                board[homeSquare[0]][homeSquare[1]] = capturedPiece;
                capturedPiece.row = homeSquare[0];
                capturedPiece.col = homeSquare[1];
                return true;
            }
            return false;
        });

        return ruleBuilder.createGame();
    },

    customBoardSizeExample: function() {
        const ruleBuilder = new RuleBuilder();

        ruleBuilder.setBoardSize(10, 10);

        ruleBuilder.addCustomPiece('chancellor', {
            symbol: '♞',
            movePattern: ruleBuilder.framework.createCustomMovePattern([
                { type: 'slide', direction: RuleBuilder.directions.north },
                { type: 'slide', direction: RuleBuilder.directions.south },
                { type: 'slide', direction: RuleBuilder.directions.east },
                { type: 'slide', direction: RuleBuilder.directions.west },
                ...RuleBuilder.directions.knightMoves.map(dir => ({ type: 'jump', direction: dir }))
            ]),
            value: 8
        });

        return ruleBuilder.createGame();
    },

    threeBoardExample: function() {
        const ruleBuilder = new RuleBuilder();

        ruleBuilder.addMoveModifier((moves, board, row, col, currentPlayer, moveHistory) => {
            return moves;
        });

        ruleBuilder.addVictoryCondition('control-all-boards', (boards, currentPlayer) => {
            return null;
        });

        return ruleBuilder.createGame();
    },

    customPromotionExample: function() {
        const ruleBuilder = new RuleBuilder();

        ruleBuilder.addSpecialRule('custom-promotion', (pawn, availablePieces) => {
            return availablePieces.includes('amazon') ? 'amazon' : 'queen';
        });

        return ruleBuilder.createGame();
    },

    fogOfWarExample: function() {
        const ruleBuilder = new RuleBuilder();

        ruleBuilder.addMoveModifier((moves, board, row, col, currentPlayer, moveHistory) => {
            const visibleSquares = new Set();

            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const piece = board[r][c];
                    if (piece && piece.color === currentPlayer) {
                        const pieceMoves = moves;
                        pieceMoves.forEach(move => visibleSquares.add(`${move.row},${move.col}`));
                        visibleSquares.add(`${r},${c}`);

                        for (let dr = -1; dr <= 1; dr++) {
                            for (let dc = -1; dc <= 1; dc++) {
                                const nr = r + dr, nc = c + dc;
                                if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                                    visibleSquares.add(`${nr},${nc}`);
                                }
                            }
                        }
                    }
                }
            }

            return moves.filter(move => visibleSquares.has(`${move.row},${move.col}`));
        });

        return ruleBuilder.createGame();
    }
};

function enableRuleModificationUI() {
    const rulesPanel = document.createElement('div');
    rulesPanel.id = 'rules-panel';
    rulesPanel.innerHTML = `
        <h3>Rule Modifications</h3>
        <div class="rule-toggles">
            <label><input type="checkbox" id="atomic-rule"> Atomic Chess</label>
            <label><input type="checkbox" id="fog-of-war"> Fog of War</label>
            <label><input type="checkbox" id="king-of-hill"> King of the Hill</label>
            <label><input type="checkbox" id="circe-rule"> Circe Chess</label>
        </div>
        <div class="custom-pieces">
            <h4>Custom Pieces</h4>
            <label><input type="checkbox" id="amazon-piece"> Amazon (Queen + Knight)</label>
            <label><input type="checkbox" id="chancellor-piece"> Chancellor (Rook + Knight)</label>
        </div>
        <button id="apply-rules">Apply Rules</button>
    `;

    document.querySelector('.game-container').appendChild(rulesPanel);

    document.getElementById('apply-rules').addEventListener('click', () => {
        const ruleBuilder = new RuleBuilder();
        let modifications = {};

        if (document.getElementById('atomic-rule').checked) {
            modifications = { ...modifications, ...examples.atomicChessExample() };
        }

        if (document.getElementById('fog-of-war').checked) {
            const fogGame = examples.fogOfWarExample();
            ruleBuilder.framework = fogGame.framework;
        }

        if (document.getElementById('king-of-hill').checked) {
            const kingGame = examples.kingOfTheHillExample();
            ruleBuilder.framework = kingGame.framework;
        }

        if (document.getElementById('amazon-piece').checked) {
            const amazonGame = examples.customPieceExample();
            ruleBuilder.framework = amazonGame.framework;
        }

        window.game.ruleEngine = ruleBuilder.createGame(modifications);
        window.game.renderBoard();
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { examples, enableRuleModificationUI };
}