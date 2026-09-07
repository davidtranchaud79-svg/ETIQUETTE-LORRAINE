# Synchronisation iPhone + Android — Étiquette Lorraine

Le fonctionnement hors ligne ne dépend pas de Google. La synchronisation est optionnelle : chaque iPhone ou téléphone Android continue de fonctionner localement sans réseau, puis échange les changements lorsque la connexion revient.

## Mise en place
1. Créer ou ouvrir un Google Sheet réservé à Étiquette Lorraine.
2. Ouvrir **Extensions > Apps Script**.
3. Coller le contenu de `apps-script-sync.gs`.
4. Dans l’éditeur Apps Script, exécuter une fois `setupSync('une-cle-secrete-longue')` en remplaçant la clé par une vraie clé d’au moins 8 caractères.
5. Déployer le script en **Application web** et récupérer l’URL finissant par `/exec`.
6. Sur chaque appareil : Étiquette Lorraine > **Réglages > Synchronisation iPhone + Android**.
7. Saisir la même URL `/exec`, la même clé secrète et un nom différent pour chaque appareil, par exemple `Cuisine - iPhone 1` et `Cuisine - Android 1`.
8. Activer la synchronisation.

## Fonctionnement
- Chaque appareil conserve sa base locale dans IndexedDB.
- Une modification fonctionne immédiatement même sans Internet.
- Au retour du réseau, l’application tente la synchronisation automatiquement.
- Les produits sont fusionnés par identifiant et date de modification.
- Les suppressions sont conservées comme marqueurs afin de se propager aux autres appareils.
- Le format d’étiquette partagé et la durée de congélation peuvent également être synchronisés.
- Le Google Sheet conserve un onglet `SYNC_DEVICES` permettant de voir les appareils qui se sont synchronisés.

## Important
Le Google Sheet sert de point de synchronisation, mais il n’est pas nécessaire pour créer ou imprimer une étiquette. En cas de panne Internet, les appareils continuent de fonctionner localement.
