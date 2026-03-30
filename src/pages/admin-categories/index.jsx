import React, { useEffect, useMemo, useState } from 'react';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import categoryService from '../../services/categoryService';

const COLOR_PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#14b8a6', '#6366f1', '#f97316', '#8b5cf6'];
const ICONS = ['Wrench', 'Leaf', 'Zap', 'Bike', 'Car', 'Home', 'Package', 'Laptop'];

const slugify = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const buildCategoryName = (category) => {
  return category?.nom || category?.name || category?.label || category?.slug || 'Categorie';
};

const buildSubcategoryName = (subcategory) => {
  return subcategory?.nom || subcategory?.name || subcategory?.label || subcategory?.slug || 'Sous-categorie';
};

const normalizeCategoryForDisplay = (category, index, counts = {}) => {
  const name = buildCategoryName(category);
  const normalizedName = String(name || '')?.toLowerCase()?.trim();
  const rawSubcategories = Array.isArray(category?.subcategories) ? category.subcategories : [];

  return {
    ...category,
    displayName: name,
    icon: category?.icon || ICONS?.[index % ICONS?.length],
    color: category?.color || COLOR_PALETTE?.[index % COLOR_PALETTE?.length],
    listingsCount: counts?.[normalizedName] || 0,
    subcategoriesList: rawSubcategories
      ?.map((subcategory) => ({
        ...subcategory,
        displayName: buildSubcategoryName(subcategory)
      }))
      ?.sort((left, right) => left?.displayName?.localeCompare(right?.displayName || '', 'fr', { sensitivity: 'base' }))
  };
};

