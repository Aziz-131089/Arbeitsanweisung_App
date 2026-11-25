# Änderungshistorie

## V3.3.0 – Strukturmigration (Kandidat)

- Den V3.2-Code mechanisch nach Aufgaben in 13 JS-Quelldateien und eine separate CSS-Datei zerlegt; HTML-Vorlage, Logo, Word-Bibliothek und Lizenz getrennt abgelegt.
- Selbstständigen, reproduzierbaren Node-Build ohne externe Paketinstallation oder ursprüngliche Word-Vorlage eingerichtet.
- Fünf portable Regressionstests sowie eine GitHub-Actions-Prüfung (Node 22/24) und einen historischen Paritätstest hinzugefügt.
- Generierte Ausgabe nach `dist/` und in die bisherigen Stammdateien; bestehende URLs und Worker-Konfiguration bleiben kompatibel.
- Bedienung, Formatierung, Druck-/Word-Export, Datenformat und Browser-Speicherschlüssel nicht geändert. Bei Rückbeschriftung auf V3.2 ist der SHA-256-Wert der gesamten HTML-Datei exakt derselbe wie beim bestätigten GitHub-Commit.
- Keine Veröffentlichung oder Änderung der Cloudflare-Einstellungen durch das Dateipaket.

## V3.2 – Ausgangsstand (25.11.2026)

- Verteiler in der Dokument-Fußzeile mit `•` statt Kommas.
- Seitennummerierung `Seite X / Y`, 10 pt; dynamische Word-Felder beibehalten.
- Namen und Datumsangaben in normaler Schrift, Überschriften fett.
- Mehrseitiger Word-Export einer Muster-AA fachlich/visuell geprüft.

## V3.1

- Getrennte Kopf-/Fußdaten, Wiederherstellung des letzten Entwurfs, bewusster Start neuer AA.
- Feste Abteilungsauswahl und native DOCX-Ausgabe.

## V3

- Mobile Schrittansicht, Hochformat-/Querformat-Unterstützung, größere Bilder, nummerierte Markierungen, Zoom, JSON-Sicherung und lokaler Bildspeicher.
