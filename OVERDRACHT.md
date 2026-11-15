# Overdracht Aldervale (versie 0.60.0, 15 november 2026)

Plak in de nieuwe chat: "Lees claude/overdracht.md in het project Stronghold en ga verder." Lees dit eerst. Repo: github.com/KarelsMatrixx/burcht-en-banier, branch main (laatste commit e83aa1a). Project "Stronghold".

## Werkafspraken met Karel
- Karel is geen programmeur; Claude is de ontwikkelaar en werkt zelfstandig, test, commit en pusht.
- Antwoord in het Nederlands, zakelijk, kern eerst, kort. Geen koppelstreepjes in lopende tekst. Aannames apart.
- Markeer door Claude geschreven (Engelse) speltekst en geschatte getallen als "na te lezen".
- Hooguit een vraag; anders de waarschijnlijkste lezing kiezen en leveren.
- Speltekst Engels, code en commentaar Nederlands.
- Karel test op zijn iPhone (liggend, ongeveer 859 x 396 met veilige randen) en stuurt screenshots.

## Techniek in het kort
- Platte HTML/CSS/JS canvas PWA, isometrisch, 844 x 390, geen build. Data in `data/*.json`. `window.spel` geeft onderdelen voor tests.
- Versie staat in `js/config.js`, `sw.js`, `tests/test_stap15.mjs`, `tests/test_stap17.mjs` (alle vier ophogen). Nieuwe JS-bestanden toevoegen aan KERN in `sw.js`. Wijzigingen onderaan `WIJZIGINGEN.md`.
- Tests: Playwright met `/usr/bin/google-chrome`, elke test een eigen http.server-poort. Los draaien: `node tests/proloog35.mjs`. Alles: `bash tests/alles.sh` (ongeveer 25 min). Oude tests hebben de symlink `/home/claude/spel -> /home/claude/burcht-en-banier` nodig.
- Een level starten in een test: localStorage `burcht-banier.modus` = {soort:'campagne', missie:N}, sessionStorage `burcht-banier.geenTitel`=1, `tipGesloten`=1, dan `#missie-begin` tikken.
- Pushen: `git fetch && git merge origin/main`, dan `git -c push.negotiate=true push origin HEAD:main`.

## De proloog (tutorial, missie 0), stand nu
Bestanden: `js/proloog.js` (verloop), `js/gids.js` (aanwijzer: ring, zin, gouden plek, kaartje met portret), `js/figuranten.js` (dorpelingen, Bartholt), `js/strijd.js` (opmars).

**Dag, 11 lessen** op het bouwveld linksboven (west): houthakker, steengroeve, boomgaard, huis, voorraadkamer, je volk, belasting, kazerne, twee soldaten trainen, soldaat sturen, soldaat op de muur.
- Bartholt verschijnt met een rookwolkje bij de plek van elke les.
- Gesprekken met portret (`GESPREKKEN`): na les 4 Wessel en Karel (verjaardag), na les 8 Reinout vraagt naar de oostpoort, na les 11 de valkenveer.
- Bevel-lessen: eerst gouden plek op je nieuwste soldaat, dan (grondles) het oog uitgelegd, dan de doelplek. Muurles telt elk bevel naar een stuk muur.
- Daarna 20 s vrij bij daglicht, 20 s schemering met avondbericht.

**Nacht:** leger van 100 (14 soorten, ook ram, katapult, toren, ladder) begint helemaal aan de oostrand en loopt op 55% snelheid naar een wachtplek buiten de oostpoort. Les in 4 stappen (`NACHT_TAKEN`): boogschutters kiezen, naar de muur bij de poort (alleen een bevel naar de gouden plek telt), ridders kiezen, achter de poort. Daarna (of na 150 s) poorten open, storm. Na 4 min of burcht onder 40%: scène, Wessel ontvoerd, door naar de levelkaart.

**Tests die groen zijn:** proloog35 (68), proloog42 (25), proloog43 (25), proloog40 (22), gevecht40 (5).
**Bekend rood (ouder, niet van deze reeks):** campagne30, verhaal31, hut36, bouwstraal38.

## Na 0.59.1
- 0.59.4: grondles telt alleen een bevel op de grond bij de gouden plek (volgorde soldaat, oog, plek); muurles alleen een bevel naar de muur in die les. Met het oog aan gaat een tik naar de grond (main.js).
- 0.60.0: hinderlaag in level 2 Sevenwinds (`js/hinderlaag.js`): eerste keer in het midden van de pas 4 boogschutters per kant in de rotsen. Test hinderlaag44. Niet bewaard bij herladen.
- Een andere chat voegde de verhaalbeelden toe (0.59.2 en 0.59.3); de proloog begint nu met 12 s verhaalbeeld.

## Open punten en te controleren
- Karel heeft 0.59.1 nog niet op de iPhone gezien: volgorde in de bevel-lessen, legerhint en gidszin, opmars aan de rand.
- Prestaties op iPhone met ongeveer 100 vijanden en 140 figuren.
- Gouden plekken van de nachtles ([17,-1] muur bij poort, [14,2] achter poort) zijn schattingen.
- Na herladen midden in de opmars verschijnt het leger opnieuw aan de rand.
- Reinouts losse opmerking in les 3 ("Nine already") overlapt met het eerste gesprek; mogelijk weghalen.
- Alle Engelse teksten van Bartholt, Wessel, Reinout en Karel zijn door Claude geschreven: na te lezen.
- Eerder open: Ludolf loopt niet naar buiten, rood bemant het dak van de burcht niet, rode burgers werken niet, rood bouwt geen kazerne of muren, extra wachters worden niet bewaard.

## Volgende stappen volgens plan (`claude/stappenplan-campagne.md`)
1. Karels iPhone-feedback op de tutorial verwerken.
2. Stap 39: Windzanger en level 7 Grauwvoort (drie poorten achter elkaar).
3. Stap 40: Saboteur en level 8 Witte Dijk; 41 Ziener en level 9 Rouwpoort; 42 level 10 Rouwburcht; 43 balansronde.

## Nog geldig uit de vorige overdracht (0.50.1)
- Nieuwe chat: repo toevoegen (add_repo met push) en klonen naar `/home/claude/burcht-en-banier` met ruime timeout.
- Visuele wijzigingen: screenshot laten zien; Karel reageert vaak midden in een beurt, verwerk dat meteen.
- Netlify: niets plaatsen zonder overleg, nooit een nieuwe site aanmaken. Karels e-mailadres is privé.
- Titel Aldervale, ondertitel Banners of the Vale. Logo, knoppen en wapperende vlaggen op het beginscherm sinds 0.50 (`js/vlaggen.js`).
- Campagne: proloog en levels 1 tot 6 speelbaar (4 hut houden, 5 abdij met gracht, 6 bouwloodsen slopen); 7 tot 10 nog te bouwen.
- Na nieuwe levels moeten campagne30 en test_stap17 mee. test_stap15 faalt soms op timing: opnieuw draaien.
- Simulatie vooruit in tests: `s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap();` in een lus.
- Andere projectdocs: `voortgang-0.53.md` (0.52 tot 0.56, nog niet bijgewerkt voor 0.56.1 en later; deze overdracht is actueler), `stappenplan-campagne.md`, `campagne-verhaal.md`, `aanvalsplan-veldheer.md`, `legerontwerp.md`, `kastelenontwerp.md`, `portretten.md`.
