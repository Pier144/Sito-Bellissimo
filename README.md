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

## L'Oracolo (`oracolo/`)

Biscotto della fortuna sotto un cielo stellato. Si tocca il biscotto, che
trema, si spezza col "crack" (sintetizzato con WebAudio) e tira fuori il
bigliettino; sotto compare la pergamena con la profezia e tre voti a stelle.

Il giorno della prima apertura, prima del biscotto compare una lettera col
sigillo (`MESSAGGIO`, il sushi di stasera) e il pulsante "Apri il biscotto";
dal giorno dopo la lettera non c'è più. Le profezie del biscotto sono nella
lista `PROFEZIE` in fondo a `oracolo/index.html`: il primo giorno esce la prima,
poi una a caso al giorno (la stessa per tutto il giorno, mai uguale a quella
del giorno prima), con voti di Amore, Soldi e Salute sempre diversi. Il giorno
del primo accesso resta nel `localStorage`.

Per ricominciare dalla lettera: apri `oracolo/#reset` e ricarica.
