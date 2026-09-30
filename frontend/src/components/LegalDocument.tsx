import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import AppHeader from './AppHeader';

export const CONTACT_EMAIL = 'douglas.aarq@gmail.com';

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
          <p className="label">Versao de {new Date(`${version}T12:00:00Z`).toLocaleDateString('pt-BR')}</p>
          <div className="legal-intro">{intro}</div>

          <nav className="legal-toc" aria-label="Indice">
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
            Duvidas? Escreva para <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Veja tambem os{' '}
            <Link to="/termos">Termos de Uso</Link> e a <Link to="/privacidade">Politica de Privacidade</Link>.
          </p>
        </article>
      </main>
    </div>
  );
}
