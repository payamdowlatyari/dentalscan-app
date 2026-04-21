# Technical & UX Audit — DentalScan AI

## UX Observations

The 5-angle capture flow is intuitive — labeling each view (Front, Left, Right, Upper, Lower) reduces ambiguity. However, there is no real-time guidance telling users whether they are positioned correctly. Without a visual overlay, patients frequently hold phones too far, too close, or off-center, leading to poor-quality images and repeated attempts.

Step progression is unclear; a simple "Step 2/5" label is easy to miss. A progress bar and per-step thumbnail strip would give stronger spatial context. After completing all captures, the "Scan Complete" screen is static — there is no feedback about upload status or next steps.

## Technical Challenges — Mobile Camera Stability

1. **Auto-focus hunting**: On many mobile devices the rear/front camera continuously re-focuses, causing blurry frames. Locking focus via `MediaTrackConstraints` (`focusMode: "manual"`) or averaging multiple frames could mitigate this.
2. **Orientation & aspect ratio**: Users rotate phones mid-scan. The capture canvas must account for `videoWidth`/`videoHeight` swaps; listening to the `deviceorientation` event or the `Screen Orientation API` is essential.
3. **Low-light noise**: Dental scans often happen under mixed lighting. Applying a brightness/contrast normalization pass (canvas `filter` or WebGL) before sending images to the AI backend would improve consistency.
4. **Frame-rate drops on older devices**: Running face-detection on every `requestAnimationFrame` can saturate the main thread. Throttling detection to every 3rd frame or offloading to a Web Worker with `OffscreenCanvas` would help.

## Recommendations

- Add a mouth-shaped guide overlay with color-coded quality feedback (implemented).
- Surface real-time distance/centering cues so users self-correct before capture.
- Show upload progress and a clear success/error state after the final step.
- Provide a messaging channel so patients can immediately contact the clinic post-scan.
