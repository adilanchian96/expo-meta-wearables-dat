import Foundation
import MWDATCore
import MWDATDisplay

public typealias EventEmitterDisplay = (String, [String: Any]) -> Void

/// Display lifecycle — mirrors DisplayAccess/DisplayViewModel.swift:
/// session.started → addDisplay → display.start → display.started → send.
/// `sendDisplayContent` auto-attaches when no display is present (pending-send pattern).
@MainActor
public final class DisplaySessionManager {
    public static let shared = DisplaySessionManager()

    private let logger = EMWDATLogger.shared
    private var displays: [String: Display] = [:]
    private var stateTokens: [String: AnyListenerToken] = [:]
    private var attachTasks: [String: Swift.Task<Void, Error>] = [:]
    private var eventEmitter: EventEmitterDisplay?

    private init() {}

    public func setEventEmitter(_ emitter: @escaping EventEmitterDisplay) {
        eventEmitter = emitter
    }

    /// Attach display to session. Idempotent — safe to call when already attached.
    public func addDisplayToSession(sessionId: String) async throws {
        try await ensureDisplayAttached(sessionId: sessionId)
    }

    public func removeDisplayFromSession(sessionId: String) async {
        await displays[sessionId]?.stop()

        if let session = WearablesManager.shared.getSession(sessionId: sessionId) {
            try? session.removeCapability(Display.self)
        }

        destroyDisplay(sessionId: sessionId)
        emit("onDisplayStateChange", ["sessionId": sessionId, "state": "stopped"])
    }

    /// Sends content to the display. Auto-attaches and waits for session/display readiness
    /// when no display is attached yet (DisplayViewModel.send pattern).
    public func sendDisplayContent(sessionId: String, contentTree: [String: Any]) async throws {
        try await ensureDisplayAttached(sessionId: sessionId)

        guard let display = displays[sessionId] else {
            throw DisplaySessionManagerError.displayNotFound(sessionId)
        }

        if display.state != .started {
            try await waitForDisplayStarted(display)
        }

        let tree = DisplayContentBuilder.dictionary(from: contentTree) ?? contentTree
        guard let view = DisplayContentBuilder.buildRootFlexBox(from: tree, onInteraction: { [weak self] id in
            Swift.Task { @MainActor in
                self?.emit("onDisplayInteraction", ["sessionId": sessionId, "interactionId": id])
            }
        }) else {
            throw DisplaySessionManagerError.invalidContentTree("Root must be a flexBox with valid children")
        }

        do {
            try await display.send(view)
        } catch {
            emit("onDisplayError", ["sessionId": sessionId, "error": mapSendError(error)])
            throw error
        }
    }

    public func destroy() {
        for sessionId in Array(displays.keys) {
            destroyDisplay(sessionId: sessionId)
        }
    }

    // MARK: - Attach (session.started → addDisplay → display.start)

    private func ensureDisplayAttached(sessionId: String) async throws {
        if displays[sessionId] != nil { return }

        if let existing = attachTasks[sessionId] {
            try await existing.value
            return
        }

        let task = Swift.Task { @MainActor in
            try await self.attachDisplayToSession(sessionId: sessionId)
        }
        attachTasks[sessionId] = task
        defer { attachTasks[sessionId] = nil }
        try await task.value
    }

    private func attachDisplayToSession(sessionId: String) async throws {
        guard displays[sessionId] == nil else { return }

        guard let session = WearablesManager.shared.getSession(sessionId: sessionId) else {
            throw DisplaySessionManagerError.sessionNotFound(sessionId)
        }

        try await waitForSessionStarted(session)

        let display = try session.addDisplay()
        displays[sessionId] = display

        stateTokens[sessionId] = display.statePublisher.listen { [weak self] state in
            Swift.Task { @MainActor in
                self?.emitDisplayState(sessionId: sessionId, state: state)
            }
        }

        await display.start()
        logger.info("Display", "Display attached", context: [
            "sessionId": sessionId,
            "state": mapDisplayState(display.state)
        ])
    }

    // MARK: - Session / display wait (CameraAccess + DisplayAccess samples)

    private func waitForSessionStarted(_ session: DeviceSession) async throws {
        if session.state == .started { return }

        let stateStream = session.stateStream()
        let errorStream = session.errorStream()

        try await withThrowingTaskGroup(of: Void.self) { group in
            group.addTask {
                for await state in stateStream {
                    if state == .started { return }
                    if state == .stopped {
                        throw DeviceSessionError.unexpectedError(description: "Session stopped before starting")
                    }
                }
                throw DeviceSessionError.unexpectedError(description: "Session failed to start")
            }
            group.addTask {
                for await error in errorStream { throw error }
                throw DeviceSessionError.unexpectedError(description: "Session failed to start")
            }
            _ = try await group.next()
            group.cancelAll()
        }
    }

    private func waitForDisplayStarted(_ display: Display, timeoutSeconds: TimeInterval = 45) async throws {
        if display.state == .started { return }

        try await withThrowingTaskGroup(of: Void.self) { group in
            group.addTask {
                try await Swift.Task.sleep(nanoseconds: UInt64(timeoutSeconds * 1_000_000_000))
                throw DisplaySessionManagerError.displayNotReady("Timed out waiting for display started")
            }
            group.addTask {
                let (stream, continuation) = AsyncStream.makeStream(of: DisplayState.self)
                var token: AnyListenerToken? = display.statePublisher.listen { state in
                    continuation.yield(state)
                }
                defer {
                    token = nil
                    continuation.finish()
                }

                var sawStarting = false
                for await state in stream {
                    switch state {
                    case .started:
                        return
                    case .starting, .stopping:
                        sawStarting = true
                    case .stopped where sawStarting:
                        throw DisplaySessionManagerError.displayNotReady("Display stopped before starting")
                    default:
                        break
                    }
                }
                throw DisplaySessionManagerError.displayNotReady("Display failed to start")
            }
            _ = try await group.next()
            group.cancelAll()
        }
    }

    private func mapDisplayState(_ state: DisplayState) -> String {
        switch state {
        case .stopped: return "stopped"
        case .starting: return "starting"
        case .started: return "started"
        case .stopping: return "stopping"
        @unknown default: return "stopped"
        }
    }

    // MARK: - Helpers

    private func destroyDisplay(sessionId: String) {
        stateTokens[sessionId] = nil
        displays[sessionId] = nil
    }

    private func emitDisplayState(sessionId: String, state: DisplayState) {
        let mapped = mapDisplayState(state)
        logger.info("Display", "State changed", context: ["sessionId": sessionId, "state": mapped])
        emit("onDisplayStateChange", ["sessionId": sessionId, "state": mapped])
    }

    private func mapSendError(_ error: Error) -> String {
        if error is DisplayError { return "renderingFailed" }
        if let sessionError = error as? DeviceSessionError {
            switch sessionError {
            case .sessionAlreadyStopped, .sessionIdle, .capabilityAlreadyActive, .capabilityNotFound:
                return "invalidSessionState"
            default:
                return "unexpectedError"
            }
        }
        return "unexpectedError"
    }

    private func emit(_ name: String, _ body: [String: Any]) {
        eventEmitter?(name, body)
    }
}

public enum DisplaySessionManagerError: LocalizedError {
    case sessionNotFound(String)
    case displayNotFound(String)
    case displayNotReady(String)
    case invalidContentTree(String)

    public var errorDescription: String? {
        switch self {
        case .sessionNotFound(let id): return "Session not found: \(id)"
        case .displayNotFound(let id): return "No active display for session: \(id)"
        case .displayNotReady(let reason): return reason
        case .invalidContentTree(let reason): return reason
        }
    }
}
