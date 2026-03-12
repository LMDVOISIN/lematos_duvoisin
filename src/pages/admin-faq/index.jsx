import React, { useEffect, useMemo, useState } from 'react';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import faqService from '../../services/faqService';

const FILTERS = [
  { id: 'all', name: 'Toutes les questions' },
  { id: 'published', name: 'Publiees' },
  { id: 'draft', name: 'Brouillons' }
];

const EMPTY_FORM = {
  question: '',
  answer: '',
  published: true
};

const AdminFAQ = () => {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingFaq, setEditingFaq] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    loadFaqs();
  }, []);

  const loadFaqs = async () => {
    try {
      setLoading(true);
      const { data, error } = await faqService?.getFAQs(false);
      if (error) {
        throw error;
      }
      setFaqs(data || []);
    } catch (error) {
      console.error('FAQ load error:', error);
      toast?.error(error?.message || 'Impossible de charger la FAQ admin');
      setFaqs([]);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = faqs?.length;
    const published = faqs?.filter((faq) => faq?.published)?.length;
    const draft = total - published;

    return {
      total,
      published,
      draft
    };
  }, [faqs]);

  const filtersWithCount = useMemo(() => {
    return FILTERS?.map((filter) => {
      if (filter?.id === 'published') {
        return { ...filter, count: stats?.published };
      }
      if (filter?.id === 'draft') {
        return { ...filter, count: stats?.draft };
      }
      return { ...filter, count: stats?.total };
    });
  }, [stats]);

  const filteredFaqs = useMemo(() => {
    let result = faqs || [];

    if (selectedFilter === 'published') {
      result = result?.filter((faq) => faq?.published);
    }

    if (selectedFilter === 'draft') {
      result = result?.filter((faq) => !faq?.published);
    }

    const normalizedSearch = searchQuery?.trim()?.toLowerCase();
    if (normalizedSearch) {
      result = result?.filter((faq) => {
        const question = String(faq?.question || '')?.toLowerCase();
        const answer = String(faq?.answer || '')?.toLowerCase();
        return question?.includes(normalizedSearch) || answer?.includes(normalizedSearch);
      });
    }

    return [...result]?.sort((a, b) => {
      const rawOrderA = a?.display_order ?? a?.sort_order ?? 0;
      const rawOrderB = b?.display_order ?? b?.sort_order ?? 0;
      const orderA = Number.isFinite(Number(rawOrderA)) ? Number(rawOrderA) : 0;
      const orderB = Number.isFinite(Number(rawOrderB)) ? Number(rawOrderB) : 0;
      if (orderA !== orderB) return orderA - orderB;

      const dateA = a?.created_at ? new Date(a?.created_at)?.getTime() : 0;
      const dateB = b?.created_at ? new Date(b?.created_at)?.getTime() : 0;
      return dateB - dateA;
    });
  }, [faqs, selectedFilter, searchQuery]);

  const openCreateModal = () => {
    setEditingFaq(null);
    setFormData(EMPTY_FORM);
    setShowModal(true);
  };

  const openEditModal = (faq) => {
    setEditingFaq(faq);
    setFormData({
      question: faq?.question || '',
      answer: faq?.answer || '',
      published: Boolean(faq?.published)
    });
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    setEditingFaq(null);
    setFormData(EMPTY_FORM);
  };

  const handleSaveFaq = async () => {
    if (!formData?.question?.trim() || !formData?.answer?.trim()) {
      toast?.error('Question et reponse sont obligatoires');
      return;
    }

    const rawEditingOrder = editingFaq?.display_order ?? editingFaq?.sort_order;
    const fallbackOrder = Number.isFinite(Number(rawEditingOrder))
      ? Number(rawEditingOrder)
      : stats?.total;

    const payload = {
      question: formData?.question?.trim(),
      answer: formData?.answer?.trim(),
      published: Boolean(formData?.published),
      display_order: fallbackOrder
    };

    try {
      setSaving(true);
      let result;

      if (editingFaq?.id) {
        result = await faqService?.updateFAQ(editingFaq?.id, payload);
      } else {
        result = await faqService?.createFAQ(payload);
      }

      if (result?.error) {
        throw result?.error;
      }

      toast?.success(editingFaq?.id ? 'Question mise ? jour' : 'Question ajoutee');
      closeModal();
      await loadFaqs();
    } catch (error) {
      console.error('FAQ save error:', error);
      toast?.error(error?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFaq = async (faq) => {
    if (!faq?.id) return;

    if (!window.confirm(`Supprimer cette question ?\n\n${faq?.question || ''}`)) {
      return;
    }

    try {
      setDeletingId(faq?.id);
      const { error } = await faqService?.deleteFAQ(faq?.id);
      if (error) throw error;

      toast?.success('Question supprimee');
      await loadFaqs();
    } catch (error) {
      console.error('FAQ delete error:', error);
      toast?.error(error?.message || 'Erreur lors de la suppression');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date?.getTime())) return '-';

    return date?.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
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

        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Gérer la FAQ</h1>
            <p className="text-muted-foreground">Questions chargees depuis la base de donnees</p>
          </div>
          <Button iconName="Plus" onClick={openCreateModal}>
            Ajouter une question
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-elevation-1 p-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold text-foreground">{stats?.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow-elevation-1 p-4">
            <p className="text-sm text-muted-foreground">Publiees</p>
            <p className="text-2xl font-bold text-green-600">{stats?.published}</p>
          </div>
          <div className="bg-white rounded-lg shadow-elevation-1 p-4">
            <p className="text-sm text-muted-foreground">Brouillons</p>
            <p className="text-2xl font-bold text-yellow-600">{stats?.draft}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-elevation-1 p-4 mb-4">
              <h2 className="text-lg font-semibold text-foreground mb-4">Filtres</h2>
              <div className="space-y-1">
                {filtersWithCount?.map((filter) => (
                  <button
                    key={filter?.id}
                    onClick={() => setSelectedFilter(filter?.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                      selectedFilter === filter?.id
                        ? 'bg-blue-50 text-blue-600 font-medium'
                        : 'text-muted-foreground hover:bg-surface'
                    }`}
                  >
                    <span>{filter?.name}</span>
                    <span className="text-xs">{filter?.count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-elevation-1 p-4">
              <Input
                label="Recherche"
                placeholder="Question ou reponse..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event?.target?.value || '')}
                iconName="Search"
              />
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="space-y-4">
              {loading ? (
                <div className="bg-white rounded-lg shadow-elevation-1 p-10 text-center">
                  <Icon name="Loader2" size={32} className="animate-spin mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Chargement des questions...</p>
                </div>
              ) : filteredFaqs?.length === 0 ? (
                <div className="bg-white rounded-lg shadow-elevation-1 p-10 text-center">
                  <Icon name="HelpCircle" size={32} className="mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Aucune question pour ce filtre</p>
                </div>
              ) : (
                filteredFaqs?.map((faq) => (
                  <div key={faq?.id} className="bg-white rounded-lg shadow-elevation-1 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="text-lg font-semibold text-foreground">{faq?.question}</h3>
                          <span className={`px-2 py-1 text-xs rounded-full ${faq?.published ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {faq?.published ? 'Publiee' : 'Brouillon'}
                          </span>
                          <span className="px-2 py-1 text-xs rounded-full bg-surface text-muted-foreground">
                            Ordre: {Number.isFinite(Number(faq?.display_order ?? faq?.sort_order)) ? Number(faq?.display_order ?? faq?.sort_order) : 0}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{faq?.answer}</p>
                        <p className="text-xs text-muted-foreground mt-3">
                          Creation: {formatDate(faq?.created_at)} | MAJ: {formatDate(faq?.updated_at)}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" iconName="Edit" onClick={() => openEditModal(faq)}>
                          Modifier
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          iconName="Trash2"
                          loading={deletingId === faq?.id}
                          onClick={() => handleDeleteFaq(faq)}
                        >
                          Supprimer
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-modal p-4">
            <div className="bg-white rounded-lg shadow-elevation-4 max-w-2xl w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-foreground">
                  {editingFaq?.id ? 'Modifier la question' : 'Ajouter une question'}
                </h2>
                <button onClick={closeModal} className="text-muted-foreground hover:text-foreground" disabled={saving}>
                  <Icon name="X" size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <Input
                  label="Question"
                  placeholder="Ex: Comment reserver un equipement ?"
                  value={formData?.question}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      question: event?.target?.value || ''
                    }))
                  }
                />

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Reponse</label>
                  <textarea
                    className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={6}
                    placeholder="Reponse detaillee..."
                    value={formData?.answer}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        answer: event?.target?.value || ''
                      }))
                    }
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={Boolean(formData?.published)}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        published: Boolean(event?.target?.checked)
                      }))
                    }
                  />
                  Publier cette question
                </label>

                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={closeModal} disabled={saving}>
                    Annuler
                  </Button>
                  <Button onClick={handleSaveFaq} loading={saving}>
                    {editingFaq?.id ? 'Enregistrer' : 'Ajouter'}
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

export default AdminFAQ;


