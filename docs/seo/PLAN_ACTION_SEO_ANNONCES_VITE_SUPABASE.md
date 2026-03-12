# Plan D'action SEO Annonces (Adapte Au Projet)

Base de travail:
- `FICHIER_1_Optimisation_Pages_Annonces.md` (version generique SSR)
- `audit-seo.pdf` (audit global du site, 18 pages)
- Etat actuel du repo React + Vite + Supabase

Date de synthese: 2026-02-25

---

## 1. Resume Executif

Le document "FICHIER 1" est bon sur la direction (pages annonces SEO-friendly, meta tags dynamiques, JSON-LD, canonical, breadcrumb, contenu indexable).

En revanche, il doit etre adapte au stack reel du projet:
- Le projet est un SPA React/Vite (pas Next.js / Nuxt / Angular Universal)
- Une partie SEO est deja en place sur la page annonce detail
- Les plus gros manques identifies par le PDF sont surtout:
  - absence de sitemap XML
  - page d'accueil trop generique (title/meta/schema)
  - poids de page eleve (images)
  - rendu tres dynamique (HTML source peu riche)

Conclusion:
- Il ne faut pas jeter le FICHIER 1
- Il faut le convertir en roadmap progressive "prerender/SSR + hygiene SEO + performance"

---

## 2. Ce Que Le PDF Dit (Et Ce Que Ca Veut Dire Vraiment)

Le PDF audite principalement la page d'accueil / page root (pas une page annonce detail specifique).

Constats utiles du PDF:
- Note globale faible (`D`) et SEO (`C`), performance faible
- `title` trop court ("Le Matos Du Voisin", 17 caracteres)
- `meta description` trop courte (69 caracteres)
- balise canonique absente (sur la page auditee)
- sitemap XML non detecte
- schema.org non detecte (sur la page auditee)
- contenu "rendu" tres eleve (HTML modifie massivement par JS)
- mobile PageSpeed ~54
- poids de page ~8.45 MB, dont ~7.5 MB d'images
- opportunites Lighthouse: unused JS/CSS, minify JS, multiple redirects
- pas de profil social detecte / X cards / pixel (priorite faible business-dependent)
- SPF manquant (utile pour delivrabilite email, mais hors "page annonces")

Lecture pragmatique:
- Le PDF est utile pour prioriser les quick wins globaux
- Il contient aussi du bruit "audit generique" (social links/pixel/AMP/keywords meta)
- Il ne remplace pas un plan SEO de pages annonces par URL detail

---

## 3. Etat Reel Du Repo (Important)

Le repo contient deja des elements SEO sur la page detail annonce:
- `src/pages/equipment-detail/index.jsx`
  - `react-helmet`
  - `title` dynamique
  - `meta description`
  - `canonical`
  - Open Graph
  - Twitter tags
  - JSON-LD `Product`
  - JSON-LD `BreadcrumbList`

Donc le probleme n'est pas "aucun SEO sur les annonces".
Le probleme principal est:
- le rendu reste SPA (HTML source initial pauvre)
- les crawlers/LLM/partage peuvent manquer du contenu si JS non execute ou execute tardivement
- les pages systeme (home/sitemap) restent sous-optimisees

Autres constats techniques observes dans le projet:
- pas de `public/sitemap.xml`
- `public/robots.txt` existe mais sans directive `Sitemap:`
- analytics GA present via `src/components/cookies/CookieAwareAnalytics.jsx` (peut etre non detecte par audit si consentement/ID absent)
- gros bundle JS construit (chunk principal > 3 MB minifie)
- erreurs schema DB sur certaines requetes (ex: colonnes `status/category` au lieu de `statut/categorie`) pouvant impacter UX/crawl

---

## 4. Ce Qu'il Faut Garder / Corriger Dans Le FICHIER 1

### A garder (bonnes pratiques)
- title/meta description dynamiques par annonce
- canonical par URL annonce
- Open Graph / Twitter
- JSON-LD Product + Breadcrumb
- H1 unique
- alt images, dimensions, lazy loading (sauf image hero)
- maillage interne vers annonces similaires

### A corriger / nuancer
- "Google ne voit PAS le contenu" -> formulation trop absolue
  - Mieux: "Google peut executer le JS, mais le rendu JS est moins fiable et plus lent. Un prerender/SSR ameliore nettement l'indexation."
- `meta keywords`
  - Priorite tres faible (quasi inutile pour Google)
- `aggregateRating` / avis
  - Ne pas injecter si les donnees reelles n'existent pas
