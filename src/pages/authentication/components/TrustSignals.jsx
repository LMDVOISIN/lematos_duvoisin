import React from 'react';
import Icon from '../../../components/AppIcon';

const TrustSignals = () => {
  const signals = [
    {
      icon: 'Shield',
      title: 'Paiements sécurisés',
      description: 'Transactions protégées et cryptées'
    },
    {
      icon: 'Lock',
      title: 'Données protégées',
      description: 'Conformité RGPD garantie'
    },
    {
      icon: 'Award',
      title: 'Service certifié',
      description: 'Entreprise française enregistrée'
    },
    {
      icon: 'ShieldCheck',
      title: 'Remboursement garanti',
      description: "Remboursement minimum garanti en cas de vol ou de détérioration"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mt-6 md:mt-8 pt-6 md:pt-8 border-t border-border">
      {signals?.map((signal, index) => (
        <div key={index} className="rounded-xl border border-border bg-muted/30 p-3 md:p-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-10 h-10 md:w-11 md:h-11 rounded-lg bg-primary/10 flex-shrink-0">
              <Icon name={signal?.icon} size={20} color="var(--color-primary)" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm md:text-[15px] font-semibold text-foreground mb-1 leading-snug">
                {signal?.title}
              </h4>
              <p className="text-xs md:text-sm text-muted-foreground leading-snug">
                {signal?.description}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TrustSignals;
