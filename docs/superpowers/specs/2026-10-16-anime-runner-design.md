# Anime Runner — design

Sotto-sito in `anime-runner/` (Safari Hunter resta su `index.html`).
Runner a corsie per telefono: si collezionano i 10 personaggi anime maschili
piu' fighi. Per ora sono giocabili solo i primi due livelli.

## Vincoli

- Zero dipendenze: `anime-runner/index.html` + `game.js` + foto in
  `anime-runner/assets/`. Funziona su GitHub Pages (HTTPS, serve ai sensori).
- Pensato per il telefono in verticale; giocabile anche da PC con le frecce.
- Personaggi disegnati in canvas; le foto vere solo sulle carte collezionabili.
- Suoni sintetizzati con WebAudio, nessun file audio.

## Album (schermata principale)

10 carte. Livello 1 Gojo giocabile; livello 2 Sung Jin-Woo si sblocca dopo aver
battuto Gojo; le altre 8 sono "???" / "Prossimamente". Carta vinta = foto.
Progressi in `localStorage` (con try/catch: se manca, si riparte da zero).

## Controlli

- Inclinazione (deviceorientation, `gamma` in verticale): la posizione del
  telefono al via e' lo zero; oltre ~13 gradi = corsia laterale, con isteresi.
- Swipe col dito: una corsia per swipe. Frecce / A-D da tastiera.
- Su iPhone il permesso dei sensori si chiede al tocco "Tocca per iniziare".

## Corsa

3 corsie in prospettiva, ~65 s, velocita' crescente. 3 vite, invulnerabilita'
breve dopo un colpo. 10 frammenti della carta sparsi nel percorso (sempre in una
corsia libera). A fine percorso: con almeno 5 frammenti si affronta il boss,
altrimenti si ritenta. Ogni frammento oltre il 5° toglie vita al boss.

Powerup (durata ~6 s):

| Livello | Scudo | Speciale | Vita |
|---|---|---|---|
| Gojo — Shibuya | Infinito (ostacoli ti passano attraverso) | Sei Occhi (calamita frammenti) | cuore |
| Jin-Woo — dungeon portale rosso | Furtivita' | Soldato ombra (distrugge ostacoli davanti) | pozione |

Ostacoli: spiriti maledetti, barriere, macerie (Gojo); goblin, spuntoni, lava
(Jin-Woo).

## Boss

In fondo alla pista: Sukuna (Gojo), Igris il Rosso (Jin-Woo). Segnala una o due
corsie in rosso, poi ci lancia un attacco: si schiva cambiando corsia. Sulle
corsie arrivano sfere di energia: prenderle colpisce il boss. Vita boss a zero ->
mossa finale a schermo intero ("VUOTO IMMENSO" / "ARISE!") -> la carta si gira e
mostra la foto -> album. Se si muore al boss: "Riprova il boss" (stessi
frammenti, 3 vite) o "Ricomincia".

`#boss` nell'URL salta dritto al boss con 10 frammenti (per provarlo).
