export const getTestingTesterRole = (testerOrderIndex) => {
  const normalizedOrder = Number(testerOrderIndex);
  if (!Number.isFinite(normalizedOrder) || normalizedOrder <= 0) {
    return 'mirror';
  }

  return normalizedOrder % 2 === 1 ? 'reference' : 'mirror';
};

export const isReferenceTestingRole = (testerOrderIndex) =>
  getTestingTesterRole(testerOrderIndex) === 'reference';

export const isMirrorTestingRole = (testerOrderIndex) =>
  getTestingTesterRole(testerOrderIndex) === 'mirror';
