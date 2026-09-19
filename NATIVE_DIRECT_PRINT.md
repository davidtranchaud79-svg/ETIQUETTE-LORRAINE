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

## iPhone / iPad

La partie iOS utilise CoreBluetooth BLE. Elle fonctionne seulement si le modèle CLABEL expose une interface BLE GATT accessible. Si la CT concernée n'expose que Bluetooth classique SPP, iOS ne permet pas à une application ordinaire d'utiliser SPP comme Android. Dans ce cas, le PDF/Clabel reste la solution de secours tant que le protocole iOS exact du modèle n'est pas identifié.

Ajouter dans Info.plist :
- NSBluetoothAlwaysUsageDescription : Étiquette Lorraine utilise le Bluetooth pour imprimer directement les étiquettes.

## Préparer le projet natif sur Mac

Depuis le dossier native :
1. npm install
2. npm run prepare
3. npx cap add android
4. npx cap add ios
5. Copier ClabelPrinterPlugin.kt dans le package Android de l'application et utiliser le MainActivity fourni.
6. Copier ClabelPrinterPlugin.swift dans la cible iOS.
7. npm run sync
8. Ouvrir Android Studio avec npm run android:open ou Xcode avec npm run ios:open.

Le projet utilise Capacitor 8.5.2.

## Important

Le protocole exact n'a pas encore été validé physiquement sur l'imprimante de production. Le code envoie un flux TSPL standard avec BITMAP. Le premier essai doit se faire avec une seule étiquette de test, idéalement 60 x 30 mm, avant utilisation en service.
