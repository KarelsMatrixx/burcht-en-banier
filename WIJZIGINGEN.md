## 0.15.0 (stap 15): de rode heer met eigen economie
- Nieuw: js/rood.js. Rood heeft voorraad (hout, steen, goud), werken buiten zijn muur (houthakkershut, steengroeve, boomgaard, door kaart.js geplaatst, eigenaar 2) en koopt soldaten in een reserve.
- Geen klok meer voor de aanvallen: hij valt aan als zijn reserve sterk genoeg is (doel groeit per aanval) en er minstens 200 s (eerste) of 100 s (daarna) voorbij zijn. Rammen en ladders vanaf aanval 4, daarvoor spaart hij.
- Rood herstelt zijn muren en werken (kost grondstoffen, niet als een soldaat van jou binnen 6 tegels staat) en doet een uitval met zijn hele reserve als jouw soldaten binnen 14 tegels van zijn burcht komen.
- Sloop je zijn werken, dan daalt zijn inkomen. Alle getallen: data/economie.json onder "heer".
- strijd.js: stuurLeger, koppelHeer, roodWeg, herbouwVak. Bewaard onder strijd.heer.
- sw.js opnieuw opgebouwd (stond niet in het artifact van stap 14).
- Bekend: zijn reserve staat niet zichtbaar op de kaart; hij koopt geen nieuwe wachters; hij bouwt geen nieuwe werken, alleen herbouw.

## 0.16.0 (stap 16): katapult en belegeringstoren
- Katapult (30 goud + 30 hout, kazerne): gooit stenen op bouwwerken tot 9 tegels ver, 35 schade per worp elke 5 s, 90 leven, vecht niet met soldaten (alleenBouw, zoals de ram). Staat buiten het bereik van de burcht (6). Een steen vliegt zichtbaar in een boog.
- Belegeringstoren (40 goud + 60 hout, kazerne): zet net als een ladderdrager een ladder tegen een muur, maar die is breed en stevig: je soldaten duwen hem pas na 10 s om (gewone ladder: 3 s). De toren zelf heeft 300 leven. Ladders bewaard met een vijfde getal (1 = vast).
- Rood koopt een katapult vanaf zijn zesde aanval en een belegeringstoren vanaf zijn zevende (max 1 per aanval); data/economie.json, heer.extra_soorten.
- Nieuwe kunst: tekenKatapult, tekenBelegeringstoren (kunst.js), wagenbeelden als hulpje.
- Bekend: de belegeringstoren is een stevige ladder, geen echte toren waar soldaten in zitten; een katapult beschiet alleen bouwwerken, geen soldaten; geen splash.

## 0.17.0 (stap 17): vrij spel en campagne
- Nieuw: knop Menu (bovenbalk), js/modus.js, data/missies.json. Vrij spel in vier profielen (Normaal, Rustig, Zwaar, Zonder aanvallen) en een campagne van 3 missies: Heer Reinout van Dorre Heide (rustig), Vrouwe Mechteld Zevenwind (normaal), Graaf Hademar van IJzerbroek (zwaar). Missie n+1 gaat open als je missie n wint.
- Profielen overschrijven heer, strijd en beginvoorraad uit economie.json. Een missie opent met een introvenster. Win je, dan zie je Volgende missie.
- Elke modus heeft zijn eigen bewaarde stand (Vrij Normaal gebruikt de oude sleutel burcht-banier.kasteel.1); kiezen laadt de pagina opnieuw. Voortgang onder burcht-banier.campagne, keuze onder burcht-banier.modus.
- Zonder aanvallen: strijd.golven = [], er valt niets te winnen of te verliezen.
- Bekend: alle missies spelen op dezelfde kaart (zelfde zaad); verschil zit in de heer en de beginvoorraad. Geen eigen kaart, geen eigen win- of verliesdoel per missie.

