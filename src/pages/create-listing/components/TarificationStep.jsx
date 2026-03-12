import React, { useEffect, useState } from 'react';
import Input from '../../../components/ui/Input';
import Icon from '../../../components/AppIcon';
import {
  PAYMENT_FEE_FIXED,
  PAYMENT_FEE_RATE,
  PLATFORM_COMMISSION_RATE,
  computeOwnerNetEstimate
} from '../../../utils/pricingPolicy';

// Category parameters (ak, beta_k, mk)
const categoryParams = {
  default: { a: 0.11, beta: 0.72, m: 2 }
};

const SIMULATION_DURATIONS = [1, 3, 15];

const formatEuro = (amount) => `${Number(amount || 0).toFixed(2)} EUR`;

const normalizeCategory = (category) => {
  if (!category) return '';
  return category
    ?.toLowerCase()
    ?.normalize('NFD')
    ?.replace(/[\u0300-\u036f]/g, '')
    ?.replace(/[^a-z0-9]+/g, '_');
};

const calculateSuggestedPrice = (value, category) => {
  if (!value || value <= 0 || !Number.isFinite(value)) return null;

  const k = normalizeCategory(category);
  if (k === 'logements') return null;

  const params = categoryParams?.[k] || categoryParams?.default;
  const { a, beta, m } = params;

  const rho = 0.08;
  const powerLaw = a * Math.pow(value, beta);
  const floor = m;
  const ceiling = rho * value;
  const suggestedPrice = Math.round(Math.min(Math.max(powerLaw, floor), ceiling));

  return {
    price: suggestedPrice,
    breakdown: {
      powerLaw: powerLaw?.toFixed(2),
      floor,
      ceiling: ceiling?.toFixed(2)
    }
  };
};

