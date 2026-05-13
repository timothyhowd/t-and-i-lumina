/**
 * Germany — clause library (PoC scaffolding).
 *
 * Citations to German statutes are real (BGB, BUrlG, SGB III, GeschGehG,
 * UrhG, ArbnErfG). Prose is generic English scaffolding marked
 * `reviewStatus: 'unverified'` — production clauses must be authored in
 * German with English convenience translation, with German binding per
 * the cross-doc analysis findings.
 */
import type { Clause } from '../clauses';

const A = {
  BGB: { statute: 'Bürgerliches Gesetzbuch (BGB)', url: 'https://www.gesetze-im-internet.de/bgb/' },
  BURLG: { statute: 'Bundesurlaubsgesetz (BUrlG)', url: 'https://www.gesetze-im-internet.de/burlg/' },
  SGB3: { statute: 'Sozialgesetzbuch III (SGB III)', url: 'https://www.gesetze-im-internet.de/sgb_3/' },
  GESCHGEHG: { statute: 'Geschäftsgeheimnisgesetz (GeschGehG)', url: 'https://www.gesetze-im-internet.de/geschgehg/' },
  URHG: { statute: 'Urheberrechtsgesetz (UrhG)', url: 'https://www.gesetze-im-internet.de/urhg/' },
  ARBNERFG: { statute: 'Gesetz über Arbeitnehmererfindungen (ArbnErfG)', url: 'https://www.gesetze-im-internet.de/arbnerfg/' },
  ARBZG: { statute: 'Arbeitszeitgesetz (ArbZG)', url: 'https://www.gesetze-im-internet.de/arbzg/' },
  TZBFG: { statute: 'Teilzeit- und Befristungsgesetz (TzBfG)', url: 'https://www.gesetze-im-internet.de/tzbfg/' },
  ENTGFG: { statute: 'Entgeltfortzahlungsgesetz (EFZG)', url: 'https://www.gesetze-im-internet.de/entgfg/' },
};

const DEU_PARTIES: Clause = {
  clauseId: 'deu.parties',
  jurisdiction: 'DEU',
  topic: 'parties',
  applicableTo: ['employment_agreement', 'addendum', 'termination_letter'],
  body: `## ARBEITSVERTRAG / EMPLOYMENT AGREEMENT

**Arbeitgeber / Employer**
{{record.employer.legalName}} ({{record.employer.registrationId.value}})
{{record.employer.registeredAddress.street}}, {{record.employer.registeredAddress.postalCode}} {{record.employer.registeredAddress.city}}

**Arbeitnehmer/-in / Employee**
{{record.employee.fullName}}
Geboren / Born: {{record.employee.dateOfBirth}}
{{record.employee.address.street}}, {{record.employee.address.postalCode}} {{record.employee.address.city}}`,
  citations: [],
  reviewStatus: 'unverified',
};

const DEU_TERM: Clause = {
  clauseId: 'deu.term',
  jurisdiction: 'DEU',
  topic: 'validity',
  applicableTo: ['employment_agreement'],
  body: `## § 1 Beginn / Commencement and Term

{{#ifEq record.terms.termType "indefinite"}}Das Arbeitsverhältnis beginnt am {{record.terms.startDate}} und wird auf unbestimmte Zeit geschlossen. / The employment relationship begins on {{record.terms.startDate}} and is concluded for an indefinite period.{{/ifEq}}

{{#ifEq record.terms.termType "fixed_term"}}Das Arbeitsverhältnis ist befristet vom {{record.terms.startDate}} bis {{record.terms.endDate}}. Sachgrund: {{record.terms.fixedTermReason}}. / The employment is fixed-term from {{record.terms.startDate}} to {{record.terms.endDate}}. Justifying reason: {{record.terms.fixedTermReason}}.{{/ifEq}}`,
  citations: [A.BGB, A.TZBFG],
  reviewStatus: 'unverified',
};

const DEU_PROBATION: Clause = {
  clauseId: 'deu.probation',
  jurisdiction: 'DEU',
  topic: 'trial_period',
  applicableTo: ['employment_agreement'],
  body: `## § 2 Probezeit / Probationary Period

Es wird eine Probezeit von {{record.terms.trialPeriod.months}} Monaten vereinbart (§ 622 Abs. 3 BGB). Während der Probezeit beträgt die Kündigungsfrist zwei Wochen. / A probationary period of {{record.terms.trialPeriod.months}} months is agreed (§ 622 (3) BGB). During the probationary period, the notice period is two weeks.`,
  citations: [{ ...A.BGB, section: '§ 622 Abs. 3' }],
  reviewStatus: 'unverified',
};