## 0.18.0 (stap 18): katapult, belegeringstoren en selectie
- Katapult: schiet nu ook op bouwwerken die achter de muur staan (de burcht, werken binnen de ring). Hij zoekt zelf de verste bereikbare plek waar het doel nog binnen bereik ligt en blijft daar staan (padOpAfstand in strijd.js). Boogschutters gebruiken hetzelfde.
- Belegeringstoren en ladderdrager: tik je op een toren, wachttoren of de poort van rood, dan kiest de drager het dichtstbijzijnde gewone stuk muur. Staat er al een ladder, of is er geen muur in de buurt, dan krijg je nu een duidelijke melding.
- Nieuw: kiezen per groep (Dichtbij, Afstand, Belegering) en per soort (Ridder, Boogschutter, Katapult, enz.) met knoppen onderin; verschijnen als je meer dan een groep of soort hebt.
- Tests met echte aanrakingen: tests/aanraking.mjs, toren_klim.mjs (toren tegen de muur, drie ridders klimmen erover en komen binnen), selectie.mjs.
- Bekend: een toren of katapult alleen op pad wordt neergemaaid door de uitval van rood; neem soldaten mee.

## 0.19.0 (stap 19): beginscherm en levelkaart
- Het spel opent met een beginscherm (Campagne, Vrij spel, Verder spelen als je al iets hebt gespeeld). Campagne opent een levelkaart met punten voor level 1, 2 en 3: open (geel), gewonnen (groen met vinkje), dicht (grijs met slot), huidig (rode rand). Tik op een open level en het start; een dicht level zegt welk level je eerst moet winnen. Vrij spel opent het bestaande menu met de vier profielen.
- De Menu-knop opent nu de levelkaart. Achter het beginscherm en de kaart staat het spel stil.
- Het beginscherm komt alleen bij het openen van de pagina, niet na het kiezen van een level.
- Meer levels toevoegen: een nieuwe missie in data/missies.json (campagne) met een punt {x, y} in procenten; de kaart tekent hem vanzelf.
- Nog gelijke kaart onder alle levels; eigen kaarten komen in stap 24 en 25.
- Test: tests/menu19.mjs.

## 0.20.0 (stap 20): voorraadkamer en opslaggrens
- Nieuw gebouw: Voorraad (groep Dorp, 30 hout). Werkers brengen hun last naar de dichtstbijzijnde plek: de burcht of een voorraadkamer.
- Hout, steen en voedsel hebben nu een grens: 150 in de burcht, plus 150 per voorraadkamer. Goud heeft geen grens. In beeld staat de voorraad als 60/150, rood als hij vol is (data/economie.json, opslag).
- Is de opslag vol, dan wacht de werker met zijn last en meldt dat; hij levert af zodra er ruimte is.
- De voorraad blijft één totaal (niet per kamer): wordt een kamer gesloopt, dan daalt de grens maar gaat er geen voorraad verloren. Bewaarde spellen blijven werken, het opslagformaat is niet veranderd.
- Het plaatje van de kamer is voorlopig een bruin huis met rood dak; eigen tekening volgt.
- Test: tests/opslag20.mjs (bouwt een kamer met een tik, een houthakker meldt een volle opslag en levert weer af na ruimte maken).

## 0.21.0 (stap 21): planken en de zagerij
- Nieuwe grondstof Planken (begin 20, grens zoals hout). Nieuw gebouw Zagerij (groep Werk, 25 hout) met een zager.
- De zager loopt naar de dichtstbijzijnde voorraad (burcht of voorraadkamer), neemt 4 hout, loopt terug, zaagt 4 seconden en brengt 4 planken naar de voorraad. Is er geen hout, dan wacht hij en meldt dat. Wordt de zagerij gesloopt terwijl hij hout draagt, dan komt dat hout terug.
- Bouwkosten: woning 10 planken (was 20 hout), kazerne 10 planken en 10 steen, poort 4 steen en 2 planken. Soldaten: hout wordt de helft aan planken (ram 10, ladder 2, katapult 15, belegeringstoren 30). Houthakker, zagerij, steengroeve, boomgaard en voorraadkamer kosten nog hout, zodat je altijd kunt beginnen.
- Rood maakt geen planken: wat planken kost betaalt hij met twee hout per plank (dus voor hem niets veranderd).
- Houthakkers brengen nog naar de voorraad, niet rechtstreeks naar de zagerij (bewuste keuze: eenvoudiger en de keten blijft zichtbaar).
- Versie in beeld toont nu de goede stap. Test: tests/planken21.mjs.