const TarificationStep = ({ formData, updateFormData, errors }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalValue, setModalValue] = useState('');
  const [suggestedPrice, setSuggestedPrice] = useState(null);

  useEffect(() => {
    if (modalValue && formData?.category) {
      const result = calculateSuggestedPrice(parseFloat(modalValue), formData?.category);
      setSuggestedPrice(result);
      return;
    }
    setSuggestedPrice(null);
  }, [modalValue, formData?.category]);

  const openModal = () => {
    setModalValue(formData?.equipmentValue || '');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalValue('');
    setSuggestedPrice(null);
  };

  const applyPrice = () => {
    if (suggestedPrice?.price) {
      updateFormData('dailyRate', suggestedPrice?.price?.toString());
      updateFormData('equipmentValue', modalValue);
    }
    closeModal();
  };

  const calculateROI = () => {
    if (!modalValue || !suggestedPrice?.price) return null;
    const value = parseFloat(modalValue);
    const price = suggestedPrice?.price;
    const daysToAmortize = Math.ceil(value / price);
    const weeksToAmortize = (daysToAmortize / 7)?.toFixed(1);
    return { weeks: weeksToAmortize, days: daysToAmortize };
  };

  const roi = calculateROI();
  const simulatedDailyRate = Math.max(0, Number.parseFloat(formData?.dailyRate) || 0);
  const simulatedScenarios = SIMULATION_DURATIONS.map((days) => {
    const rentalAmount = simulatedDailyRate * days;
    const ownerNet = computeOwnerNetEstimate({
      rentalAmount
    });

    return {
      days,
      label: days === 1 ? '1 jour' : `${days} jours`,
      rentalAmount,
      ownerNet
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Tarification</h2>
        <p className="text-sm text-muted-foreground">Definissez le prix de location et la caution</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <Input
            label="Tarif journalier"
            type="number"
            placeholder="25.00"
            value={formData?.dailyRate}
            onChange={(e) => updateFormData('dailyRate', e?.target?.value)}
            error={errors?.dailyRate}
            description="Prix par jour de location en euros"
            required
          />
          <button
            type="button"
            onClick={openModal}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-[#17a2b8] text-white rounded-md text-sm font-medium hover:bg-[#138496] transition-colors"
          >
            <Icon name="Calculator" size={16} />
            Calculer un prix conseille
          </button>
        </div>

        <Input
          label="Caution demandee"
          type="number"
          placeholder="150.00"
          value={formData?.cautionAmount}
          onChange={(e) => updateFormData('cautionAmount', e?.target?.value)}
          error={errors?.cautionAmount}
          description="La caution est garantie par empreinte CB autorisee au paiement (non debitee)."
          required
        />

        <div>
          <p className="text-sm font-medium text-foreground mb-2">Mode de garantie</p>
          <div className="p-3 rounded-md border border-border bg-surface text-sm text-muted-foreground">
            Mode unique plateforme: empreinte bancaire (CB).
          </div>
        </div>
      </div>

      <div className="bg-[#17a2b8]/10 border border-[#17a2b8]/20 rounded-lg p-4">
        <div className="flex gap-2">
          <Icon name="Info" size={18} className="text-[#17a2b8] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground mb-2">Conseils de tarification</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>Consultez les prix similaires dans votre region</li>
              <li>Tenez compte de l'etat et de l'age du materiel</li>
              <li>L'empreinte CB garantit la caution</li>
              <li>L'empreinte CB est une autorisation bancaire non debitee au paiement</li>
              <li>Commission plateforme: {(PLATFORM_COMMISSION_RATE * 100).toLocaleString('fr-FR')}% du montant de location</li>
              <li>Frais de paiement location: {(PAYMENT_FEE_RATE * 100).toLocaleString('fr-FR')}% + {PAYMENT_FEE_FIXED.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR (deduits du reversement proprietaire)</li>
              <li>Aucun frais bancaire n'est applique tant que l'empreinte CB reste non capturee</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
        <div className="flex gap-2">
          <Icon name="ShieldAlert" size={18} className="text-warning flex-shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Information importante en cas de capture apres litige</p>
            <p>
              Cette estimation n'inclut aucun frais sur la caution, car une empreinte CB non capturee n'entraine pas de frais Stripe.
            </p>
            <p>
              Si une capture totale ou partielle de la caution est validee apres litige, des frais de paiement carte s'appliquent sur le montant capture. Si ce paiement capture est ensuite conteste, des frais de litige peuvent aussi s'appliquer selon le reseau de carte utilise.
            </p>
          </div>
        </div>
      </div>

      {simulatedDailyRate > 0 && (
        <div className="bg-surface rounded-lg p-4 border border-border">
          <div className="flex flex-col gap-1 mb-4">
            <p className="text-sm font-medium text-foreground">Apercu des revenus</p>
            <p className="text-xs text-muted-foreground">
              Simulations de reversement proprietaire sur 1 jour, 3 jours et 15 jours.
            </p>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {simulatedScenarios.map((scenario) => (
              <div
                key={scenario.days}
                className="rounded-xl border border-border bg-background p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-3 pb-2 border-b border-border">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{scenario.label}</p>
                    <p className="text-xs text-muted-foreground">Exemple de facturation</p>
                  </div>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                    {scenario.label}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Tarif journalier</span>
                    <span className="font-medium text-foreground">{formatEuro(simulatedDailyRate)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Total location</span>
                    <span className="font-medium text-foreground">{formatEuro(scenario.rentalAmount)}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-error">
                    <span>Commission plateforme ({(PLATFORM_COMMISSION_RATE * 100).toLocaleString('fr-FR')}%)</span>
                    <span>-{formatEuro(scenario.ownerNet?.platformCommissionAmount)}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-error">
                    <span>Frais paiement location</span>
                    <span>-{formatEuro(scenario.ownerNet?.paymentProcessingFeeAmount)}</span>
                  </div>
                  <div className="pt-3 border-t border-border flex justify-between gap-3 items-end">
                    <span className="font-semibold text-foreground">Vous recevez</span>
                    <span className="font-bold text-success text-lg">{formatEuro(scenario.ownerNet?.ownerNetEstimate)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground pt-4">
            Estimation hors litige. Les deductions appliquees au reversement proprietaire incluent uniquement la commission plateforme et les frais de paiement de la location.
          </p>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Calculer un prix conseille</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Estime un prix par jour a partir de la valeur de l'objet et de la categorie.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Icon name="X" size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valeur de l'objet (EUR)
                </label>
                <input
                  type="number"
                  value={modalValue}
                  onChange={(e) => setModalValue(e?.target?.value)}
                  placeholder="344"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#17a2b8] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categorie utilisee
                </label>
                <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700">
                  {formData?.category || 'Non definie'}
                </div>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                Base sur les tendances reelles du site et des partenaires, ce prix reste une recommandation indicative.
              </p>

              {suggestedPrice && roi && (
                <div className="bg-[#d4f4dd] rounded-lg p-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">PRIX RECOMMANDE</p>
                  <p className="text-3xl font-bold text-gray-900">{suggestedPrice?.price} EUR / jour</p>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    Amorti en environ {roi?.weeks} semaines de location, soit apres {roi?.days} jours loues.
                  </p>
                </div>
              )}

              {modalValue && !suggestedPrice && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    Impossible de calculer un prix pour cette categorie ou cette valeur.
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={applyPrice}
                disabled={!suggestedPrice}
                className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Appliquer ce prix
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TarificationStep;
