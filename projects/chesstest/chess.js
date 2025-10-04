class ChessPiece {
    constructor(color, type, row, col, customMoveset = null, displayName = null) {
        this.color = color;
        this.type = type;
        this.row = row;
        this.col = col;
        this.hasMoved = false;
        this.customMoveset = customMoveset;
        this.displayName = displayName;
    }

    getSymbol() {
        const symbols = {
            white: {
                king: '♔\uFE0E', queen: '♕\uFE0E', rook: '♖\uFE0E',
                bishop: '♗\uFE0E', knight: '♘\uFE0E', pawn: '♙\uFE0E',
                amazon: '◈\uFE0E', chancellor: '⬡\uFE0E', archbishop: '✦\uFE0E',
                champion: '◇\uFE0E', dragon: '⬢\uFE0E', phoenix: '✧\uFE0E',
                wizard: '⬟\uFE0E', sentinel: '▣\uFE0E', fortress: '⬒\uFE0E',
                vanguard: '◊\uFE0E', templar: '◈\uFE0E', warden: '⬙\uFE0E',
                titan: '◉\uFE0E', oracle: '◎\uFE0E', marshal: '⬢\uFE0E',
                lancer: '◆\uFE0E', griffin: '⬡\uFE0E', chimera: '⬟\uFE0E',
                sphinx: '◇\uFE0E', wraith: '◊\uFE0E', crusader: '✦\uFE0E',
                zealot: '✧\uFE0E', herald: '◎\uFE0E', paladin: '◉\uFE0E'
            },
            black: {
                king: '♚\uFE0E', queen: '♛\uFE0E', rook: '♜\uFE0E',
                bishop: '♝\uFE0E', knight: '♞\uFE0E', pawn: '♟\uFE0E',
                amazon: '◆\uFE0E', chancellor: '⬢\uFE0E', archbishop: '✶\uFE0E',
                champion: '◆\uFE0E', dragon: '⬣\uFE0E', phoenix: '✦\uFE0E',
                wizard: '⬢\uFE0E', sentinel: '◼\uFE0E', fortress: '⬓\uFE0E',
                vanguard: '◆\uFE0E', templar: '◆\uFE0E', warden: '⬚\uFE0E',
                titan: '●\uFE0E', oracle: '◉\uFE0E', marshal: '⬣\uFE0E',
                lancer: '◆\uFE0E', griffin: '⬢\uFE0E', chimera: '⬢\uFE0E',
                sphinx: '◆\uFE0E', wraith: '◆\uFE0E', crusader: '✶\uFE0E',
                zealot: '✦\uFE0E', herald: '◉\uFE0E', paladin: '●\uFE0E'
            }
        };

        return symbols[this.color][this.type] || symbols[this.color]['knight'];
    }

    getDisplayName() {
        return this.displayName || this.type.charAt(0).toUpperCase() + this.type.slice(1);
    }
}

function createDefaultRulesConfig() {
    return {
        allowCastling: true,
        allowEnPassant: true,
        enableThreefold: true,
        enableFiftyMove: true,
        enableInsufficientMaterial: true,
        promotionMode: 'choice',
        boardSize: { rows: 8, cols: 8 },
        pieceModifiers: {
            pawn: {
                longStride: false,
                backstep: false,
                sideStep: false,
                diagonalAdvance: false,
                forwardCapture: false
            },
            rook: {
                diagonalStep: false,
                knightStep: false
            },
            bishop: {
                orthogonalSlide: false,
                knightStep: false
            },
            knight: {
                diagonalStep: false,
                orthogonalStep: false
            },
            queen: {
                knightStep: false,
                rookOnly: false,
                bishopOnly: false
            },
            king: {
                knightStep: false,
                doubleStep: false
            }
        }
    };
}

class ChessRuleEngine {
    constructor(config = {}) {
        this.config = { ...createDefaultRulesConfig(), ...config };
    }

    updateConfig(newConfig = {}) {
        this.config = { ...this.config, ...newConfig };
    }

    getBoardDimensions(board) {
        const rows = Array.isArray(board) ? board.length : 0;
        const cols = rows > 0 && Array.isArray(board[0]) ? board[0].length : 0;
        return { rows, cols };
    }

    isValidSquare(board, row, col) {
        const { rows, cols } = this.getBoardDimensions(board);
        return row >= 0 && row < rows && col >= 0 && col < cols;
    }

    getValidMoves(board, row, col, currentPlayer, moveHistory) {
        const piece = board[row][col];
        if (!piece || piece.color !== currentPlayer) return [];

        const moves = this.getPossibleMoves(board, row, col, moveHistory);
        return moves.filter(move => !this.wouldBeInCheck(board, row, col, move.row, move.col, currentPlayer));
    }

    getPossibleMoves(board, row, col, moveHistory, options = {}) {
        const piece = board[row][col];

        // Handle custom pieces with custom movesets
        if (piece.customMoveset) {
            return this.getCustomPieceMoves(board, row, col, piece.customMoveset);
        }

        switch (piece.type) {
            case 'pawn': return this.getPawnMoves(board, row, col, moveHistory);
            case 'rook': return this.getRookMoves(board, row, col);
            case 'knight': return this.getKnightMoves(board, row, col);
            case 'bishop': return this.getBishopMoves(board, row, col);
            case 'queen': return this.getQueenMoves(board, row, col);
            case 'king': return this.getKingMoves(board, row, col, moveHistory, options);
            default: return [];
        }
    }

    getCustomPieceMoves(board, row, col, moveset) {
        let moves = [];

        // Handle sliding moves (rook-like, bishop-like) - both move and capture
        if (moveset.slides) {
            for (const direction of moveset.slides) {
                moves = moves.concat(this.getSlidingMoves(board, row, col, direction.dr, direction.dc, moveset.maxDistance || 8));
            }
        }

        // Handle move-only slides (can move but not capture)
        if (moveset.moveOnlySlides) {
            for (const direction of moveset.moveOnlySlides) {
                moves = moves.concat(this.getMoveOnlySlidingMoves(board, row, col, direction.dr, direction.dc, moveset.maxDistance || 8));
            }
        }

        // Handle capture-only slides (can capture but not move)
        if (moveset.captureSlides) {
            for (const direction of moveset.captureSlides) {
                moves = moves.concat(this.getCaptureOnlySlidingMoves(board, row, col, direction.dr, direction.dc, moveset.maxDistance || 8));
            }
        }

        // Handle leaping moves (knight-like, king-like) - both move and capture
        if (moveset.leaps) {
            for (const leap of moveset.leaps) {
                const targetRow = row + leap.dr;
                const targetCol = col + leap.dc;
                if (this.isValidSquare(board, targetRow, targetCol)) {
                    const targetPiece = board[targetRow][targetCol];
                    if (!targetPiece || targetPiece.color !== board[row][col].color) {
                        moves.push({ row: targetRow, col: targetCol });
                    }
                }
            }
        }

        // Handle move-only leaps (can move but not capture)
        if (moveset.moveOnlyLeaps) {
            for (const leap of moveset.moveOnlyLeaps) {
                const targetRow = row + leap.dr;
                const targetCol = col + leap.dc;
                if (this.isValidSquare(board, targetRow, targetCol)) {
                    const targetPiece = board[targetRow][targetCol];
                    if (!targetPiece) {
                        moves.push({ row: targetRow, col: targetCol });
                    }
                }
            }
        }

        // Handle capture-only leaps (can capture but not move)
        if (moveset.captureLeaps) {
            for (const leap of moveset.captureLeaps) {
                const targetRow = row + leap.dr;
                const targetCol = col + leap.dc;
                if (this.isValidSquare(board, targetRow, targetCol)) {
                    const targetPiece = board[targetRow][targetCol];
                    if (targetPiece && targetPiece.color !== board[row][col].color) {
                        moves.push({ row: targetRow, col: targetCol });
                    }
                }
            }
        }

        // Handle jump captures (Xiangqi Cannon style)
        if (moveset.jumpCaptures) {
            for (const direction of moveset.jumpCaptures) {
                moves = moves.concat(this.getCannonMoves(board, row, col, direction.dr, direction.dc));
            }
        }

        return moves;
    }

    getCannonMoves(board, row, col, deltaRow, deltaCol) {
        const moves = [];
        const piece = board[row][col];
        let foundScreen = false;

        // First, slide normally until we hit a piece (the "screen")
        for (let i = 1; i < 8; i++) {
            const newRow = row + deltaRow * i;
            const newCol = col + deltaCol * i;

            if (!this.isValidSquare(board, newRow, newCol)) break;

            const targetPiece = board[newRow][newCol];

            if (!foundScreen) {
                // Moving without jumping - normal rook-like movement
                if (!targetPiece) {
                    moves.push({ row: newRow, col: newCol });
                } else {
                    // Found the screen - can't move here, but can jump over it
                    foundScreen = true;
                }
            } else {
                // We've found the screen, now look for a capture target
                if (targetPiece) {
                    // Can capture if it's an enemy piece
                    if (targetPiece.color !== piece.color) {
                        moves.push({ row: newRow, col: newCol });
                    }
                    break; // Can't jump over multiple pieces
                }
                // Continue looking for a capture target
            }
        }

        return moves;
    }

