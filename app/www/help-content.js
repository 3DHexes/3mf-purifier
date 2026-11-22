// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Przemysław Słowiński (3DHexes). Additional terms apply, see NOTICE.
// Treść okna pomocy w pięciu językach.
// Znaczniki {{...}} zależą od systemu (Windows, Linux, macOS) i są podmieniane w helpFor().

const ui = (s) => `<span class="ui">${s}</span>`;

const en = {
  title: '3MF Purifier help',
  toc: 'Contents',
  sections: [
    ['what', 'What it does', `
<p>A project saved in OrcaSlicer, Snapmaker Orca or Bambu Studio is a 3MF file that holds more than the model. It also stores your printer profile, process settings and filament presets, and sometimes G-code. If you send that file to someone else, their slicer may switch to your printer or ask about presets it does not know.</p>
<p>3MF Purifier makes a copy of the file with those settings removed. The original file is never changed. It can also turn a project into a plain 3MF that PrusaSlicer, Cura and other slicers open without errors.</p>`],
    ['start', 'Quick start', `
<ol>
<li>Add files. Drag .3mf files or a whole folder into the window, or use the ${ui('Files')} and ${ui('Folder')} buttons.{{dropExe}}</li>
<li>Pick a mode with the buttons at the top: ${ui('No filaments')}, ${ui('With filaments')} or ${ui('Universal')}.</li>
<li>Look at the panel on the right. It lists what will be removed from the selected file.</li>
<li>If you want, set your own thumbnail, author and license.</li>
<li>Click ${ui('Clean files')}. When it is done, ${ui('Show in folder')} opens the result. A ⚠ next to "done" means the file was saved with a warning; the right panel says what it is.</li>
</ol>
<p>The + in the empty preview also opens the file picker. The × on a row removes that file from the list, and ${ui('Clear list')} removes all of them. The files on your disk stay where they are.</p>
<p>Each result goes to a <code>Cleaned_[model name]</code> folder next to the original. <code>Tile.3mf</code> becomes <code>Cleaned_Tile{{sep}}Tile.3mf</code>, and the Universal mode adds <code>Tile_universal.3mf</code> in the same folder.</p>
<p>Files dragged into the window are an exception. {{dropWhy}} which folder a dragged file came from, so their results go to the folder shown under the ${ui('Clean files')} button (<code>Documents{{sep}}3MF Purifier</code> by default). Click ${ui('Change')} next to it to pick another folder. If you want the results next to the originals, add the files with the ${ui('Files')} or ${ui('Folder')} button instead.</p>`],
    ['modes', 'The three modes', `
<h3>No filaments</h3>
<p>The copy has no slicer settings at all. Whoever opens it prints with their own printer, process and filaments. For OrcaSlicer and Bambu Studio users this is the safe choice.</p>
<h3>With filaments</h3>
<p>The copy also keeps the filament list: color, type, vendor and preset name for each slot. It is stored in the Publish 3MF format.</p>
<p>OrcaSlicer 2.5 and newer apply these colors and types to the customer's own filament slots and leave their printer and process alone. If a slot holds the wrong type, for example PETG when the file asks for PLA, Orca swaps in a filament of the right type. Snapmaker Orca, older Orca versions and Bambu Studio load the geometry only, the same as in the first mode.</p>
<h3>Universal</h3>
<p>A plain 3MF that follows the basic 3MF standard. Use it for people with PrusaSlicer, Cura or any program that shows an error or an empty plate when it opens an OrcaSlicer or Bambu Studio project.</p>
<p>Color painting and the extruder of each part are saved the way PrusaSlicer reads them, so a PrusaSlicer user with a multi-material printer gets the colors in place. Cura ignores the painting and loads the shape.</p>
<p>Modifiers, negative parts and support blockers are left out, because other slicers would print them as solid parts. If a file has negative parts, you get a warning, since its shape can differ from the project.</p>
<p>A project with several plates becomes one file per plate, each moved onto the print area. Turn off ${ui('One file per plate')} to keep everything in one file with the original layout.</p>
<p>Turn on ${ui('Also save Universal 3MF')} if you want both versions at once. The two Orca modes then also write the <code>_universal.3mf</code> file in the same run.</p>
<p class="tip">${ui('No filaments')} and ${ui('With filaments')} write the same file, so running one replaces the result of the other. ${ui('Universal')} writes its own file next to it.</p>`],
    ['removed', 'What gets removed', `
<ul>
<li>the printer, process and filament profile (<code>project_settings.config</code>)</li>
<li>user presets embedded in the project</li>
<li>G-code and slicing data, such as slice info and statistics</li>
<li>color changes and pauses set at a given layer height</li>
<li>variable layer height</li>
<li>the PrusaSlicer profile</li>
<li>settings attached to a single object or part, for example more walls or denser infill on one object</li>
<li>full paths of the source files, if your slicer saved them; only the file name stays, so your user name and folders do not travel with the file</li>
<li>MakerWorld print profile data: the profile title, cover, user name and user ID</li>
</ul>
<p>If your file uses modifiers that should still work for the customer, turn on ${ui('Keep per-object settings')}. A modifier without its settings does nothing.</p>`],
    ['kept', 'What stays', `
<ul>
<li>the geometry</li>
<li>object and part names, modifiers and negative parts (not in Universal)</li>
<li>extruder assignment and color painting</li>
<li>plate layout and plate previews</li>
<li>the model title, designer, license and copyright</li>
</ul>`],
    ['author', 'Author and license', `
<p>Turn on ${ui('Author and license')} above the ${ui('Clean files')} button and fill in the author, the license and the copyright line. The app writes them into every file it cleans. OrcaSlicer and Bambu Studio show them in the project info, and Universal files carry them in the standard 3MF fields.</p>
<p>An empty field leaves the value the file already has. Use this for your own models only. When you clean a file made by someone else, keep it off, and the designer and license stay as their author set them.</p>`],
    ['thumb', 'Thumbnail', `
<p>The Thumbnail card shows the image the file already has. To use your own, click ${ui('Choose image…')} or drop a PNG, JPG, WebP, BMP, GIF or AVIF file onto the window. The app saves it as two square PNGs, 512×512 and 128×128 px.</p>
<p>${ui('Fill')} crops the picture to a square. ${ui('Fit')} shows the whole picture with transparent margins. ${ui('Use for all files')} gives every file in the list the same picture. ${ui('Use original')} goes back to the image from the file.</p>
<p>${ui('From 3D view')} makes the thumbnail from the 3D preview. It keeps the angle you set, frames the whole model and puts it on a light background, so the picture reads well in the slicer and in the file list. The camera button in the top right corner of the preview does the same.</p>
<p>The image becomes the 3MF cover that {{coverApps}} show. OrcaSlicer keeps it when the customer saves the project again. Plate previews are not changed. A Universal file gets your image as its standard 3MF thumbnail; without one it uses the cover or the plate preview from the project.</p>`],
    ['preview', '3D preview', `
<p>Drag with the left mouse button to rotate, with the right button to pan, and use the wheel to zoom. The mesh button shows the triangles and the arrow button resets the view.</p>
<p>In ${ui('No filaments')} and ${ui('Universal')} mode the slots are grey, because the customer's slicer will set the colors. In ${ui('With filaments')} mode you see the filament colors stored in the file.</p>
<p>After cleaning, the ${ui('Source / Result')} switch shows the saved file, read back from disk.</p>
<p>If a painted triangle is split into areas of different colors, the preview shows the color that covers most of it. The file keeps the full painting.</p>`],
    ['customers', 'What to tell your customers', `
<p>OrcaSlicer and Bambu Studio users should open the file with ${ui('File → Import')}, not ${ui('Open Project')}. If the slicer asks, they pick ${ui('Import geometry only')}. Orca may say the file comes from an older version and will load geometry only. That message is expected and does no harm.</p>
<p>PrusaSlicer, Cura and other slicers should get the <code>_universal.3mf</code> file. PrusaSlicer users with more than one extruder will see the painting; Cura users get the shapes. If you sell files on a store, put both versions in the package.</p>`],
    ['notes', 'Good to know', `
<ul>
{{unsigned}}
{{runtime}}
<li>The app works offline. Nothing is uploaded; it only opens the links you click.</li>
<li>The first start is in English; after that the app opens in the language you chose last. Every start begins in ${ui('With filaments')} mode. Your author and license, the output folder for dragged files and the switches are remembered.</li>
<li>Before you send a batch to customers, open one cleaned file in your own slicer and check it.</li>
<li>The language switch is in the top right corner of the main window.</li>
</ul>`],
  ],
  footer: '3MF Purifier is made by 3DHexes: Storytelling Printable Scenery.',
  version: 'Version',
  os: {
    win: {
      runtime: `<li>The app uses Microsoft Edge WebView2, which comes with Windows 11 and up-to-date Windows 10. If the window stays empty, install the WebView2 Runtime from Microsoft's website.</li>`,
      dropExe: ' You can also drop files onto 3MF Purifier.exe.',
      sep: '\\', dropWhy: 'Windows does not tell the app', coverApps: 'OrcaSlicer, Bambu Studio and Windows Explorer',
      unsigned: `<li>The exe is not signed, so Windows may block it the first time. Click ${ui('More info')}, then ${ui('Run anyway')}.</li>`,
    },
    linux: {
      runtime: '',
      dropExe: '', sep: '/', dropWhy: 'The system does not tell the app', coverApps: 'OrcaSlicer and Bambu Studio',
      unsigned: '<li>The app needs WebKitGTK 4.1, which most desktops already have. If it does not start, install <code>libwebkit2gtk-4.1-0</code> (Ubuntu, Debian, Mint), <code>webkit2gtk4.1</code> (Fedora) or <code>webkit2gtk-4.1</code> (Arch, Manjaro, Garuda).</li>',
    },
  },
};