## 0.22.0 (stap 22): tarwe, bakkerij en brood
- Nieuwe grondstoffen Tarwe en Brood (begin 0, met opslaggrens). Nieuw: Tarweveld (Werk, 10 hout) met een tarweboer die oogst en tarwe naar de voorraad brengt; Bakkerij (Werk, 10 planken en 5 steen) met een bakker die 4 tarwe uit de voorraad haalt en er 8 brood van bakt.
- Je volk eet nu brood én fruit (voedsel = appels), om de beurt. Is er van beide iets, dan +2 populariteit per ronde (afwisseling). Honger alleen als alles samen te weinig is.
- De voorraadbalk bovenin toont alleen grondstoffen die je hebt of maakt (anders past hij niet op een telefoon), en zonder de grens erbij; de grens staat in het paneel dat opent als je de voorraad aantikt. Vol = rood.
- Nieuwe tekeningen: tarweveld met rijen aren, werker met schoof tarwe en met broden. Bakkerij is voorlopig een huisvariant met schoorsteen.
- Test: tests/brood22.mjs.

## 0.22.1: bakkerij, verkopen en tragere steen
- De bakkerij heeft een eigen tekening: rode baksteen, een bolle broodoven met vuur in de opening en rook, een uithangbord met krakeling, een bank met broden en meelzakken (tekenBakkerij in kunst.js).
- Tik op een voorraadkamer die je hebt gebouwd: een paneel om overschot voor goud te verkopen, per 10 stuks. Prijzen: hout 2, planken 4, steen 3, voedsel 2, tarwe 2, brood 4 goud (data/economie.json, handel). Een grondstof waarvan je minder dan 10 hebt staat dof.
- Steen hakken duurt nu 9 seconden (was 4) en een steenhouwer loopt trager met zijn last (1.0 in plaats van 1.1). Hout blijft 3 seconden. Rood is niet veranderd.
- Test: tests/handel.mjs.

## 0.23.0 (stap 23): koper en de kopermijn
- De ijzerrotsen op de kaart zijn nu kopererts: grijze rots met oranje aders en groene vlekjes. Er ligt een veld bij jouw burcht, een bij rood en een in het midden. (In de code heet het object nog IJZER, zodat bewaarde spellen blijven werken.)
- Nieuwe grondstof Koper (begin 0, met opslaggrens) en nieuw gebouw Kopermijn (Werk, 20 hout en 10 planken), dat naast kopererts moet staan. De mijnwerker hakt 10 seconden en brengt 4 koper naar de voorraad.
- Koper heeft nog geen gebruik behalve verkopen (8 goud per 10). Betere soldaten met koper komen in stap 26.
- De bouwknoppen staan nu op één rij die je met je vinger schuift; de eerste knop (Terug) blijft staan.
- Eigen tekening: een heuvel met stollenmond van balken, rails, een karretje met erts en een lantaarn; mijnwerker met een mand koper.
- Test: tests/koper23.mjs.

