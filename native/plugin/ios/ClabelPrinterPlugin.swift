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
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise)
    ]

    private var central: CBCentralManager!
    private var discovered: [UUID: CBPeripheral] = [:]
    private var listCall: CAPPluginCall?
    private var connectCall: CAPPluginCall?
    private var writeCall: CAPPluginCall?
    private var connected: CBPeripheral?
    private var writeCharacteristic: CBCharacteristic?
    private var pendingChunks: [Data] = []
    private var currentChunkIndex = 0
    private var writeType: CBCharacteristicWriteType = .withResponse

    public override func load() {
        central = CBCentralManager(delegate: self, queue: nil)
    }

    @objc func listPrinters(_ call: CAPPluginCall) {
        guard central.state == .poweredOn else {
            call.reject("Bluetooth non disponible ou non autorisé")
            return
        }
        discovered.removeAll()
        listCall = call
        central.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey:false])
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) { [weak self] in
            self?.finishScan()
        }
    }

    private func finishScan() {
        central.stopScan()
        guard let call = listCall else { return }
        let devices: [[String:Any]] = discovered.values
            .filter { p in
                let n = p.name?.uppercased() ?? ""
                return n.contains("CT") || n.contains("CLABEL")
            }
            .map { p in
                ["id": p.identifier.uuidString, "address": p.identifier.uuidString, "name": p.name ?? "CLABEL", "transport":"ble"]
            }
        call.resolve(["devices": devices])
        listCall = nil
    }

    @objc func connect(_ call: CAPPluginCall) {
        guard let id = call.getString("address"), let uuid = UUID(uuidString: id), let p = discovered[uuid] else {
            call.reject("Imprimante BLE inconnue. Lance une recherche d'abord.")
            return
        }
        connectCall = call
        connected = p
        p.delegate = self
        central.connect(p, options: nil)
    }

    @objc func write(_ call: CAPPluginCall) {
        guard let p = connected, let ch = writeCharacteristic, let text = call.getString("base64"), let data = Data(base64Encoded: text) else {
            call.reject("Imprimante non connectée ou données invalides")
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
        guard let p = connected, let ch = writeCharacteristic, currentChunkIndex < pendingChunks.count else {
            writeCall?.resolve(["ok":true])
            writeCall = nil
            pendingChunks.removeAll()
            return
        }
        let chunk = pendingChunks[currentChunkIndex]
        currentChunkIndex += 1
        p.writeValue(chunk, for: ch, type: writeType)
        if writeType == .withoutResponse {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.01) { [weak self] in self?.sendNextChunk() }
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        call.resolve([
            "connected": connected?.state == .connected && writeCharacteristic != nil,
            "address": connected?.identifier.uuidString ?? "",
            "transport":"ble"
        ])
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        if let p = connected { central.cancelPeripheralConnection(p) }
        connected = nil
        writeCharacteristic = nil
        call.resolve(["ok":true])
    }

    public func centralManagerDidUpdateState(_ central: CBCentralManager) {}

    public func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String : Any], rssi RSSI: NSNumber) {
        discovered[peripheral.identifier] = peripheral
    }

    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        peripheral.discoverServices(nil)
    }

    public func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        connectCall?.reject("Connexion BLE impossible : " + (error?.localizedDescription ?? "erreur inconnue"))
        connectCall = nil
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        if let error = error {
            connectCall?.reject("Découverte des services impossible : " + error.localizedDescription)
            connectCall = nil
            return
        }
        peripheral.services?.forEach { peripheral.discoverCharacteristics(nil, for: $0) }
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard error == nil else { return }
        for ch in service.characteristics ?? [] {
            if ch.uuid.uuidString.uppercased() == "FF02" ||
               ((ch.properties.contains(.write) || ch.properties.contains(.writeWithoutResponse)) && writeCharacteristic == nil) {
                writeCharacteristic = ch
            }
        }
        if writeCharacteristic != nil, let call = connectCall {
            call.resolve(["ok":true,"address":peripheral.identifier.uuidString,"name":peripheral.name ?? "CLABEL","transport":"ble"])
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
        if writeType == .withResponse { sendNextChunk() }
    }
}
