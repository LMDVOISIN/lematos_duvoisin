import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import contractService from '../../services/contractService';
import reservationService from '../../services/reservationService';

const ContractGenerationPreview = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reservationId = searchParams?.get('reservationId');

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reservation, setReservation] = useState(null);
  const [contractUrl, setContractUrl] = useState(null);
  const [contractAccepted, setContractAccepted] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [error, setError] = useState(null);
  const [generationStatus, setGenerationStatus] = useState('idle'); // idle, generating, processing, completed

  useEffect(() => {
    if (reservationId) {
      loadReservationAndContract();
    } else {
      setError('ID de réservation manquant');
      setLoading(false);
    }
  }, [reservationId]);

  const loadReservationAndContract = async () => {
    try {
      setLoading(true);
      
      // Load reservation
      const { data: resData, error: resError } = await reservationService?.getReservationById(reservationId);
      if (resError) throw resError;
      setReservation(resData);

      // Check if contract exists
      const { data: contractData, error: contractError } = await contractService?.getContractUrl(reservationId);
      if (!contractError && contractData?.contract_url) {
        setContractUrl(contractData?.contract_url);
        setGenerationStatus('completed');
      }

      setLoading(false);
    } catch (err) {
      console.error('Load error:', err);
      setError(err?.message || 'Erreur de chargement');
      setLoading(false);
    }
  };

  const handleGenerateContract = async () => {
    try {
      setGenerating(true);
      setGenerationStatus('generating');
      setError(null);

      // Simulate generation progress
      setTimeout(() => setGenerationStatus('processing'), 1000);

      const { url, error: genError } = await contractService?.generateAndSaveContract(reservationId);
      
      if (genError) throw genError;

      setContractUrl(url);
      setGenerationStatus('completed');
      setGenerating(false);
    } catch (err) {
      console.error('Generation error:', err);
      setError(err?.message || 'Erreur de génération');
      setGenerationStatus('idle');
      setGenerating(false);
    }
  };

  const handleAcceptContract = async () => {
    try {
      const { error: acceptError } = await contractService?.acceptContract(reservationId);
      if (acceptError) throw acceptError;

      // Update reservation status to allow payment
      await reservationService?.updateReservationStatus(reservationId, 'accepted', {
        contract_accepted_at: new Date()?.toISOString()
      });

      alert('Contrat accepté ! Vous pouvez maintenant procéder au paiement.');
      navigate(`/traitement-paiement?reservationId=${reservationId}`);
    } catch (err) {
      console.error('Accept error:', err);
      setError(err?.message || 'Erreur d\'acceptation');
    }
  };

  const handleDownload = () => {
    if (contractUrl) {
      window.open(contractUrl, '_blank');
    }
  };

  const getStatusBadge = () => {
    const configs = {
      idle: { label: 'Non généré', color: 'bg-surface text-surface-foreground', icon: 'FileText' },
      generating: { label: 'Génération...', color: 'bg-primary/15 text-primary', icon: 'Loader' },
      processing: { label: 'Traitement...', color: 'bg-yellow-100 text-yellow-700', icon: 'Clock' },
      completed: { label: 'Disponible', color: 'bg-green-100 text-green-700', icon: 'CheckCircle' }
    };

    const config = configs?.[generationStatus] || configs?.idle;

    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${config?.color}`}>
        <Icon name={config?.icon} className={`w-4 h-4 ${generationStatus === 'generating' ? 'animate-spin' : ''}`} />
        <span className="text-sm font-medium">{config?.label}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen app-page-gradient flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Icon name="Loader" className="w-8 h-8 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen app-page-gradient flex flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* En-tête */}
          <div className="mb-6">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
            >
              <Icon name="ArrowLeft" className="w-5 h-5" />
              <span>Retour</span>
            </button>
            <h1 className="text-3xl font-bold text-foreground">Contrat de location</h1>
            <p className="text-muted-foreground mt-2">Référence: {reservationId}</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
              <Icon name="AlertCircle" className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900">Erreur</h3>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Status Card */}
          <div className="bg-white rounded-xl shadow-sm border border-border p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground">Statut du contrat</h2>
              {getStatusBadge()}
            </div>

            {/* Progress indicators */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  generationStatus !== 'idle' ? 'bg-green-100' : 'bg-surface'
                }`}>
                  <Icon 
                    name={generationStatus !== 'idle' ? 'Check' : 'FileText'} 
                    className={`w-4 h-4 ${generationStatus !== 'idle' ? 'text-green-600' : 'text-muted-foreground'}`} 
                  />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Génération du PDF</p>
                  <p className="text-sm text-muted-foreground">
                    {generationStatus === 'idle' ? 'En attente' : 'Terminé'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  generationStatus === 'completed' ? 'bg-green-100' : 'bg-surface'
                }`}>
                  <Icon 
                    name={generationStatus === 'completed' ? 'Check' : 'Upload'} 
                    className={`w-4 h-4 ${generationStatus === 'completed' ? 'text-green-600' : 'text-muted-foreground'}`} 
                  />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Stockage sécurisé</p>
                  <p className="text-sm text-muted-foreground">
                    {generationStatus === 'completed' ? 'Document enregistré' : 'En attente'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Reservation summary */}
          {reservation && (
            <div className="bg-white rounded-xl shadow-sm border border-border p-6 mb-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Détails de la réservation</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Équipement</p>
                  <p className="font-medium text-foreground">{reservation?.annonce?.titre}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Période</p>
                  <p className="font-medium text-foreground">
                    {new Date(reservation?.start_date)?.toLocaleDateString('fr-FR')} - {new Date(reservation?.end_date)?.toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Montant total</p>
                  <p className="font-medium text-foreground">{reservation?.total_amount?.toFixed(2)} €</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Caution</p>
                  <p className="font-medium text-foreground">{reservation?.caution_amount?.toFixed(2)} €</p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-border p-6">
            {generationStatus === 'idle' && (
              <div className="text-center">
                <Icon name="FileText" className="w-16 h-16 text-muted-foreground/60 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Générer le contrat</h3>
                <p className="text-muted-foreground mb-6">Cliquez sur le bouton ci-dessous pour générer votre contrat de location au format PDF.</p>
                <Button
                  onClick={handleGenerateContract}
                  disabled={generating}
                  className="mx-auto"
                >
                  {generating ? (
                    <>
                      <Icon name="Loader" className="w-5 h-5 animate-spin" />
                      Génération en cours...
                    </>
                  ) : (
                    <>
                      <Icon name="FileText" className="w-5 h-5" />
                      Générer le contrat
                    </>
                  )}
                </Button>
              </div>
            )}

            {generationStatus === 'completed' && contractUrl && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Icon name="CheckCircle" className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Contrat disponible</h3>
                    <p className="text-muted-foreground">Votre contrat a été généré avec succès</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-3">
                    <Button
                      onClick={() => setShowPreviewModal(true)}
                      variant="outline"
                      className="flex-1"
                    >
                      <Icon name="Eye" className="w-5 h-5" />
                      Prévisualiser
                    </Button>
                    <Button
                      onClick={handleDownload}
                      variant="outline"
                      className="flex-1"
                    >
                      <Icon name="Download" className="w-5 h-5" />
                      Télécharger
                    </Button>
                  </div>

                  <div className="border-t pt-4">
                    <div className="bg-primary/10 border border-primary/25 rounded-lg p-4 mb-4">
                      <div className="flex items-start gap-3">
                        <Icon name="Info" className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-primary">
                          <p className="font-medium mb-1">Acceptation requise</p>
                          <p>Vous devez accepter les termes du contrat avant de procéder au paiement.</p>
                        </div>
                      </div>
                    </div>

                    <Checkbox
                      checked={contractAccepted}
                      onChange={(e) => setContractAccepted(e?.target?.checked)}
                      label="J'accepte les termes du contrat"
                      className="mb-4"
                    />

                    <Button
                      onClick={handleAcceptContract}
                      disabled={!contractAccepted}
                      className="w-full"
                    >
                      <Icon name="CheckCircle" className="w-5 h-5" />
                      Accepter et procéder au paiement
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      {/* Preview Modal */}
      {showPreviewModal && contractUrl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-foreground">Prévisualisation du contrat</h3>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-2 hover:bg-surface rounded-lg transition-colors"
              >
                <Icon name="X" className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <iframe
                src={contractUrl}
                className="w-full h-full min-h-[600px] border rounded-lg"
                title="Contract Preview"
              />
            </div>
            <div className="p-4 border-t flex gap-3">
              <Button
                onClick={handleDownload}
                variant="outline"
                className="flex-1"
              >
                <Icon name="Download" className="w-5 h-5" />
                Télécharger
              </Button>
              <Button
                onClick={() => setShowPreviewModal(false)}
                className="flex-1"
              >
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
};

export default ContractGenerationPreview;


