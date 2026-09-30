import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import AppHeader from './AppHeader';

export const CONTACT_EMAIL = 'douglas.aarq@gmail.com';

/** Versao no formato AAAA-MM-DD, com revisao opcional no mesmo dia (AAAA-MM-DD.2). */
function describeVersion(version: string): string {
  const [day, revision] = version.split('.');
  const date = new Date(`${day}T12:00:00Z`).toLocaleDateString('pt-BR');
  return revision ? `Versão de ${date} (revisão ${revision})` : `Versão de ${date}`;
}

export interface LegalSection {
  title: string;
  content: ReactNode;
}

interface Props {
  title: string;
  version: string;
  intro: ReactNode;
  sections: LegalSection[];
}

/** Layout comum dos documentos legais (Termos de Uso e Politica de Privacidade). */
export default function LegalDocument({ title, version, intro, sections }: Props) {
  return (
    <div className="app-shell">
      <AppHeader />
      <main>
        <article className="card legal">
          <h1>{title}</h1>
          <p className="label">{describeVersion(version)}</p>
          <div className="legal-intro">{intro}</div>

          <nav className="legal-toc" aria-label="Índice">
            <ol>
              {sections.map((section, index) => (
                <li key={section.title}>
                  <a href={`#secao-${index + 1}`}>{section.title}</a>
                </li>
              ))}
            </ol>
          </nav>

          {sections.map((section, index) => (
            <section key={section.title} id={`secao-${index + 1}`}>
              <h2>
                {index + 1}. {section.title}
              </h2>
              {section.content}
            </section>
          ))}

          <p className="legal-footer">
            Dúvidas? Escreva para <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Veja também os{' '}
            <Link to="/termos">Termos de Uso</Link> e a <Link to="/privacidade">Política de Privacidade</Link>.
          </p>
        </article>
      </main>
    </div>
  );
}
