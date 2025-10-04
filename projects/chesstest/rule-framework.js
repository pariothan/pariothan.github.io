class ChessRuleFramework {
    constructor() {
        this.customRules = new Map();
        this.rulePlugins = new Map();
        this.boardSize = { rows: 8, cols: 8 };
        this.customPieces = new Map();
        this.victoryConditions = new Map();
        this.moveModifiers = [];
        this.specialRules = new Map();
    }

    registerCustomPiece(name, config) {
        this.customPieces.set(name, {
            symbol: config.symbol,
            movePattern: config.movePattern,
            value: config.value || 1,
            canPromoteTo: config.canPromoteTo || false,
            ...config
        });
    }

    registerVictoryCondition(name, condition) {
        this.victoryConditions.set(name, condition);
    }

    registerSpecialRule(name, rule) {
        this.specialRules.set(name, rule);
    }

    addMoveModifier(modifier) {
        this.moveModifiers.push(modifier);
    }

    setBoardSize(rows, cols) {
        this.boardSize = { rows, cols };
    }

    registerRule(ruleName, ruleFunction) {
        this.customRules.set(ruleName, ruleFunction);
    }

    applyRule(ruleName, ...args) {
        const rule = this.customRules.get(ruleName);
        if (rule) {
            return rule.apply(this, args);
        }
        return null;
    }

    hasRule(ruleName) {
        return this.customRules.has(ruleName);
    }

    createCustomMovePattern(pattern) {
        return (board, row, col, color) => {
            const moves = [];
            const piece = board[row][col];

            for (const move of pattern) {
                if (move.type === 'slide') {
                    for (let i = 1; i < move.maxDistance || 8; i++) {
                        const newRow = row + move.direction[0] * i;
                        const newCol = col + move.direction[1] * i;

                        if (!this.isValidSquare(newRow, newCol)) break;

                        const target = board[newRow][newCol];
                        if (!target) {
                            moves.push({ row: newRow, col: newCol });
                        } else {
                            if (target.color !== piece.color) {
                                moves.push({ row: newRow, col: newCol });
                            }
                            break;
                        }
                    }
                } else if (move.type === 'jump') {
                    const newRow = row + move.direction[0];
                    const newCol = col + move.direction[1];

                    if (this.isValidSquare(newRow, newCol)) {
                        const target = board[newRow][newCol];
                        if (!target || target.color !== piece.color) {
                            moves.push({ row: newRow, col: newCol });
                        }
                    }
                } else if (move.type === 'conditional') {
                    if (move.condition(board, row, col, piece)) {
                        const conditionalMoves = this.createCustomMovePattern(move.moves)(board, row, col, color);
                        moves.push(...conditionalMoves);
                    }
                }
            }

            return moves;
        };
    }

    isValidSquare(row, col) {
        return row >= 0 && row < this.boardSize.rows && col >= 0 && col < this.boardSize.cols;
    }

    createGameVariant(variantName, config) {
        const variant = {
            name: variantName,
            boardSize: config.boardSize || { rows: 8, cols: 8 },
            initialSetup: config.initialSetup || this.getStandardSetup(),
            pieces: config.pieces || this.getStandardPieces(),
            rules: config.rules || [],
            victoryConditions: config.victoryConditions || ['checkmate'],
            specialRules: config.specialRules || []
        };

        this.rulePlugins.set(variantName, variant);
        return variant;
    }

    getStandardSetup() {
        return [
            ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'],
            ['pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn'],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            ['pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn'],
            ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook']
        ];
    }

    getStandardPieces() {
        return {
            pawn: { movePattern: 'pawn', value: 1 },
            rook: { movePattern: 'rook', value: 5 },
            knight: { movePattern: 'knight', value: 3 },
            bishop: { movePattern: 'bishop', value: 3 },
            queen: { movePattern: 'queen', value: 9 },
            king: { movePattern: 'king', value: 100 }
        };
    }

    createModifiedRuleEngine(modifications = {}) {
        return class ModifiedChessRuleEngine extends ChessRuleEngine {
            constructor(framework) {
                super();
                this.framework = framework;
                this.modifications = modifications;
            }

            getValidMoves(board, row, col, currentPlayer, moveHistory) {
                let moves = super.getValidMoves(board, row, col, currentPlayer, moveHistory);

                for (const modifier of this.framework.moveModifiers) {
                    moves = modifier(moves, board, row, col, currentPlayer, moveHistory);
                }

                if (this.modifications.customMoveValidation) {
                    moves = this.modifications.customMoveValidation(moves, board, row, col, currentPlayer, moveHistory);
                }

                return moves;
            }

            getPossibleMoves(board, row, col, moveHistory) {
                const piece = board[row][col];
                const customPiece = this.framework.customPieces.get(piece.type);

                if (customPiece && customPiece.movePattern) {
                    if (typeof customPiece.movePattern === 'function') {
                        return customPiece.movePattern(board, row, col, piece.color);
                    }
                }

                return super.getPossibleMoves(board, row, col, moveHistory);
            }

            isGameEnd(board, currentPlayer, moveHistory, gameStates) {
                for (const [name, condition] of this.framework.victoryConditions) {
                    const result = condition(board, currentPlayer, moveHistory, gameStates);
                    if (result) {
                        return { status: name, winner: result.winner };
                    }
                }

                return super.checkGameEnd ? super.checkGameEnd(board, currentPlayer, moveHistory, gameStates) : null;
            }

            applySpecialRule(ruleName, ...args) {
                if (this.framework.specialRules.has(ruleName)) {
                    return this.framework.specialRules.get(ruleName)(...args);
                }
                return null;
            }
        };
    }
}

