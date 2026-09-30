import { Link } from 'react-router-dom';

interface Props {
  birthDate: string;
  onBirthDateChange: (value: string) => void;
  accepted: boolean;
  onAcceptedChange: (value: boolean) => void;
}

/** Data de nascimento (maiores de 18) e aceite dos termos: usados no cadastro e no aceite de contas antigas. */
export default function TermsConsentFields({ birthDate, onBirthDateChange, accepted, onAcceptedChange }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <label>
        Data de nascimento
        <input type="date" value={birthDate} max={today} onChange={(e) => onBirthDateChange(e.target.value)} required />
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={accepted} onChange={(e) => onAcceptedChange(e.target.checked)} required />
        <span>
          Tenho 18 anos ou mais e li e aceito os{' '}
          <Link to="/termos" target="_blank">
            Termos de Uso
          </Link>{' '}
          e a{' '}
          <Link to="/privacidade" target="_blank">
            Politica de Privacidade
          </Link>
          .
        </span>
      </label>
    </>
  );
}
