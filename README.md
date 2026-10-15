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

## Scherzi precedenti

Ripristinati così com'erano, ognuno nella sua cartella con i suoi file:

- `premio/`: finto sito "HAI VINTO!!!" (ruota truccata, captcha con gli
  iPhone, termini con l'addebito di 1799,99€ e ka-ching finale).
- `verifica/`: finta verifica anti-bot, 30 clic poi gif "Puzzona" a schermo
  intero col vine boom.

## Aula

`aula/`: finto video verticale. Si preme play (serve anche a sbloccare
l'audio), una lezione in cerchio in aula con 20 compagni disegnati in SVG e
lei al centro del fondo come foto scontornata (`aula/assets/lei.webp`). Dopo
8 secondi tutti si girano verso di lei, la camera zooma con l'occhio di bue
e parte `aula/assets/audio.mp3` (audio del TikTok, tagliato prima della
sigla finale, normalizzato e spinto oltre il 100% con WebAudio).