    getSlidingMoves(board, row, col, deltaRow, deltaCol, maxDistance) {
        const moves = [];
        const piece = board[row][col];

        for (let i = 1; i <= maxDistance; i++) {
            const newRow = row + deltaRow * i;
            const newCol = col + deltaCol * i;

            if (!this.isValidSquare(board, newRow, newCol)) break;

            const targetPiece = board[newRow][newCol];
            if (targetPiece) {
                if (targetPiece.color !== piece.color) {
                    moves.push({ row: newRow, col: newCol });
                }
                break;
            }

            moves.push({ row: newRow, col: newCol });
        }

        return moves;
    }

    getMoveOnlySlidingMoves(board, row, col, deltaRow, deltaCol, maxDistance) {
        const moves = [];

        for (let i = 1; i <= maxDistance; i++) {
            const newRow = row + deltaRow * i;
            const newCol = col + deltaCol * i;

            if (!this.isValidSquare(board, newRow, newCol)) break;

            const targetPiece = board[newRow][newCol];
            if (targetPiece) {
                // Hit a piece, stop here (can't capture or move through)
                break;
            }

            moves.push({ row: newRow, col: newCol });
        }

        return moves;
    }

    getCaptureOnlySlidingMoves(board, row, col, deltaRow, deltaCol, maxDistance) {
        const moves = [];
        const piece = board[row][col];

        for (let i = 1; i <= maxDistance; i++) {
            const newRow = row + deltaRow * i;
            const newCol = col + deltaCol * i;

            if (!this.isValidSquare(board, newRow, newCol)) break;

            const targetPiece = board[newRow][newCol];
            if (targetPiece) {
                // Can only capture, not move
                if (targetPiece.color !== piece.color) {
                    moves.push({ row: newRow, col: newCol });
                }
                break;
            }
            // Don't add empty squares for capture-only moves
        }

        return moves;
    }

