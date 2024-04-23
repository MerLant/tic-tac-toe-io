import { WebSocket, WebSocketServer } from "ws";

interface Player {
  ws: WebSocket;
  playerID: string;
}

interface Game {
  player1: Player;
  player2: Player;
  board: ("X" | "O" | null)[][];
  currentPlayer: Player;
}

let waitingPlayers: Player[] = [];
let activeGames: Game[] = [];

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", function connection(ws: WebSocket) {
  ws.on("message", function incoming(message: string) {
    const { type, playerID, x, y } = JSON.parse(message) as {
      type: string;
      playerID: string;
      x: number;
      y: number;
    };

    if (type === "search_game") {
      handleGameSearch(ws, playerID);
    } else if (type === "make_move") {
      handleMove(ws, playerID, x, y);
    }
  });

  ws.on("close", () => {
    waitingPlayers = waitingPlayers.filter((player) => player.ws !== ws);
    const game = activeGames.find(
      (g) => g.player1.ws === ws || g.player2.ws === ws,
    );
    if (game) {
      const otherPlayer =
        game.player1.ws === ws ? game.player2.ws : game.player1.ws;
      otherPlayer.send(
        JSON.stringify({ type: "game_end", winner: "opponent_disconnected" }),
      );
      activeGames = activeGames.filter((g) => g !== game);
    }
  });
});

function handleMove(
  ws: WebSocket,
  playerID: string,

  x: number,
  y: number,
): void {
  const game: Game | undefined = findGameByWebSocket(ws);

  if (!isValidMove(game, ws, x, y)) {
    sendError(ws, "Invalid move");
    return;
  }

  const mark: "X" | "O" = getMarkForPlayer(game!, ws);
  updateBoard(game!, x, y, mark);
  processGameAfterMove(game!, playerID, mark);
}

function findGameByWebSocket(ws: WebSocket): Game | undefined {
  return activeGames.find((g) => g.player1.ws === ws || g.player2.ws === ws);
}

function isValidMove(
  game: Game | undefined,
  ws: WebSocket,
  x: number,
  y: number,
): boolean {
  if (!game) {
    return false;
  }

  const boardSize = game.board.length;
  if (x < 0 || x >= boardSize || y < 0 || y >= boardSize) {
    return false;
  }

  if (game.board[x][y] !== null) {
    return false;
  }

  if (game.currentPlayer.ws !== ws) {
    return false;
  }

  return true;
}

function sendError(ws: WebSocket, message: string): void {
  ws.send(JSON.stringify({ type: "error", message }));
}

function getMarkForPlayer(game: Game, ws: WebSocket): "X" | "O" {
  return game.player1.ws === ws ? "X" : "O";
}

function updateBoard(game: Game, x: number, y: number, mark: "X" | "O"): void {
  game.board[x][y] = mark;
  broadcastGameState(game);
}

function broadcastGameState(game: Game): void {
  const message = JSON.stringify({
    type: "update_board",
    board: game.board,
    currentPlayer: game.currentPlayer.playerID,
  });
  game.player1.ws.send(message);
  game.player2.ws.send(message);
}

function processGameAfterMove(
  game: Game,
  playerID: string,
  mark: "X" | "O",
): void {
  if (checkWin(game.board, mark)) {
    concludeGame(game, game.currentPlayer.playerID);
  } else if (checkDraw(game.board)) {
    concludeGame(game, "draw");
  } else {
    switchCurrentPlayer(game);
    broadcastGameState(game);
  }
}

function checkDraw(board: ("X" | "O" | null)[][]): boolean {
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (board[i][j] === null) {
        return false;
      }
    }
  }

  return true;
}

function concludeGame(game: Game, winnerID: string): void {
  game.player1.ws.send(
    JSON.stringify({
      type: "game_end",
      winner: winnerID,
    }),
  );
  game.player2.ws.send(
    JSON.stringify({
      type: "game_end",
      winner: winnerID,
    }),
  );
  activeGames = activeGames.filter((g) => g !== game);
}

function switchCurrentPlayer(game: Game): void {
  if (game.currentPlayer.playerID === game.player1.playerID) {
    game.currentPlayer = game.player2;
  } else {
    game.currentPlayer = game.player1;
  }
}

function checkWin(board: ("X" | "O" | null)[][], mark: "X" | "O"): boolean {
  for (let i = 0; i < 3; i++) {
    if (
      (board[i][0] === mark && board[i][1] === mark && board[i][2] === mark) ||
      (board[0][i] === mark && board[1][i] === mark && board[2][i] === mark)
    ) {
      return true;
    }
  }

  if (
    (board[0][0] === mark && board[1][1] === mark && board[2][2] === mark) ||
    (board[0][2] === mark && board[1][1] === mark && board[2][0] === mark)
  ) {
    return true;
  }

  return false;
}

function handleGameSearch(ws: WebSocket, playerID: string) {
  const opponentIndex = waitingPlayers.findIndex(
    (player) => player.playerID !== playerID,
  );

  if (opponentIndex !== -1) {
    const opponent = waitingPlayers[opponentIndex];
    startGame(ws, opponent.ws, playerID, opponent.playerID);
    waitingPlayers.splice(opponentIndex, 1);
  } else {
    waitingPlayers.push({ ws, playerID });
  }
}

function startGame(
  ws1: WebSocket,
  ws2: WebSocket,
  playerID1: string,
  playerID2: string,
): void {
  const newGame: Game = {
    player1: { ws: ws1, playerID: playerID1 },
    player2: { ws: ws2, playerID: playerID2 },
    board: Array(3)
      .fill(null)
      .map(() => Array(3).fill(null)),
    currentPlayer: {
      ws: ws1,
      playerID: playerID1,
    } as Player,
  };

  const gameInfo = {
    type: "start_game",
    players: [playerID1, playerID2],
  };

  ws1.send(JSON.stringify(gameInfo));
  ws2.send(JSON.stringify(gameInfo));
  activeGames.push(newGame);
}

console.log("WebSocket server is running on ws://localhost:8080");
