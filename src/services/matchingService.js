import { supabase } from '../lib/supabase';
import { sendEmail } from './emailService';
import notificationService from './notificationService';

/**
 * Matching Service
 * Handles automatic matching between demandes and offres
 * Calculates compatibility scores and creates proposals
 */

function isSchemaError(error) {
  if (!error) return false;
  if (error?.code && typeof error?.code === 'string') {
    const errorClass = error?.code?.substring(0, 2);
    if (errorClass === '42' || errorClass === '08') return true;
  }
  if (error?.message) {
    const schemaErrorPatterns = [
      /relation.*does not exist/i,
      /column.*does not exist/i,
      /function.*does not exist/i,
      /syntax error/i,
    ];
    return schemaErrorPatterns?.some(pattern => pattern?.test(error?.message));
  }
  return false;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if two date ranges overlap
 */
function datesOverlap(start1, end1, start2, end2) {
  if (!start1 || !end1 || !start2 || !end2) return false;
  const s1 = new Date(start1);
  const e1 = new Date(end1);
  const s2 = new Date(start2);
  const e2 = new Date(end2);
  return s1 <= e2 && e1 >= s2;
}

function getAppOrigin() {
  return (
    (typeof window !== 'undefined' ? (window.location?.origin || '') : '')
    || import.meta?.env?.VITE_APP_URL
    || import.meta?.env?.VITE_SITE_URL
    || ''
  );
}

function buildAppUrl(path = '') {
  const origin = String(getAppOrigin() || '')?.trim()?.replace(/\/$/, '');
  const safePath = String(path || '');

  if (!origin) return safePath;
  if (!safePath) return origin;
  if (safePath?.startsWith('http://') || safePath?.startsWith('https://')) return safePath;
  return `${origin}${safePath?.startsWith('/') ? safePath : `/${safePath}`}`;
}

function formatDateForEmail(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date?.getTime?.())) return '';

  return date?.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatPricePerDay(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 'Prix a confirmer';

  return `${amount?.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} EUR/jour`;
}

