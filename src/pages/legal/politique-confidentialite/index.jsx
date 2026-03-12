import React from 'react';
import ManagedLegalPage from '../../../components/legal/ManagedLegalPage';

const PolitiqueConfidentialite = () => {
  return (
    <ManagedLegalPage
      slug="politique-confidentialite"
      titleFallback="Politique de confidentialite"
      fallbackSlugs={['confidentialite']}
    />
  );
};

export default PolitiqueConfidentialite;
