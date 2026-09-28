interface Props {
  matrix: (number | null)[][];
  drawnNumbers: number[];
  isWinner: boolean;
}

export default function TicketCard({ matrix, drawnNumbers, isWinner }: Props) {
  const drawnSet = new Set(drawnNumbers);

  return (
    <div className={isWinner ? 'ticket winner' : 'ticket'}>
      {matrix.map((row, rowIndex) => (
        <div className="ticket-row" key={rowIndex}>
          {row.map((cell, colIndex) => {
            const marked = cell === null || drawnSet.has(cell);
            return (
              <div key={colIndex} className={marked ? 'ticket-cell marked' : 'ticket-cell'}>
                {cell ?? 'LIVRE'}
              </div>
            );
          })}
        </div>
      ))}
      {isWinner && <div className="winner-badge">GANHADOR!</div>}
    </div>
  );
}
