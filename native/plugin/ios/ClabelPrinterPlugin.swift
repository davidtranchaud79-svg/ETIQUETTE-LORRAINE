import Foundation
import Capacitor
import CoreBluetooth

@objc(ClabelPrinterPlugin)
public class ClabelPrinterPlugin: CAPPlugin, CAPBridgedPlugin, CBCentralManagerDelegate, CBPeripheralDelegate {
    public let identifier = "ClabelPrinterPlugin"
    public let jsName = "ClabelPrinter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "listPrinters", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "write", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "diagnostics", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise)
    ]

    private var central: CBCentralManager!
    private var discovered: [UUID: CBPeripheral] = [:]
    private var discoveredNames: [UUID: String] = [:]
    private var discoveredRSSI: [UUID: Int] = [:]

    private var listCall: CAPPluginCall?
    private var connectCall: CAPPluginCall?
    private var writeCall: CAPPluginCall?

    private var connected: CBPeripheral?
    private var writeCharacteristic: CBCharacteristic?
    private var pendingChunks: [Data] = []
    private var currentChunkIndex = 0
    private var writeType: CBCharacteristicWriteType = .withResponse
    private var discoveryTimeout: DispatchWorkItem?

    public override func load() {
        central = CBCentralManager(delegate: self, queue: nil)
    }

    @objc func listPrinters(_ call: CAPPluginCall) {
        guard central.state == .poweredOn else {
            call.reject("Bluetooth non disponible ou non autorisé sur cet iPhone")
            return
        }

        discovered.removeAll()
        discoveredNames.removeAll()
        discoveredRSSI.removeAll()
        listCall = call

        central.scanForPeripherals(
            withServices: nil,
            options: [CBCentralManagerScanOptionAllowDuplicatesKey: false]
        )

        DispatchQueue.main.asyncAfter(deadline: .now() + 4.0) { [weak self] in
            self?.finishScan()
        }
    }

    private func finishScan() {
        central.stopScan()
        guard let call = listCall else { return }

        let all = discovered.values.map { p -> [String:Any] in
            let id = p.identifier
            let name = discoveredNames[id] ?? p.name ?? "Bluetooth"
            return [
                "id": id.uuidString,
                "address": id.uuidString,
                "name": name,
                "transport": "ble",
                "rssi": discoveredRSSI[id] ?? -127,
                "likelyClabel": isLikelyClabel(name)
            ]
        }
        .sorted {
            let a = ($0["likelyClabel"] as? Bool ?? false)
            let b = ($1["likelyClabel"] as? Bool ?? false)
            if a != b { return a && !b }
            return ($0["rssi"] as? Int ?? -127) > ($1["rssi"] as? Int ?? -127)
        }

        call.resolve(["devices": all])
        listCall = nil
    }

    private func isLikelyClabel(_ name: String) -> Bool {
        let n = name.uppercased()
        return n.contains("CLABEL") || n.contains("CT3") || n.contains("CT2") || n.contains("CT4") || n.hasPrefix("CT")
    }

    @objc func connect(_ call: CAPPluginCall) {
        guard central.state == .poweredOn else {
            call.reject("Bluetooth non disponible")
            return
        }
        guard let id = call.getString("address"), let uuid = UUID(uuidString: id) else {
            call.reject("Identifiant Bluetooth invalide")
            return
        }

        var peripheral = discovered[uuid]
        if peripheral == nil {
            peripheral = central.retrievePeripherals(withIdentifiers: [uuid]).first
        }
        guard let p = peripheral else {
            call.reject("Imprimante introuvable. Relance Recherche.")
            return
        }

        disconnectCurrent()
        connectCall = call
        connected = p
        p.delegate = self
        central.connect(p, options: nil)

        let timeout = DispatchWorkItem { [weak self] in
            guard let self = self, self.connectCall != nil else { return }
            self.connectCall?.reject("Connexion établie mais aucune caractéristique d'écriture compatible n'a été trouvée")
            self.connectCall = nil
        }
        discoveryTimeout = timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + 8.0, execute: timeout)
    }

    @objc func write(_ call: CAPPluginCall) {
        guard let p = connected,
              p.state == .connected,
              let ch = writeCharacteristic,
              let text = call.getString("base64"),
              let data = Data(base64Encoded: text) else {
            call.reject("Imprimante non connectée ou données invalides")
            return
        }

        if writeCall != nil {
            call.reject("Une impression est déjà en cours")
            return
        }

        writeCall = call
        writeType = ch.properties.contains(.writeWithoutResponse) ? .withoutResponse : .withResponse

        let maxLen = max(20, p.maximumWriteValueLength(for: writeType))
        pendingChunks = stride(from: 0, to: data.count, by: maxLen).map {
            data.subdata(in: $0..<min($0 + maxLen, data.count))
        }
        currentChunkIndex = 0
        sendNextChunk()
    }

    private func sendNextChunk() {
        guard let p = connected, let ch = writeCharacteristic else {
            writeCall?.reject("Connexion Bluetooth perdue")
            writeCall = nil
            pendingChunks.removeAll()
            return
        }

        guard currentChunkIndex < pendingChunks.count else {
            writeCall?.resolve([
                "ok": true,
                "chunks": pendingChunks.count,
                "characteristic": ch.uuid.uuidString,
                "service": ch.service?.uuid.uuidString ?? ""
            ])
            writeCall = nil
            pendingChunks.removeAll()
            return
        }

        let chunk = pendingChunks[currentChunkIndex]
        currentChunkIndex += 1
        p.writeValue(chunk, for: ch, type: writeType)

        if writeType == .withoutResponse {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.012) { [weak self] in
                self?.sendNextChunk()
            }
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        call.resolve([
            "connected": connected?.state == .connected && writeCharacteristic != nil,
            "address": connected?.identifier.uuidString ?? "",
            "name": connected.flatMap { discoveredNames[$0.identifier] ?? $0.name } ?? "",
            "transport": "ble",
            "service": writeCharacteristic?.service?.uuid.uuidString ?? "",
            "characteristic": writeCharacteristic?.uuid.uuidString ?? ""
        ])
    }

    @objc func diagnostics(_ call: CAPPluginCall) {
        guard let p = connected else {
            call.resolve(["connected": false, "devicesSeen": discovered.count])
            return
        }

        var services: [[String:Any]] = []
        for service in p.services ?? [] {
            var chars: [[String:Any]] = []
            for ch in service.characteristics ?? [] {
                chars.append([
                    "uuid": ch.uuid.uuidString,
                    "write": ch.properties.contains(.write),
                    "writeWithoutResponse": ch.properties.contains(.writeWithoutResponse),
                    "notify": ch.properties.contains(.notify),
                    "read": ch.properties.contains(.read)
                ])
            }
            services.append([
                "uuid": service.uuid.uuidString,
                "characteristics": chars
            ])
        }

        call.resolve([
            "connected": p.state == .connected,
            "name": discoveredNames[p.identifier] ?? p.name ?? "Bluetooth",
            "address": p.identifier.uuidString,
            "selectedService": writeCharacteristic?.service?.uuid.uuidString ?? "",
            "selectedCharacteristic": writeCharacteristic?.uuid.uuidString ?? "",
            "services": services
        ])
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        disconnectCurrent()
        call.resolve(["ok": true])
    }

    private func disconnectCurrent() {
        discoveryTimeout?.cancel()
        discoveryTimeout = nil
        if let p = connected, p.state != .disconnected {
            central.cancelPeripheralConnection(p)
        }
        connected = nil
        writeCharacteristic = nil
        connectCall = nil
        writeCall = nil
        pendingChunks.removeAll()
    }

    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state != .poweredOn {
            listCall?.reject("Active le Bluetooth sur l'iPhone")
            listCall = nil
            connectCall?.reject("Bluetooth indisponible")
            connectCall = nil
        }
    }

    public func centralManager(
        _ central: CBCentralManager,
        didDiscover peripheral: CBPeripheral,
        advertisementData: [String : Any],
        rssi RSSI: NSNumber
    ) {
        discovered[peripheral.identifier] = peripheral
        discoveredRSSI[peripheral.identifier] = RSSI.intValue
        if let localName = advertisementData[CBAdvertisementDataLocalNameKey] as? String, !localName.isEmpty {
            discoveredNames[peripheral.identifier] = localName
        } else if let name = peripheral.name, !name.isEmpty {
            discoveredNames[peripheral.identifier] = name
        }
    }

    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        peripheral.delegate = self
        peripheral.discoverServices(nil)
    }

    public func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        if connected?.identifier == peripheral.identifier {
            writeCharacteristic = nil
        }
    }

    public func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        discoveryTimeout?.cancel()
        discoveryTimeout = nil
        connectCall?.reject("Connexion BLE impossible : " + (error?.localizedDescription ?? "erreur inconnue"))
        connectCall = nil
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        if let error = error {
            discoveryTimeout?.cancel()
            connectCall?.reject("Découverte des services impossible : " + error.localizedDescription)
            connectCall = nil
            return
        }
        peripheral.services?.forEach { peripheral.discoverCharacteristics(nil, for: $0) }
    }

    private func characteristicScore(_ ch: CBCharacteristic) -> Int {
        guard ch.properties.contains(.write) || ch.properties.contains(.writeWithoutResponse) else { return -1 }
        let u = ch.uuid.uuidString.uppercased()
        let preferred = ["FF02", "FFE1", "FFF2", "AE01", "49535343-1E4D-4BD9-BA61-23C647249616"]
        if let idx = preferred.firstIndex(of: u) { return 100 - idx }
        if ch.properties.contains(.writeWithoutResponse) { return 50 }
        return 40
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard error == nil else { return }

        for ch in service.characteristics ?? [] {
            if characteristicScore(ch) > characteristicScore(writeCharacteristic ?? ch) || writeCharacteristic == nil {
                if characteristicScore(ch) >= 0 {
                    writeCharacteristic = ch
                }
            }
        }

        if let ch = writeCharacteristic, let call = connectCall {
            discoveryTimeout?.cancel()
            discoveryTimeout = nil
            call.resolve([
                "ok": true,
                "address": peripheral.identifier.uuidString,
                "name": discoveredNames[peripheral.identifier] ?? peripheral.name ?? "CLABEL",
                "transport": "ble",
                "service": ch.service?.uuid.uuidString ?? "",
                "characteristic": ch.uuid.uuidString
            ])
            connectCall = nil
        }
    }

    public func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        if let error = error {
            writeCall?.reject("Échec d'écriture BLE : " + error.localizedDescription)
            writeCall = nil
            pendingChunks.removeAll()
            return
        }
        if writeType == .withResponse {
            sendNextChunk()
        }
    }
}
