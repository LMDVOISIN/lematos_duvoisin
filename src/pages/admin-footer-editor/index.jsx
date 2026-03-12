import React, { useEffect, useState } from 'react';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Link } from 'react-router-dom';
import legalService from '../../services/legalService';
import {
  DEFAULT_FOOTER_DATA,
  FOOTER_SLUG,
  FOOTER_TITLE,
  normalizeFooterData,
  parseFooterData
} from '../../utils/footerSettings';

const AdminFooterEditor = () => {
  const [footerData, setFooterData] = useState(DEFAULT_FOOTER_DATA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    loadFooterSettings();
  }, []);

  const loadFooterSettings = async () => {
    try {
      setLoading(true);
      setFetchError('');
      setStatusMessage('');

      const { data, error } = await legalService?.getLegalPage(FOOTER_SLUG);
      if (error) throw error;

      setFooterData(parseFooterData(data?.content));
    } catch (error) {
      console.error('Erreur de chargement du footer:', error);
      setFetchError(error?.message || 'Impossible de charger la configuration du footer');
      setFooterData(DEFAULT_FOOTER_DATA);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setFetchError('');
      setStatusMessage('');

      const serialized = JSON.stringify(normalizeFooterData(footerData), null, 2);
      const { error } = await legalService?.updateLegalPage(FOOTER_SLUG, FOOTER_TITLE, serialized);
      if (error) throw error;

      setStatusMessage('Pied de page enregistre avec succes');
    } catch (error) {
      console.error('Erreur de sauvegarde footer:', error);
      setFetchError(error?.message || 'Impossible de sauvegarder le pied de page');
    } finally {
      setSaving(false);
    }
  };

  const updateLegalLink = (index, field, value) => {
    setFooterData((previous) => {
      const nextLinks = [...(previous?.legalLinks || [])];
      nextLinks[index] = {
        ...(nextLinks?.[index] || {}),
        [field]: value
      };

      return normalizeFooterData({
        ...previous,
        legalLinks: nextLinks
      });
    });
  };

  const addLegalLink = () => {
    setFooterData((previous) =>
      normalizeFooterData({
        ...previous,
        legalLinks: [...(previous?.legalLinks || []), { label: '', to: '' }]
      })
    );
  };

  const removeLegalLink = (index) => {
    setFooterData((previous) => {
      const nextLinks = (previous?.legalLinks || [])?.filter((_, linkIndex) => linkIndex !== index);

      return normalizeFooterData({
        ...previous,
        legalLinks: nextLinks
      });
    });
  };

  const handleCategoriesChange = (value) => {
    const categories = String(value || '')
      ?.split('\n')
      ?.map((line) => line?.trim())
      ?.filter(Boolean);

    setFooterData((previous) =>
      normalizeFooterData({
        ...previous,
        categories
      })
    );
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

        <div className="flex items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Modifier le pied de page</h1>
            <p className="text-muted-foreground">Les valeurs de cette page sont affichees sur le footer public</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" iconName="RefreshCw" onClick={loadFooterSettings} loading={loading}>
              Recharger
            </Button>
            <Button iconName="Save" onClick={handleSave} loading={saving}>
              Enregistrer les modifications
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-elevation-1 p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Informations generales</h2>
              <div className="space-y-4">
                <Input
                  label="Nom de l'entreprise"
                  value={footerData?.companyName}
                  onChange={(event) => setFooterData((previous) => normalizeFooterData({ ...previous, companyName: event?.target?.value || '' }))}
                  disabled={loading}
                />
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Description</label>
                  <textarea
                    className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={3}
                    value={footerData?.description}
                    onChange={(event) => setFooterData((previous) => normalizeFooterData({ ...previous, description: event?.target?.value || '' }))}
                    disabled={loading}
                  />
                </div>
                <Input
                  label="Baseline en bas du footer"
                  value={footerData?.bottomTagline}
                  onChange={(event) => setFooterData((previous) => normalizeFooterData({ ...previous, bottomTagline: event?.target?.value || '' }))}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-elevation-1 p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold text-foreground">Liens legaux</h2>
                <button
                  type="button"
                  onClick={addLegalLink}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  disabled={loading}
                >
                  + Ajouter
                </button>
              </div>

              <div className="space-y-4">
                {footerData?.legalLinks?.map((link, index) => (
                  <div key={`legal-link-${index}`} className="border border-border rounded-md p-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        label={`Libelle ${index + 1}`}
                        value={link?.label}
                        onChange={(event) => updateLegalLink(index, 'label', event?.target?.value || '')}
                        disabled={loading}
                      />
                      <Input
                        label={`Destination ${index + 1}`}
                        value={link?.to}
                        onChange={(event) => updateLegalLink(index, 'to', event?.target?.value || '')}
                        disabled={loading}
                      />
                    </div>

                    {(footerData?.legalLinks?.length || 0) > 1 && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => removeLegalLink(index)}
                          className="text-xs text-red-600 hover:text-red-700"
                          disabled={loading}
                        >
                          Supprimer ce lien
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-elevation-1 p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Categories</h2>
              <label className="block text-sm font-medium text-foreground mb-2">Une categorie par ligne</label>
              <textarea
                className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                rows={10}
                value={(footerData?.categories || [])?.join('\n')}
                onChange={(event) => handleCategoriesChange(event?.target?.value || '')}
                disabled={loading}
              />
            </div>
          </div>

          <div className="lg:sticky lg:top-6 h-fit">
            <div className="bg-white rounded-lg shadow-elevation-1 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Apercu synchronise</h2>
                <Icon name="Eye" size={20} className="text-muted-foreground" />
              </div>

              <div className="rounded-md bg-[#1a4d4d] text-white p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide mb-3">Informations legales</h3>
                    <ul className="space-y-1.5">
                      {footerData?.legalLinks?.map((link, index) => (
                        <li key={`preview-legal-${index}`} className="text-sm text-white/90">
                          {link?.label}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold mb-3">{footerData?.companyName}</h3>
                    <p className="text-sm text-white/90">{footerData?.description}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide mb-3">Categories</h3>
                    <ul className="space-y-1.5">
                      {footerData?.categories?.map((category, index) => (
                        <li key={`preview-category-${index}`} className="text-sm text-white/90">
                          {category}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/20 flex flex-col md:flex-row items-center justify-between gap-3">
                  <p className="text-sm text-white/90">© {new Date()?.getFullYear()} {footerData?.companyName}. Tous droits réservés.</p>
                  <p className="text-sm text-white/90">{footerData?.bottomTagline}</p>
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

export default AdminFooterEditor;
