import React from 'react';
import Icon from '../../../components/AppIcon';

const ReglesStep = ({
  formData,
  updateFormData,
  errors,
  submitCtaLabel = 'Soumettre à modération'
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Règles de location</h2>
        <p className="text-sm text-muted-foreground">Définissez les conditions d'utilisation de votre matériel</p>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">
          Règles spécifiques
        </label>
        <textarea
          value={formData?.rules}
          onChange={(e) => updateFormData('rules', e?.target?.value)}
          placeholder="Ex. : Retour avec le réservoir plein, nettoyage après utilisation, utilisation en intérieur uniquement..."
          rows={6}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
        />
        <p className="text-xs text-muted-foreground mt-1">Optionnel - Précisez les conditions particulières</p>
      </div>

      {/* Common Rules Examples */}
      <div className="bg-surface rounded-lg border border-border p-4">
        <p className="text-sm font-medium text-foreground mb-3">Exemples de règles courantes</p>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <Icon name="Check" size={16} className="text-success flex-shrink-0 mt-0.5" />
            <span>Retour du matériel propre et en bon état</span>
          </div>
          <div className="flex items-start gap-2">
            <Icon name="Check" size={16} className="text-success flex-shrink-0 mt-0.5" />
            <span>Utilisation conforme aux instructions du fabricant</span>
          </div>
          <div className="flex items-start gap-2">
            <Icon name="Check" size={16} className="text-success flex-shrink-0 mt-0.5" />
            <span>Signalement immédiat en cas de problème ou panne</span>
          </div>
          <div className="flex items-start gap-2">
            <Icon name="Check" size={16} className="text-success flex-shrink-0 mt-0.5" />
            <span>Respect des horaires de prise en charge et de retour</span>
          </div>
        </div>
      </div>

      {/* General Conditions */}
      <div className="bg-[#17a2b8]/10 border border-[#17a2b8]/20 rounded-lg p-4">
        <div className="flex gap-2">
          <Icon name="FileText" size={18} className="text-[#17a2b8] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground mb-2">Conditions générales</p>
            <p className="text-sm text-muted-foreground">
              Les conditions générales d'utilisation de la plateforme s'appliquent automatiquement à toutes les locations. 
              Vos règles spécifiques viennent en complément de ces conditions.
            </p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-success/10 border border-success/20 rounded-lg p-4">
        <div className="flex gap-2">
          <Icon name="CheckCircle" size={18} className="text-success flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground mb-2">Prêt à publier !</p>
            <p className="text-sm text-muted-foreground">
              Votre annonce est complète. Cliquez sur "{submitCtaLabel}" pour la publier.
              Notre équipe la vérifiera sous 24-48h.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReglesStep;