## 0.24.0 (stap 24 en 25): kaartsysteem en een eigen kaart per level
- Een kaart is nu een recept in data/kaarten.json: grootte, zaad, hoeveel water, hoeveel bos, waar je burcht staat en waar steen, kopererts en extra bos liggen. De generator in js/kaart.js maakt er het speelveld van; rood staat altijd gespiegeld, zijn burcht, muur en werken worden uit de kaart berekend.
- Vier kaarten: Het Middenland (vrij spel, ongewijzigd, 64x64), Het Groene Dal (level 1, 56x56, klein en bosrijk, weinig water), De Twee Meren (level 2, 64x64, grote meren), Het Grensland (level 3, 72x72, burchten verder uit elkaar, kopererts alleen in het midden).
- De generator controleert of er een weg over land is van jouw poort naar die van rood. Zo niet, dan maakt hij een doorwaadbare plek en kapt hij een pad.
- Meer kaarten toevoegen: een recept in data/kaarten.json en in data/missies.json bij een level kaart: naam.
- De missie-intro noemt de kaart. Een bewaard spel van een level dat nog op de oude kaart is begonnen, start opnieuw (de stand past niet op de nieuwe kaart).
- Test: tests/kaarten24.mjs (grootte, weg tussen de poorten, drie werken van rood, steen en koper bereikbaar, voor alle vier kaarten).

## 0.26.0 (stap 26): bijlridder en kruisboogschutter (ronde A van Karels legerontwerp)
- Bijlridder (16 goud, 3 koper): leven 66, schade 16, slagtijd 1,6 s, snelheid 1,9. Raakt ook één vijand direct naast zijn doelwit (volle schade). Dubbele schade aan poorten en houten gebouwen (lijst in economie.json, bouwBonus).
- Kruisboog (12 goud, 2 planken, 2 koper): leven 42, schade 18, slagtijd 2 s, bereik 6. Zijn bolt gaat door schild en dak heen (doorboort: pijlDekking telt niet).
- Waarden zijn Karels percentages toegepast op de ridder (leven 60, schade 10, slagtijd 1, snelheid 2).
- Eigen tekeningen: bijlridder breed, met bontkraag, baard, open helm en een bijl met halvemaankop die hij boven het hoofd zwaait; kruisboogschutter met leren kap, donkergroene jas en koker bolts.
- Selectieknoppen: één schuifbare rij. Groepen: bijlridder bij Dichtbij, kruisboog bij Afstand.
- Niet gedaan uit het ontwerp: opleidingstijd (het spel kent nog geen opleidingstijd, soldaten staan er direct), de 1,5x schade tegen de steenwachter (die bestaat nog niet), de speerman-aanpassing (ronde B). Rood gebruikt de nieuwe soldaten nog niet (stap 28).
- Test: tests/soldaten26.mjs.

## 0.27.0 (stap 27): de magiertoren, sluipmoordenaar en vlammenwever (ronde A, mystiek)
- Nieuw gebouw Magiertoren (groep Leger, 15 planken, 15 steen, 5 koper): de mystieke kazerne. Ronde stenen toren, spits paars dak, gloeiende ramen, lila rook, vaantje met ster. De klassieke kazerne toont alleen klassieke soldaten, de toren alleen mystieke (veld kazerne in economie.json; leidtOp is nu "klassiek" of "mystiek").
- Mystieke soldaten kosten twee boeren zonder werk (veld boeren).
- Sluipmoordenaar (24 goud, 4 koper): leven 36, schade 10, eerste slag op een nieuw doelwit 3x (30), slagtijd 0,7 s, snelheid 2,8. Vijanden en de burcht zien hem pas binnen 3 tegels; na een slag is hij 3 seconden zichtbaar. Jij ziet hem half doorzichtig als hij verborgen is. Tik met hem gekozen op een gewone muur van rood (of een toren, dan kiest hij de muur ernaast): hij loopt erheen, klimt in 2 seconden omhoog zonder ladder en staat boven.
- Vlammenwever (32 goud, 6 koper): leven 33, schade 12, slagtijd 2,5 s, bereik 7. Vuurbal met staart en ontploffing; halve schade op wie binnen 1,5 tegel van het doelwit staat. Houten machines (ram, ladder, toren, katapult) en houten gebouwen (poort, werken) branden 8 seconden met 3 schade per seconde, met vlammetjes.
- Waarden: Karels percentages op de ridder. Opleidingstijd en legerplaatsen bestaan nog niet; beide tellen als 1 legerplaats.
- Test: tests/mystiek27.mjs.

