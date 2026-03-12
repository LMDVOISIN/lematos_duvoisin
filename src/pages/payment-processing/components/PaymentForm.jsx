import React, { useState } from 'react';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const PaymentForm = ({ onSubmit, loading, totalAmount }) => {
  const [formData, setFormData] = useState({
    cardNumber: '',
    cardName: '',
    expiryDate: '',
    cvv: ''
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e?.target;
    let processedValue = value;

    if (name === 'cardNumber') {
      processedValue = value?.replace(/\s/g, '')?.replace(/(\d{4})/g, '$1 ')?.trim();
      if (processedValue?.replace(/\s/g, '')?.length > 16) return;
    }

    if (name === 'expiryDate') {
      processedValue = value?.replace(/\D/g, '');
      if (processedValue?.length >= 2) {
        processedValue = processedValue?.slice(0, 2) + '/' + processedValue?.slice(2, 4);
      }
      if (processedValue?.length > 5) return;
    }

    if (name === 'cvv') {
      processedValue = value?.replace(/\D/g, '')?.slice(0, 3);
    }

    setFormData((prev) => ({ ...prev, [name]: processedValue }));
    if (errors?.[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    const cardNumberDigits = formData?.cardNumber?.replace(/\s/g, '');
    if (!cardNumberDigits) {
      newErrors.cardNumber = 'Le numero de carte est requis';
    } else if (cardNumberDigits?.length !== 16) {
      newErrors.cardNumber = 'Le numero de carte doit contenir 16 chiffres';
    } else if (!/^\d+$/.test(cardNumberDigits)) {
      newErrors.cardNumber = 'Le numero de carte est invalide';
    }

    if (!formData?.cardName?.trim()) {
      newErrors.cardName = 'Le nom du titulaire est requis';
    } else if (formData?.cardName?.trim()?.length < 3) {
      newErrors.cardName = 'Le nom doit contenir au moins 3 caracteres';
    }

    if (!formData?.expiryDate) {
      newErrors.expiryDate = "La date d'expiration est requise";
    } else {
      const [month, year] = formData?.expiryDate?.split('/');
      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(`20${year}`, 10);
      const currentYear = new Date()?.getFullYear();
      const currentMonth = new Date()?.getMonth() + 1;

      if (!month || !year || month?.length !== 2 || year?.length !== 2) {
        newErrors.expiryDate = 'Format invalide (MM/AA)';
      } else if (monthNum < 1 || monthNum > 12) {
        newErrors.expiryDate = 'Mois invalide';
      } else if (yearNum < currentYear || (yearNum === currentYear && monthNum < currentMonth)) {
        newErrors.expiryDate = 'Carte expiree';
      }
    }

    if (!formData?.cvv) {
      newErrors.cvv = 'Le CVV est requis';
    } else if (formData?.cvv?.length !== 3) {
      newErrors.cvv = 'Le CVV doit contenir 3 chiffres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors)?.length === 0;
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!validateForm()) return;

    onSubmit?.({
      cardNumber: formData?.cardNumber?.replace(/\s/g, ''),
      cardName: formData?.cardName,
      expiryDate: formData?.expiryDate,
      cvv: formData?.cvv
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-md">
        <Icon name="Info" size={18} className="text-warning flex-shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Aucune transaction réelle n'est exécutée depuis ce formulaire tant que Stripe n'est pas connecté à cette page.
        </p>
      </div>

      <Input
        label="Numero de carte"
        type="text"
        name="cardNumber"
        placeholder="1234 5678 9012 3456"
        value={formData?.cardNumber}
        onChange={handleChange}
        error={errors?.cardNumber}
        required
      />

      <Input
        label="Nom du titulaire"
        type="text"
        name="cardName"
        placeholder="JEAN DUPONT"
        value={formData?.cardName}
        onChange={handleChange}
        error={errors?.cardName}
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Date d'expiration"
          type="text"
          name="expiryDate"
          placeholder="MM/AA"
          value={formData?.expiryDate}
          onChange={handleChange}
          error={errors?.expiryDate}
          required
        />
        <Input
          label="CVV"
          type="text"
          name="cvv"
          placeholder="123"
          value={formData?.cvv}
          onChange={handleChange}
          error={errors?.cvv}
          description="3 chiffres au dos"
          required
        />
      </div>

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={loading}
        className="bg-success hover:bg-success/90 text-success-foreground mt-6"
      >
        <Icon name="Lock" size={20} className="mr-2" />
        Tenter le paiement de {Number(totalAmount || 0)?.toFixed(2)} EUR
      </Button>

      <p className="text-xs text-center text-muted-foreground mt-4">
        Le débit réel sera disponible après intégration Stripe complète sur ce parcours.
      </p>
    </form>
  );
};

export default PaymentForm;


