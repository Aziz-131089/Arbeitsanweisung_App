# DEDAK2 – Arbeitsanweisungs-App V3.3

Mobile, deutschsprachige App zur Erstellung bebilderter Arbeitsanweisungen direkt im Browser. Mit DIN-A4-Vorschau, Bildmarkierungen, nativer Word-Datei und lokaler Entwurfssicherung. V3.3 ist ausschließlich eine technische Strukturmigration der bereits getesteten V3.2; Oberfläche, Bedienung, Datenformat und Word-Layout bleiben unverändert.

- Produktiv: https://arbeitsanweisung.dedak2.workers.dev/
- Quellcode: https://github.com/Aziz-131089/Arbeitsanweisung_App
- Ausgangsstand: Commit `071f57ae7dc24128183722ba7bc49dea81bcc274` (V3.2).

## 1. Entwicklungsstruktur

| Datei / Ordner | Aufgabe |
|---|---|
| `src/index.html` | Oberfläche und HTML-Struktur; Vorlage für den Build |
| `src/styles.css` | Responsive Oberfläche und DIN-A4-Drucklayout |
| `src/config.js` | Speicher- und Layoutkonstanten, Bildparameter, Abteilungskürzel, Hilfsfunktionen |
| `src/verteiler.js` | Verteilerauswahl und Ausgabeformat |
| `src/state.js` | Gemeinsamer Zustand, Standarddaten und Validierung/Normalisierung bestehender Entwürfe |
| `src/form.js` | Formulardaten, Status, Daten aus der Oberfläche lesen |
| `src/storage.js` | Lokaler Speicher, IndexedDB, Übernahme älterer Entwürfe, Wiederherstellung |
| `src/steps.js` | Arbeitsschritte, Reihenfolge, Kopieren, Löschen und Navigation |
| `src/bildeditor.js` | Fotos, Zoom, Ausschnitt, Markierungen, Rückgängig, Logo |
| `src/speech.js` | Optionale Spracheingabe |
| `src/document-model.js` | Gemeinsames Dokumentmodell und Bild-/Spaltenmaße |
| `src/preview.js` | Vorschau, Kopf-/Fußzeilen und A4-Seitenaufteilung |
| `src/word.js` | Native DOCX-Generierung |
| `src/export.js` | Vorschau öffnen, Druck, Download und JSON-Import/-Export |
| `src/app.js` | Ablaufsteuerung, UI-Ereignisse, Start der App, Entwurfswechsel |
| `assets/` | Einzelne bereits verwendete Layout-Ressourcen (Logo) |
| `vendor/` | Unveränderte Word-Bibliothek docx 9.6.1 inkl. Lizenz |
| `scripts/` | Build sowie einmaliger Vergleich mit V3.2 |
| `tests/` | Automatische Regressionstests |
| `.github/workflows/ci.yml` | Automatische Prüfungen bei GitHub-Push und Pull Request, ohne Deployment |
| `wrangler.jsonc` | Bestehende Cloudflare-Worker-Konfiguration |
| `package.json` / `package-lock.json` | Version, standardisierte Build- und Testbefehle |
| `CHANGELOG.md` | Änderungshistorie |

Die JS-Dateien sind fachlich getrennte Quellen mit dem bisherigen gemeinsamen Anwendungskontext. `scripts/build.mjs` legt ihre Reihenfolge fest und fügt sie zu einem unveränderten klassischen Skript zusammen. Es handelt sich bewusst noch nicht um isolierte ES-Module; eine spätere Umstellung wäre eine separate, zu testende Änderung. Neue Logik kann von nun an gezielt in der passenden Quelldatei bearbeitet werden.

## 2. Entwicklung und Build

Voraussetzung: Node.js ab Version 22. Keine npm-Pakete müssen für den Build aus dem Internet installiert werden. Die bereits erprobte Word-Bibliothek liegt separat in `vendor/`.

```sh
npm ci --ignore-scripts
npm run build
npm test
```

