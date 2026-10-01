import { formatBrl } from '../../format';
import { useGameConfig } from '../../hooks/useGameConfig';
import OptionCards from './OptionCards';

interface Props {
  value: number;
  onChange: (stake: number) => void;
  /** Quantos jogadores dividem o pote ganho (1 no individual, 2 nas duplas). */
  winners: number;
  seats: number;
}

/** Escolha do valor da mesa: quanto custa entrar e quanto leva quem vencer. */
export default function StakePicker({ value, onChange, winners, seats }: Props) {
  const config = useGameConfig();
  if (!config) return null;

  return (
    <OptionCards
      label="Valor da mesa"
      value={value}
      onChange={onChange}
      options={config.stakes.map((stake) => ({
        value: stake,
        title: `${stake} ${stake === 1 ? 'chave' : 'chaves'}`,
        description: `Entrada ${formatBrl(stake * config.ticketPriceCredits * config.creditPriceBrl)} · prêmio ${formatBrl(
          (stake * config.prizeContributionPerTicket * seats) / winners,
        )}${winners > 1 ? ' para cada vencedor' : ''}`,
      }))}
    />
  );
}
