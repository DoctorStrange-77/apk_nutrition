# APK Nutrition

Applicazione Android locale per generazione automatica di menu nutrizionali.

## Funzioni V1
- nessun login o autenticazione
- nessuna dipendenza da Supabase per il funzionamento ordinario
- macro impostati direttamente dall'utilizzatore
- timing Builder preinstallati
- creazione, modifica, duplicazione ed eliminazione di timing locali
- distribuzione C/P/F per pasto con PRE/POST workout
- libreria alimenti Builder inclusa nell'app + alimenti personali
- selezione rigida degli alimenti per generare un menu
- Nutrition Engine V2 standalone con grammature pratiche, tolleranze e bilanciamento
- database SQLite locale su Android
- scanner barcode nativo Android; se il prodotto non è nel database viene proposto l'inserimento locale
- salvataggio e storico menu sul dispositivo
- packaging Android tramite Capacitor

## Sviluppo
Lo sviluppo avviene sul branch `develop`. La build automatica produce un APK debug installabile tramite GitHub Actions.

> `DoctorStrange-77/Builder` è usato esclusivamente come sorgente di riferimento per il motore, timing e seed nutrizionali e non viene modificato da questo progetto.
