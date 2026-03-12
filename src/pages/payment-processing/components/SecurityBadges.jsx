import React from 'react';
import Icon from '../../../components/AppIcon';

const SecurityBadges = () => {
  const securityFeatures = [
    {
      icon: 'Lock',
      title: 'Paiement sécurisé SSL',
      description: 'Connexion cryptée 256-bit'
    },
    {
      icon: 'ShieldCheck',
      title: 'Protection des données',
      description: 'Conforme RGPD'
    },
    {
      icon: 'CreditCard',
      title: 'Paiement sécurisé',
      description: 'Service de paiement Le Matos du Voisin'
    },
    {
      icon: 'CheckCircle',
      title: 'Garantie plateforme',
      description: "Remboursement minimum garanti en cas de vol ou de détérioration"
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow-elevation-2 p-6">
      <div className="flex items-center gap-3 mb-4">
        <Icon name="Shield" size={24} className="text-success" />
        <h3 className="text-h5 font-heading text-foreground">
          Paiement sécurisé
        </h3>
      </div>

      <div className="space-y-4">
        {securityFeatures?.map((feature, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
              <Icon name={feature?.icon} size={20} className="text-success" />
            </div>
            <div>
              <p className="font-medium text-foreground text-sm">
                {feature?.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {feature?.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Trust Badges */}
      <div className="mt-6 pt-6 border-t border-border">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon name="Lock" size={16} className="text-success" />
            <span>SSL</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon name="ShieldCheck" size={16} className="text-success" />
            <span>PCI DSS</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon name="CheckCircle" size={16} className="text-success" />
            <span>3D Secure</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityBadges;