const DEU_DUTIES: Clause = {
  clauseId: 'deu.duties',
  jurisdiction: 'DEU',
  topic: 'duties',
  applicableTo: ['employment_agreement'],
  body: `## § 3 Tätigkeit / Duties

Der/Die Arbeitnehmer/-in wird als {{record.position.title}} eingestellt. Die Tätigkeit umfasst insbesondere: / The Employee is engaged as {{record.position.title}}. Duties include in particular:

{{#freeText "duties_description"}}{{/freeText}}

Der Arbeitgeber kann dem/der Arbeitnehmer/-in im Rahmen seines Direktionsrechts auch andere zumutbare Tätigkeiten zuweisen. / The Employer may assign other reasonable duties consistent with the Employee's role.`,
  citations: [],
  reviewStatus: 'unverified',
  freeTextSlots: [
    {
      name: 'duties_description',
      instructions: 'Render record.position.duties as a hyphen-prefixed bullet list. Each duty on its own line. Use neutral, professional language. Do not invent duties.',
      maxChars: 800,
    },
  ],
};

const DEU_PLACE_OF_WORK: Clause = {
  clauseId: 'deu.place_of_work',
  jurisdiction: 'DEU',
  topic: 'place_of_work',
  applicableTo: ['employment_agreement'],
  body: `## § 4 Arbeitsort / Place of Work

{{#freeText "work_location_summary"}}{{/freeText}}`,
  citations: [],
  reviewStatus: 'unverified',
  freeTextSlots: [
    {
      name: 'work_location_summary',
      instructions: 'Describe the work location based on record.position.workLocation. Bilingual German/English, two sentences max. If hybrid, state the primary office address and that remote is permitted.',
      maxChars: 350,
    },
  ],
};

const DEU_WORKING_HOURS: Clause = {
  clauseId: 'deu.working_hours',
  jurisdiction: 'DEU',
  topic: 'working_hours',
  applicableTo: ['employment_agreement'],
  body: `## § 5 Arbeitszeit / Working Hours

Die regelmäßige wöchentliche Arbeitszeit beträgt {{record.schedule.averageWeeklyHours}} Stunden. Die Arbeitszeit richtet sich im Übrigen nach dem Arbeitszeitgesetz. / Regular weekly working time is {{record.schedule.averageWeeklyHours}} hours. Working time is otherwise governed by the Working Hours Act.`,
  citations: [{ ...A.ARBZG, section: '§ 3 (maximum daily working time)' }],
  reviewStatus: 'unverified',
};

const DEU_COMPENSATION: Clause = {
  clauseId: 'deu.compensation',
  jurisdiction: 'DEU',
  topic: 'compensation',
  applicableTo: ['employment_agreement'],
  body: `## § 6 Vergütung / Compensation

Der/Die Arbeitnehmer/-in erhält ein Bruttogehalt von {{record.compensation.base.amount}} {{record.compensation.base.currency}} {{record.compensation.payFrequency}}, zahlbar nach Maßgabe der Gehaltsabrechnung. / The Employee receives gross compensation of {{record.compensation.base.amount}} {{record.compensation.base.currency}} {{record.compensation.payFrequency}}, payable per the Company's payroll practice.`,
  citations: [],
  reviewStatus: 'unverified',
};

const DEU_ANNUAL_LEAVE: Clause = {
  clauseId: 'deu.annual_leave',
  jurisdiction: 'DEU',
  topic: 'annual_leave',
  applicableTo: ['employment_agreement'],
  body: `## § 7 Urlaub / Annual Leave

Der gesetzliche Mindesturlaub gemäß § 3 BUrlG beträgt 24 Werktage bei einer Sechs-Tage-Woche (entsprechend 20 Arbeitstagen bei einer Fünf-Tage-Woche). / Statutory minimum annual leave under § 3 BUrlG is 24 working days (six-day week), equivalent to 20 working days on a five-day week.`,
  citations: [{ ...A.BURLG, section: '§ 3 (minimum leave)' }],
  reviewStatus: 'unverified',
};

const DEU_SICKNESS_PAY: Clause = {
  clauseId: 'deu.sickness_pay',
  jurisdiction: 'DEU',
  topic: 'compensation',
  applicableTo: ['employment_agreement'],
  body: `## § 8 Entgeltfortzahlung im Krankheitsfall / Continued Pay in Case of Illness

Bei Arbeitsunfähigkeit infolge Krankheit besteht ein Anspruch auf Entgeltfortzahlung nach Maßgabe des Entgeltfortzahlungsgesetzes. / In the event of incapacity for work due to illness, the Employee is entitled to continued pay in accordance with the Continued Remuneration Act.`,
  citations: [A.ENTGFG],
  reviewStatus: 'unverified',
};

