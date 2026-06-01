import AVFoundation

enum WearablesA2dpPlaybackState {
    nonisolated(unsafe) static var isActive = false
}

/// High-quality media playback to glasses over Bluetooth A2DP (output only).
/// See https://wearables.developer.meta.com/docs/develop/dat/microphones-and-speakers/
@MainActor
public final class A2dpPlaybackManager {
    public static let shared = A2dpPlaybackManager()

    private init() {}

    nonisolated static var isActive: Bool {
        WearablesA2dpPlaybackState.isActive
    }

    public func configure() throws -> [String: Any] {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(
            .playback,
            mode: .default,
            options: [.allowBluetoothA2DP]
        )
        return statusPayload()
    }

    @discardableResult
    public func activate() throws -> [String: Any] {
        if WearablesAudioSessionState.isActive {
            try AudioSessionManager.shared.deactivate()
        }

        let session = AVAudioSession.sharedInstance()
        try session.setCategory(
            .playback,
            mode: .default,
            options: [.allowBluetoothA2DP]
        )
        try session.setActive(true, options: .notifyOthersOnDeactivation)
        WearablesA2dpPlaybackState.isActive = true
        return statusPayload()
    }

    public func deactivate() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setActive(false, options: .notifyOthersOnDeactivation)
        WearablesA2dpPlaybackState.isActive = false
    }

    private func statusPayload() -> [String: Any] {
        let outputs = AVAudioSession.sharedInstance().currentRoute.outputs
        let routedToA2dp = outputs.contains { $0.portType == .bluetoothA2DP }
        let a2dpAvailable = outputs.contains {
            $0.portType == .bluetoothA2DP || $0.portType == .bluetoothLE
        }
        let active = WearablesA2dpPlaybackState.isActive
        return [
            "active": active,
            "routedToBluetooth": active && routedToA2dp,
            "a2dpDeviceAvailable": a2dpAvailable
        ]
    }
}
