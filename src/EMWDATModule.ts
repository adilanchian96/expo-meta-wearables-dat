import { NativeModule, requireNativeModule } from "expo";
import { Platform } from "react-native";

import type {
  CameraFacing,
  Device,
  DisplayContentNode,
  EMWDATModuleEvents,
  LogLevel,
  MockDeviceKitConfig,
  Permission,
  PermissionStatus,
  PhotoCaptureFormat,
  WearablesA2dpPlaybackStatus,
  WearablesAudioSessionStatus,
  RegistrationState,
  StreamSessionConfig,
} from "./EMWDAT.types";

/**
 * Raw native module interface.
 * Uses string types for enum params/returns — wrapper functions cast to typed unions.
 */
declare class EMWDATNativeModule extends NativeModule<EMWDATModuleEvents> {
  setLogLevel(level: string): void;
  configure(): Promise<void>;
  getRegistrationState(): string;
  getRegistrationStateAsync(): Promise<string>;
  startRegistration(): Promise<void>;
  startUnregistration(): Promise<void>;
  handleUrl(url: string): Promise<boolean>;
  checkPermissionStatus(permission: string): Promise<string>;
  requestPermission(permission: string): Promise<string>;
  configureWearablesAudioSession(): Promise<WearablesAudioSessionStatus>;
  activateWearablesAudioSession(): Promise<WearablesAudioSessionStatus>;
  deactivateWearablesAudioSession(): Promise<void>;
  isWearablesAudioSessionActive(): boolean;
  configureWearablesA2dpPlayback(): Promise<WearablesA2dpPlaybackStatus>;
  activateWearablesA2dpPlayback(): Promise<WearablesA2dpPlaybackStatus>;
  deactivateWearablesA2dpPlayback(): Promise<void>;
  isWearablesA2dpPlaybackActive(): boolean;
  getDevices(): Promise<Device[]>;
  getDevice(identifier: string): Promise<Device | null>;

  // Session-based streaming
  createSession(deviceId?: string, displayCapableOnly?: boolean): Promise<string>;
  startSession(sessionId: string): Promise<void>;
  stopSession(sessionId: string): Promise<void>;
  addStreamToSession(sessionId: string, config: Partial<StreamSessionConfig>): Promise<void>;
  removeStreamFromSession(sessionId: string): Promise<void>;
  capturePhoto(format: string): Promise<void>;

  // Mock device kit
  enableMockDeviceKit(config: MockDeviceKitConfig): Promise<void>;
  disableMockDeviceKit(): Promise<void>;
  isMockDeviceKitEnabled(): Promise<boolean>;
  pairMockDevice(): Promise<string>;
  unpairMockDevice(deviceId: string): Promise<void>;
  getMockDevices(): Promise<string[]>;
  mockDevicePowerOn(id: string): Promise<void>;
  mockDevicePowerOff(id: string): Promise<void>;
  mockDeviceDon(id: string): Promise<void>;
  mockDeviceDoff(id: string): Promise<void>;
  mockDeviceFold(id: string): Promise<void>;
  mockDeviceUnfold(id: string): Promise<void>;
  mockDeviceSetCameraFeed(id: string, fileUrl: string): Promise<void>;
  mockDeviceSetCapturedImage(id: string, fileUrl: string): Promise<void>;
  mockDeviceSetCameraFeedFromCamera(id: string, facing: string): Promise<void>;
  mockSetPermissionStatus(permission: string, status: string): Promise<void>;
  mockSetPermissionRequestResult(permission: string, result: string): Promise<void>;

  // Display
  addDisplayToSession(sessionId: string): Promise<void>;
  removeDisplayFromSession(sessionId: string): Promise<void>;
  sendDisplayContent(sessionId: string, contentTree: DisplayContentNode): Promise<void>;
}

/** The native EMWDAT module instance. */
export const EMWDATModule = requireNativeModule<EMWDATNativeModule>("EMWDAT");

// =============================================================================
// Typed wrapper functions
// =============================================================================

/**
 * Subscribe to a native SDK event. Returns a subscription handle, or `null` on web.
 *
 * @param eventName - The event to listen for (e.g. `"onRegistrationStateChanged"`).
 * @param listener - Callback invoked when the event fires.
 */
export function addListener<E extends keyof EMWDATModuleEvents>(
  eventName: E,
  listener: EMWDATModuleEvents[E]
): { remove: () => void } | null {
  if (Platform.OS === "web") {
    return null;
  }
  return EMWDATModule.addListener(eventName, listener);
}

/** Set the native SDK log verbosity. */
export function setLogLevel(level: LogLevel): void {
  EMWDATModule.setLogLevel(level);
}

/** Initialize the Meta Wearables SDK. Must be called before any other SDK method. */
export async function configure(): Promise<void> {
  return EMWDATModule.configure();
}