function escapeHtml(value) {
  return String(value || '')
    ?.replace(/&/g, '&amp;')
    ?.replace(/</g, '&lt;')
    ?.replace(/>/g, '&gt;')
    ?.replace(/"/g, '&quot;')
    ?.replace(/'/g, '&#39;');
}

function buildProposalNoteHtml(note) {
  const normalizedNote = String(note || '')?.trim();
  if (!normalizedNote) return '';

  const escapedNote = escapeHtml(normalizedNote)?.replace(/\r?\n/g, '<br />');
  return `<div style="background-color: #f8fafc; border: 1px solid #dbeafe; border-radius: 8px; padding: 16px; margin: 16px 0;"><p style="margin: 0 0 8px 0;"><strong>Message ajoute a la proposition :</strong></p><p style="margin: 0;">${escapedNote}</p></div>`;
}

const matchingService = {
  /**
   * Find matching offers for a demand
   */
  findMatchesForDemand: async (demandeId) => {
    try {
      // Get demand details
      const { data: demande, error: demandeError } = await supabase?.from('demandes')?.select('*')?.eq('id', demandeId)?.single();

      if (demandeError) {
        if (isSchemaError(demandeError)) throw demandeError;
        return { data: null, error: demandeError };
      }

      if (!demande) {
        return { data: [], error: null };
      }

      // Get all published offers matching category
      let query = supabase?.from('annonces')?.select('*')?.eq('type', 'offre')?.eq('statut', 'publiee')?.eq('published', true);

      if (demande?.categorie_slug) {
        query = query?.eq('categorie', demande?.categorie_slug);
      }

      const { data: offers, error: offersError } = await query;

      if (offersError) {
        if (isSchemaError(offersError)) throw offersError;
        return { data: null, error: offersError };
      }

      const activeOffers = (offers || [])?.filter(
        (offer) => !Boolean(offer?.temporarily_disabled ?? offer?.temporarilyDisabled)
      );

      if (!activeOffers || activeOffers?.length === 0) {
        return { data: [], error: null };
      }

      // Calculate match scores
      const matches = [];

      for (const offer of activeOffers) {
        let score = 0;
        const factors = {};

        // 1. Category match (40 points)
        if (demande?.categorie_slug && offer?.categorie === demande?.categorie_slug) {
          score += 40;
          factors.categoryMatch = true;
        }

        // 2. Location proximity (30 points)
        if (demande?.ville && offer?.latitude && offer?.longitude) {
          // For now, simple city match. In production, use geocoding
          const cityMatch = offer?.city?.toLowerCase()?.includes(demande?.ville?.toLowerCase()) ||
                           offer?.ville?.toLowerCase()?.includes(demande?.ville?.toLowerCase());
          
          if (cityMatch) {
            score += 30;
            factors.locationMatch = true;
            factors.distance = 0;
          } else if (demande?.rayon_km && offer?.latitude && offer?.longitude) {
            // If we had demand coordinates, we'd calculate distance here
            // For now, partial credit for being in specified radius
            score += 15;
            factors.locationMatch = 'partial';
          }
        }

        // 3. Price compatibility (20 points)
        if (demande?.prix_max && offer?.prix_jour) {
          if (offer?.prix_jour <= demande?.prix_max) {
            const priceRatio = offer?.prix_jour / demande?.prix_max;
            score += Math.round(20 * (1 - priceRatio * 0.5)); // Better score for lower prices
            factors.priceCompatible = true;
            factors.priceRatio = priceRatio;
          }
        }

        // 4. Availability overlap (10 points)
        if (demande?.dispo_de && demande?.dispo_a && offer?.availability_start && offer?.availability_end) {
          if (datesOverlap(demande?.dispo_de, demande?.dispo_a, offer?.availability_start, offer?.availability_end)) {
            score += 10;
            factors.availabilityOverlap = true;
          }
        }

        // Only include matches with minimum score of 40
        if (score >= 40) {
          matches?.push({
            offer,
            score,
            factors
          });
        }
      }

      // Sort by score descending
      matches?.sort((a, b) => b?.score - a?.score);

      return { data: matches, error: null };
    } catch (error) {
      console.error('Find matches error:', error);
      throw error;
    }
  },

  /**
   * Create proposal from demand to offer
   */
  createProposal: async (demandeId, offerId, matchScore = null, note = null) => {
    try {
      const { data: { user } } = await supabase?.auth?.getUser();
      if (!user) return { data: null, error: { message: 'User not authenticated' } };

      // Get demand details
      const { data: demande } = await supabase?.from('demandes')?.select('user_id, titre, dispo_de, dispo_a, ville')?.eq('id', demandeId)?.single();

      // Get offer details
      const { data: offer } = await supabase?.from('annonces')?.select('owner_id, titre, prix_jour, ville')?.eq('id', offerId)?.single();

      if (!demande || !offer) {
        return { data: null, error: { message: 'Demande ou offre introuvable' } };
      }

      const { data, error } = await supabase?.from('proposals')?.insert({
          demand_id: demandeId,
          offer_id: offerId,
          proposer_id: offer?.owner_id,
          proposer_user_id: offer?.owner_id,
          demander_id: demande?.user_id,
          status: 'sent',
          match_score: matchScore,
          note,
          created_at: new Date()?.toISOString()
        })?.select()?.single();

      if (error) {
        if (isSchemaError(error)) throw error;
        return { data: null, error };
      }

      // Create notification for demand creator
      await notificationService?.createNotification(
        demande?.user_id,
        'proposal_received',
        {
          proposalId: data?.id,
          offerId,
          demandeId,
          matchScore
        }
      );

      const [demanderProfileResult, proposerProfileResult] = await Promise.all([
        supabase?.from('profiles')?.select('pseudo, email')?.eq('id', demande?.user_id)?.maybeSingle(),
        supabase?.from('profiles')?.select('pseudo')?.eq('id', offer?.owner_id)?.maybeSingle()
      ]);

      if (demanderProfileResult?.error) {
        console.warn('Create proposal email: demander profile lookup failed:', demanderProfileResult?.error?.message || demanderProfileResult?.error);
      }

      if (proposerProfileResult?.error) {
        console.warn('Create proposal email: proposer profile lookup failed:', proposerProfileResult?.error?.message || proposerProfileResult?.error);
      }

      const demanderProfile = demanderProfileResult?.data || null;
      const proposerProfile = proposerProfileResult?.data || null;

      if (demanderProfile?.email) {
        const emailResult = await sendEmail({
          to: demanderProfile?.email,
          templateKey: 'proposal_received_requester',
          variables: {
            user_name: demanderProfile?.pseudo || demanderProfile?.email || 'Utilisateur',
            renter_name: demanderProfile?.pseudo || demanderProfile?.email || 'Utilisateur',
            proposer_name: proposerProfile?.pseudo || 'Un proprietaire',
            demande_title: demande?.titre || 'Votre demande',
            annonce_title: offer?.titre || 'Annonce',
            offer_city: offer?.ville || demande?.ville || 'Non precisee',
            price_per_day: formatPricePerDay(offer?.prix_jour),
            start_date: formatDateForEmail(demande?.dispo_de) || 'A confirmer',
            end_date: formatDateForEmail(demande?.dispo_a) || 'A confirmer',
            demande_url: buildAppUrl('/mes-annonces#demandes'),
            proposal_note_html: buildProposalNoteHtml(note)
          }
        });

        if (emailResult?.success) {
          const timestamp = new Date()?.toISOString();
          const { error: markEmailSentError } = await supabase
            ?.from('proposals')
            ?.update({ email_sent_at: timestamp })
            ?.eq('id', data?.id);

          if (markEmailSentError) {
            console.warn('Create proposal email: unable to persist email_sent_at:', markEmailSentError?.message || markEmailSentError);
          } else if (data) {
            data.email_sent_at = timestamp;
          }
        } else {
          console.warn("Echec d'envoi e-mail demandeur (proposition recue):", emailResult?.error);
        }
      }

      return { data, error: null };
    } catch (error) {
      console.error('Create proposal error:', error);
      throw error;
    }
  },

  /**
   * Get proposals for a demand
   */
  getProposalsForDemand: async (demandeId) => {
    try {
      const { data, error } = await supabase?.from('proposals')?.select(`
          *,
          offer:annonces!proposals_offer_id_fkey(id, titre, photos, prix_jour, city, owner_id),
          proposer:profiles!proposals_proposer_user_id_fkey(pseudo, avatar_url)
        `)?.eq('demand_id', demandeId)?.order('match_score', { ascending: false });

      if (error) {
        if (error?.code === 'PGRST116') return { data: [], error: null };
        if (isSchemaError(error)) throw error;
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Get proposals for demand error:', error);
      throw error;
    }
  },

  /**
   * Prepare checkout context for a proposal.
   * Final acceptance is recorded only after confirmed payment.
   */
  acceptProposal: async (proposalId) => {
    try {
      const { data: { user } } = await supabase?.auth?.getUser();
      if (!user) return { data: null, error: { message: 'User not authenticated' } };

      const { data: proposal, error: proposalError } = await supabase?.from('proposals')?.select(`
          *,
          demand:demandes!proposals_demand_id_fkey(*),
          offer:annonces!proposals_offer_id_fkey(*)
        `)?.eq('id', proposalId)?.eq('demander_id', user?.id)?.single();

      if (proposalError) {
        if (isSchemaError(proposalError)) throw proposalError;
        return { data: null, error: proposalError };
      }

      const normalizedStatus = String(proposal?.status || '')?.trim()?.toLowerCase();
      if (normalizedStatus !== 'sent') {
        return {
          data: null,
          error: { message: 'Cette proposition ne peut plus être utilisée pour lancer un paiement.' }
        };
      }

      if (!proposal?.offer_id || !proposal?.offer || !proposal?.demand?.dispo_de || !proposal?.demand?.dispo_a) {
        return {
          data: null,
          error: { message: 'Cette proposition ne contient pas assez d’informations pour lancer le paiement.' }
        };
      }

      return { data: proposal, error: null };
    } catch (error) {
      console.error('Accept proposal error:', error);
      throw error;
    }
  },

  /**
   * Decline proposal
   */
  declineProposal: async (proposalId, reason = null) => {
    try {
      const { data: { user } } = await supabase?.auth?.getUser();
      if (!user) return { data: null, error: { message: 'User not authenticated' } };

      const { data, error } = await supabase?.from('proposals')?.update({
          status: 'declined',
          declined_at: new Date()?.toISOString(),
          responded_at: new Date()?.toISOString(),
          note: reason
        })?.eq('id', proposalId)?.eq('demander_id', user?.id)?.select()?.single();

      if (error) {
        if (isSchemaError(error)) throw error;
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Decline proposal error:', error);
      throw error;
    }
  },

  /**
   * Run automatic matching for all open demands
   */
  runAutomaticMatching: async () => {
    try {
      // Get all open demands
      const { data: demandes, error: demandesError } = await supabase?.from('demandes')?.select('*')?.eq('statut', 'open')?.eq('moderation_status', 'approved');

      if (demandesError) {
        if (isSchemaError(demandesError)) throw demandesError;
        return { data: null, error: demandesError };
      }

      const results = [];

      for (const demande of demandes || []) {
        const { data: matches } = await matchingService?.findMatchesForDemand(demande?.id);
        
        if (matches && matches?.length > 0) {
          // Create proposals for top 3 matches
          const topMatches = matches?.slice(0, 3);
          
          for (const match of topMatches) {
            // Check if proposal already exists
            const { data: existing } = await supabase?.from('proposals')?.select('id')?.eq('demand_id', demande?.id)?.eq('offer_id', match?.offer?.id)?.maybeSingle();

            if (!existing) {
              await matchingService?.createProposal(
                demande?.id,
                match?.offer?.id,
                match?.score,
                `Match automatique - Score: ${match?.score}/100`
              );
            }
          }

          results?.push({
            demandeId: demande?.id,
            matchesFound: matches?.length,
            proposalsCreated: topMatches?.length
          });
        }
      }

      return { data: results, error: null };
    } catch (error) {
      console.error('Run automatic matching error:', error);
      throw error;
    }
  }
};

export default matchingService;
