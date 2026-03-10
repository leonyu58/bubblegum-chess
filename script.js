// Game state (model)
let board = [];
let selectedPiece = null;
let currentTurn = 'white';
let gameActive = true;
let statusElement;
let resetBtn;

// Piece unicode
const pieces = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

const pieceTypes = {
  'K': 'king', 'k': 'king', 'Q': 'queen', 'q': 'queen', 'R': 'rook', 'r': 'rook',
  'B': 'bishop', 'b': 'bishop', 'N': 'knight', 'n': 'knight', 'P': 'pawn', 'p': 'pawn'
};

// Init board
function initBoard() {
  board = [
    ['r','n','b','q','k','b','n','r'],
    ['p','p','p','p','p','p','p','p'],
    [' ',' ',' ',' ',' ',' ',' ',' '],
    [' ',' ',' ',' ',' ',' ',' ',' '],
    [' ',' ',' ',' ',' ',' ',' ',' '],
    [' ',' ',' ',' ',' ',' ',' ',' '],
    ['P','P','P','P','P','P','P','P'],
    ['R','N','B','Q','K','B','N','R']
  ];
}

// Deep copy board
function deepCopyBoard(bs = board) {
  return bs.map(row => [...row]);
}

// Find king position
function findKing(bs = board, color) {
  const kingSym = color === 'white' ? 'K' : 'k';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (bs[r][c] === kingSym) return { row: r, col: c };
    }
  }
  return null;
}

// Pseudo-legal move (shape + path + no own capture)
function isPseudoLegalMove(fr, fc, tr, tc, bs = board) {
  const piece = bs[fr][fc];
  if (piece === ' ') return false;

  const type = pieceTypes[piece];
  const color = piece === piece.toUpperCase() ? 'white' : 'black';
  const target = bs[tr][tc];
  const targetColor = target === ' ' ? null : (target === target.toUpperCase() ? 'white' : 'black');

  if (fr === tr && fc === tc || targetColor === color) return false;

  const dr = tr - fr;
  const dc = tc - fc;

  switch (type) {
    case 'pawn':
      const dir = color === 'white' ? -1 : 1;
      const startRow = color === 'white' ? 6 : 1;
      if (dc === 0 && target === ' ') { // forward
        if (dr === dir) return true;
        if (dr === dir * 2 && fr === startRow && bs[fr + dir][fc] === ' ') return true;
      } else if (Math.abs(dc) === 1 && dr === dir && target !== ' ') {
        return true;
      }
      return false;

    case 'rook':
      if (dr !== 0 && dc !== 0) return false;
      return isPathClear(fr, fc, tr, tc, bs);

    case 'bishop':
      if (Math.abs(dr) !== Math.abs(dc)) return false;
      return isPathClear(fr, fc, tr, tc, bs);

    case 'queen':
      if (!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) return false;
      return isPathClear(fr, fc, tr, tc, bs);

    case 'king':
      return Math.abs(dr) <= 1 && Math.abs(dc) <= 1;

    case 'knight':
      return (Math.abs(dr) === 2 && Math.abs(dc) === 1) || (Math.abs(dr) === 1 && Math.abs(dc) === 2);

    default:
      return false;
  }
}

// Path clear for sliders
function isPathClear(fr, fc, tr, tc, bs = board) {
  const dr = Math.sign(tr - fr);
  const dc = Math.sign(tc - fc);
  let r = fr + dr;
  let c = fc + dc;
  while (r !== tr || c !== tc) {
    if (bs[r][c] !== ' ') return false;
    r += dr;
    c += dc;
  }
  return true;
}

// Full legal move 
function isLegalMove(fr, fc, tr, tc, bs = board) {
  if (!isPseudoLegalMove(fr, fc, tr, tc, bs)) return false;

  const temp = deepCopyBoard(bs);
  const captured = temp[tr][tc];
  temp[tr][tc] = temp[fr][fc];
  temp[fr][fc] = ' ';

  // Auto-promote pawn
  const movedPiece = temp[tr][tc];
  const color = movedPiece === movedPiece.toUpperCase() ? 'white' : 'black';
  if (movedPiece.toUpperCase() === 'P' &&
      ((color === 'white' && tr === 0) || (color === 'black' && tr === 7))) {
    temp[tr][tc] = color === 'white' ? 'Q' : 'q';
  }

  return !isInCheck(temp, color);
}

