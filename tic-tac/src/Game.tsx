import React, { useState, useEffect, useCallback } from "react";

interface BoardSquare {
  value: "X" | "O" | null;
}

interface GameProps {}

const Game: React.FC<GameProps> = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [players, setPlayers] = useState<string[]>([]);
  const [board, setBoard] = useState<("X" | "O" | null)[][]>(
    Array(3)
      .fill(null)
      .map(() => Array(3).fill(null)),
  );
  const [currentPlayer, setCurrentPlayer] = useState<string>("");

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080");
    setSocket(ws);

    ws.onopen = () => {
      const playerID = Math.floor(Math.random() * 10000).toString();
      setCurrentPlayer(playerID);
      console.log("Connected to server. Player ID:", playerID);
      ws.send(JSON.stringify({ type: "search_game", playerID }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case "start_game":
          setGameStarted(true);
          setPlayers(message.players);
          break;
        case "update_board":
          setBoard(message.board);
          setCurrentPlayer(message.currentPlayer);
          break;
        case "game_end":
          alert(`Game Over! Winner: ${message.winner}`);
          ws.close();
          break;
        default:
          console.log(message.type);
          console.log("Unknown message type.");
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const makeMove = useCallback(
    (x: number, y: number) => {
      if (socket && board[x][y] === null) {
        console.log("sending move");
        console.log("make_move", currentPlayer, x, y);
        socket.send(
          JSON.stringify({ type: "make_move", playerID: currentPlayer, x, y }),
        );
      }
    },
    [socket, board, currentPlayer],
  );

  return (
    <div>
      <h1>Tic-Tac-Toe Game</h1>
      {gameStarted ? (
        <>
          <p>Game started! Players: {players.join(" and ")}</p>
          <p>{`Current player: ${currentPlayer}`}</p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 100px)",
              gap: "10px",
            }}
          >
            {board.map((row, i) =>
              row.map((cell, j) => (
                <div
                  key={`${i}-${j}`}
                  style={{
                    width: "100px",
                    height: "100px",
                    backgroundColor: "lightgray",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "24px",
                    cursor:
                      currentPlayer === players[0] && cell === null
                        ? "pointer"
                        : "not-allowed",
                  }}
                  onClick={() => makeMove(i, j)}
                >
                  {cell}
                </div>
              )),
            )}
          </div>
        </>
      ) : (
        <p>Searching for a game...</p>
      )}
    </div>
  );
};

export default Game;