const DEU_NOTICE_PERIOD: Clause = {
  clauseId: 'deu.notice_period',
  jurisdiction: 'DEU',
  topic: 'notice_period',
  applicableTo: ['employment_agreement', 'termination_letter'],
  body: `## § 9 Kündigungsfristen / Notice Periods

Die gesetzlichen Kündigungsfristen gemäß § 622 BGB gelten. Die Verlängerung der Kündigungsfrist nach Dauer der Betriebszugehörigkeit gilt zugunsten beider Vertragsparteien. / Statutory notice periods under § 622 BGB apply. The extension of the notice period based on length of service applies to both parties.`,
  citations: [{ ...A.BGB, section: '§ 622 (notice periods)' }],
  reviewStatus: 'unverified',
};

const DEU_IP: Clause = {
  clauseId: 'deu.ip_assignment',
  jurisdiction: 'DEU',
  topic: 'confidentiality',
  applicableTo: ['employment_agreement'],
  body: `## § 10 Arbeitsergebnisse / Work Product

Sämtliche im Rahmen des Arbeitsverhältnisses entstehenden urheberrechtlich geschützten Werke werden dem Arbeitgeber gemäß § 69b UrhG übertragen, soweit gesetzlich zulässig. Diensterfindungen unterliegen dem Arbeitnehmererfindungsgesetz. / All copyright-protected works created in the course of employment are transferred to the Employer pursuant to § 69b UrhG, to the extent permitted by law. Service inventions are governed by the Employee Inventions Act.`,
  citations: [{ ...A.URHG, section: '§ 69b' }, A.ARBNERFG],
  reviewStatus: 'unverified',
};

const DEU_CONFIDENTIALITY: Clause = {
  clauseId: 'deu.confidentiality',
  jurisdiction: 'DEU',
  topic: 'confidentiality',
  applicableTo: ['employment_agreement'],
  body: `## § 11 Verschwiegenheitspflicht / Confidentiality

Der/Die Arbeitnehmer/-in verpflichtet sich, über alle ihm/ihr im Rahmen seiner/ihrer Tätigkeit bekannt gewordenen Geschäftsgeheimnisse im Sinne des Geschäftsgeheimnisgesetzes Stillschweigen zu bewahren — auch nach Beendigung des Arbeitsverhältnisses. / The Employee shall maintain confidentiality regarding all trade secrets within the meaning of the Trade Secrets Act that come to their knowledge — including after termination.`,
  citations: [{ ...A.GESCHGEHG, section: '§ 5 (legitimate use carve-outs)' }],
  reviewStatus: 'unverified',
};

const DEU_DATA_PROTECTION: Clause = {
  clauseId: 'deu.data_protection',
  jurisdiction: 'DEU',
  topic: 'data_protection',
  applicableTo: ['employment_agreement'],
  body: `## § 12 Datenschutz / Data Protection

Personenbezogene Daten werden zur Durchführung des Arbeitsverhältnisses gemäß DSGVO und BDSG verarbeitet. Eine gesonderte Datenschutzinformation für Beschäftigte wird ausgehändigt. / Personal data is processed for the performance of the employment relationship in accordance with the GDPR and the BDSG. A separate employee data protection notice will be provided.`,
  citations: [],
  reviewStatus: 'unverified',
};

const DEU_GOVERNING_LAW: Clause = {
  clauseId: 'deu.governing_law',
  jurisdiction: 'DEU',
  topic: 'governing_law',
  applicableTo: ['employment_agreement', 'addendum'],
  body: `## § 13 Anwendbares Recht / Governing Law

Dieser Vertrag unterliegt deutschem Recht. / This contract is governed by German law.`,
  citations: [],
  reviewStatus: 'unverified',
};

const DEU_LANGUAGE: Clause = {
  clauseId: 'deu.language_precedence',
  jurisdiction: 'DEU',
  topic: 'governing_law',
  applicableTo: ['employment_agreement'],
  body: `## § 14 Sprachfassung / Language Precedence

Dieser Vertrag ist in deutscher und englischer Sprache abgefasst. Bei Auslegungsfragen ist die deutsche Fassung maßgeblich. / This contract is drawn up in German and English. In matters of interpretation, the German version prevails.`,
  citations: [],
  reviewStatus: 'unverified',
};

const DEU_SIGNATURE: Clause = {
  clauseId: 'deu.signature',
  jurisdiction: 'DEU',
  topic: 'signature',
  applicableTo: ['employment_agreement', 'addendum', 'termination_letter'],
  body: `## Unterschriften / Signatures

Ort / Place: _______________   Datum / Date: _______________

\\
Arbeitnehmer/-in / Employee: _______________      Arbeitgeber / Employer: _______________
{{record.employee.fullName}}                       {{record.employer.signatory.name}}, {{record.employer.signatory.title}}`,
  citations: [],
  reviewStatus: 'unverified',
};