## 0.28.0 (stap 28): de koning
- Jij en rood hebben elk een koning (soldaat "koning" in economie.json, niet op te leiden). Hij staat bij de start voor je burcht. Leven 240 (4x ridder), schade 22, slagtijd 1,8 s, snelheid 1,8, bereik 1,9 (lang zwaard). Zijn zwaai raakt het doelwit en twee vijanden ernaast. Eigen soldaten binnen 4 tegels doen 10% meer schade (koninklijk vaandel).
- Winnen en verliezen gaan nu over de koningen: valt de koning van rood, dan heb je gewonnen; valt de jouwe, dan heb je verloren.
- De burcht schiet niet meer (strijd.burchtSchiet false). Een burcht die kapot is maakt zijn koning zwakker (60% schade) en hij geneest niet meer. Een koning geneest alleen bij zijn eigen burcht (sneller dan een soldaat).
- De koning van rood blijft thuis: hij valt alleen aan wie binnen 4,5 tegels van zijn burcht komt en loopt daarna terug.
- Jouw koning kies je met een tik op hem, met het kader of met de knop Koning; hij valt buiten Dichtbij en buiten Alle, zodat je hem niet per ongeluk meestuurt.
- Bewaren: leven van de rode koning; jouw koning zit in je leger. Een oud bewaard spel krijgt beide koningen erbij. Naar start zet beide koningen terug.
- Tekening (Karels campagnebeschrijving): staalgrijs harnas, tabbaard in teamkleur met een wapen (goud bij jou), wapperende mantel, korte baard, smalle gouden kroon, tweehandig zwaard met gouden pareerstang, zwarte rouwband om de linkerarm bij jouw koning. 130% van een ridder.
- Afwijking van de campagnetekst: daar staat dat de koning na 40 s terugkeert. Karel koos in de chat voor: koning dood = verloren.
- Test: tests/koning.mjs; test_stap17 wint nu door de rode koning te verslaan.

## 0.29.0 (stap 29): rood leert de nieuwe soldaten, en een balansronde
- Rood koopt zijn gewone mannen nu volgens een mengsel (heer.leger in economie.json): aandeel per soort en vanaf welke aanval hij die kent. Hij koopt steeds de soort die het verst achterloopt op zijn aandeel. Koper betaalt hij met 2 goud per stuk, planken met 2 hout.
  - Normaal (vrij spel en level 2): ridder 3, boog 2, bijlridder 1 vanaf aanval 2, kruisboog 1 vanaf 3, sluipmoordenaar 0,5 vanaf 4, vlammenwever 0,5 vanaf 5.
  - Rustig (level 1): ridder 3, boog 1, bijlridder 1 vanaf aanval 4. Geen kruisboog of mystiek.
  - Zwaar (level 3): bijlridder vanaf 1, kruisboog vanaf 2, mystiek vanaf aanval 3.
  - Gewicht voor zijn sterkte: bijlridder 1,4, kruisboog 1,1, sluipmoordenaar 1,5, vlammenwever 2.
- Balans (gemeten met tests/balans.mjs: gelijke prijs, open veld, beide kanten gespiegeld): de nieuwe soldaten waren per goudstuk veel zwakker dan ridders. Aangepast:
  | Soldaat | Was | Nu |
  |---|---|---|
  | Bijlridder | 16 goud 3 koper, leven 66, schade 16, slag 1,6 s | 14 goud 2 koper, leven 80, schade 17, slag 1,5 s |
  | Kruisboog | 12 goud 2 planken 2 koper, leven 42, schade 18, slag 2 s | 10 goud 2 planken 1 koper, slag 1,9 s |
  | Sluipmoordenaar | 24 goud 4 koper, leven 36, schade 10 | 18 goud 2 koper, leven 50, schade 12 (eerste slag 36) |
  | Vlammenwever | 32 goud 6 koper, leven 33, schade 12, slag 2,5 s, gebied 0,5 | 22 goud 3 koper, leven 50, schade 16, slag 2 s, gebied 0,75 |