const AdminCategories = () => {
  const [categories, setCategories] = useState([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingSubcategory, setEditingSubcategory] = useState(null);
  const [categoryName, setCategoryName] = useState('');
  const [subcategoryName, setSubcategoryName] = useState('');
  const [subcategoryCategoryId, setSubcategoryCategoryId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      setFetchError('');

      const [{ data: rawCategories, error: categoryError }, { data: annonces, error: annonceError }] = await Promise.all([
        categoryService?.getCategories(),
        supabase?.from('annonces')?.select('categorie')
      ]);

      if (categoryError) throw categoryError;
      if (annonceError) throw annonceError;

      const counts = (annonces || [])?.reduce((acc, annonce) => {
        const key = String(annonce?.categorie || '')?.toLowerCase()?.trim();
        if (!key) return acc;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const mapped = (rawCategories || [])?.map((category, index) =>
        normalizeCategoryForDisplay(category, index, counts)
      );

      setCategories(mapped);
    } catch (error) {
      console.error('Erreur de chargement des categories:', error);
      setFetchError(error?.message || 'Impossible de charger les categories');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const categoryOptions = useMemo(() => {
    return (categories || [])?.map((category) => ({
      value: String(category?.id || ''),
      label: category?.displayName || 'Categorie'
    }));
  }, [categories]);

  const selectedCategoryName = useMemo(() => {
    if (!editingCategory) return categoryName;
    return categoryName || editingCategory?.displayName || '';
  }, [editingCategory, categoryName]);

  const selectedSubcategoryName = useMemo(() => {
    if (!editingSubcategory) return subcategoryName;
    return subcategoryName || editingSubcategory?.displayName || '';
  }, [editingSubcategory, subcategoryName]);

  const closeCategoryModal = () => {
    setShowCategoryModal(false);
    setEditingCategory(null);
    setCategoryName('');
  };

  const closeSubcategoryModal = () => {
    setShowSubcategoryModal(false);
    setEditingSubcategory(null);
    setSubcategoryName('');
    setSubcategoryCategoryId('');
  };

  const saveCategory = async () => {
    const name = String(selectedCategoryName || '')?.trim();
    if (!name) {
      window?.alert('Veuillez saisir un nom de categorie');
      return;
    }

    try {
      setSaving(true);

      if (editingCategory?.id) {
        const updatePayloads = [
          { nom: name, slug: slugify(name), updated_at: new Date()?.toISOString() },
          { name, slug: slugify(name), updated_at: new Date()?.toISOString() },
          { nom: name, slug: slugify(name) },
          { name, slug: slugify(name) }
        ];

        let updateError = null;
        let updated = false;

        for (const payload of updatePayloads) {
          const attempt = await supabase
            ?.from('categories')
            ?.update(payload)
            ?.eq('id', editingCategory?.id);

          updateError = attempt?.error || null;
          if (!updateError) {
            updated = true;
            break;
          }
        }

        if (!updated && updateError) throw updateError;
      } else {
        const insertPayloads = [
          { nom: name, slug: slugify(name) },
          { name, slug: slugify(name) },
          { nom: name },
          { name }
        ];

        let insertError = null;
        let inserted = false;

        for (const payload of insertPayloads) {
          const attempt = await supabase
            ?.from('categories')
            ?.insert(payload);

          insertError = attempt?.error || null;
          if (!insertError) {
            inserted = true;
            break;
          }
        }

        if (!inserted && insertError) throw insertError;
      }

      closeCategoryModal();
      await loadCategories();
    } catch (error) {
      console.error('Erreur de sauvegarde categorie:', error);
      window?.alert(error?.message || 'Impossible de sauvegarder cette categorie');
    } finally {
      setSaving(false);
    }
  };

  const saveSubcategory = async () => {
    const name = String(selectedSubcategoryName || '')?.trim();
    const parentCategoryId = String(subcategoryCategoryId || '')?.trim();

    if (!parentCategoryId) {
      window?.alert('Veuillez choisir une categorie');
      return;
    }

    if (!name) {
      window?.alert('Veuillez saisir un nom de sous-categorie');
      return;
    }

    try {
      setSaving(true);

      const payload = {
        category_id: Number(parentCategoryId),
        name,
        nom: name,
        slug: slugify(name),
        updated_at: new Date()?.toISOString()
      };

      const query = editingSubcategory?.id
        ? supabase?.from('subcategories')?.update(payload)?.eq('id', editingSubcategory?.id)
        : supabase?.from('subcategories')?.insert(payload);

      const { error } = await query;
      if (error) throw error;

      closeSubcategoryModal();
      await loadCategories();
    } catch (error) {
      console.error('Erreur de sauvegarde sous-categorie:', error);
      window?.alert(error?.message || 'Impossible de sauvegarder cette sous-categorie');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (category) => {
    const confirmed = window?.confirm(`Supprimer la categorie "${category?.displayName}" ?`);
    if (!confirmed) return;

    try {
      setSaving(true);
      const { error } = await supabase?.from('categories')?.delete()?.eq('id', category?.id);
      if (error) throw error;
      await loadCategories();
    } catch (error) {
      console.error('Erreur suppression categorie:', error);
      window?.alert(error?.message || 'Impossible de supprimer cette categorie');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubcategory = async (subcategory) => {
    const confirmed = window?.confirm(`Supprimer la sous-categorie "${subcategory?.displayName}" ?`);
    if (!confirmed) return;

    try {
      setSaving(true);
      const { error } = await supabase?.from('subcategories')?.delete()?.eq('id', subcategory?.id);
      if (error) throw error;
      await loadCategories();
    } catch (error) {
      console.error('Erreur suppression sous-categorie:', error);
      window?.alert(error?.message || 'Impossible de supprimer cette sous-categorie');
    } finally {
      setSaving(false);
    }
  };

  const openCreateSubcategoryModal = (category) => {
    setEditingSubcategory(null);
    setSubcategoryName('');
    setSubcategoryCategoryId(String(category?.id || ''));
    setShowSubcategoryModal(true);
  };

  const openEditSubcategoryModal = (category, subcategory) => {
    setEditingSubcategory(subcategory);
    setSubcategoryName(subcategory?.displayName || '');
    setSubcategoryCategoryId(String(category?.id || subcategory?.category_id || ''));
    setShowSubcategoryModal(true);
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

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Catégories & sous-catégories</h1>
            <p className="text-muted-foreground">
              Organisez la taxonomie commune utilisée par les annonces, les demandes et la bibliothèque d&apos;images.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button iconName="Plus" onClick={() => setShowCategoryModal(true)}>
              Ajouter une categorie
            </Button>
            <Button
              variant="outline"
              iconName="FolderPlus"
              onClick={() => {
                setEditingSubcategory(null);
                setSubcategoryName('');
                setSubcategoryCategoryId(categoryOptions?.[0]?.value || '');
                setShowSubcategoryModal(true);
              }}
              disabled={(categoryOptions?.length || 0) === 0}
            >
              Ajouter une sous-categorie
            </Button>
          </div>
        </div>

        {fetchError && (
          <div className="bg-error/10 border border-error/20 text-error rounded-lg px-4 py-3 mb-6 text-sm">
            {fetchError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full bg-white rounded-lg shadow-elevation-1 p-8 text-center text-muted-foreground">
              Chargement des categories...
            </div>
          ) : categories?.length === 0 ? (
            <div className="col-span-full bg-white rounded-lg shadow-elevation-1 p-8 text-center text-muted-foreground">
              Aucune categorie disponible.
            </div>
          ) : (
            categories?.map((category) => (
              <div key={category?.id} className="bg-white rounded-2xl shadow-elevation-1 p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg" style={{ backgroundColor: `${category?.color}20`, color: category?.color }}>
                      <Icon name={category?.icon} size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{category?.displayName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {category?.listingsCount} annonces · {category?.subcategoriesList?.length || 0} sous-catégorie{(category?.subcategoriesList?.length || 0) > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    iconName="Edit"
                    onClick={() => {
                      setEditingCategory(category);
                      setCategoryName(category?.displayName || '');
                      setShowCategoryModal(true);
                    }}
                  >
                    Modifier
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    iconName="FolderPlus"
                    onClick={() => openCreateSubcategoryModal(category)}
                  >
                    Ajouter une sous-categorie
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    iconName="Trash2"
                    loading={saving}
                    onClick={() => handleDeleteCategory(category)}
                  >
                    Supprimer
                  </Button>
                </div>

                <div className="space-y-2">
                  {(category?.subcategoriesList?.length || 0) === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      Aucune sous-categorie pour le moment.
                    </div>
                  ) : (
                    category?.subcategoriesList?.map((subcategory) => (
                      <div key={subcategory?.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{subcategory?.displayName}</p>
                          <p className="text-xs text-slate-500 truncate">{subcategory?.slug || 'slug non defini'}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="xs"
                            iconName="Edit"
                            onClick={() => openEditSubcategoryModal(category, subcategory)}
                          >
                            Modifier
                          </Button>
                          <Button
                            variant="danger"
                            size="xs"
                            iconName="Trash2"
                            loading={saving}
                            onClick={() => handleDeleteSubcategory(subcategory)}
                          >
                            Supprimer
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {showCategoryModal && (
          <div className="modal-viewport z-modal bg-black/50">
            <div className="modal-card modal-card-auto max-w-md rounded-lg bg-white p-6 shadow-elevation-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-foreground">
                  {editingCategory ? 'Modifier la categorie' : 'Ajouter une categorie'}
                </h2>
                <button onClick={closeCategoryModal} className="text-muted-foreground hover:text-foreground" disabled={saving}>
                  <Icon name="X" size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <Input
                  label="Nom de la categorie"
                  placeholder="Ex: Bricolage"
                  value={selectedCategoryName}
                  onChange={(e) => setCategoryName(e?.target?.value || '')}
                />
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={closeCategoryModal} disabled={saving}>
                    Annuler
                  </Button>
                  <Button onClick={saveCategory} loading={saving}>
                    {editingCategory ? 'Enregistrer' : 'Ajouter'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showSubcategoryModal && (
          <div className="modal-viewport z-modal bg-black/50">
            <div className="modal-card modal-card-auto max-w-md rounded-lg bg-white p-6 shadow-elevation-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-foreground">
                  {editingSubcategory ? 'Modifier la sous-categorie' : 'Ajouter une sous-categorie'}
                </h2>
                <button onClick={closeSubcategoryModal} className="text-muted-foreground hover:text-foreground" disabled={saving}>
                  <Icon name="X" size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <Select
                  label="Categorie parente"
                  options={categoryOptions}
                  value={subcategoryCategoryId}
                  onChange={(value) => setSubcategoryCategoryId(value)}
                  placeholder="Choisir une categorie"
                />
                <Input
                  label="Nom de la sous-categorie"
                  placeholder="Ex: Outillage manuel"
                  value={selectedSubcategoryName}
                  onChange={(e) => setSubcategoryName(e?.target?.value || '')}
                />
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={closeSubcategoryModal} disabled={saving}>
                    Annuler
                  </Button>
                  <Button onClick={saveSubcategory} loading={saving}>
                    {editingSubcategory ? 'Enregistrer' : 'Ajouter'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default AdminCategories;