    getPawnMoves(board, row, col, moveHistory) {
        const piece = board[row][col];
        const moves = [];
        const { rows } = this.getBoardDimensions(board);
        const direction = piece.color === 'white' ? -1 : 1;
        const startRow = piece.color === 'white' ? rows - 2 : 1;
        const pawnMods = this.config.pieceModifiers?.pawn || {};

        const oneStepRow = row + direction;
        if (this.isValidSquare(board, oneStepRow, col) && !board[oneStepRow][col]) {
            moves.push({ row: oneStepRow, col });

            const twoStepRow = row + 2 * direction;
            if (row === startRow && this.isValidSquare(board, twoStepRow, col) && !board[twoStepRow][col]) {
                moves.push({ row: twoStepRow, col });

                if (pawnMods.longStride) {
                    const threeStepRow = row + 3 * direction;
                    if (this.isValidSquare(board, threeStepRow, col) && !board[threeStepRow][col]) {
                        moves.push({ row: threeStepRow, col });
                    }
                }
            }
        }

        for (const deltaCol of [-1, 1]) {
            const newRow = row + direction;
            const newCol = col + deltaCol;

            if (this.isValidSquare(board, newRow, newCol)) {
                const target = board[newRow][newCol];
                if (target && target.color !== piece.color) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }

        if (this.config.allowEnPassant) {
            for (const deltaCol of [-1, 1]) {
                const newCol = col + deltaCol;
                if (this.isValidSquare(board, row, newCol)) {
                    const lastMove = moveHistory[moveHistory.length - 1];
                    if (lastMove &&
                        lastMove.piece === 'pawn' &&
                        Math.abs(lastMove.to.row - lastMove.from.row) === 2 &&
                        lastMove.to.row === row &&
                        lastMove.to.col === newCol) {
                        moves.push({ row: row + direction, col: newCol });
                    }
                }
            }
        }

        if (pawnMods.backstep) {
            const backRow = row - direction;
            if (this.isValidSquare(board, backRow, col) && !board[backRow][col]) {
                moves.push({ row: backRow, col });
            }
        }

        if (pawnMods.sideStep) {
            for (const deltaCol of [-1, 1]) {
                const sideCol = col + deltaCol;
                if (this.isValidSquare(board, row, sideCol) && !board[row][sideCol]) {
                    moves.push({ row, col: sideCol });
                }
            }
        }

        if (pawnMods.diagonalAdvance) {
            for (const deltaCol of [-1, 1]) {
                const diagRow = row + direction;
                const diagCol = col + deltaCol;
                if (this.isValidSquare(board, diagRow, diagCol) && !board[diagRow][diagCol]) {
                    moves.push({ row: diagRow, col: diagCol });
                }
            }
        }

        if (pawnMods.forwardCapture) {
            const forwardRow = row + direction;
            if (this.isValidSquare(board, forwardRow, col)) {
                const target = board[forwardRow][col];
                if (target && target.color !== piece.color) {
                    moves.push({ row: forwardRow, col });
                }
            }
        }

        return moves;
    }

    getRookMoves(board, row, col) {
        const moves = [];
        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        const { rows, cols } = this.getBoardDimensions(board);
        const maxDistance = Math.max(rows, cols);
        const originPiece = board[row][col];
        const originColor = originPiece ? originPiece.color : null;

        for (const [dRow, dCol] of directions) {
            for (let i = 1; i < maxDistance; i++) {
                const newRow = row + dRow * i;
                const newCol = col + dCol * i;

                if (!this.isValidSquare(board, newRow, newCol)) break;

                const target = board[newRow][newCol];
                if (!target) {
                    moves.push({ row: newRow, col: newCol });
                } else {
                    if (target.color !== originColor) {
                        moves.push({ row: newRow, col: newCol });
                    }
                    break;
                }
            }
        }

        const rookMods = this.config.pieceModifiers?.rook || {};

        if (rookMods.diagonalStep) {
            const diagonalSteps = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
            for (const [dRow, dCol] of diagonalSteps) {
                const newRow = row + dRow;
                const newCol = col + dCol;
                if (this.isValidSquare(board, newRow, newCol)) {
                    const target = board[newRow][newCol];
                    if (!target || target.color !== originColor) {
                        moves.push({ row: newRow, col: newCol });
                    }
                }
            }
        }

        if (rookMods.knightStep) {
            const knightMoves = [
                [-2, -1], [-2, 1], [-1, -2], [-1, 2],
                [1, -2], [1, 2], [2, -1], [2, 1]
            ];
            for (const [dRow, dCol] of knightMoves) {
                const newRow = row + dRow;
                const newCol = col + dCol;
                if (this.isValidSquare(board, newRow, newCol)) {
                    const target = board[newRow][newCol];
                    if (!target || target.color !== originColor) {
                        moves.push({ row: newRow, col: newCol });
                    }
                }
            }
        }

        return moves;
    }

    getKnightMoves(board, row, col) {
        const moves = [];
        const knightMoves = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];

        const knightMods = this.config.pieceModifiers?.knight || {};

        if (knightMods.diagonalStep) {
            knightMoves.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
        }

        if (knightMods.orthogonalStep) {
            knightMoves.push([-1, 0], [1, 0], [0, -1], [0, 1]);
        }

        for (const [dRow, dCol] of knightMoves) {
            const newRow = row + dRow;
            const newCol = col + dCol;

            if (this.isValidSquare(board, newRow, newCol)) {
                const target = board[newRow][newCol];
                if (!target || target.color !== board[row][col].color) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }

        return moves;
    }

    getBishopMoves(board, row, col) {
        const moves = [];
        const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
        const { rows, cols } = this.getBoardDimensions(board);
        const maxDistance = Math.max(rows, cols);
        const originColor = board[row][col] ? board[row][col].color : null;
        const bishopMods = this.config.pieceModifiers?.bishop || {};

        for (const [dRow, dCol] of directions) {
            for (let i = 1; i < maxDistance; i++) {
                const newRow = row + dRow * i;
                const newCol = col + dCol * i;

                if (!this.isValidSquare(board, newRow, newCol)) break;

                const target = board[newRow][newCol];
                if (!target) {
                    moves.push({ row: newRow, col: newCol });
                } else {
                    if (target.color !== originColor) {
                        moves.push({ row: newRow, col: newCol });
                    }
                    break;
                }
            }
        }

        if (bishopMods.orthogonalSlide) {
            const orthoDirections = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (const [dRow, dCol] of orthoDirections) {
                for (let i = 1; i < maxDistance; i++) {
                    const newRow = row + dRow * i;
                    const newCol = col + dCol * i;

                    if (!this.isValidSquare(board, newRow, newCol)) break;

                    const target = board[newRow][newCol];
                    if (!target) {
                        moves.push({ row: newRow, col: newCol });
                    } else {
                        if (target.color !== originColor) {
                            moves.push({ row: newRow, col: newCol });
                        }
                        break;
                    }
                }
            }
        }

        if (bishopMods.knightStep) {
            const knightMoves = [
                [-2, -1], [-2, 1], [-1, -2], [-1, 2],
                [1, -2], [1, 2], [2, -1], [2, 1]
            ];
            for (const [dRow, dCol] of knightMoves) {
                const newRow = row + dRow;
                const newCol = col + dCol;
                if (this.isValidSquare(board, newRow, newCol)) {
                    const target = board[newRow][newCol];
                    if (!target || target.color !== originColor) {
                        moves.push({ row: newRow, col: newCol });
                    }
                }
            }
        }

        return moves;
    }

    getQueenMoves(board, row, col) {
        const queenMods = this.config.pieceModifiers?.queen || {};
        const restrictToRook = queenMods.rookOnly && !queenMods.bishopOnly;
        const restrictToBishop = queenMods.bishopOnly && !queenMods.rookOnly;

        let moves = [];

        if (restrictToRook) {
            moves = this.getRookMoves(board, row, col);
        } else if (restrictToBishop) {
            moves = this.getBishopMoves(board, row, col);
        } else {
            moves = [...this.getRookMoves(board, row, col), ...this.getBishopMoves(board, row, col)];
        }

        if (queenMods.knightStep) {
            const originColor = board[row][col] ? board[row][col].color : null;
            const knightMoves = [
                [-2, -1], [-2, 1], [-1, -2], [-1, 2],
                [1, -2], [1, 2], [2, -1], [2, 1]
            ];
            for (const [dRow, dCol] of knightMoves) {
                const newRow = row + dRow;
                const newCol = col + dCol;
                if (this.isValidSquare(board, newRow, newCol)) {
                    const target = board[newRow][newCol];
                    if (!target || target.color !== originColor) {
                        moves.push({ row: newRow, col: newCol });
                    }
                }
            }
        }

        return moves;
    }

    getKingMoves(board, row, col, moveHistory, options = {}) {
        const moves = [];
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];

        for (const [dRow, dCol] of directions) {
            const newRow = row + dRow;
            const newCol = col + dCol;

            if (this.isValidSquare(board, newRow, newCol)) {
                const target = board[newRow][newCol];
                if (!target || target.color !== board[row][col].color) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }

        const kingMods = this.config.pieceModifiers?.king || {};

        if (kingMods.knightStep) {
            const knightMoves = [
                [-2, -1], [-2, 1], [-1, -2], [-1, 2],
                [1, -2], [1, 2], [2, -1], [2, 1]
            ];
            for (const [dRow, dCol] of knightMoves) {
                const newRow = row + dRow;
                const newCol = col + dCol;
                if (this.isValidSquare(board, newRow, newCol)) {
                    const target = board[newRow][newCol];
                    if (!target || target.color !== board[row][col].color) {
                        moves.push({ row: newRow, col: newCol });
                    }
                }
            }
        }

        if (kingMods.doubleStep) {
            for (const [dRow, dCol] of directions) {
                const midRow = row + dRow;
                const midCol = col + dCol;
                const endRow = row + 2 * dRow;
                const endCol = col + 2 * dCol;

                if (this.isValidSquare(board, midRow, midCol) && this.isValidSquare(board, endRow, endCol)) {
                    const midSquare = board[midRow][midCol];
                    const endSquare = board[endRow][endCol];

                    if (!midSquare && (!endSquare || endSquare.color !== board[row][col].color)) {
                        moves.push({ row: endRow, col: endCol });
                    }
                }
            }
        }

        if (!options.ignoreCastling && this.config.allowCastling) {
            const castlingMoves = this.getCastlingMoves(board, row, col, moveHistory);
            moves.push(...castlingMoves);
        }

        return moves;
    }

    getCastlingMoves(board, row, col, moveHistory) {
        if (!this.config.allowCastling) return [];

        const moves = [];
        const piece = board[row][col];

        if (!piece || piece.type !== 'king' || piece.hasMoved || this.isInCheck(board, piece.color)) {
            return moves;
        }

        const { rows, cols } = this.getBoardDimensions(board);
        const backRow = piece.color === 'white' ? rows - 1 : 0;
        if (row !== backRow) return moves;

        const rookTargets = [
            { direction: 1, rookCol: cols - 1 },
            { direction: -1, rookCol: 0 }
        ];

        for (const { direction, rookCol } of rookTargets) {
            const rook = board[backRow][rookCol];

            if (!rook || rook.type !== 'rook' || rook.hasMoved) continue;

            const kingDestCol = col + 2 * direction;

            if (!this.isValidSquare(board, backRow, kingDestCol)) continue;

            const pathColumns = [];
            for (let c = col + direction; c !== rookCol; c += direction) {
                pathColumns.push(c);
            }

            let pathClear = true;
            for (const checkCol of pathColumns) {
                if (board[backRow][checkCol]) {
                    pathClear = false;
                    break;
                }
            }

            if (pathClear) {
                let castlingSafe = true;
                for (const checkCol of [col + direction, kingDestCol]) {
                    if (this.wouldBeInCheck(board, row, col, row, checkCol, piece.color)) {
                        castlingSafe = false;
                        break;
                    }
                }

                if (castlingSafe) {
                    moves.push({ row: backRow, col: kingDestCol });
                }
            }
        }

        return moves;
    }

    wouldBeInCheck(board, fromRow, fromCol, toRow, toCol, color) {
        const tempBoard = board.map(row => [...row]);
        const piece = tempBoard[fromRow][fromCol];

        tempBoard[toRow][toCol] = piece;
        tempBoard[fromRow][fromCol] = null;

        return this.isInCheck(tempBoard, color);
    }

    isInCheck(board, color) {
        const king = this.findKing(board, color);
        if (!king) return false;

        const { rows, cols } = this.getBoardDimensions(board);
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const piece = board[row][col];
                if (piece && piece.color !== color) {
                    const moves = this.getPossibleMoves(board, row, col, [], { ignoreCastling: true });
                    if (moves.some(move => move.row === king.row && move.col === king.col)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    findKing(board, color) {
        const { rows, cols } = this.getBoardDimensions(board);
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const piece = board[row][col];
                if (piece && piece.type === 'king' && piece.color === color) {
                    return { row, col };
                }
            }
        }
        return null;
    }

    hasValidMoves(board, color, moveHistory) {
        const { rows, cols } = this.getBoardDimensions(board);
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const piece = board[row][col];
                if (piece && piece.color === color) {
                    const validMoves = this.getValidMoves(board, row, col, color, moveHistory);
                    if (validMoves.length > 0) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    isCastlingMove(board, fromRow, fromCol, toRow, toCol) {
        if (!this.config.allowCastling) return false;

        const piece = board[fromRow][fromCol];
        return piece && piece.type === 'king' && Math.abs(toCol - fromCol) === 2;
    }

    isEnPassantMove(board, fromRow, fromCol, toRow, toCol, moveHistory) {
        const piece = board[fromRow][fromCol];
        if (!this.config.allowEnPassant) return false;

        if (!piece || piece.type !== 'pawn') return false;

        if (Math.abs(toCol - fromCol) !== 1) return false;
        if (board[toRow][toCol]) return false;

        const lastMove = moveHistory[moveHistory.length - 1];
        return lastMove &&
               lastMove.piece === 'pawn' &&
               Math.abs(lastMove.to.row - lastMove.from.row) === 2 &&
               lastMove.to.row === fromRow &&
               lastMove.to.col === toCol;
    }

    isInsufficientMaterial(board) {
        const pieces = [];
        const { rows, cols } = this.getBoardDimensions(board);
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const piece = board[row][col];
                if (piece) {
                    pieces.push(piece.type);
                }
            }
        }

        if (!this.config.enableInsufficientMaterial) return false;

        if (pieces.length === 2) return true;

        if (pieces.length === 3) {
            return pieces.includes('bishop') || pieces.includes('knight');
        }

        if (pieces.length === 4) {
            const bishops = pieces.filter(p => p === 'bishop').length;
            const kings = pieces.filter(p => p === 'king').length;
            return bishops === 2 && kings === 2;
        }

        return false;
    }

    isThreefoldRepetition(gameStates) {
        if (!this.config.enableThreefold || gameStates.length < 6) return false;

        const currentState = gameStates[gameStates.length - 1];
        let count = 0;

        for (const state of gameStates) {
            if (state === currentState) {
                count++;
                if (count >= 3) return true;
            }
        }

        return false;
    }

    isFiftyMoveRule(moveHistory) {
        if (!this.config.enableFiftyMove || moveHistory.length < 100) return false;

        const last50Moves = moveHistory.slice(-50);
        return last50Moves.every(move => !move.captured && move.piece !== 'pawn');
    }
}

class ChessGame {
    constructor() {
        this.rulesConfig = createDefaultRulesConfig();
        this.ruleEngine = new ChessRuleEngine(this.rulesConfig);
        this.board = this.initializeBoard();
        this.currentPlayer = 'white';
        this.gameStatus = 'active';
        this.moveHistory = [];
        this.selectedSquare = null;
        this.possibleMoves = [];
        this.capturedPieces = { white: [], black: [] };
        this.gameStates = [];
        this.pendingPromotion = null;

        this.rulesModal = null;
        this.rulesForm = null;

        this.initializeDOM();
        this.renderBoard();
        this.updateGameInfo();
    }

    initializeBoard() {
        const minSize = 6;
        const maxSize = 12;
        const requestedRows = this.rulesConfig.boardSize?.rows || 8;
        const requestedCols = this.rulesConfig.boardSize?.cols || 8;

        const rows = Math.min(Math.max(requestedRows, minSize), maxSize);
        const cols = Math.min(Math.max(requestedCols, minSize), maxSize);

        this.rulesConfig.boardSize = { rows, cols };
        if (this.ruleEngine) {
            this.ruleEngine.updateConfig({ boardSize: { rows, cols } });
        }

        const board = Array.from({ length: rows }, () => Array(cols).fill(null));
        const pieceOrder = this.getInitialPieceOrder(cols);

        const blackHomeRow = 0;
        const whiteHomeRow = rows - 1;
        const blackPawnRow = rows > 2 ? 1 : null;
        const whitePawnRow = rows > 3 ? rows - 2 : null;

        // Replace some pieces with custom pieces if configured
        const customPieces = this.rulesConfig.customPieces || [];
        const replacementIndices = [2, 5]; // Replace bishops by default

        for (let col = 0; col < cols; col++) {
            let pieceType = pieceOrder[col];
            let customMoveset = null;
            let displayName = null;

            // Check if this position should have a custom piece
            if (customPieces.length > 0 && replacementIndices.includes(col)) {
                const customIdx = replacementIndices.indexOf(col) % customPieces.length;
                const customPiece = customPieces[customIdx];
                pieceType = customPiece.type;
                customMoveset = customPiece.moveset;
                displayName = customPiece.name;
            }

            board[blackHomeRow][col] = new ChessPiece('black', pieceType, blackHomeRow, col, customMoveset, displayName);
            board[whiteHomeRow][col] = new ChessPiece('white', pieceType, whiteHomeRow, col, customMoveset, displayName);

            if (blackPawnRow !== null) {
                board[blackPawnRow][col] = new ChessPiece('black', 'pawn', blackPawnRow, col);
            }

            if (whitePawnRow !== null) {
                board[whitePawnRow][col] = new ChessPiece('white', 'pawn', whitePawnRow, col);
            }
        }

        return board;
    }

    getInitialPieceOrder(cols) {
        // Build a mirrored piece order anchored on queen and king for variable board widths.
        const order = new Array(cols).fill(null);
        const middle = Math.floor(cols / 2);
        const queenIndex = Math.max(0, cols % 2 === 0 ? middle - 1 : middle - 1);
        const kingIndex = cols % 2 === 0 ? middle : middle;

        order[kingIndex] = 'king';
        if (queenIndex >= 0) {
            order[queenIndex] = 'queen';
        }

        const pairSequence = ['rook', 'knight', 'bishop', 'knight', 'rook', 'bishop'];
        let seqIndex = 0;
        let left = 0;
        let right = cols - 1;

        while (left <= right) {
            while (left <= right && order[left]) left++;
            while (right >= left && order[right]) right--;
            if (left > right) break;

            const pieceType = pairSequence[seqIndex % pairSequence.length];
            order[left] = pieceType;
            if (left !== right) {
                order[right] = pieceType;
            }
            seqIndex++;
            left++;
            right--;
        }

        return order;
    }

    initializeDOM() {
        document.getElementById('new-game').addEventListener('click', () => this.newGame());
        document.getElementById('random-game').addEventListener('click', () => this.newRandomGame());
        document.getElementById('undo-move').addEventListener('click', () => this.undoMove());

        document.querySelectorAll('.promotion-piece').forEach(piece => {
            piece.addEventListener('click', (e) => this.handlePromotion(e.target.dataset.piece));
        });

        this.rulesModal = document.getElementById('rules-modal');
        this.rulesForm = document.getElementById('rules-form');

        const openRulesButton = document.getElementById('open-rules');
        if (openRulesButton) {
            openRulesButton.addEventListener('click', () => this.openRulesModal());
        }

        if (this.rulesModal) {
            this.rulesModal.addEventListener('click', (event) => {
                if (event.target === this.rulesModal) {
                    this.closeRulesModal();
                }
            });
        }

        const closeRulesButton = document.getElementById('rules-close');
        if (closeRulesButton) {
            closeRulesButton.addEventListener('click', () => this.closeRulesModal());
        }

        const cancelRulesButton = document.getElementById('rules-cancel');
        if (cancelRulesButton) {
            cancelRulesButton.addEventListener('click', (event) => {
                event.preventDefault();
                this.closeRulesModal();
            });
        }

        if (this.rulesForm) {
            this.rulesForm.addEventListener('submit', (event) => {
                event.preventDefault();
                this.handleRulesSubmit(new FormData(this.rulesForm));
            });
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.closeRulesModal();
            }
        });
    }

