import type { BoxConfig, BoxId, Settings, Tier } from './types';

// Terms below come from "Nine_Box_Grid_Template_Pour_IML.xlsx" (Term sheet and
// Nine-Box Grid tabs). All of them can be changed in Settings.

export const DEFAULT_TIERS: Tier[] = [
  { id: 'excellente', name: 'Excellente Année', color: '#00A0AF', target: 10, increment: null },
  { id: 'bonne', name: 'Bonne Année', color: '#5D5CFF', target: 40, increment: null },
  { id: 'normale', name: 'Année normale', color: '#FFAB00', target: 40, increment: null },
  { id: 'mauvaise', name: 'Mauvaise Année', color: '#E32C34', target: 10, increment: null },
];

// Starting point for which box feeds which tier. Each level is worth points
// (Faible 1, Moyen 2, Bon 3, Élevé 4) and a box's tier follows the total of
// its two levels: 8 is an excellent year, 6–7 a good year, 4–5 a normal year
// and 3 or less a bad year. The nine boxes of the original template keep the
// tiers they had. Individual members can still be moved to another tier
// during calibration.
export const DEFAULT_BOXES: Record<BoxId, BoxConfig> = {
  // Savoir-faire Élevé
  1: { title: 'Performance à Risque', action: "Plan d'amélioration comportemental urgent", tierId: 'normale' },
  2: { title: 'Potentiel à Guider', action: 'Coaching sur le Savoir-être', tierId: 'bonne' },
  3: { title: 'Haut Potentiel', action: 'Développer le leadership / Préparer la succession', tierId: 'bonne' },
  4: { title: 'Top Talent', action: 'Accélération / Succession', tierId: 'excellente' },
  // Savoir-faire Bon
  5: { title: 'Performance à Encadrer', action: 'Coaching comportemental ciblé', tierId: 'normale' },
  6: { title: 'Performer en Croissance', action: 'Reconnaissance / Coaching sur le Savoir-être', tierId: 'normale' },
  7: { title: 'Performer Solide', action: 'Valoriser / Élargir les responsabilités', tierId: 'bonne' },
  8: { title: 'Futur Leader', action: 'Mentorat / Élargir le périmètre', tierId: 'bonne' },
  // Savoir-faire Moyen
  9: { title: "Besoin d'Amélioration", action: "Coaching sur le Savoir-être et l'Impact", tierId: 'mauvaise' },
  10: { title: 'Core Performer', action: 'Reconnaissance / Motivation', tierId: 'normale' },
  11: { title: 'Contributeur Fiable', action: "Renforcer l'Impact", tierId: 'normale' },
  12: { title: 'Leadership Émergent', action: "Augmenter l'Impact / Croissance", tierId: 'bonne' },
  // Savoir-faire Faible
  13: { title: 'Bas Performer', action: "Plan d'amélioration formel (PIP) / Sortie", tierId: 'mauvaise' },
  14: { title: 'À Développer', action: "Plan d'amélioration de l'Impact", tierId: 'mauvaise' },
  15: { title: 'À Accompagner', action: 'Plan de montée en compétences', tierId: 'normale' },
  16: { title: 'Décalage (Mauvais Fit)', action: 'Réévaluation du rôle / Reconversion', tierId: 'normale' },
};

/** The level added between Moyen and Élevé, used to upgrade files saved with three levels. */
export const ADDED_LEVEL = {
  savoirEtre: { label: 'Bon', description: 'Engagé, Proactif, Au-dessus des Attentes' },
  savoirFaire: { label: 'Bon', description: 'Impact/Potentiel Supérieur aux Attentes' },
};

export function defaultSettings(): Settings {
  return structuredClone({
    savoirEtre: {
      name: 'Savoir-être',
      levels: [
        { label: 'Faible', description: 'Amélioration requise, Risque Comportemental' },
        { label: 'Moyen', description: 'Conforme, Solide, Fiable' },
        ADDED_LEVEL.savoirEtre,
        { label: 'Élevé', description: 'Exemplaire, Modèle, Forte Responsabilité' },
      ],
    },
    savoirFaire: {
      name: 'Savoir-faire',
      levels: [
        { label: 'Faible', description: 'Impact/Potentiel Inférieur aux Attentes' },
        { label: 'Moyen', description: 'Impact/Potentiel Conforme aux Attentes' },
        ADDED_LEVEL.savoirFaire,
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
