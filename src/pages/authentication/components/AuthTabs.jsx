import React from 'react';

const AuthTabs = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'connexion', label: 'Connexion' },
    { id: 'inscription', label: 'Inscription' }
  ];

  return (
    <div className="flex gap-2 p-1 bg-muted rounded-lg mb-6 md:mb-8">
      {tabs?.map((tab) => (
        <button
          key={tab?.id}
          onClick={() => onTabChange(tab?.id)}
          className={`flex-1 py-2.5 md:py-3 px-4 rounded-md text-sm md:text-base font-medium transition-smooth ${
            activeTab === tab?.id
              ? 'bg-primary text-primary-foreground shadow-elevation-2'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {tab?.label}
        </button>
      ))}
    </div>
  );
};

export default AuthTabs;