const gameVariants = {
    chess960: {
        name: 'Chess960 (Fischer Random)',
        setupFunction: function() {
            const backRankPieces = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

            const shuffled = [...backRankPieces];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }

            const kingIndex = shuffled.indexOf('king');
            const rook1Index = shuffled.indexOf('rook');
            const rook2Index = shuffled.lastIndexOf('rook');

            if (kingIndex < Math.min(rook1Index, rook2Index) || kingIndex > Math.max(rook1Index, rook2Index)) {
                return this.setupFunction();
            }

            const bishop1Index = shuffled.indexOf('bishop');
            const bishop2Index = shuffled.lastIndexOf('bishop');
            if ((bishop1Index + bishop2Index) % 2 === 0) {
                return this.setupFunction();
            }

            return shuffled;
        }
    },

    kingOfTheHill: {
        name: 'King of the Hill',
        victoryCondition: function(board, currentPlayer) {
            const king = this.findKing(board, currentPlayer);
            if (king && ((king.row === 3 || king.row === 4) && (king.col === 3 || king.col === 4))) {
                return { winner: currentPlayer, reason: 'king-of-the-hill' };
            }
            return null;
        }
    },

    atomic: {
        name: 'Atomic Chess',
        captureRule: function(board, fromRow, fromCol, toRow, toCol) {
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
        }
    },

    horde: {
        name: 'Horde Chess',
        setupFunction: function() {
            const setup = Array(8).fill(null).map(() => Array(8).fill(null));

            setup[0] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
            setup[1] = ['pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn'];

            for (let row = 4; row < 8; row++) {
                for (let col = 0; col < 8; col++) {
                    setup[row][col] = 'pawn';
                }
            }
            setup[7][0] = setup[7][7] = null;
            setup[6][0] = setup[6][7] = null;

            return setup;
        },
        victoryCondition: function(board, currentPlayer) {
            if (currentPlayer === 'white') {
                return this.findKing(board, 'black') ? null : { winner: 'white', reason: 'king-captured' };
            } else {
                const whitePieces = board.flat().filter(piece => piece && piece.color === 'white');
                return whitePieces.length === 0 ? { winner: 'black', reason: 'all-pieces-captured' } : null;
            }
        }
    }
};

class RuleBuilder {
    constructor() {
        this.framework = new ChessRuleFramework();
    }

    static createCustomPiece(name, config) {
        return {
            name,
            symbol: config.symbol,
            movePattern: config.movePattern,
            value: config.value || 1,
            specialAbilities: config.specialAbilities || []
        };
    }

    static createMovePattern() {
        return {
            slide: (direction, maxDistance = 8) => ({
                type: 'slide',
                direction,
                maxDistance
            }),
            jump: (direction) => ({
                type: 'jump',
                direction
            }),
            conditional: (condition, moves) => ({
                type: 'conditional',
                condition,
                moves
            })
        };
    }

    static createVictoryCondition(name, checkFunction) {
        return {
            name,
            check: checkFunction
        };
    }

    static directions = {
        north: [-1, 0],
        south: [1, 0],
        east: [0, 1],
        west: [0, -1],
        northeast: [-1, 1],
        northwest: [-1, -1],
        southeast: [1, 1],
        southwest: [1, -1],
        knightMoves: [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ]
    };

    addCustomPiece(name, config) {
        this.framework.registerCustomPiece(name, config);
        return this;
    }

    addVictoryCondition(name, condition) {
        this.framework.registerVictoryCondition(name, condition);
        return this;
    }

    addSpecialRule(name, rule) {
        this.framework.registerSpecialRule(name, rule);
        return this;
    }

    addMoveModifier(modifier) {
        this.framework.addMoveModifier(modifier);
        return this;
    }

    setBoardSize(rows, cols) {
        this.framework.setBoardSize(rows, cols);
        return this;
    }

    createGame(modifications = {}) {
        const ModifiedRuleEngine = this.framework.createModifiedRuleEngine(modifications);
        return new ModifiedRuleEngine(this.framework);
    }

    build() {
        return this.framework;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ChessRuleFramework, RuleBuilder, gameVariants };
}