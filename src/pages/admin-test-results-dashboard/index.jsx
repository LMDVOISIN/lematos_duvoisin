import React, { useState } from 'react';
import { AlertTriangle, BarChart3, FileText, Layers, MessageSquare, Users } from 'lucide-react';

import ConfusionMapTab from './components/ConfusionMapTab';
import DebriefsTab from './components/DebriefsTab';
import QuestionnaireAnalysisTab from './components/QuestionnaireAnalysisTab';
import ReportsTab from './components/ReportsTab';
import ScenariosTab from './components/ScenariosTab';
import SessionsTab from './components/SessionsTab';
import TestersTab from './components/TestersTab';

const AdminTestResultsDashboard = () => {
  const [activeTab, setActiveTab] = useState('sessions');

  const tabs = [
    { id: 'sessions', label: 'Seances', icon: BarChart3, component: SessionsTab },
    { id: 'confusion', label: 'Carte de confusion', icon: FileText, component: ConfusionMapTab },
    { id: 'questionnaires', label: 'Questionnaires', icon: MessageSquare, component: QuestionnaireAnalysisTab },
    { id: 'reports', label: 'Signalements', icon: AlertTriangle, component: ReportsTab },
    { id: 'debriefs', label: 'Comptes rendus', icon: FileText, component: DebriefsTab },
    { id: 'testers', label: 'Participants', icon: Users, component: TestersTab },
    { id: 'scenarios', label: 'Parcours', icon: Layers, component: ScenariosTab }
  ];

  const ActiveComponent = tabs?.find((onglet) => onglet?.id === activeTab)?.component;

  return (
    <div className="min-h-screen app-page-gradient">
      <div className="border-b border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-foreground">Tableau de suivi des essais utilisateurs</h1>
          <p className="mt-1 text-muted-foreground">Analysez les resultats et optimisez l'experience utilisateur</p>
        </div>
      </div>

      <div className="border-b border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 overflow-x-auto">
            {tabs?.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  );
};

export default AdminTestResultsDashboard;
