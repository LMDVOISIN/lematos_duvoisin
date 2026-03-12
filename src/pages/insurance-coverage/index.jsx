import React, { useState } from 'react';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

const InsuranceCoverage = () => {
  const [equipmentValue, setEquipmentValue] = useState('');
  const [rentalDays, setRentalDays] = useState('');
  const [calculatedPremium, setCalculatedPremium] = useState(null);

  const benefits = [
    {
      icon: 'Shield',
      title: 'Protection contre le vol',
      description: 'Couverture complète en cas de vol de l\'équipement pendant la période de location'
    },
    {
      icon: 'AlertTriangle',
      title: 'Casse accidentelle',
      description: 'Prise en charge des réparations ou remplacement en cas de dommages accidentels'
    },
    {
      icon: 'Wrench',
      title: 'Détérioration',
      description: 'Protection contre l\'usure anormale et les détériorations non intentionnelles'
    },
    {
      icon: 'Clock',
      title: 'Assistance 24/7',
      description: 'Support disponible à tout moment pour déclarer un sinistre'
    }
  ];

  const comparisonData = [
    { feature: 'Vol de l\'équipement', withInsurance: true, withoutInsurance: false },
    { feature: 'Casse accidentelle', withInsurance: true, withoutInsurance: false },
    { feature: 'Détérioration', withInsurance: true, withoutInsurance: false },
    { feature: 'Franchise', withInsurance: '50€', withoutInsurance: 'Caution complète' },
    { feature: 'Délai de remboursement', withInsurance: '48h', withoutInsurance: '7-14 jours' },
    { feature: 'Assistance', withInsurance: '24/7', withoutInsurance: 'Non disponible' }
  ];

  const claimsSteps = [
    {
      step: 1,
      title: 'Déclaration immédiate',
      description: 'Signalez le sinistre dans les 24h via votre espace personnel ou par téléphone'
    },
    {
      step: 2,
      title: 'Documents justificatifs',
      description: 'Fournissez les photos, factures et tout document prouvant le sinistre'
    },
    {
      step: 3,
      title: 'Évaluation',
      description: 'Notre équipe évalue le dossier sous 48h ouvrées'
    },
    {
      step: 4,
      title: 'Indemnisation',
      description: 'Remboursement ou remplacement de l\'équipement selon les conditions'
    }
  ];

  const faqs = [
    {
      question: 'Comment souscrire à l\'assurance ?',
      answer: 'L\'assurance peut être souscrite lors de la réservation en cochant l\'option "Assurance complète". Elle est également disponible jusqu\'à 24h avant le début de la location.'
    },
    {
      question: 'Quel est le coût de l\'assurance ?',
      answer: "Le coût est calculé à 8% de la valeur déclarée de l'équipement par jour de location, avec un minimum de 2€/jour."
    },
    {
      question: 'Que couvre exactement l\'assurance ?',
      answer: 'L\'assurance couvre le vol, la casse accidentelle, et la détérioration de l\'équipement pendant toute la durée de la location. Les dommages intentionnels ne sont pas couverts.'
    },
    {
      question: 'Quelle est la franchise en cas de sinistre ?',
      answer: 'La franchise est fixée à 50€ par sinistre. Le reste des frais de réparation ou de remplacement est pris en charge par l\'assurance.'
    },
    {
      question: 'Puis-je annuler l\'assurance ?',
      answer: 'L\'assurance peut être annulée jusqu\'à 24h avant le début de la location pour un remboursement complet. Après ce délai, aucun remboursement n\'est possible.'
    },
    {
      question: 'Comment déclarer un sinistre ?',
      answer: 'Connectez-vous à votre espace personnel, accédez à la réservation concernée et cliquez sur "Déclarer un sinistre". Vous pouvez également nous contacter par téléphone au 01 XX XX XX XX.'
    }
  ];

  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  const calculatePremium = () => {
    const value = parseFloat(equipmentValue);
    const days = parseInt(rentalDays);

    if (!value || !days || value <= 0 || days <= 0) {
      alert('Veuillez entrer des valeurs valides');
      return;
    }

    // 8% of equipment value per day, minimum 2€/day
    const dailyRate = Math.max((value * 0.08), 2);
    const total = dailyRate * days;

    setCalculatedPremium({
      dailyRate: dailyRate?.toFixed(2),
      total: total?.toFixed(2),
      equipmentValue: value?.toFixed(2),
      days
    });
  };

  const toggleFaq = (index) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />
      <main className="flex-1 pt-20 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero Section */}
          <div className="bg-gradient-to-r from-[#17a2b8] to-[#138496] rounded-lg p-8 md:p-12 text-white mb-12">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">Assurance Location</h1>
            <p className="text-lg md:text-xl opacity-90 max-w-3xl">
              Louez en toute sérénité avec notre assurance complète. Protection contre le vol, la casse et la détérioration.
            </p>
          </div>

          {/* Benefits Section */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6">Pourquoi souscrire à l'assurance ?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {benefits?.map((benefit, index) => (
                <div key={index} className="bg-white rounded-lg p-6 shadow-elevation-1">
                  <div className="w-12 h-12 bg-[#17a2b8]/10 rounded-lg flex items-center justify-center mb-4">
                    <Icon name={benefit?.icon} size={24} className="text-[#17a2b8]" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{benefit?.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit?.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Pricing Calculator */}
          <section className="mb-12">
            <div className="bg-white rounded-lg p-8 shadow-elevation-2">
              <h2 className="text-2xl font-bold text-foreground mb-6">Calculateur de prime</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <Input
                  type="number"
                  label="Valeur de l'équipement (€)"
                  placeholder="Ex: 500"
                  value={equipmentValue}
                  onChange={(e) => setEquipmentValue(e?.target?.value)}
                />
                <Input
                  type="number"
                  label="Durée de location (jours)"
                  placeholder="Ex: 3"
                  value={rentalDays}
                  onChange={(e) => setRentalDays(e?.target?.value)}
                />
              </div>
              <Button onClick={calculatePremium} className="w-full md:w-auto">
                Calculer la prime
              </Button>

              {calculatedPremium && (
                <div className="mt-6 p-6 bg-[#17a2b8]/5 rounded-lg border border-[#17a2b8]/20">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Résultat du calcul</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valeur de l'équipement:</span>
                      <span className="font-semibold">{calculatedPremium?.equipmentValue} €</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Durée:</span>
                      <span className="font-semibold">{calculatedPremium?.days} jour{calculatedPremium?.days > 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Prime journalière:</span>
                      <span className="font-semibold">{calculatedPremium?.dailyRate} €/jour</span>
                    </div>
                    <div className="h-px bg-border my-3" />
                    <div className="flex justify-between text-lg">
                      <span className="font-semibold text-foreground">Prime totale:</span>
                      <span className="font-bold text-[#17a2b8]">{calculatedPremium?.total} €</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Comparison Table */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6">Avec ou sans assurance ?</h2>
            <div className="bg-white rounded-lg shadow-elevation-2 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-surface">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-foreground">Caractéristique</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-[#17a2b8]">Avec assurance</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-muted-foreground">Sans assurance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonData?.map((row, index) => (
                      <tr key={index} className="border-t border-border">
                        <td className="px-6 py-4 text-sm text-foreground">{row?.feature}</td>
                        <td className="px-6 py-4 text-center">
                          {typeof row?.withInsurance === 'boolean' ? (
                            row?.withInsurance ? (
                              <Icon name="Check" size={20} className="text-success mx-auto" />
                            ) : (
                              <Icon name="X" size={20} className="text-error mx-auto" />
                            )
                          ) : (
                            <span className="text-sm font-medium text-foreground">{row?.withInsurance}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {typeof row?.withoutInsurance === 'boolean' ? (
                            row?.withoutInsurance ? (
                              <Icon name="Check" size={20} className="text-success mx-auto" />
                            ) : (
                              <Icon name="X" size={20} className="text-error mx-auto" />
                            )
                          ) : (
                            <span className="text-sm text-muted-foreground">{row?.withoutInsurance}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Claims Process */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6">Processus de déclaration de sinistre</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {claimsSteps?.map((step) => (
                <div key={step?.step} className="bg-white rounded-lg p-6 shadow-elevation-1">
                  <div className="w-10 h-10 bg-[#17a2b8] text-white rounded-full flex items-center justify-center font-bold text-lg mb-4">
                    {step?.step}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{step?.title}</h3>
                  <p className="text-sm text-muted-foreground">{step?.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ Section */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6">Questions fréquentes</h2>
            <div className="bg-white rounded-lg shadow-elevation-2 divide-y divide-border">
              {faqs?.map((faq, index) => (
                <div key={index} className="p-6">
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <h3 className="text-lg font-semibold text-foreground pr-4">{faq?.question}</h3>
                    <Icon
                      name={openFaqIndex === index ? 'ChevronUp' : 'ChevronDown'}
                      size={20}
                      className="text-muted-foreground flex-shrink-0"
                    />
                  </button>
                  {openFaqIndex === index && (
                    <p className="mt-4 text-muted-foreground">{faq?.answer}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* CTA Section */}
          <section className="bg-gradient-to-r from-[#17a2b8] to-[#138496] rounded-lg p-8 text-center text-white">
            <h2 className="text-2xl font-bold mb-4">Prêt à louer en toute sérénité ?</h2>
            <p className="text-lg opacity-90 mb-6 max-w-2xl mx-auto">
              Souscrivez à l'assurance lors de votre prochaine réservation et profitez d'une protection complète.
            </p>
            <Button variant="secondary" size="lg" onClick={() => window.location.href = '/accueil-recherche'}>
              Parcourir les annonces
            </Button>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default InsuranceCoverage;