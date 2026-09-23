# Finto premio — design

Scherzo tra amici che sostituisce il vecchio sito (finta verifica anti-bot).
Il destinatario sa che e' un meme: nessun reveal "era uno scherzo", la battuta
e' il finale stesso.

## Vincoli

- Pagina singola `index.html`, zero dipendenze, funziona aperta da file.
- Nessun campo input per dati personali, carte, IBAN, password.
- Nessun logo o grafica Apple: "iPhone" solo come testo, il resto emoji/CSS.
- Non usare la parola "puzzona".
- Deve funzionare sia con mouse sia su telefono (touch).

## Stile

Truffa anni 2000: Comic Sans, giallo/rosso, testo lampeggiante, bordi
tratteggiati, emoji, maiuscole e punti esclamativi a raffica.

## Percorso (schermate in sequenza, una sola visibile alla volta)

0. **Landing** — "CONGRATULAZIONI!!! Sei il VISITATORE N° 1.000.000!!!".
   Timer "L'offerta scade tra 04:59" che scorre davvero (a zero riparte).
   Ticker di finti vincitori. Lista premi: iPhone 17 Pro Max, PS6, buono
   1000€, Lamborghini (la scala 1:64 e' nascosta nei termini, art. 2.3).
   Bottone "RITIRA IL PREMIO".
1. **Ruota della fortuna** — rallenta fin quasi a fermarsi su "RITENTA",
   poi scatto sospetto su "iPhone 17 Pro Max". Poi bottone "Continua".
2. **Finto captcha** — "Seleziona tutte le immagini che contengono un
   iPhone": griglia 3x3 di foto vere (4 iPhone, 5 trappole: Android,
   banana, gatto...). Passa sempre; cambia solo il commento (giusto /
   "Sbagliato... ma va bene lo stesso").
3. **Termini e condizioni** — prima un documento legalese lunghissimo
   (21 articoli, addebito da 1799,99€ sepolto all'art. 11.2) in un riquadro
   scorrevole: "Accetto" si abilita solo arrivati in fondo. Poi
   ~6 popup in catena, sempre piu' assurdi.
   "Rifiuta" si rimpicciolisce a ogni popup fino a sparire (cliccarlo fa
   solo ricomparire lo stesso popup). L'ultimo contiene, in testo minuscolo,
   "l'utente accetta di acquistare il premio al prezzo di 1799,99€".
4. **Pulsante che scappa** — "RISCATTA ORA" fugge dal mouse (pointermove
   vicino); dopo ~8 fughe si lascia prendere. Touch: salta via al tocco,
   si arrende dopo 5 tentativi. Resta sempre dentro il viewport.
5. **Finale** — "Grazie per il suo acquisto! I 1799,99€ verranno scalati
   in 3... 2... 1..." poi "✅ PAGAMENTO COMPLETATO −1799,99€" con
   `assets/kaching.mp3`, coriandoli (CSS/JS, niente librerie) e finto
   numero d'ordine casuale.

## Audio

`assets/kaching.mp3` royalty-free (Pixabay). L'audio va sbloccato con un
play muto al primo click utente (autoplay policy), poi riprodotto al finale.

## Pulizia

Rimossi `assets/v.gif` e `assets/boom.mp3`. README aggiornato.

## Verifica

Aprire la pagina nel browser pane, percorrere tutto il flusso a desktop e a
larghezza mobile, controllare console senza errori e che l'audio parta.
