/**
 * Demo-cache artifacts: real, hand-authored work product for the golden
 * scenario (TidyLedger Spanish launch kit). Used when no LLM_API_KEY is
 * configured; every artifact served from here is labeled mode:"cached".
 * With a key set, providers generate live instead.
 */

export interface CachedArtifact {
  kind: string;
  title: string;
  content: string;
}

const STRINGS_ES = `{
  "welcome": "¡Bienvenido a TidyLedger!",
  "prompt_amount": "Ingresa el monto: ",
  "prompt_note": "Ingresa una nota: ",
  "income_added": "Ingreso registrado.",
  "expense_added": "Gasto registrado.",
  "invalid_amount": "Eso no parece un número — intenta de nuevo.",
  "monthly_summary": "Resumen mensual",
  "total_income": "Ingresos totales",
  "total_expenses": "Gastos totales",
  "balance": "Balance",
  "no_entries": "Aún no hay movimientos este mes.",
  "goodbye": "¡Adiós! Tu libro está guardado.",
  "help": "Comandos: add-income, add-expense, summary, quit",
  "unknown_command": "Comando desconocido. Escribe 'help'.",
  "saved": "Libro guardado."
}`;

const README_ES = `# TidyLedger

Una pequeña herramienta de presupuesto en la línea de comandos. Registra
ingresos y gastos desde tu terminal e imprime un resumen mensual.

## Comandos

- \`add-income\` — registra un ingreso
- \`add-expense\` — registra un gasto
- \`summary\` — imprime el resumen mensual
- \`quit\` — guarda y sale

## Instalación

\`\`\`
pip install tidyledger
tidyledger
\`\`\`

*TidyLedger es un proyecto ficticio creado para la demostración de OutcomePay.*
`;

