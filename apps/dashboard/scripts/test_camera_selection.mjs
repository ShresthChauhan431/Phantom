/**
 * Verify the camera-selection fix without a browser.
 *
 * Reproduces the reported bug (built-in webcam opened instead of the iPhone) by
 * injecting a mock navigator.mediaDevices, then asserts the fixed logic:
 *   - picks the iPhone even when the built-in is listed first
 *   - never opens the default camera when permission is already granted
 *   - refuses to record the built-in when no phone is present
 *   - refuses a stream whose real label is not the phone
 */
import { readFileSync } from 'node:fs';

const SRC = new URL('../src/js/engine/backend-engine.js', import.meta.url).pathname;
const CODE = readFileSync(SRC, 'utf8');

const fakeFetch = async () => ({
  ok: false, status: 503, headers: { get: () => '' }, json: async () => ({}),
});
const fakeDocument = { createElement: () => ({ getContext: () => ({}) }) };

let opened = [];
let permissionPrompts = 0;

function makeNavigator(devices, { labelsHidden = false, trackLabelOverride = null } = {}) {
  return {
    mediaDevices: {
      async enumerateDevices() {
        return devices.map((d) => ({
          kind: 'videoinput',
          deviceId: d.deviceId,
          label: labelsHidden ? '' : d.label,
        }));
      },
      async getUserMedia(constraints) {
        const exact = constraints?.video?.deviceId?.exact;
        if (!exact) permissionPrompts++;
        opened.push(exact ?? '(default)');
        const match = devices.find((d) => d.deviceId === exact) || devices[0];
        const label = trackLabelOverride ?? match.label;
        return {
          getVideoTracks: () => [{ label }],
          getTracks: () => [{ label, stop() {} }],
        };
      },
    },
  };
}

/** Load the IIFE with an injected navigator, so nothing global is mutated. */
function loadEngine(navigator) {
  const self = {};
  new Function('self', 'navigator', 'fetch', 'URL', 'document', 'console', CODE)(
    self, navigator, fakeFetch, globalThis.URL, fakeDocument, console
  );
  return self.PhantomBackendEngine;
}

function scenario(devices, opts = {}) {
  opened = [];
  permissionPrompts = 0;
  const nav = makeNavigator(devices, opts);
  return loadEngine(nav);
}

function check(name, pass, extra = '') {
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
  if (!pass) process.exitCode = 1;
}

const MACBOOK = { deviceId: 'mac-1', label: 'MacBook Air Camera' };
const IPHONE = { deviceId: 'phone-1', label: 'Devansh\u2019s iPhone Camera' };

console.log('1. built-in listed FIRST, permission already granted (the reported bug)');
{
  const Engine = scenario([MACBOOK, IPHONE]);
  const e = new Engine({ videoElement: null });
  await e._enumerateCameras();
  check('iPhone preferred over built-in', e.preferredDeviceId === 'phone-1', `picked ${e.preferredDeviceId}`);
  check('no camera opened while enumerating', opened.length === 0, `opens: ${JSON.stringify(opened)}`);
  await e.startMonitoring();
  check('opened the iPhone only', opened.length === 1 && opened[0] === 'phone-1', `opens: ${JSON.stringify(opened)}`);
  check('reports the iPhone as active', /iphone/i.test(e.activeCameraLabel || ''), String(e.activeCameraLabel));
  e.stopMonitoring();
}

console.log('\n2. first run, labels hidden until permission granted');
{
  const Engine = scenario([MACBOOK, IPHONE], { labelsHidden: true });
  const e = new Engine({ videoElement: null });
  await e._enumerateCameras();
  check('page load opens no camera (no prompt without Start)', permissionPrompts === 0 && opened.length === 0,
        `prompts: ${permissionPrompts}, opens: ${JSON.stringify(opened)}`);
  await e._enumerateCameras({ allowPrompt: true });
  check('Start triggers exactly one permission probe', permissionPrompts === 1, `prompts: ${permissionPrompts}`);
}

console.log('\n3. no phone attached');
{
  const Engine = scenario([MACBOOK]);
  const e = new Engine({ videoElement: null });
  let status = null;
  e.on('statusChange', (s) => { status = s; });
  await e._enumerateCameras();
  await e.startMonitoring();
  check('refuses to open the built-in', opened.length === 0, `opens: ${JSON.stringify(opened)}`);
  check('explains why', /not found/i.test(status?.detail || ''), (status?.detail || '').slice(0, 58));
  e.stopMonitoring();
}

console.log('\n4. explicit opt-in to the built-in');
{
  const Engine = scenario([MACBOOK]);
  const e = new Engine({ videoElement: null, allowBuiltInFallback: true });
  await e._enumerateCameras();
  await e.startMonitoring();
  check('allowBuiltInFallback honoured', opened[0] === 'mac-1', `opens: ${JSON.stringify(opened)}`);
  e.stopMonitoring();
}

console.log('\n5. constraint satisfied by the WRONG device');
{
  const Engine = scenario([MACBOOK, IPHONE], { trackLabelOverride: 'MacBook Air Camera' });
  const e = new Engine({ videoElement: null });
  let status = null;
  e.on('statusChange', (s) => { status = s; });
  await e._enumerateCameras();
  await e.startMonitoring();
  check('rejects the wrong stream', e.activeCameraLabel === null, String(e.activeCameraLabel));
  check('says what it got instead', /came back as/i.test(status?.detail || ''), (status?.detail || '').slice(0, 68));
  e.stopMonitoring();
}

console.log('\n' + (process.exitCode ? 'FAILURES' : 'all camera-selection checks passed'));
