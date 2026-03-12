import React, { useEffect, useMemo, useState } from 'react';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import categoryService from '../../services/categoryService';

const COLOR_PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#14b8a6', '#6366f1', '#f97316', '#8b5cf6'];
const ICONS = ['Wrench', 'Leaf', 'Zap', 'Bike', 'Car', 'Home', 'Package', 'Laptop'];

const slugify = (value) =>
  String(value || '')
    ?.toLowerCase()
    ?.trim()
    ?.normalize('NFD')
    ?.replace(/[\u0300-\u036f]/g, '')
    ?.replace(/[^a-z0-9\s-]/g, '')
    ?.replace(/\s+/g, '-')
    ?.replace(/-+/g, '-');

const buildCategoryName = (category) => {
  return category?.nom || category?.name || category?.label || category?.slug || 'Categorie';
};

const AdminCategories = () => {
  const [categories, setCategories] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
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

      const mapped = (rawCategories || [])?.map((category, index) => {
        const name = buildCategoryName(category);
        const normalizedName = String(name || '')?.toLowerCase()?.trim();

        return {
          ...category,
          displayName: name,
          icon: category?.icon || ICONS?.[index % ICONS?.length],
          color: category?.color || COLOR_PALETTE?.[index % COLOR_PALETTE?.length],
          listingsCount: counts?.[normalizedName] || 0
        };
      });

      setCategories(mapped);
    } catch (error) {
      console.error('Erreur de chargement des categories:', error);
      setFetchError(error?.message || 'Impossible de charger les categories');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const selectedCategoryName = useMemo(() => {
    if (!editingCategory) return newCategoryName;
    return newCategoryName || editingCategory?.displayName || '';
  }, [editingCategory, newCategoryName]);

  const closeModal = () => {
    setShowAddModal(false);
    setEditingCategory(null);
    setNewCategoryName('');
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
        // Try multiple payloads to support schema variations.
        const updatePayloads = [
          { nom: name, updated_at: new Date()?.toISOString() },
          { name, updated_at: new Date()?.toISOString() },
          { nom: name },
          { name }
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
        const slug = slugify(name);
        const insertPayloads = [
          { nom: name, slug },
          { name, slug },
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

      closeModal();
      await loadCategories();
    } catch (error) {
      console.error('Erreur de sauvegarde categorie:', error);
      window?.alert(error?.message || 'Impossible de sauvegarder cette categorie');
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
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Gérer les catégories</h1>
            <p className="text-muted-foreground">Organisez les catégories d'annonces</p>
          </div>
          <Button iconName="Plus" onClick={() => setShowAddModal(true)}>
            Ajouter une categorie
          </Button>
        </div>

        {fetchError && (
          <div className="bg-error/10 border border-error/20 text-error rounded-lg px-4 py-3 mb-6 text-sm">
            {fetchError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <div key={category?.id} className="bg-white rounded-lg shadow-elevation-1 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg" style={{ backgroundColor: `${category?.color}20`, color: category?.color }}>
                      <Icon name={category?.icon} size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{category?.displayName}</h3>
                      <p className="text-sm text-muted-foreground">{category?.listingsCount} annonces</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    iconName="Edit"
                    className="flex-1"
                    onClick={() => {
                      setEditingCategory(category);
                      setNewCategoryName(category?.displayName || '');
                      setShowAddModal(true);
                    }}
                  >
                    Modifier
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
              </div>
            ))
          )}
        </div>

        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-modal p-4">
            <div className="bg-white rounded-lg shadow-elevation-4 max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-foreground">
                  {editingCategory ? 'Modifier la categorie' : 'Ajouter une categorie'}
                </h2>
                <button onClick={closeModal} className="text-muted-foreground hover:text-foreground">
                  <Icon name="X" size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <Input
                  label="Nom de la categorie"
                  placeholder="Ex: Electronique"
                  value={selectedCategoryName}
                  onChange={(e) => setNewCategoryName(e?.target?.value || '')}
                />
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={closeModal} disabled={saving}>
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
      </main>
      <Footer />
    </div>
  );
};

export default AdminCategories;


