package fr.etiquettelorraine.app

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(ClabelPrinterPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
