// Can AVFoundation actually CAPTURE from the iPhone (Continuity Camera)?
//
// OpenCV addresses macOS cameras by index, and on this machine index 1 is named
// "iPhone" by macOS yet opening it activates the built-in camera — OpenCV cannot
// reach a Continuity Camera without the NSCameraUseContinuityCameraDeviceType
// Info.plist opt-in, which a bare Python process does not have.
//
// Swift/AVFoundation can enumerate the iPhone. This probe tests whether it can also
// pull real frames from it, which decides whether a Swift capture bridge is viable.
//
// Run:  swift scripts/avf_capture_probe.swift            (auto-picks the iPhone)
//       swift scripts/avf_capture_probe.swift builtin    (control: built-in camera)

import AVFoundation
import CoreVideo
import Foundation

let wantBuiltIn = CommandLine.arguments.dropFirst().first == "builtin"

var types: [AVCaptureDevice.DeviceType] = [.builtInWideAngleCamera, .external]
if #available(macOS 14.0, *) { types.append(.continuityCamera) }

let session = AVCaptureDevice.DiscoverySession(
    deviceTypes: types, mediaType: .video, position: .unspecified
)

let chosen: AVCaptureDevice? = wantBuiltIn
    ? session.devices.first { $0.deviceType == .builtInWideAngleCamera }
    : session.devices.first { $0.localizedName.lowercased().contains("iphone") }

guard let device = chosen else {
    print("✗ no matching device found")
    exit(1)
}
print("Target device : \(device.localizedName)")
print("Device type   : \(device.deviceType.rawValue)")
print("Unique ID     : \(device.uniqueID)")

final class Collector: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    var frames = 0
    var width = 0
    var height = 0
    var meanLuma: Double = 0
    var signature: [Double] = []
    let done = DispatchSemaphore(value: 0)

    func captureOutput(_ out: AVCaptureOutput, didOutput sb: CMSampleBuffer,
                       from conn: AVCaptureConnection) {
        guard let pb = CMSampleBufferGetImageBuffer(sb) else { return }
        frames += 1
        // Measure a late frame so auto-exposure has settled.
        guard frames == 12 else { return }
        CVPixelBufferLockBaseAddress(pb, .readOnly)
        width = CVPixelBufferGetWidth(pb)
        height = CVPixelBufferGetHeight(pb)
        let planar = CVPixelBufferIsPlanar(pb)
        let base = planar
            ? CVPixelBufferGetBaseAddressOfPlane(pb, 0)
            : CVPixelBufferGetBaseAddress(pb)
        let stride = planar
            ? CVPixelBufferGetBytesPerRowOfPlane(pb, 0)
            : CVPixelBufferGetBytesPerRow(pb)
        let pixelStride = planar ? 1 : 4  // packed formats here are 4 bytes/pixel
        if let base = base, width > 0, height > 0 {
            let bytes = base.assumingMemoryBound(to: UInt8.self)
            // 8x8 grid of mean luma: a tiny scene fingerprint. Two cameras pointing
            // in different directions produce wildly different fingerprints, so this
            // identifies which stream belongs to this device without any LED guessing.
            let grid = 8
            var sig = [Double](repeating: 0, count: grid * grid)
            var total = 0.0
            var totalSamples = 0
            for gy in 0..<grid {
                for gx in 0..<grid {
                    let y0 = gy * height / grid, y1 = (gy + 1) * height / grid
                    let x0 = gx * width / grid, x1 = (gx + 1) * width / grid
                    var sum = 0.0
                    var n = 0
                    var y = y0
                    while y < y1 { 
                        var x = x0
                        while x < x1 {
                            sum += Double(bytes[y * stride + x * pixelStride])
                            n += 1
                            x += 4
                        }
                        y += 4
                    }
                    let mean = n > 0 ? sum / Double(n) : 0
                    sig[gy * grid + gx] = mean
                    total += sum
                    totalSamples += n
                }
            }
            signature = sig
            meanLuma = totalSamples > 0 ? total / Double(totalSamples) : 0
        }
        CVPixelBufferUnlockBaseAddress(pb, .readOnly)
        done.signal()
    }
}

let capture = AVCaptureSession()
capture.beginConfiguration()
guard let input = try? AVCaptureDeviceInput(device: device), capture.canAddInput(input) else {
    print("✗ could not create input for \(device.localizedName)")
    exit(1)
}
capture.addInput(input)

let output = AVCaptureVideoDataOutput()
output.alwaysDiscardsLateVideoFrames = true
let collector = Collector()
output.setSampleBufferDelegate(collector, queue: DispatchQueue(label: "probe"))
guard capture.canAddOutput(output) else {
    print("✗ could not add video output")
    exit(1)
}
capture.addOutput(output)
capture.commitConfiguration()

print("Starting capture — watch which camera's indicator light turns on ...")
capture.startRunning()

let result = collector.done.wait(timeout: .now() + 15)
capture.stopRunning()

if result == .timedOut && collector.frames == 0 {
    print("✗ TIMED OUT: device produced no frames in 15s")
    exit(2)
}
print("✓ captured \(collector.frames) frames")
print("  resolution : \(collector.width)x\(collector.height)")
print(String(format: "  mean luma  : %.1f", collector.meanLuma))
// Machine-readable scene fingerprint for identify_iphone_index.py to match against.
print("SIGNATURE: " + collector.signature.map { String(format: "%.2f", $0) }.joined(separator: " "))
