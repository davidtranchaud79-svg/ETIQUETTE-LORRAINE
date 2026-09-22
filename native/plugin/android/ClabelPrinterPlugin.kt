package fr.etiquettelorraine.app

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.os.Build
import android.util.Base64
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import java.io.OutputStream
import java.util.UUID
import java.util.concurrent.Executors

@CapacitorPlugin(
    name = "ClabelPrinter",
    permissions = [
        Permission(
            alias = "bluetooth",
            strings = [
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN
            ]
        )
    ]
)
class ClabelPrinterPlugin : Plugin() {
    private val io = Executors.newSingleThreadExecutor()
    private val adapter: BluetoothAdapter?
        get() = BluetoothAdapter.getDefaultAdapter()

    private var socket: BluetoothSocket? = null
    private var output: OutputStream? = null
    private var connectedAddress: String? = null

    private fun ensurePermission(call: PluginCall): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        if (getPermissionState("bluetooth") == PermissionState.GRANTED) return true
        requestPermissionForAlias("bluetooth", call, "permissionCallback")
        return false
    }

    @com.getcapacitor.annotation.PermissionCallback
    private fun permissionCallback(call: PluginCall) {
        if (getPermissionState("bluetooth") == PermissionState.GRANTED) {
            when (call.methodName) {
                "listPrinters" -> listPrinters(call)
                "connect" -> connect(call)
                else -> call.reject("Permission Bluetooth requise")
            }
        } else call.reject("Permission Bluetooth refusée")
    }

    @PluginMethod
    fun listPrinters(call: PluginCall) {
        if (!ensurePermission(call)) return
        val bt = adapter ?: return call.reject("Bluetooth indisponible")
        val hints = listOf("CT", "CLABEL", "Clabel", "CLabel")
        val devices = JSArray()
        try {
            bt.bondedDevices
                .filter { d ->
                    val n = d.name ?: ""
                    hints.any { h -> n.contains(h, ignoreCase = true) }
                }
                .sortedBy { it.name ?: it.address }
                .forEach { d ->
                    val o = JSObject()
                    o.put("id", d.address)
                    o.put("address", d.address)
                    o.put("name", d.name ?: "CLABEL")
                    o.put("transport", "classic")
                    o.put("bondState", d.bondState)
                    devices.put(o)
                }
            val result = JSObject()
            result.put("devices", devices)
            call.resolve(result)
        } catch (e: SecurityException) {
            call.reject("Permission Bluetooth manquante", e)
        }
    }

    @PluginMethod
    fun connect(call: PluginCall) {
        if (!ensurePermission(call)) return
        val address = call.getString("address") ?: return call.reject("Adresse Bluetooth manquante")
        val uuidText = call.getString("sppUuid") ?: "00001101-0000-1000-8000-00805F9B34FB"
        io.execute {
            try {
                closeCurrent()
                val bt = adapter ?: throw IllegalStateException("Bluetooth indisponible")
                if (bt.isDiscovering) bt.cancelDiscovery()
                val device: BluetoothDevice = bt.getRemoteDevice(address)
                val s = device.createRfcommSocketToServiceRecord(UUID.fromString(uuidText))
                s.connect()
                socket = s
                output = s.outputStream
                connectedAddress = address
                val result = JSObject()
                result.put("ok", true)
                result.put("address", address)
                result.put("name", device.name ?: "CLABEL")
                result.put("transport", "classic")
                call.resolve(result)
            } catch (e: Exception) {
                closeCurrent()
                call.reject("Connexion CLABEL impossible : \${e.message}", e)
            }
        }
    }

    @PluginMethod
    fun write(call: PluginCall) {
        val data64 = call.getString("base64") ?: return call.reject("Données d'impression manquantes")
        io.execute {
            try {
                val stream = output ?: throw IllegalStateException("Imprimante non connectée")
                val bytes = Base64.decode(data64, Base64.DEFAULT)
                var offset = 0
                val chunk = 4096
                while (offset < bytes.size) {
                    val end = minOf(bytes.size, offset + chunk)
                    stream.write(bytes, offset, end - offset)
                    stream.flush()
                    offset = end
                    Thread.sleep(8)
                }
                val result = JSObject()
                result.put("ok", true)
                result.put("bytes", bytes.size)
                result.put("address", connectedAddress)
                call.resolve(result)
            } catch (e: Exception) {
                call.reject("Échec d'impression Bluetooth : \${e.message}", e)
            }
        }
    }

    @PluginMethod
    fun diagnostics(call: PluginCall) {
        val r = JSObject()
        r.put("platform", "android")
        r.put("sdk", Build.VERSION.SDK_INT)
        r.put("bluetoothAvailable", adapter != null)
        r.put("bluetoothEnabled", adapter?.isEnabled == true)
        r.put("permission", if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) "not-required" else getPermissionState("bluetooth").toString())
        r.put("connected", socket?.isConnected == true)
        r.put("address", connectedAddress)
        r.put("transport", if (socket?.isConnected == true) "classic" else "")
        call.resolve(r)
    }

    @PluginMethod
    fun status(call: PluginCall) {
        val r = JSObject()
        r.put("connected", socket?.isConnected == true)
        r.put("address", connectedAddress)
        r.put("transport", if (socket?.isConnected == true) "classic" else "")
        call.resolve(r)
    }

    @PluginMethod
    fun disconnect(call: PluginCall) {
        io.execute {
            closeCurrent()
            val r = JSObject()
            r.put("ok", true)
            call.resolve(r)
        }
    }

    private fun closeCurrent() {
        try { output?.close() } catch (_: Exception) {}
        try { socket?.close() } catch (_: Exception) {}
        output = null
        socket = null
        connectedAddress = null
    }

    override fun handleOnDestroy() {
        closeCurrent()
        io.shutdownNow()
        super.handleOnDestroy()
    }
}