const pl = {
  title: 'Pomoc 3MF Purifier',
  toc: 'Spis treści',
  sections: [
    ['what', 'Do czego to służy', `
<p>Projekt zapisany w OrcaSlicerze, Snapmaker Orca albo Bambu Studio to plik 3MF, w którym oprócz modelu siedzi profil drukarki, ustawienia procesu, presety filamentów, a czasem też G-code. Jeśli wyślesz taki plik komuś innemu, jego slicer może przełączyć się na twoją drukarkę albo pytać o presety, których nie zna.</p>
<p>3MF Purifier robi kopię pliku bez tych ustawień. Oryginalny plik zostaje nietknięty. Program potrafi też zamienić projekt w zwykły 3MF, który PrusaSlicer, Cura i inne slicery otwierają bez błędów.</p>`],
    ['start', 'Szybki start', `
<ol>
<li>Dodaj pliki. Przeciągnij pliki .3mf albo cały folder do okna albo użyj przycisków ${ui('Pliki')} i ${ui('Folder')}.{{dropExe}}</li>
<li>Wybierz tryb przyciskami na górze: ${ui('Bez filamentów')}, ${ui('Z filamentami')} albo ${ui('Uniwersalny')}.</li>
<li>Zajrzyj do panelu po prawej. Pokazuje, co zostanie usunięte z zaznaczonego pliku.</li>
<li>Jeśli chcesz, ustaw własną miniaturę, autora i licencję.</li>
<li>Kliknij ${ui('Wyczyść pliki')}. Po zakończeniu ${ui('Pokaż w folderze')} otwiera wynik. Znak ⚠ przy "gotowe" oznacza, że plik zapisano z ostrzeżeniem; jego treść jest w panelu po prawej.</li>
</ol>
<p>Plus na pustym podglądzie też otwiera wybór plików. Krzyżyk w wierszu usuwa plik z listy, a ${ui('Wyczyść listę')} usuwa wszystkie. Pliki na dysku zostają na miejscu.</p>
<p>Każdy wynik trafia do folderu <code>Cleaned_[nazwa modelu]</code> obok oryginału. Z <code>Kafel.3mf</code> powstaje <code>Cleaned_Kafel{{sep}}Kafel.3mf</code>, a tryb uniwersalny dokłada w tym samym folderze <code>Kafel_universal.3mf</code>.</p>
<p>Wyjątkiem są pliki przeciągnięte do okna. {{dropWhy}}, z jakiego folderu pochodzi przeciągnięty plik, więc ich wyniki trafiają do folderu pokazanego pod przyciskiem ${ui('Wyczyść pliki')} (domyślnie <code>Dokumenty{{sep}}3MF Purifier</code>). Przycisk ${ui('Zmień')} obok pozwala wybrać inny folder. Jeśli wyniki mają leżeć obok oryginałów, dodaj pliki przyciskiem ${ui('Pliki')} albo ${ui('Folder')}.</p>`],
    ['modes', 'Trzy tryby', `
<h3>Bez filamentów</h3>
<p>Kopia nie ma żadnych ustawień slicera. Kto ją otworzy, drukuje na swojej drukarce, ze swoim procesem i filamentami. Dla użytkowników OrcaSlicera i Bambu Studio to bezpieczny wybór.</p>
<h3>Z filamentami</h3>
<p>Kopia zachowuje dodatkowo listę filamentów: kolor, typ, producenta i nazwę presetu dla każdego slotu. Lista jest zapisana w formacie Publish 3MF.</p>
<p>OrcaSlicer 2.5 i nowszy nakłada te kolory i typy na sloty klienta, a jego drukarki i procesu nie rusza. Jeśli w slocie jest zły typ, na przykład PETG, a plik wymaga PLA, Orca podmieni go na filament właściwego typu. Snapmaker Orca, starsze wersje Orca i Bambu Studio wczytają samą geometrię, tak jak w pierwszym trybie.</p>
<h3>Uniwersalny</h3>
<p>Zwykły 3MF zgodny z podstawowym standardem 3MF. Przyda się osobom z PrusaSlicerem, Curą albo programem, który przy projekcie z OrcaSlicera lub Bambu Studio pokazuje błąd albo pustą płytę.</p>
<p>Malowanie kolorem i extruder każdej części są zapisane tak, jak czyta je PrusaSlicer, więc użytkownik PrusaSlicera z drukarką wielomateriałową dostaje kolory na miejscu. Cura malowanie pomija i wczytuje sam kształt.</p>
<p>Modyfikatory, części ujemne i blokery podpór są pomijane, bo inne slicery wydrukowałyby je jako zwykłe bryły. Jeśli plik ma części ujemne, dostaniesz ostrzeżenie, bo jego kształt może różnić się od projektu.</p>
<p>Projekt z kilkoma płytami daje osobny plik dla każdej płyty, przesunięty na pole druku. Wyłącz ${ui('Osobny plik dla każdej płyty')}, żeby zapisać wszystko w jednym pliku z oryginalnym układem.</p>
<p>Włącz ${ui('Zapisz też wersję Uniwersalną')}, jeśli chcesz mieć obie wersje naraz. Tryby dla Orki zapiszą wtedy w tym samym przebiegu także plik <code>_universal.3mf</code>.</p>
<p class="tip">${ui('Bez filamentów')} i ${ui('Z filamentami')} zapisują ten sam plik, więc jeden tryb nadpisze wynik drugiego. ${ui('Uniwersalny')} zapisuje własny plik obok.</p>`],
    ['removed', 'Co jest usuwane', `
<ul>
<li>profil drukarki, procesu i filamentów (<code>project_settings.config</code>)</li>
<li>presety użytkownika dołączone do projektu</li>
<li>G-code i dane z cięcia, np. informacje o płytach i statystyki</li>
<li>zmiany koloru i pauzy ustawione na konkretnej wysokości</li>
<li>zmienna wysokość warstwy</li>
<li>profil PrusaSlicera</li>
<li>ustawienia przypisane do jednego obiektu lub części, np. więcej ścian albo gęstsze wypełnienie w jednym obiekcie</li>
<li>pełne ścieżki plików źródłowych, jeśli slicer je zapisał; zostaje sama nazwa pliku, więc nazwa twojego konta i folderów nie idzie razem z plikiem</li>
<li>dane profilu druku z MakerWorld: tytuł profilu, okładka, nazwa i ID użytkownika</li>
</ul>
<p>Jeśli plik ma modyfikatory, które mają działać u klienta, włącz ${ui('Zachowaj ustawienia per obiekt')}. Modyfikator bez swoich ustawień nic nie zmienia.</p>`],
    ['kept', 'Co zostaje', `
<ul>
<li>geometria</li>
<li>nazwy obiektów i części, modyfikatory i części ujemne (poza trybem uniwersalnym)</li>
<li>przypisanie extruderów i malowanie kolorem</li>
<li>układ na płycie i podglądy płyt</li>
<li>tytuł modelu, autor, licencja i prawa autorskie</li>
</ul>`],
    ['author', 'Autor i licencja', `
<p>Włącz ${ui('Autor i licencja')} nad przyciskiem ${ui('Wyczyść pliki')} i wpisz autora, licencję oraz informację o prawach autorskich. Program zapisze je w każdym czyszczonym pliku. OrcaSlicer i Bambu Studio pokazują je w informacjach o projekcie, a pliki uniwersalne mają je w standardowych polach 3MF.</p>
<p>Puste pole zostawia wartość, którą plik już ma. Używaj tego tylko dla własnych modeli. Kiedy czyścisz cudzy plik, zostaw tę opcję wyłączoną, a autor i licencja zostaną takie, jak ustawił je twórca.</p>`],
    ['thumb', 'Miniatura', `
<p>Karta Miniatura pokazuje obraz, który plik już ma. Żeby ustawić własny, kliknij ${ui('Wybierz obraz…')} albo upuść na okno plik PNG, JPG, WebP, BMP, GIF lub AVIF. Program zapisze go jako dwa kwadratowe PNG: 512×512 i 128×128 px.</p>
<p>${ui('Wypełnij')} przycina obraz do kwadratu. ${ui('Dopasuj')} pokazuje cały obraz z przezroczystymi marginesami. ${ui('Użyj dla wszystkich')} ustawia ten sam obraz każdemu plikowi na liście. ${ui('Przywróć oryginalną')} wraca do obrazu z pliku.</p>
<p>${ui('Z widoku 3D')} robi miniaturę z podglądu 3D. Zachowuje ustawiony kąt, kadruje cały model i kładzie go na jasnym tle, więc obrazek jest czytelny w slicerze i na liście plików. To samo robi przycisk z aparatem w prawym górnym rogu podglądu.</p>
<p>Obraz staje się okładką 3MF, którą pokazują {{coverApps}}. OrcaSlicer zachowa ją, kiedy klient zapisze projekt u siebie. Podglądy płyt się nie zmieniają. Plik uniwersalny dostaje twój obraz jako standardową miniaturę 3MF; bez niego bierze okładkę albo podgląd płyty z projektu.</p>`],
    ['preview', 'Podgląd 3D', `
<p>Lewym przyciskiem myszy obracasz model, prawym przesuwasz, kółkiem przybliżasz. Przycisk z siatką pokazuje trójkąty, a strzałka przywraca widok.</p>
<p>W trybach ${ui('Bez filamentów')} i ${ui('Uniwersalny')} sloty są szare, bo kolory nada slicer klienta. W trybie ${ui('Z filamentami')} widać kolory filamentów zapisane w pliku.</p>
<p>Po czyszczeniu przełącznik ${ui('Źródło / Wynik')} pokazuje zapisany plik, wczytany z powrotem z dysku.</p>
<p>Jeśli pomalowany trójkąt jest podzielony na obszary w różnych kolorach, podgląd pokazuje kolor, który zajmuje jego największą część. W pliku malowanie zostaje w całości.</p>`],
    ['customers', 'Co przekazać klientom', `
<p>Użytkownicy OrcaSlicera i Bambu Studio powinni otwierać plik przez ${ui('Plik → Importuj')} (File → Import), a nie ${ui('Otwórz projekt')}. Jeśli slicer zapyta, wybierają ${ui('Importuj tylko geometrię')} (Import geometry only). Orca może napisać, że plik pochodzi ze starszej wersji i wczyta tylko geometrię. Ten komunikat jest spodziewany i niczemu nie szkodzi.</p>
<p>PrusaSlicer, Cura i inne slicery powinny dostać plik <code>_universal.3mf</code>. Użytkownicy PrusaSlicera z kilkoma extruderami zobaczą malowanie, a użytkownicy Cury dostaną kształty. Jeśli sprzedajesz pliki w sklepie, dołącz do paczki obie wersje.</p>`],
    ['notes', 'Warto wiedzieć', `
<ul>
{{unsigned}}
{{runtime}}
<li>Aplikacja działa bez internetu. Niczego nie wysyła; otwiera tylko linki, które klikniesz.</li>
<li>Pierwsze uruchomienie jest po angielsku, później aplikacja otwiera się w ostatnio wybranym języku. Każde uruchomienie zaczyna się w trybie ${ui('Z filamentami')}. Autor i licencja, folder dla przeciągniętych plików i przełączniki są zapamiętywane.</li>
<li>Zanim wyślesz klientom całą paczkę, otwórz jeden wyczyszczony plik we własnym slicerze i sprawdź go.</li>
<li>Przełącznik języka jest w prawym górnym rogu głównego okna.</li>
</ul>`],
  ],
  footer: '3MF Purifier to aplikacja od 3DHexes: Storytelling Printable Scenery.',
  version: 'Wersja',
  os: {
    win: {
      runtime: `<li>Aplikacja korzysta z Microsoft Edge WebView2, który jest w Windows 11 i w aktualnym Windows 10. Jeśli okno zostaje puste, zainstaluj WebView2 Runtime ze strony Microsoftu.</li>`,
      dropExe: ' Pliki możesz też upuścić na 3MF Purifier.exe.',
      sep: '\\', dropWhy: 'Windows nie przekazuje aplikacji', coverApps: 'OrcaSlicer, Bambu Studio i Eksplorator Windows',
      unsigned: `<li>Exe nie jest podpisany, więc Windows może go za pierwszym razem zablokować. Kliknij ${ui('Więcej informacji')}, a potem ${ui('Uruchom mimo to')}.</li>`,
    },
    linux: {
      runtime: '',
      dropExe: '', sep: '/', dropWhy: 'System nie przekazuje aplikacji', coverApps: 'OrcaSlicer i Bambu Studio',
      unsigned: '<li>Aplikacja potrzebuje WebKitGTK 4.1, który większość pulpitów już ma. Jeśli się nie uruchamia, zainstaluj <code>libwebkit2gtk-4.1-0</code> (Ubuntu, Debian, Mint), <code>webkit2gtk4.1</code> (Fedora) albo <code>webkit2gtk-4.1</code> (Arch, Manjaro, Garuda).</li>',
    },
  },
};

