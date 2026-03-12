import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, Navigate, useLocation } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import Image from '../../components/AppImage';
import AuthTabs from './components/AuthTabs';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import SocialAuth from './components/SocialAuth';
import ForgotPasswordModal from './components/ForgotPasswordModal';
import TrustSignals from './components/TrustSignals';
import Footer from '../../components/Footer';
import { useAuth } from '../../contexts/AuthContext';

const Authentication = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('connexion');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { isAuthenticated, loading } = useAuth();

  const redirectAfterAuth =
    typeof location?.state?.from === 'string' &&
    location?.state?.from?.startsWith('/') &&
    location?.state?.from !== '/authentification'
      ? location?.state?.from
      : '/accueil-recherche';

  if (loading) {
    return (
      <>
        <Helmet>
          <title>Connexion & Inscription - Le Matos Du Voisin</title>
          <meta name="description" content="Chargement de la session utilisateur" />
        </Helmet>
        <div className="min-h-screen bg-gradient-to-b from-[#e9f4ff] via-[#f2f8ff] to-[#e7f5ff] flex items-center justify-center px-4">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/70 mb-4">
              <Icon name="Loader2" size={24} className="animate-spin text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Chargement...</p>
          </div>
        </div>
      </>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={redirectAfterAuth} replace />;
  }

  return (
    <>
      <Helmet>
        <title>Connexion & Inscription - Le Matos Du Voisin</title>
        <meta name="description" content="Connectez-vous ou créez votre compte pour louer du matériel entre voisins en toute sécurité" />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-[#e9f4ff] via-[#f2f8ff] to-[#e7f5ff] flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4 md:p-6 lg:items-start lg:pt-10 lg:pb-8">
          <div className="w-full max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 lg:gap-12 items-start">
              <div className="hidden lg:block">
                <div className="space-y-6">
                  <Link to="/accueil-recherche" className="flex items-center gap-3">
                    <img
                      src="/assets/images/android-chrome-192x192-1771179342850.png"
                      alt="Logo Le Matos Du Voisin - poignée de main formant un cœur"
                      className="w-12 h-12 object-contain"
                    />
                    <h1 className="text-3xl lg:text-4xl font-bold text-foreground">
                      Le Matos Du Voisin
                    </h1>
                  </Link>

                  <div className="space-y-4">
                    <h2 className="text-2xl lg:text-3xl font-semibold text-foreground">
                      Louez du matériel entre voisins
                    </h2>
                    <p className="text-base lg:text-lg text-muted-foreground">
                      Accédez à des milliers d'équipements disponibles près de chez vous. Économisez de l'argent et participez à l'économie collaborative.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {[
                      {
                        icon: 'CheckCircle',
                        title: 'Paiement sécurisé',
                        description: 'Transactions protégées avec workflow encadré des cautions'
                      },
                      {
                        icon: 'ShieldCheck',
                        title: 'Litiges encadrés',
                        description: "État des lieux, contestation et modération selon les conditions applicables"
                      },
                      {
                        icon: 'BadgeCheck',
                        title: 'Vérification des profils',
                        description: 'Controle des comptes et moderation continue pour des echanges fiables'
                      },
                      {
                        icon: 'MessageSquare',
                        title: 'Communication directe',
                        description: 'Échangez facilement avec les propriétaires via notre messagerie intégrée'
                      }
                    ]?.map((feature, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-success/10 flex-shrink-0 mt-1">
                          <Icon name={feature?.icon} size={20} color="var(--color-success)" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-foreground mb-1">
                            {feature?.title}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {feature?.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="relative h-64 lg:h-80 rounded-xl overflow-hidden shadow-elevation-3">
                    <Image
                      src="https://img.rocket.new/generatedImages/rocket_gen_img_1d59048a9-1765819001368.png"
                      alt="Deux personnes souriantes échangeant du matériel de bricolage dans un garage résidentiel moderne avec outils et équipements en arrière-plan"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>

              <div className="w-full">
                <div className="bg-card rounded-xl shadow-elevation-3 border border-border p-6 md:p-8">
                  <div className="lg:hidden mb-6">
                    <Link to="/accueil-recherche" className="flex items-center gap-3 justify-center mb-4">
                      <img
                        src="/assets/images/android-chrome-192x192-1771179342850.png"
                        alt="Logo Le Matos Du Voisin - poignée de main formant un cœur"
                        className="w-12 h-12 object-contain"
                      />
                      <h1 className="text-2xl font-bold text-foreground">
                        Le Matos Du Voisin
                      </h1>
                    </Link>
                    <p className="text-center text-sm text-muted-foreground">
                      Louez du matériel entre voisins en toute sécurité
                    </p>
                  </div>

                  <AuthTabs activeTab={activeTab} onTabChange={setActiveTab} />

                  {activeTab === 'connexion' ? (
                    <LoginForm onForgotPassword={() => setShowForgotPassword(true)} />
                  ) : (
                    <RegisterForm />
                  )}

                  <div className="mt-6 md:mt-8">
                    <SocialAuth />
                  </div>

                  <TrustSignals />
                </div>

                <div className="mt-4 text-center">
                  <p className="text-xs md:text-sm text-muted-foreground">
                    En vous connectant, vous acceptez nos{' '}
                    <a href="#" className="text-primary hover:underline">
                      Conditions d'utilisation
                    </a>{' '}
                    et notre{' '}
                    <a href="#" className="text-primary hover:underline">
                      Politique de confidentialité
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </div>
      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </>
  );
};

export default Authentication;