const DEU_ADDENDUM_RECITAL: Clause = {
  clauseId: 'deu.addendum_recital',
  jurisdiction: 'DEU',
  topic: 'addendum_recital',
  applicableTo: ['addendum'],
  body: `## NACHTRAG ZUM ARBEITSVERTRAG / ADDENDUM TO EMPLOYMENT AGREEMENT

Hiermit wird der Arbeitsvertrag zwischen {{record.employer.legalName}} und {{record.employee.fullName}} wie folgt geändert. Alle übrigen Bestimmungen bleiben unberührt. / The employment agreement between {{record.employer.legalName}} and {{record.employee.fullName}} is hereby amended as follows. All other provisions remain unchanged.`,
  citations: [],
  reviewStatus: 'unverified',
};

const DEU_ADDENDUM_DELTA: Clause = {
  clauseId: 'deu.addendum_delta',
  jurisdiction: 'DEU',
  topic: 'addendum_delta',
  applicableTo: ['addendum'],
  body: `## ÄNDERUNGEN / CHANGES

{{#freeText "delta_summary"}}{{/freeText}}`,
  citations: [],
  reviewStatus: 'unverified',
  freeTextSlots: [
    {
      name: 'delta_summary',
      instructions: 'Render document.changes as a numbered list in bilingual German/English. State the field, previous value, new value, and effective date for each change. Use neutral legal-style language.',
      maxChars: 1500,
    },
  ],
};

const DEU_TERM_PARTIES: Clause = {
  clauseId: 'deu.termination_parties',
  jurisdiction: 'DEU',
  topic: 'parties',
  applicableTo: ['termination_letter'],
  body: `## KÜNDIGUNG / TERMINATION

**An / To:** {{record.employee.fullName}}
**Von / From:** {{record.employer.legalName}}`,
  citations: [],
  reviewStatus: 'unverified',
};

const DEU_TERM_REASON: Clause = {
  clauseId: 'deu.termination_reason',
  jurisdiction: 'DEU',
  topic: 'termination_reason',
  applicableTo: ['termination_letter'],
  body: `## Beendigung des Arbeitsverhältnisses / Termination of Employment

Das Arbeitsverhältnis wird ordentlich gekündigt zum {{document.termination.lastWorkingDay}}. Grund / Reason: {{document.termination.reason}}.`,
  citations: [{ ...A.BGB, section: '§ 622' }],
  reviewStatus: 'unverified',
};

const DEU_SGB3: Clause = {
  clauseId: 'deu.sgb3_registration_duty',
  jurisdiction: 'DEU',
  topic: 'termination_reason',
  applicableTo: ['termination_letter'],
  body: `## Meldepflicht / Duty to Register for Work

Gemäß § 38 SGB III sind Sie verpflichtet, sich spätestens drei Monate vor Beendigung des Arbeitsverhältnisses persönlich bei der Agentur für Arbeit als arbeitsuchend zu melden. Bei kürzeren Fristen muss die Meldung innerhalb von drei Tagen nach Erhalt der Kündigung erfolgen. / Pursuant to § 38 SGB III, you are required to register as a job-seeker with the Federal Employment Agency at least three months before the end of the employment relationship; for shorter notice periods, within three days of receiving notice of termination.`,
  citations: [{ ...A.SGB3, section: '§ 38 (duty to register)' }],
  reviewStatus: 'unverified',
};

const DEU_TERM_FINAL_PAY: Clause = {
  clauseId: 'deu.final_pay',
  jurisdiction: 'DEU',
  topic: 'final_pay',
  applicableTo: ['termination_letter'],
  body: `## Schlusszahlung / Final Pay

Die Schlussabrechnung erfolgt zum nächsten regulären Abrechnungstermin nach dem Beendigungsdatum. Etwaige nicht genommene Urlaubstage werden gemäß BUrlG abgegolten. / Final settlement will occur on the next regular payroll date after the termination. Unused leave will be compensated in accordance with the Federal Leave Act.`,
  citations: [A.BURLG],
  reviewStatus: 'unverified',
};

export const DEU_CLAUSES: Clause[] = [
  DEU_PARTIES,
  DEU_TERM,
  DEU_PROBATION,
  DEU_DUTIES,
  DEU_PLACE_OF_WORK,
  DEU_WORKING_HOURS,
  DEU_COMPENSATION,
  DEU_ANNUAL_LEAVE,
  DEU_SICKNESS_PAY,
  DEU_NOTICE_PERIOD,
  DEU_IP,
  DEU_CONFIDENTIALITY,
  DEU_DATA_PROTECTION,
  DEU_GOVERNING_LAW,
  DEU_LANGUAGE,
  DEU_SIGNATURE,
  DEU_ADDENDUM_RECITAL,
  DEU_ADDENDUM_DELTA,
  DEU_TERM_PARTIES,
  DEU_TERM_REASON,
  DEU_SGB3,
  DEU_TERM_FINAL_PAY,
];
