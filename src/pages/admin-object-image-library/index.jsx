import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Icon from '../../components/AppIcon';
import categoryService from '../../services/categoryService';
import objectImageLibraryService, {
  OBJECT_IMAGE_LIBRARY_ALLOWED_MIME_TYPES,
  OBJECT_IMAGE_LIBRARY_MAX_FILE_SIZE_BYTES
} from '../../services/objectImageLibraryService';

const createEmptyForm = () => ({
  categoryId: '',
  subcategoryId: '',
  title: '',
  description: '',
  altText: '',
  tags: '',
  isActive: true,
  file: null
});

const normalizeSubcategoryName = (subcategory) =>
  subcategory?.nom || subcategory?.name || subcategory?.slug || 'Sous-categorie';

const normalizeCategoryName = (category) =>
  category?.nom || category?.name || category?.slug || 'Categorie';

const formatFileSize = (bytes) => {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return '0 o';
  if (value < 1024) return `${value} o`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} Ko`;
  return `${(value / (1024 * 1024)).toFixed(1)} Mo`;
};

const AdminObjectImageLibrary = () => {
  const [categories, setCategories] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [fetchError, setFetchError] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    categoryId: '',
    subcategoryId: '',
    status: 'all'
  });
  const [showModal, setShowModal] = useState(false);
  const [editingImage, setEditingImage] = useState(null);
  const [form, setForm] = useState(createEmptyForm);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setFetchError('');

      const [{ data: categoryRows, error: categoryError }, { data: imageRows, error: imageError }] = await Promise.all([
        categoryService?.getCategories(),
        objectImageLibraryService?.listImages({ includeInactive: true })
      ]);

      if (categoryError) throw categoryError;
      if (imageError) throw imageError;

      setCategories(categoryRows || []);
      setImages(imageRows || []);
    } catch (error) {
      console.error("Erreur de chargement de la bibliotheque d'images :", error);
      setFetchError(error?.message || "Impossible de charger la bibliotheque d'images.");
      setCategories([]);
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  const categoryOptions = useMemo(() => {
    return [
      { value: '', label: 'Toutes les categories' },
      ...(categories || []).map((category) => ({
        value: String(category?.id || ''),
        label: normalizeCategoryName(category)
      }))
    ];
  }, [categories]);

  const selectedFilterCategory = useMemo(() => {
    return (categories || []).find((category) => String(category?.id || '') === String(filters?.categoryId || '')) || null;
  }, [categories, filters?.categoryId]);

  const filterSubcategoryOptions = useMemo(() => {
    const rows = selectedFilterCategory?.subcategories || [];
    return [
      { value: '', label: 'Toutes les sous-categories' },
      ...rows.map((subcategory) => ({
        value: String(subcategory?.id || ''),
        label: normalizeSubcategoryName(subcategory)
      }))
    ];
  }, [selectedFilterCategory]);

  const modalCategory = useMemo(() => {
    return (categories || []).find((category) => String(category?.id || '') === String(form?.categoryId || '')) || null;
  }, [categories, form?.categoryId]);

  const modalSubcategoryOptions = useMemo(() => {
    return (modalCategory?.subcategories || []).map((subcategory) => ({
      value: String(subcategory?.id || ''),
      label: normalizeSubcategoryName(subcategory)
    }));
  }, [modalCategory]);

  const filteredImages = useMemo(() => {
    return (images || []).filter((image) => {
      if (filters?.categoryId && String(image?.category_id || '') !== String(filters?.categoryId || '')) {
        return false;
      }

      if (filters?.subcategoryId && String(image?.subcategory_id || '') !== String(filters?.subcategoryId || '')) {
        return false;
      }

      if (filters?.status === 'active' && image?.is_active !== true) {
        return false;
      }

      if (filters?.status === 'inactive' && image?.is_active !== false) {
        return false;
      }

      if (String(filters?.search || '').trim()) {
        const normalizedSearch = String(filters?.search || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim();

        const haystack = [
          image?.title,
          image?.description,
          image?.alt_text,
          image?.categoryLabel,
          image?.subcategoryLabel,
          ...(Array.isArray(image?.tags) ? image.tags : [])
        ]
          .map((value) =>
            String(value || '')
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
          )
          .join(' ');

        if (!haystack.includes(normalizedSearch)) {
          return false;
        }
      }

      return true;
    });
  }, [filters, images]);

  const stats = useMemo(() => {
    const total = images?.length || 0;
    const active = (images || []).filter((image) => image?.is_active === true)?.length || 0;
    const inactive = Math.max(0, total - active);
    const usedCategories = new Set((images || []).map((image) => String(image?.category_id || '')).filter(Boolean)).size;

    return { total, active, inactive, usedCategories };
  }, [images]);

  const closeModal = () => {
    setShowModal(false);
    setEditingImage(null);
    setForm(createEmptyForm());
  };

  const openCreateModal = () => {
    const firstCategory = categories?.[0] || null;
    const firstSubcategory = firstCategory?.subcategories?.[0] || null;

    setEditingImage(null);
    setForm({
      categoryId: firstCategory?.id ? String(firstCategory.id) : '',
      subcategoryId: firstSubcategory?.id ? String(firstSubcategory.id) : '',
      title: '',
      description: '',
      altText: '',
      tags: '',
      isActive: true,
      file: null
    });
    setShowModal(true);
  };

  const openEditModal = (image) => {
    setEditingImage(image);
    setForm({
      categoryId: image?.category_id ? String(image.category_id) : '',
      subcategoryId: image?.subcategory_id ? String(image.subcategory_id) : '',
      title: image?.title || '',
      description: image?.description || '',
      altText: image?.alt_text || '',
      tags: Array.isArray(image?.tags) ? image.tags.join(', ') : '',
      isActive: image?.is_active !== false,
      file: null
    });
    setShowModal(true);
  };

  const handleFilterChange = (field, value) => {
    setFilters((previous) => {
      if (field === 'categoryId') {
        return {
          ...previous,
          categoryId: value,
          subcategoryId: ''
        };
      }

      return {
        ...previous,
        [field]: value
      };
    });
  };

  const handleFormChange = (field, value) => {
    if (field === 'categoryId') {
      const nextCategory = (categories || []).find((category) => String(category?.id || '') === String(value || '')) || null;
      const nextSubcategory = nextCategory?.subcategories?.[0] || null;

      setForm((previous) => ({
        ...previous,
        categoryId: value,
        subcategoryId: nextSubcategory?.id ? String(nextSubcategory.id) : ''
      }));
      return;
    }

    setForm((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  const handleSaveImage = async () => {
    const category = (categories || []).find((entry) => String(entry?.id || '') === String(form?.categoryId || '')) || null;
    const subcategory = (category?.subcategories || []).find((entry) => String(entry?.id || '') === String(form?.subcategoryId || '')) || null;

    try {
      setSaving(true);

      const result = editingImage
        ? await objectImageLibraryService?.updateImage(editingImage?.id, {
            category,
            subcategory,
            title: form?.title,
            description: form?.description,
            altText: form?.altText,
            tags: form?.tags,
            isActive: form?.isActive
          })
        : await objectImageLibraryService?.uploadImage({
            file: form?.file,
            category,
            subcategory,
            title: form?.title,
            description: form?.description,
            altText: form?.altText,
            tags: form?.tags,
            isActive: form?.isActive
          });

      if (result?.error) {
        window?.alert(result?.error?.message || "Impossible d'enregistrer cette image.");
        return;
      }

      closeModal();
      await loadData();
    } catch (error) {
      console.error("Erreur d'enregistrement de l'image :", error);
      window?.alert(error?.message || "Impossible d'enregistrer cette image.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteImage = async (image) => {
    const confirmed = window?.confirm(`Supprimer définitivement l'image "${image?.title}" ?`);
    if (!confirmed) return;

    try {
      setDeletingId(image?.id);
      const { error } = await objectImageLibraryService?.deleteImage(image?.id);
      if (error) {
        window?.alert(error?.message || "Impossible de supprimer cette image.");
        return;
      }

      await loadData();
    } catch (error) {
      console.error("Erreur de suppression de l'image :", error);
      window?.alert(error?.message || "Impossible de supprimer cette image.");
    } finally {
      setDeletingId(null);
    }
  };

  const maxSizeText = `${Math.round(OBJECT_IMAGE_LIBRARY_MAX_FILE_SIZE_BYTES / (1024 * 1024))} Mo`;

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />
      <main className="flex-1 container mx-auto px-4 pt-20 pb-6 md:pt-24 md:pb-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link to="/administration-tableau-bord" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
            <Icon name="ArrowLeft" size={16} />
            Retour au tableau de bord
          </Link>
          <span className="text-slate-300">/</span>
          <Link to="/administration-categories" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700">
            <Icon name="FolderTree" size={16} />
            Gérer la taxonomie
          </Link>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
          <div className="max-w-3xl">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Bibliothèque d&apos;images d&apos;objets</h1>
            <p className="text-muted-foreground">
              Importez des images génériques dans Storage, rattachez-les à une catégorie et une sous-catégorie,
              puis réutilisez-les dans les demandes publiques.
            </p>
          </div>
          <Button iconName="ImagePlus" onClick={openCreateModal} disabled={(categories?.length || 0) === 0}>
            Importer une image
          </Button>
        </div>

        {fetchError ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {fetchError}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
          <div className="rounded-2xl bg-white p-5 shadow-elevation-1">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Images</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{stats?.total}</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-elevation-1">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Actives</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-600">{stats?.active}</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-elevation-1">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Masquées</p>
            <p className="mt-2 text-3xl font-semibold text-amber-600">{stats?.inactive}</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-elevation-1">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Catégories utilisées</p>
            <p className="mt-2 text-3xl font-semibold text-sky-700">{stats?.usedCategories}</p>
          </div>
        </div>

        <div className="mb-6 rounded-2xl bg-white p-4 shadow-elevation-1">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Input
              label="Recherche"
              placeholder="Titre, tag, categorie..."
              value={filters?.search}
              onChange={(event) => handleFilterChange('search', event?.target?.value || '')}
            />
            <Select
              label="Categorie"
              options={categoryOptions}
              value={filters?.categoryId}
              onChange={(value) => handleFilterChange('categoryId', value)}
            />
            <Select
              label="Sous-categorie"
              options={filterSubcategoryOptions}
              value={filters?.subcategoryId}
              onChange={(value) => handleFilterChange('subcategoryId', value)}
            />
            <Select
              label="Statut"
              options={[
                { value: 'all', label: 'Toutes' },
                { value: 'active', label: 'Actives' },
                { value: 'inactive', label: 'Masquées' }
              ]}
              value={filters?.status}
              onChange={(value) => handleFilterChange('status', value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-elevation-1 text-slate-500">
            Chargement de la bibliothèque...
          </div>
        ) : filteredImages?.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-elevation-1">
            <Icon name="ImageOff" size={42} className="mx-auto text-slate-400 mb-4" />
            <p className="text-lg font-semibold text-slate-950">Aucune image trouvée</p>
            <p className="mt-2 text-sm text-slate-500">Ajoutez une image ou élargissez les filtres.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredImages?.map((image) => (
              <article key={image?.id} className="overflow-hidden rounded-3xl bg-white shadow-elevation-1">
                <div className="aspect-[4/3] bg-slate-100">
                  <img
                    src={image?.public_url}
                    alt={image?.alt_text || image?.title || 'Image de la bibliothèque'}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="space-y-4 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700">
                      {image?.categoryLabel || 'Categorie'}
                    </span>
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {image?.subcategoryLabel || 'Sous-categorie'}
                    </span>
                    {image?.is_active === true ? (
                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        Masquée
                      </span>
                    )}
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">{image?.title}</h2>
                    <p className="mt-2 text-sm text-slate-600 line-clamp-3">{image?.description || 'Sans description.'}</p>
                  </div>

                  <div className="space-y-2 text-sm text-slate-600">
                    <p><span className="font-medium text-slate-900">Alt:</span> {image?.alt_text || '-'}</p>
                    <p><span className="font-medium text-slate-900">Fichier:</span> {image?.file_name || '-'}</p>
                    <p><span className="font-medium text-slate-900">Type:</span> {image?.mime_type || '-'}</p>
                    <p><span className="font-medium text-slate-900">Taille:</span> {formatFileSize(image?.file_size_bytes)}</p>
                    <p><span className="font-medium text-slate-900">Dimensions:</span> {image?.width && image?.height ? `${image.width} x ${image.height}` : 'non renseignées'}</p>
                  </div>

                  {(image?.tags?.length || 0) > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {image?.tags?.map((tag) => (
                        <span key={`${image?.id}-${tag}`} className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button variant="outline" size="sm" iconName="Edit" onClick={() => openEditModal(image)}>
                      Modifier
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      iconName="Trash2"
                      loading={deletingId === image?.id}
                      onClick={() => handleDeleteImage(image)}
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {showModal ? (
          <div className="modal-viewport z-modal bg-black/50">
            <div className="modal-card modal-card-shell max-w-2xl rounded-3xl bg-white shadow-elevation-4">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">
                    {editingImage ? 'Modifier une image' : 'Importer une image'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Chemin Storage imposé: categorie / sous-categorie / fichier
                  </p>
                </div>
                <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-700" disabled={saving}>
                  <Icon name="X" size={22} />
                </button>
              </div>

              <div className="modal-card-body space-y-4 px-6 py-6">
                {!editingImage ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <label className="block text-sm font-medium text-slate-900">Fichier image</label>
                    <input
                      type="file"
                      accept={OBJECT_IMAGE_LIBRARY_ALLOWED_MIME_TYPES.join(',')}
                      onChange={(event) => {
                        const nextFile = event?.target?.files?.[0] || null;
                        handleFormChange('file', nextFile);
                      }}
                      className="mt-3 block w-full text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-sky-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-sky-700 hover:file:bg-sky-200"
                    />
                    <p className="mt-3 text-xs text-slate-500">
                      Types autorisés: {OBJECT_IMAGE_LIBRARY_ALLOWED_MIME_TYPES.join(', ')} · Taille max: {maxSizeText}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <img
                      src={editingImage?.public_url}
                      alt={editingImage?.alt_text || editingImage?.title || 'Image existante'}
                      className="h-20 w-24 rounded-xl object-cover"
                    />
                    <div className="text-sm text-slate-600">
                      <p className="font-medium text-slate-900">{editingImage?.file_name}</p>
                      <p>{editingImage?.storage_path}</p>
                      <p className="mt-1">Le fichier reste stocké dans Storage. Cette fenêtre modifie les métadonnées et peut déplacer le chemin si la taxonomie change.</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Select
                    label="Categorie"
                    options={(categories || []).map((category) => ({
                      value: String(category?.id || ''),
                      label: normalizeCategoryName(category)
                    }))}
                    value={form?.categoryId}
                    onChange={(value) => handleFormChange('categoryId', value)}
                    placeholder="Choisir une categorie"
                  />
                  <Select
                    label="Sous-categorie"
                    options={modalSubcategoryOptions}
                    value={form?.subcategoryId}
                    onChange={(value) => handleFormChange('subcategoryId', value)}
                    placeholder="Choisir une sous-categorie"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Input
                    label="Titre"
                    value={form?.title}
                    onChange={(event) => handleFormChange('title', event?.target?.value || '')}
                    placeholder="Ex: Marteau de charpentier"
                  />
                  <Input
                    label="Texte alternatif"
                    value={form?.altText}
                    onChange={(event) => handleFormChange('altText', event?.target?.value || '')}
                    placeholder="Ex: Marteau en acier avec manche bois"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900">Description</label>
                  <textarea
                    rows={4}
                    value={form?.description}
                    onChange={(event) => handleFormChange('description', event?.target?.value || '')}
                    className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="Décrivez l’objet et son usage générique."
                  />
                </div>

                <Input
                  label="Tags"
                  value={form?.tags}
                  onChange={(event) => handleFormChange('tags', event?.target?.value || '')}
                  placeholder="Ex: marteau, bricolage, outil manuel"
                  description="Séparez les mots-clés par des virgules."
                />

                <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form?.isActive === true}
                    onChange={(event) => handleFormChange('isActive', Boolean(event?.target?.checked))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Image visible pour les utilisateurs
                </label>
              </div>

              <div className="flex gap-3 border-t border-slate-100 px-6 py-5">
                <Button variant="outline" onClick={closeModal} className="flex-1" disabled={saving}>
                  Annuler
                </Button>
                <Button onClick={handleSaveImage} className="flex-1" loading={saving}>
                  {editingImage ? 'Enregistrer' : 'Importer'}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
      <Footer />
    </div>
  );
};

export default AdminObjectImageLibrary;
