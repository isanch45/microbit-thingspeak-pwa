# Micro:bit → ThingSpeak · PWA

Aplicació web estàtica per enviar lectures de micro:bit a ThingSpeak des de Chrome (ChromeOS, Windows, macOS i Linux) mitjançant **Web Serial i USB**.

## Ús
1. Obre la [PWA publicada](https://isanch45.github.io/microbit-thingspeak-pwa/) amb Chrome.
2. Introdueix la **Write API Key** del teu canal de ThingSpeak i prem **Desa clau**.
3. Programa les micro:bits amb els fitxers `microbit_emissor_exemple.py` i `microbit_receptor.py` (ràdio al grup 23).
4. Connecta la micro:bit receptora al port USB (l'altra funciona amb piles, a distància).
5. Prem **Connecta micro:bit** i selecciona el dispositiu al selector de ports de Chrome.
6. A ThingSpeak, comprova el gràfic de cada camp (Private View) després d'un mínim de 15 s.

### Tauler de gràfics en directe

- Quatre gràfics **condicionals**: temperatura (°C), humitat (%), pressió (hPa) i lluminositat (nivell del sensor).
- **Compatibilitat per defecte amb el programa original**: camp 1 = temperatura, camp 2 = llum, camp 3 = lectura analògica sense gràfic; **mai** s'interpreta automàticament el camp 2 com humitat.
- A **Configurar sensors, escales i valors vàlids** es pot assignar qualsevol dels 8 camps a un sensor (per al format nou recomanat: camp 1 temperatura, camp 2 humitat, camp 3 pressió, camp 4 llum).
- Cada gràfic només es mostra si rep valors numèrics vàlids del sensor associat.
- Períodes: últims 30 min, 2 h, 24 h, 7 dies, tot l'historial **local disponible**.
- Botó **⚙ Opcions del gràfic** a cada targeta: títol, noms dels eixos, color, color de fons, tipus `line/bar/column/spline/step`, actualització dinàmica, dies o resultats, Timescale/mitjana/mediana/suma per intervals, arrodoniment i límits de dades o de l'eix Y.
- Escala Y automàtica o mínim/màxim manuals per sensor; filtratge opcional per valors admissibles (no afecta els enviaments).
- Indicadors de mínim, mitjana, màxim i última lectura. Els gràfics no uneixen línies durant interrupcions llargues.
- **Veure demostració**: visualitza les quatre gràfiques amb dades simulades **sense enviar res a ThingSpeak**.
- Desament local limitat a 9.000 missatges o 30 dies (el primer límit que s'assoleixi), subjecte a capacitat del navegador. No es garanteix una sèrie local de tot l'any.
- La PWA mostra **lectures rebudes** per USB, encara que ThingSpeak no accepti algun enviament. Per a dades anuals utilitza els gràfics del canal ThingSpeak.

**Nota:** la configuració s’inspira en ThingSpeak però els càlculs es fan localment sobre un historial limitat (9.000 lectures i fins a 30 dies). Per obtenir un registre anual complet, consulta les dades de ThingSpeak. La selecció de dies no pot mostrar informació que no s’hagi desat en aquest navegador.

### Format de dades
La receptora envia una línia CSV com `23,157,623`, que es publica en `field1`, `field2` i `field3`. Per a les micro:bits de mostra: temperatura, llum i lectura analògica P0. Es poden enviar fins a 8 camps.

**Seguretat:** no incloguis mai claus Write API Key als fitxers d'aquest repositori. La clau desada al navegador és per ús local; no introdueixis claus compartides en equips sense confiança.

**Limitacions:** la web necessita HTTPS, permís del port sèrie i accés a Internet. Les polítiques dels Chromebooks gestionats poden bloquejar Web Serial. L'estat d'enviament indica que s'ha fet la petició, no garanteix que ThingSpeak l'hagi acceptada: valida-ho al canal.

Codi inicial: `Microbit-ThingSpeak-Chromebook-PWA.zip` (7/10/2026), amb ajustaments menors per fer-la instal·lable com a PWA i limitar la memòria cau del service worker al propi lloc web.