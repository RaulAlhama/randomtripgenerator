import { PrivacyDoc, TermsDoc } from './Footer';

// /privacidad and /terminos rendered as pages rather than modals. The text is
// imported from Footer so there is exactly one copy of it in the project.
const DOCS = {
  privacidad: { title: 'Política de Privacidad', Doc: PrivacyDoc },
  terminos: { title: 'Términos de Uso', Doc: TermsDoc },
};

export default function LegalPage({ which }) {
  const entry = DOCS[which];
  if (!entry) return null;
  const { title, Doc } = entry;

  return (
    <article className="legal-page">
      <h1>{title}</h1>
      <Doc />
      <p className="legal-page-back">
        <a href="/">Volver a RandomTrip</a>
      </p>
    </article>
  );
}
