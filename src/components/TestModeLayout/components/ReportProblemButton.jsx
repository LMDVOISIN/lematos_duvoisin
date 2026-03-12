import React, { useState } from 'react';
import { AlertCircle, Upload, X } from 'lucide-react';
import userTestingService from '../../../services/userTestingService';

const ReportProblemButton = ({ sessionId, currentPageUrl }) => {
  const [showModal, setShowModal] = useState(false);
  const [severity, setSeverity] = useState('medium');
  const [description, setDescription] = useState('');
  const [reproductionSteps, setReproductionSteps] = useState('');
  const [screenshots, setScreenshots] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleFileSelect = (e) => {
    const files = Array.from(e?.target?.files);
    setScreenshots(prev => [...prev, ...files]);
  };

  const removeScreenshot = (index) => {
    setScreenshots(prev => prev?.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!description?.trim()) return;

    setUploading(true);

    try {
      // Téléverser des captures d'écran
      const screenshotUrls = [];
      for (const file of screenshots) {
        const { data } = await userTestingService?.uploadScreenshot(file, sessionId);
        if (data?.url) {
          screenshotUrls?.push(data?.url);
        }
      }

      // Creer le signalement
      await userTestingService?.createReport({
        sessionId,
        pageUrl: currentPageUrl,
        severity,
        description,
        reproductionSteps,
        screenshotUrls
      });

      setSuccess(true);
      setTimeout(() => {
        setShowModal(false);
        setSuccess(false);
        setDescription('');
        setReproductionSteps('');
        setScreenshots([]);
        setSeverity('medium');
      }, 2000);
    } catch (error) {
      console.error("Erreur lors de l'envoi du signalement :", error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed fab-mobile-safe sm:bottom-6 sm:right-6 bg-red-600 text-white p-4 rounded-full shadow-lg hover:bg-red-700 transition-colors z-40"
        title="Signaler un problème"
      >
        <AlertCircle className="w-6 h-6" />
      </button>
      {/* Fenêtre */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {success ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Problème signalé !</h3>
                <p className="text-gray-600">Merci pour votre retour.</p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">Signaler un problème</h3>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Gravite */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gravité <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { value: 'critical', label: 'Critique', color: 'red' },
                      { value: 'high', label: 'Haute', color: 'orange' },
                      { value: 'medium', label: 'Moyenne', color: 'yellow' },
                      { value: 'low', label: 'Basse', color: 'green' }
                    ]?.map(({ value, label, color }) => (
                      <button
                        key={value}
                        onClick={() => setSeverity(value)}
                        className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                          severity === value
                            ? `border-${color}-500 bg-${color}-50 text-${color}-700`
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description du problème <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e?.target?.value)}
                    placeholder="Décrivez le problème rencontré..."
                    className="w-full border border-gray-300 rounded-lg p-3 min-h-[100px] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Etapes de reproduction */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Étapes de reproduction (optionnel)
                  </label>
                  <textarea
                    value={reproductionSteps}
                    onChange={(e) => setReproductionSteps(e?.target?.value)}
                    placeholder="1. Aller sur...\n2. Cliquer sur...\n3. Observer..."
                    className="w-full border border-gray-300 rounded-lg p-3 min-h-[100px] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Captures d'ecran */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Captures d'écran (optionnel)
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                      id="screenshot-upload"
                    />
                    <label
                      htmlFor="screenshot-upload"
                      className="flex flex-col items-center cursor-pointer"
                    >
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-600">Cliquez pour ajouter des images</span>
                    </label>
                  </div>
                  {screenshots?.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {screenshots?.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                          <span className="text-sm text-gray-700 truncate">{file?.name}</span>
                          <button
                            onClick={() => removeScreenshot(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Envoi */}
                <button
                  onClick={handleSubmit}
                  disabled={!description?.trim() || uploading}
                  className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {uploading ? 'Envoi en cours...' : 'Envoyer le signalement'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ReportProblemButton;