- `brand`, `priceValidUntil`, `reviewCount`, etc.
  - Champs conditionnels uniquement
- signaux de confiance ("remboursement garanti", etc.)
  - Seulement si legalement et commercialement exact
- image principale en lazy
  - Eviter pour le hero visible immediatement (preferer chargement prioritaire)

---

## 5. Priorites SEO Reelles (Repo + PDF) - Ordre Recommande

## P0 (1 a 3 jours) - Impact fort, faible risque

1. Mettre en place un vrai `sitemap.xml`
- Probleme actuel: `/sitemap.xml` retourne le shell SPA (pas un XML)
- Action:
  - generer un sitemap statique a partir des annonces publiees (`annonces`)
  - servir un vrai XML en prod
  - inclure pages statiques + pages annonces

2. Ajouter la directive `Sitemap:` dans `robots.txt`
- Fichier actuel: `public/robots.txt` minimal
- Action:
  - ajouter `Sitemap: https://www.lematosduvoisin.fr/sitemap.xml`

3. Corriger SEO de la page d'accueil (ce que le PDF pointe)
- Title plus descriptif (50-60)
- Meta description 120-160
- Canonical homepage
- JSON-LD `Organization` / `WebSite`
- Optionnel: `SearchAction` si moteur interne stable

4. Corriger les erreurs runtime / requetes schema sur pages publiques
- Exemple observe: usages de colonnes `status` / `category` sur la table `annonces`
- Impact: UX degradee + risque de pages cassees pour crawl

5. Verifier la chaine de redirections
- Objectif: 1 seule redirection max (http -> https + version canonique)

## P1 (1 a 2 semaines) - Indexation des annonces

6. Ajouter un prerender/SSR pour les pages annonces
- Option pragmatique (sans migration framework complete):
  - prerender des pages annonces publiees (nightly + on publish)
  - injecter HTML SEO + meta tags + JSON-LD dans une page statique par annonce
- Option plus robuste:
  - SSR (framework ou middleware server)

7. Rendre la page annonce "crawl-friendly" meme sans JS (fallback HTML)
- Au minimum:
  - H1
  - description courte
  - prix
  - image principale
  - breadcrumb
  - liens internes

8. Durcir la qualite JSON-LD sur les annonces
- `Product` + `Offer` + `BreadcrumbList`
- champs conditionnels seulement
- pas de faux `AggregateRating`
- valeurs synchronisees avec la DB r?elle (`titre`, `city`, `categorie`, `prix_jour`, etc.)

## P2 (1 a 3 semaines) - Performance (fortement soutenu par le PDF)

9. Reduire le poids image des pages annonces
- Le PDF montre ~7.5 MB d'images sur la page auditee
- Actions:
  - variantes tailles (mobile/tablette/desktop)
  - formats WebP/AVIF
  - image hero optimisee
  - lazy loading des images non visibles
  - compression en upload ou post-upload

10. Reduire le JS charge sur les pages publiques
- route-level code splitting
- extraire chunks lourds non critiques
- charger modules admin uniquement sur routes admin
- traiter "unused JS/CSS" (audit + Lighthouse)

11. Stabiliser le parcours mobile
- cible: LCP mobile en baisse, score PSI mobile > 70 puis > 85

## P3 (hors scope direct "pages annonces", mais utile)

12. Presence marque / social / profiles
- Seulement si comptes reels maintenus
- Ajouter liens footer + `sameAs` dans schema `Organization`

13. SPF/DMARC/DKIM (email deliverability)
- Important pour les emails transactionnels, mais ce n'est pas une priorite "SEO annonces"

---

## 6. Plan D'implementation Adapte A Vite + Supabase (Concret)

### Option recommandee (progressive, sans migration immediate)

Phase A - Hygiene SEO globale (quick wins)
- `public/robots.txt` -> ajouter `Sitemap:`
- creer `public/sitemap.xml` temporaire (statique)
- preparer un script de generation sitemap depuis Supabase
- durcir meta/canonical/schema de la homepage

Phase B - Sitemap dynamique (automatisation)
- script Node (cron/CI) qui interroge Supabase et genere:
  - `public/sitemap.xml` (index ou simple)
  - `public/sitemaps/sitemap-annonces-*.xml`
- filtre: annonces publiques/publiees uniquement
- URLs au format canonique `/location/<slug>/<id>`

