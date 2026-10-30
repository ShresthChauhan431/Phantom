// Authoritative AVFoundation camera list: index, name, device type.
//
// OpenCV opens macOS cameras by *index* but cannot report their names, so with two
// 1080p cameras attached there is no way to tell the built-in camera from a
// Continuity Camera. This prints the same ordered device list AVFoundation gives
// OpenCV, with names, so the right PHANTOM_CAMERA_INDEX is unambiguous.
//
// Run:  swift scripts/avf_devices.swift
// (Needs only the Xcode Command Line Tools, which ship swift.)

import AVFoundation

var types: [AVCaptureDevice.DeviceType] = [.builtInWideAngleCamera, .external]
if #available(macOS 14.0, *) {
    types.append(.continuityCamera)
}

let session = AVCaptureDevice.DiscoverySession(
    deviceTypes: types,
    mediaType: .video,
    position: .unspecified
)

let devices = session.devices
if devices.isEmpty {
    print("No video capture devices found.")
    print("Grant camera permission to the terminal app, then retry.")
} else {
    print("index  name                               type")
    print("-----  ---------------------------------  ----------------------------")
    for (i, d) in devices.enumerated() {
        let name = d.localizedName.padding(toLength: 33, withPad: " ", startingAt: 0)
        let type = d.deviceType.rawValue
            .replacingOccurrences(of: "AVCaptureDeviceType", with: "")
        print("\(String(format: "%5d", i))  \(name)  \(type)")
    }
    print("")
    print("Use the index of the iPhone row:  export PHANTOM_CAMERA_INDEX=<index>")
}