const de = {
  title: '3MF Purifier Hilfe',
  toc: 'Inhalt',
  sections: [
    ['what', 'Wofür es da ist', `
<p>Ein Projekt aus OrcaSlicer, Snapmaker Orca oder Bambu Studio ist eine 3MF-Datei, die mehr als das Modell enthält: dein Druckerprofil, die Prozesseinstellungen, Filament-Presets und manchmal G-Code. Schickst du diese Datei an jemand anderen, wechselt sein Slicer womöglich auf deinen Drucker oder fragt nach Presets, die er nicht kennt.</p>
<p>3MF Purifier erstellt eine Kopie ohne diese Einstellungen. Die Originaldatei bleibt unverändert. Das Programm kann ein Projekt außerdem in ein normales 3MF umwandeln, das PrusaSlicer, Cura und andere Slicer ohne Fehler öffnen.</p>`],
    ['start', 'Schnellstart', `
<ol>
<li>Dateien hinzufügen. Zieh .3mf-Dateien oder einen ganzen Ordner ins Fenster oder nutze die Schaltflächen ${ui('Dateien')} und ${ui('Ordner')}.{{dropExe}}</li>
<li>Wähle oben einen Modus: ${ui('Ohne Filamente')}, ${ui('Mit Filamenten')} oder ${ui('Universal')}.</li>
<li>Sieh dir das Feld rechts an. Es zeigt, was aus der gewählten Datei entfernt wird.</li>
<li>Wenn du willst, setze ein eigenes Vorschaubild, Autor und Lizenz.</li>
<li>Klicke auf ${ui('Dateien bereinigen')}. Danach öffnet ${ui('Im Ordner zeigen')} das Ergebnis. Ein ⚠ neben "fertig" heißt, dass die Datei mit einem Hinweis gespeichert wurde; das Feld rechts sagt, welcher.</li>
</ol>
<p>Das + in der leeren Vorschau öffnet ebenfalls die Dateiauswahl. Das × in einer Zeile nimmt die Datei aus der Liste, ${ui('Liste leeren')} entfernt alle. Die Dateien auf der Festplatte bleiben, wo sie sind.</p>
<p>Jedes Ergebnis landet in einem Ordner <code>Cleaned_[Modellname]</code> neben dem Original. Aus <code>Kachel.3mf</code> wird <code>Cleaned_Kachel{{sep}}Kachel.3mf</code>, der Modus Universal legt im selben Ordner <code>Kachel_universal.3mf</code> ab.</p>
<p>Ins Fenster gezogene Dateien sind die Ausnahme. {{dropWhy}}, aus welchem Ordner eine gezogene Datei stammt, deshalb landen ihre Ergebnisse in dem Ordner, der unter ${ui('Dateien bereinigen')} angezeigt wird (standardmäßig <code>Dokumente{{sep}}3MF Purifier</code>). Mit ${ui('Ändern')} wählst du einen anderen Ordner. Sollen die Ergebnisse neben den Originalen liegen, füge die Dateien über ${ui('Dateien')} oder ${ui('Ordner')} hinzu.</p>`],
    ['modes', 'Die drei Modi', `
<h3>Ohne Filamente</h3>
<p>Die Kopie enthält keinerlei Slicer-Einstellungen. Wer sie öffnet, druckt mit dem eigenen Drucker, Prozess und Filament. Für Nutzer von OrcaSlicer und Bambu Studio ist das die sichere Wahl.</p>
<h3>Mit Filamenten</h3>
<p>Die Kopie behält zusätzlich die Filamentliste: Farbe, Typ, Hersteller und Preset-Name für jeden Slot. Sie wird im Format Publish 3MF gespeichert.</p>
<p>OrcaSlicer ab 2.5 überträgt diese Farben und Typen auf die Slots des Kunden und lässt dessen Drucker und Prozess in Ruhe. Steckt im Slot der falsche Typ, etwa PETG statt PLA, setzt Orca ein Filament des richtigen Typs ein. Snapmaker Orca, ältere Orca-Versionen und Bambu Studio laden nur die Geometrie, wie im ersten Modus.</p>
<h3>Universal</h3>
<p>Ein normales 3MF nach dem 3MF-Grundstandard. Gedacht für Leute mit PrusaSlicer, Cura oder einem Programm, das bei einem Projekt aus OrcaSlicer oder Bambu Studio einen Fehler oder eine leere Platte zeigt.</p>
<p>Die Farbbemalung und der Extruder jedes Teils werden so gespeichert, wie PrusaSlicer sie liest. Wer PrusaSlicer mit einem Mehrfarbdrucker nutzt, bekommt die Farben also an der richtigen Stelle. Cura ignoriert die Bemalung und lädt die Form.</p>
<p>Modifier, negative Teile und Support-Blocker fallen weg, weil andere Slicer sie als feste Körper drucken würden. Hat eine Datei negative Teile, bekommst du einen Hinweis, denn ihre Form kann vom Projekt abweichen.</p>
<p>Ein Projekt mit mehreren Platten ergibt eine Datei pro Platte, jeweils in den Druckbereich verschoben. Schalte ${ui('Eine Datei pro Druckplatte')} aus, um alles mit der ursprünglichen Anordnung in einer Datei zu behalten.</p>
<p>Schalte ${ui('Auch Universal-3MF speichern')} ein, wenn du beide Versionen auf einmal willst. Die beiden Orca-Modi schreiben dann im selben Durchgang auch die Datei <code>_universal.3mf</code>.</p>
<p class="tip">${ui('Ohne Filamente')} und ${ui('Mit Filamenten')} schreiben dieselbe Datei, ein Modus ersetzt also das Ergebnis des anderen. ${ui('Universal')} schreibt eine eigene Datei daneben.</p>`],
    ['removed', 'Was entfernt wird', `
<ul>
<li>das Drucker-, Prozess- und Filamentprofil (<code>project_settings.config</code>)</li>
<li>im Projekt eingebettete Benutzer-Presets</li>
<li>G-Code und Slicing-Daten wie Plattenangaben und Statistiken</li>
<li>Farbwechsel und Pausen auf einer bestimmten Schichthöhe</li>
<li>variable Schichthöhe</li>
<li>das PrusaSlicer-Profil</li>
<li>Einstellungen für ein einzelnes Objekt oder Teil, zum Beispiel mehr Wände oder dichtere Füllung bei einem Objekt</li>
<li>vollständige Pfade der Quelldateien, falls dein Slicer sie gespeichert hat; nur der Dateiname bleibt, damit dein Benutzername und deine Ordner nicht mitreisen</li>
<li>Daten des MakerWorld-Druckprofils: Titel, Cover, Benutzername und Benutzer-ID</li>
</ul>
<p>Sollen Modifier in deiner Datei beim Kunden weiter wirken, schalte ${ui('Objekteinstellungen behalten')} ein. Ein Modifier ohne seine Einstellungen bewirkt nichts.</p>`],
    ['kept', 'Was bleibt', `
<ul>
<li>die Geometrie</li>
<li>Namen von Objekten und Teilen, Modifier und negative Teile (nicht im Modus Universal)</li>
<li>Extruder-Zuordnung und Farbbemalung</li>
<li>Plattenlayout und Plattenvorschauen</li>
<li>Titel, Autor, Lizenz und Copyright des Modells</li>
</ul>`],
    ['author', 'Autor und Lizenz', `
<p>Schalte ${ui('Autor und Lizenz')} über der Schaltfläche ${ui('Dateien bereinigen')} ein und trage Autor, Lizenz und Copyright ein. Das Programm schreibt sie in jede bereinigte Datei. OrcaSlicer und Bambu Studio zeigen sie in den Projektinfos, Universal-Dateien tragen sie in den Standardfeldern von 3MF.</p>
<p>Ein leeres Feld lässt den Wert stehen, den die Datei schon hat. Nutze das nur für eigene Modelle. Bereinigst du die Datei von jemand anderem, lass es aus, dann bleiben Autor und Lizenz so, wie der Urheber sie gesetzt hat.</p>`],
    ['thumb', 'Vorschaubild', `
<p>Die Karte Vorschaubild zeigt das Bild, das die Datei schon hat. Für ein eigenes klicke auf ${ui('Bild wählen…')} oder zieh eine PNG-, JPG-, WebP-, BMP-, GIF- oder AVIF-Datei aufs Fenster. Das Programm speichert es als zwei quadratische PNGs mit 512×512 und 128×128 px.</p>
<p>${ui('Füllen')} schneidet das Bild auf ein Quadrat zu. ${ui('Einpassen')} zeigt das ganze Bild mit transparenten Rändern. ${ui('Für alle Dateien verwenden')} gibt jeder Datei in der Liste dasselbe Bild. ${ui('Original verwenden')} kehrt zum Bild aus der Datei zurück.</p>
<p>${ui('Aus 3D-Ansicht')} erstellt das Vorschaubild aus der 3D-Vorschau. Der eingestellte Blickwinkel bleibt, das ganze Modell kommt ins Bild und liegt auf einem hellen Hintergrund, damit es im Slicer und in der Dateiliste gut lesbar ist. Die Kamera-Schaltfläche oben rechts in der Vorschau macht dasselbe.</p>
<p>Das Bild wird zum 3MF-Cover, das {{coverApps}} anzeigen. OrcaSlicer behält es, wenn der Kunde das Projekt erneut speichert. Plattenvorschauen ändern sich nicht. Eine Universal-Datei bekommt dein Bild als normales 3MF-Vorschaubild; ohne eigenes Bild nimmt sie das Cover oder die Plattenvorschau aus dem Projekt.</p>`],
    ['preview', '3D-Vorschau', `
<p>Mit der linken Maustaste drehst du, mit der rechten verschiebst du, mit dem Mausrad zoomst du. Die Netz-Schaltfläche zeigt die Dreiecke, der Pfeil setzt die Ansicht zurück.</p>
<p>In den Modi ${ui('Ohne Filamente')} und ${ui('Universal')} sind die Slots grau, weil der Slicer des Kunden die Farben setzt. Im Modus ${ui('Mit Filamenten')} siehst du die in der Datei gespeicherten Filamentfarben.</p>
<p>Nach dem Bereinigen zeigt der Schalter ${ui('Quelle / Ergebnis')} die gespeicherte Datei, frisch von der Festplatte gelesen.</p>
<p>Ist ein bemaltes Dreieck in verschiedenfarbige Bereiche geteilt, zeigt die Vorschau die Farbe, die den größten Teil bedeckt. Die Datei behält die vollständige Bemalung.</p>`],
    ['customers', 'Was du deinen Kunden sagst', `
<p>Wer OrcaSlicer oder Bambu Studio nutzt, öffnet die Datei über ${ui('Datei → Importieren')}, nicht über ${ui('Projekt öffnen')}. Fragt der Slicer nach, wählt man ${ui('Nur Geometrie importieren')}. Orca meldet eventuell, die Datei stamme aus einer älteren Version und es werde nur Geometrie geladen. Diese Meldung ist erwartet und schadet nicht.</p>
<p>PrusaSlicer, Cura und andere Slicer sollten die Datei <code>_universal.3mf</code> bekommen. PrusaSlicer-Nutzer mit mehreren Extrudern sehen die Bemalung, Cura-Nutzer bekommen die Formen. Verkaufst du Dateien in einem Shop, leg beide Versionen ins Paket.</p>`],
    ['notes', 'Gut zu wissen', `
<ul>
{{unsigned}}
{{runtime}}
<li>Das Programm arbeitet offline. Es lädt nichts hoch und öffnet nur Links, die du anklickst.</li>
<li>Der erste Start ist auf Englisch, danach öffnet sich das Programm in der zuletzt gewählten Sprache. Jeder Start beginnt im Modus ${ui('Mit Filamenten')}. Autor und Lizenz, der Ordner für gezogene Dateien und die Schalter werden gespeichert.</li>
<li>Bevor du ein ganzes Paket verschickst, öffne eine bereinigte Datei in deinem eigenen Slicer und prüfe sie.</li>
<li>Die Sprachwahl ist oben rechts im Hauptfenster.</li>
</ul>`],
  ],
  footer: '3MF Purifier stammt von 3DHexes: Storytelling Printable Scenery.',
  version: 'Version',
  os: {
    win: {
      runtime: `<li>Das Programm nutzt Microsoft Edge WebView2, das in Windows 11 und aktuellem Windows 10 enthalten ist. Bleibt das Fenster leer, installiere die WebView2 Runtime von der Microsoft-Website.</li>`,
      dropExe: ' Du kannst Dateien auch auf 3MF Purifier.exe ziehen.',
      sep: '\\', dropWhy: 'Windows teilt dem Programm nicht mit', coverApps: 'OrcaSlicer, Bambu Studio und der Windows Explorer',
      unsigned: `<li>Die exe ist nicht signiert, daher blockiert Windows sie womöglich beim ersten Start. Klicke auf ${ui('Weitere Informationen')} und dann auf ${ui('Trotzdem ausführen')}.</li>`,
    },
    linux: {
      runtime: '',
      dropExe: '', sep: '/', dropWhy: 'Das System teilt dem Programm nicht mit', coverApps: 'OrcaSlicer und Bambu Studio',
      unsigned: '<li>Das Programm braucht WebKitGTK 4.1, das die meisten Desktops schon haben. Startet es nicht, installiere <code>libwebkit2gtk-4.1-0</code> (Ubuntu, Debian, Mint), <code>webkit2gtk4.1</code> (Fedora) oder <code>webkit2gtk-4.1</code> (Arch, Manjaro, Garuda).</li>',
    },
  },
};

