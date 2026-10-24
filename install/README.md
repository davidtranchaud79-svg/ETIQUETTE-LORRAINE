# Distribution Étiquette Lorraine

Cette page publique est prévue à l'adresse `https://davidtranchaud79-svg.github.io/ETIQUETTE-LORRAINE/install/` **uniquement après activation et vérification de GitHub Pages**.

- La page fonctionne sans liens de distribution actifs : aucun bouton de téléchargement n'est affiché tant que l'URL correspondante est vide.
- Renseigner les trois champs de `install/config.json` après publication de l'APK Android signé, création du lien public TestFlight et validation de la version Web.
- Pour Android : créer une clé de signature de release sécurisée, la sauvegarder hors dépôt, générer un APK signé, tester installation et impression CT321D, puis publier l'APK sur une URL HTTPS stable (ex. asset d'une GitHub Release).
- Pour iPhone : souscrire à Apple Developer Program, créer l'application dans App Store Connect, archiver et envoyer la version depuis Xcode, attendre la validation TestFlight externe, créer un lien public d'invitation, puis le mettre dans config.json.
- Sur GitHub : Settings > Pages > Build and deployment > Deploy from a branch > main > /(root) > Save. Vérifier l'adresse réelle avant de distribuer le QR code.
- La signature iOS gratuite installée depuis Xcode n'est pas adaptée à la distribution aux collaborateurs.
- Les données locales des utilisateurs ne doivent pas être effacées lors des mises à jour. Prévoir export/sauvegarde et vérification du comportement de migration.
- Ne jamais déposer les clés de signature Android, certificats Apple, mots de passe, jetons ou données personnelles dans ce dépôt public.

Un QR code imprimé doit cibler **l'URL stable de la page**, jamais un APK ou une invitation TestFlight qui peut changer.