// Is in check?
function isInCheck(bs = board, color) {
  const kingPos = findKing(bs, color);
  if (!kingPos) return false;

  const oppColor = color === 'white' ? 'black' : 'white';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = bs[r][c];
      if (p !== ' ' && (p === p.toUpperCase() ? 'white' : 'black') === oppColor) {
        if (isPseudoLegalMove(r, c, kingPos.row, kingPos.col, bs)) {
          return true;
        }
      }
    }
  }
  return false;
}

// Has any legal move? 
function hasLegalMoves(color, bs = board) {
  for (let fr = 0; fr < 8; fr++) {
    for (let fc = 0; fc < 8; fc++) {
      const p = bs[fr][fc];
      if (p === ' ') continue;
      const pieceColor = p === p.toUpperCase() ? 'white' : 'black';
      if (pieceColor !== color) continue;

      // Only check king escapes first when in check — fastest path for checkmate
      if (isInCheck(bs, color)) {
        if (pieceTypes[p] === 'king') {
          for (let tr = Math.max(0, fr-1); tr <= Math.min(7, fr+1); tr++) {
            for (let tc = Math.max(0, fc-1); tc <= Math.min(7, fc+1); tc++) {
              if (tr === fr && tc === fc) continue;
              if (isLegalMove(fr, fc, tr, tc, bs)) return true;
            }
          }
        }
      }

      // Then check captures / blocks with other pieces
      for (let tr = 0; tr < 8; tr++) {
        for (let tc = 0; tc < 8; tc++) {
          if (isLegalMove(fr, fc, tr, tc, bs)) {
            return true;  // ← EARLY EXIT
          }
        }
      }
    }
  }
  return false;
}


// Render board
function renderBoard() {
  const boardEl = document.getElementById('board');
  const overlayEl = document.getElementById('overlay');  // Save overlay ref

  boardEl.innerHTML = '';  // Clear squares

  // Build & append all 64 squares
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = document.createElement('div');
      square.classList.add('square');
      square.dataset.row = row;
      square.dataset.col = col;

      const isLight = (row + col) % 2 === 0;
      square.classList.add(isLight ? 'light' : 'dark');

      const pieceCode = board[row][col];
      if (pieceCode !== ' ') {
        const pieceEl = document.createElement('div');
        pieceEl.classList.add('piece');
        pieceEl.classList.add(pieceCode === pieceCode.toUpperCase() ? 'white' : 'black');
        pieceEl.innerHTML = pieces[pieceCode];
        pieceEl.draggable = gameActive;
        pieceEl.addEventListener('dragstart', handleDragStart);
        pieceEl.addEventListener('dragend', handleDragEnd);
        square.appendChild(pieceEl);
      }

      boardEl.appendChild(square);
    }
  }

  // Append overlay 
  boardEl.appendChild(overlayEl);

  addEventListeners();
}

// Event handlers
function handleDragStart(e) {
  if (!gameActive) {
    e.preventDefault();
    return;
  }
  const square = e.target.parentElement;
  const row = parseInt(square.dataset.row);
  const col = parseInt(square.dataset.col);
  const pieceCode = board[row][col];

  const color = pieceCode === pieceCode.toUpperCase() ? 'white' : 'black';
  if (color !== currentTurn) {
    e.preventDefault();
    return;
  }

  e.dataTransfer.setData('text/plain', `${row},${col}`);
  highlightValidMoves(row, col);
}

function handleDragEnd(e) {
  clearHighlights();
}

function handleDrop(e) {
  if (!gameActive) return;
  e.preventDefault();
  const data = e.dataTransfer.getData('text/plain');
  if (!data) return;

  const [fromRow, fromCol] = data.split(',').map(Number);
  const toRow = parseInt(e.currentTarget.dataset.row);
  const toCol = parseInt(e.currentTarget.dataset.col);

  if (isLegalMove(fromRow, fromCol, toRow, toCol)) {
    performMove(fromRow, fromCol, toRow, toCol);
  }
}

function handleClick(e) {
  if (!gameActive) return;

  const square = e.currentTarget;
  const row = parseInt(square.dataset.row);
  const col = parseInt(square.dataset.col);
  const pieceCode = board[row][col];

  if (selectedPiece) {
    if (isLegalMove(selectedPiece.row, selectedPiece.col, row, col)) {
      performMove(selectedPiece.row, selectedPiece.col, row, col);
      selectedPiece = null;
    } else {
      selectedPiece = null;
      clearHighlights();
    }
  } else if (pieceCode !== ' ' && 
             ((currentTurn === 'white' && pieceCode === pieceCode.toUpperCase()) ||
              (currentTurn === 'black' && pieceCode === pieceCode.toLowerCase()))) {
    selectedPiece = { row, col };
    highlightSquare(row, col, 'selected');
    highlightValidMoves(row, col);
  }
}

