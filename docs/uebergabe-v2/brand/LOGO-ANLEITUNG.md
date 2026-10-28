# Dispona – Logo-Paket

Logo: Wortmarke „dispona“ in **Comfortaa Bold**. Das „o“ trägt einen grünen Live-Punkt (`#5E8C6A`).
Die Schrift ist in allen SVGs **in Pfade umgewandelt**, damit das Logo überall gleich aussieht, auch ohne installierte Schrift.
Comfortaa steht unter der SIL Open Font License und ist frei für kommerzielle Nutzung.

## Dateien

| Datei | Wofür |
|---|---|
| `dispona-logo.svg` / `.png` | Hauptlogo, dunkle Schrift auf hellem Grund (Login, Kopfzeile, Webseite, Dokumente) |
| `dispona-logo-weiss.svg` / `.png` | Weiße Schrift für dunkle Flächen (Footer, dunkle Seitenleisten, Präsentationen) |
| `dispona-zeichen.svg` / `.png` | Nur das „o“ mit Punkt, ohne Hintergrund (Ladeanzeige, Wasserzeichen, Social-Media-Profil) |
| `dispona-app-icon.svg`, `-512.png`, `-192.png` | App-Icon auf Schiefergrau `#334155` (Fahrer-App, PWA-Manifest) |
| `apple-touch-icon.png` (180 px) | iPhone/iPad-Startbildschirm |
| `favicon.svg`, `favicon.ico`, `favicon-32.png`, `favicon-16.png` | Browser-Tab |

## Farben

- Schrift: `#1F2933` (auf Weiß) bzw. `#FFFFFF` (auf Dunkel)
- Live-Punkt: `#5E8C6A` – immer dieses Grün
- Icon-Hintergrund: `#334155`

## Regeln

- **Schutzraum:** Um das Logo herum mindestens die Höhe des „o“ frei lassen.
- **Mindestgröße:** Wortmarke ab 96 px Breite (digital) bzw. 25 mm (Druck). Darunter das App-Icon oder das Zeichen verwenden.
- **Nicht** verzerren, drehen, mit Schatten oder Verlauf versehen, und nicht in anderen Farben einfärben (außer den beiden Varianten).
- Der Punkt bleibt immer grün. Er steht für „live / Fahrgast am Ziel“ und ist der Wiedererkennungs-Punkt der Marke.
- **Comfortaa nur im Logo.** Die Oberfläche der Software bleibt bei IBM Plex Sans (siehe `DESIGN-GUIDE.md`).

## Einbau (für Claude Code)

```html
<!-- im <head> -->
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#334155">
```

```json
// manifest.webmanifest
{ "name": "Dispona", "short_name": "Dispona", "theme_color": "#334155", "background_color": "#F5F6F8",
  "icons": [ { "src": "/dispona-app-icon-192.png", "sizes": "192x192", "type": "image/png" },
             { "src": "/dispona-app-icon-512.png", "sizes": "512x512", "type": "image/png" } ] }
```

Prompt für Claude Code:

> Lege die Dateien aus dem Logo-Paket unter `public/brand/` ab (Favicons und Manifest-Icons ins `public/`-Hauptverzeichnis). Ersetze das Platzhalter-Logo „D“ in Kopfzeile und Login durch `dispona-logo.svg` (Höhe 28 px in der Kopfzeile, 40 px im Login), auf dunklen Flächen `dispona-logo-weiss.svg`. Binde Favicon, Apple-Touch-Icon und Manifest wie in `LOGO-ANLEITUNG.md` ein. Ergänze im `DESIGN-GUIDE.md` einen Abschnitt „Marke“ mit den Regeln aus dieser Anleitung.
