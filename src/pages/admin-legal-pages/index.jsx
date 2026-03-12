import React, { useEffect, useMemo, useState } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Link } from 'react-router-dom';
import legalService from '../../services/legalService';
import {
  LEGAL_PAGE_DEFINITIONS,
  getCandidateSlugs,
  resolveLegalPageFromRows
} from '../../utils/legalPagesConfig';
import 'react-quill/dist/quill.snow.css';
import './editor.css';

const WORD_LIKE_FONTS = [
  'Arial',
  'Calibri',
  'Cambria',
  'Georgia',
  'Tahoma',
  'Times New Roman',
  'Verdana'
];

const WORD_LIKE_SIZES = ['12px', '14px', '16px', '18px', '24px', '32px'];

const FontStyle = Quill?.import('attributors/style/font');
if (FontStyle) {
  FontStyle.whitelist = WORD_LIKE_FONTS;
  Quill?.register(FontStyle, true);
}

const SizeStyle = Quill?.import('attributors/style/size');
if (SizeStyle) {
  SizeStyle.whitelist = WORD_LIKE_SIZES;
  Quill?.register(SizeStyle, true);
}

const AlignStyle = Quill?.import('attributors/style/align');
if (AlignStyle) {
  Quill?.register(AlignStyle, true);
}

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date?.getTime())) return '-';
  return date?.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const AdminLegalPages = () => {
  const [pages, setPages] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [selectedPage, setSelectedPage] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [editorMode, setEditorMode] = useState('visual');

  const editorModules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        [{ font: WORD_LIKE_FONTS }, { size: WORD_LIKE_SIZES }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ color: [] }, { background: [] }],
        [{ align: [] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['blockquote', 'link'],
        ['clean']
      ],
      clipboard: {
        matchVisual: false
      }
    }),
    []
  );

  const editorFormats = useMemo(
    () => [
      'header',
      'font',
      'size',
      'bold',
      'italic',
      'underline',
      'strike',
      'color',
      'background',
      'align',
      'list',
      'bullet',
      'blockquote',
      'link'
    ],
    []
  );

  useEffect(() => {
    loadPages();
  }, []);

  useEffect(() => {
    if (selectedSlug) {
      loadPage(selectedSlug);
    }
  }, [selectedSlug]);

  const combinedPages = useMemo(() => {
    return LEGAL_PAGE_DEFINITIONS?.map((definition) => {
      const resolved = resolveLegalPageFromRows(pages || [], definition?.slug);
      return {
        slug: definition?.slug,
        title: resolved?.title || definition?.title || definition?.slug,
        updated_at: resolved?.updated_at || null
      };
    });
  }, [pages]);

  const loadPages = async () => {
    try {
      setLoadingList(true);
      setFetchError('');
      setStatusMessage('');

      const { data, error } = await legalService?.getAllLegalPages();
      if (error) throw error;

      const rows = Array?.isArray(data) ? data : [];
      setPages(rows);

      if (!selectedSlug) {
        const firstSlug = LEGAL_PAGE_DEFINITIONS?.[0]?.slug || '';
        setSelectedSlug(firstSlug);
      }
    } catch (error) {
      console.error('Erreur de chargement des pages legales:', error);
      setFetchError(error?.message || 'Impossible de charger les pages legales');
      setPages([]);
      if (!selectedSlug) {
        setSelectedSlug(LEGAL_PAGE_DEFINITIONS?.[0]?.slug || '');
      }
    } finally {
      setLoadingList(false);
    }
  };

  const loadPage = async (slug) => {
    try {
      setLoadingPage(true);
      setFetchError('');
      setStatusMessage('');

      const fallback = combinedPages?.find((page) => page?.slug === slug);
      const candidates = getCandidateSlugs(slug);
      let data = null;

      for (const candidate of candidates) {
        const { data: pageData, error } = await legalService?.getLegalPage(candidate);
        if (error) throw error;
        if (pageData) {
          data = pageData;
          break;
        }
      }

      const pageData = {
        slug,
        title: data?.title || fallback?.title || slug,
        content: data?.content || '',
        updated_at: data?.updated_at || fallback?.updated_at || null,
        sourceSlug: data?.slug || slug
      };

      setSelectedPage(pageData);
      setTitle(pageData?.title);
      setContent(pageData?.content);
    } catch (error) {
      console.error('Erreur de chargement de la page legale:', error);
      setFetchError(error?.message || 'Impossible de charger cette page');
      const fallback = combinedPages?.find((page) => page?.slug === slug);
      setSelectedPage({
        slug,
        title: fallback?.title || slug,
        content: '',
        updated_at: null,
        sourceSlug: slug
      });
      setTitle(fallback?.title || slug);
      setContent('');
    } finally {
      setLoadingPage(false);
    }
  };

  const handleSave = async () => {
    if (!selectedSlug) return;

    try {
      setSaving(true);
      setStatusMessage('');
      setFetchError('');

      const safeTitle = String(title || '')?.trim() || selectedSlug;
      const candidateSlugs = getCandidateSlugs(selectedSlug);
      let primarySavedData = null;

      for (const candidate of candidateSlugs) {
        const { data, error } = await legalService?.updateLegalPage(candidate, safeTitle, content || '');
        if (error) throw error;

        if (!primarySavedData || candidate === selectedSlug) {
          primarySavedData = data;
        }
      }

      setSelectedPage((prev) => ({
        ...(prev || {}),
        slug: selectedSlug,
        title: primarySavedData?.title || safeTitle,
        content: primarySavedData?.content || content || '',
        updated_at: primarySavedData?.updated_at || new Date()?.toISOString(),
        sourceSlug: selectedSlug
      }));

      await loadPages();
      setStatusMessage('Page enregistree avec succes');
    } catch (error) {
      console.error('Erreur de sauvegarde page legale:', error);
      setFetchError(error?.message || 'Impossible de sauvegarder cette page');
    } finally {
      setSaving(false);
    }
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

        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Modifier les pages legales</h1>
          <p className="text-muted-foreground">Gerez le contenu des pages legales du site</p>
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
            <div className="bg-white rounded-lg shadow-elevation-1 p-4">
              <h2 className="text-lg font-semibold text-foreground mb-4">Pages disponibles</h2>

              {loadingList ? (
                <p className="text-sm text-muted-foreground">Chargement...</p>
              ) : (
                <div className="space-y-2">
                  {combinedPages?.map((page) => (
                    <button
                      key={page?.slug}
                      onClick={() => setSelectedSlug(page?.slug)}
                      className={`w-full text-left p-3 rounded-md transition-colors ${
                        selectedSlug === page?.slug
                          ? 'bg-blue-50 border border-blue-200'
                          : 'hover:bg-surface border border-transparent'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <Icon name="FileText" size={16} className="text-blue-600 mt-1" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{page?.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">/{page?.slug}</p>
                          <p className="text-xs text-muted-foreground mt-1">Maj: {formatDate(page?.updated_at)}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            {loadingPage ? (
              <div className="bg-white rounded-lg shadow-elevation-1 p-8 text-center text-muted-foreground">
                Chargement de la page...
              </div>
            ) : selectedSlug ? (
              <div className="space-y-4">
                <div className="bg-white rounded-lg shadow-elevation-1 p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <Input
                        label="Titre"
                        value={title}
                        onChange={(e) => setTitle(e?.target?.value || '')}
                      />
                      <p className="text-sm text-muted-foreground mt-2">Slug: /{selectedSlug}</p>
                    </div>
                    <Button size="sm" iconName="Save" loading={saving} onClick={handleSave}>
                      Enregistrer
                    </Button>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Derniere modification: {formatDate(selectedPage?.updated_at)}
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow-elevation-1 p-6">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h3 className="text-lg font-semibold text-foreground">
                      {editorMode === 'visual' ? 'Contenu (editeur visuel)' : 'Contenu HTML'}
                    </h3>

                    <div className="inline-flex items-center rounded-md border border-border p-1 bg-surface">
                      <button
                        type="button"
                        onClick={() => setEditorMode('visual')}
                        className={`px-3 py-1 text-sm rounded ${
                          editorMode === 'visual'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Editeur visuel
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditorMode('html')}
                        className={`px-3 py-1 text-sm rounded ${
                          editorMode === 'html'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        HTML source
                      </button>
                    </div>
                  </div>

                  {editorMode === 'visual' ? (
                    <div className="legal-editor">
                      <ReactQuill
                        theme="snow"
                        value={content}
                        onChange={(value) => setContent(value || '')}
                        modules={editorModules}
                        formats={editorFormats}
                        placeholder="Saisissez le contenu de la page legale avec la mise en forme (comme Word)"
                      />
                    </div>
                  ) : (
                    <textarea
                      className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                      rows={22}
                      value={content}
                      onChange={(e) => setContent(e?.target?.value || '')}
                      placeholder="Saisissez le contenu HTML de la page legale"
                    />
                  )}

                  <p className="text-xs text-muted-foreground mt-3">
                    L'editeur visuel propose les polices, couleurs de texte/fond, tailles, alignements et listes.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-elevation-1 p-8 text-center text-muted-foreground">
                Selectionnez une page a modifier.
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AdminLegalPages;

