# Micro:bit → ThingSpeak · PWA

Aplicació web estàtica per enviar lectures de micro:bit a ThingSpeak des de Chrome (ChromeOS, Windows, macOS i Linux) mitjançant **Web Serial i USB**.

## Ús
1. Obre la [PWA publicada](https://isanch45.github.io/microbit-thingspeak-pwa/) amb Chrome.
2. Introdueix la **Write API Key** del teu canal de ThingSpeak i prem **Desa clau**.
3. Programa les micro:bits amb els fitxers `microbit_emissor_exemple.py` i `microbit_receptor.py` (ràdio al grup 23).
4. Connecta la micro:bit receptora al port USB (l'altra funciona amb piles, a distància).
5. Prem **Connecta micro:bit** i selecciona el dispositiu al selector de ports de Chrome.
6. A ThingSpeak, comprova el gràfic de cada camp (Private View) després d'un mínim de 15 s.

### Format de dades
La receptora envia una línia CSV com `23,157,623`, que es publica en `field1`, `field2` i `field3`. Per a les micro:bits de mostra: temperatura, llum i lectura analògica P0. Es poden enviar fins a 8 camps.

**Seguretat:** no incloguis mai claus Write API Key als fitxers d'aquest repositori. La clau desada al navegador és per ús local; no introdueixis claus compartides en equips sense confiança.

**Limitacions:** la web necessita HTTPS, permís del port sèrie i accés a Internet. Les polítiques dels Chromebooks gestionats poden bloquejar Web Serial. L'estat d'enviament indica que s'ha fet la petició, no garanteix que ThingSpeak l'hagi acceptada: valida-ho al canal.

Codi inicial: `Microbit-ThingSpeak-Chromebook-PWA.zip` (7/10/2026), amb ajustaments menors per fer-la instal·lable com a PWA i limitar la memòria cau del service worker al propi lloc web.