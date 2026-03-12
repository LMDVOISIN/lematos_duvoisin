import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';
import normaliserAnnonce from '../../../utils/annonceNormalizer';
import { construireUrlAnnonce } from '../../../utils/listingUrl';

const normaliserTexte = (value) => String(value || '')?.trim()?.toLowerCase();

const normaliserCategorie = (value) =>
  String(value || '')
    ?.normalize('NFD')
    ?.replace(/[\u0300-\u036f]/g, '')
    ?.toLowerCase()
    ?.replace(/[^a-z0-9]+/g, '-')
    ?.replace(/^-+|-+$/g, '');

const SimilarListings = ({ currentEquipmentId, categoryId, currentCity, currentDailyPrice }) => {
  const [similarEquipment, setSimilarEquipment] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSimilarEquipment();
  }, [categoryId, currentEquipmentId, currentCity, currentDailyPrice]);

  const fetchSimilarEquipment = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        ?.from('annonces')
        ?.select('*')
        ?.or('statut.eq.publiee,published.eq.true')
        ?.neq('id', currentEquipmentId)
        ?.limit(24);

      if (error) throw error;

      const annoncesNormalisees = (data || [])?.map((annonce) => normaliserAnnonce(annonce));
      const annoncesPubliquesVisibles = annoncesNormalisees?.filter(
        (annonce) => !Boolean(annonce?.temporarily_disabled ?? annonce?.temporarilyDisabled)
      );
      const categorieCible = normaliserCategorie(categoryId);
      if (!categorieCible) {
        setSimilarEquipment([]);
        return;
      }

      const categorieCandidatesForAnnonce = (annonce) => [
        annonce?.categorie,
        annonce?.category
      ]
        ?.map((value) => normaliserCategorie(value))
        ?.filter(Boolean);

      const memeCategorie = annoncesPubliquesVisibles?.filter((annonce) =>
        categorieCandidatesForAnnonce(annonce)?.includes(categorieCible)
      );

      const villeCible = normaliserTexte(currentCity);
      const prixCible = Number(currentDailyPrice || 0);
      const annoncesTriees = [...(memeCategorie || [])]?.sort((a, b) => {
        const aVille = normaliserTexte(a?.city || a?.ville || a?.location);
        const bVille = normaliserTexte(b?.city || b?.ville || b?.location);
        const aPrix = Number(a?.prix_jour || 0);
        const bPrix = Number(b?.prix_jour || 0);

        const aScoreVille = villeCible && aVille === villeCible ? 1 : 0;
        const bScoreVille = villeCible && bVille === villeCible ? 1 : 0;
        if (aScoreVille !== bScoreVille) return bScoreVille - aScoreVille;

        if (prixCible > 0) {
          const deltaA = Math.abs(aPrix - prixCible);
          const deltaB = Math.abs(bPrix - prixCible);
          if (deltaA !== deltaB) return deltaA - deltaB;
        }

        return String(a?.titre || '')?.localeCompare(String(b?.titre || ''), 'fr');
      });

      setSimilarEquipment((annoncesTriees || [])?.slice(0, 4));
    } catch (error) {
      console.error('Erreur lors du chargement de similar equipment:', error);
      setSimilarEquipment([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !similarEquipment || similarEquipment?.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-semibold text-foreground mb-6">Annonces similaires</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {similarEquipment?.map((equipment) => (
          <div key={equipment?.id} className="group block bg-surface rounded-lg shadow-sm hover:shadow-md transition-all overflow-hidden">
            <div className="relative w-full overflow-hidden" style={{ height: '180px' }}>
              <Image
                src={equipment?.image}
                alt={equipment?.imageAlt}
                className="w-full h-full object-cover group-hover:scale-105 transition-smooth"
              />

              <div className="absolute top-2 left-2 px-2 py-1 rounded-md text-xs font-semibold bg-[#28a745] text-white">
                Offre
              </div>
            </div>

            <div className="p-4">
              <h3 className="text-sm font-semibold text-foreground line-clamp-2 mb-2 min-h-[40px]">
                {equipment?.titre}
              </h3>

              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                <Icon name="MapPin" size={12} />
                <span className="truncate">{equipment?.location}</span>
              </div>

              <div className="flex items-center justify-between mb-3">
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-[#17a2b8]">
                    {Number(equipment?.prix_jour || 0)?.toFixed(2)} €
                  </span>
                  <span className="text-xs text-muted-foreground">/ jour</span>
                </div>
                {equipment?.rating ? (
                  <div className="flex items-center gap-1">
                    <Icon name="Star" size={12} className="text-[#F59E0B] fill-[#F59E0B]" />
                    <span className="text-xs font-medium text-foreground">{equipment?.rating}</span>
                  </div>
                ) : null}
              </div>

              <Link to={construireUrlAnnonce(equipment)}>
                <Button
                  variant="default"
                  size="sm"
                  className="w-full bg-[#17a2b8] hover:bg-[#138496] text-white"
                >
                  Voir le detail
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SimilarListings;