function performMove(fr, fc, tr, tc) {
  // Move
  const captured = board[tr][tc];
  board[tr][tc] = board[fr][fc];
  board[fr][fc] = ' ';

  // Capture anim
  if (captured !== ' ') {
    const targetSquare = document.querySelector(`[data-row="${tr}"][data-col="${tc}"]`);
    if (targetSquare) {
      targetSquare.classList.add('capture');
      setTimeout(() => targetSquare.classList.remove('capture'), 600);
    }
  }

  // Auto-promote
  const movedPiece = board[tr][tc];
  const color = movedPiece === movedPiece.toUpperCase() ? 'white' : 'black';
  if (movedPiece.toUpperCase() === 'P' &&
      ((color === 'white' && tr === 0) || (color === 'black' && tr === 7))) {
    board[tr][tc] = color === 'white' ? 'Q' : 'q';
  }

  // Switch turn
  const prevTurn = currentTurn;
  currentTurn = prevTurn === 'white' ? 'black' : 'white';

  // Re-render FIRST
  renderBoard();
  clearHighlights();

  // NOW check game state
  const inCheck = isInCheck(board, currentTurn);

  if (findKing(board, currentTurn) === null) {
    gameOver("KING CAPTURED! ♚♔", `${prevTurn.toUpperCase()} WINS!`);
    return;  
  }

  const noMoves = !hasLegalMoves(currentTurn);  // compute once

  if (noMoves) {
    if (inCheck) {
      gameOver("CHECKMATE! 🎀", `${prevTurn.toUpperCase()} WINS BY CHECKMATE!`);
    } else {
      gameOver("STALEMATE 💕", "It's a draw cutie~");
    }
    return;
  }

  updateStatus(inCheck);
}

// Highlights
function highlightSquare(r, c, className) {
  document.querySelectorAll('.square').forEach(sq => {
    if (parseInt(sq.dataset.row) === r && parseInt(sq.dataset.col) === c) {
      sq.classList.add(className);
    }
  });
}

function clearHighlights() {
  document.querySelectorAll('.square').forEach(sq => {
    sq.classList.remove('highlight', 'selected');
  });
}

function highlightValidMoves(row, col) {
  clearHighlights();
  highlightSquare(row, col, 'selected');
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (isLegalMove(row, col, r, c)) {
        highlightSquare(r, c, 'highlight');
      }
    }
  }
}

function updateStatus(isCheck = false) {
  const turnPiece = currentTurn === 'white' ? '♔' : '♚';
  let msg = `${currentTurn.charAt(0).toUpperCase() + currentTurn.slice(1)}'s turn! ${turnPiece} Make your move cutie~ 💕`;
  if (isCheck) {
    msg += ` <span style="color: #ff4500; font-size: 1.4em; font-weight: bold;"> CHECK! ⚠️</span>`;
  }
  statusElement.innerHTML = msg;
}

function gameOver(title, msg) {
  gameActive = false;

  const overlay = document.getElementById('overlay');
  document.getElementById('gameOverTitle').textContent = title;
  document.getElementById('gameOverMsg').innerHTML = `${msg}<br><span style="font-size:1.4rem;opacity:0.9;">Press "♡ New Game 💕" to play again!</span>`;
  overlay.classList.add('show');


  // Backup status
  statusElement.innerHTML = `<span style="color:#ff1493;font-size:2rem;">${msg}</span>`;
  statusElement.classList.add('game-over');
}

function resetGame() {
  gameActive = true;

  // Hide overlay
  const overlay = document.getElementById('overlay');
  overlay.classList.remove('show');

  statusElement.classList.remove('game-over');

  initBoard();
  currentTurn = 'white';
  selectedPiece = null;
  renderBoard();
  updateStatus(false);
}

function addEventListeners() {
  document.querySelectorAll('.square').forEach(square => {
    square.addEventListener('click', handleClick);
    square.addEventListener('dragover', e => e.preventDefault());
    square.addEventListener('drop', handleDrop);
  });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  statusElement = document.getElementById('status');
  resetBtn = document.getElementById('resetBtn');
  resetBtn.addEventListener('click', resetGame);
  initBoard();
  renderBoard();
  updateStatus(false);
});