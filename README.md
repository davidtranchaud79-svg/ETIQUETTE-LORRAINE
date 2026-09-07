# Étiquette Lorraine — V4 Offline-first

Application mobile/PWA pour créer des étiquettes de traçabilité en cuisine, générer des PDF aux dimensions exactes et les ouvrir dans **Print Master**.

## Compatibilité
- **iPhone / iPad** via Safari et installation sur l’écran d’accueil.
- **Android** via Chrome et installation PWA.
- Même logique hors ligne sur les deux plateformes.
- Synchronisation optionnelle entre iPhone et Android via Google Sheet + Apps Script.

## Modes d’étiquette
- Production
- Ouverture
- Décongélation
- Congélation (3 mois par défaut, durée réglable selon PMS)
- Sous vide (durée définie par produit)
- Allergènes

## Formats
Format par défaut : **40 × 30 mm**.

Formats rapides : 40×30, 50×30, 50×40, 60×40 mm. Un mode personnalisé accepte une largeur et une hauteur de 20 à 100 mm. Le PDF est généré avec une MediaBox correspondant réellement aux dimensions choisies.

## Fonctionnement hors ligne
La V4 est conçue en **offline-first** : interface, générateur PDF et modules principaux sont préchargés par le service worker. Les produits, réglages et historiques sont conservés dans **IndexedDB**, avec migration automatique de l’ancienne base localStorage.

Dans **Réglages > Diagnostic hors ligne**, l’application contrôle :
- IndexedDB ;
- générateur PDF ;
- cache des fichiers essentiels ;
- base produits ;
- format actuel ;
- état réseau.

## Données et sécurité
- Base produits locale dans IndexedDB.
- Copie de compatibilité des données essentielles dans localStorage.
- Sauvegardes internes automatiques (12 versions locales).
- Export / restauration JSON complet.
- Historique des PDF et export CSV.
- Journal local des modifications PMS.
- Code administrateur.
- Mode service pouvant bloquer les changements PMS sans code.

## Mises à jour
Une nouvelle version peut être téléchargée en arrière-plan. L’application affiche **Nouvelle version disponible** puis permet de l’appliquer sans effacer la base produits.

## Synchronisation iPhone + Android (optionnelle)
Le dépôt contient `apps-script-sync.gs` et `SYNC_APPS_SCRIPT.md` pour connecter plusieurs appareils à un Google Sheet via Apps Script. Chaque appareil reste autonome hors ligne et synchronise ses changements lorsque le réseau revient.

La synchronisation fusionne les produits par identifiant et date de modification, propage les suppressions et peut partager le format d’étiquette ainsi que la durée de congélation.

## Installation Android
1. Ouvrir Étiquette Lorraine dans **Chrome**.
2. Utiliser **Installer l’application** ou **Ajouter à l’écran d’accueil**.
3. Ouvrir l’application une première fois avec Internet.
4. Lancer **Réglages > Diagnostic hors ligne**.
5. Une fois le cache prêt, l’application peut fonctionner sans réseau.

## Impression Print Master
1. Préparer l’étiquette.
2. Toucher **Envoyer vers Print Master**.
3. Sur Android, choisir **Print Master** directement dans le partage si l’application apparaît ; sinon enregistrer le PDF puis l’ouvrir dans Print Master.
4. Sur iPhone, utiliser **Enregistrer dans…** puis la destination Print Master lorsque nécessaire.
5. Dans Print Master, ouvrir **Impression PDF**.
6. Choisir le même format physique que celui défini dans Étiquette Lorraine et imprimer à l’échelle adaptée.

## Important PMS / HACCP
Les durées de conservation doivent être validées par le PMS/HACCP de l’établissement. L’application applique les règles configurées ; elle ne définit pas elle-même une durée sanitaire universelle.
