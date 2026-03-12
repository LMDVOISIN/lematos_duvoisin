import { jsPDF } from 'jspdf';
import { supabase } from '../lib/supabase';

/**
 * Generer le PDF du contrat de location
 */
export const generateContractPDF = async (reservationData) => {
  try {
    const {
      id,
      owner,
      renter,
      annonce,
      start_date,
      end_date,
      prix_jour,
      nombre_jours,
      montant_total,
      commission_plateforme,
      montant_assurance,
      montant_caution
    } = reservationData;
    const doc = new jsPDF();
    let yPos = 20;

    // Logo et en-tete
    doc?.setFontSize(20);
    doc?.setFont('helvetica', 'bold');
    doc?.text('Le Matos du Voisin', 105, yPos, { align: 'center' });
    yPos += 10;

    doc?.setFontSize(16);
    doc?.text('CONTRAT DE LOCATION', 105, yPos, { align: 'center' });
    yPos += 15;

    // Numero de contrat
    doc?.setFontSize(10);
    doc?.setFont('helvetica', 'normal');
    doc?.text(`Contrat N° ${id}`, 20, yPos);
    doc?.text(`Date : ${new Date()?.toLocaleDateString('fr-FR')}`, 150, yPos);
    yPos += 15;

    // Section propriÃ©taire
    doc?.setFontSize(12);
    doc?.setFont('helvetica', 'bold');
    doc?.text('PROPRIÉTAIRE (Bailleur)', 20, yPos);
    yPos += 7;
    doc?.setFontSize(10);
    doc?.setFont('helvetica', 'normal');
    doc?.text(`Nom: ${owner?.pseudo || 'N/A'}`, 20, yPos);
    yPos += 5;
    doc?.text(`E-mail : ${owner?.email || '-'}`, 20, yPos);
    yPos += 5;
    doc?.text(`Adresse: ${owner?.adresse || 'N/A'}, ${owner?.code_postal || ''} ${owner?.ville || ''}`, 20, yPos);
    yPos += 10;

    // Section locataire
    doc?.setFontSize(12);
    doc?.setFont('helvetica', 'bold');
    doc?.text('LOCATAIRE (Preneur)', 20, yPos);
    yPos += 7;
    doc?.setFontSize(10);
    doc?.setFont('helvetica', 'normal');
    doc?.text(`Nom: ${renter?.pseudo || 'N/A'}`, 20, yPos);
    yPos += 5;
    doc?.text(`E-mail : ${renter?.email || '-'}`, 20, yPos);
    yPos += 5;
    doc?.text(`Adresse: ${renter?.adresse || 'N/A'}, ${renter?.code_postal || ''} ${renter?.ville || ''}`, 20, yPos);
    yPos += 10;

    // Details du matÃ©riel
    doc?.setFontSize(12);
    doc?.setFont('helvetica', 'bold');
    doc?.text('OBJET DE LA LOCATION', 20, yPos);
    yPos += 7;
    doc?.setFontSize(10);
    doc?.setFont('helvetica', 'normal');
    doc?.text(`Titre: ${annonce?.titre || 'N/A'}`, 20, yPos);
    yPos += 5;
    const descLines = doc?.splitTextToSize(`Description: ${annonce?.description || 'N/A'}`, 170);
    doc?.text(descLines, 20, yPos);
    yPos += descLines?.length * 5 + 5;
    doc?.text(`Catégorie: ${annonce?.categorie || 'N/A'}`, 20, yPos);
    yPos += 10;

    // Periode de location
    doc?.setFontSize(12);
    doc?.setFont('helvetica', 'bold');
    doc?.text('PÉRIODE DE LOCATION', 20, yPos);
    yPos += 7;
    doc?.setFontSize(10);
    doc?.setFont('helvetica', 'normal');
    doc?.text(`Date de début: ${new Date(start_date)?.toLocaleDateString('fr-FR')}`, 20, yPos);
    yPos += 5;
    doc?.text(`Date de fin: ${new Date(end_date)?.toLocaleDateString('fr-FR')}`, 20, yPos);
    yPos += 5;
    doc?.text(`Durée: ${nombre_jours} jour(s)`, 20, yPos);
    yPos += 10;

    // Detail de tarification
    doc?.setFontSize(12);
    doc?.setFont('helvetica', 'bold');
    doc?.text('TARIFICATION', 20, yPos);
    yPos += 7;
    doc?.setFontSize(10);
    doc?.setFont('helvetica', 'normal');
    doc?.text(`Prix par jour: ${prix_jour?.toFixed(2) || '0.00'} €`, 20, yPos);
    yPos += 5;
    doc?.text(`Nombre de jours: ${nombre_jours}`, 20, yPos);
    yPos += 5;
    doc?.text(`Sous-total location: ${(prix_jour * nombre_jours)?.toFixed(2) || '0.00'} €`, 20, yPos);
    yPos += 5;
    doc?.text(`Commission plateforme: ${commission_plateforme?.toFixed(2) || '0.00'} €`, 20, yPos);
    yPos += 5;
    if (montant_assurance > 0) {
      doc?.text(`Assurance: ${montant_assurance?.toFixed(2) || '0.00'} €`, 20, yPos);
      yPos += 5;
    }
    doc?.setFont('helvetica', 'bold');
    doc?.text(`MONTANT TOTAL: ${montant_total?.toFixed(2) || '0.00'} €`, 20, yPos);
    yPos += 5;
    doc?.setFont('helvetica', 'normal');
    doc?.text(`Empreinte bancaire CB (garantie caution): ${montant_caution?.toFixed(2) || '0.00'} EUR`, 20, yPos);
    yPos += 15;

    // Conditions generales
    if (yPos > 240) {
      doc?.addPage();
      yPos = 20;
    }
    doc?.setFontSize(12);
    doc?.setFont('helvetica', 'bold');
    doc?.text('CONDITIONS GÉNÉRALES', 20, yPos);
    yPos += 7;
    doc?.setFontSize(9);
    doc?.setFont('helvetica', 'normal');
    const terms = [
      "1. Le locataire s'engage à restituer le matériel dans l'état où il l'a reçu.",
      "2. L'empreinte bancaire CB de caution est une autorisation non débitée au paiement de la location ; aucun frais de traitement ne s'applique tant qu'elle n'est pas capturée.",
      "3. Le locataire est responsable du matériel pendant toute la durée de la location.",
      "4. Avant la remise du matériel, le locataire doit déposer une pièce d'identité valide sur la plateforme. Si elle n'est pas déposée à temps, la réservation peut être annulée, un jour conservé et le solde remboursé.",
      "5. En cas de retard, dépassement ou non-restitution, la décision sur la caution passe par le workflow officiel d'état des lieux, contestation et modération ; si une capture est validée, les frais de paiement carte sur le montant capturé et d'éventuels frais de litige peuvent s'appliquer.",
      "6. Le locataire doit disposer d'une assurance responsabilite civile couvrant la location.",
      "7. Le propriétaire garantit que le matériel est en bon état de fonctionnement.",
      "8. Tout litige sera soumis aux tribunaux compétents de la juridiction du propriétaire."
    ];
    terms?.forEach(term => {
      const termLines = doc?.splitTextToSize(term, 170);
      doc?.text(termLines, 20, yPos);
      yPos += termLines?.length * 4 + 2;
    });
    yPos += 10;

    // Signatures
    if (yPos > 240) {
      doc?.addPage();
      yPos = 20;
    }
    doc?.setFontSize(10);
    doc?.setFont('helvetica', 'bold');
    doc?.text('SIGNATURES', 20, yPos);
    yPos += 10;
    doc?.setFont('helvetica', 'normal');
    doc?.text('Le Propriétaire', 30, yPos);
    doc?.text('Le Locataire', 120, yPos);
    yPos += 5;
    doc?.text('Date: _______________', 30, yPos);
    doc?.text('Date: _______________', 120, yPos);
    yPos += 10;
    doc?.text('Signature:', 30, yPos);
    doc?.text('Signature:', 120, yPos);
    yPos += 20;

    // Mentions legales
    doc?.setFontSize(8);
    doc?.setFont('helvetica', 'italic');
    const legalText = 'Document généré automatiquement par Le Matos du Voisin. Ce contrat est soumis au droit français.';
    doc?.text(legalText, 105, yPos, { align: 'center' });

    return doc;
  } catch (error) {
    console.error('Erreur lors de la generation du PDF de contrat :', error);
    throw error;
  }
};

