import React, { useState } from 'react';
import { Monitor, Smartphone, Tablet } from 'lucide-react';
import Icon from '../../AppIcon';


const TesterOnboarding = ({ onComplete }) => {
  const [system, setSystem] = useState('');
  const [screenType, setScreenType] = useState('');
  const [browser, setBrowser] = useState('');

  const handleSubmit = () => {
    if (system && screenType && browser) {
      onComplete({ system, screenType, browser });
    }
  };

  const isComplete = system && screenType && browser;

  return (
    <div className="min-h-screen app-page-gradient flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Bienvenue participant !</h2>
        <p className="text-gray-600 mb-6">
          Avant de commencer, merci de renseigner votre contexte d'essai :
        </p>

        {/* System */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Système d'exploitation
          </label>
          <div className="grid grid-cols-3 gap-3">
            {['Windows', 'Mac', 'Linux']?.map((os) => (
              <button
                key={os}
                onClick={() => setSystem(os)}
                className={`py-3 px-4 rounded-lg border-2 font-medium transition-colors ${
                  system === os
                    ? 'border-blue-500 bg-blue-50 text-blue-700' :'border-gray-300 hover:border-blue-500'
                }`}
              >
                {os}
              </button>
            ))}
          </div>
        </div>

        {/* Screen Type */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Type d'écran
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'Desktop', icon: Monitor, label: 'Ordinateur' },
              { value: 'Tablet', icon: Tablet, label: 'Tablette' },
              { value: 'Mobile', icon: Smartphone, label: 'Mobile' }
            ]?.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => setScreenType(value)}
                className={`py-3 px-4 rounded-lg border-2 font-medium transition-colors flex flex-col items-center gap-2 ${
                  screenType === value
                    ? 'border-blue-500 bg-blue-50 text-blue-700' :'border-gray-300 hover:border-blue-500'
                }`}
              >
                <Icon className="w-6 h-6" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Browser */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Navigateur
          </label>
          <div className="grid grid-cols-4 gap-3">
            {['Chrome', 'Firefox', 'Safari', 'Edge']?.map((br) => (
              <button
                key={br}
                onClick={() => setBrowser(br)}
                className={`py-3 px-4 rounded-lg border-2 font-medium transition-colors ${
                  browser === br
                    ? 'border-blue-500 bg-blue-50 text-blue-700' :'border-gray-300 hover:border-blue-500'
                }`}
              >
                {br}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!isComplete}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Commencer les essais
        </button>
      </div>
    </div>
  );
};

export default TesterOnboarding;
