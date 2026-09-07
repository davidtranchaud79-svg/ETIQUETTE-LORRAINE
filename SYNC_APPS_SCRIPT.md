# Synchronisation multi-iPhone — Étiquette Lorraine

Le fonctionnement hors ligne ne dépend pas de Google. La synchronisation est optionnelle et ne s’active que lorsque l’iPhone retrouve Internet.

## Mise en place
1. Créer ou ouvrir un Google Sheet réservé à Étiquette Lorraine.
2. Ouvrir **Extensions > Apps Script**.
3. Coller le contenu de `apps-script-sync.gs`.
4. Exécuter une fois `setupSync('une-cle-secrete-longue')`.
5. Déployer le script en **Application web** et récupérer l’URL finissant par `/exec`.
6. Dans Étiquette Lorraine > **Réglages > Synchronisation multi-iPhone**, saisir l’URL, la même clé secrète et un nom pour l’appareil.
7. Activer la synchronisation.

Les produits sont fusionnés par identifiant et date de modification. Les suppressions sont conservées sous forme de marqueurs afin qu’elles puissent se propager aux autres appareils. Le format partagé et la durée de congélation sont également synchronisables.