- Een koning alleen houdt een aanval van 3 tot 4 man tegen en verliest van 6 (gemeten met tests/koningsim.mjs).
- Tests: tests/rood29.mjs, balans.mjs, koningsim.mjs.

## 0.30.0 (stap 30): campagnegegevens, levelkaart met elf punten, ontgrendelen
- Nieuw bestand data/campagne.json met de proloog en tien levels (naar campagne-verhaal.md): naam, titel, heer, portret, profiel, kaart, plek op de levelkaart, speelbaar, nieuw (wat je vanaf dat level hebt), intro, slottekst en het voorwerp van Wessel. missies.json houdt alleen de profielen en vrij spel.
- Levelkaart: elf punten van Elzendaal naar de Rouwburcht, elk met het portret van de heer (proloog: Wessel). Gewonnen: groen met vinkje en de weg kleurt goud. Dicht: grijs met slot ("win eerst level n"). Nog niet gebouwd: gestippelde rand, "komt later". Nu speelbaar: level 1 tot 3.
- Ontgrendelen in de campagne: level 1 ridder, boogschutter, ram, ladder; level 2 erbij de belegeringstoren; level 3 katapult, bijlridder, kruisboog en de kopermijn; vanaf level 4 de magiertoren met sluipmoordenaar en vlammenwever. De bouwbalk en de kazerne tonen alleen wat je hebt. Vrij spel heeft alles.
- Na het winnen: de slottekst van de heer en wat je van Wessel vindt.
- De 22 portretten staan in beelden/portretten (256 pixels, samen 255 KB) en worden offline bewaard.
- Test: tests/campagne30.mjs.

## 0.31.0 (stap 31): schilderijen voor het beginscherm en de levelkaart
- Beginscherm: een schilderij (beelden/startscherm.webp, 146 KB, 2576 breed) over het hele scherm. Titel en knoppen staan links, over een donkere schaduw.
- Levelkaart: een schilderij (beelden/levelkaart.webp, 273 KB, 2576 breed) over het hele scherm. De elf punten staan op de open plekken van de weg. Een punt is een portret in een ring; de kleur van de ring is de stand: goud open, groen gewonnen (met vinkje), grijs dicht of komt later (met slot), rood het huidige level. De cijfertjes zijn weg.
- De weg kleurt goud tot het laatst gewonnen level. De kloof bij Grauwvoort heeft een brug, in code getekend, want de weg is in het schilderij daar onderbroken.
- Nieuw: data/levelkaart.json (route, brug en hoe ver langs de route elk level ligt). In data/campagne.json zijn de punten nu procenten van het schilderij.
- sw.js: de twee schilderijen en levelkaart.json zijn toegevoegd aan de bewaarde bestanden (0.31.0).
- Bekend: Het Veen ligt op de weg boven het veen, niet erin; de brug kan in stijl afwijken van het schilderij; de naam Grauwvoort staat boven het punt; nog niet op een echte iPhone gezien (alleen Chrome op 844 bij 390).
- Test: tests/kaart31.mjs (16 controles). tests/menu19.mjs en tests/campagne30.mjs slagen ook.

