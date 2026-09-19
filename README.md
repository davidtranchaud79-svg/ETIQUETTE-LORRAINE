# Étiquette Lorraine — V5 Offline-first + impression directe CLABEL

Application mobile/PWA pour créer des étiquettes de traçabilité en cuisine, générer des PDF aux dimensions exactes et les ouvrir dans **CLABEL / Clabel**, **Clabel trade**, **Print Master** ou une autre application compatible PDF.

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

Formats rapides : 40×30, 50×30, 50×40, **60×30**, 60×40 mm. Un mode personnalisé accepte une largeur et une hauteur de 20 à 100 mm. Le PDF est généré avec une MediaBox correspondant réellement aux dimensions choisies.

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

## Impression directe CLABEL — V5

La V5 ajoute une couche native optionnelle basée sur Capacitor. Le fonctionnement visé est : **Produit → Imprimer directement en Bluetooth → étiquette**.

- **Android natif** : connexion Bluetooth classique RFCOMM/SPP aux imprimantes CLABEL déjà jumelées.
- **iPhone/iPad natif** : tentative de connexion BLE GATT via CoreBluetooth quand le modèle expose une caractéristique d'écriture compatible.
- Génération locale d'un bitmap noir/blanc à **203 dpi** puis envoi dans une commande **TSPL BITMAP**.
- Le PDF reste toujours disponible comme solution de secours.
- Le module PWA classique n'essaie pas de contourner les restrictions Bluetooth du navigateur.

Le dossier **native/** contient le projet Capacitor 8.5.2 et les bridges Android/iOS. Voir **NATIVE_DIRECT_PRINT.md** pour la construction et le premier test.

## Impression CLABEL par PDF

Un profil imprimante est disponible dans **Réglages > Imprimante / application** :
- **CLABEL** (application Clabel) ;
- **CLABEL CT321D** (Clabel trade) ;
- **CLABEL CT327D** (Clabel) ;
- Phomemo / Print Master ;
- PDF générique.

Pour les rouleaux 60 × 30 mm, utiliser le raccourci **Passer en 60 × 30 mm**. Le PDF conserve exactement cette MediaBox.

Les applications **Clabel** et **Clabel trade** disposent d'un flux d'impression PDF. Selon iOS/Android et la version installée, l'application peut apparaître dans la feuille de partage ; sinon, enregistrer le PDF puis l'importer dans l'application CLABEL.

## Impression Print Master
1. Préparer l’étiquette.
2. Toucher **Envoyer vers Print Master**.
3. Sur Android, choisir **Print Master** directement dans le partage si l’application apparaît ; sinon enregistrer le PDF puis l’ouvrir dans Print Master.
4. Sur iPhone, utiliser **Enregistrer dans…** puis la destination Print Master lorsque nécessaire.
5. Dans Print Master, ouvrir **Impression PDF**.
6. Choisir le même format physique que celui défini dans Étiquette Lorraine et imprimer à l’échelle adaptée.

## Important PMS / HACCP
Les durées de conservation doivent être validées par le PMS/HACCP de l’établissement. L’application applique les règles configurées ; elle ne définit pas elle-même une durée sanitaire universelle.
