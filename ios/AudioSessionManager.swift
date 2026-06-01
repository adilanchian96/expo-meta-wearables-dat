import AVFoundation

/// Mirrors session active state for sync reads from Expo `Function` handlers.
enum WearablesAudioSessionState {
    nonisolated(unsafe) static var isActive = false
}

/// Configures AVAudioSession for glasses microphone/speaker over Bluetooth HFP.
/// See https://wearables.developer.meta.com/docs/develop/dat/microphones-and-speakers/
@MainActor
public final class AudioSessionManager {
    public static let shared = AudioSessionManager()

    private init() {}

    nonisolated static var isActive: Bool {
        WearablesAudioSessionState.isActive
    }

    public func configure() throws -> [String: Any] {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(
            .playAndRecord,
            mode: .default,
            options: [.allowBluetooth, .defaultToSpeaker]
        )
        return statusPayload()
    }

    @discardableResult
    public func activate() async throws -> [String: Any] {
        if WearablesA2dpPlaybackState.isActive {
            try A2dpPlaybackManager.shared.deactivate()
        }

        let session = AVAudioSession.sharedInstance()
        if session.recordPermission == .undetermined {
            await withCheckedContinuation { continuation in
                session.requestRecordPermission { _ in
                    continuation.resume()
                }
            }
        }
        try session.setActive(true, options: .notifyOthersOnDeactivation)
        WearablesAudioSessionState.isActive = true
        return statusPayload()
    }

    public func deactivate() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setActive(false, options: .notifyOthersOnDeactivation)
        WearablesAudioSessionState.isActive = false
    }

    private func statusPayload() -> [String: Any] {
        let recordPermission = AVAudioSession.sharedInstance().recordPermission
        let platformMicGranted = recordPermission == .granted
        let active = WearablesAudioSessionState.isActive
        return [
            "active": active,
            "platformMicGranted": platformMicGranted,
            "routedToBluetooth": active
        ]
    }
}
