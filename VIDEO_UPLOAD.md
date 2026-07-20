# Patch the Web video upload package

## Final assets

- Video: `submission-assets/patch-the-web-demo.mp4`
- Runtime: 2:56.00
- Format: 1536×864 (16:9) H.264 High, 30 fps, AAC-LC
- Audio target: normalized to −16 LUFS with −1.5 dBTP ceiling
- Size: 9,989,164 bytes
- SHA-256: `14E66B641E41E4161780B2B5E1D354ED8CB41D87F3592333D4487BFAE9881316`
- Thumbnail: `submission-assets/patch-the-web-youtube-thumbnail.png` (1280×720)
- Captions: `submission-assets/patch-the-web-demo.srt`
- Narration source: `submission-assets/live-demo-narration.txt`
- Recording style: one uninterrupted live browser session; the real extension popup is synchronized over the same continuous page timeline

## YouTube title

Patch the Web — Fix Websites You Don’t Own | OpenAI Build Week 2026

## YouTube description

Patch the Web lets people add safe, reusable features to websites they do not control.

One person describes a missing capability to GPT-5.6 through Codex. The Patch the Web authoring skill inspects the live DOM and screenshots, maps the need to a constrained transformation DSL, validates policy and scope, and runs browser tests. The resulting community patch is deterministic and domain-scoped. Everyone else installs it without AI, an account, or an API key.

The flagship MetroCare patch adds private search, combined access filters, and keyboard-accessible provider comparison to a realistic healthcare directory. The Compatibility Sentinel verifies exact patch bytes and live selectors every six hours, quarantining repairs when the original website changes underneath them.

Current release evidence: 44 unit/policy tests + 20 desktop/mobile browser journeys + 6 packaged-extension integrations pass (70 total). Eight additional post-deploy axe scans across four production surfaces report zero automated WCAG A/AA violations.

Live product: https://patch-the-web.vercel.app/
Flagship demo: https://patch-the-web.vercel.app/care/
Compatibility Sentinel: https://patch-the-web.vercel.app/sentinel/
Source and Build Week record: https://github.com/abbasaliii/patch-the-web
Verified v0.8.0 release: https://github.com/abbasaliii/patch-the-web/releases/tag/v0.8.0

Built with GPT-5.6 and Codex for OpenAI Build Week 2026. The healthcare directory and providers are fictional demonstration data; this is not medical guidance.

## Chapters

```text
0:00 Start at the public Patch the Web site
0:12 Download and verify the extension
0:29 Open the original MetroCare directory
0:44 Discover a verified community repair
1:02 Install the domain-scoped patch
1:41 Use the live comparison feature
1:57 Filter twelve services to one
2:12 Reload and prove preferences persist
2:27 Review the active repair and permissions
2:39 How GPT-5.6 and Codex power community authoring
```

## Upload settings

- Visibility: Public
- Audience: No, it is not made for kids
- Category: Science & Technology
- Language: English
- License: Standard YouTube License
- Allow embedding: Yes
- Paid promotion: No
- Synthetic content disclosure: Narration uses the local Microsoft Zira text-to-speech voice; the product interactions are real recordings of the working build
- Music: None

After upload, add the public URL to `SUBMISSION.md` and the Devpost video field, then verify playback in a signed-out browser.