## 0.32.0: het spel in het Engels, soldaten als beloning
- Alles wat de speler ziet is Engels: knoppen, meldingen, panelen, eindschermen, de prestatietest, de foutmelding, namen van grondstoffen, gebouwen, soldaten, beroepen, kaarten, profielen, en alle campagneteksten. Titel: Keep & Banner. De code, de sleutels in de data en de opmerkingen blijven Nederlands.
- Plaatsen en titels verengelst (Witherheath, Sevenwinds, Ironmarsh, The Fen, Stillwater, Giant's Spine, Greyford, White Dike, Mourngate, Mournkeep, Aldervale, Blackmark). Voornamen blijven (Reinout, Mechteld, Hademar, Wessel, Karel, Ottger). Kuyper werd Cooper, Valkenier werd Falconer.
- Plaatjes in de voorraadbalk kiezen nu op sleutel (icoon-hout) in plaats van op de naam. Meervoud van soldaten staat in economie.json (meervoud). Nieuw: js/taal.js (a of an).
- Vrijspelen: elk level heeft in campagne.json een beloning in plaats van nieuw. Je krijgt de beloning als je het level wint; in level n heb je de beloningen van alle levels ervoor. Proloog: stormram en ladderdrager. Reinout: kopermijn. Mechteld (schutters): kruisboog. Hademar (smid): bijlridder en katapult. Brandt en Gesina: sluipmoordenaar, magiertoren en vlammenwever. Lambrecht (machines): belegeringstoren.
- Het eindscherm noemt wat je vrijspeelt ("Unlocked: Crossbowman"), de intro van een level wat er nieuw is ("New for you: Copper Mine").
- Bekend: de belegeringstoren zit nu pas na level 6, dus in de speelbare levels 1 tot 3 niet meer; de balans van level 3 zonder katapult en bijlridder is niet getest. Technische foutmeldingen uit de code (bij een kapot databestand) zijn nog Nederlands.
- Test: tests/campagne30.mjs aangepast (21 controles); de andere tests op Engelse teksten.

## 0.33.0 (stap 31): verhaalbalk, briefing en terugblik
- Briefing voor elk level: portret van de verteller (Chamberlain Bartholt) links, de heer met rood omrand portret rechts, daaronder wat er nieuw is en de kaart.
- Verhaalbalk tijdens het level (links boven, onder de titel): portret, naam en tekst. Blijft minstens 6 seconden staan, tik om weg te halen. Komen er meer tegelijk, dan wachten ze op hun beurt.
- Momenten (data/campagne.json, berichten per level en berichtenAltijd): tijd, aanval, eigen burcht of koning onder een percentage, burcht of koning van rood onder een percentage. Levels 1 tot 3 hebben elk vier berichten; drie algemene berichten gelden overal.
- Wat al getoond is, onthoudt het spel per level; na herladen komt het niet terug. Opnieuw beginnen wist dat.
- Terugblik bij winst: portret van de verslagen heer, slottekst, een apart blok met Wessels portret en het voorwerp, en wat je vrijspeelt. Bij verlies het rouwende portret van Karel.
- Nieuw: js/verhaal.js, tests/verhaal31.mjs (20 controles).

## 0.34.0 (stap 32): elke heer speelt anders en is zelf de rode koning
- campagne.json heeft per level een blok rood: sterkte (procent), eerste aanval, tempo (procent), legermengsel, wachters, rammen en extra soorten. Dit komt bovenop het profiel (js/modus.js, pasRoodToe).
- Levels 1 tot 3: Reinout valt na 4 minuten aan met alleen ridders en schutters, zonder katapult of toren, en zijn koning heeft 80% leven. Mechteld heeft veel schutters en kruisbogen, houdt 5 man thuis en valt trager aan (tempo 70). Hademar stuurt bijlridders en vroege rammen, iets minder sterk dan het profiel zwaar (90%), maar zijn koning heeft 130% leven.
- Levels 4 tot 10 hebben hun blok rood al, voor later.
- De rode koning draagt de kleuren en het wapen van de heer: speer, boog, strijdhamer, jachtspies, zwaard met torenschild, moker, hellebaard, boothaak, zwaard, rouwscepter. Haar en baard per heer; Mechteld met vlecht. De mantel en een zoom blijven rood: dat is het team.
- Nieuw: tests/rood32.mjs (10 controles, en een plaat van alle tien heren). test_stap17 en rood29 aangepast op de nieuwe waarden.

## 0.34.1: Mechteld schiet pijlen
- Een rode koning met een boog schiet nu echt: koning.schiet in campagne.json (bereik 5,5 tegels, schade 14, om de 1,7 s, let op wie binnen 7 tegels van haar burcht komt). Alleen Mechteld (level 2). De andere heren slaan.
- Voorbereiding stap 33 in js/kaart.js: het kasteel van rood kan uit een ontwerp komen (ringen, poorten, gracht). Nog niet aangesloten; zonder ontwerp blijft alles gelijk.
