console.log('Debug chess.js starting...');

class ChessPiece {
    constructor(color, type, row, col) {
        this.color = color;
        this.type = type;
        this.row = row;
        this.col = col;
        this.hasMoved = false;
    }

    getSymbol() {
        const symbols = {
            white: {
                king: '♔', queen: '♕', rook: '♖',
                bishop: '♗', knight: '♘', pawn: '♙'
            },
            black: {
                king: '♚', queen: '♛', rook: '♜',
                bishop: '♝', knight: '♞', pawn: '♟'
            }
        };
        return symbols[this.color][this.type];
    }
}

console.log('ChessPiece class defined');

class ChessRuleEngine {
    getValidMoves(board, row, col, currentPlayer, moveHistory) {
        console.log('Getting valid moves for', row, col);
        const piece = board[row][col];
        if (!piece || piece.color !== currentPlayer) return [];

        const moves = this.getPossibleMoves(board, row, col, moveHistory);
        console.log('Possible moves:', moves);
        return moves.filter(move => !this.wouldBeInCheck(board, row, col, move.row, move.col, currentPlayer));
    }

    getPossibleMoves(board, row, col, moveHistory) {
        const piece = board[row][col];
        console.log('Getting moves for piece:', piece.type, piece.color);

        switch (piece.type) {
            case 'pawn': return this.getPawnMoves(board, row, col, moveHistory);
            case 'rook': return this.getRookMoves(board, row, col);
            case 'knight': return this.getKnightMoves(board, row, col);
            case 'bishop': return this.getBishopMoves(board, row, col);
            case 'queen': return this.getQueenMoves(board, row, col);
            case 'king': return this.getKingMoves(board, row, col, moveHistory);
            default: return [];
        }
    }

