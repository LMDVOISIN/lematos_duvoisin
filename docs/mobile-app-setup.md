## Application mobile

Le projet est maintenant prepare pour Capacitor avec les plateformes:

- `android/`
- `ios/`

### Scripts utiles

- `npm run build:mobile`
- `npm run mobile:sync`
- `npm run mobile:android`
- `npm run mobile:android:open`
- `npm run mobile:ios`

### Ce qui a ete adapte

- build web dedie mobile dans `build-mobile/`
- partage natif via Capacitor
- geolocalisation native via Capacitor
- camera native via Capacitor
- ouverture des parcours externes dans le navigateur systeme
- ecoute des deep links pour revenir dans l application

### Variables web utiles

- `VITE_SITE_URL=https://www.lematosduvoisin.fr`
- `VITE_APP_URL=https://www.lematosduvoisin.fr`

### Variable mobile importante

- `VITE_MOBILE_CALLBACK_URL=lematosduvoisin://app`

Sans `VITE_MOBILE_CALLBACK_URL`, les parcours OAuth et Stripe retombent sur l URL web classique.

### Configuration externe a prevoir

Pour que OAuth et Stripe reviennent directement dans l application, il faut autoriser les URLs de retour cote services externes:

- Supabase Auth redirect URLs:
  - `lematosduvoisin://app/auth/retour`
  - `https://www.lematosduvoisin.fr/auth/retour`
- Stripe checkout / onboarding:
  - utiliser la meme base de callback mobile si tu veux revenir dans l app

### Windows / Android

Le poste dispose deja de:

- Android Studio
- Android SDK
- emulateur Android

Variables d environnement recommandees:

- `JAVA_HOME=C:\Program Files\Android\Android Studio\jbr`
- `ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk`
- `ANDROID_SDK_ROOT=%LOCALAPPDATA%\Android\Sdk`

### iOS

Le dossier `ios/` est genere, mais la compilation, la signature et la publication doivent se faire avec Xcode sur macOS.

### Maintenir iOS a jour depuis Windows

Tu peux tout de meme garder la cible iOS a jour depuis ce PC:

- lance `npm run mobile:ios` apres chaque modification du front ou des plugins mobiles
- cela rebuild `build-mobile/` puis resynchronise `ios/`
- le point d entree Xcode a ouvrir plus tard sur Mac est `ios/App/App.xcodeproj`

Le projet iOS est deja prepare avec:

- callback mobile `lematosduvoisin://app`
- schema d URL iOS `lematosduvoisin`
- permissions camera / geolocalisation / phototheque

Quand un Mac sera disponible, la personne pourra ouvrir directement le projet Xcode et compiler sans repartir de zero.
