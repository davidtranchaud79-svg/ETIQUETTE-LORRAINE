# Étiquette Lorraine — V4 Offline-first

Application mobile/PWA pour créer des étiquettes de traçabilité en cuisine, générer des PDF aux dimensions exactes et les ouvrir dans **Print Master**.

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

## Synchronisation multi-iPhone (optionnelle)
Le dépôt contient `apps-script-sync.gs` et `SYNC_APPS_SCRIPT.md` pour connecter plusieurs iPhone à un Google Sheet via Apps Script. La synchronisation se fait lorsque le réseau revient ; le fonctionnement local ne dépend pas de Google.

La synchronisation fusionne les produits par identifiant et date de modification, propage les suppressions et peut partager le format d’étiquette et la durée de congélation.

## Impression Print Master
1. Préparer l’étiquette.
2. Toucher **Envoyer vers Print Master**.
3. Sur iPhone, utiliser **Enregistrer dans…** puis la destination Print Master lorsque nécessaire.
4. Dans Print Master, ouvrir **Impression PDF**.
5. Choisir le même format physique que celui défini dans Étiquette Lorraine et imprimer à l’échelle adaptée.

## Important PMS / HACCP
Les durées de conservation doivent être validées par le PMS/HACCP de l’établissement. L’application applique les règles configurées ; elle ne définit pas elle-même une durée sanitaire universelle.
