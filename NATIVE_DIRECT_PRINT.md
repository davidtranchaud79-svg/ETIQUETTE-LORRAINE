# Étiquette Lorraine V5 — impression directe CLABEL

Objectif : obtenir le parcours Produit → Imprimer → étiquette, sans ouvrir Clabel à chaque impression.

## Ce qui est déjà codé

- Génération raster 203 dpi de l'étiquette dans direct-print-v5.js.
- Encapsulation du bitmap dans une commande TSPL BITMAP.
- Bridge Capacitor nommé ClabelPrinter.
- Android : connexion Bluetooth classique RFCOMM/SPP aux imprimantes déjà jumelées.
- iOS : connexion BLE GATT lorsque l'imprimante expose un service/caractéristique d'écriture accessible à CoreBluetooth.
- PDF conservé comme secours.
- Formats dynamiques, dont 60 x 30 mm.

## Android

Avant le premier test :
1. Jumeler l'imprimante dans Réglages Android > Bluetooth. Si demandé, essayer 0000 ou 1234.
2. Ouvrir Étiquette Lorraine native.
3. Réglages > Impression directe Bluetooth > Rechercher.
4. Choisir CT321D / CT327D puis Connecter.
5. Revenir à Étiquettes et utiliser Imprimer directement en Bluetooth.

Permissions Android à conserver dans AndroidManifest.xml :
- android.permission.BLUETOOTH
- android.permission.BLUETOOTH_ADMIN
- android.permission.BLUETOOTH_CONNECT
- android.permission.BLUETOOTH_SCAN
- android.permission.ACCESS_FINE_LOCATION avec maxSdkVersion 30 pour les anciens Android si la découverte l'exige.

## iPhone / iPad — priorité V5.1

La version iOS est maintenant prioritaire.

Le module iPhone :
1. scanne les périphériques Bluetooth visibles pendant 4 secondes ;
2. affiche les périphériques CLABEL probables en premier ;
3. se connecte à l'imprimante choisie ;
4. inspecte automatiquement ses services et caractéristiques GATT ;
5. sélectionne une caractéristique d'écriture, avec priorité aux UUID d'impression courants ;
6. permet un **Test 60 x 30** avant l'utilisation réelle ;
7. propose un bouton **Diagnostic** qui affiche les UUID découverts afin d'adapter précisément le protocole au modèle réel si nécessaire ;
8. conserve le PDF comme secours.

Ajouter dans Info.plist les clés fournies dans `native/plugin/ios/Info.plist.additions.xml`.

Premier test iPhone :
1. Allumer la CLABEL et la placer près de l'iPhone.
2. Ouvrir la version native d'Étiquette Lorraine.
3. Autoriser Bluetooth lors de la première demande.
4. Réglages > Impression directe Bluetooth > **Rechercher**.
5. Choisir la CLABEL détectée puis **Connecter**.
6. Appuyer sur **Test 60 × 30**.
7. Si rien ne sort, appuyer sur **Diagnostic** et conserver le résultat : il indique le service et la caractéristique Bluetooth réellement exposés par l'imprimante.

## Préparer le projet natif sur Mac

Depuis le dossier native :
1. npm install
2. npm run prepare
3. npx cap add ios
4. Copier `native/plugin/ios/ClabelPrinterPlugin.swift` dans la cible iOS App.
5. Ajouter les clés de `native/plugin/ios/Info.plist.additions.xml` dans `ios/App/App/Info.plist`.
6. npm run sync
7. npm run ios:open
8. Dans Xcode, sélectionner l'iPhone réel comme destination, signer avec son compte Apple, puis lancer l'application.

Android reste disponible ensuite avec `npx cap add android` si nécessaire.

Le projet utilise Capacitor 8.5.2.

## Important

Le protocole exact n'a pas encore été validé physiquement sur l'imprimante de production. Le code envoie un flux TSPL standard avec BITMAP. Le premier essai doit se faire avec une seule étiquette de test, idéalement 60 x 30 mm, avant utilisation en service.