Phase C - Prerender pages annonces (SEO leverage)
- generer HTML prerendu pour annonces publiees
- mettre a jour ? la publication/modification annonce
- conserver SPA pour navigation app
- fallback 404/410 propre pour annonces supprimees

Phase D - SSR complet (optionnel)
- migration Next.js / autre solution SSR uniquement si besoin
- a envisager quand:
  - beaucoup d'annonces actives
  - besoins SEO importants par categorie/ville
  - besoin de pages server-first plus large que les annonces

---

## 7. Mapping Recommande (Schema.org <-> Table `annonces`)

Table observee (prod) contient notamment:
- `id`
- `titre`
- `description`
- `categorie`
- `prix_jour`
- `caution`
- `photos`
- `latitude`
- `longitude`
- `address`
- `city`
- `postal_code`
- `slug`
- `published`
- `statut`
- `moderation_status`

Mapping recommande:
- `Product.name` <- `titre`
- `Product.description` <- `description` (tronquee si besoin)
- `Product.category` <- `categorie`
- `Product.image` <- `photos[]` resolues en URLs absolues
- `Offer.price` <- `prix_jour`
- `Offer.priceCurrency` <- `EUR`
- `Offer.url` <- URL canonique annonce
- `Offer.availability` <- derive de visibilite/publication
- `availableAtOrFrom.geo` <- `latitude`/`longitude` (si present)
- `areaServed` / `Place.name` <- `city` ou `address` partielle

Important:
- ne pas exposer l'adresse exacte si la confidentialite est voulue
- utiliser une zone approximative en UI n'empeche pas un schema local approximatif ou une ville

---

## 8. Actions Par Fichier (Repo)

### SEO global / indexation
- `public/robots.txt`
  - ajouter la directive sitemap
- `public/sitemap.xml`
  - creer un vrai XML (temporaire)
- `scripts/` (nouveau)
  - script de generation sitemap depuis Supabase

### Homepage (ce que le PDF audite surtout)
- page home publique (route racine / composant associe)
  - title/meta/canonical plus riches
  - schema `Organization` / `WebSite`

### Pages annonces
- `src/pages/equipment-detail/index.jsx`
  - deja bon socle SEO
  - verifier champs conditionnels JSON-LD
  - eviter `AggregateRating` fictif si non reel
- `src/pages/equipment-detail/components/SimilarListings.jsx`
  - corriger requetes utilisant colonnes legacy (`status` vs `statut`, etc.)

### Performance
- composants gallery / images annonces
  - images responsives
  - compression/format
  - priorisation image hero

---

## 9. KPI De Suivi (A Mettre En Place)

Indexation:
- nombre d'URLs annonces soumises vs indexees (Search Console)
- erreurs de couverture / exclusions
- detection sitemap OK

Performance:
- LCP mobile (PSI/Lighthouse)
- poids page annonce median (MB)
- nombre d'images chargees above-the-fold

SEO business:
- impressions/clics sur requetes "location + objet + ville"
- pages annonces recevant trafic organique
- CTR SERP sur pages annonces

Qualite technique:
- taux de pages publiques sans erreur runtime
- taux de pages avec meta/canonical/schema valides

---

## 10. Version Corrigee De La Promesse (a reprendre dans le FICHIER 1)

Formulation recommandee:

"Les pages annonces doivent fournir un HTML indexable et des meta donnees completes sans dependre uniquement du rendu JavaScript. Google peut executer le JS, mais un prerender/SSR ameliore la fiabilite de l'indexation, la vitesse percue et la qualite des apercus de partage."

---

## 11. Proposition De Sequence (Simple)

Semaine 1
- sitemap XML + robots + homepage meta/canonical/schema
- corrections erreurs publiques (requetes `annonces`)

Semaine 2
- generation sitemap automatisee
- durcissement JSON-LD annonces + validation Rich Results

Semaine 3-4
- prerender annonces publiees
- optimisation images et bundle JS routes publiques

---

## 12. Ce Qu'on Peut Ignorer Pour L'instant (Sans Risque Majeur)

- `meta keywords`
- AMP
- pixel Facebook (si pas de campagne paid)
- liens vers tous les reseaux sociaux si non maintenus

---

## 13. Recommandation Finale

Ne pas lancer une migration SSR complete immediatement.

Le meilleur ratio impact/temps pour ce projet est:
1. indexation (sitemap + robots + home SEO)
2. fiabilite pages publiques (pas d'erreurs runtime / requetes cassees)
3. prerender pages annonces
4. optimisation images/JS
5. SSR complet seulement si n?cessaire ensuite

