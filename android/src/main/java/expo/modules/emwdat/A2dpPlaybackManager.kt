package expo.modules.emwdat

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager

/**
 * Prepares high-quality media playback to glasses over Bluetooth A2DP (output only).
 * Use with expo-av, MediaPlayer, or AudioTrack after activate().
 * See https://wearables.developer.meta.com/docs/develop/dat/microphones-and-speakers/
 */
object A2dpPlaybackManager {
    private var isActive: Boolean = false

    fun isActive(): Boolean = isActive

    fun configure(context: Context): Map<String, Any> {
        val a2dpAvailable = findA2dpOutputDevice(context) != null
        return mapOf(
            "active" to isActive,
            "a2dpDeviceAvailable" to a2dpAvailable,
            "routedToBluetooth" to isActive && a2dpAvailable
        )
    }

    fun activate(context: Context): Map<String, Any> {
        if (AudioSessionManager.isActive()) {
            AudioSessionManager.deactivate(context)
        }

        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

        // Media playback uses MODE_NORMAL; release SCO if HFP was active.
        if (audioManager.isBluetoothScoOn) {
            audioManager.stopBluetoothSco()
            audioManager.isBluetoothScoOn = false
        }
        audioManager.mode = AudioManager.MODE_NORMAL

        val a2dpDevice = findA2dpOutputDevice(context)
        val routed = a2dpDevice != null
        isActive = routed

        return mapOf(
            "active" to isActive,
            "a2dpDeviceAvailable" to routed,
            "routedToBluetooth" to routed
        )
    }

    fun deactivate(context: Context) {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        audioManager.mode = AudioManager.MODE_NORMAL
        isActive = false
    }

    private fun findA2dpOutputDevice(context: Context): AudioDeviceInfo? {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        return audioManager
            .getDevices(AudioManager.GET_DEVICES_OUTPUTS)
            .firstOrNull { it.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP }
    }
}