    getPawnMoves(board, row, col, moveHistory) {
        const piece = board[row][col];
        const moves = [];
        const direction = piece.color === 'white' ? -1 : 1;
        const startRow = piece.color === 'white' ? 6 : 1;

        if (this.isValidSquare(row + direction, col) && !board[row + direction][col]) {
            moves.push({ row: row + direction, col });
            if (row === startRow && !board[row + 2 * direction][col]) {
                moves.push({ row: row + 2 * direction, col });
            }
        }

        for (const deltaCol of [-1, 1]) {
            const newRow = row + direction;
            const newCol = col + deltaCol;
            if (this.isValidSquare(newRow, newCol)) {
                const target = board[newRow][newCol];
                if (target && target.color !== piece.color) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }

        return moves;
    }

    getRookMoves(board, row, col) {
        const moves = [];
        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

        for (const [dRow, dCol] of directions) {
            for (let i = 1; i < 8; i++) {
                const newRow = row + dRow * i;
                const newCol = col + dCol * i;
                if (!this.isValidSquare(newRow, newCol)) break;

                const target = board[newRow][newCol];
                if (!target) {
                    moves.push({ row: newRow, col: newCol });
                } else {
                    if (target.color !== board[row][col].color) {
                        moves.push({ row: newRow, col: newCol });
                    }
                    break;
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

        for (const [dRow, dCol] of knightMoves) {
            const newRow = row + dRow;
            const newCol = col + dCol;
            if (this.isValidSquare(newRow, newCol)) {
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

        for (const [dRow, dCol] of directions) {
            for (let i = 1; i < 8; i++) {
                const newRow = row + dRow * i;
                const newCol = col + dCol * i;
                if (!this.isValidSquare(newRow, newCol)) break;

                const target = board[newRow][newCol];
                if (!target) {
                    moves.push({ row: newRow, col: newCol });
                } else {
                    if (target.color !== board[row][col].color) {
                        moves.push({ row: newRow, col: newCol });
                    }
                    break;
                }
            }
        }
        return moves;
    }

    getQueenMoves(board, row, col) {
        return [...this.getRookMoves(board, row, col), ...this.getBishopMoves(board, row, col)];
    }

    getKingMoves(board, row, col, moveHistory) {
        const moves = [];
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];

        for (const [dRow, dCol] of directions) {
            const newRow = row + dRow;
            const newCol = col + dCol;
            if (this.isValidSquare(newRow, newCol)) {
                const target = board[newRow][newCol];
                if (!target || target.color !== board[row][col].color) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }
        return moves;
    }

    isValidSquare(row, col) {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    wouldBeInCheck(board, fromRow, fromCol, toRow, toCol, color) {
        return false; // Simplified for debugging
    }
}

console.log('ChessRuleEngine class defined');

class ChessGame {
    constructor() {
        console.log('ChessGame constructor starting...');
        this.board = this.initializeBoard();
        this.currentPlayer = 'white';
        this.gameStatus = 'active';
        this.moveHistory = [];
        this.selectedSquare = null;
        this.possibleMoves = [];
        this.capturedPieces = { white: [], black: [] };
        this.gameStates = [];
        this.ruleEngine = new ChessRuleEngine();

        console.log('Initializing DOM...');
        this.initializeDOM();
        console.log('Rendering board...');
        this.renderBoard();
        console.log('Updating game info...');
        this.updateGameInfo();
        console.log('ChessGame constructor complete');
    }

    initializeBoard() {
        console.log('Initializing board...');
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        const pieceOrder = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

        for (let col = 0; col < 8; col++) {
            board[0][col] = new ChessPiece('black', pieceOrder[col], 0, col);
            board[1][col] = new ChessPiece('black', 'pawn', 1, col);
            board[6][col] = new ChessPiece('white', 'pawn', 6, col);
            board[7][col] = new ChessPiece('white', pieceOrder[col], 7, col);
        }

        console.log('Board initialized:', board);
        return board;
    }

    initializeDOM() {
        console.log('Setting up DOM event listeners...');
        const newGameBtn = document.getElementById('new-game');
        const undoBtn = document.getElementById('undo-move');

        if (newGameBtn) {
            newGameBtn.addEventListener('click', () => this.newGame());
            console.log('New game button listener added');
        } else {
            console.error('New game button not found!');
        }

        if (undoBtn) {
            undoBtn.addEventListener('click', () => this.undoMove());
            console.log('Undo button listener added');
        } else {
            console.error('Undo button not found!');
        }

        document.querySelectorAll('.promotion-piece').forEach(piece => {
            piece.addEventListener('click', (e) => this.handlePromotion(e.target.dataset.piece));
        });
        console.log('DOM initialization complete');
    }

    renderBoard() {
        console.log('Rendering board...');
        const boardElement = document.getElementById('chessboard');
        if (!boardElement) {
            console.error('Chessboard element not found!');
            return;
        }

        boardElement.innerHTML = '';

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;

                const piece = this.board[row][col];
                if (piece) {
                    square.textContent = piece.getSymbol();
                }

                if (this.selectedSquare && this.selectedSquare.row === row && this.selectedSquare.col === col) {
                    square.classList.add('selected');
                }

                if (this.possibleMoves.some(move => move.row === row && move.col === col)) {
                    square.classList.add('possible-move');
                }

                square.addEventListener('click', () => {
                    console.log('Square clicked:', row, col);
                    this.handleSquareClick(row, col);
                });

                boardElement.appendChild(square);
            }
        }
        console.log('Board rendering complete');
    }

    handleSquareClick(row, col) {
        console.log('handleSquareClick called with:', row, col);
        const piece = this.board[row][col];
        console.log('Piece at clicked square:', piece);

        if (piece && piece.color === this.currentPlayer) {
            console.log('Selecting piece:', piece.type, piece.color);
            this.selectedSquare = { row, col };
            this.possibleMoves = this.ruleEngine.getValidMoves(this.board, row, col, this.currentPlayer, this.moveHistory);
            console.log('Selected square:', this.selectedSquare);
            console.log('Possible moves:', this.possibleMoves);
            this.renderBoard();
        } else {
            console.log('Cannot select this square');
        }
    }

    updateGameInfo() {
        console.log('Updating game info...');
        const playerElement = document.getElementById('current-player');
        if (playerElement) {
            playerElement.textContent = `${this.currentPlayer.charAt(0).toUpperCase() + this.currentPlayer.slice(1)}'s Turn`;
        }
    }

    newGame() {
        console.log('Starting new game...');
        this.board = this.initializeBoard();
        this.currentPlayer = 'white';
        this.selectedSquare = null;
        this.possibleMoves = [];
        this.renderBoard();
        this.updateGameInfo();
    }

    undoMove() {
        console.log('Undo move called');
    }

    handlePromotion() {
        console.log('Handle promotion called');
    }
}

console.log('All classes defined, setting up initialization...');

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, creating game...');
    try {
        window.game = new ChessGame();
        console.log('Game created successfully!');
    } catch (error) {
        console.error('Error creating game:', error);
    }
});

console.log('Debug chess.js loaded completely');