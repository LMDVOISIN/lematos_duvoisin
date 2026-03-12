-- Seed pages legales (mentions + CGU + CGV + confidentialite + cookies)
-- Usage: executer ce script dans Supabase SQL Editor (production)

INSERT INTO public.legal_pages (slug, title, content) VALUES
(
  'mentions-legales',
  'Mentions legales',
  $$<h1>Mentions legales</h1>
<p>Derniere mise ? jour : 14 fevrier 2026</p>
<h2>Editeur du site</h2>
<ul>
  <li><strong>Raison sociale :</strong> Le Matos du Voisin SAS</li>
  <li><strong>Capital social :</strong> 50 000 EUR</li>
  <li><strong>Siege social :</strong> 123 Avenue de la Republique, 69003 Lyon, France</li>
  <li><strong>SIRET :</strong> 123 456 789 00012</li>
  <li><strong>RCS :</strong> Lyon B 123 456 789</li>
  <li><strong>TVA intracommunautaire :</strong> FR12 123456789</li>
  <li><strong>Telephone :</strong> +33 (0)4 XX XX XX XX</li>
  <li><strong>E-mail :</strong> contact@lematosduvoisin.fr</li>
</ul>
<h2>Hebergeur</h2>
<ul>
  <li><strong>Raison sociale :</strong> OVH SAS</li>
  <li><strong>Siege social :</strong> 2 rue Kellermann, 59100 Roubaix, France</li>
  <li><strong>Telephone :</strong> +33 (0)9 72 10 10 07</li>
  <li><strong>Site web :</strong> www.ovh.com</li>
</ul>
<h2>Directeur de publication</h2>
<p>Le directeur de la publication du site est <strong>Jean Dupont</strong>, en qualite de President de Le Matos du Voisin SAS.</p>
<h2>Contact</h2>
<ul>
  <li><strong>Par e-mail :</strong> contact@lematosduvoisin.fr</li>
  <li><strong>Par telephone :</strong> +33 (0)4 XX XX XX XX (du lundi au vendredi, 9h-18h)</li>
  <li><strong>Par courrier :</strong> Le Matos du Voisin SAS, 123 Avenue de la Republique, 69003 Lyon, France</li>
</ul>
<h2>Propriete intellectuelle</h2>
<p>L'ensemble du contenu du site (textes, images, videos, logos, icones, etc.) est la propriete exclusive de Le Matos du Voisin SAS ou de ses partenaires.</p>
<p>Toute reproduction, distribution, modification, adaptation, retransmission ou publication est interdite sans accord ?crit pr?alable.</p>
<h2>Donnees personnelles</h2>
<p>Le traitement de vos donnees personnelles est regi par la politique de confidentialite disponible sur le site.</p>
<p>Conform?ment au RGPD et ? la loi Informatique et Libertes, vous disposez d'un droit d'acc?s, de rectification, de suppression et d'opposition.</p>
<p>Pour exercer ces droits : dpo@lematosduvoisin.fr</p>$$
),
(
  'cgu',
  'Conditions Generales d''Utilisation (CGU)',
  $$<h1>Conditions Generales d'Utilisation (CGU)</h1>
<p>Derniere mise ? jour : 14 fevrier 2026</p>
<h2>1. Objet</h2>
<p>Les presentes CGU definissent les conditions d'utilisation de la plateforme Le Matos du Voisin.</p>
<h2>2. Acceptation des CGU</h2>
<p>L'utilisation de la plateforme implique l'acceptation pleine et entiere des presentes CGU.</p>
<h2>3. Inscription et compte utilisateur</h2>
<ul>
  <li>Fournir des informations exactes et a jour</li>
  <li>Conserver la confidentialite des identifiants</li>
  <li>Informer sans delai en cas d'usage non autorise</li>
  <li>Etre age d'au moins 18 ans</li>
</ul>
<h2>4. Description des services</h2>
<ul>
  <li>Publication d'annonces</li>
  <li>Recherche et reservation d'objets</li>
  <li>Messagerie entre utilisateurs</li>
  <li>Paiement s?curis?</li>
  <li>Gestion des cautions</li>
</ul>
<h2>5. Obligations des utilisateurs</h2>
<ul>
  <li>Respecter les lois en vigueur</li>
  <li>Ne pas publier de contenu illicite ou offensant</li>
  <li>Respecter les conditions de location</li>
  <li>Restituer les objets dans l'etat convenu</li>
</ul>
<h2>6. Responsabilite</h2>
<p>Le Matos du Voisin agit comme interm?diaire entre utilisateurs.</p>
<h2>7. Propriete intellectuelle</h2>
<p>Tous les elements de la plateforme sont proteges par le droit de la propriete intellectuelle.</p>
<h2>8. Modification des CGU</h2>
<p>Les CGU peuvent etre modifi?es a tout moment. La poursuite de l'utilisation vaut acceptation des nouvelles conditions.</p>
<h2>9. Resiliation</h2>
<p>Le compte peut etre r?sili? par l'utilisateur ou suspendu en cas de violation des CGU.</p>$$
),
(
  'cgv',
  'Conditions Generales de Vente (CGV)',
  $$<h1>Conditions Generales de Vente (CGV)</h1>
<p>Derniere mise ? jour : 14 fevrier 2026</p>
<h2>1. Objet</h2>
<p>Les presentes CGV regissent les transactions entre loueurs et locataires sur la plateforme.</p>
<h2>2. Tarifs et paiement</h2>
<ul>
  <li>Prix affiches en euros TTC</li>
  <li>Paiement en ligne s?curis?</li>
  <li>Commission plateforme : 12% du prix de location</li>
</ul>
<h2>3. Reservation</h2>
<ol>
  <li>Demande du locataire</li>
  <li>Acceptation ou refus du loueur</li>
  <li>Paiement a confirmation</li>
  <li>Organisation de la remise</li>
</ol>
<h2>4. Caution</h2>
<p>La caution est garantie uniquement par empreinte bancaire (CB) : il s?agit d?une autorisation bancaire non d?bit?e au paiement de la location. Elle est lib?r?e automatiquement ? la cl?ture sans litige. Aucun frais de traitement n?est applique tant qu?elle n?est pas capturee. En cas de litige valide, elle peut etre capturee totalement ou partiellement selon le protocole officiel ; des frais de paiement sur le montant capture et, en cas de contestation ulterieure, d?eventuels frais de litige peuvent alors s?appliquer selon le reseau de carte.</p>
<h2>5. Assurance</h2>
<p>Une assurance optionnelle peut etre souscrite par le locataire.</p>
<h2>6. Annulation et remboursement</h2>
<p>Les r?gles de remboursement varient selon la date d'annulation.</p>
<h2>7. Restitution</h2>
<p>Le locataire restitue l'objet dans l'etat convenu, ? la date prevue.</p>
<h2>8. Resolution des litiges</h2>
<p>Une m?diation est proposee. A d?faut d'accord, comp?tence des tribunaux du si?ge social.</p>$$
),
(
  'politique-confidentialite',
  'Politique de confidentialite',
  $$<h1>Politique de confidentialite</h1>
<p>Derniere mise ? jour : 14 fevrier 2026</p>
<h2>1. Donnees collectees</h2>
<ul>
  <li>Donnees d'identification (nom, e-mail, telephone, adresse)</li>
  <li>Donnees de v?rification (identit?, domicile, paiement via prestataire s?curis?)</li>
  <li>Donnees d'utilisation (annonces, reservations, messages, avis)</li>
</ul>
<h2>2. Utilisation des donnees</h2>
<p>Creation de compte, execution des transactions, lutte contre la fraude, notifications et amelioration du service.</p>
<h2>3. Partage des donnees</h2>
<p>Partage limite aux utilisateurs, prestataires necessaires et autorites legalement competentes.</p>
<h2>4. Conservation des donnees</h2>
<ul>
  <li>Compte actif : pendant la duree d'utilisation</li>
  <li>Transactions : 10 ans</li>
  <li>V?rification : 5 ans</li>
</ul>
<h2>5. Vos droits</h2>
<p>Acces, rectification, effacement, limitation, portabilite et opposition.</p>
<p>Contact DPO : dpo@lematosduvoisin.fr</p>
<h2>6. Securite</h2>
<p>Mesures techniques et organisationnelles de protection des donnees.</p>
<h2>7. Cookies</h2>
<p>Voir la politique cookies.</p>
<h2>8. Contact</h2>
<p>Le Matos du Voisin SAS - 123 Avenue de la Republique, 69003 Lyon, France.</p>$$
),
(
  'politique-cookies',
  'Politique cookies',
  $$<h1>Politique cookies</h1>
<p>Derniere mise ? jour : 14 fevrier 2026</p>
<h2>Qu'est-ce qu'un cookie ?</h2>
<p>Un cookie est un petit fichier texte d?pose sur votre appareil lors de la visite d'un site web.</p>
<h2>Types de cookies utilises</h2>
<ul>
  <li><strong>Essentiels :</strong> fonctionnement, s?curit?, session</li>
  <li><strong>Fonctionnels :</strong> preferences utilisateur</li>
  <li><strong>Analytiques :</strong> statistiques de frequentation</li>
  <li><strong>Marketing :</strong> personnalisation publicitaire</li>
</ul>
<h2>Finalites</h2>
<p>Assurer le bon fonctionnement du site, s?curiser les transactions et ameliorer l'experience utilisateur.</p>
<h2>Gestion des cookies</h2>
<p>Vous pouvez configurer vos preferences vi? la banniere cookies et les param?tres de votre navigateur.</p>
<h2>Duree de conservation</h2>
<ul>
  <li>Session : fermeture du navigateur</li>
  <li>Fonctionnels : 12 mois</li>
  <li>Analytiques : 13 mois</li>
  <li>Marketing : 13 mois</li>
</ul>$$
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  updated_at = NOW();

-- Alias de compatibilite (anciens/nouveaux slugs)
INSERT INTO public.legal_pages (slug, title, content)
SELECT
  'confidentialite',
  title,
  content
FROM public.legal_pages
WHERE slug = 'politique-confidentialite'
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  updated_at = NOW();

INSERT INTO public.legal_pages (slug, title, content)
SELECT
  'cookies',
  title,
  content
FROM public.legal_pages
WHERE slug = 'politique-cookies'
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  updated_at = NOW();

INSERT INTO public.legal_pages (slug, title, content)
SELECT
  'politique-temoins-connexion',
  title,
  content
FROM public.legal_pages
WHERE slug = 'politique-cookies'
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  updated_at = NOW();

SELECT COUNT(*) AS legal_pages_count FROM public.legal_pages;

