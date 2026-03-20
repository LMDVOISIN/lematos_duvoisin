export const TEST_PROGRAM_FAMILIES = [
  'successful',
  'renter_failure',
  'owner_failure',
  'transversal_incident'
];

export const TEST_PROGRAM_TOTAL_STEPS = TEST_PROGRAM_FAMILIES.length;

export const TEST_PROGRAM_FAMILY_META = {
  successful: {
    label: 'Parcours abouti',
    shortLabel: 'Abouti',
    description: 'Aller jusqu au bout de la location sans embuche.'
  },
  renter_failure: {
    label: 'Echec cote locataire',
    shortLabel: 'Echec locataire',
    description: 'Le parcours n aboutit pas du point de vue du locataire.'
  },
  owner_failure: {
    label: 'Echec cote proprietaire',
    shortLabel: 'Echec proprietaire',
    description: 'Le parcours n aboutit pas du point de vue du proprietaire.'
  },
  transversal_incident: {
    label: 'Incidents transverses',
    shortLabel: 'Incident transverse',
    description: 'Le parcours bloque sur les preuves, le systeme ou l arbitrage.'
  }
};

export const getTestProgramFamilyMeta = (family) => {
  return TEST_PROGRAM_FAMILY_META?.[family] || {
    label: 'Parcours non classe',
    shortLabel: 'Non classe',
    description: ''
  };
};

export const normalizeCompletedFamilies = (completedFamilies = []) => {
  const normalizedFamilies = Array.isArray(completedFamilies) ? completedFamilies : [];

  return TEST_PROGRAM_FAMILIES.filter((family) => normalizedFamilies?.includes(family));
};

export const getTestProgramStepNumber = (completedFamilies = []) => {
  const normalizedFamilies = normalizeCompletedFamilies(completedFamilies);
  return Math.min(normalizedFamilies?.length + 1, TEST_PROGRAM_TOTAL_STEPS);
};

export const isTestProgramCompleted = (completedFamilies = []) => {
  return normalizeCompletedFamilies(completedFamilies)?.length >= TEST_PROGRAM_TOTAL_STEPS;
};