const fr = {
  title: 'Aide de 3MF Purifier',
  toc: 'Sommaire',
  sections: [
    ['what', 'À quoi ça sert', `
<p>Un projet enregistré dans OrcaSlicer, Snapmaker Orca ou Bambu Studio est un fichier 3MF qui contient plus que le modèle : votre profil d’imprimante, les réglages d’impression, les préréglages de filaments et parfois du G-code. Si vous envoyez ce fichier à quelqu’un, son slicer peut basculer sur votre imprimante ou réclamer des préréglages qu’il ne connaît pas.</p>
<p>3MF Purifier crée une copie sans ces réglages. Le fichier original n’est jamais modifié. Le programme peut aussi transformer un projet en 3MF standard que PrusaSlicer, Cura et d’autres slicers ouvrent sans erreur.</p>`],
    ['start', 'Démarrage rapide', `
<ol>
<li>Ajoutez des fichiers. Glissez des fichiers .3mf ou un dossier entier dans la fenêtre, ou utilisez les boutons ${ui('Fichiers')} et ${ui('Dossier')}.{{dropExe}}</li>
<li>Choisissez un mode avec les boutons du haut : ${ui('Sans filaments')}, ${ui('Avec filaments')} ou ${ui('Universel')}.</li>
<li>Regardez le panneau de droite. Il indique ce qui sera supprimé du fichier sélectionné.</li>
<li>Si vous le souhaitez, définissez votre miniature, l’auteur et la licence.</li>
<li>Cliquez sur ${ui('Nettoyer les fichiers')}. Ensuite, ${ui('Afficher dans le dossier')} ouvre le résultat. Un ⚠ à côté de "terminé" signifie que le fichier a été enregistré avec un avertissement ; le panneau de droite indique lequel.</li>
</ol>
<p>Le + de l’aperçu vide ouvre aussi le choix des fichiers. Le × d’une ligne retire ce fichier de la liste, et ${ui('Vider la liste')} les retire tous. Les fichiers sur le disque restent à leur place.</p>
<p>Chaque résultat va dans un dossier <code>Cleaned_[nom du modèle]</code> à côté de l’original. <code>Tuile.3mf</code> devient <code>Cleaned_Tuile{{sep}}Tuile.3mf</code>, et le mode Universel ajoute <code>Tuile_universal.3mf</code> dans le même dossier.</p>
<p>Les fichiers glissés dans la fenêtre font exception. {{dropWhy}} de quel dossier vient un fichier glissé, donc leurs résultats vont dans le dossier affiché sous le bouton ${ui('Nettoyer les fichiers')} (<code>Documents{{sep}}3MF Purifier</code> par défaut). Le bouton ${ui('Modifier')} permet d’en choisir un autre. Pour garder les résultats à côté des originaux, ajoutez les fichiers avec ${ui('Fichiers')} ou ${ui('Dossier')}.</p>`],
    ['modes', 'Les trois modes', `
<h3>Sans filaments</h3>
<p>La copie n’a aucun réglage de slicer. Celui qui l’ouvre imprime avec sa propre imprimante, ses réglages et ses filaments. Pour les utilisateurs d’OrcaSlicer et de Bambu Studio, c’est le choix sûr.</p>
<h3>Avec filaments</h3>
<p>La copie garde aussi la liste des filaments : couleur, type, fabricant et nom du préréglage pour chaque emplacement. Elle est enregistrée au format Publish 3MF.</p>
<p>OrcaSlicer 2.5 et plus récent applique ces couleurs et types aux emplacements du client sans toucher à son imprimante ni à ses réglages. Si un emplacement contient le mauvais type, par exemple du PETG quand le fichier demande du PLA, Orca le remplace par un filament du bon type. Snapmaker Orca, les anciennes versions d’Orca et Bambu Studio chargent seulement la géométrie, comme dans le premier mode.</p>
<h3>Universel</h3>
<p>Un 3MF standard qui suit la norme 3MF de base. Utile pour les personnes qui ont PrusaSlicer, Cura ou un programme qui affiche une erreur ou un plateau vide avec un projet OrcaSlicer ou Bambu Studio.</p>
<p>La peinture couleur et l’extrudeur de chaque pièce sont enregistrés comme PrusaSlicer les lit : un utilisateur de PrusaSlicer avec une imprimante multi-matériaux retrouve donc les couleurs au bon endroit. Cura ignore la peinture et charge la forme.</p>
<p>Les modificateurs, pièces négatives et bloqueurs de supports sont laissés de côté, car d’autres slicers les imprimeraient comme des pièces pleines. Si un fichier a des pièces négatives, vous recevez un avertissement, car sa forme peut différer du projet.</p>
<p>Un projet à plusieurs plateaux donne un fichier par plateau, chacun déplacé dans la zone d’impression. Désactivez ${ui('Un fichier par plateau')} pour tout garder dans un seul fichier avec la disposition d’origine.</p>
<p>Activez ${ui('Enregistrer aussi en 3MF universel')} pour obtenir les deux versions d’un coup. Les deux modes Orca écrivent alors aussi le fichier <code>_universal.3mf</code> dans le même passage.</p>
<p class="tip">${ui('Sans filaments')} et ${ui('Avec filaments')} écrivent le même fichier, un mode remplace donc le résultat de l’autre. ${ui('Universel')} écrit son propre fichier à côté.</p>`],
    ['removed', 'Ce qui est supprimé', `
<ul>
<li>le profil d’imprimante, d’impression et de filaments (<code>project_settings.config</code>)</li>
<li>les préréglages utilisateur intégrés au projet</li>
<li>le G-code et les données de découpe, comme les infos de plateau et les statistiques</li>
<li>les changements de couleur et pauses à une hauteur donnée</li>
<li>la hauteur de couche variable</li>
<li>le profil PrusaSlicer</li>
<li>les réglages propres à un objet ou une pièce, par exemple plus de parois ou un remplissage plus dense sur un objet</li>
<li>les chemins complets des fichiers sources si votre slicer les a enregistrés ; seul le nom reste, pour que votre nom d’utilisateur et vos dossiers ne voyagent pas avec le fichier</li>
<li>les données du profil d’impression MakerWorld : titre, couverture, nom et identifiant de l’utilisateur</li>
</ul>
<p>Si vos modificateurs doivent continuer à fonctionner chez le client, activez ${ui('Garder les réglages par objet')}. Un modificateur sans ses réglages ne fait rien.</p>`],
    ['kept', 'Ce qui reste', `
<ul>
<li>la géométrie</li>
<li>les noms des objets et pièces, les modificateurs et pièces négatives (sauf en mode Universel)</li>
<li>l’attribution des extrudeurs et la peinture couleur</li>
<li>la disposition des plateaux et leurs aperçus</li>
<li>le titre, l’auteur, la licence et le copyright du modèle</li>
</ul>`],
    ['author', 'Auteur et licence', `
<p>Activez ${ui('Auteur et licence')} au-dessus du bouton ${ui('Nettoyer les fichiers')} et indiquez l’auteur, la licence et la mention de copyright. Le programme les écrit dans chaque fichier nettoyé. OrcaSlicer et Bambu Studio les affichent dans les infos du projet, et les fichiers universels les portent dans les champs standard du 3MF.</p>
<p>Un champ vide garde la valeur déjà présente dans le fichier. Réservez cette option à vos propres modèles. Quand vous nettoyez le fichier de quelqu’un d’autre, laissez-la désactivée : l’auteur et la licence restent tels que le créateur les a définis.</p>`],
    ['thumb', 'Miniature', `
<p>La carte Miniature montre l’image que le fichier possède déjà. Pour utiliser la vôtre, cliquez sur ${ui('Choisir une image…')} ou déposez un fichier PNG, JPG, WebP, BMP, GIF ou AVIF sur la fenêtre. Le programme l’enregistre en deux PNG carrés de 512×512 et 128×128 px.</p>
<p>${ui('Remplir')} recadre l’image en carré. ${ui('Ajuster')} montre l’image entière avec des marges transparentes. ${ui('Utiliser pour les fichiers')} donne la même image à tous les fichiers de la liste. ${ui('Utiliser l’originale')} revient à l’image du fichier.</p>
<p>${ui('Depuis la vue 3D')} crée la miniature à partir de l’aperçu 3D. L’angle choisi est conservé, le modèle entier est cadré et posé sur un fond clair, pour rester lisible dans le slicer et dans la liste des fichiers. Le bouton appareil photo en haut à droite de l’aperçu fait la même chose.</p>
<p>L’image devient la couverture 3MF affichée par {{coverApps}}. OrcaSlicer la conserve quand le client réenregistre le projet. Les aperçus des plateaux ne changent pas. Un fichier universel reçoit votre image comme miniature 3MF standard ; sans image, il reprend la couverture ou l’aperçu du plateau du projet.</p>`],
    ['preview', 'Aperçu 3D', `
<p>Bouton gauche de la souris pour tourner, bouton droit pour déplacer, molette pour zoomer. Le bouton maillage affiche les triangles et la flèche rétablit la vue.</p>
<p>En modes ${ui('Sans filaments')} et ${ui('Universel')}, les emplacements sont gris, car le slicer du client choisira les couleurs. En mode ${ui('Avec filaments')}, vous voyez les couleurs de filaments enregistrées dans le fichier.</p>
<p>Après le nettoyage, le sélecteur ${ui('Source / Résultat')} montre le fichier enregistré, relu depuis le disque.</p>
<p>Si un triangle peint est divisé en zones de couleurs différentes, l’aperçu montre la couleur qui en couvre la plus grande partie. Le fichier garde la peinture complète.</p>`],
    ['customers', 'Ce qu’il faut dire à vos clients', `
<p>Les utilisateurs d’OrcaSlicer et de Bambu Studio doivent ouvrir le fichier avec ${ui('Fichier → Importer')}, et non ${ui('Ouvrir un projet')}. Si le slicer le demande, ils choisissent ${ui('Importer uniquement la géométrie')}. Orca peut indiquer que le fichier vient d’une version plus ancienne et ne chargera que la géométrie. Ce message est normal et sans conséquence.</p>
<p>PrusaSlicer, Cura et les autres slicers doivent recevoir le fichier <code>_universal.3mf</code>. Les utilisateurs de PrusaSlicer avec plusieurs extrudeurs verront la peinture, ceux de Cura auront les formes. Si vous vendez des fichiers sur une boutique, mettez les deux versions dans le paquet.</p>`],
    ['notes', 'Bon à savoir', `
<ul>
{{unsigned}}
{{runtime}}
<li>Le programme fonctionne hors ligne. Il n’envoie rien et ouvre seulement les liens sur lesquels vous cliquez.</li>
<li>Le premier lancement est en anglais ; ensuite, le programme s’ouvre dans la dernière langue choisie. Chaque lancement démarre en mode ${ui('Avec filaments')}. L’auteur et la licence, le dossier des fichiers glissés et les interrupteurs sont mémorisés.</li>
<li>Avant d’envoyer un lot à vos clients, ouvrez un fichier nettoyé dans votre propre slicer et vérifiez-le.</li>
<li>Le choix de la langue se trouve en haut à droite de la fenêtre principale.</li>
</ul>`],
  ],
  footer: '3MF Purifier est une application de 3DHexes : Storytelling Printable Scenery.',
  version: 'Version',
  os: {
    win: {
      runtime: `<li>Le programme utilise Microsoft Edge WebView2, inclus dans Windows 11 et dans Windows 10 à jour. Si la fenêtre reste vide, installez WebView2 Runtime depuis le site de Microsoft.</li>`,
      dropExe: ' Vous pouvez aussi déposer des fichiers sur 3MF Purifier.exe.',
      sep: '\\', dropWhy: 'Windows n’indique pas au programme', coverApps: 'OrcaSlicer, Bambu Studio et l’Explorateur Windows',
      unsigned: `<li>L’exe n’est pas signé, Windows peut donc le bloquer au premier lancement. Cliquez sur ${ui('Informations complémentaires')}, puis sur ${ui('Exécuter quand même')}.</li>`,
    },
    linux: {
      runtime: '',
      dropExe: '', sep: '/', dropWhy: 'Le système n’indique pas au programme', coverApps: 'OrcaSlicer et Bambu Studio',
      unsigned: '<li>Le programme a besoin de WebKitGTK 4.1, présent sur la plupart des bureaux. S’il ne démarre pas, installez <code>libwebkit2gtk-4.1-0</code> (Ubuntu, Debian, Mint), <code>webkit2gtk4.1</code> (Fedora) ou <code>webkit2gtk-4.1</code> (Arch, Manjaro, Garuda).</li>',
    },
  },
};