const LANDING_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TidyLedger — Tu presupuesto en la terminal</title>
<meta name="description" content="TidyLedger: registra ingresos y gastos desde la línea de comandos. Simple, rápido y gratis.">
<style>
  :root { color-scheme: light; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; color: #1a1a1a; line-height: 1.6; }
  .hero { background: #0f172a; color: #f8fafc; padding: 72px 24px; text-align: center; }
  .hero h1 { font-size: 2.4rem; margin: 0 0 12px; }
  .hero p { font-size: 1.15rem; color: #cbd5e1; max-width: 620px; margin: 0 auto 28px; }
  .cta { display: inline-block; background: #22c55e; color: #052e16; font-weight: 700; padding: 14px 32px; border-radius: 10px; text-decoration: none; }
  .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; max-width: 960px; margin: 0 auto; padding: 56px 24px; }
  .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; }
  .card h2 { font-size: 1.1rem; margin: 0 0 8px; }
  .how { background: #f8fafc; padding: 56px 24px; text-align: center; }
  .how ol { display: inline-block; text-align: left; max-width: 520px; }
  .how code { background: #e2e8f0; padding: 2px 8px; border-radius: 6px; }
  footer { text-align: center; padding: 32px 24px; color: #64748b; font-size: 0.9rem; }
</style>
</head>
<body>
  <header class="hero">
    <h1>TidyLedger</h1>
    <p>Tu presupuesto, sin salir de la terminal. Registra ingresos y gastos con comandos simples y mira tu resumen mensual al instante.</p>
    <a class="cta" href="#instalar">Instalar gratis</a>
  </header>
  <section class="features" aria-label="Características">
    <div class="card"><h2>⚡ Rápido</h2><p>Un comando por movimiento. Sin cuentas, sin nube, sin distracciones.</p></div>
    <div class="card"><h2>📊 Resumen mensual</h2><p>Ingresos, gastos y balance de un vistazo con <code>summary</code>.</p></div>
    <div class="card"><h2>🔒 Privado</h2><p>Tus datos viven en tu máquina. Nada sale de tu terminal.</p></div>
  </section>
  <section class="how" id="instalar" aria-label="Cómo empezar">
    <h2>Empieza en 30 segundos</h2>
    <ol>
      <li>Instala con <code>pip install tidyledger</code></li>
      <li>Ejecuta <code>tidyledger</code></li>
      <li>Registra tu primer gasto con <code>add-expense</code></li>
    </ol>
  </section>
  <footer>TidyLedger es un proyecto ficticio creado para la demostración de OutcomePay. Hecho con cariño para desarrolladores de habla hispana.</footer>
</body>
</html>`;

const RESEARCH_MD = `# Launch brief: Spanish-speaking developers

**Product:** TidyLedger — tiny fictional CLI budgeting tool for developers.
**Goal:** First 500 Spanish-speaking users in 2 weeks.

## Where they gather

1. **Python España & local Python groups (CDMX, Buenos Aires, Bogotá, Madrid).**
   CLI tooling overlaps heavily with Python devs; meetup lightning talks convert well.
2. **WordPress / hosting communities in Spanish (WordCamp Europe ES track).**
   Freelancers who live in terminals and bill hours — budgeting resonates.
3. **Discord & Telegram dev servers (e.g., programming-in-spanish communities).**
   #showcase channels welcome tiny open-source tools; ask mods first.
4. **dev.to / Hashnode Spanish tags.** A "built in a weekend" launch post in
   Spanish travels far; cross-post to Medium en español.
5. **University tech clubs (UNAM, UBA, UPB).** Students love free CLI tools;
   offer a 10-minute workshop.

## Localization pitfalls for dev tools in Spanish

- **Don't translate commands.** \`add-expense\` stays; translate only the help text.
- **Use neutral (Mexican-leaning) Spanish**, avoid vosotros forms.
- **Currency formatting:** don't assume USD — use the locale's format, never hardcode "$".
- **Dates:** DD/MM/YYYY is the expectation almost everywhere.

## 2-week checklist

- [ ] Week 1: publish es-US strings + landing page; post to 2 communities
- [ ] Week 1: lightning-talk pitch (5 min) for one local meetup
- [ ] Week 2: launch post on dev.to (Spanish); gather 20 beta testers
- [ ] Week 2: fix top 5 UX papercuts from tester feedback; announce v0.4
`;

const REVIEW_A_MD = `# Quality review A — localization QA

**Reviewer:** reviewer-a (independent) · **Verdict:** PASS

## Checks

- **no_untranslated_strings:** PASS — all 15 UI strings rendered in es-US
  Spanish; CLI command names correctly left in English.
- **required_sections_present:** PASS — README_ES covers install, commands,
  and purpose; matches the English source structure.
- **Claim fidelity:** PASS — no feature claims added or lost in translation.
  The "fictional demo project" disclaimer is preserved.

## Findings

1. \`prompt_amount\` uses "monto" (neutral, good for US/MX/AR).
2. README code fences preserved — install steps copy-paste cleanly.
3. Minor: "¡Adiós!" keeps the accent — correct.

## Score

**92/100 — PASS** (threshold 80). Ready for launch-kit assembly.
`;

const REVIEW_B_MD = `# Quality review B — launch readiness

**Reviewer:** reviewer-b (independent) · **Verdict:** PASS

## Checks

- **Cultural fit:** PASS — neutral Spanish, no regional slang; currency and
  date guidance in the brief matches es-US expectations.
- **Landing page:** PASS — hero, features, how-it-works, and footer all
  present; \`lang="es"\`, semantic markup, alt-free decorative-free design.
- **Naturalness:** PASS — copy reads written, not translated. "Tu
  presupuesto, sin salir de la terminal" is a strong hero line.

## Findings

1. CTA "Instalar gratis" is clear and above the fold.
2. Footer disclaimer about the fictional project is present and honest.
3. Consider adding a dark-mode toggle post-launch (non-blocking).

## Score

**90/100 — PASS** (threshold 80). Consensus with reviewer A (92): kit is shippable.
`;

export const DEMO_CACHE: Record<string, CachedArtifact[]> = {
  "localizer-01": [
    { kind: "translated_copy", title: "TidyLedger UI strings (es-US)", content: STRINGS_ES },
    { kind: "translated_copy", title: "TidyLedger README (es-US)", content: README_ES },
  ],
  "pagebuilder-01": [
    { kind: "landing_page", title: "TidyLedger launch page (es-US)", content: LANDING_HTML },
  ],
  "researcher-01": [
    { kind: "launch_brief", title: "Launch brief: Spanish-speaking developers", content: RESEARCH_MD },
  ],
  "reviewer-a": [
    { kind: "quality_report", title: "Quality review A — localization QA", content: REVIEW_A_MD },
  ],
  "reviewer-b": [
    { kind: "quality_report", title: "Quality review B — launch readiness", content: REVIEW_B_MD },
  ],
};
