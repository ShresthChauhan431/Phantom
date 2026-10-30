// Stream iPhone (Continuity Camera) frames to stdout as length-prefixed JPEGs.
//
// WHY THIS EXISTS
// OpenCV addresses macOS cameras only by index, and it cannot reach a Continuity
// Camera from a plain Python process: that requires the
// NSCameraUseContinuityCameraDeviceType Info.plist opt-in, which a bare interpreter
// has no way to declare. Verified on hardware — every OpenCV index served the
// built-in camera, while AVFoundation from Swift captures the iPhone fine (the
// iPhone itself displays "MacBook is accessing the camera").
//
// So Swift owns the capture and Python consumes the frames. The device is selected
// by its AVFoundation **uniqueID**, so there is no positional-index ambiguity: the
// built-in camera can never be opened by accident.
//
// PROTOCOL (stdout, binary)
//   repeated:  [4-byte big-endian length][JPEG bytes]
// Diagnostics go to stderr so they never corrupt the frame stream.
//
// Run:  swift scripts/iphone_stream.swift [--unique-id <id>] [--fps 2] [--quality 0.8]
//                                         [--lock-after 3.0]

import AVFoundation
import CoreImage
import Foundation

// ------------------------------------------------------------------ arguments
var uniqueID: String?
var fps = 2.0
var quality = 0.8
var lockAfter = 3.0

var args = Array(CommandLine.arguments.dropFirst())
var i = 0
while i < args.count {
    switch args[i] {
    case "--unique-id": if i + 1 < args.count { uniqueID = args[i + 1]; i += 1 }
    case "--fps": if i + 1 < args.count { fps = Double(args[i + 1]) ?? fps; i += 1 }
    case "--quality": if i + 1 < args.count { quality = Double(args[i + 1]) ?? quality; i += 1 }
    case "--lock-after": if i + 1 < args.count { lockAfter = Double(args[i + 1]) ?? lockAfter; i += 1 }
    default: break
    }
    i += 1
}

func log(_ s: String) {
    FileHandle.standardError.write(("[iphone_stream] " + s + "\n").data(using: .utf8)!)
}

// --------------------------------------------------------------- device pick
var types: [AVCaptureDevice.DeviceType] = [.external, .builtInWideAngleCamera]
if #available(macOS 14.0, *) { types.append(.continuityCamera) }

let discovery = AVCaptureDevice.DiscoverySession(
    deviceTypes: types, mediaType: .video, position: .unspecified
)

let device: AVCaptureDevice?
if let wanted = uniqueID {
    device = discovery.devices.first { $0.uniqueID == wanted }
} else {
    // Never fall back to a built-in camera: silently recording the wrong camera is
    // worse than failing loudly.
    device = discovery.devices.first { $0.localizedName.lowercased().contains("iphone") }
}

guard let camera = device else {
    log("ERROR: iPhone camera not found.")
    log("Available devices:")
    for d in discovery.devices { log("  \(d.localizedName)  [\(d.uniqueID)]") }
    log("For Continuity Camera: same Apple ID on both devices, Wi-Fi + Bluetooth on,")
    log("iPhone locked and stationary with rear cameras facing the scene.")
    exit(1)
}
log("device: \(camera.localizedName) [\(camera.uniqueID)]")

// ------------------------------------------------------------------- capture
final class Streamer: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    let ciContext = CIContext(options: [.useSoftwareRenderer: false])
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let minInterval: Double
    let quality: Double
    var lastEmit: Double = 0
    var emitted = 0
    let out = FileHandle.standardOutput

    init(fps: Double, quality: Double) {
        self.minInterval = fps > 0 ? 1.0 / fps : 0
        self.quality = quality
    }

    func captureOutput(_ o: AVCaptureOutput, didOutput sb: CMSampleBuffer,
                       from c: AVCaptureConnection) {
        let now = Date().timeIntervalSince1970
        guard now - lastEmit >= minInterval else { return }
        guard let pb = CMSampleBufferGetImageBuffer(sb) else { return }
        let image = CIImage(cvPixelBuffer: pb)
        guard let jpeg = ciContext.jpegRepresentation(
            of: image, colorSpace: colorSpace,
            options: [kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption:
                      quality]
        ) else { return }

        var length = UInt32(jpeg.count).bigEndian
        var header = Data()
        withUnsafeBytes(of: &length) { header.append(contentsOf: $0) }
        do {
            try out.write(contentsOf: header)
            try out.write(contentsOf: jpeg)
        } catch {
            // Python side closed the pipe — shut down cleanly.
            exit(0)
        }
        lastEmit = now
        emitted += 1
        if emitted == 1 { log("streaming (first frame \(jpeg.count) bytes)") }
    }
}

let session = AVCaptureSession()
session.beginConfiguration()
guard let input = try? AVCaptureDeviceInput(device: camera), session.canAddInput(input) else {
    log("ERROR: could not open \(camera.localizedName)")
    exit(1)
}
session.addInput(input)

let output = AVCaptureVideoDataOutput()
output.alwaysDiscardsLateVideoFrames = true
let streamer = Streamer(fps: fps, quality: quality)
output.setSampleBufferDelegate(streamer, queue: DispatchQueue(label: "phantom.iphone.stream"))
guard session.canAddOutput(output) else {
    log("ERROR: could not add video output")
    exit(1)
}
session.addOutput(output)
session.commitConfiguration()

session.startRunning()
log("session started (fps=\(fps))")

// Lock exposure / white balance / focus once auto has settled.
//
// WHY: the gate detects change by differencing consecutive frames, so any global
// brightness drift reads as motion. Measured on a still desk with auto enabled,
// the motion score oscillated between 0.003 and 0.048 — above the 0.02 trigger —
// purely from the camera re-adjusting, which kept the debouncer from ever settling
// so no frame was ever promoted to the VLM. With these locked, a still scene reads
// ~0.000 and only real change moves the needle.
DispatchQueue.global().asyncAfter(deadline: .now() + lockAfter) {
    do {
        try camera.lockForConfiguration()
        var locked: [String] = []
        if camera.isExposureModeSupported(.locked) {
            camera.exposureMode = .locked
            locked.append("exposure")
        }
        if camera.isWhiteBalanceModeSupported(.locked) {
            camera.whiteBalanceMode = .locked
            locked.append("white-balance")
        }
        if camera.isFocusModeSupported(.locked) {
            camera.focusMode = .locked
            locked.append("focus")
        }
        camera.unlockForConfiguration()
        log(locked.isEmpty
            ? "WARNING: device supports no locked modes; expect exposure drift"
            : "locked after \(lockAfter)s: " + locked.joined(separator: ", "))
    } catch {
        log("WARNING: could not lock configuration: \(error.localizedDescription)")
    }
}

// Stream until the parent process closes the pipe or kills us.
RunLoop.main.run()