/**
 * TÃ©lÃ©verser le contrat dans le stockage Supabase et mettre Ã  jour reservation_docs
 */
export const uploadContract = async (reservationId, pdfDoc) => {
  try {
    // Generer le blob PDF
    const pdfBlob = pdfDoc?.output('blob');
    const fileName = `contract_${reservationId}_${Date.now()}.pdf`;
    const filePath = `contracts/${fileName}`;

    // TÃ©lÃ©verser vers le stockage Supabase
    const { data: uploadData, error: uploadError } = await supabase?.storage?.from('reservation-docs')?.upload(filePath, pdfBlob, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Recuperer l'URL publique
    const { data: urlData } = supabase?.storage?.from('reservation-docs')?.getPublicUrl(filePath);

    const contractUrl = urlData?.publicUrl;

    // Mettre a jour la table reservation_docs
    const { error: updateError } = await supabase?.from('reservation_docs')?.upsert({
        reservation_id: reservationId,
        contract_url: contractUrl,
        contract_ok: true,
        updated_at: new Date()?.toISOString()
      }, {
        onConflict: 'reservation_id'
      });

    if (updateError) throw updateError;

    return { contractUrl, success: true };
  } catch (error) {
    console.error('Erreur lors du t?l?versement du contrat :', error);
    throw error;
  }
};

/**
 * Generer et tÃ©lÃ©verser le contrat quand la reservation est acceptee
 */
export const generateAndUploadContract = async (reservationId) => {
  try {
    // Recuperer les donnees completes de reservation avec relations
    const { data: reservation, error: fetchError } = await supabase?.from('reservations')?.select(`
        *,
        owner:owner_id(id, pseudo, email, adresse, code_postal, ville),
        renter:renter_id(id, pseudo, email, adresse, code_postal, ville),
        annonce:annonce_id(id, titre, description, categorie)
      `)?.eq('id', reservationId)?.single();

    if (fetchError) throw fetchError;
    if (!reservation) throw new Error('Réservation introuvable');

    // Generer le PDF
    const pdfDoc = await generateContractPDF(reservation);

    // TÃ©lÃ©verser et enregistrer l'URL
    const result = await uploadContract(reservationId, pdfDoc);

    return result;
  } catch (error) {
    console.error('Erreur lors de la generation et du t?l?versement du contrat :', error);
    throw error;
  }
};

/**
 * Telecharger le PDF du contrat
 */
export const downloadContract = async (contractUrl, reservationId) => {
  try {
    const response = await fetch(contractUrl);
    const blob = await response?.blob();
    const url = window.URL?.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contrat_location_${reservationId}.pdf`;
    document.body?.appendChild(link);
    link?.click();
    document.body?.removeChild(link);
    window.URL?.revokeObjectURL(url);
  } catch (error) {
    console.error('Erreur lors du telechargement du contrat :', error);
    throw error;
  }
};

function contractService(...args) {
  // eslint-disable-next-line no-console
  console.warn('Espace reserve : contractService n\'est pas encore implemente.', args);
  return null;
}

export default contractService;



