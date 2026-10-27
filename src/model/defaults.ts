import type { BoxConfig, BoxId, Settings, Tier } from './types';

// Terms below come from "Nine_Box_Grid_Template_Pour_IML.xlsx" (Term sheet and
// Nine-Box Grid tabs). All of them can be changed in Settings.

export const DEFAULT_TIERS: Tier[] = [
  { id: 'excellente', name: 'Excellente Année', color: '#00A0AF', target: 10, increment: null },
  { id: 'bonne', name: 'Bonne Année', color: '#5D5CFF', target: 40, increment: null },
  { id: 'normale', name: 'Année normale', color: '#FFAB00', target: 40, increment: null },
  { id: 'mauvaise', name: 'Mauvaise Année', color: '#E32C34', target: 10, increment: null },
];

// Starting point for which box feeds which tier: top-right is the best year,
// boxes with one dimension above expectations are a good year, boxes that
// balance out (or meet expectations) are a normal year, and boxes below
// expectations are a bad year. Individual members can still be moved to
// another tier during calibration.
export const DEFAULT_BOXES: Record<BoxId, BoxConfig> = {
  1: { title: 'Performance à Risque', action: "Plan d'amélioration comportemental urgent", tierId: 'normale' },
  2: { title: 'Potentiel à Guider', action: 'Coaching sur le Savoir-être', tierId: 'bonne' },
  3: { title: 'Top Talent', action: 'Accélération / Succession', tierId: 'excellente' },
  4: { title: "Besoin d'Amélioration", action: "Coaching sur le Savoir-être et l'Impact", tierId: 'mauvaise' },
  5: { title: 'Core Performer', action: 'Reconnaissance / Motivation', tierId: 'normale' },
  6: { title: 'Leadership Émergent', action: "Augmenter l'Impact / Croissance", tierId: 'bonne' },
  7: { title: 'Bas Performer', action: "Plan d'amélioration formel (PIP) / Sortie", tierId: 'mauvaise' },
  8: { title: 'À Développer', action: "Plan d'amélioration de l'Impact", tierId: 'mauvaise' },
  9: { title: 'Décalage (Mauvais Fit)', action: 'Réévaluation du rôle / Reconversion', tierId: 'normale' },
};

export function defaultSettings(): Settings {
  return structuredClone({
    savoirEtre: {
      name: 'Savoir-être',
      levels: [
        { label: 'Faible', description: 'Amélioration requise, Risque Comportemental' },
        { label: 'Moyen', description: 'Conforme, Solide, Fiable' },
        { label: 'Élevé', description: 'Exemplaire, Modèle, Forte Responsabilité' },
      ],
    },
    savoirFaire: {
      name: 'Savoir-faire',
      levels: [
        { label: 'Faible', description: 'Impact/Potentiel Inférieur aux Attentes' },
        { label: 'Moyen', description: 'Impact/Potentiel Conforme aux Attentes' },
        { label: 'Élevé', description: 'Impact/Potentiel Fort, Croissance Exceptionnelle' },
      ],
    },
    tiers: DEFAULT_TIERS,
    boxes: DEFAULT_BOXES,
  } satisfies Settings);
}

export interface GuidingQuestion {
  id: string;
  title: string;
  question: string;
}

export const GUIDING_QUESTIONS: GuidingQuestion[] = [
  {
    id: 'scope',
    title: 'Defining the scope',
    question:
      'Which team or department are you using this grid for? Are there specific talent segments that have to be prioritized based on criticality and/or scarcity?',
  },
  {
    id: 'savoir-etre',
    title: 'Evaluation Savoir-Être',
    question:
      "Comment évaluez-vous le professionnalisme, la responsabilité, l'absentéisme et l'implication dans les projets transverses ?",
  },
  {
    id: 'savoir-faire',
    title: 'Evaluation Savoir-Faire (Impact & Potentiel)',
    question:
      "Comment évaluez-vous la performance, la croissance et l'impact du collaborateur en fonction des attentes de son poste et de son temps d'expérience ?",
  },
  {
    id: 'top-savoir-etre',
    title: 'Différenciation Top 10% Savoir-ÊTRE (Comportement)',
    question:
      "Quels sont les 10% de collaborateurs qui sont les plus exemplaires en matière de professionnalisme, de leadership comportemental et d'engagement transverse ?",
  },
  {
    id: 'top-savoir-faire',
    title: 'Différenciation Top 10% Savoir-FAIRE (Impact/Potentiel)',
    question:
      "Quels sont les 10% de collaborateurs qui ont démontré l'impact le plus significatif et la plus forte croissance/potentiel par rapport à ce que l'on pourrait attendre de leur niveau d'expérience ?",
  },
  {
    id: 'risks',
    title: 'Facteurs de Risque',
    question:
      "Y a-t-il des facteurs qui pourraient entraver le maintien du Savoir-faire (ex: démotivation) ou du Savoir-être (ex: burn-out, conflit) ? Comment gère-t-on les hauts potentiels dont le Savoir-être est Faible (Performance à Risque) ?",
  },
  {
    id: 'distribution',
    title: 'Objectif de distribution',
    question:
      'La distribution actuelle respecte-t-elle les objectifs par tier (voir Calibration) ? Si non, quel ajustement manuel (calibration) est nécessaire pour atteindre cette cible ?',
  },
];
