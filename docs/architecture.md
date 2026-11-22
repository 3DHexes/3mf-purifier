# Architecture and technical notes

This document explains how 3MF Purifier works inside: what it removes from a 3MF file and why, how the Publish 3MF and Universal formats are written, how the app is built and how it was tested. For a user-level overview see the [README](../README.md).

Targets: **Windows 10/11 x64** (main) and **Linux x64 / arm64**, built from the same code. A macOS build is not published because it has not been tested yet.

---

## 1. Purpose

3MF Purifier was written by 3DHexes, a one-person studio that sells 3D-printable tabletop terrain on MyMiniFactory, Kickstarter and Patreon. Print projects exported from OrcaSlicer or Snapmaker Orca carry the author's printer profile, process settings, filament presets and sometimes G-code. When customers open such a file, their slicer switches to the author's printer or asks about presets it doesn't know. The tool strips that and leaves a clean file.

It is a free download for creators and for their customers, who can also use it on 3MF files from MakerWorld, Printables and other sites.

Earlier internal builds were a Go command-line tool and then an Electron app (146 MB). The current Neutralino app is about 5 MB as an exe and 1.9 MB zipped.

---

## 2. What the user sees

One window with a header bar, a file list (left), a 3D preview (center) and a details/actions panel (right). Dark GNOME/libadwaita-inspired look, magenta accent from the 3DHexes logo, bundled Ubuntu Sans font.

### 2.1 Adding files
- Drag & drop of files or folders onto the window (HTML5 drag & drop, see 4.6).
- "Files" / "Folder" buttons (native dialogs) and a clickable "+" hexagon in the empty preview.
- Command-line arguments / dropping files onto the exe icon.
- Folders are scanned recursively for `*.3mf`; subfolders named `Cleaned_*` (previous output) are skipped.

### 2.2 Three modes (segmented control in the header)
| Mode | Output | Intended slicer |
|---|---|---|
| **No filaments** | Same 3MF with all slicer settings removed | OrcaSlicer, Bambu Studio (geometry, parts, painting kept) |
| **With filaments** | As above, plus the filament list (color, type, vendor, preset name) written in OrcaSlicer's "Publish 3MF" format | OrcaSlicer 2.5+ applies colors/types to the customer's slots; other slicers load geometry only |
| **Universal** | A new, plain 3MF (3MF Core spec, no Production Extension), color painting converted to the PrusaSlicer attribute | PrusaSlicer (with painting and per-part extruders), Cura and any other 3MF reader |

### 2.3 Options (above the main button)
- **Keep per-object settings** (No filaments / With filaments): keeps per-object/per-part overrides in `model_settings.config` (needed when modifiers should still work).
- **Also save Universal 3MF** (No filaments / With filaments, default off): writes the Universal copy in the same run. Its result, warnings and errors are shown in a separate "Universal copy" block; a failed copy does not mark the Orca file as failed.
- **One file per plate** (Universal only, default on): multi-plate projects produce one file per plate.
- **Author and license** (off by default): a dialog with Author, License (suggestions: "Personal use only", CC BY-NC 4.0, CC BY-NC-SA 4.0, CC BY 4.0) and Copyright. Written into every cleaned file. Intended for the user's own models only; the UI says so.

### 2.4 Details panel (per selected file)
- Printer / process profile found in the file (struck through: will be removed).
- Filament list (kept or removed depending on mode).
- "To be removed" list: grouped archive entries, per-object override keys, privacy items (absolute source paths, MakerWorld profile author data), and in Universal mode dropped modifiers/negative parts.
- "Unchanged" list.
- Thumbnail card: current cover image, "Choose image…", "From 3D view", Fill / Fit, "Use for all files", "Use original". "From 3D view" (also a camera button in the viewer) renders the model in a separate 1024×1024 WebGL context: same view direction as the preview, camera framed on a sample of up to 20 000 vertices so the model fills about 86% of the frame, light radial-gradient background, grid hidden.
- Neutral note when the file contains sliced G-code (it is removed in every mode).
- After cleaning: result card with output path(s), size before → after, warnings, and a prominent "Show in folder" button.

### 2.5 3D preview
three.js r187, WebGL. Orbit / pan / zoom, wireframe toggle, reset view, Source / Result switch (Result re-reads the written file from disk). Painted triangles are shown with the color of the dominant sub-area. In "With filaments" mode slots use the file's filament colors, otherwise neutral greys.

