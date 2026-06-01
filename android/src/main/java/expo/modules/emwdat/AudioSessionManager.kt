package expo.modules.emwdat

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioDeviceInfo
import android.media.AudioManager
import androidx.core.content.ContextCompat

/**
 * Routes voice audio to glasses over Bluetooth HFP (Hands-Free Profile).
 * See https://wearables.developer.meta.com/docs/develop/dat/microphones-and-speakers/
 */
object AudioSessionManager {
    private var isActive: Boolean = false

    fun isActive(): Boolean = isActive

    fun configure(context: Context): Map<String, Any> {
        val hasRecordAudio = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
        return mapOf(
            "active" to isActive,
            "platformMicGranted" to hasRecordAudio
        )
    }

    fun activate(context: Context): Map<String, Any> {
        if (A2dpPlaybackManager.isActive()) {
            A2dpPlaybackManager.deactivate(context)
        }

        val hasRecordAudio = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED

        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val devices = audioManager.availableCommunicationDevices

        var selectedDevice: AudioDeviceInfo? = null
        for (device in devices) {
            if (device.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO) {
                selectedDevice = device
                break
            }
        }

        val routed = if (selectedDevice != null) {
            audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
            audioManager.setCommunicationDevice(selectedDevice)
        } else {
            false
        }

        isActive = routed
        return mapOf(
            "active" to isActive,
            "routedToBluetooth" to routed,
            "platformMicGranted" to hasRecordAudio
        )
    }

    fun deactivate(context: Context) {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        audioManager.clearCommunicationDevice()
        audioManager.mode = AudioManager.MODE_NORMAL
        isActive = false
    }
}
