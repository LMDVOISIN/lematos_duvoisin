import React, { useState } from 'react';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import {
  ActionCard,
  ActionHero,
  ActionPageShell
} from '../../components/page/ActionPageLayout';

const InsuranceCoverage = () => {
  const [equipmentValue, setEquipmentValue] = useState('');
  const [rentalDays, setRentalDays] = useState('');
  const [calculatedPremium, setCalculatedPremium] = useState(null);
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  const benefits = [
    {
      icon: 'Shield',
      title: 'Vol',
      description: "Couverture pendant toute la location si l'equipement disparait."
    },
    {
      icon: 'AlertTriangle',
      title: 'Casse accidentelle',
      description: 'Prise en charge des dommages non intentionnels.'
    },
    {
      icon: 'Wrench',
      title: 'Deterioration',
      description: "Protection quand l'etat du materiel se degrade de facon anormale."
    },
    {
      icon: 'Clock',
      title: 'Assistance',
      description: 'Aide disponible pour declarer un sinistre et lancer la suite.'
    }
  ];

  const comparisonData = [
    { feature: "Vol de l'equipement", withInsurance: true, withoutInsurance: false },
    { feature: 'Casse accidentelle', withInsurance: true, withoutInsurance: false },
    { feature: 'Deterioration', withInsurance: true, withoutInsurance: false },
    { feature: 'Franchise', withInsurance: '50 EUR', withoutInsurance: 'Caution complete' },
    { feature: 'Traitement', withInsurance: '48h', withoutInsurance: '7 a 14 jours' },
    { feature: 'Assistance', withInsurance: '24/7', withoutInsurance: 'Non disponible' }
  ];

  const claimsSteps = [
    {
      step: 1,
      title: 'Signaler',
      description: 'Declarez le sinistre dans les 24h.'
    },
    {
      step: 2,
      title: 'Envoyer les preuves',
      description: 'Ajoutez photos et documents utiles.'
    },
    {
      step: 3,
      title: 'Evaluation',
      description: 'Le dossier est examine rapidement.'
    },
    {
      step: 4,
      title: 'Indemnisation',
      description: 'Remboursement ou remplacement selon le dossier.'
    }
  ];

  const faqs = [
    {
      question: "Comment souscrire a l'assurance ?",
      answer: "L'option est proposee au moment de la reservation, puis reste disponible jusqu'a 24h avant le debut de location."
    },
    {
      question: 'Comment est calcule le prix ?',
      answer: 'La prime correspond a 8% de la valeur declaree par jour de location, avec un minimum de 2 EUR par jour.'
    },
    {
      question: "Que couvre l'assurance ?",
      answer: 'Le vol, la casse accidentelle et la deterioration non intentionnelle pendant la location.'
    },
    {
      question: 'Puis-je annuler ?',
      answer: "Oui jusqu'a 24h avant le debut de location pour un remboursement complet."
    }
  ];

  const calculatePremium = () => {
    const value = Number.parseFloat(equipmentValue);
    const days = Number.parseInt(rentalDays, 10);

    if (!value || !days || value <= 0 || days <= 0) {
      window.alert('Veuillez entrer des valeurs valides');
      return;
    }

    const dailyRate = Math.max(value * 0.08, 2);
    const total = dailyRate * days;

    setCalculatedPremium({
      dailyRate: dailyRate.toFixed(2),
      total: total.toFixed(2),
      equipmentValue: value.toFixed(2),
      days
    });
  };

  const toggleFaq = (index) => {
    setOpenFaqIndex((previous) => (previous === index ? null : index));
  };

  return (
    <ActionPageShell
      maxWidth="max-w-6xl"
      hero={(
        <ActionHero
          eyebrow="Assurance location"
          title="Protection pendant la location"
          subtitle="Estimez le cout puis voyez ce qui est couvert."
          pills={[
            { label: 'Calculateur', icon: 'Calculator' },
            { label: 'Couverture', icon: 'Shield' },
            { label: 'Sinistre', icon: 'TriangleAlert' }
          ]}
          tone="warm"
        />
      )}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <ActionCard className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
              <Icon name="Calculator" size={22} />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Calculateur express</h2>
              <p className="text-sm text-slate-600">Entrez la valeur et la duree pour voir le cout tout de suite.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              type="number"
              label="Valeur de l'equipement (EUR)"
              placeholder="Ex: 500"
              value={equipmentValue}
              onChange={(event) => setEquipmentValue(event?.target?.value || '')}
            />
            <Input
              type="number"
              label="Duree de location (jours)"
              placeholder="Ex: 3"
              value={rentalDays}
              onChange={(event) => setRentalDays(event?.target?.value || '')}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={calculatePremium}>
              <Icon name="Calculator" size={18} />
              Calculer ma prime
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/accueil-recherche'}>
              Voir les annonces
            </Button>
          </div>

          {calculatedPremium ? (
            <div className="rounded-[24px] border border-sky-200 bg-sky-50/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Resultat</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Valeur</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{calculatedPremium?.equipmentValue} EUR</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Duree</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {calculatedPremium?.days} jour{calculatedPremium?.days > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Prime par jour</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{calculatedPremium?.dailyRate} EUR</p>
                </div>
                <div className="rounded-2xl bg-slate-950 px-4 py-3 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">Total</p>
                  <p className="mt-2 text-2xl font-semibold">{calculatedPremium?.total} EUR</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
              Entrez vos chiffres puis lancez le calcul. Le montant s'affiche ici sans changer le parcours.
            </div>
          )}
        </ActionCard>

        <ActionCard className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Couverture</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">Ce que vous protegez</h2>
          </div>

          <div className="grid gap-3">
            {benefits?.map((benefit) => (
              <div key={benefit?.title} className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#0f7081] shadow-sm">
                    <Icon name={benefit?.icon} size={18} />
                  </span>
                  <div>
                    <p className="font-semibold text-slate-950">{benefit?.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{benefit?.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-[24px] border border-amber-200 bg-amber-50/80 px-4 py-4 text-sm text-amber-900">
            Sans assurance, la caution complete peut rester le principal filet de securite.
          </div>
        </ActionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <ActionCard className="overflow-hidden p-0">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-xl font-semibold text-slate-950">Avec ou sans assurance</h2>
            <p className="mt-1 text-sm text-slate-600">Le but est de voir tout de suite ce qui change.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Point compare</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Avec</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Sans</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData?.map((row) => (
                  <tr key={row?.feature} className="border-t border-slate-200">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{row?.feature}</td>
                    <td className="px-6 py-4 text-center">
                      {typeof row?.withInsurance === 'boolean' ? (
                        row?.withInsurance ? (
                          <Icon name="Check" size={18} className="mx-auto text-emerald-600" />
                        ) : (
                          <Icon name="X" size={18} className="mx-auto text-rose-600" />
                        )
                      ) : (
                        <span className="text-sm font-semibold text-slate-900">{row?.withInsurance}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {typeof row?.withoutInsurance === 'boolean' ? (
                        row?.withoutInsurance ? (
                          <Icon name="Check" size={18} className="mx-auto text-emerald-600" />
                        ) : (
                          <Icon name="X" size={18} className="mx-auto text-rose-600" />
                        )
                      ) : (
                        <span className="text-sm text-slate-600">{row?.withoutInsurance}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ActionCard>

        <ActionCard className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">En cas de pepin</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">La suite, etape par etape</h2>
          </div>

          <div className="space-y-3">
            {claimsSteps?.map((step) => (
              <div key={step?.step} className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
                    {step?.step}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-950">{step?.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{step?.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ActionCard>
      </div>

      <ActionCard className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Questions rapides</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">FAQ utile</h2>
          </div>
          <p className="text-sm text-slate-600">Ouvrez seulement la reponse qu'il vous faut.</p>
        </div>

        <div className="space-y-3">
          {faqs?.map((faq, index) => {
            const isOpen = openFaqIndex === index;

            return (
              <div key={faq?.question} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <p className="text-sm font-semibold text-slate-950 md:text-base">{faq?.question}</p>
                  <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${isOpen ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
                    <Icon name={isOpen ? 'ChevronUp' : 'ChevronDown'} size={18} />
                  </span>
                </button>

                {isOpen ? (
                  <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
                    <p className="text-sm text-slate-700">{faq?.answer}</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </ActionCard>
    </ActionPageShell>
  );
};

export default InsuranceCoverage;
