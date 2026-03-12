## Handoff iOS

### Etat actuel

Le projet iOS est deja genere et synchronise avec le front actuel:

- projet Xcode: `ios/App/App.xcodeproj`
- web embarque: `ios/App/App/public/`
- config Capacitor iOS: `ios/App/App/capacitor.config.json`
- configuration native iOS: `ios/App/App/Info.plist`

### Ce qui est deja pret

- build web mobile sync avec Capacitor
- plugins Capacitor iOS:
  - `@capacitor/app`
  - `@capacitor/browser`
  - `@capacitor/camera`
  - `@capacitor/geolocation`
  - `@capacitor/share`
- schema d URL iOS: `lematosduvoisin`
- callback mobile attendu: `lematosduvoisin://app/auth/retour`
- permissions iOS declarees:
  - camera
  - geolocalisation
  - phototheque

### Ce qui reste a faire sur Mac

Depuis un Mac avec Xcode:

1. ouvrir `ios/App/App.xcodeproj`
2. verifier le `Bundle Identifier`
3. verifier l equipe de signature Apple
4. lancer sur simulateur iPhone
5. tester:
   - ouverture de l app
   - geolocalisation
   - camera
   - partage
   - retour OAuth Google/Facebook
   - retour Stripe
6. produire l archive iOS
7. exporter l application ou publier via App Store Connect

### Configuration externe a verifier

Pour les retours OAuth, il faut que les services externes autorisent au minimum:

- `lematosduvoisin://app/auth/retour`
- `https://www.lematosduvoisin.fr/auth/retour`

### Maintien depuis Windows

Quand le site change, la commande a relancer ici est:

- `npm run mobile:ios`

Cette commande suffit pour garder le projet iOS synchronise jusqu au prochain passage sur Mac.