### 2.6 Other UI
- Languages: English, Polish, German, French, Spanish, switched in the header. The first start is in English, later starts use the last chosen language.
- Every start begins in "With filaments" mode. The mode is not remembered; author/license, drop folder and the switches are.
- HELP button opens a separate native window (Neutralino `window.create`) with a full guide in the selected language and the app version (read from `NL_APPVERSION`). Fallback: an in-page iframe overlay.
- Credits card with links: MyMiniFactory, Discord, Kickstarter, and a full-width "Buy me a coffee on Ko-fi" button (https://ko-fi.com/3dhexes). Links open in the default browser.
- Output folder for drag-and-dropped files (default `Documents\3MF Purifier`, changeable).

---

## 3. Output rules

- Source `X.3mf` (or `X.gcode.3mf`) → folder `Cleaned_X` next to the source.
- No filaments / With filaments → `Cleaned_X\X.3mf` (both modes write the same file; the last run wins).
- Universal → `Cleaned_X\X_universal.3mf`, or `X_plate1_universal.3mf`, `X_plate2_universal.3mf`, … when split per plate.
- Files that came in through drag & drop: `<drop folder>\<relative subfolder if a folder was dropped>\Cleaned_X\...` (reason in 4.6).
- Writes go to `<name>.tmp` first, then the old file is removed and the temp file renamed.
- The original file is never written to.

---

## 4. Architecture

### 4.1 Stack
- **Neutralino.js 6.10.0** (native binary) + client library 6.5.0, built with neu CLI 11.8.0. On Windows the UI runs in **Microsoft Edge WebView2** (part of Windows 11, installed on current Windows 10).
- Resources (`www/`) are embedded into the exe (`neu build --embed-resources`). neu also patches exe icon and version info (FileVersion/ProductVersion 1.0.1, CompanyName 3DHexes).
- No server-side component, no network access except opening links in the browser.
- Vendored JS libraries: three.js r187 (+ OrbitControls), fflate 0.8.3 (ZIP). Fonts: Ubuntu Sans (woff2). Licenses in `THIRD-PARTY-LICENSES.txt`.
- Plain ES modules, no bundler, no framework.

### 4.2 Files (`app/`)
| File | Role |
|---|---|
| `neutralino.config.json` | App id `com.3dhexes.purifier`, window 1320×840 (min 1040×640), `tokenSecurity: one-time`, `dataLocation/storageLocation: system`, `emitDropEvents: false`, native allow list narrowed to the exact calls used: `os.getPath, os.showOpenDialog, os.showFolderDialog, os.execCommand, os.open`, `filesystem.readBinaryFile, writeBinaryFile, appendBinaryFile, getStats, createDirectory, readDirectory, remove, move`, `server.mount`, `storage.getData/setData`, `window.create`, `events.on`, `app.exit`, `debug.log` |
| `www/index.html` | Main window markup, CSP (`default-src 'self'`, `connect-src ws://127.0.0.1:*` for the Neutralino socket) |
| `www/app.js` | UI state, file list, details panel, three.js viewer, drag & drop, thumbnails, run loop, author dialog, test hooks |
| `www/platform.js` | `window.api`: everything native (dialogs, file read/write, folder scan, worker jobs, prefs via `Neutralino.storage`, show in folder, help window, links) |
| `www/worker.js` | Module Web Worker: `analyze`, `preview`, `clean` jobs, so the UI never blocks |
| `www/core/purify.js` | Cleaning engine for the Orca modes; analysis; Publish 3MF; thumbnail relations; privacy and author metadata |
| `www/core/universal.js` | Universal 3MF writer (parsing, flattening, paint conversion, plates, PrusaSlicer config) |
| `www/core/preview.js` | Fast mesh extraction for the viewer (components, transforms, extruders, paint decode) |
| `www/thumb.js` | Image decode and resize to 512×512 and 128×128 PNG (OffscreenCanvas, Fill/Fit) |
| `www/i18n.js`, `www/i18n-more.js` | UI strings EN/PL and DE/FR/ES; plural helpers |
| `www/help.html`, `help.js`, `help-content.js`, `help.css` | Help window; content in 5 languages with `{{placeholders}}` for OS-specific sentences |
| `www/styles.css` | All styling |

### 4.3 Data flow for one file
1. `platform.readBytes(path)`: the file's folder is mounted with `Neutralino.server.mount` and fetched over the built-in HTTP server (fast binary read). Fallback: `filesystem.readBinaryFile`. Dropped files are read from the browser `File` object.
2. Bytes are transferred to a fresh module worker (`postMessage` with transfer list).
3. The worker runs `analyzeBytes`, `buildPreviewBytes`, `cleanBytes` or `universalBytes`.
4. The zipped result comes back as a transferred buffer; `platform.clean` writes it in 4 MB chunks (`writeBinaryFile` + `appendBinaryFile`, base64 over the Neutralino WebSocket), then renames.
5. Errors cross the worker/native boundary as `Error('C3MF' + JSON{code, params, message})` and are translated in the UI (`e.*` / `w.*` keys).

### 4.4 Settings storage
`Neutralino.storage` key `prefs` (JSON): lang, keepObj, alsoUni, splitPlates, author {on, Designer, License, Copyright}, dropDir. Stored under the user profile (AppData), not next to the exe. `localStorage` is not used because the server port is random (port 0), which changes the origin on every start.

### 4.5 Help window
`Neutralino.window.create('/help.html?lang=..')` spawns a second instance of the binary in window mode. `help.js` calls `Neutralino.init()` itself in that case. Language changes in the main window are sent to the embedded overlay via `postMessage`; the separate window keeps the language it was opened with.

### 4.6 Drag & drop (important design decision)
Neutralino's native `emitDropEvents` does not work on Windows: `RegisterDragDrop` is registered on the parent HWND while the WebView2 child window covers it, so drops never arrive. The app therefore uses HTML5 drag & drop (`DataTransferItem.webkitGetAsEntry`, recursive directory traversal). The browser exposes file contents but not file paths, so results of dropped files go to a configurable output folder instead of next to the source. This is explained in the UI and help. Files added through buttons or command line keep the "next to the original" behavior.

---

## 5. 3MF knowledge the engine relies on

### 5.1 Archive layout (OrcaSlicer / Bambu Studio)
- `3D/3dmodel.model`: root model. In Orca/Bambu projects it usually only has `<components>` pointing to `3D/Objects/object_N.model` via the Production Extension (`p:path`), plus `<build>` items with transforms.
- `Metadata/project_settings.config`: JSON with the whole printer/process/filament configuration.
- `Metadata/model_settings.config`: XML with per-object/per-part metadata (name, extruder, part subtype, overrides) and `<plate>` blocks (plate id/name, `model_instance` → object_id + instance_id).
- `Metadata/plate_N.png`, `top_N.png`, `pick_N.png`: plate previews (never touched in Orca modes).
- `_rels/.rels`, `3D/_rels/3dmodel.model.rels`, `[Content_Types].xml`.

### 5.2 Orca modes (`cleanBytes` in purify.js)
- Archive entries removed (regex `DROP_RE`, under `Metadata/`): `project_settings.config`, `(print|process|filament|machine|printer)_settings_N.config`, `slice_info.config`, `*.gcode`, `*.gcode.md5`, `*.bgcode`, `*statistics*.json`, `custom_gcode_per_layer.xml`, `layer_heights_profile.txt`, `layer_config_ranges.xml`, `Slic3r_PE.config`, `Prusa_Slicer_custom_gcode_per_print_z.xml`. Matching `<Relationship>` and `<Override>` entries are removed too.
- `model_settings.config`: `gcode_file` value emptied; all `<metadata key=..>` lines inside `<object>`/`<part>` removed except the structural keys `name, matrix, extruder, module, source_file, source_object_id, source_volume_id, source_offset_x/y/z, source_in_inches, source_in_meters` (unless "Keep per-object settings").
- Everything else is copied byte for byte (geometry files are not re-serialized). Images are stored uncompressed (level 0), other entries deflate level 6.
- **Privacy:** `source_file` values that contain a path separator are cut to the file name (Orca writes full paths only when "export sources with full path names" is on). Root-model metadata `ProfileTitle`, `ProfileCover`, `ProfileDescription`, `ProfileUserId`, `ProfileUserName` (MakerWorld print-profile data) are removed. `Designer`, `DesignerUserId`, `License`, `Copyright` are kept.
- **Author/license:** writes `<metadata name="Designer|License|Copyright">` (tag names as written by OrcaSlicer; `CopyRight` is removed when Copyright is set). Only the header of `3dmodel.model` (text before `<resources>`) is rewritten; the rest of that file is kept byte for byte.
- **Verification after zipping:** the archive is unzipped again, every entry is compared by length + CRC32, text entries are scanned for leak markers (`printer_settings_id`, `print_settings_id`, `filament_settings_id`, `printer_model"`, `inherits_group`) → warning. Publish mode also checks that `orca_published=1` exists and `Application` is gone.

### 5.3 Publish 3MF ("With filaments")
Reverse-engineered from the OrcaSlicer 2.5 source (`bbs_3mf.cpp`). In the `3dmodel.model` header:
- `orca_published` = `1`, `orca_published_keys` = `[]`
- `orca_published_material_keys` = JSON array, one entry per slot: `{material:{filament_type, filament_vendor, filament_id, setting_id:"", name}, slot, keys:[], full:false, full_keys:[], publish_type, type, publish_color, color}`
- `orca_published_config` = INI text with `filament_colour, filament_type, filament_vendor, filament_ids, filament_diameter, filament_self_index, filament_extruder_variant, wipe_tower_x/y, wipe_tower_rotation_angle`; string lists quoted like libslic3r's `escape_strings_cstyle`.
- Tags `Application`, `OrcaSlicer`, `BambuStudio:3mfVersion` removed so Orca treats the file as a published package and does not load a full project config.
Background: Orca loads `project_settings.config` as one block, so a "filaments only" config file is not possible; Publish 3MF is the only mechanism that transfers filaments without the printer.

### 5.4 Cover thumbnail
`Auxiliaries/.thumbnails/thumbnail_3mf.png` and `thumbnail_middle.png` (512 px), `thumbnail_small.png` (128 px), with relationships `…/metadata/thumbnail`, `http://schemas.bambulab.com/package/2021/cover-thumbnail-middle` and `…/cover-thumbnail-small` in `_rels/.rels`; `png` added to content types. Plate previews are not changed. OrcaSlicer keeps this cover on re-save.

### 5.5 Universal 3MF (`universalBytes` in universal.js)
- Parses all `.model` files (vertices, triangles, components with transforms, build items, header metadata) plus `model_settings.config` and `project_settings.config`.
- One output object per source build object. Its `normal_part` components are flattened into a single mesh with component transforms baked into vertex coordinates; the build item transform is kept on `<item>`. Parts with subtype `modifier_part`, `negative_part`, `support_blocker`, `support_enforcer` are dropped (warnings for modifiers and negative parts).
- **Painting:** every paint string is upper-cased (Orca and PrusaSlicer read only `A-F`) and validated with the TriangleSelector decoder; a string that does not decode to exactly its own length is dropped and counted (warning `uniBadPaint`). Valid ones are mapped `paint_color` (Orca/Bambu) → `slic3rpe:mmu_segmentation`; `paint_supports` → `slic3rpe:custom_supports`; `paint_seam` → `slic3rpe:custom_seam`. The encoding is the same TriangleSelector format (hex string read from the end; per node 2 bits split count + 2 bits state; state ≥ 3 uses `0xC` + extra nibble(s)), so strings are copied. When a part has its own extruder, unpainted leaves (state 0) of its triangles are rewritten to that extruder, and fully unpainted triangles get a full-triangle state, because after flattening state 0 would mean the object's extruder.
- `Metadata/Slic3r_PE_model.config` (PrusaSlicer format): per object `name`, `extruder`; per part a `<volume firstid lastid>` triangle range with `name`, `volume_type=ModelPart`, `matrix` (4×4 row-major, translation in the 4th column) and `extruder` when it differs from the object's.
- Header: `slic3rpe:Version3mf=1` (PrusaSlicer then treats the file as its own and reads the config), `slic3rpe:MmPaintingVersion=1` when painted, `Title`, `Designer`, `Description`, `Copyright` (from `Copyright` or `CopyRight`), `LicenseTerms` (from `License`), dates, `Application=3MF Purifier`. MakerWorld IDs and profile data are not copied.
- Thumbnail: custom image, else the plate's `plate_N.png`, else the cover from the source, as `Metadata/thumbnail.png` with the standard thumbnail relationship.
- An empty build (no printable objects) raises `uniEmpty` instead of the misleading `noModel`.
- **Plates:** items are grouped by `<plate>`/`model_instance` (Nth `<item>` of an object = instance N). With "One file per plate", plates 2+ are moved back onto the bed: Orca/Bambu lay plates in a grid with `cols = ceil(sqrt(count))` (computed as round, +1 if sqrt > round) and a gap of 1/5 of the bed size, so plate i is at `(col·W·1.2, −row·D·1.2)`, where W×D comes from `printable_area`. Without splitting, the original layout is kept (objects of later plates lie outside the bed, as in the project).
- Vertex coordinates are written with up to 6 decimals; XML is generated in ~1 MB chunks to limit memory.

### 5.6 Preview decoding (`preview.js`)
Same parser idea as Universal but builds typed arrays for three.js, sorted into one draw group per extruder slot. Paint trees are reduced to the state with the largest area share.

---

## 6. Build and packaging (Windows)

1. Edit `app/www/…`, set `version` in `neutralino.config.json`.
2. `npx neu build --embed-resources` in `app/` → `dist/3mf-purifier/3mf-purifier-win_x64.exe`.
3. Package: rename to `3MF Purifier.exe`, add `README.txt` (EN), `CZYTAJ.txt` (PL), `LICENSE.txt`, `NOTICE.txt`, `THIRD-PARTY-LICENSES.txt`, zip as `3MF-Purifier-1.0.1-windows-x64.zip`. The package texts (`README.txt`, `CZYTAJ.txt`, and for Linux `install.sh` / `uninstall.sh`) are kept in `packaging/`.
- The exe is **not code-signed** yet; SmartScreen shows "Windows protected your PC" on first run (README and help explain "More info → Run anyway"). A Certum Open Source Code Signing certificate, which requires public source, is planned.

---

## 7. Testing

The Neutralino server can run in browser mode, where the app is driven with Playwright/Chromium. URL test hooks (`test=1&files=…&mode=…&run=1&select=…&lang=…&thumb=…&split=…&author=…&help=1`) load files and click through the flow. The hooks are ignored in window mode (`NL_MODE === 'window'`), so they cannot be triggered in the shipped app.

- **Byte-level regression:** the browser engine (`purify.js`) was compared with the earlier Node/Electron implementation on 7 sample files × 2 modes × with/without thumbnail (28 combinations) plus analysis/preview output: identical. Files written by the packaged app were compared with the reference engine: identical.
- **Universal:** all outputs pass `lib3mf` 2.5 in strict mode. PrusaSlicer 2.7.2 (CLI) re-exports them with all `mmu_segmentation` strings unchanged and slices a painted two-plate test project with 4 extruders using all four extruders as painted (T0–T3, filament lengths per extruder match the paint layout); plate 2 lands on the bed.
- **"Also save Universal 3MF":** tested with a normal file, a file with invalid paint strings (dropped and reported, lower-case strings accepted) and a file whose build is empty (Orca file saved, Universal copy reported as error).
- **Drag & drop:** files and folders, including non-ASCII names.
- **UI:** all 5 languages, at 1440×880 and at the 1040 px minimum width; author dialog; help window content and version label.
- **Windows:** start, native dialogs, drag & drop and "Show in folder" checked by hand on a real machine.

### Not tested yet
- The Universal file in **Cura** and in **current PrusaSlicer 2.9.x / 3.x** (only 2.7.2 tested).
- Universal conversion of **real** multi-plate Orca/Bambu projects; the plate offset formula was checked against a synthetic project only.
- Publish 3MF colors in OrcaSlicer 2.5 for every edge case (e.g. more than 4 filaments, AMS variants).
- Cover thumbnail visibility in Windows Explorer.
- Very large files (hundreds of MB): memory use in WebView2. A 1M-triangle file converts to Universal in about 6 s.
- The German, French and Spanish texts have not been reviewed by native speakers. Corrections are welcome.

---

## 8. Known limitations and risks

- Universal drops modifiers and negative parts by design; objects with negative parts change shape (warned).
- Universal output is always a new archive, so anything not explicitly carried over (e.g. `Auxiliaries/` attachments, plate names, assemble info, text/emboss metadata, cut info) is lost.
- Very old Bambu files with 16+ filaments encoded high slot numbers differently; such paint strings fail validation and are dropped with a warning.
- A cover rendered from the 3D view is a 512 px PNG on a gradient background, which compresses poorly: about +200 KB per file (stored twice, as Orca expects).
- Plate assignment falls back to plate 1 for instances that are not listed in any `<plate>`.
- XML is handled with regular expressions and a hand-written tag scanner, not a full XML parser. Attribute lookup in `preview.js`/`universal.js` accepts single or double quotes but no spaces around `=`.
- `source_file` shortening treats any value containing `/` or `\` as a path.
- File writes are not atomic across a crash between "remove old" and "rename temp".
- Unsigned exe; WebView2 is required (missing on old Windows 10 builds without updates).
- `window.create` for help spawns a second process; it closes independently.
- The code contains macOS branches (`open -R`, help text) that are not shipped because no macOS build has been tested.

---

## 9. Links (as used in the app)
- MyMiniFactory: https://www.myminifactory.com/profile/3DHexes
- Discord: https://discord.gg/MfkejWQZ4D
- Kickstarter: https://www.kickstarter.com/profile/3dhexes/created
- Ko-fi: https://ko-fi.com/3dhexes