const es = {
  title: 'Ayuda de 3MF Purifier',
  toc: 'Contenido',
  sections: [
    ['what', 'Para qué sirve', `
<p>Un proyecto guardado en OrcaSlicer, Snapmaker Orca o Bambu Studio es un archivo 3MF que contiene más que el modelo: tu perfil de impresora, los ajustes de impresión, los perfiles de filamento y a veces G-code. Si envías ese archivo a otra persona, su slicer puede cambiar a tu impresora o pedir perfiles que no conoce.</p>
<p>3MF Purifier crea una copia sin esos ajustes. El archivo original nunca se modifica. También puede convertir un proyecto en un 3MF estándar que PrusaSlicer, Cura y otros slicers abren sin errores.</p>`],
    ['start', 'Inicio rápido', `
<ol>
<li>Añade archivos. Arrastra archivos .3mf o una carpeta entera a la ventana, o usa los botones ${ui('Archivos')} y ${ui('Carpeta')}.{{dropExe}}</li>
<li>Elige un modo con los botones de arriba: ${ui('Sin filamentos')}, ${ui('Con filamentos')} o ${ui('Universal')}.</li>
<li>Mira el panel de la derecha. Muestra qué se eliminará del archivo seleccionado.</li>
<li>Si quieres, pon tu propia miniatura, autor y licencia.</li>
<li>Haz clic en ${ui('Limpiar archivos')}. Al terminar, ${ui('Mostrar en la carpeta')} abre el resultado. Un ⚠ junto a "listo" significa que el archivo se guardó con un aviso; el panel de la derecha dice cuál.</li>
</ol>
<p>El + de la vista vacía también abre la selección de archivos. La × de una fila quita ese archivo de la lista y ${ui('Vaciar lista')} los quita todos. Los archivos del disco se quedan donde están.</p>
<p>Cada resultado va a una carpeta <code>Cleaned_[nombre del modelo]</code> junto al original. <code>Losa.3mf</code> se convierte en <code>Cleaned_Losa{{sep}}Losa.3mf</code>, y el modo Universal añade <code>Losa_universal.3mf</code> en la misma carpeta.</p>
<p>Los archivos arrastrados a la ventana son la excepción. {{dropWhy}} de qué carpeta viene un archivo arrastrado, así que sus resultados van a la carpeta que aparece bajo el botón ${ui('Limpiar archivos')} (<code>Documentos{{sep}}3MF Purifier</code> por defecto). Con ${ui('Cambiar')} eliges otra. Si quieres los resultados junto a los originales, añade los archivos con ${ui('Archivos')} o ${ui('Carpeta')}.</p>`],
    ['modes', 'Los tres modos', `
<h3>Sin filamentos</h3>
<p>La copia no tiene ningún ajuste del slicer. Quien la abra imprime con su propia impresora, sus ajustes y sus filamentos. Para quien usa OrcaSlicer o Bambu Studio es la opción segura.</p>
<h3>Con filamentos</h3>
<p>La copia conserva además la lista de filamentos: color, tipo, fabricante y nombre del perfil de cada ranura. Se guarda en el formato Publish 3MF.</p>
<p>OrcaSlicer 2.5 o posterior aplica esos colores y tipos a las ranuras del cliente y no toca su impresora ni sus ajustes. Si una ranura tiene el tipo equivocado, por ejemplo PETG cuando el archivo pide PLA, Orca la cambia por un filamento del tipo correcto. Snapmaker Orca, las versiones antiguas de Orca y Bambu Studio cargan solo la geometría, igual que en el primer modo.</p>
<h3>Universal</h3>
<p>Un 3MF estándar que sigue la norma básica de 3MF. Sirve para quien usa PrusaSlicer, Cura o un programa que muestra un error o una placa vacía al abrir un proyecto de OrcaSlicer o Bambu Studio.</p>
<p>La pintura de color y el extrusor de cada pieza se guardan como los lee PrusaSlicer, así que un usuario de PrusaSlicer con una impresora multimaterial recibe los colores en su sitio. Cura ignora la pintura y carga la forma.</p>
<p>Los modificadores, las piezas negativas y los bloqueadores de soportes se omiten, porque otros slicers los imprimirían como piezas sólidas. Si un archivo tiene piezas negativas, verás un aviso, ya que su forma puede diferir del proyecto.</p>
<p>Un proyecto con varias placas da un archivo por placa, cada uno movido al área de impresión. Desactiva ${ui('Un archivo por placa')} para guardar todo en un solo archivo con la distribución original.</p>
<p>Activa ${ui('Guardar también 3MF universal')} si quieres las dos versiones a la vez. Los dos modos de Orca escribirán entonces también el archivo <code>_universal.3mf</code> en la misma pasada.</p>
<p class="tip">${ui('Sin filamentos')} y ${ui('Con filamentos')} escriben el mismo archivo, así que un modo sustituye el resultado del otro. ${ui('Universal')} escribe su propio archivo al lado.</p>`],
    ['removed', 'Qué se elimina', `
<ul>
<li>el perfil de impresora, impresión y filamentos (<code>project_settings.config</code>)</li>
<li>los perfiles de usuario incluidos en el proyecto</li>
<li>el G-code y los datos de laminado, como la información de placas y las estadísticas</li>
<li>los cambios de color y pausas a una altura concreta</li>
<li>la altura de capa variable</li>
<li>el perfil de PrusaSlicer</li>
<li>los ajustes de un solo objeto o pieza, por ejemplo más paredes o un relleno más denso en un objeto</li>
<li>las rutas completas de los archivos de origen, si tu slicer las guardó; queda solo el nombre, para que tu usuario y tus carpetas no viajen con el archivo</li>
<li>los datos del perfil de impresión de MakerWorld: título, portada, nombre e ID del usuario</li>
</ul>
<p>Si tu archivo usa modificadores que deben seguir funcionando para el cliente, activa ${ui('Conservar ajustes por objeto')}. Un modificador sin sus ajustes no hace nada.</p>`],
    ['kept', 'Qué se conserva', `
<ul>
<li>la geometría</li>
<li>los nombres de objetos y piezas, los modificadores y las piezas negativas (no en Universal)</li>
<li>la asignación de extrusores y la pintura de color</li>
<li>la distribución de las placas y sus vistas previas</li>
<li>el título, el autor, la licencia y el copyright del modelo</li>
</ul>`],
    ['author', 'Autor y licencia', `
<p>Activa ${ui('Autor y licencia')} encima del botón ${ui('Limpiar archivos')} y escribe el autor, la licencia y el copyright. El programa los guarda en cada archivo que limpia. OrcaSlicer y Bambu Studio los muestran en la información del proyecto, y los archivos universales los llevan en los campos estándar de 3MF.</p>
<p>Un campo vacío deja el valor que el archivo ya tiene. Úsalo solo para tus propios modelos. Cuando limpies el archivo de otra persona, déjalo desactivado y el autor y la licencia quedarán como los puso su creador.</p>`],
    ['thumb', 'Miniatura', `
<p>La tarjeta Miniatura muestra la imagen que ya tiene el archivo. Para usar la tuya, haz clic en ${ui('Elegir imagen…')} o suelta un archivo PNG, JPG, WebP, BMP, GIF o AVIF en la ventana. El programa la guarda como dos PNG cuadrados de 512×512 y 128×128 px.</p>
<p>${ui('Rellenar')} recorta la imagen a un cuadrado. ${ui('Ajustar')} muestra la imagen entera con márgenes transparentes. ${ui('Usar en los archivos')} pone la misma imagen a todos los archivos de la lista. ${ui('Usar la original')} vuelve a la imagen del archivo.</p>
<p>${ui('Desde vista 3D')} crea la miniatura a partir de la vista 3D. Mantiene el ángulo elegido, encuadra el modelo entero y lo pone sobre un fondo claro, para que se vea bien en el slicer y en la lista de archivos. El botón de cámara en la esquina superior derecha de la vista hace lo mismo.</p>
<p>La imagen se convierte en la portada del 3MF que muestran {{coverApps}}. OrcaSlicer la conserva cuando el cliente vuelve a guardar el proyecto. Las vistas de las placas no cambian. Un archivo universal recibe tu imagen como miniatura 3MF estándar; sin ella, usa la portada o la vista de la placa del proyecto.</p>`],
    ['preview', 'Vista 3D', `
<p>Arrastra con el botón izquierdo del ratón para girar, con el derecho para desplazar y usa la rueda para acercar. El botón de malla muestra los triángulos y la flecha restablece la vista.</p>
<p>En los modos ${ui('Sin filamentos')} y ${ui('Universal')} las ranuras son grises, porque los colores los pondrá el slicer del cliente. En el modo ${ui('Con filamentos')} ves los colores de filamento guardados en el archivo.</p>
<p>Después de limpiar, el selector ${ui('Origen / Resultado')} muestra el archivo guardado, leído de nuevo desde el disco.</p>
<p>Si un triángulo pintado está dividido en zonas de distintos colores, la vista muestra el color que cubre la mayor parte. El archivo conserva la pintura completa.</p>`],
    ['customers', 'Qué decir a tus clientes', `
<p>Quien use OrcaSlicer o Bambu Studio debe abrir el archivo con ${ui('Archivo → Importar')}, no con ${ui('Abrir proyecto')}. Si el slicer pregunta, elige ${ui('Importar solo la geometría')}. Orca puede avisar de que el archivo viene de una versión anterior y que cargará solo la geometría. Ese mensaje es normal y no hace daño.</p>
<p>PrusaSlicer, Cura y otros slicers deberían recibir el archivo <code>_universal.3mf</code>. Los usuarios de PrusaSlicer con varios extrusores verán la pintura; los de Cura tendrán las formas. Si vendes archivos en una tienda, incluye las dos versiones en el paquete.</p>`],
    ['notes', 'Conviene saber', `
<ul>
{{unsigned}}
{{runtime}}
<li>El programa funciona sin conexión. No sube nada y solo abre los enlaces en los que haces clic.</li>
<li>El primer inicio es en inglés; después el programa se abre en el último idioma elegido. Cada inicio empieza en el modo ${ui('Con filamentos')}. El autor y la licencia, la carpeta de archivos arrastrados y los interruptores se recuerdan.</li>
<li>Antes de enviar un lote a tus clientes, abre un archivo limpio en tu propio slicer y revísalo.</li>
<li>El selector de idioma está en la esquina superior derecha de la ventana principal.</li>
</ul>`],
  ],
  footer: '3MF Purifier es una aplicación de 3DHexes: Storytelling Printable Scenery.',
  version: 'Versión',
  os: {
    win: {
      runtime: `<li>El programa usa Microsoft Edge WebView2, incluido en Windows 11 y en Windows 10 actualizado. Si la ventana queda vacía, instala WebView2 Runtime desde la web de Microsoft.</li>`,
      dropExe: ' También puedes soltar archivos sobre 3MF Purifier.exe.',
      sep: '\\', dropWhy: 'Windows no le dice al programa', coverApps: 'OrcaSlicer, Bambu Studio y el Explorador de Windows',
      unsigned: `<li>El exe no está firmado, así que Windows puede bloquearlo la primera vez. Haz clic en ${ui('Más información')} y luego en ${ui('Ejecutar de todas formas')}.</li>`,
    },
    linux: {
      runtime: '',
      dropExe: '', sep: '/', dropWhy: 'El sistema no le dice al programa', coverApps: 'OrcaSlicer y Bambu Studio',
      unsigned: '<li>El programa necesita WebKitGTK 4.1, que la mayoría de escritorios ya tiene. Si no arranca, instala <code>libwebkit2gtk-4.1-0</code> (Ubuntu, Debian, Mint), <code>webkit2gtk4.1</code> (Fedora) o <code>webkit2gtk-4.1</code> (Arch, Manjaro, Garuda).</li>',
    },
  },
};

export const HELP = { en, pl, de, fr, es };

// os: wartość NL_OS (Windows, Linux, Darwin). macOS korzysta z tekstów linuksowych.
export function helpFor(lang, os) {
  const h = HELP[lang] || HELP.en;
  const key = /^(linux|darwin)/i.test(os || '') ? 'linux' : 'win';
  const vals = h.os[key];
  const fill = (s) => s.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vals ? vals[k] : m));
  return { ...h, sections: h.sections.map(([id, title, html]) => [id, title, fill(html)]) };
}
