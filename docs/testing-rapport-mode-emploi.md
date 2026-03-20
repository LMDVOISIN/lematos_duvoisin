# Rapport du projet testing

## Decision retenue

Le protocole conserve la logique miroir, mais il ne fonctionne plus sur 3 tests.

La base de decision retenue est maintenant la suivante :

- chaque testeur doit faire 4 tests obligatoires
- ces 4 tests se font dans un ordre stable
- la logique miroir reste active a l interieur de chaque famille
- `Moderation Admin` sort du tronc principal
- le doublon `Creation d'annonce` / `Creation d'Annonce` est conserve pour avoir deux retours minimum
- la famille `Incidents transverses` absorbe les cas photo, litige et arbitrage

Ordre de passage retenu :

1. parcours abouti
2. echec cote locataire
3. echec cote proprietaire
4. incidents transverses

## Logique miroir

Dans chaque famille, on conserve le meme mecanisme :

- le premier participant libre choisit un parcours de reference
- le participant suivant recoit automatiquement le parcours miroir correspondant
- puis le cycle recommence avec un autre binome libre dans cette meme famille

La logique miroir ne se comprend donc plus comme un seul grand stock de parcours.
Elle s applique separement dans chacune des 4 familles.

## Familles de test

### 1. Parcours abouti

Cette famille couvre les usages qui doivent aller au bout sans incident majeur.

- Parcours de reservation
- Inscription et Reservation
- Transaction aboutie complete
- Creation d'annonce
- Creation d'Annonce
- Communication entre utilisateurs

### 2. Echec cote locataire

Cette famille couvre les parcours qui cassent du point de vue du locataire.

- Annulation par le locataire
- Panne pendant la location
- Refus de restitution par le locataire
- RDV de prise : locataire en retard
- RDV de prise : locataire ne se presente pas
- Pendant la location : objet endommage
- Pendant la location : objet perdu ou vole
- Pendant la location : usage non conforme signale
- Restitution : en retard

### 3. Echec cote proprietaire

Cette famille couvre les parcours qui cassent du point de vue du proprietaire.

- Annulation par le proprietaire
- Refus de l objet au RDV
- Restitution partielle
- RDV de prise : proprietaire en retard
- RDV de prise : proprietaire ne se presente pas
- RDV de prise : lieu / acces impossible
- Restitution : demande de prolongation refusee
- Restitution : restitution anticipee refusee

### 4. Incidents transverses

Cette famille couvre les blocages qui relevent surtout des preuves, du systeme, du traitement
ou de l arbitrage.

Pour la prise de decision, on la lit comme 4 blocs :

- Incident photo bloquant
- Litige : desaccord sur l etat a la restitution
- Litige : desaccord sur frais additionnels
- Blocage de resolution / arbitrage

Dans le catalogue source actuel, cela recouvre concretement :

- toute la grappe `Photos ...`
- `Litige : desaccord sur l etat a la restitution`
- `Litige : desaccord sur frais additionnels`
- `Remboursement : rejete ou partiel`
- `Support : escalade obligatoire`

## Hors tronc principal

Le scenario suivant reste utile, mais il ne fait pas partie du protocole automatique principal :

- Moderation Admin

## Ce que l outil doit faire

Pour respecter cette decision, l outil doit pouvoir :

- suivre les 4 familles deja validees par chaque testeur
- determiner la famille encore manquante
- proposer seulement les references encore libres de cette famille
- attribuer automatiquement le miroir au participant suivant
- afficher clairement la progression sur 4 tests

Autrement dit, la logique produit devient :

- 4 tests obligatoires par testeur
- 4 familles de test
- 1 logique miroir maintenue dans chaque famille

## Regles d exploitation

Pour exploiter correctement le dispositif, l equipe doit garder les regles suivantes :

- preparer les parcours par binomes reference / miroir
- classer chaque parcours dans la bonne famille
- laisser l application imposer l ordre des 4 familles
- ne pas remettre `Moderation Admin` dans le tronc principal
- conserver le doublon de creation d annonce pour obtenir deux retours distincts

## Etat cible du protocole

Le protocole cible est donc :

- un testeur entre dans le dispositif
- l application verifie quelle famille lui manque
- si un miroir est en attente dans cette famille, il lui est attribue
- sinon le testeur choisit une reference encore libre dans cette famille
- une fois le test termine, la progression passe a la famille suivante

La decision de travail retenue pour la suite est donc bien :

- `Parcours abouti`
- `Echec cote locataire`
- `Echec cote proprietaire`
- `Incidents transverses`

avec `Moderation Admin` hors tronc principal.