/** Return the current registration state synchronously. */
export function getRegistrationState(): RegistrationState {
  return EMWDATModule.getRegistrationState() as RegistrationState;
}

/** Return the current registration state asynchronously. */
export async function getRegistrationStateAsync(): Promise<RegistrationState> {
  return (await EMWDATModule.getRegistrationStateAsync()) as RegistrationState;
}

/** Begin the device registration flow. Opens the Meta AI companion app. */
export async function startRegistration(): Promise<void> {
  return EMWDATModule.startRegistration();
}

/** Unregister the current device from the SDK. */
export async function startUnregistration(): Promise<void> {
  return EMWDATModule.startUnregistration();
}

/** Handle a deep-link URL callback from the Meta AI companion app. Returns `true` if the URL was consumed. */
export async function handleUrl(url: string): Promise<boolean> {
  return EMWDATModule.handleUrl(url);
}

/** Check the current status of a permission without prompting the user. */
export async function checkPermissionStatus(permission: Permission): Promise<PermissionStatus> {
  return (await EMWDATModule.checkPermissionStatus(permission)) as PermissionStatus;
}

/** Request a permission from the user. Returns the resulting status. */
export async function requestPermission(permission: Permission): Promise<PermissionStatus> {
  return (await EMWDATModule.requestPermission(permission)) as PermissionStatus;
}

/**
 * Prepare the platform audio session for glasses voice (HFP). Call before activate when using mic.
 * On iOS sets AVAudioSession playAndRecord with Bluetooth; on Android checks RECORD_AUDIO state.
 */
export async function configureWearablesAudioSession(): Promise<WearablesAudioSessionStatus> {
  return EMWDATModule.configureWearablesAudioSession();
}

/**
 * Activate HFP routing to connected glasses. Prefer calling {@link configureWearablesAudioSession} first.
 * When combining with camera streaming, configure/activate audio before starting the stream.
 */
export async function activateWearablesAudioSession(): Promise<WearablesAudioSessionStatus> {
  return EMWDATModule.activateWearablesAudioSession();
}

/** Release the HFP audio session and clear Bluetooth SCO routing. */
export async function deactivateWearablesAudioSession(): Promise<void> {
  return EMWDATModule.deactivateWearablesAudioSession();
}

/** Whether {@link activateWearablesAudioSession} is currently active. */
export function isWearablesAudioSessionActive(): boolean {
  return EMWDATModule.isWearablesAudioSessionActive();
}

/**
 * Prepare AVAudioSession / AudioManager for high-quality media playback over Bluetooth A2DP.
 * Deactivates an active HFP session if present.
 */
export async function configureWearablesA2dpPlayback(): Promise<WearablesA2dpPlaybackStatus> {
  return EMWDATModule.configureWearablesA2dpPlayback();
}

/**
 * Activate A2DP media routing to glasses. Use with expo-av or other media players after this call.
 */
export async function activateWearablesA2dpPlayback(): Promise<WearablesA2dpPlaybackStatus> {
  return EMWDATModule.activateWearablesA2dpPlayback();
}

/** Release the A2DP playback audio session. */
export async function deactivateWearablesA2dpPlayback(): Promise<void> {
  return EMWDATModule.deactivateWearablesA2dpPlayback();
}

/** Whether {@link activateWearablesA2dpPlayback} is currently active. */
export function isWearablesA2dpPlaybackActive(): boolean {
  return EMWDATModule.isWearablesA2dpPlaybackActive();
}

/** Return all registered Meta Wearables devices. */
export async function getDevices(): Promise<Device[]> {
  return EMWDATModule.getDevices();
}

/** Return a specific device by its identifier, or `null` if not found. */
export async function getDevice(identifier: string): Promise<Device | null> {
  return EMWDATModule.getDevice(identifier);
}

// =============================================================================
// Session-based streaming
// =============================================================================

/**
 * Create a new device session. Returns a sessionId.
 * Pass `displayCapableOnly: true` (without deviceId) to auto-select Meta Ray-Ban Display glasses.
 */
export async function createSession(
  deviceId?: string,
  displayCapableOnly?: boolean
): Promise<string> {
  return EMWDATModule.createSession(deviceId, displayCapableOnly);
}

/** Start a previously created session. Connects to the device. */
export async function startSession(sessionId: string): Promise<void> {
  return EMWDATModule.startSession(sessionId);
}

/** Stop a session. This is terminal — create a new session to stream again. */
export async function stopSession(sessionId: string): Promise<void> {
  return EMWDATModule.stopSession(sessionId);
}

/** Attach a camera stream capability to a session. */
export async function addStreamToSession(
  sessionId: string,
  config?: Partial<StreamSessionConfig>
): Promise<void> {
  return EMWDATModule.addStreamToSession(sessionId, config ?? {});
}

