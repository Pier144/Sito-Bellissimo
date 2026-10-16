# Sito-Bellissimo

Scherzo tra amici. Finto gioco "Safari Hunter": nella savana passa una zebra
alla volta (ogni tanto cambia idea e torna indietro) e bisogna abbatterne 6.
Dalla prima alla quinta vanno sempre più veloci; la sesta è la foto
scontornata (`assets/ultima-zebra.webp`), che corre alla velocità della
seconda. Presa quella, compare "Caccia completata!".

Pagina singola, zero dipendenze: apri `index.html`. Funziona con mouse e
touch (pensato soprattutto per il telefono).

Le zebre sono disegnate in SVG dentro la pagina e non con l'emoji 🦓, perché
l'emoji guarda in versi diversi a seconda del telefono. L'unico suono è lo
sparo, sintetizzato con WebAudio.

## Anime Runner (`anime-runner/`)

Sotto-sito a parte: runner a 3 corsie per telefono in cui si collezionano i 10
personaggi anime maschili più fighi. Per ora si giocano Gojo (Shibuya, boss
Sukuna) e Sung Jin-Woo (dungeon, boss Igris), il secondo si sblocca battendo il
primo. Si sterza inclinando il telefono, oppure con swipe/tocco ai lati o le
frecce da PC. Si raccolgono almeno 5 frammenti su 10, poi si batte il boss e si
ottiene la carta con la foto (`anime-runner/assets/`, dalle wiki Fandom).
I progressi restano nel `localStorage` del telefono.

Per provare subito il boss: `anime-runner/#boss`. I sensori su iPhone
funzionano solo in HTTPS (GitHub Pages va bene).
