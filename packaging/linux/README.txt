3MF Purifier 1.0.1
==================

Running (Linux, x64 or arm64)
- Unpack the archive, open a terminal in the unpacked folder and run ./install.sh.
  It copies the app to ~/.local/bin and adds "3MF Purifier" to the app menu.
  No sudo needed. ./uninstall.sh removes it again.
- To try it without installing, run ./3mf-purifier in the same folder.
- The app needs WebKitGTK 4.1, which GNOME, KDE and most desktops already have.
  If it is missing, install libwebkit2gtk-4.1-0 (Ubuntu, Debian, Mint),
  webkit2gtk4.1 (Fedora) or webkit2gtk-4.1 (Arch, Manjaro, Garuda).
- Settings are stored in ~/.local/share, not next to the app.

The EN / PL / DE / FR / ES switch is in the top-right corner. English on the first start,
then the language you chose last. Every start begins in "With filaments" mode.
Help: the HELP button next to the logo opens a window with the full guide.

Adding files
- drag .3mf files or a folder into the window,
- or use the "Files" / "Folder" buttons,
- or open them with 3MF Purifier from the file manager (after ./install.sh).

Modes (buttons at the top)
- No filaments: a copy without any slicer settings.
- With filaments: also keeps filament colors and types in the Publish 3MF format.
  OrcaSlicer 2.5+ applies them to the customer's slots and keeps their own printer
  and process. Snapmaker Orca, older Orca, Bambu Studio and other slicers load the
  geometry only.
- Universal: a plain 3MF for PrusaSlicer, Cura and other slicers that cannot open
  OrcaSlicer or Bambu Studio projects. Color painting and part extruders are saved
  the way PrusaSlicer reads them. Modifiers, negative parts and support blockers
  are left out. A project with several plates becomes one file per plate
  ("One file per plate" switch).

Output: a "Cleaned_[model name]" folder next to each file, e.g. Tile.3mf ->
Cleaned_Tile/Tile.3mf.
Files dragged into the window go to the folder shown under the Clean button
(Documents/3MF Purifier by default, "Change" picks another), because the system
does not tell the app where a dragged file came from. No filaments and With filaments
write the same file, so the last run wins. Universal writes Tile_universal.3mf next to it
(Tile_plate1_universal.3mf, Tile_plate2_universal.3mf... for several plates).
With "Also save Universal 3MF" turned on, the two Orca modes write both files in one run.

Removed: printer and process profile, embedded presets, G-code and slicing data,
color changes at height, variable layer height, PrusaSlicer profile,
per-object settings (unless "Keep per-object settings" is on), full paths of source
files (only the file name stays), MakerWorld print profile author data.
Unchanged: geometry, names, parts, modifiers (not in Universal), extruders, color painting,
plate layout, thumbnails, model title, designer and license. Original files are never modified.

Author and license (switch above the Clean button)
- writes your author name, license and copyright into every cleaned file,
- shown in the project info of OrcaSlicer and Bambu Studio,
- empty fields leave the file's own values; use it for your own models only.

Custom thumbnail
- select a file and click "Choose image…" in the Thumbnail card (or drop an image onto the window),
- PNG, JPG, WebP, BMP, GIF or AVIF; saved as square PNGs 512x512 and 128x128,
- "Fill" crops the image to a square, "Fit" keeps the whole image with transparent margins,
- "Use for all files" applies the same image to every file in the list,
- "From 3D view" renders the model from the preview angle, framed, on a light background,
- it becomes the 3MF cover shown by OrcaSlicer and Bambu Studio,
  and OrcaSlicer keeps it when the project is saved again; plate previews are not changed.

3D preview
- left mouse: rotate, right mouse: pan, wheel: zoom,
- in "No filaments" and "Universal" modes slots are shown in shades of grey (the customer's slicer sets the colors),
- after cleaning, the "Source / Result" switch shows the output file,
- the mesh button shows triangles, the arrow button resets the view.

License: GNU GPL v3.0 with additional terms, see LICENSE.txt and NOTICE.txt.
Source code: https://github.com/3DHexes/3mf-purifier
Third-party licenses: THIRD-PARTY-LICENSES.txt.

3DHexes
- MyMiniFactory: https://www.myminifactory.com/profile/3DHexes
- Discord: https://discord.gg/MfkejWQZ4D
- Kickstarter: https://www.kickstarter.com/profile/3dhexes/created
- Ko-fi: https://ko-fi.com/3dhexes