/** Remove the camera stream capability from a session. */
export async function removeStreamFromSession(sessionId: string): Promise<void> {
  return EMWDATModule.removeStreamFromSession(sessionId);
}

/** Capture a photo from the active stream. Defaults to JPEG format. */
export async function capturePhoto(format?: PhotoCaptureFormat): Promise<void> {
  return EMWDATModule.capturePhoto(format ?? "jpeg");
}

// =============================================================================
// Mock Device Kit (DEBUG only, throws on web/release)
// =============================================================================

/** Enable MockDeviceKit with optional configuration. */
export async function enableMockDeviceKit(config?: MockDeviceKitConfig): Promise<void> {
  return EMWDATModule.enableMockDeviceKit(config ?? {});
}

/** Disable MockDeviceKit and remove all fake implementations. */
export async function disableMockDeviceKit(): Promise<void> {
  return EMWDATModule.disableMockDeviceKit();
}

/** Check if MockDeviceKit is currently enabled. */
export async function isMockDeviceKitEnabled(): Promise<boolean> {
  return EMWDATModule.isMockDeviceKitEnabled();
}

/** Pair a simulated Ray-Ban Meta device. Returns the device identifier. */
export async function pairMockDevice(): Promise<string> {
  return EMWDATModule.pairMockDevice();
}

/** Unpair a mock device by identifier. */
export async function unpairMockDevice(deviceId: string): Promise<void> {
  return EMWDATModule.unpairMockDevice(deviceId);
}

/** Get identifiers of all active mock devices. */
export async function getMockDevices(): Promise<string[]> {
  return EMWDATModule.getMockDevices();
}

/** Power on a mock device. */
export async function mockDevicePowerOn(id: string): Promise<void> {
  return EMWDATModule.mockDevicePowerOn(id);
}

/** Power off a mock device. */
export async function mockDevicePowerOff(id: string): Promise<void> {
  return EMWDATModule.mockDevicePowerOff(id);
}

/** Simulate putting the glasses on (don). */
export async function mockDeviceDon(id: string): Promise<void> {
  return EMWDATModule.mockDeviceDon(id);
}

/** Simulate taking the glasses off (doff). */
export async function mockDeviceDoff(id: string): Promise<void> {
  return EMWDATModule.mockDeviceDoff(id);
}

/** Simulate folding the glasses. */
export async function mockDeviceFold(id: string): Promise<void> {
  return EMWDATModule.mockDeviceFold(id);
}

/** Simulate unfolding the glasses. */
export async function mockDeviceUnfold(id: string): Promise<void> {
  return EMWDATModule.mockDeviceUnfold(id);
}

/** Set the camera feed video for a mock device from a local file URL. */
export async function mockDeviceSetCameraFeed(id: string, fileUrl: string): Promise<void> {
  return EMWDATModule.mockDeviceSetCameraFeed(id, fileUrl);
}

/** Set the captured image for a mock device from a local file URL. */
export async function mockDeviceSetCapturedImage(id: string, fileUrl: string): Promise<void> {
  return EMWDATModule.mockDeviceSetCapturedImage(id, fileUrl);
}

/** Set the camera feed from the phone's physical camera for a mock device. */
export async function mockDeviceSetCameraFeedFromCamera(
  id: string,
  facing: CameraFacing
): Promise<void> {
  return EMWDATModule.mockDeviceSetCameraFeedFromCamera(id, facing);
}

/** Set a mock permission status for testing. */
export async function mockSetPermissionStatus(
  permission: Permission,
  status: PermissionStatus
): Promise<void> {
  return EMWDATModule.mockSetPermissionStatus(permission, status);
}

/** Set the expected result when a permission is requested in mock mode. */
export async function mockSetPermissionRequestResult(
  permission: Permission,
  result: PermissionStatus
): Promise<void> {
  return EMWDATModule.mockSetPermissionRequestResult(permission, result);
}

// =============================================================================
// Display
// =============================================================================

/** Attach a Display capability to a device session. Requires DAM to be enabled. */
export async function addDisplayToSession(sessionId: string): Promise<void> {
  return EMWDATModule.addDisplayToSession(sessionId);
}

/** Remove the Display capability from a session. */
export async function removeDisplayFromSession(sessionId: string): Promise<void> {
  return EMWDATModule.removeDisplayFromSession(sessionId);
}

/**
 * Send a UI content tree to the display. The root node must be a `flexBox`.
 * Native layer auto-attaches the display capability when missing, waits for
 * session/display readiness, then sends (DisplayAccess send() pattern).
 */
export async function sendDisplayContent(
  sessionId: string,
  contentTree: DisplayContentNode
): Promise<void> {
  return EMWDATModule.sendDisplayContent(sessionId, contentTree);
}
