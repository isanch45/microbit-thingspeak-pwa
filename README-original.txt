MICRO:BIT → THINGSPEAK · CHROMEBOOK / CHROMEOS
================================================

QUÈ ÉS?
-------
Una PWA/web app que fa:

micro:bit sensors
        ↓ ràdio
micro:bit receptora
        ↓ USB
Chromebook / Chrome
        ↓ Wi‑Fi
ThingSpeak

NO CAL:
- Python
- Linux de Chromebook
- .EXE
- instal·lar drivers especials en condicions normals

PRIMER ÚS
---------
1. Publica aquesta carpeta en un lloc HTTPS (per exemple Vercel o GitHub Pages).
   Web Serial necessita un context segur HTTPS.
2. Obre la web amb Chrome al Chromebook.
3. Enganxa la Write API Key de ThingSpeak i prem "Desa clau".
4. Connecta la micro:bit receptora per USB.
5. Prem "Connecta micro:bit".
6. Chrome mostrarà el selector de ports; tria la micro:bit.

SEGÜENTS USOS
-------------
La clau queda guardada en aquell Chromebook.
Chrome també conserva el permís del port. En obrir de nou l'app, intenta
reconnectar automàticament a un port ja autoritzat.

NOTA DE SEGURETAT DEL NAVEGADOR
-------------------------------
La PRIMERA autorització d'un dispositiu sèrie sempre necessita una acció de
l'usuari (clic/toc). Una web no pot saltar-se aquest permís.

FORMAT DE DADES
---------------
La micro:bit receptora envia per USB una línia CSV:

23,157,623

La PWA envia:
field1 = 23
field2 = 157
field3 = 623

També admet:
HORT,23,157,623

En aquest cas, HORT s'ignora i els valors van a field1..field3.

INTERVAL
--------
La PWA limita els enviaments a un mínim de 15 segons.

FITXERS
-------
index.html
app.js
manifest.webmanifest
service-worker.js
microbit_receptor.py
microbit_emissor_exemple.py