`npm run build` generiert zwei identische, eigenständig lauffähige HTML-Dateien in `dist/` und zusätzlich im Repository-Stammverzeichnis. Die Stammdateien ermöglichen die bisherigen GitHub-Pages-Adressen und den bisherigen Cloudflare-Build während der Übergangsphase. `dist/` wird nicht versioniert. Nur der Build schreibt diese vier Dateien; manuelle Änderungen an den generierten HTML-Dateien sind nicht vorgesehen.

Die HTML-Dateien enthalten alle Styles, den Anwendungscode, das eingebettete Logo und die Word-Bibliothek. Man kann sie weiterhin direkt im Browser öffnen. Für belastbare Tests der Browser-Speicherung und Spracheingabe dieselbe HTTPS-Testadresse nutzen, nicht wechselnde lokale Dateien.

| Befehl | Ergebnis |
|---|---|
| `npm run build` | Reproduzierbare Ausgabe aus `src/`, `assets/` und `vendor/` |
| `npm run check` | Prüft, ob `index.html` und `vorschau.html` aktuell sind |
| `npm test` | Prüft die generierten Dateien und führt die Funktionstests aus |
| `npm run verify:refactor` | Historischer V3.2-Paritätstest – nur für V3.3; bei künftigen echten Funktionsänderungen ist eine Abweichung erwünscht |

Alle fünf Testsuiten sind mit Node-Standardmitteln ausführbar. Sie prüfen unter anderem Speicher- und Datenmigration, Speichern bei knappem Speicher, Wiederherstellung, Rückgängig/Markierungen, Hochformatmaße sowie echte DOCX-Ausgabe inkl. Word-Feldern. Der Paritätstest vergleicht den SHA-256-Wert der auf V3.2 rückbeschrifteten HTML-Ausgabe mit dem bestätigten alten GitHub-Stand: Alle Bytes außer vier Versionsangaben müssen identisch sein.

## 3. Einmalige Übernahme in GitHub und Cloudflare

1. Die laufende V3.2 auf `main` nicht überschreiben. In GitHub vom aktuellen `main` den Branch `entwicklung-v3.3` erstellen (Branch-Auswahl oben links). Alle folgenden Schritte erst auf diesem Branch ausführen.
2. Das V3.3-Paket entpacken. **Alle enthaltenen Dateien und Ordner direkt auf Repository-Ebene** übernehmen, einschließlich `src/`, `assets/`, `vendor/`, `scripts/`, `tests/`, `.github/workflows/ci.yml`, `.gitignore` und `.gitattributes`. In der GitHub-Weboberfläche beim Drag-and-drop auf erhaltene Ordnerstruktur und den richtigen Branch achten. Falls die versteckten Dateien beim Entpacken/Upload fehlen, diese separat über ihren vollständigen Pfad anlegen. Alternativ kann GitHub Desktop den gesamten Ordnerinhalt übernehmen. Keine `node_modules/`, `dist/`, echten Arbeitsanweisungen, Entwürfe oder Zugangsdaten hochladen.
3. Auf dem Entwicklungsbranch committen, z. B. `V3.3 – Quellcode strukturieren und CI einrichten`. In GitHub unter **Actions** prüfen, dass beide Node-Tests grün sind (22 und 24). Falls GitHub eine erstmalige Aktivierung von Actions verlangt, diese im Repository autorisieren.
4. Die unveränderte Funktion auf einer getrennten Testadresse prüfen. Falls Cloudflare beim verbundenen Repository Vorschau-Bereitstellungen für Nicht-Produktionsbranches erzeugt, die V3.3-Vorschau verwenden. Andernfalls zunächst lokal die generierte Datei zum Sichttest öffnen und anschließend eine getrennte Testbereitstellung einrichten. Ggf. vorhandenen produktiven Entwurf zuvor über JSON sichern; Browser-Speicher verschiedener Webadressen ist getrennt.
5. Erst nach dem erfolgreichen Test und ausdrücklicher Freigabe den Entwicklungsbranch per Pull Request in `main` übernehmen. Der bisherige Cloudflare-Build, der die Stammdateien nach `dist/` kopiert, funktioniert weiterhin. Bei einem Problem auf den bekannten V3.2-Commit zurückkehren, z. B. den Merge-Commit revertieren, statt die Historie zu löschen.
6. Nach der ersten erfolgreichen Cloudflare-Bereitstellung die Worker-Einstellungen prüfen und auf den automatischen Quellcode-Build umstellen:

   | Cloudflare – Einstellungen → Builds | Wert |
   |---|---|
   | Produktions-Branch | `main` (unverändert) |
   | Build-Befehl | `npm run build` |
   | Bereitstellungsbefehl | `npx wrangler deploy` (unverändert) |
   | Stammverzeichnis | `/` (unverändert) |
   | Verzeichnis der statischen Assets | `./dist` (bereits in `wrangler.jsonc`) |

   Die Änderung wird erst beim nächsten Git-Build wirksam; die Build-Protokolle und die erreichbare Produktions-URL anschließend prüfen. GitHub Actions führt nur Tests durch; Cloudflare bleibt für die Bereitstellung zuständig. Dokumentation: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/