    openRulesModal() {
        if (!this.rulesModal) return;
        this.populateRulesForm();
        this.rulesModal.style.display = 'grid';
        this.rulesModal.setAttribute('aria-hidden', 'false');
    }

    closeRulesModal() {
        if (!this.rulesModal || this.rulesModal.style.display === 'none') return;
        this.rulesModal.style.display = 'none';
        this.rulesModal.setAttribute('aria-hidden', 'true');
    }

    populateRulesForm() {
        if (!this.rulesForm) return;

        const setCheckbox = (selector, value) => {
            const input = this.rulesForm.querySelector(selector);
            if (input) {
                input.checked = Boolean(value);
            }
        };

        setCheckbox('#rule-allow-castling', this.rulesConfig.allowCastling);
        setCheckbox('#rule-allow-en-passant', this.rulesConfig.allowEnPassant);
        setCheckbox('#rule-threefold', this.rulesConfig.enableThreefold);
        setCheckbox('#rule-fifty', this.rulesConfig.enableFiftyMove);
        setCheckbox('#rule-insufficient', this.rulesConfig.enableInsufficientMaterial);

        const modifiers = this.rulesConfig.pieceModifiers || {};
        const pawnMods = modifiers.pawn || {};
        setCheckbox('#mod-pawn-long', pawnMods.longStride);
        setCheckbox('#mod-pawn-back', pawnMods.backstep);
        setCheckbox('#mod-pawn-side', pawnMods.sideStep);
        setCheckbox('#mod-pawn-diagonal', pawnMods.diagonalAdvance);
        setCheckbox('#mod-pawn-forward-cap', pawnMods.forwardCapture);

        const rookMods = modifiers.rook || {};
        setCheckbox('#mod-rook-diagonal', rookMods.diagonalStep);
        setCheckbox('#mod-rook-knight', rookMods.knightStep);

        const bishopMods = modifiers.bishop || {};
        setCheckbox('#mod-bishop-orthogonal', bishopMods.orthogonalSlide);
        setCheckbox('#mod-bishop-knight', bishopMods.knightStep);

        const knightMods = modifiers.knight || {};
        setCheckbox('#mod-knight-diagonal', knightMods.diagonalStep);
        setCheckbox('#mod-knight-orthogonal', knightMods.orthogonalStep);

        const queenMods = modifiers.queen || {};
        setCheckbox('#mod-queen-knight', queenMods.knightStep);
        setCheckbox('#mod-queen-rook', queenMods.rookOnly);
        setCheckbox('#mod-queen-bishop', queenMods.bishopOnly);

        const kingMods = modifiers.king || {};
        setCheckbox('#mod-king-knight', kingMods.knightStep);
        setCheckbox('#mod-king-double', kingMods.doubleStep);

        const promotionRadios = this.rulesForm.querySelectorAll('input[name="promotion-mode"]');
        promotionRadios.forEach(radio => {
            radio.checked = radio.value === this.rulesConfig.promotionMode;
        });

        const boardSelect = this.rulesForm.querySelector('#rule-board-size');
        if (boardSelect) {
            const desired = String(this.rulesConfig.boardSize?.rows || 8);
            const hasOption = Array.from(boardSelect.options).some(option => option.value === desired);
            boardSelect.value = hasOption ? desired : '8';
        }
    }

