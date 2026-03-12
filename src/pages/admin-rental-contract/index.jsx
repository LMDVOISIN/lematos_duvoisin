import React, { useEffect, useState } from 'react';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import { Link } from 'react-router-dom';
import legalService from '../../services/legalService';

const CONTRACT_SLUG = 'contrat-location';
const CONTRACT_TITLE = 'Contrat de location';

const DEFAULT_CONTRACT_TEMPLATE = `CONTRAT DE LOCATION ENTRE PARTICULIERS

Entre les soussignés :

LE PROPRIÉTAIRE (ci-après "le Loueur")
Nom : {nom_loueur}
Adresse : {adresse_loueur}
E-mail : {email_loueur}

ET

LE LOCATAIRE (ci-après "le Locataire")
Nom : {nom_locataire}
Adresse : {adresse_locataire}
E-mail : {email_locataire}

ARTICLE 1 - OBJET DE LA LOCATION
- Désignation : {nom_equipement}
- Description : {description_equipement}
- ?tat : {etat_equipement}

ARTICLE 2 - DURÉE DE LA LOCATION
- Date de début : {date_debut}
- Date de fin : {date_fin}
- Durée totale : {duree_jours} jours

ARTICLE 3 - PRIX ET MODALITÉS DE PAIEMENT
- Prix journalier : {prix_journalier} EUR
- Prix total : {prix_total} EUR
- Caution : {montant_caution} EUR

ARTICLE 4 - OBLIGATIONS DU LOCATAIRE
- Utiliser le matériel avec soin
- Restituer le matériel dans son état initial
- Respecter les conditions d'utilisation
- Déposer une pièce d'identité valide avant la remise du matériel

ARTICLE 5 - CAUTION
Une caution de {montant_caution} EUR est garantie uniquement par empreinte bancaire (CB):
- empreinte CB autorisée (non débitée) au paiement puis libérée, maintenue ou capturée selon le workflow officiel de fin de location;
- aucun frais de traitement ne s'applique tant que l'empreinte CB n'est pas capturée;
- si la pièce d'identité n'est pas déposée à temps, la réservation peut être annulée, un jour de location conservé et le solde remboursé;
- en cas de litige valide, l'empreinte CB peut etre capturee totalement ou partiellement selon le protocole officiel; dans ce cas, les frais de paiement carte sur le montant capture et d'eventuels frais de litige peuvent s'appliquer selon le reseau de carte.

Fait à {ville}, le {date_signature}

Signature du Loueur          Signature du Locataire`;

const VARIABLES = [
  { name: '{nom_loueur}', description: 'Nom du propriétaire' },
  { name: '{nom_locataire}', description: 'Nom du locataire' },
  { name: '{nom_equipement}', description: 'Nom de l??quipement' },
  { name: '{prix_journalier}', description: 'Prix par jour' },
  { name: '{prix_total}', description: 'Prix total de la location' },
  { name: '{montant_caution}', description: 'Montant de la caution' },
  { name: '{date_debut}', description: 'Date de début de location' },
  { name: '{date_fin}', description: 'Date de fin de location' },
  { name: '{duree_jours}', description: 'Durée en jours' }
];

const AdminRentalContract = () => {
  const [contractContent, setContractContent] = useState(DEFAULT_CONTRACT_TEMPLATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    loadContractTemplate();
  }, []);

  const loadContractTemplate = async () => {
    try {
      setLoading(true);
      setFetchError('');
      setStatusMessage('');

      const { data, error } = await legalService?.getLegalPage(CONTRACT_SLUG);
      if (error) throw error;

      setContractContent(data?.content || DEFAULT_CONTRACT_TEMPLATE);
    } catch (error) {
      console.error('Erreur de chargement du contrat:', error);
      setFetchError(error?.message || 'Impossible de charger le modèle de contrat');
      setContractContent(DEFAULT_CONTRACT_TEMPLATE);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setFetchError('');
      setStatusMessage('');

      const { error } = await legalService?.updateLegalPage(CONTRACT_SLUG, CONTRACT_TITLE, contractContent || '');
      if (error) throw error;

      setStatusMessage('Modèle de contrat enregistré avec succès');
    } catch (error) {
      console.error('Erreur de sauvegarde du contrat:', error);
      setFetchError(error?.message || 'Impossible de sauvegarder le modèle de contrat');
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreDefault = () => {
    const confirmed = window?.confirm('Revenir au modèle de contrat par défaut ?');
    if (!confirmed) return;
    setContractContent(DEFAULT_CONTRACT_TEMPLATE);
    setStatusMessage('Modèle par défaut restauré (non enregistré)');
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <main className="flex-1 container mx-auto px-4 pt-20 pb-6 md:pt-24 md:pb-8">
        <div className="mb-6">
          <Link to="/administration-tableau-bord" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
            <Icon name="ArrowLeft" size={16} />
            Retour au tableau de bord
          </Link>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Modifier le contrat de location</h1>
            <p className="text-muted-foreground">Personnalisez le modèle de contrat entre particuliers</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" iconName="RotateCcw" onClick={handleRestoreDefault}>
              Restaurer le modèle
            </Button>
            <Button iconName="Save" loading={saving} onClick={handleSave}>
              Enregistrer
            </Button>
          </div>
        </div>

        {fetchError && (
          <div className="bg-error/10 border border-error/20 text-error rounded-lg px-4 py-3 mb-6 text-sm">
            {fetchError}
          </div>
        )}

        {statusMessage && (
          <div className="bg-success/10 border border-success/20 text-success rounded-lg px-4 py-3 mb-6 text-sm">
            {statusMessage}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-elevation-1 p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Variables disponibles</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Utilisez ces variables dans le modèle. Elles seront remplacées automatiquement lors de la génération.
              </p>
              <div className="space-y-3">
                {VARIABLES?.map((variable) => (
                  <div key={variable?.name} className="p-3 bg-surface rounded-md">
                    <code className="text-xs font-mono text-blue-600 font-semibold">{variable?.name}</code>
                    <p className="text-xs text-muted-foreground mt-1">{variable?.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-elevation-1 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Contenu du contrat</h2>
                <Button variant="outline" size="sm" iconName="RefreshCw" onClick={loadContractTemplate} loading={loading}>
                  Recharger
                </Button>
              </div>
              <div className="border border-border rounded-md p-4 bg-white">
                <textarea
                  className="w-full font-mono text-sm focus:outline-none resize-none"
                  rows={30}
                  value={contractContent}
                  onChange={(e) => setContractContent(e?.target?.value || '')}
                  style={{ minHeight: '600px' }}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-elevation-1 p-6 mt-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Informations</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <Icon name="Info" size={16} className="text-blue-600 mt-0.5" />
                  <p className="text-muted-foreground">Le contrat est généré automatiquement pour chaque réservation.</p>
                </div>
                <div className="flex items-start gap-2">
                  <Icon name="FileText" size={16} className="text-blue-600 mt-0.5" />
                  <p className="text-muted-foreground">Les utilisateurs peuvent télécharger le contrat en PDF depuis leur réservation.</p>
                </div>
                <div className="flex items-start gap-2">
                  <Icon name="Shield" size={16} className="text-blue-600 mt-0.5" />
                  <p className="text-muted-foreground">Ce modèle sert de base contractuelle entre propriétaire et locataire.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AdminRentalContract;