7. Nach Abnahme optional einen Git-Tag `v3.3.0` am freigegebenen Stand setzen. Damit ist der stabile Stand eindeutig wiederauffindbar.

## 4. Abnahmecheckliste für die V3.3-Strukturmigration

- [ ] GitHub Actions: beide Node-Versionen erfolgreich.
- [ ] Mobile Oberfläche und Kopf-/Fußdaten unverändert.
- [ ] Gesicherten V3.2-Entwurf als JSON in der Testversion importieren; Texte, Bilder, Ausschnitt, Markierungen und Verteiler stimmen überein.
- [ ] Nach Speicherung Browser schließen und erneut öffnen; letzter Entwurf ist vorhanden.
- [ ] Jeweils ein Hoch- und Querformatbild laden, bearbeiten, rückgängig machen und erneut öffnen.
- [ ] Word-Export und DIN-A4-Vorschau einer mehrseitigen AA vergleichen: Fußzeile mit `•`, Seite X / Y, Schrift, Bildgröße und ganze Schrittzeilen.
- [ ] Auf der produktiven URL nach Freigabe V3.3 prüfen; vorhandene Browser-Entwürfe bleiben über die unveränderten Speicherschlüssel zugänglich.
- [ ] Cloudflare-Build aus dem Quellcode erfolgreich.

## 5. Regeln für künftige Änderungen

- Entwicklungsbranch vom aktuellen freigegebenen Stand erstellen; nur den Quellcode ändern.
- Versionsnummer in `package.json` und Änderungsnotiz in `CHANGELOG.md` aktualisieren. UI-Versionsnummer entsteht beim Build. **Datenformatversion 3 und Speicherschlüssel nicht ohne geplante Datenmigration ändern.**
- Build ausführen, Tests bestehen lassen, generierte Stammdateien mitcommitten.
- Testversion fachlich prüfen, erst anschließend in `main` übernehmen und veröffentlichen.
- Kundenbezogene Einstellungen, zentrale Datenbank, Benutzerberechtigungen und weitere Funktionen werden in eigenen, klar abgegrenzten Arbeitspaketen umgesetzt. Diese Strukturmigration ändert sie nicht.

## 6. Datenspeicherung und Grenzen

V3.3 nutzt unverändert lokale Browserspeicherung. Aktive Entwürfe und Bilder werden nicht in GitHub oder Cloudflare gespeichert. `localStorage` ist der primäre Speicher; bei Platzmangel wird IndexedDB verwendet. JSON-Sicherungen enthalten Bilder und Markierungen. Ein Arbeitsplatzwechsel oder Löschen der Browserdaten kann lokale Entwürfe unzugänglich machen. Daher relevante Entwürfe separat sichern. Spracheingabe ist optional und abhängig vom verwendeten Browser.

Die App erstellt Arbeitsanweisungen; sie ersetzt keine fachliche Freigabe oder zentrale Dokumentenlenkung. Diese V3.3 führt keinen neuen Zugriffsschutz ein. Die bestehende firmenbezogene Voreinstellung (ESW) und das Logo sind bewusst unverändert. Für eine unternehmensübergreifende Produktversion müssen Firmen-/Layoutkonfiguration und Berechtigung separat festgelegt werden.