    handleRulesSubmit(formData) {
        const sizeValue = parseInt(formData.get('board-size'), 10);
        const normalizedSize = Number.isFinite(sizeValue)
            ? Math.min(Math.max(sizeValue, 6), 12)
            : this.rulesConfig.boardSize.rows;

        const pieceModifiers = {
            pawn: {
                longStride: formData.get('mod-pawn-long') === 'on',
                backstep: formData.get('mod-pawn-back') === 'on',
                sideStep: formData.get('mod-pawn-side') === 'on',
                diagonalAdvance: formData.get('mod-pawn-diagonal') === 'on',
                forwardCapture: formData.get('mod-pawn-forward-cap') === 'on'
            },
            rook: {
                diagonalStep: formData.get('mod-rook-diagonal') === 'on',
                knightStep: formData.get('mod-rook-knight') === 'on'
            },
            bishop: {
                orthogonalSlide: formData.get('mod-bishop-orthogonal') === 'on',
                knightStep: formData.get('mod-bishop-knight') === 'on'
            },
            knight: {
                diagonalStep: formData.get('mod-knight-diagonal') === 'on',
                orthogonalStep: formData.get('mod-knight-orthogonal') === 'on'
            },
            queen: {
                knightStep: formData.get('mod-queen-knight') === 'on',
                rookOnly: formData.get('mod-queen-rook') === 'on',
                bishopOnly: formData.get('mod-queen-bishop') === 'on'
            },
            king: {
                knightStep: formData.get('mod-king-knight') === 'on',
                doubleStep: formData.get('mod-king-double') === 'on'
            }
        };

        const updates = {
            allowCastling: formData.get('allow-castling') === 'on',
            allowEnPassant: formData.get('allow-en-passant') === 'on',
            enableThreefold: formData.get('enable-threefold') === 'on',
            enableFiftyMove: formData.get('enable-fifty-move') === 'on',
            enableInsufficientMaterial: formData.get('enable-insufficient') === 'on',
            promotionMode: formData.get('promotion-mode') || this.rulesConfig.promotionMode,
            boardSize: { rows: normalizedSize, cols: normalizedSize },
            pieceModifiers
        };

        this.applyRulesConfig(updates);
        this.closeRulesModal();
    }

    applyRulesConfig(updates = {}) {
        const nextConfig = {
            ...this.rulesConfig,
            ...updates,
            boardSize: { ...(updates.boardSize || this.rulesConfig.boardSize) },
            pieceModifiers: { ...(updates.pieceModifiers || this.rulesConfig.pieceModifiers) }
        };

        const hasChanged = JSON.stringify(nextConfig) !== JSON.stringify(this.rulesConfig);

        this.rulesConfig = nextConfig;
        this.ruleEngine.updateConfig(this.rulesConfig);

        if (hasChanged) {
            this.newGame();
            this.showBriefingFromConfig(this.rulesConfig);
        }
    }

    showBriefingFromConfig(config) {
        const activeVariants = [];
        const defaults = createDefaultRulesConfig();

        // Check board size
        if (config.boardSize.rows !== 8) {
            activeVariants.push(`Board: ${config.boardSize.rows}×${config.boardSize.cols}`);
        }

        // Check piece modifiers
        const mods = config.pieceModifiers;
        if (mods.pawn?.longStride) activeVariants.push('Pawns: Long Stride');
        if (mods.pawn?.backstep) activeVariants.push('Pawns: Backstep');
        if (mods.pawn?.sideStep) activeVariants.push('Pawns: Side-Step');
        if (mods.pawn?.diagonalAdvance) activeVariants.push('Pawns: Diagonal Advance');
        if (mods.pawn?.forwardCapture) activeVariants.push('Pawns: Forward Capture');
        if (mods.rook?.diagonalStep) activeVariants.push('Rooks: Diagonal Step');
        if (mods.rook?.knightStep) activeVariants.push('Rooks: Knight Hop');
        if (mods.bishop?.orthogonalSlide) activeVariants.push('Bishops: Orthogonal Rays');
        if (mods.bishop?.knightStep) activeVariants.push('Bishops: Knight Hop');
        if (mods.knight?.diagonalStep) activeVariants.push('Knights: Diagonal Step');
        if (mods.knight?.orthogonalStep) activeVariants.push('Knights: Orthogonal Step');
        if (mods.queen?.knightStep) activeVariants.push('Queens: Knight Hop');
        if (mods.queen?.rookOnly) activeVariants.push('Queens: Rook-Only');
        if (mods.queen?.bishopOnly) activeVariants.push('Queens: Bishop-Only');
        if (mods.king?.knightStep) activeVariants.push('Kings: Knight Hop');
        if (mods.king?.doubleStep) activeVariants.push('Kings: Double Step');

        // Check core rules
        if (!config.allowCastling) activeVariants.push('Castling disabled');
        if (!config.allowEnPassant) activeVariants.push('En Passant disabled');

        this.showBriefing(activeVariants);
    }

