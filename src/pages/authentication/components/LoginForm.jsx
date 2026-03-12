import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import { clearAuthRedirectPath, resolveAuthRedirectPath } from '../../../utils/authRedirect';

const LoginForm = ({ onForgotPassword }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e?.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors?.[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData?.email) {
      newErrors.email = 'L\'adresse e-mail est requise';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/?.test(formData?.email)) {
      newErrors.email = 'Adresse e-mail invalide';
    }

    if (!formData?.password) {
      newErrors.password = 'Le mot de passe est requis';
    }

    setErrors(newErrors);
    return Object.keys(newErrors)?.length === 0;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    const redirectAfterLogin = resolveAuthRedirectPath(location, '/accueil-recherche');

    try {
      const { data, error } = await signIn(formData?.email, formData?.password);

      if (error) {
        console.error('Erreur de connexion :', error);
        toast?.error(error?.message || 'Identifiants incorrects');
        setLoading(false);
        return;
      }

      toast?.success('Connexion réussie !', {
        duration: 2000,
        position: 'top-center'
      });

      setTimeout(() => {
        clearAuthRedirectPath();
        navigate(redirectAfterLogin, { replace: true });
      }, 500);

    } catch (err) {
      console.error('Erreur inattendue de connexion :', err);
      toast?.error('Une erreur inattendue est survenue');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
      <Input
        label="Adresse e-mail"
        type="email"
        name="email"
        placeholder="votre.courriel@exemple.fr"
        value={formData?.email}
        onChange={handleChange}
        error={errors?.email}
        required
      />
      <Input
        label="Mot de passe"
        type="password"
        name="password"
        placeholder="Entrez votre mot de passe"
        value={formData?.password}
        onChange={handleChange}
        error={errors?.password}
        required
      />
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onForgotPassword}
          className="text-primary hover:underline font-medium"
        >
          Mot de passe oublié ?
        </button>
      </div>
      <Button
        type="submit"
        variant="default"
        size="lg"
        fullWidth
        loading={loading}
        iconName="LogIn"
        iconPosition="right"
      >
        Se connecter
      </Button>
    </form>
  );
};

export default LoginForm;

