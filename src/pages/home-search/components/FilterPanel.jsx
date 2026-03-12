import React, { useState } from 'react';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const FilterPanel = ({ isOpen, onClose, onApplyFiltres }) => {
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [distance, setDistance] = useState('10');

  const distanceOptions = [
    { value: '5', label: '5 km' },
    { value: '10', label: '10 km' },
    { value: '25', label: '25 km' },
    { value: '50', label: '50 km' },
    { value: '100', label: '100 km' }
  ];

  const handleApply = () => {
    onApplyFiltres({
      priceMin,
      priceMax,
      startDate,
      endDate,
      distance
    });
    onClose();
  };

  const handleReset = () => {
    setPriceMin('');
    setPriceMax('');
    setStartDate('');
    setEndDate('');
    setDistance('10');
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
        onClick={onClose}
      />
      <div className={`fixed lg:relative inset-y-0 right-0 w-full sm:w-96 lg:w-full bg-card shadow-elevation-3 lg:shadow-elevation-2 rounded-l-2xl lg:rounded-2xl p-4 md:p-6 z-50 lg:z-auto transition-smooth ${
        isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
      }`}>
        <div className="flex items-center justify-between mb-4 md:mb-6 lg:hidden">
          <h3 className="text-lg md:text-xl font-semibold text-foreground">Filtres avancés</h3>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-muted transition-smooth"
          >
            <Icon name="X" size={24} />
          </button>
        </div>

        <div className="hidden lg:block mb-4 md:mb-6">
          <h3 className="text-lg md:text-xl font-semibold text-foreground">Filtres avancés</h3>
        </div>

        <div className="space-y-4 md:space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Prix journalier (€)
            </label>
            <div className="flex gap-3">
              <Input
                type="number"
                placeholder="Min"
                value={priceMin}
                onChange={(e) => setPriceMin(e?.target?.value)}
                min="0"
              />
              <Input
                type="number"
                placeholder="Max"
                value={priceMax}
                onChange={(e) => setPriceMax(e?.target?.value)}
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Dates de disponibilité
            </label>
            <div className="space-y-3">
              <Input
                type="date"
                label="Date de début"
                value={startDate}
                onChange={(e) => setStartDate(e?.target?.value)}
              />
              <Input
                type="date"
                label="Date de fin"
                value={endDate}
                onChange={(e) => setEndDate(e?.target?.value)}
                min={startDate}
              />
            </div>
          </div>

          <div>
            <Select
              label="Rayon de recherche"
              options={distanceOptions}
              value={distance}
              onChange={setDistance}
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              fullWidth
              onClick={handleReset}
            >
              Réinitialiser
            </Button>
            <Button
              variant="default"
              fullWidth
              onClick={handleApply}
            >
              Appliquer
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default FilterPanel;