    renderBoard() {
        const boardElement = document.getElementById('chessboard');
        boardElement.innerHTML = '';

        const rows = this.board.length;
        const cols = this.board[0] ? this.board[0].length : 0;

        boardElement.style.setProperty('--board-rows', rows);
        boardElement.style.setProperty('--board-cols', cols);

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const square = document.createElement('div');
                square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.row = row;
                square.dataset.col = col;

                const piece = this.board[row][col];
                if (piece) {
                    const pieceElement = document.createElement('div');
                    pieceElement.className = `piece piece-${piece.color}`;
                    pieceElement.textContent = piece.getSymbol();
                    pieceElement.draggable = true;
                    square.appendChild(pieceElement);

                    // Add event listeners to both square and piece
                    let isDragging = false;

                    pieceElement.addEventListener('mousedown', () => {
                        isDragging = false;
                    });

                    pieceElement.addEventListener('dragstart', (e) => {
                        isDragging = true;
                        this.handleDragStart(e, row, col);
                    });

                    pieceElement.addEventListener('dragend', (e) => {
                        this.handleDragEnd(e);
                        isDragging = false;
                    });

                    pieceElement.addEventListener('click', (e) => {
                        if (!isDragging) {
                            e.stopPropagation();
                            this.handleSquareClick(row, col);
                        }
                    });

                    // Allow dropping on pieces too (for captures)
                    pieceElement.addEventListener('dragover', (e) => this.handleDragOver(e));
                    pieceElement.addEventListener('drop', (e) => this.handleDrop(e, row, col));
                }

                if (this.selectedSquare && this.selectedSquare.row === row && this.selectedSquare.col === col) {
                    square.classList.add('selected');
                }

                if (this.possibleMoves.some(move => move.row === row && move.col === col)) {
                    square.classList.add('possible-move');
                }

                square.addEventListener('click', () => this.handleSquareClick(row, col));
                square.addEventListener('dragover', (e) => this.handleDragOver(e));
                square.addEventListener('dragenter', (e) => this.handleDragEnter(e, row, col));
                square.addEventListener('dragleave', (e) => this.handleDragLeave(e));
                square.addEventListener('drop', (e) => this.handleDrop(e, row, col));

                boardElement.appendChild(square);
            }
        }
    }

    handleSquareClick(row, col) {
        if (this.gameStatus !== 'active') return;

        const piece = this.board[row][col];

        if (this.selectedSquare) {
            if (this.selectedSquare.row === row && this.selectedSquare.col === col) {
                this.clearSelection();
                return;
            }

            if (this.possibleMoves.some(move => move.row === row && move.col === col)) {
                this.makeMove(this.selectedSquare.row, this.selectedSquare.col, row, col);
                return;
            }

            if (piece && piece.color === this.currentPlayer) {
                this.selectSquare(row, col);
                return;
            }

            this.clearSelection();
        } else if (piece && piece.color === this.currentPlayer) {
            this.selectSquare(row, col);
        }
    }

    selectSquare(row, col) {
        this.selectedSquare = { row, col };
        this.possibleMoves = this.ruleEngine.getValidMoves(this.board, row, col, this.currentPlayer, this.moveHistory);
        this.renderBoard();
    }

    clearSelection() {
        this.selectedSquare = null;
        this.possibleMoves = [];
        this.renderBoard();
    }

    makeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        const capturedPiece = this.board[toRow][toCol];

        this.saveGameState();

        const move = {
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            piece: piece.type,
            captured: capturedPiece ? capturedPiece.type : null,
            castling: false,
            enPassant: false,
            promotion: null
        };

        if (this.ruleEngine.isCastlingMove(this.board, fromRow, fromCol, toRow, toCol)) {
            this.performCastling(fromRow, fromCol, toRow, toCol);
            move.castling = true;
        } else if (this.ruleEngine.isEnPassantMove(this.board, fromRow, fromCol, toRow, toCol, this.moveHistory)) {
            this.performEnPassant(fromRow, fromCol, toRow, toCol);
            move.enPassant = true;
        } else {
            this.board[toRow][toCol] = piece;
            this.board[fromRow][fromCol] = null;
            piece.row = toRow;
            piece.col = toCol;
            piece.hasMoved = true;

            if (capturedPiece) {
                this.capturedPieces[capturedPiece.color].push(capturedPiece);
            }
        }

        const lastRow = this.board.length - 1;
        if (piece.type === 'pawn' && (toRow === 0 || toRow === lastRow)) {
            this.handlePawnPromotion(toRow, toCol, move);
            return;
        }

        this.moveHistory.push(move);
        this.switchPlayer();
        this.clearSelection();
        this.checkGameEnd();
        this.updateGameInfo();
        this.updateMoveHistory();
    }

    performCastling(fromRow, fromCol, toRow, toCol) {
        const king = this.board[fromRow][fromCol];
        const rookCol = toCol > fromCol ? this.board[0].length - 1 : 0;
        const rook = this.board[fromRow][rookCol];
        const newRookCol = toCol > fromCol ? toCol - 1 : toCol + 1;

        this.board[toRow][toCol] = king;
        this.board[fromRow][fromCol] = null;
        this.board[fromRow][newRookCol] = rook;
        this.board[fromRow][rookCol] = null;

        king.row = toRow;
        king.col = toCol;
        king.hasMoved = true;
        rook.row = fromRow;
        rook.col = newRookCol;
        rook.hasMoved = true;
    }

    performEnPassant(fromRow, fromCol, toRow, toCol) {
        const pawn = this.board[fromRow][fromCol];
        const capturedPawn = this.board[fromRow][toCol];

        this.board[toRow][toCol] = pawn;
        this.board[fromRow][fromCol] = null;
        this.board[fromRow][toCol] = null;

        pawn.row = toRow;
        pawn.col = toCol;
        pawn.hasMoved = true;

        this.capturedPieces[capturedPawn.color].push(capturedPawn);
    }

    handlePawnPromotion(row, col, move) {
        const pawn = this.board[row][col];

        if (this.rulesConfig.promotionMode === 'auto-queen') {
            this.board[row][col] = new ChessPiece(pawn.color, 'queen', row, col);
            this.board[row][col].hasMoved = true;

            move.promotion = 'queen';
            this.moveHistory.push(move);

            this.pendingPromotion = null;
            this.switchPlayer();
            this.clearSelection();
            this.checkGameEnd();
            this.updateGameInfo();
            this.updateMoveHistory();
            return;
        }

        const modal = document.getElementById('promotion-modal');
        if (modal) {
            modal.style.display = 'grid';
        }

        this.pendingPromotion = { row, col, move };
    }

    handlePromotion(pieceType) {
        if (!this.pendingPromotion) return;
        const { row, col, move } = this.pendingPromotion;
        const pawn = this.board[row][col];

        this.board[row][col] = new ChessPiece(pawn.color, pieceType, row, col);
        this.board[row][col].hasMoved = true;

        move.promotion = pieceType;
        this.moveHistory.push(move);

        document.getElementById('promotion-modal').style.display = 'none';
        this.pendingPromotion = null;

        this.switchPlayer();
        this.clearSelection();
        this.checkGameEnd();
        this.updateGameInfo();
        this.updateMoveHistory();
    }

    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
    }

    checkGameEnd() {
        const isCheck = this.ruleEngine.isInCheck(this.board, this.currentPlayer);
        const hasValidMoves = this.ruleEngine.hasValidMoves(this.board, this.currentPlayer, this.moveHistory);

        if (isCheck && !hasValidMoves) {
            this.gameStatus = 'checkmate';
        } else if (!isCheck && !hasValidMoves) {
            this.gameStatus = 'stalemate';
        } else if (this.ruleEngine.isInsufficientMaterial(this.board)) {
            this.gameStatus = 'insufficient-material';
        } else if (this.ruleEngine.isThreefoldRepetition(this.gameStates)) {
            this.gameStatus = 'threefold-repetition';
        } else if (this.ruleEngine.isFiftyMoveRule(this.moveHistory)) {
            this.gameStatus = 'fifty-move-rule';
        }
    }

    saveGameState() {
        const state = this.board.map(row =>
            row.map(piece => piece ? `${piece.color}-${piece.type}` : null)
        ).flat().join(',');
        this.gameStates.push(state);
    }

    newGame() {
        this.ruleEngine.updateConfig(this.rulesConfig);
        this.board = this.initializeBoard();
        this.currentPlayer = 'white';
        this.gameStatus = 'active';
        this.moveHistory = [];
        this.selectedSquare = null;
        this.possibleMoves = [];
        this.capturedPieces = { white: [], black: [] };
        this.gameStates = [];
        this.pendingPromotion = null;

        this.renderBoard();
        this.updateGameInfo();
        this.updateMoveHistory();
        this.hideBriefing();
    }

    generateRandomPiece() {
        const pieceNames = [
            'Amazon', 'Chancellor', 'Archbishop', 'Champion', 'Dragon', 'Phoenix',
            'Wizard', 'Sentinel', 'Fortress', 'Vanguard', 'Templar', 'Warden',
            'Titan', 'Oracle', 'Marshal', 'Lancer', 'Griffin', 'Chimera',
            'Sphinx', 'Wraith', 'Crusader', 'Zealot', 'Herald', 'Paladin',
            'Cannon'
        ];

        // Pick a random unused name
        const idx = Math.floor(Math.random() * pieceNames.length);
        const name = pieceNames[idx];
        const type = name.toLowerCase();

        // Special case: Xiangqi Cannon
        if (type === 'cannon') {
            const moveset = {
                slides: [],
                leaps: [],
                jumpCaptures: [
                    {dr:1,dc:0}, {dr:-1,dc:0}, {dr:0,dc:1}, {dr:0,dc:-1}
                ]
            };

            const whiteSymbol = this.getSymbolForType(type, 'white');
            const blackSymbol = this.getSymbolForType(type, 'black');
            const description = `Cannon ${whiteSymbol}/${blackSymbol}: Xiangqi-style (slides + jumps to capture)`;

            return { name, type, moveset, description };
        }

        // 40% chance to have split movement/capture patterns (like pawns)
        const hasSplitPattern = Math.random() < 0.4;

        // Generate completely random moveset
        const moveset = {
            slides: [],
            leaps: []
        };

        const descriptions = [];

        // Randomly decide what types of moves to include
        const includeOrthogonalSlides = Math.random() < 0.4;
        const includeDiagonalSlides = Math.random() < 0.4;
        const includeLeaps = Math.random() < 0.6;

        // Add orthogonal slides
        if (includeOrthogonalSlides) {
            const directions = [
                {dr:1,dc:0}, {dr:-1,dc:0}, {dr:0,dc:1}, {dr:0,dc:-1}
            ];
            // Randomly include some or all orthogonal directions
            const numDirs = 1 + Math.floor(Math.random() * 4);
            const shuffled = directions.sort(() => Math.random() - 0.5);
            const selectedDirs = shuffled.slice(0, numDirs);

            if (hasSplitPattern) {
                // Split into move-only and capture-only
                if (Math.random() < 0.5) {
                    moveset.moveOnlySlides = selectedDirs;
                    descriptions.push('Move-Ortho');
                } else {
                    moveset.captureSlides = selectedDirs;
                    descriptions.push('Capture-Ortho');
                }
            } else {
                moveset.slides = moveset.slides.concat(selectedDirs);
                if (numDirs === 4) {
                    descriptions.push('Orthogonal');
                } else {
                    descriptions.push(`${numDirs}-way Ortho`);
                }
            }
        }

        // Add diagonal slides
        if (includeDiagonalSlides) {
            const directions = [
                {dr:1,dc:1}, {dr:1,dc:-1}, {dr:-1,dc:1}, {dr:-1,dc:-1}
            ];
            // Randomly include some or all diagonal directions
            const numDirs = 1 + Math.floor(Math.random() * 4);
            const shuffled = directions.sort(() => Math.random() - 0.5);
            const selectedDirs = shuffled.slice(0, numDirs);

            if (hasSplitPattern && !moveset.moveOnlySlides && !moveset.captureSlides) {
                // If no slide pattern set yet, this becomes the complementary pattern
                if (Math.random() < 0.5) {
                    moveset.moveOnlySlides = selectedDirs;
                    descriptions.push('Move-Diag');
                } else {
                    moveset.captureSlides = selectedDirs;
                    descriptions.push('Capture-Diag');
                }
            } else if (hasSplitPattern) {
                // Add as complementary pattern
                if (moveset.moveOnlySlides) {
                    moveset.captureSlides = selectedDirs;
                    descriptions.push('Capture-Diag');
                } else if (moveset.captureSlides) {
                    moveset.moveOnlySlides = selectedDirs;
                    descriptions.push('Move-Diag');
                }
            } else {
                moveset.slides = moveset.slides.concat(selectedDirs);
                if (numDirs === 4) {
                    descriptions.push('Diagonal');
                } else {
                    descriptions.push(`${numDirs}-way Diag`);
                }
            }
        }

        // Add random leaps
        if (includeLeaps) {
            const possibleLeaps = [];

            // Generate various leap patterns
            for (let dr = -3; dr <= 3; dr++) {
                for (let dc = -3; dc <= 3; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    if (Math.abs(dr) <= 1 && Math.abs(dc) <= 1) continue; // Skip adjacent squares
                    possibleLeaps.push({dr, dc});
                }
            }

            // Pick 2-6 random leap moves
            const numLeaps = 2 + Math.floor(Math.random() * 5);
            const shuffled = possibleLeaps.sort(() => Math.random() - 0.5);
            const selectedLeaps = shuffled.slice(0, numLeaps);

            // Describe the leap pattern
            const avgDist = Math.sqrt(
                selectedLeaps.reduce((sum, l) => sum + l.dr * l.dr + l.dc * l.dc, 0) / selectedLeaps.length
            );
            let leapDesc = '';
            if (avgDist < 2.5) {
                leapDesc = 'Short Leap';
            } else if (avgDist < 3.5) {
                leapDesc = 'Med Leap';
            } else {
                leapDesc = 'Long Leap';
            }

            if (hasSplitPattern && Math.random() < 0.5) {
                // Make leaps move-only or capture-only
                if (Math.random() < 0.5) {
                    moveset.moveOnlyLeaps = selectedLeaps;
                    descriptions.push(`Move-${leapDesc}`);
                } else {
                    moveset.captureLeaps = selectedLeaps;
                    descriptions.push(`Capture-${leapDesc}`);
                }
            } else {
                moveset.leaps = selectedLeaps;
                descriptions.push(leapDesc);
            }
        }

        // If no moves were added, add at least something
        const hasAnyMoves = moveset.slides?.length > 0 || moveset.leaps?.length > 0 ||
                           moveset.moveOnlySlides?.length > 0 || moveset.moveOnlyLeaps?.length > 0 ||
                           moveset.captureSlides?.length > 0 || moveset.captureLeaps?.length > 0;

        if (!hasAnyMoves) {
            // Add king-like moves
            if (hasSplitPattern) {
                const kingLeaps = [
                    {dr:1,dc:0}, {dr:-1,dc:0}, {dr:0,dc:1}, {dr:0,dc:-1},
                    {dr:1,dc:1}, {dr:1,dc:-1}, {dr:-1,dc:1}, {dr:-1,dc:-1}
                ];
                // Split into orthogonal move and diagonal capture (or vice versa)
                if (Math.random() < 0.5) {
                    moveset.moveOnlyLeaps = [{dr:1,dc:0}, {dr:-1,dc:0}, {dr:0,dc:1}, {dr:0,dc:-1}];
                    moveset.captureLeaps = [{dr:1,dc:1}, {dr:1,dc:-1}, {dr:-1,dc:1}, {dr:-1,dc:-1}];
                    descriptions.push('Move-Ortho + Capture-Diag');
                } else {
                    moveset.captureLeaps = [{dr:1,dc:0}, {dr:-1,dc:0}, {dr:0,dc:1}, {dr:0,dc:-1}];
                    moveset.moveOnlyLeaps = [{dr:1,dc:1}, {dr:1,dc:-1}, {dr:-1,dc:1}, {dr:-1,dc:-1}];
                    descriptions.push('Capture-Ortho + Move-Diag');
                }
            } else {
                moveset.leaps = [
                    {dr:1,dc:0}, {dr:-1,dc:0}, {dr:0,dc:1}, {dr:0,dc:-1},
                    {dr:1,dc:1}, {dr:1,dc:-1}, {dr:-1,dc:1}, {dr:-1,dc:-1}
                ];
                descriptions.push('Adjacent');
            }
        }

        // Randomly limit range for sliding pieces
        let rangeNote = '';
        const hasSlides = (moveset.slides?.length > 0) || (moveset.moveOnlySlides?.length > 0) || (moveset.captureSlides?.length > 0);
        if (hasSlides && Math.random() < 0.4) {
            moveset.maxDistance = 2 + Math.floor(Math.random() * 4);
            rangeNote = ` (≤${moveset.maxDistance})`;
        }

        const moveDesc = descriptions.join(' + ');

        // Get the symbol for this piece type
        const whiteSymbol = this.getSymbolForType(type, 'white');
        const blackSymbol = this.getSymbolForType(type, 'black');

        const description = `${name} ${whiteSymbol}/${blackSymbol}: ${moveDesc}${rangeNote}`;

        return { name, type, moveset, description };
    }

    getSymbolForType(type, color) {
        const symbols = {
            white: {
                amazon: '◈\uFE0E', chancellor: '⬡\uFE0E', archbishop: '✦\uFE0E',
                champion: '◇\uFE0E', dragon: '⬢\uFE0E', phoenix: '✧\uFE0E',
                wizard: '⬟\uFE0E', sentinel: '▣\uFE0E', fortress: '⬒\uFE0E',
                vanguard: '◊\uFE0E', templar: '◈\uFE0E', warden: '⬙\uFE0E',
                titan: '◉\uFE0E', oracle: '◎\uFE0E', marshal: '⬢\uFE0E',
                lancer: '◆\uFE0E', griffin: '⬡\uFE0E', chimera: '⬟\uFE0E',
                sphinx: '◇\uFE0E', wraith: '◊\uFE0E', crusader: '✦\uFE0E',
                zealot: '✧\uFE0E', herald: '◎\uFE0E', paladin: '◉\uFE0E',
                cannon: '⊕\uFE0E'
            },
            black: {
                amazon: '◆\uFE0E', chancellor: '⬢\uFE0E', archbishop: '✶\uFE0E',
                champion: '◆\uFE0E', dragon: '⬣\uFE0E', phoenix: '✦\uFE0E',
                wizard: '⬢\uFE0E', sentinel: '◼\uFE0E', fortress: '⬓\uFE0E',
                vanguard: '◆\uFE0E', templar: '◆\uFE0E', warden: '⬚\uFE0E',
                titan: '●\uFE0E', oracle: '◉\uFE0E', marshal: '⬣\uFE0E',
                lancer: '◆\uFE0E', griffin: '⬢\uFE0E', chimera: '⬢\uFE0E',
                sphinx: '◆\uFE0E', wraith: '◆\uFE0E', crusader: '✶\uFE0E',
                zealot: '✦\uFE0E', herald: '◉\uFE0E', paladin: '●\uFE0E',
                cannon: '⊖\uFE0E'
            }
        };

        return symbols[color][type] || '◇';
    }

    generateRandomRules() {
        const config = createDefaultRulesConfig();
        const modifiers = config.pieceModifiers;
        const activeVariants = [];

        // 50% chance to generate custom pieces
        let customPieces = null;
        if (Math.random() < 0.5) {
            const numPieces = 1 + Math.floor(Math.random() * 2); // 1-2 custom pieces
            customPieces = [];
            for (let i = 0; i < numPieces; i++) {
                const piece = this.generateRandomPiece();
                customPieces.push(piece);
                activeVariants.push(`${piece.description} (replaces bishops)`);
            }
            config.customPieces = customPieces;
        }

        // Randomly pick 1-3 piece modifications
        const numMods = 1 + Math.floor(Math.random() * 3);
        const allModifications = [
            { apply: () => modifiers.pawn.longStride = true, name: 'Pawns: Long Stride' },
            { apply: () => modifiers.pawn.backstep = true, name: 'Pawns: Backstep' },
            { apply: () => modifiers.pawn.sideStep = true, name: 'Pawns: Side-Step' },
            { apply: () => modifiers.pawn.diagonalAdvance = true, name: 'Pawns: Diagonal Advance' },
            { apply: () => modifiers.rook.diagonalStep = true, name: 'Rooks: Diagonal Step' },
            { apply: () => modifiers.rook.knightStep = true, name: 'Rooks: Knight Hop' },
            { apply: () => modifiers.bishop.orthogonalSlide = true, name: 'Bishops: Orthogonal Rays' },
            { apply: () => modifiers.bishop.knightStep = true, name: 'Bishops: Knight Hop' },
            { apply: () => modifiers.knight.diagonalStep = true, name: 'Knights: Diagonal Step' },
            { apply: () => modifiers.knight.orthogonalStep = true, name: 'Knights: Orthogonal Step' },
            { apply: () => modifiers.queen.knightStep = true, name: 'Queens: Knight Hop' },
            { apply: () => modifiers.king.knightStep = true, name: 'Kings: Knight Hop' },
            { apply: () => modifiers.king.doubleStep = true, name: 'Kings: Double Step' }
        ];

        // Shuffle and pick random modifications
        const shuffled = allModifications.sort(() => Math.random() - 0.5);
        for (let i = 0; i < numMods && i < shuffled.length; i++) {
            shuffled[i].apply();
            activeVariants.push(shuffled[i].name);
        }

        // Occasionally change board size (15% chance)
        if (Math.random() < 0.15) {
            const sizes = [6, 10];
            const size = sizes[Math.floor(Math.random() * sizes.length)];
            config.boardSize = { rows: size, cols: size };
            activeVariants.unshift(`Board: ${size}×${size}`);
        }

        return { config, activeVariants };
    }

    newRandomGame() {
        const { config, activeVariants } = this.generateRandomRules();
        this.rulesConfig = config;
        this.newGame();
        this.showBriefing(activeVariants);
    }

    showBriefing(variants) {
        const briefingPanel = document.getElementById('rules-briefing');
        const briefingContent = document.getElementById('briefing-content');

        if (variants.length > 0) {
            const html = '<ul>' + variants.map(v => `<li>${v}</li>`).join('') + '</ul>';
            briefingContent.innerHTML = html;
            briefingPanel.style.display = 'block';
        } else {
            this.hideBriefing();
        }
    }

    hideBriefing() {
        const briefingPanel = document.getElementById('rules-briefing');
        briefingPanel.style.display = 'none';
    }

    undoMove() {
        if (this.moveHistory.length === 0 || this.gameStatus !== 'active') return;

        const lastMove = this.moveHistory.pop();
        this.gameStates.pop();

        if (lastMove.castling) {
            this.undoCastling(lastMove);
        } else if (lastMove.enPassant) {
            this.undoEnPassant(lastMove);
        } else {
            this.undoRegularMove(lastMove);
        }

        this.switchPlayer();
        this.gameStatus = 'active';
        this.clearSelection();
        this.updateGameInfo();
        this.updateMoveHistory();
    }

    undoRegularMove(move) {
        const piece = this.board[move.to.row][move.to.col];

        if (move.promotion) {
            this.board[move.from.row][move.from.col] = new ChessPiece(piece.color, 'pawn', move.from.row, move.from.col);
        } else {
            this.board[move.from.row][move.from.col] = piece;
            piece.row = move.from.row;
            piece.col = move.from.col;
        }

        this.board[move.to.row][move.to.col] = null;

        if (move.captured) {
            const capturedPieces = this.capturedPieces[this.currentPlayer === 'white' ? 'black' : 'white'];
            const capturedPiece = capturedPieces.pop();
            this.board[move.to.row][move.to.col] = capturedPiece;
        }
    }

    undoCastling(move) {
        const king = this.board[move.to.row][move.to.col];
        const rookCol = move.to.col > move.from.col ? move.to.col - 1 : move.to.col + 1;
        const rook = this.board[move.to.row][rookCol];
        const originalRookCol = move.to.col > move.from.col ? this.board[0].length - 1 : 0;

        this.board[move.from.row][move.from.col] = king;
        this.board[move.to.row][move.to.col] = null;
        this.board[move.to.row][originalRookCol] = rook;
        this.board[move.to.row][rookCol] = null;

        king.row = move.from.row;
        king.col = move.from.col;
        rook.row = move.to.row;
        rook.col = originalRookCol;
    }

    undoEnPassant(move) {
        const pawn = this.board[move.to.row][move.to.col];
        const capturedPawn = this.capturedPieces[this.currentPlayer === 'white' ? 'black' : 'white'].pop();

        this.board[move.from.row][move.from.col] = pawn;
        this.board[move.to.row][move.to.col] = null;
        this.board[move.from.row][move.to.col] = capturedPawn;

        pawn.row = move.from.row;
        pawn.col = move.from.col;
    }

    updateGameInfo() {
        const playerElement = document.getElementById('current-player');
        const statusElement = document.getElementById('game-status');
        const statusCard = document.getElementById('status-card');
        const playerTags = document.getElementById('player-tags');

        playerElement.textContent = `${this.currentPlayer.charAt(0).toUpperCase() + this.currentPlayer.slice(1)}'s Turn`;

        if (statusCard) {
            statusCard.setAttribute('data-player', this.currentPlayer);
        }

        if (playerTags) {
            playerTags.setAttribute('data-player', this.currentPlayer);
        }

        let statusText = '';
        if (this.gameStatus === 'checkmate') {
            statusText = `Checkmate! ${this.currentPlayer === 'white' ? 'Black' : 'White'} wins!`;
        } else if (this.gameStatus === 'stalemate') {
            statusText = 'Stalemate! Draw.';
        } else if (this.gameStatus === 'insufficient-material') {
            statusText = 'Insufficient material! Draw.';
        } else if (this.gameStatus === 'threefold-repetition') {
            statusText = 'Threefold repetition! Draw.';
        } else if (this.gameStatus === 'fifty-move-rule') {
            statusText = 'Fifty-move rule! Draw.';
        } else if (this.ruleEngine.isInCheck(this.board, this.currentPlayer)) {
            statusText = 'Check!';
        }

        statusElement.textContent = statusText;
        statusElement.classList.toggle('is-active', Boolean(statusText));
    }

    updateMoveHistory() {
        const movesElement = document.getElementById('moves-list');
        movesElement.innerHTML = '';

        for (let i = 0; i < this.moveHistory.length; i += 2) {
            const moveNumber = Math.floor(i / 2) + 1;
            const whiteMove = this.moveHistory[i];
            const blackMove = this.moveHistory[i + 1];

            const moveElement = document.createElement('div');
            moveElement.className = 'move-pair';

            let moveText = `${moveNumber}. ${this.formatMove(whiteMove)}`;
            if (blackMove) {
                moveText += ` ${this.formatMove(blackMove)}`;
            }

            moveElement.textContent = moveText;
            movesElement.appendChild(moveElement);
        }
    }

    formatMove(move) {
        if (move.castling) {
            return move.to.col > move.from.col ? 'O-O' : 'O-O-O';
        }

        let notation = '';
        if (move.piece !== 'pawn') {
            notation += move.piece.charAt(0).toUpperCase();
        }

        const boardRows = this.board.length;
        const fromSquare = String.fromCharCode(97 + move.from.col) + (boardRows - move.from.row);
        const toSquare = String.fromCharCode(97 + move.to.col) + (boardRows - move.to.row);

        if (move.captured || move.enPassant) {
            if (move.piece === 'pawn') {
                notation += fromSquare.charAt(0);
            }
            notation += 'x';
        }

        notation += toSquare;

        if (move.promotion) {
            notation += '=' + move.promotion.charAt(0).toUpperCase();
        }

        if (move.enPassant) {
            notation += ' e.p.';
        }

        return notation;
    }

    handleDragStart(e, row, col) {
        const piece = this.board[row][col];
        if (piece && piece.color === this.currentPlayer) {
            // Set up selection state WITHOUT rendering
            this.selectedSquare = { row, col };
            this.possibleMoves = this.ruleEngine.getValidMoves(this.board, row, col, this.currentPlayer, this.moveHistory);

            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', `${row},${col}`);
            e.dataTransfer.setDragImage(e.target, e.target.offsetWidth / 2, e.target.offsetHeight / 2);
            // Add dragging class to prevent pointer events
            setTimeout(() => {
                e.target.classList.add('dragging');
            }, 0);
        } else {
            e.preventDefault();
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    handleDragEnter(e, row, col) {
        if (this.possibleMoves.some(move => move.row === row && move.col === col)) {
            e.currentTarget.classList.add('drag-over');
        }
    }

    handleDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    }

    handleDrop(e, row, col) {
        e.preventDefault();
        e.stopPropagation();

        // Remove drag-over class
        e.currentTarget.classList.remove('drag-over');

        const data = e.dataTransfer.getData('text/plain');
        if (!data) return false;

        const [fromRow, fromCol] = data.split(',').map(Number);

        if (this.possibleMoves.some(move => move.row === row && move.col === col)) {
            this.makeMove(fromRow, fromCol, row, col);
        } else {
            this.clearSelection();
        }

        return false;
    }

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        // Re-render to show selection state if piece wasn't dropped
        if (this.selectedSquare) {
            this.renderBoard();
        }
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.game = new ChessGame();
});
