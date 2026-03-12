-- Align legal and FAQ wording with locataire-selected caution modes:
-- - cb: caution captured at payment then refunded on closure without dispute
-- - cheque: physical cheque handed to owner, ID copy kept + CNI v?rification
-- - assurance: paid protection, no CB/cheque caution

UPDATE public.legal_pages
SET
  content = regexp_replace(
    content,
    'Une caution peut[^<]*\\.',
    'Une caution peut etre demandee selon le mode choisi par le locataire (CB, cheque ou assurance) au moment de reserver : mode CB = caution bancaire pr?lev?e au paiement puis rembours?e automatiquement ? la cl?ture sans litige ; mode cheque = cheque de caution remis en main propre au propri?taire (conservation d?une pi?ce d?identit? et v?rification CNI) ; mode assurance = pas de caution CB ni cheque, couverture via assurance. Les modes CB et cheque sont gratuits pour le locataire.',
    'gi'
  ),
  updated_at = now()
WHERE slug IN ('cgv');

UPDATE public.faqs
SET
  answer = 'La caution depend du mode choisi par le locataire (CB, cheque ou assurance) au moment de reserver. Mode CB : caution pr?lev?e au paiement puis rembours?e automatiquement ? la cl?ture sans litige. Mode cheque : cheque de caution remis en main propre au propri?taire lors de la remise du mat?riel, avec conservation d?une pi?ce d?identit? et v?rification CNI. Mode assurance : pas de caution CB ni cheque, protection via assurance. Les modes CB et cheque sont gratuits pour le locataire.'
WHERE lower(coalesce(question, '')) LIKE 'comment fonctionne la caution%';

UPDATE public.faqs
SET
  answer = 'Mode CB : la caution est rembours?e automatiquement ? la cl?ture sans litige, selon le workflow officiel. Mode cheque : le cheque est restitue au locataire ? la fin de location si aucun dommage ni litige n?est constate. Mode assurance : aucune caution CB ni cheque n?est restituee car la protection passe par l?assurance.'
WHERE lower(coalesce(question, '')) LIKE 'quand la caution est-elle restitu%';

UPDATE public.faqs
SET
  answer = 'Le montant total peut inclure les frais de service et, selon le mode choisi, une caution bancaire (mode CB) ou une assurance. En mode cheque, aucune caution n?est d?bit?e en ligne : le cheque est remis en main propre au propri?taire (conservation d?une pi?ce d?identit? et v?rification CNI).'
WHERE lower(coalesce(question, '')) LIKE 'pourquoi le montant final peut-il diff%';
