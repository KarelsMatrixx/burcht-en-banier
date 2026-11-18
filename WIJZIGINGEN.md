## 0.70.4
- De belegeringstoren is hoger dan een poort en kan er niet doorheen (economie.json: toren.hoog). Hij ziet elke poort als dicht, klimt niet en breekt geen poort (wegvinden.js: beelden 3 tot 5, HOOG).
- Rode torens verschijnen buiten de muren, in het open veld. Jouw toren wordt alleen opgeleid als hij buiten je muren kan staan; anders meldt de werkplaats dat hij buiten je muren moet staan.
- Tik je een toren naar een plek achter een poort, dan zegt het spel dat hij te hoog is voor de poort. Ram en katapult kunnen er nog wel door (tests/hoog70.mjs).

## 0.70.3
- Stillwater (level 5): rond het kasteel van de rode koning staan nu paardenstallen als decor (kastelen.json, abdij.decor; nieuw decorsoort 'stal' in kaart.js).

## 0.70.2
- Fout opgelost: na 'Keep playing' bleef het volgende level dicht in het menu en op de levelkaart, omdat de lijst met gewonnen levels maar één keer bij het laden werd gelezen. Nu wordt hij elke keer opnieuw gelezen (tests/menu70.mjs).
- Stillwater: rode ruiters komen al vanaf aanval 2 (max 2) in plaats van vanaf aanval 5.

## 0.70.1 (deel 5)
- Stillwater (level 5): de banierdrager van rood komt nu echt in aanval 2, zodat Bartholts tip klopt (vanaf 1 en vast in extra_soorten).
- Stillwater: vanaf aanval 4 zijn de aanvallen van rood ongeveer 2x zo groot (heer.doelVanaf in campagne.json, gelezen in rood.js en modus.js).

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

## 0.35.0 (stap 33): kastelen voor rood
- Nieuw: data/kastelen.json met tien ontwerpen: ring, klein, dubbel, jachtkamp (vier poorten), abdij, werkplaats (twee poorten), drie poorten achter elkaar, gracht (water met dam), bergfort, drie ringen met poorten aan steeds een andere kant.
- Een ontwerp is een lijst ringen (maat, poorten) en eventueel een gracht. Hoeken worden torens, het midden van een zijde zonder poort een wachttoren. Elk level kiest er een in campagne.json (kasteel). Level 1 Reinout: klein. Level 2 Mechteld: ring. Level 3 Hademar: dubbele muur.
- js/kaart.js bouwt het kasteel van rood uit het ontwerp: maakt eerst de plek vrij, zet de ringen, de gracht met dammen, en zoekt de werken van rood rondom (ook aan de rand van de kaart). Wachters krijgen routes over alle ringen, de buitenste eerst. Zonder ontwerp (vrij spel) blijft het oude kasteel.
- Wegvinden en herbouw van rood werkten al met elk muurstuk; ze zijn niet veranderd. Getest: rood komt eruit, jij komt er pas in als de poorten weg zijn, en in level 3 breek je door twee poorten en win je.
- Nog niet: een palissade van hout (het jachtkamp is nu een kleine stenen ring met vier poorten).
- Nieuw: tests/kasteel33.mjs (45 controles: elk ontwerp op elke kaart). kaarten24 kijkt nu voor de buitenste poort.

## 0.36.0: kastelen volgens het kastelenontwerp
- Uitgewerkt naar claude/kastelenontwerp.md (chat vijandkastelen per level). Elk kasteel heeft een materiaal: steen, dor bruin, ruwe rots, grijs steen, abdijsteen, zwart, hout. Muur, torens, poort en burcht van rood krijgen die kleur (eigen plaatjes rood.muur enzovoort; js/tekenaar.js kiest ze op eigenaar).
- Level 1 Reinout: het bestaande kasteel in dorre bruine tinten, 4 wachters. Level 2 Mechteld: rotsvesting met ronde torens ook midden op de muren, muren te hoog voor ladders (alleen de belegeringstoren; melding als je het met ladders probeert). Level 3 Hademar: mijnburcht van grijs steen met twee ringen.
- Levels 4 tot 10 kregen hun voorlopige vorm en materiaal: jachtkamp (hout), abdij met twee ringen en gracht (wit), belegeringswerf (rots), tolkasteel met drie poorten (grijs), dijkburcht met twee ringen en brede gracht (grijs), bergfort met ringen op 5 en 9 (zwart), Rouwburcht met drie ringen (zwart).
- Muren, torens en poorten van rood: leven per level volgens de kolom sterkte rood (100% in level 1, 115% in 2, 130% in 3, tot 240% in 10). Veld rood.muur in campagne.json.
- Beloningen verschoven zodat de eenheid die een kasteel vraagt er op tijd is: na Reinout de belegeringstoren en de kopermijn, na Mechteld de katapult en de kruisboog, na Hademar de bijlridder. Slotteksten en berichten van level 1 tot 3 aangepast.
- Grote kastelen: de werken van rood blijven uit de gang tussen de twee kastelen, en het pad ruimt daar ook rotsen en decor op.
- Tests: kasteel33 (55 controles, met materiaal, muurleven en hoge muren), campagne30, verhaal31 en test_stap17 aangepast.

## 0.36.0 (sprites, uit een andere chat): nieuwe heren, soldaten, werkers, machines en koning
- Nieuw: js/heren.js. De tien rode heren in een eigen stijl (herkenbaar aan silhouet, wapen en kleur, zonder kroon; gouden ring onder de voeten). campagne.json: elke heer heeft een veld "figuur" in uiterlijk; kunst.js tekenKoning stuurt door naar tekenHeer als die sleutel bekend is. Jouw blauwe koning en de rode koning in vrij spel blijven het oude beeld.
- Nieuw: js/soldaten.js. Zeven soldaten (ridder, bijlridder, boogschutter, kruisboogschutter, sluipmoordenaar, vlammenwever, ladderdrager) en acht werkers (houthakker, steenhouwer, fruitteler, zager, tarweboer, bakker, mijnwerker, boer) met zachte schaduw, donkere omlijning, licht van rechts en teamkleur. Werkers verschillen in silhouet door gereedschap en hoofddeksel. assets.js stuurt deze vormen naar soldaten.js; de oude functies in kunst.js blijven als reserve. Ram, katapult, belegeringstoren en beide koningen ongewijzigd.
- Beeldcontract gelijk (4 loopbeelden, sla of schiet met 2 beelden, last en hak met 4); het canvas van soldaten is 52 bij 40.
- Tests: tests/heren35.mjs (88 controles) en tests/soldaten36.mjs (260 controles), beide 0 mislukt op de stand voor het samenvoegen met stap 33.
- Bekend: nog niet op iPhone bekeken; gouden ring van de heer kan botsen met selectie of aanvalsring; levensbalk van de heer ca. 12 px hoger, die van soldaten ca. 2 px; Ottger heeft een zwarte mantel met rode voering; steenhouwer en mijnwerker lijken op elkaar; blauwe koning nog oud beeld met kroon.
- Machines: js/machines.js tekent ram, katapult en belegeringstoren opnieuw in dezelfde stijl (huiden in teamkleur, ijzerbeslag, draaiende wielen, vlag en schilden). De belegeringstoren is veel hoger (doek 74 bij 114, voorheen 52 bij 60) met drie verdiepingen, kantelen en een valbrug. De oude tekenfuncties in kunst.js blijven als reserve.
- Koning: jouw blauwe koning (en de rode koning in vrij spel) is nu "koning" in js/heren.js, dezelfde stijl en maat als de heren: geen kroon, bontkraag met gouden speld, bruin haar en baard, zwaard en schild in teamkleur, zwarte rouwband bij jou, gouden ring onder de voeten. assets.json: veld "figuur": "koning" bij beide koningen. heren35 verwacht nu de nieuwe maat (76 bij 64).
- Test: soldaten36 heeft nu 318 controles (ook ram, katapult, toren, koning); oude tests nog groen.
- Bekend: valbrug van de toren is klein getekend; levensbalk van de toren staat ca. 108 px boven de voeten; contragewicht van de katapult is een los grijs blok; gouden ring bij heren en koning; nog niet op iPhone gezien.

## 0.37.0: samengevoegd
- De nieuwe figuren (branch sprites-heren, uit de chat "Gedetailleerder en mooier maken van game") samengevoegd met de kastelen van 0.36.0. Beide waren 0.36.0 genummerd; samen 0.37.0.

## 0.38.0 (stap 34): kaartvormen
- Een kaart kan een vorm hebben (veld vorm in data/kaarten.json; js/kaart.js stap 1b): pas (dal tussen rotswanden, smal in het midden), kloof (langer smal stuk), rotsrug (rug van rotsen dwars over het midden met twee openingen), moeras (plassen met paden), polder (water aan beide kanten met een dijk van rotsen). Rond de kastelen blijft het land vrij, de kaart blijft gespiegeld en de weg tussen de kastelen blijft gegarandeerd.
- Vijf nieuwe kaarten: The Sevenwinds Pass (level 2), The Ironmarsh (level 3 en voorlopig 4), The Giant's Spine (level 6), The Greyford Gorge (level 7), The White Dike (level 8). Level 1 blijft The Green Vale.
- Rotsen zijn gewone steen: onbegaanbaar, en een steengroeve kan ertegen.
- Tests: tests/kaartvorm34.mjs (15 controles plus beelden). kasteel33 test nu elk kasteel op alle negen kaarten (110 controles); in de doorbraaktest van level 3 zijn de soldaten nu echt onkwetsbaar (het gaat om de route). kaarten24 en verhaal31 op de nieuwe kaarten.

## 0.39.0: machines en koning
- Ram, katapult, belegeringstoren (veel hoger) en de koning in de nieuwe stijl, bovenop 0.37.0 en de kaartvormen van 0.38.0 (main bevatte de heren, soldaten en werkers al).

## 0.40.0: nieuw landschap
- Nieuw: js/landschap.js. De grond (gras, zand, water, aarde) is niet meer een rij losse ruitvormige tegels maar één doorlopend beeld. Geen zichtbare ruitjes meer; kusten en stranden zijn zacht en onregelmatig in plaats van trapjes; water wordt dieper en donkerder van de kust af, met schuim langs de rand; waar gras aan water grenst ligt een smal strand; lichte en donkere graskleuren lopen vloeiend in elkaar; grassprieten, bloemen, steentjes en rimpels staan op vaste plekken.
- Het spel zelf verandert niet: wat water, zand of land is staat nog in kaart.grond. De kust is ten hoogste ca. 0,25 tegel verschoven ten opzichte van de tegelrand.
- tekenaar.js: de grond komt uit het landschap. Alleen akkers blijven losse tegels (bewust rechthoekig), met hun zachte rand.
- Stukken van 256 bij 128 wereldpixels worden pas gemaakt als ze in beeld komen. Eerst staat er een vlugge, vage versie; die wordt per beeld binnen 14 ms stuk voor stuk scherp gemaakt. Maximaal 90 stukken (ca. 45 MB) in het geheugen.
- Bekend: nog niet op iPhone gezien (geheugen en snelheid daar nog niet gemeten); de rand van de kaart is nog een rechte ruit; bij snel scrollen is de grond heel even vaag.
## 0.38.1: machines en koning (uit de sprites-chat)
- Ram, katapult, belegeringstoren (veel hoger) en de koning in de nieuwe stijl, bovenop 0.37.0 (main bevatte de heren, soldaten en werkers al).

## 0.41.0 (stap 35): adviseur, logboek en nieuwe bediening
- Samengevoegd met 0.40.0 (landschap, uit een andere chat).
- Plaatjes van Karel (Gemini): medaillon, hamer, zwaard, buidel, perkamentrol, tandwiel, sloophouweel, rand van de adviseur, teller-zegel, logboekrol, lint en vijf zegels. Magenta weggeknipt en verkleind naar beelden/hud/*.webp (samen ongeveer 120 KB).
- Linksboven de adviseur: portret van Bartholt in een gouden rand, met een rood zegel dat telt hoeveel nieuwe berichten er zijn. Tik erop voor het logboek: een perkamentrol met alle berichten (nieuwste boven), een zegel per soort en een speeltijd. Tik op een zegel om te filteren.
- Vijf soorten berichten: vijand (rood), economie (goud), leger (blauw), verhaal (paars), uitleg (groen). Alles gaat in het logboek. In beeld komt alleen wat ertoe doet: vijand, leger en verhaal altijd, economie alleen als het dringend is (voedsel op, volk ontevreden), uitleg alleen als het een antwoord op je actie is. Hooguit twee tegelijk, als rood lint met het zegel ernaast.
- Als een figuur uit het verhaal praat, staat zijn portret even in de adviseur.
- Rechtsonder vier medaillons in een boog: hamer (bouwbalk), zwaard (legerknoppen), buidel (je volk en belasting), rol (menu met de levelkaart). Hooguit één paneel open; het spel onthoudt welk voor deze sessie. Kies je soldaten op de kaart, dan gaat het zwaard vanzelf open.
- Rechtsboven het tandwiel: titel, versie, Test en To start. De oude knoppen Menu, Test en To start bovenin zijn weg.
- Tests: tests/hud35.mjs (27 controles). Andere tests openen de bouwbalk via de sessie en lezen berichten uit het logboek; selectie tikt eerst het zwaard aan.

## 0.41.1: schuiven werkt weer
- De rijen knoppen (bouwbalk, legergroepen, kazerne) en het logboek en menu schuiven nu met je vinger. De pagina staat op touch-action: none (tegen zoomen van Safari), waardoor de browser zelf niet schoof; js/ui.js doet het nu zelf (sleepbaar). Een veeg telt niet als tik.
- Het paneel van de kazerne, de voorraadkamer en je volk ligt boven de linten met meldingen.
- Nieuw: tests/ladder35.mjs: in level 1 zet een ladderdrager met tikken een ladder tegen de muur van Reinout; in level 2 (te hoge muren) niet, met melding.

## 0.42.0: nieuwe pictogrammen in de voorraadbalk
- De kleine getekende blokjes (hout, planken, steen, voedsel, boeren, goud, populariteit, aanval, tarwe, brood, koper) zijn vervangen door vectorplaatjes in beelden/hud/res/ (SVG: scherp op elke schermgrootte), in dezelfde stijl als de figuren: donkere omlijning, licht en schaduw. Populariteit heeft een blije en een boze versie (de boze verschijnt als de populariteit slecht is).
- css/stijl.css: de oude CSS-tekeningen zijn weg; een pictogram is nu 24 px en kiest zijn plaatje via de bestaande klasse (icoon-hout enzovoort). Aan de code en de tests verandert niets.
- sw.js: de plaatjes staan in de bewaarlijst voor offline gebruik.

## 0.43.0: ladder, zagerij en het oog
- Ladder: tik je met een ladderdrager gekozen op een stuk muur waar een wachter van rood staat, dan telde dat als aanval op die wachter. Een ladderdrager vecht niet, dus er gebeurde niets en je kreeg geen melding. Nu zet de drager er een ladder tegen en vallen de andere gekozen soldaten de wachter aan. Kan de drager de muur niet bereiken, dan zegt hij dat nu ook.
- Zagerij: de zager laat altijd 30 hout liggen voor het bouwen (data/economie.json, beroepen.zager.reserve). Daarboven zaagt hij gewoon door. Zo kun je altijd nog een houthakkershut kopen (20 hout).
- Nieuw: het oog rechtsboven, naast het tandwiel. Tik erop en alle gebouwen en bomen worden doorzichtig, met hun grondvlak als ruit op de grond (rood voor rood). Zo zie je troepen achter een gebouw. Nog eens tikken zet het terug.
- Tests: ladder35 (7, nu ook met wachters op de muur), planken21 (reserve), hud35 (31, met het oog).

## 0.44.0: menu achter het tandwiel, de rol toont je doel
- Het tandwiel rechtsboven opent nu het spelmenu: Resume, Save game, Start over (twee keer tikken), Level map, Main menu, Back to my keep en klein de Performance test. Zolang het menu open staat, staat het spel stil.
- Start over stond eerst verstopt in de prestatietest; nu in het menu.
- De rol rechtsonder bracht je meteen naar de levelkaart. Nu toont hij het doel van dit level: titel, tegen wie, de intro en je opdracht. De levelkaart zit in het menu.
- Tests: hud35 (48), menu19 (rol en Level map), test_stap17 (menu via het tandwiel).

## 0.45.0 (stap 35 campagneplan): de proloog is speelbaar
- Nieuw: js/proloog.js. Proloog "The Last Peaceful Day" (level 0) staat open op de levelkaart en in het menu.
- Bartholt geeft acht taken, één tegelijk, met de taak rechtsboven in beeld en de hele lijst achter de rol: houthakkershut, steengroeve, boomgaard, woning, kazerne, twee soldaten opleiden, een soldaat sturen, muur met poort.
- Heer Reinout staat als gast bij je burcht (alleen om te zien) en zegt iets tijdens het feest.
- Als de lijst af is (of na elf minuten) wordt het avond: Bartholt waarschuwt voor een overmacht, Reinout is weg en het wordt donker. 's Nachts gaat je poort van binnenuit open (ook voor rood een doorgang) en verschijnen 14 plus twee per eigen soldaat vijanden rond je burcht, elke 50 seconden zes erbij.
- Je koning sneuvelt niet en je burcht valt niet; de burcht van rood is onkwetsbaar en heeft geen koning. Er is geen winst of verlies.
- Na vier minuten nacht, of als je burcht onder 40% komt, volgt een scène in vijf kaarten (Wessel weggedragen, de brief "Come and get him", de Rouwbanier van Ottger). Daarna de levelkaart; de proloog telt als gedaan.
- Eigen profiel "proloog" in data/missies.json met meer beginvoorraad. strijd.js: R.proloog; stuurLeger kan rond een andere plek verschijnen; wegvinden.js: zetPoortenOpen. tekenaar.js: nacht.
- Tests: tests/proloog35.mjs (30). campagne30 en test_stap17 kennen nu de open proloog.

## 0.46.0 (stap 36): level 4 The Fen, en de proloog naar Karels feedback
- Proloog, rustiger: eerst zes seconden rondkijken; na elke taak een compliment van Bartholt en negen seconden rust voor de volgende. "Een soldaat sturen" telt alleen een bevel van de speler (soldaten die uit de kazerne lopen tellen niet meer; daardoor sprong de lijst eerst te snel door). De muurtaak is nu "zet een soldaat op de muur": de ringmuur staat er al.
- Proloog, nieuwe kaart Aldervale (84 bij 84): geen kasteel van rood, jouw kasteel met ringmuur en poort staat er al, veel meer huisjes, twee gehuchten, feesttenten en feestvlaggen (nieuw decor dorp.vlaggen, kunst.js tekenVlaggen). Geen rode heer en geen klok bovenin. Start over in de proloog laadt de proloog opnieuw.
- Level 4 The Fen is speelbaar (doeltype B, js/doel.js): de hut van Moeder Gesina staat midden in het moeras en is van jou (niet te slopen). Houd hem 8 minuten. Jagers van Brandt komen in golven (eerst na 40 s, dan elke 55 s, 4 tot 10 man: sluipmoordenaars, boogschutters, ridders) en gaan eerst op de hut af. Valt de hut, dan verlies je. De klok staat rechtsboven. Nieuwe kaart The Fen (moeras). De hut komt nooit op een pad te staan dat de enige doorgang is.
- strijd.js: zetHut, hut, beslis; vijanden gaan eerst op de hut af. bouwen.js: zetVast (beschermd bouwwerk).
- Tests: proloog35 (39), hut36 (21).

## 0.47.0 (stap 37): zwaardvechter, banierdrager, heler; level 5 Stillwater Abbey; neerzetten met de hamer
- Neerzetten met de hamer (wens van Karel): staat er iets klaar om te bouwen of te slopen, dan gloeit de hamer rechtsonder en staat er Place (of Demolish) onder. Tik de hamer om het neer te zetten. De losse knop Place is weg; Done blijft.
- Nieuwe soldaten (legerontwerp ronde B, zelf getekend in soldaten.js):
  - Swordsman (klassiek, 14 goud en 2 koper): 72 leven, snelle korte slag, rond schild halveert pijlschade.
  - Banner Bearer (klassiek, 20 goud en 2 koper): vecht niet; jouw soldaten binnen 4 tegels slaan 15% harder. Vaandels stapelen niet (ook niet met dat van de koning: de sterkste telt).
  - Healer (mystiek, 20 goud en 10 brood, twee boeren): vecht niet; geneest elke seconde de zwaarst gewonde soldaat binnen 3 tegels met 4% van diens leven, niet zichzelf. Een gouden gloed laat zien wie hij geneest.
  - Banierdrager en heler staan bij Afstand in de legerknoppen. Rood kan ze ook kopen.
- Level 5 Stillwater Abbey speelbaar: kaart The Two Lakes, de abdij met twee witte ringen en een bredere gracht (2), Aleid met zwaardvechters, banierdragers, boogschutters en ridders. Berichten van Bartholt, Aleid en broeder Ludolf. Win je, dan krijg je zwaardvechter, banierdrager en heler.
- Tests: ronde37 (15); planken21 controleert de hamer; tests die Place aantikten tikken nu de hamer.

## 0.47.1: de rode heer staat in beeld
- De heer van rood (in level 2 Mechteld met de boog) verscheen aan de achterkant van zijn burcht en stond daardoor verstopt achter de toren. Hij begint nu aan de voorkant, naar de camera toe.

## 0.47.2: de rode heer loopt rond
- Zolang er niemand in de buurt komt, loopt de heer van rood rond over zijn binnenplein: om de 4 tot 9 seconden naar een ander plekje 2 of 3 tegels van zijn burcht. Komt er een vijand dichtbij, dan valt hij aan zoals eerst, en daarna loopt hij weer terug.

## 0.47.3: bouwgebied en zachter level 4
- Nieuw: je bouwt alleen binnen 14 tegels (vierkant) van het midden van je burcht (economie.json, bouwStraal). Daarbuiten krijg je "this is too far from your keep". Zo kun je de hut van Gesina in level 4 niet meer omsluiten. Bewaarde spellen met bouwwerken erbuiten blijven werken.
- Level 4: eerste golf na 150 s (was 40), 3 man in de eerste golf (was 4), elke 70 s (was 55), hooguit 8 (was 10). Allemaal schattingen tot Karel het speelt.
- Test: tests/bouwstraal38.mjs (7 controles, groen).
- - Stone mine (was Quarry) en kopermijn moeten nu direct tegen steen of koper staan (afstand 1, was 2).
- Soldaten en werkers lopen nu dwars door bos (bomen blokkeren het pad niet meer).
- Bekend: de grens is nog niet zichtbaar op de kaart; de koperaders in het midden van sommige kaarten liggen erbuiten.

## 0.47.4: nieuwe grondstoffenbalk
- De balk bovenin toont alleen de kern: hout, steen, voedsel, goud en boeren, met een pijltje dat zegt dat je kunt tikken. Een getal kleurt een seconde groen (erbij) of rood (eraf). Iets anders (planken, stemming, een volle opslag) komt er alleen bij zodra het in het rood staat. Voedsel staat in het rood als er minder is dan voor één maaltijdronde.
- Tik je op de balk, dan opent het paneel met alle grondstoffen met plaatje, naam, aantal en de verandering van de laatste minuut (elke 5 s gemeten; uitgeven telt mee, dus een gebouw neerzetten geeft een min). Koper staat pas in beeld als de kopermijn is ontgrendeld.
- De klok van rood is weg in levels waar rood niet vanzelf aanvalt (level 4 toonde 1661:59).
- Niet gedaan: de klok verhuist niet naar de taakbalk, hij blijft in de balk als rood wel aanvalt.
- Test: tests/balk38.mjs; koper23 aangepast (koper staat in het paneel, niet in de balk).
## 0.48.0 (tussenstap na 37): slimmere aanvallen van rood, de veldheer
- Aanleiding (Karel, 14 november): rood stuurde alles in één keer. Elke soort loopt een eigen tempo (ridder 2,0, boogschutter 2,2, ram 0,9, belegeringstoren 0,7 tegels per seconde), dus de ridders kwamen als eerste aan en werden neergeschoten, en de rammen en ladders kwamen te laat.
- Nieuw: js/veldheer.js. Rood legt een plan over elke aanval, in vijf lagen. Het niveau (1 tot 5) bepaalt hoeveel lagen meedoen: laag 1 is niveau 1, laag 1 en 2 is niveau 2, enzovoort.
  1. Samen aankomen: elke man wacht zo lang dat ram, ladder, ridders en schutters bij jouw muur ongeveer tegelijk zijn (machines 1,5 s eerder, schutters 0,8 s later). De route wordt gemeten met één A*-zoektocht per bestemming (strijd.routeLengte). Meting in tests/veldheer38.mjs: 32 s spreiding zonder plan, 8 s met plan.
  2. Golven met rol: tot 3 verkenners (de snelste) vooraf, de hoofdmacht, een tweede lijn (25%) die later volgt, en een thuiswacht (10 tot 15%, liefst schutters, nooit machines) die achterblijft voor een uitval en de volgende aanval.
  3. Doelkeuze: rood zoekt het zwakste stuk muur of poort van jou (soldaten en torens in de buurt, beschadiging, afstand) en valt daar eerst aan; een deel (flank, 35%) kiest een tweede bres minstens 9 tegels verder. Ladders en torens zetten hun ladder bij de bres. Bij level 4 komt een deel van de jagers via een omweg aan de andere kant van de hut.
  4. Tegenzetten: rood past zijn mengsel aan op jouw leger. Veel schutters bij jou: meer schilden (pijlDekking onder 1) en sluipmoordenaars, minder eigen schutters, een ram extra. Vooral ridders bij jou: meer schutters en vlammenwevers. Alleen soldaten die het level al kent.
  5. Terugtrekken: verliest een groep (minder dan 50% van haar leven over), dan trekken mannen met minder dan 55% leven zich terug naar hun burcht, rusten er uit (dubbel zo snel als jouw soldaten) en komen met minstens drie samen terug.
- Moeilijker over tijd: het niveau stijgt elke 4 aanvallen met één (tot max van het level), en vanaf niveau 3 is elke derde aanval een piek (doel 35% hoger, daarna 30% langere rust). Niveau per level in data/campagne.json onder rood.aanval: level 1 niveau 1 (max 2), level 2 niveau 2, level 3 niveau 3, level 4 niveau 3 met flank 50%, level 5 en 6 en 7 niveau 4, level 8 tot 10 niveau 5. Vrij spel begint op niveau 2.
- De speler krijgt een waarschuwing in het logboek ("Red masses at your south-west wall!") zodat gerichte aanvallen niet vals aanvoelen. Teksten door Claude geschreven.
- Techniek: strijd.js krijgt per krijger een plan (strijd.tak: houdTot, doel, via, terug, groep), tactiek() en terugStap() in denk(), bereikbaar(), routeLengte(), koppelVeld(). stuurLeger geeft het plan alleen bij een echte aanval met een rode heer of een hut (niet bij een uitval of in de proloog). rood.js: piek, rust, thuiswacht, tegenzetten. Het plan wordt niet bewaard: na laden lopen mannen die al onderweg waren op de oude manier verder. sw.js: veldheer.js in KERN.
- Bekend: de timing gaat uit van de gemeten route zonder jouw gebouwen; stuit een groep onderweg op jouw soldaten, dan vechten ze en loopt de timing uit elkaar. Flank werkt alleen als jouw muur twee bressen met minstens 9 tegels afstand heeft. Schutters stoppen op afstand en tellen mee in de timing, maar komen soms later aan. Niets hiervan is op de iPhone gespeeld; alle waarden zijn startwaarden voor de eerste testronde.

## 0.49.0 (stap 39): steenwachter en level 6 De Reuzenrug
- Nieuw: steenwachter (mystieke kazerne, 40 goud + 30 steen + 6 koper, 2 boeren). Reus van steen: 300 leven, schade 13, traag (1,1), pijlen doen maar een kwart. Neemt twee legerplekken in (`legerPlekken`), kan niet via ladders klimmen (`nietKlimmen`). Bijlridder doet 1,5 keer zoveel schade tegen hem (`bonusTegen`). Rood koopt hem nog niet (gewicht 0).
- Legermaximum telt nu plekken in plaats van soldaten (leger.plekken()); de bovenbalk toont "Army places".
- Nieuw doeltype C (js/loodsen.js): level 6 De Reuzenrug is speelbaar. Slecht twee bouwloodsen van Lambrecht (OBJECT.LOODS, eigenaar rood, 360 leven) buiten zijn muren. Plekken volgen uit de kaart (twee flanken, 11 tegels van rood) en blijven na herladen gelijk; wat gevallen is blijft gevallen en wordt niet herbouwd (strijd.js: roodWeg alleen voor het oorspronkelijke kasteel).
- Druk: vanaf 150 s een golf, daarna elke 100 s, steeds groter (3 + 1 per golf, hooguit 9), rammen vanaf golf 3 en een katapult vanaf golf 5. Valt er een loods, dan komen de golven 1,6 keer zo traag en 40 procent kleiner. Beide weg is winst, een gevallen koning verlies.
- Beloning van level 6: steenwachter (beschikbaar vanaf level 7 en in vrij spel). Teksten van Lambrecht en de uitleg zijn door Claude geschreven.
- Test: tests/ronde39.mjs. Aangepast: test_stap17 (11 menuknoppen), versietests.

## 0.49.1: level 5 moeilijker en de veldheer repareert zich in grote levels
- Aanleiding (Karel, 14 november, level Stillwater): de troepen kwamen niet goed samen aan, het level was te makkelijk, rood mocht vanaf het begin meer troepen sturen en er moesten veel meer soldaten in het kasteel zijn.
- Oorzaak 1, ladders te laat: de ladderdrager zoekt een vrij vakje naast de muur. Rammen en ridders die al onderweg waren hadden die vakjes als bestemming gereserveerd, dus de drager vond niets, gaf drie keer op en bleef staan tot de ram de bres had geslagen (in de test 25 seconden te laat). Nu telt voor de ladder alleen wie er echt staat (strijd.js, plekRond met fysiek = true).
- Oorzaak 2, timing: de veldheer mat de route één keer voor het eerste mannetje en paste die verhouding op iedereen toe. Bij een gracht en ringmuren loopt wie binnen de muren begint een heel andere weg. Nu wordt de route van elk mannetje zelf gemeten (veldheer.js, één zoektocht per beginvak en bestemming). Meting in level 5 met een ringmuur: ram, ladders en ridders binnen ongeveer 5 s van elkaar (eerder 30 s); schutters ongeveer 5 s later en de tweede lijn bewust 22 s later.
- Level 5 (campagne.json, rood): eerste aanval na 150 s (was 200), tempo 130 (was 100), 10 wachters op de muren (was 4), eerste aanval 9 man in plaats van 5 (doelBegin 9, doelPerAanval 2,5, doelMax 30, begin met 140 goud), thuiswacht 20%. Nieuw in modus.js: rood kan begin, doelBegin, doelPerAanval en doelMax per level zetten.
- Bekend: alle waarden zijn schattingen; niet op de iPhone gespeeld. De tweede aanval en later zijn niet gemeten met een spelende speler.

## 0.49.2: level 6 met veel meer troepen, in vaste golven
- De druk in level 6 is nu een vast draaiboek (`druk.golven` in campagne.json, uitgelezen door js/loodsen.js) in plaats van een formule. Zes golven, oplopend tot 25 man: scouts (6, na 150 s), vanguard (8), ram column (11), axe knights (15), siege train (20, met katapult en kruisbogen), whole host (25, met toren). Wachttijden 100, 100, 110, 120, 130 en 150 s; de laatste golf blijft terugkomen.
- Twintig seconden voor elke golf komt een waarschuwing van de verkenners.
- Valt er een loods, dan zijn de golven 40% kleiner en komen ze 1,6 keer zo laat.
- Alle getallen zijn schattingen en door Claude gekozen; nog niet op de iPhone gespeeld.

## 0.49.3: lijfwachten van de rode heer (level 5)
- Wens van Karel (14 november): in Stillwater lopen twee zwaardvechters achter de rode heer aan als lijfwacht.
- Nieuw in campagne.json bij `rood`: `lijfwacht: { soort, aantal }` (hooguit 6), verwerkt in modus.js. Level 5 heeft twee zwaardvechters.
- Gedrag (strijd.js, `lijfwachtDenk`): ze staan bij de start naast de heer, lopen mee als hij over zijn binnenplein loopt (meestal binnen 3 tegels), en vallen aan wie binnen 7 tegels van de heer komt. Valt de heer, dan verdedigen ze de burcht. Ze doen niet mee aan aanvallen en tellen niet als aanvallers. Ze worden bij opnieuw beginnen of laden vers aangemaakt (hun leven wordt niet bewaard). API: `strijd.lijfwachten()` en `strijd.roodKoning()`.
- Test: tests/lijfwacht39.mjs (9 punten). Niet op de iPhone gezien: of twee zwaardvechters naast de heer er goed uitzien en de tegels van het binnenplein niet te vol worden.

## 0.51.1 (eerder 0.49.4 en 0.50.6 genoemd): vrijere rode koning, torens van twee, hoofdkasteel van vijf, rustiger Stillwater, meer soldaten per level
- Rode koning (strijd.js, `koningDenk`): zwerft veel verder (zwerfStraal 22 tegels, in economie.json bij de koning), loopt om zijn kasteel heen en af en toe over eigen muren, torens en het dak van zijn kasteel. Is er onraad (soldaten van jou binnen alarmAfstand 9 van zijn burcht of van hem, een beschadigde burcht, of hij zelf gewond), dan loopt hij meteen terug naar zijn hoofdkasteel. Op een muur die onraad merkt, gaat hij eerst naar beneden.
- Torens (leger.js): in een toren (ook wachttoren) passen altijd twee soldaten; ze staan dan naast elkaar.
- Hoofdkasteel (wegvinden.js, leger.js): het hoofdkasteel van jou en van rood is te beklimmen; er passen samen 5 soldaten op het dak (een per tegel van de ring). Rood zet er zelf nog niemand neer.
- Stillwater (campagne.json level 5): tien aanvallen die oplopen van 4 naar 16 man (doelBegin 4, doelPerAanval 1,35, doelMax 16), geen piekaanvallen meer (`piekElke: 0`, nu per level in te stellen via veldheer.js), en tweemaal zoveel tijd tussen de aanvallen (tempo 130 naar 65, ongeveer 154 s). Na de tiende aanval blijft de aanval van 16 terugkomen.
- Legermaximum per level (`rood.legerMax`, modus.js): level 0 tot 4 blijft 40; level 5 tot 7 wordt 60; level 8 tot 10 wordt 80.
- Tests: koning40, torens40, stillwater40 nieuw; koning, lijfwacht39 (alle binnen 14 tegels, 70% binnen 8) en level5_39 aangepast.
- Aannames (Claude): wachttoren ook twee; alle zwerfgetallen en percentages muur zijn schattingen; level 8 valt onder 80 (Karel noemde 8 twee keer); de rode koning stapt zelf nog niet op het dak van zijn hoofdkasteel als hij daar plek heeft; niet op de iPhone gespeeld.
- Level 1 (Witherheath) is pas open na het winnen van de proloog (`isOpen` in modus.js); eerder mocht je de proloog overslaan. Tests campagne30 en menu19 aangepast.
## 0.50.0: nieuwe titel Aldervale, logo, knoppen en app icoon
- De game heet nu Aldervale, met de ondertitel Banners of the Vale (besluit van Karel, 14 november). Aangepast in index.html (titel, apple-mobile-web-app-title, instellingen, draai-melding) en manifest.webmanifest (name, short_name, description).
- Nieuw logo linksboven op het beginscherm (`beelden/titel/logo.webp`, door Karel gemaakt met Gemini). De ondertitel staat als echte tekst op het lint (`#titel-ondertitel`), zodat de letters niet fout kunnen gaan.
- Nieuwe knoppen Campaign, Free play en Continue: lege houten platen (`beelden/titel/knop_*.webp`) met de tekst door de code erop. Campaign is blauw met goud, Continue hout met goud, Free play hout met ijzer.
- Nieuw app icoon (banier met elzenblad op donkerblauw) in icons/icon-180, -192 en -512. Het maskable icoon gebruikt hetzelfde plaatje.
- sw.js: vier nieuwe bestanden in KERN, versie opgehoogd.
- Bekend: een geïnstalleerde app op het beginscherm toont het oude icoon en de oude naam tot je hem verwijdert en opnieuw toevoegt. Het blad op de banier lijkt meer op een berken of esdoornblad dan op een els. De schaduw rond de letters heeft een zwakke rode rand door de magenta achtergrond.

## 0.50.1: vlaggen wapperen, ondertitel past, knoppen gelijk, tagline weg
- Op het beginscherm wapperen de vlaggen van het schilderij rustig in de wind (nieuw: js/vlaggen.js, canvas `#titel-vlaggen`). De achtergrond `beelden/startscherm.webp` is nu zonder vlaggen; acht vlaggen staan als losse plaatjes in `beelden/titel/vlaggen/`. Wimpels golven op en neer, de grote banier waait van de paal weg. Duur van een golf 5 tot 7 seconden. Bij "minder beweging" (iOS-instelling) staan ze stil. De animatie stopt als het beginscherm dicht is of de levelkaart open staat.
- De ondertitel Banners of the Vale schaalt nu mee met het logo en blijft binnen het lint.
- Campaign, Continue en Free play zijn even groot.
- De zin "Build your keep, lead your people and break the walls of the red lord." is weg.
- Bekend: de vlaggen zijn met een script uit het origineel geknipt (staartjes en randen kunnen op sommige schermen een fractie afwijken). De grote banier laat onderaan, waar hij over de heuvel hangt, een vage vlek in de achtergrond zien als hij wegwaait. Op een echte iPhone nog niet bekeken; de kosten voor de batterij zijn niet gemeten.

## 0.50.2: Continue bovenaan
- Op het beginscherm staat Continue boven Campaign en Free play zodra er een bewaard spel is (wens van Karel, 15 november). Zonder bewaard spel is de volgorde Campaign, Free play.

## 0.50.3: lint onder de titel even breed als ALDERVALE
- Naar Karels wens (15 november) is het lint met Banners of the Vale nu even breed als het woord ALDERVALE. In logo.webp is het lint opnieuw opgebouwd: de uiteinden met staart en krul zijn ongewijzigd, het midden is uitgerekt. De ondertitel is groter en staat gecentreerd op het lint.

## 0.50.4: ondertitel iets lager op het lint
- De tekst Banners of the Vale stond te hoog en raakte de gouden rand boven het lint (melding van Karel, 15 november). Nu staat hij in het midden van het blauwe vlak.

## 0.50.5: grotere knoppen, Continue altijd zichtbaar
- Campaign, Free play en Continue zijn groter (zo breed als de titel en het lint, 281 bij 63 px op 844 breed) en staan 16 px lager onder het logo (wens van Karel, 15 november).
- Continue staat altijd bovenaan. Zonder bewaard spel is hij vaag (38% dekking) en niet in te drukken (`disabled`); met bewaard spel normaal. tests/menu19.mjs controleert dat nu zo.
- Logo: bijna doorzichtige ruis (alfa onder 24) uit logo.webp gehaald; op Karels iPhone was een vage rechthoek rond het logo zichtbaar.
- Bekend: of de vage rechthoek hiermee weg is, is op de iPhone nog niet gezien.
- Lijfwachten lopen ook onderweg een nieuwe route naar de heer als die meer dan 5 tegels weg is (strijd.js `lijfwachtDenk`).
- Broeder Ludolf in level 5 (nieuw: js/gevangene.js, `gevangene` bij het level in campagne.json): een stenen cel op het binnenplein van rood (OBJECT.CEL = 30, decor, blokkeert de tegel) met een monnik in bruine pij achter ijzeren tralies, een deur met slot, stro, een emmer en een ketting. Valt de rode heer, dan staat de cel open (OBJECT.CEL_OPEN = 31: deur open, tralies weg, geen monnik). Bartholt wijst er na 6 seconden op. Plaatjes: `tekenCel` in kunst.js, `dorp.cel` en `dorp.cel_open` in assets.json. Test: tests/cel40.mjs (8 punten). Nog niet: Ludolf die zelf naar buiten loopt, en niet op de iPhone gezien (het plaatje is klein).

## 0.51.0: verhaalbeeld voor elk level
- Nieuw: bij het starten van level 1 tot en met 10 (niet de proloog, niet bij doorgaan met een bewaard spel) komt eerst een schilderij in beeld, altijd 12 seconden, met onderin maximaal vier zinnen verhaal en een dunne voortgangsbalk. Daarna volgt de gewone briefing.
- Geen overslaan. Het spel staat stil zolang het beeld er is.
- data/campagne.json: per level de velden "beeld" (beelden/verhaal/levelNN.webp) en "verhaal" (tekst). Ontbreekt het bestand, dan staat de tekst op een donkere achtergrond.
- Beelden nog niet geleverd: toevoegen aan KERN in sw.js zodra ze in beelden/verhaal/ staan (anders mislukt de installatie van de offline cache bij een ontbrekend bestand).
- ui.js: toonVerhaalbeeld(). main.js: vlag beeldOpen. index.html en css/stijl.css: #verhaalbeeld.

## 0.52.0: tutorial stap voor stap, levendig dorp, 80 vijanden
- Tutorial (nieuw: js/gids.js): geen klok meer. Elke les begint met een kaartje van Bartholt met een knop ("Let's begin", "Start lesson"), de speler bepaalt het tempo. Daarna wijst een pulserende ring de volgende knop aan (hamer, groep, bouwknop, Place, zwaard, soldaat) met één korte zin erbij. Een les is pas af als de speler het echt doet; dan volgt een kaartje met "Next lesson". Na 20 seconden zonder tik klopt de ring harder. De oude timers (6 s, 9 s, 15 minuten) zijn weg. Teksten zijn korter. Alle Engelse teksten zijn door Claude geschreven: nalezen.
- Levendige kaart (kaart.js `FEEST`, `FEEST_GROND`, `FEEST_DORPEN`): een groot dorp ten oosten met kerk (nieuw: OBJECT.KERK = 32, `tekenKerk`), marktplein met put, tenten en vlaggen, en zes gehuchten met platgetreden pleintjes, plus wegen. Het gebied van 14 tegels rond je burcht blijft vrij om te bouwen.
- Rondlopende figuren (nieuw: js/figuranten.js): ongeveer 60 dorpelingen, kinderen en een priester lopen bij hun dorp rond; Wessel en Bartholt wandelen bij de burcht. Nieuwe eenheidsplaatjes (SOORT 23 tot 30, heren.js `burger`). In de avond verdwijnen ze. Karel zelf (je koning) loopt niet rond.
- Nacht van de proloog: één klap van 80 vijanden (70% ridders, 30% boogschutters) in plaats van een kleine golf met versterking. Je hebt geen kans, de scène volgt na 4 minuten of onder 40% burcht. strijd.js: maximum aantal vijanden in de proloog 90 (anders 60).
- Tests: tests/proloog40.mjs (16 punten), tests/proloog35.mjs aangepast (41 punten).

## 0.53.0: groot tutorialkasteel met vier ringen, Karel en de gast lopen rond
- Het kasteel in de proloog heeft vier muurringen (maat 5, 9, 13 en 17; `eigenRingen` in data/kaarten.json, recept aldervale). Alle poorten liggen aan de oostkant op één lijn: de weg naar het grote dorp. Tussen de ringen staan huizen, hutten, hooibergen, vaten en tenten (kaart.js, bij `eigenMuur`), met lege stroken om te lopen en te bouwen.
- Wachters op de muren: 12 schutters en ridders staan vanaf het begin op de vier ringen (proloog.js `zetWachters`). De lessen tellen nu wat erbij komt (soldaten en soldaten op de muur t.o.v. het begin van de les), dus de wachters tellen niet mee. 's Nachts vechten ze mee.
- Ongeveer 140 figuranten: ook tussen de ringen lopen dorpelingen en kinderen rond (figuranten.js).
- Karel (je koning) en Lord Reinout (de gast) lopen nu rond bij de burcht. Nieuw: `leger.wandel(e, x, y)`, een wandeling die niet telt als bevel van de speler. Karel loopt alleen als hij niet is geselecteerd en niet op de muur staat.
- Bij de aanval ('s nachts) rennen alle figuranten, dus ook Wessel en Bartholt, terug naar de burcht en verdwijnen daar naar binnen (figuranten.js `vlucht`). Wie geen weg meer vindt (bijvoorbeeld door vijanden in de poort) duikt na drie pogingen onder; na 70 seconden zijn ze er sowieso niet meer. Wessel liep al vrij rond overdag (hij is een van de figuranten).
- Nog niet op de iPhone gezien: prestaties met 140 figuren en 80 vijanden (headless ruw 60 fps).
- Tests: proloog40.mjs (20 punten), proloog35.mjs (41).

## 0.54.0: bloed, klappen en vermoorde burgers
- Bloed (strijd.js `bloed`, tekenaar.js): bij elke treffer op een eenheid vliegen rode spettertjes weg die vallen; bij een dode meer spetters en een bloedplas op de grond die na ongeveer 24 seconden vervaagt. Maximum aantal effecten van 80 naar 260.
- Vechtanimatie: een soldaat die slaat springt even naar voren (3 px), en bij een klap van dichtbij komt een lichtflits tussen de twee. De bestaande slagpose (sla en schiet) blijft.
- Burgers worden vermoord (nieuw: js/slachting.js, `economie.dodeBoer`): komt een aanvaller binnen 1,5 tegel van een boer van de speler (rondlopend of aan het werk), dan slaat hij hem dood: bloed, een lijk, en de boer verdwijnt uit je volk (een gebouw waar hij werkte wacht op een nieuwe boer). Boeren binnen 6 tegels van een aanvaller rennen naar je burcht. Rood heeft geen zichtbare burgers (zijn economie is een getal), dus de speler kan geen burgers van rood doden.
- Proloog: tijdens de vlucht naar de burcht slaat de overmacht de dorpelingen dood (figuranten.js). In de test sneuvelden 35 van ongeveer 108 en 4 van de 4 boeren. Wessel en Bartholt ontkomen (het verhaal heeft ze nodig).
- Aanname: kans 45 tot 50% per ronde bij 1,4 tot 1,5 tegel afstand; geschatte getallen, niet op de iPhone gezien.
- Test: tests/gevecht40.mjs.

## 0.55.0: rood groeit mee (gebouwen, burgers, wachters, sterkere aanvallen)
- Nieuw: js/roodgroei.js. Hoe langer je wacht, hoe sterker de rode heer: elke 60 tot 87 seconden (per level) komt er een stap bij, tot een maximum. Elke stap: een nieuw gebouw van rood vlak bij zijn dorp (huis, hut, houthakkershut of boomgaard; nooit in de weg van zijn poorten; het herbouwt hij zelf als jij het sloopt), burgers die bij hun huis rondlopen, om de stap een extra wachter op zijn muur (vanaf de andere kant van dezelfde muur), en zijn aanvalsdoel stijgt (`doelBonus`). Houthakkershutten en boomgaarden geven hem ook meer inkomen.
- Schaal per level (aanname van Claude, standaard, per level te overschrijven met `rood.groei` in campagne.json): elke = 90 min 3 per level seconden, max = 6 plus 2 per level stappen, doelPerStap = 0,2 plus 0,06 per level, extra wachters hooguit 1 plus een per twee levels, burgers hooguit 6 plus 2 per level. Vrij spel telt als level 3. Level 1: 8 stappen, hooguit +2,1 doel. Level 6: 18 stappen, hooguit +10 doel. Level 5 (Stillwater) blijft rustig: `groei: { doelPerStap: 0.15, max: 8 }` (+1,2 doel), zodat het bij maximaal 16 man blijft.
- Een melding bij de eerste stap legt het uit: "Red is growing...". Tekst van Claude.
- De groei wordt bewaard (rood.bewaar `g`) en bij opnieuw beginnen teruggezet (`rood.herstel`).
- Jouw soldaten doden burgers van rood als ze erlangs komen (slachting.js): bloed en lijk; burgers rennen weg naar zijn burcht als je soldaten binnen 6 tegels komen.
- Nieuwe API in strijd.js: `zetRoodBouw`, `haalRoodBouwWeg`, `aantalExtraWachters`, `voegExtraWachterToe`. Wachter-nummers vanaf het aantal routes zijn extra wachters (worden niet bewaard, de groei zet ze terug, een per 45 seconden).
- Niet gedaan: rood bouwt geen kazernes of muren erbij; zijn nieuwe burgers werken niet echt (ze lopen alleen rond).
- Test: tests/groei41.mjs (12 punten).

## 0.56.0: bouwveld en lessen over je volk (proloog)

Op Karels feedback (tutorial): bouwen kon bijna nergens, het grasveld linksboven was te ver van de burcht.

- **Bouwveld in het westen** (links boven op het scherm): open gras buiten de buitenste muur met rotsen (voor de steengroeve) en een groepje bomen (houthakker), bereikbaar via nieuwe westpoorten in alle vier de ringen en een weg. Kaartgegevens: `bouwveld` in data/kaarten.json (aldervale), code in kaart.js (5e).
- **Geen bouwafstand in de proloog**: `bouwStraal` 0 (in de gewone levels blijft 14).
- **Gouden bouwplek**: bij elke bouwles een pulserende gouden ruit op de kaart met label ("Woodcutter here"). De camera springt bij "Start lesson" naar de plek; staat de plek buiten beeld, dan een pijl aan de rand. De plek wordt per les gezocht bij een ankerpunt (proloog.js `zoekPlek`) en schuift mee als hij bezet raakt.
- **Uitleg per gebouw**: wat de houthakker, steengroeve, boomgaard, woning en kazerne doen en kosten.
- **Twee nieuwe lessen** (nu 10 in totaal): "See your people" (paneel achter de buidel: boeren, werk, ruimte) en "Set the taxes" (belasting, populariteit, vertrekkende boeren). De gids licht de knoppen uit; de les is af als het paneel gelezen en gesloten is en een belastingstand gekozen.
- **Bugfix**: na een klare les gaat de bouwstand uit (een extra tik zette anders nog een hut). De gids kiest het juiste bouwwerk als er een ander aan staat.
- Tests: proloog42 (nieuw, bouwt met echte tikken op de plekken, werkers lopen naar het veld, economielessen), proloog35 (10 lessen), proloog40 (acht poorten, gast los van toeval).
- Alle teksten van de gids zijn door Claude geschreven en moeten nagelezen worden.
- Ook de lessen "send a soldier" en "put a soldier on the wall" hebben een gouden plek ("Send him here", "Wall here"). Test: proloog35 (52 punten). Volledige reeks: alleen de bekende fouten (campagne30, verhaal31, hut36, bouwstraal38).

## 0.56.1: opleiden in de tutorial wees de verkeerde knop, gids bleef op het titelscherm staan
- Les "Train two soldiers": de gids wees het zwaard aan, maar dat opent alleen de selectiebalk; soldaten leid je op door je kazerne op de kaart aan te tikken. Nu staat er een gouden plek "Barracks" op de kazerne, daarna wijst de gids de opleidknop aan.
- De gids (ring, zin, gouden plek, kaartje) verdwijnt nu zolang er een beeldvullend scherm open is (titel, menu, verhaal, briefing, uitslag, logboek, instellingen) en komt daarna terug.
- Tests: proloog35 (57 punten).

## 0.56.2: voorraadkamer in de tutorial, muurles herkent de soldaat
- Nieuwe les "Build a Storehouse" (na het huis, 11 lessen in totaal) met gouden plek op het bouwveld en uitleg: werkers brengen hout, steen en voedsel erheen, 150 van elk, tikken om overschot te verkopen.
- Les "Put a soldier on the wall": telde niet als af als de speler een groep koos waar de wachters op de muur in zaten, of als de soldaat nog onderweg was. Nu tellen de wachters (herkend aan `e.wachter` en hun posten) nooit mee, en een soldaat van de speler telt zodra hij op de muur staat of er heen loopt (zijn doel ligt op de muurlaag).
- Tests: proloog35 (59 punten, ook "wachters verschuiven telt niet" en "gemengde groep telt wel"), proloog42 (23).

## 0.57.0: Bartholt gaat mee naar de plek van de les
- Bij "Start lesson" verschijnt Bartholt (in een rookwolkje) naast de gouden bouwplek en blijft daar staan; de camera springt erheen. Bij lessen zonder plek (je volk, belasting) staat hij bij de burcht. Het label op de gouden plek heeft zijn portretje.
- Nieuw effect `rook` (strijd.js, tekenaar.js); `figuranten.leid(plek)` en `laatLos()`.
- Test: proloog42 (24 punten, Bartholt staat bij het bouwveld).

## 0.58.0: het leger van Ottger marcheert aan
- In de nacht verschijnt een leger van 100 aan de oostrand: 14 soorten, ook rammen, katapulten, belegeringstorens en ladderdragers. Het marcheert naar een plek buiten de oostelijke poort en wacht daar (`stuurLeger` optie `houd`, `laatOpmarsLos`, `opmarsStand` in strijd.js).
- Terwijl ze wachten volgt een les in vier stappen: boogschutters kiezen, naar de muur bij de poort sturen, ridders kiezen, achter de poort zetten. Bartholt legt elke stap uit, de gids wijst de knoppen en de gouden plek aan (`NACHT_TAKEN` in proloog.js, nieuwe gidssoorten 'kies' en 'stuur').
- Na de laatste stap (of na 150 seconden) gaan de poorten open en stroomt het leger naar binnen.
- Test: proloog43 (22 punten). Andere tests niet opnieuw gedraaid.

## 0.58.1: nachtles soepeler
- De lessen over je leger tellen nu ruimer: elk stuk muur telt voor de boogschutters, de plek bij de poort mag 6 tegels ernaast liggen, en heeft de speler het gevraagde soort niet, dan telt elke soldaat van hem.

## 0.58.2: wachtpost-fix en uitleg van het oog
- Een soldaat die je zelf traint en op een muurpost zet, telde als wachter (hij stond bij een post) en dus niet voor de laatste dagles. Nu zijn alleen de soldaten die bij het begin al op de muur stonden wachters.
- Eerste bevel op de grond (les "Send a soldier"): Bartholt legt eerst het oog uit (muren doorzichtig), de gids wijst het oog aan; daarna pas soldaat en gouden plek. Staat het oog al aan, dan wordt het niet opnieuw gevraagd.
- Nachtles: bij het kiezen telt de groep ook de wachters mee (anders ging les 3 te snel door).
- Tests: proloog35 (62), proloog43 (22, stabieler).

## 0.58.3: gidszin niet over het taaklabel
- Valt de zin van de gids over het taaklabel rechtsboven (zoals bij het oog op een iPhone met veilige randen), dan schuift hij eronder.

## 0.58.4: nachtles strenger, keuzehint weg
- Nachtles 2 en 4 tellen alleen een bevel dat de speler in die les geeft, naar de gouden plek (binnen 6 tegels; bij de muurles op de muur). Soldaten die al op een muur stonden tellen niet meer.
- Na een les met een bevel (dag en nacht) en bij het begin van de nacht is er niemand meer gekozen: de melding "soldier selected" linksonder verdwijnt.
- Test: proloog43 (25 punten, ook een bevel naar een andere muur telt niet).

## 0.58.5: 20 seconden vrij na de dagles
- Na de laatste dagles blijft het nog 20 seconden dag ("The feast goes on"), daarna komt Bartholts avondbericht, 20 seconden schemering en de nacht.

## 0.59.0: gesprekken tussen de dagloessen
- Na les 4 (huis): Wessel en Karel over zijn negende verjaardag. Na les 8 (kazerne): Reinout vraagt Karel uit over de wacht bij de oostpoort. Na les 11: Wessel met de valkenveer van Reinout, Karel roept ze naar het feest. Daarna 20 s vrij, 20 s schemering, nacht.
- Kaartje van de gids kan een portret tonen (`gids.kaart({ portret })`), `GESPREKKEN` en `toonGesprek` in proloog.js. Teksten door Claude geschreven, na te lezen.
- Tests: proloog35 (67), proloog42 (25).

## 0.59.1: bevel-lessen stap voor stap, leger aan de rand
- Les "Send a soldier": eerst wijst de gouden plek je nieuwste soldaat aan ("Tap this soldier"), dan het oog, dan de plek. Muurles: eerst de soldaat, dan het stuk muur.
- Muurles: elk bevel naar een stuk muur telt (ook een wachter verplaatsen).
- Gidszin schuift boven de legerhint linksonder als die elkaar raken.
- Het leger van Ottger begint helemaal aan de oostrand (groepjes langs de rand) en loopt aan op 55% snelheid; bij de storm weer gewone snelheid (`traag` in stuurLeger).
- Tests: proloog35 (68), proloog43 (25).
## 0.59.2: verhaalbeeld ook voor de proloog
- data/campagne.json: level 0 krijgt "beeld" (beelden/verhaal/level00.webp) en "verhaal". Zonder bestand staat de tekst op een donkere achtergrond. De proloog toont dus 12 seconden het beeld voor de briefing van Bartholt.

## 0.59.3: de elf verhaalbeelden
- beelden/verhaal/level00.webp tot en met level10.webp (Gemini, 1024 x 434, samen ongeveer 650 KB) en in KERN van sw.js.
- Tekst level 1: "Karel has put on the black band" (de rouwband komt pas na de proloog).

## 0.59.4: grondles en muurles strenger, oog eerst
- Grondles ("Send a soldier"): volgorde nieuwe soldaat, oog, dan pas de gouden plek. Alleen een bevel op de grond binnen 4 tegels van de plek telt; een soldaat op de muur zetten telt niet meer.
- Muurles: alleen een bevel in die les naar een stuk muur telt (een soldaat die er al stond niet).
- Met het oog aan gaat een tik naar de grond, behalve als je de muur zelf aantikt (main.js). Zonder deze regel ging een tik op de gouden plek achter een muur naar de muurtop.
- `window.spel.gids` voor tests. proloog35 (72 punten) wacht op het verhaalbeeld.

## 0.60.0: hinderlaag in de pas van Sevenwinds (level 2)
- De eerste keer dat een soldaat van de speler binnen 7 tegels van het midden van de pas komt, maakt de rotswand aan beide kanten 4 nissen en staan daar 4 boogschutters van Mechteld. Ze blijven staan, schieten op wat binnen bereik komt (2 tegels extra bereik, zoals op een muur) en lopen er niet achteraan. Mechteld zegt erbij: "Did you think my pass was empty, King Karel? Every rock here has eyes." (door Claude geschreven).
- Nieuw: js/hinderlaag.js, `strijd.hinderlaag(sleutel, vak)`, `hinderlaag` in data/campagne.json bij level 2. Niet bewaard: na herladen kan hij nog een keer komen.
- Test: hinderlaag44 (10 punten).

## 0.59.4: verhaalbeeld 20 seconden, zandloper, ook via de levelkaart
- Het verhaalbeeld staat nu 20 seconden in beeld (CONFIG.verhaalbeeldSeconden) met linksonder een draaiend zandlopertje, zodat het lijkt of het level laadt.
- Kies je een level op de levelkaart, dan komt het beeld ook als je daar al een bewaard spel hebt of in dat level zit. Via Continue (zonder kaart) gaat het spel direct door.
- Test: tests/beeld59.mjs (10 checks).

## 0.60.1: eerst 10 seconden beleg, dan gaat de poort open
- Na de nachtles (of na 150 s) valt het leger aan, maar de poorten blijven 10 seconden dicht ("Hold the walls!"). Daarna gaat de poort van binnenuit open. Test proloog43 (27).

## 0.61.0: garnizoen, logboekles, koning niet onder de helft, ontvoering te paard
- Aldervale begint met ongeveer 40 soldaten (wachters op de muur plus ridders, schutters, zwaardvechters en bijlridders op de binnenpleinen). Die lopen overdag rond (figuranten.js) en tellen als wachter. legerMax in de proloog 80.
- Nieuwe laatste dagles 12 "Read your messages": de gids wijst Bartholts portret linksboven aan; open en weer dicht = klaar. Het laatste gesprek komt daarna.
- Karel zakt in de proloog nooit onder de helft van zijn leven (strijd.js en een controle in proloog.js).
- Einde van de nacht: eerst de ontvoering (8 s). Een ruiter in het zwart met zwarte banier en fakkel galoppeert met Wessel van de burcht door de oostpoorten naar buiten (effect `ruiter`, getekend in tekenaar.js). Daarna de scènekaarten.
- Tests: proloog35 (78), proloog42 (25), proloog43 (27), proloog40 (22).

## 0.61.1: Bartholt meldt het verraad
- Als de poort van binnenuit opengaat zegt Bartholt: "Treason, Sire! We have been betrayed. Someone opened the gate from the inside!" (door Claude geschreven). Test proloog43 (28).

## 0.62.0: poorten open en dicht, 150 tegen ongeveer 80, langer einde
- Poorten: tik je eigen poort aan (zonder gekozen soldaten) om hem dicht of open te doen. Een dichte poort laat niemand door, ook je eigen soldaten niet (wegvinden.js `zetPoortDicht`, main.js `poortOnder`). Na het verraad in de proloog zitten de poorten vast open.
- Nachtles 5 "Close the outer gates": beide buitenste poorten (oost en west) dicht. Proloog43 (33 punten) controleert ook dat je soldaten dan niet meer naar buiten kunnen.
- Leger van Ottger 150 (MAX_VIJANDEN_PROLOOG 200); Aldervale begint met ongeveer 80 soldaten (legerMax 120). Beleg 20 s voor de poort opengaat, nacht 5 minuten.
- Gedetailleerdere zwarte ruiter (tekenRuiter in tekenaar.js): paard met manen, oor, teugels, dekkleed met rode zoom, ruiter met harnas, helm, pluim, wapperende mantel, lans met zwarte banier en fakkel; Wessel met armen en benen.
- Langere slotscène: 13 kaarten, Karel woedend, wil zijn zoon terughalen, vraagt naar Reinout (door Claude geschreven).
- Logboekbericht van Bartholt bij het begin van de proloog: eerst houthakker, voorraadkamer, huis en boomgaard.

## 0.62.1: herstel config.js
- Bij het ophogen naar 0.62.0 veranderde een te ruime zoekopdracht ook het kaartzaad (20261110) in "20.62.00": het spel startte niet. Hersteld. Versies worden voortaan alleen met letterlijke punten vervangen en alle JS-bestanden daarna op syntax gecontroleerd.

## 0.63.0: valhek gaat zichtbaar open en dicht, hoofdkasteel alleen via de deur
- Poorten hebben 9 beelden van het valhek (dicht tot open). Het hek schuift in ruim 2 seconden omhoog en iets sneller omlaag; open zie je een lichte doorgang. Jouw poort staat open tenzij je hem dichtdeed; een poort van rood gaat open als er een rode soldaat vlak bij is (kunst.js `tekenPoort`, tekenaar.js `zetHekDoel`, main.js).
- Op het hoofdkasteel kom je alleen via de deurtegel (midden aan de rechterkant, start x + 1); de andere tegels van de burcht zijn geen opgang meer (wegvinden.js).
- Test poort45 (2 punten plus screenshots); koning40, torens40 en proloog43 groen.

## 0.63.1: poortles alleen de oostpoort
- Nachtles 5 heet nu "Close the east gate": alleen de buitenste poort aan de oostkant, waar het leger staat, moet dicht. De westpoort blijft open. Test proloog43 (32).

## 0.63.2: economiepaneel past altijd op het scherm
- Het paneel achter de buidel is nooit hoger dan het scherm: de uitleg in het midden scrolt (`#volk-scroll`), de grondstoffen, Tax en de knoppen blijven altijd zichtbaar. De hint over gekozen soldaten verdwijnt zolang dit paneel of het handelpaneel open is.
- Sterkte van rood afgerond op één decimaal (was 3.78000000000002).

## 0.64.0: klimmen alleen via een open poort, rode koning schuilt in zijn burcht
- Muren en torens op kan in de hele game alleen nog via een poort die open is (en het hoofdkasteel via zijn deur). Torens en wachttorens zijn geen opgang meer; je loopt er wel overheen. Een dichte poort is geen opgang. Melding als het niet kan: "They can only climb up through an open gate: build a gate in this wall, or open it." (wegvinden.js, leger.js, main.js).
- De rode koning vlucht bij onraad naar het dak van zijn hoofdkasteel (via de deur, achter zijn binnenmuren) en blijft daar nog 25 seconden na het gevaar. Op het dak slaat hij alleen wie binnen zijn bereik komt (strijd.js `koningDenk`).
- Test klim46 (7); torens40 aangepast (toren met poort); gevecht40 zet de opmars direct op zijn plek (`strijd.opmarsDirect`).

## 0.65.0: torenplekken, 40 soldaten per kazerne, Apples, tweehandig zwaard, nieuwe zagerij, hinderlaag bij opnieuw
- Torens: de duurdere (12 steen) heet nu Watchtower en heeft 7 plekken, de goedkopere (8 steen) heet Tower en heeft 3 plekken. Alleen de namen in beeld wisselen; de sleutels `toren` en `wachttoren` blijven (anders raken bewaarde spelstanden stuk). De plekken staan in data/economie.json onder `torenPlekken`; boven op de toren staan de soldaten in een kring (leger.js `schikOpTorens`).
- Legerplafond: elke kazerne en elke magiertoren van jou geeft plek aan 40 soldaten (`legerPerKazerne`, economie.json). Het plafond is het kleinste van 40 maal het aantal van die gebouwen en `legerMax` van het level (levels 1 tot 4: 40, 5 tot 7: 60, 8 tot 10: 80). Is het vol, dan zegt het kazernepaneel: "your army is full (40 places). Each barracks holds 40: build another barracks". Sloop je een kazerne, dan blijven de soldaten leven; je kunt dan pas weer opleiden onder het plafond. De proloog heeft de regel niet (het garnizoen staat er al). De koning telt mee als een plek. Alleen voor jou, niet voor rood.
- Food heet in beeld Apples (grondstofnaam, voorraadkamer, handelpaneel, lessen van Bartholt). Brood blijft Bread. De algemene meldingen over eten ("the food has run out", het woord food in de populariteit) gaan over brood en appels samen en blijven zo.
- De koning (Karel) vecht met een dik tweehandig zwaard en heeft geen schild meer: brede kling met bloedgeul, brede pareerstang, lange greep, beide handen erop (heren.js `koning`). Geldt ook voor de rode koning in vrij spel.
- Nieuw gebouw: de zagerij is niet meer hetzelfde huisje als de voorraadkamer maar een open houten schuur met stammen, een stam op schragen met zaagraam, planken, zaagsel en een rondzaagblad (kunst.js `tekenZagerij`).
- Fix: level 2 Sevenwinds: na "Start over" gaat de hinderlaag weer af. De nissen in de rotsen werden niet teruggezet en `gebeurd` bleef staan (hinderlaag.js `wis`, main.js `opnieuw`).
- Tests: nieuw kazerne_torens47 (17) en hinderlaag_opnieuw47 (6); torens40 aangepast aan 7 en 3 plekken; handel verschuift de camera zodat het paneel de testtik niet opvangt.

## 0.65.1: poorten, hoofdkasteel en koning
- Een open poort van jou laat rood gewoon door; een dichte poort is voor iedereen een muur. Rode poorten blijven voor jou dicht.
- In elk level met een koning gaat het alleen om de koning: geen enkel hoofdkasteel (rood of van jou) krijgt nog schade, en het level is gewonnen of verloren als een koning valt. Rammen en katapulten hebben het kasteel niet meer als doel.
- Jouw soldaten kunnen het hoofdkasteel van rood op via zijn deur en de rode koning op het dak aanvallen. Rood kan hetzelfde bij jou: rode ridders lopen op je koning af, ook op het dak van je kasteel. Op elk hoofdkasteel passen 5 man.
- Grondsoldaten mogen een koning op een dak als doel houden en klimmen erheen (strijd.js: klimtNaar, padNaarDoelOpMuur).
- HUD: "Defeating the red king wins the level." (na te lezen)
- Nieuwe tests: poort_open48, koningsdak48, koningsdak_speler48.
- Bekend: de rode koning is sterk en doodt een kleine groep op het dak; de pijlen van het rode kasteel blijven schieten.

## 0.65.2: geen zwarte balk meer bij het opstarten
- Oorzaak (aanname, niet op een echte iPhone gezien): bij het opstarten als app van het beginscherm geeft iOS soms een verkeerde vensterhoogte door, waardoor het spel te laag of vreemd uitgerekend wordt getekend.
- index.html meet de schermmaat nu zelf (als app: precies de schermmaat, anders het zichtbare venster), zet die in --app-w en --app-h, en meet opnieuw bij draaien, terugkeren naar de app en een paar keer kort na het opstarten. Het canvas past zich daarna aan.
- css/stijl.css gebruikt die maat voor body, de levelkaart en de instellingen.
- Nieuwe test: schermmaat48.

## 0.65.3: leger van 150 en lopen over de muur bij een dichte poort
- Je leger mag vanaf het begin 150 soldaten zijn (economie.json legerMax 150). Latere levels hebben een hogere grens: de levels die 60 hadden zijn nu 150, die met 80 zijn 180 (geschat, na te lezen en te verdelen per level in data/campagne.json). Per kazerne of magiertoren blijven het 40 plekken: voor 150 heb je dus vier kazernes nodig.
- Soldaten die al op een muur staan, kunnen er ook bij een dichte poort overheen lopen (leger.js stuur). Soldaten op de grond komen er met een dichte poort nog steeds niet op.
- Nieuwe test: muur_dicht49. Test kazerne_torens47 aangepast aan 150.

## 0.65.4: nieuw ontwerp voor de storehouse
- De storehouse is geen standaard huisje meer maar een pakhuis (kunst.js tekenPakhuis, vorm "pakhuis" in assets.json): stenen onderbouw, houten bovenbouw, steil dak, open deur met zakken, een luikje onder de nok. Buiten staan stammen (links), een hoop steen (rechts) en een mandje appels voor de deur: de drie dingen die je opslaat.

## 0.66.0: eten, groei, belegering, koning, poorten en aanvalsgolven
- Eten: elke boer (ook wie werkt) en elke soldaat eet een halve voedseleenheid per minuut (economie.json bevolking.voedselElke 60, eetPerPersoon 0.5). Wie niet kan eten, kost 2 populariteit per persoon (stemming.hongerPerPersoon). De oude aparte straf voor honger per halve minuut (honger: -6) is 0, zodat je niet dubbel gestraft wordt. Het paneel van je volk laat zien hoeveel voedsel per minuut nodig is. Let op: de boeren aten eerst 2 per minuut per persoon, nu 0.5: eten is dus veel makkelijker voor boeren, maar nu eten soldaten mee.
- Snelle groei: bij een populariteit van 90 tot 100 komen er 2 boeren per 15 seconden bij (stemming.snelleGroei), anders 1.
- Belegeringstroepen (ram, katapult, ladder, toren) kunnen nooit een muur, toren of kasteel op (leger.js isBelegering, strijd.js).
- Jouw koning gaat bij gevaar altijd naar het dak van je hoofdkasteel (aanvallers binnen 9 tegels van hem of je kasteel), blijft daar 15 seconden na het gevaar en slaat alleen wat binnen zijn bereik komt (strijd.js spelerKoningDenk). De koning van rood deed dit al.
- Poortwacht (js/poortwacht.js): jouw poorten gaan vanzelf dicht als aanvallers binnen 6 tegels komen, en 4 seconden nadat ze weg zijn weer open. Een poort die je zelf dichtdoet, blijft dicht; doe je hem zelf open terwijl er vijanden bij zijn, dan laat de wacht hem 25 seconden met rust. In de proloog (de les) doet de wacht niets, zodat de speler daar zelf de poort sluit.
- Aanvalsgolven: de tijd tussen twee aanvallen van rood is van 100 naar 170 seconden (data/economie.json heer.tussen), per level nog geschaald met tempo. Per level nu: Aldervale 170, Witherheath 170, Sevenwinds 243, Ironmarsh 212, The Fen 170 (tempo 140 naar 100), Stillwater 262, Giant's Spine 170, Greyford 212, White Dike 243, Mourngate 170, Mournkeep 155. De eerste aanval (eersteAanval) is niet veranderd.
- Nieuwe tests: voedsel50, belegering_poort50, koning_vlucht50. Aangepast: stillwater40 (golftijd), ronde39 (zonder kazerne is het maximum 0).

## 0.66.1
- Boeren (ook wie werkt) eten weer 2 food per minuut per persoon. Soldaten blijven 0.5 per minuut eten (`eetPerSoldaat`).
- Het eten gaat echt uit de voorraad: elke ronde (60 s) wordt het opgegeten voedsel van de voorraad afgetrokken. Boeren eten eerst, daarna de soldaten. Wie niet kan eten kost 2 populariteit.
- De voorraadbalk en de uitleg tonen nu het echte verbruik (boeren en soldaten apart).

## 0.66.2: ingeboxte groep
- Na een kader (knop Box) onthoudt het leger die groep. De knoppen links onderin (Melee, Ranged, Siege en de losse soorten) tonen dan alleen de aantallen binnen het kader en kiezen alleen daaruit. Een nieuwe knop "Group N" toont het totaal van het kader en kiest het hele kader opnieuw.
- De groep wordt gewist met All, None, een nieuw kader of een nieuwe losse keuze. Gesneuvelde soldaten tellen niet meer mee.
- leger.js: `kiesKader`, `kiesDeel`, `telling` geeft `deel` en `deelGekozen`. Nieuwe test: selectie_kader51.

## 0.67.0: licht, schaduw en een levende wereld (grafisch A en B)
- Echte slagschaduwen: elk gebouw, elke boom, rots en soldaat werpt een schaduw in de vorm van zijn eigen plaatje (kantelen, daken, kruinen), lang en schuin naar linksvoor, zoals bij een lage avondzon (sfeer.js `tekenSchaduw`, tekenaar.js). Vaste objecten staan samen op één schaduwdoek, eenheden krijgen per beeld hun schaduw. 's Nachts (proloog) verdwijnen de schaduwen.
- Wind: bomen, boomgaarden, graan en feestvlaggen wiegen in een golf die over de kaart rolt, met vlagen.
- Rook uit de schoorstenen van huizen, woningen en de bakkerij (kunst.js geeft de plek van de schoorsteen mee als `rook`).
- Glinsteringen op het water.
- Wolkenschaduwen die langzaam over het land trekken, en twee vluchten vogels met hun schaduw op de grond.
- Zelfbewaking: blijft het beeld langer dan 4 seconden onder ongeveer 30 beelden per seconde, dan gaan wind en wolken vanzelf uit.
- Uit te zetten met `CONFIG.beeld.sfeer = false` of `?sfeer=uit` in de adresbalk (dan de oude schaduwen).
- Proef, standaard uit: nabewerking.js (kleurgrading, gloed, scherptediepte), aan te zetten met `?nabewerking=laag` of `hoog`.
- Te meten op de iPhone: framekosten (in de testbrowser zonder GPU circa 18 naar 27 ms per beeld) en of de zelfbewaking niet te vroeg ingrijpt.

## 0.67.1: geen wolkenschaduwen meer, bomen vallen om en worden weggesleept
- De wolkenschaduwen zijn weg (sfeer.js, tekenaar.js): Karel vond de grote donkere vlekken lelijk.
- Een gevelde boom valt nu om, van de houthakker af: eerst langzaam, dan sneller, met een kleine stuit en een stofwolk (effect 'boomval', tekenaar.js `tekenBoomval`). De houthakker wacht ruim een seconde tot de boom ligt (economie.js `opGeveld`, `w.wacht`) en sleept hem daarna aan de stam achter zich aan naar de opslag, met de kruin over de grond (`tekenSleepboom`). Alleen beeld; wel komt het hout daardoor ruim een seconde later binnen.

## 0.68.0: ruiters, stal en paardenboer
- **Mounted Knight (ruiter):** leven 78 (130%), snelheid 3,6 (180%), schade 10, charge: na 5 tegels lopen doet de eerste klap 2,5 keer zoveel. 130% tegen boogschutters, 50% tegen rammen, katapulten, torens, ladders. Kan niet klimmen, 2 legerplekken, kost 30 goud, 4 koper, 6 tarwe en een boer. Kruisboog doet 200% en ridder (speer) 150% tegen ruiters. Alle getallen zijn schattingen, na te lezen en te testen.
- **Stable (stal):** groep Leger, 30 hout, 20 planken (geen steen). Leidt ruiters op. Hooguit 5 levende ruiters per stal met een paardenboer (`perStal` in economie.json).
- **Horse keeper (paardenboer):** nieuwe werker (beroep met `verzorgt`), loopt met een bos hooi rond bij de stal. Zonder hem geen opleiding.
- **Level 5 Stillwater:** rood koopt vanaf de zesde aanval hooguit 2 ruiters (extra_soorten, gewicht 1,8, tarwe betaalt rood met goud, tarwePrijs). Bericht van Bartholt bij aanval 6. Beloning na level 5: stal en ruiter (open vanaf level 6 en in vrij spel). Regel van Ludolf in de uittekst.
- **Paarden op het erf:** bij elke stal met een paardenboer staat een paard (kop omlaag) voor elke vrije stalplek; alleen decor, niet bewaard, verdwijnt als er een ruiter wordt opgeleid en komt terug als een ruiter sneuvelt.
- **Tarwe voor de paarden:** de bakker laat minstens 20 tarwe in de voorraad liggen (`reserve`), anders bakt hij niet.
- Test: tests/ruiter68.mjs (31 controles).
- Nog niet: een speciale charge in het beeld naast een stofwolkje, balans.

## 0.68.0: details in de kastelen van rood, levels 1 tot 3 (detailronde stap B1)
- Het kasteelontwerp in `data/kastelen.json` kan nu `decor` hebben: [naam, dx, dy] in dezelfde maat als de ringen (kaart.js). Alleen op een lege tegel zonder water; het decor is van niemand (eigenaar 0) en kan niet gesloopt worden. Namen: tent, hooiberg, put, vaten, huis, hut, boom, steen, vlaggen.
- Level 1 (Witherheath): een tent, twee hooibergen, vaten en een put binnen de muur. Level 3 (Ironmarsh): huizen, hut, vaten en een hooiberg buiten de muur.
- Level 2 (Sevenwinds): op elke toren van rood staat een lichte windvaan die met de wind wappert (`wimpels: true` in het ontwerp, sfeer.js `tekenWimpel`, tekenaar.js `zetWimpels`). Alleen met sfeer aan en niet met het oog aan.
- Alles is beeld; de spelregels veranderen niet. Het Rouwlint (zwart lint onder de rode banier) is op verzoek van Karel geschrapt.
- Nieuwe test: kasteeldecor53 (decor aanwezig, geen scriptfouten; beelden in /tmp/s).
- Eerlijk: het decor gebruikt bestaande plaatjes. De houten paardje van Wessel, de gescheurde blauwe gastvlag (level 1) en een echte smederij met gloed (level 3) hebben een eigen plaatje nodig: zie de Gemini-lijst in `claude/kastelenontwerp.md`.

## 0.69.0: IJzerbroek wordt een donkere mijnstad (detailronde, level 3)

- Het kasteel van Hademar heeft nu een eigen materiaal "Coal-black stone" (zwarte muren, donkerder dan het grijs van de andere levels).
- Twaalf mijningangen rond het kasteel, elk met een gemetselde luchtschacht waar zware, donkere rook uit komt, een gloeiende lantaarn, rails en een kar met kolen.
- Veertien steenhouwers bij blokken steen; hun hamer slaat echt en bij elke klap springen stofjes weg. Alleen decor: ze doen niets in het gevecht.
- Nieuwe decorsoorten `mijn` en `houwer` in `data/kastelen.json`; nieuwe tekenvormen `mijngang` en `steenhouwer`; `sfeer.tekenRook` kent nu zware rook en `sfeer.tekenHamer` is nieuw. Alles gaat uit als de sfeer uit staat of de snelheid zakt.
- Nog niet gedaan: echte smederij met gloed (Gemini), ijzeren poort met valhek (Gemini), ertskarren en slakkenhopen, weegschaal boven de poort.

Aanvulling 0.69.0: eigen plaatjes van Karel (Gemini) voor level 3. Twee smederijen met gloeiende vuurplaats (`assets/sprites/smederij.png`) en twee vrijstaande poortgebouwen met ijzeren valhek (`assets/sprites/poort_ijzer.png`), als decor in het kasteel van IJzerbroek. De poortgebouwen vervangen de echte poort van het kasteel niet: die kan openen en dicht en heeft twee richtingen, een plaatje niet. Het open-poortplaatje is nog ongebruikt.

## 0.69.1: feedback op de tutorial (proloog)

- De pijl aan de rand van het scherm wijst nu naar de bouwplek. Oorzaak: de pulsanimatie overschreef de draaiing (de pijl wees altijd naar rechts) en de positie sprong altijd naar een hoek. Nu draait hij via `--hoek` en staat hij op de lijn van het midden naar de plek (gids.js, stijl.css).
- Bouwen in de proloog: alleen het bouwwerk van de les is te kiezen, pas na "Start lesson". Andere bouwknoppen, Slopen en de hamer (zonder bouwles) zijn dicht en grijs (`proloog.bouwSleutel`, `ui.beperkBouw`, guard in `kiesBouw`). In de vrije avond en de nacht kun je dus ook niet bouwen.
- Economie in de proloog staat stil (`economie.bevries`): populariteit staat vast op 100, honger en belasting veranderen haar niet, niemand vertrekt, geen meldingen over ongelukkige boeren. Er komen wel boeren bij zolang er plek is (huis en soldaten opleiden hebben ze nodig). Belasting levert nog wel goud.
- Bartholts uitleg over je volk noemt de echte getallen uit de balk (`{volk}/{ruimte}`) in plaats van vaste 4/6.
- Test: tests/proloog69.mjs.

## 0.70.0: level 4 (The Fen): klok voor de volgende aanval en een tentenkamp (naar Karels wens van 17 november)

- **Aanvalsklok linksboven.** Onder de adviseur staat nu een klein paneel "Next attack" met de tijd tot de volgende golf van Brandts jagers en "Wave 1 of 5". Vanaf 15 seconden voor de golf kleurt hij rood en pulseert hij. Na de laatste golf (er komt er geen meer in de laatste 15 s) verdwijnt hij; ook bij winst of verlies. De tijd die je de hut moet houden staat ongewijzigd rechtsboven ("Hold Gesina's hut: 7:57 left"). Code: `doel.js` (`volgende()`, `toonKlok`), `ui.toonAanvalKlok`, `#aanvalklok` in index.html en stijl.css. Hij is smal (64 px) zodat de meldingslinten rechts van de adviseur er niet overheen komen.
- **Tentenkamp in plaats van een kasteel.** Het ontwerp "jachtkamp" (muren met vier poorten) is vervangen door "tentenkamp" (`kamp: true` in data/kastelen.json): geen muren, torens of poort. De burcht in het midden is nu Brandts commandotent (materiaal "kamp", vorm `kampburcht` in kunst.js): hoog paviljoen van gestreept doek op houten palen, franje van wimpels, een tentflap als deur en de rode banier op het puntdak. Soldaten klimmen er net zo op als op de burcht (zelfde maten en hoogte).
- **Nieuwe decorsoorten** (kaart.js 38 en 39): `kampvuur` (stenenkring, driepoot met ketel, vlammen en rook) en `jagerstent` (olijfgroen doek, bruine huid, gewei boven de ingang, droogrek). Op het erf staan 23 jagerstenten op een rooster met loopstroken ertussen, 3 kampvuren, 2 gewone tenten, vaten en een put. De commandotent is nu één tegel groot (hoogte 34) op een laag houten podium van 3 bij 3 (hoogte 7, vorm kampvloer); binnen het kamp staan ook bomen en vijf moerasplasjes (`water` in het ontwerp).
- **Bos en moeras rondom het kamp** (`omgeving` in het ontwerp, kaart.js 5b2): tussen 7 en 15 tegels van het kamp dicht bos en moerasplassen, behalve op een open laan van ongeveer 5 breed naar jouw kant en rond de werken van rood. Het gespiegelde dorp van jouw kant (huizen, akkers, weg) rond het kamp is weggehaald. Wat van het kamp af onbereikbaar zou zijn, wordt bos, en het pad tussen de kastelen kapt bij een kamp ook decor weg zodat de weg altijd blijft.
- Het materiaal kan nu een eigen burchtvorm en tweede kleur meegeven (`vorm`, `accent` in `materialen`; main.js).
- Spelregels onveranderd: dezelfde golven, dezelfde hut, dezelfde winregel (hut houden).
- Nieuwe test: `tests/hut70.mjs` (29 controles: kamp zonder muren, bos en water, bereikbaarheid, klok zichtbaar linksboven onder de adviseur, loopt terug, rood vlak voor de golf, springt na de golf, weg in de laatste 15 s en na winst, terug na opnieuw). `kasteel33` kent het tentenkamp (geen poorten of wachterroutes, wel een weg).
- Niet gezien op de iPhone: leesbaarheid van de klok in het spel zelf, snelheid met het dichte bos, en of de commandotent als "kasteel" prettig op de kaart staat. De getallen (15 s rood, 5 golven) volgen uit campagne.json (eerste 150 s, tussen 70 s, duur 480 s).


## 0.70.1 (deel 1): siege gear, unlocks tegen jou en de belegeringswerkplaats
Naar aanleiding van Karels feedback (17 november 2026).

**1. Bevestiging bij siege gear.** Zodra een siege-eenheid een bevel echt heeft ontvangen, krijg je een melding (main.js `meldSiege`, soort Army, ook in beeld). Gewone soldaten krijgen die niet.
- Ladderdrager: "A ladder is being set against the red wall."
- Belegeringstoren: "The siege tower is being placed against the red wall. Then your soldiers can climb over it."
- Stormram: "The battering ram is going to break through the red {wall, gate, ...}."
- Katapult: "The catapult is going to fire at the red {wall, ...}."
- strijd.js: `zetLadderBevel` en `valBouwAan` hebben een extra parameter `uit`: daar komen de eenheden in die het bevel kregen. Een melding komt alleen voor wie het bevel echt kreeg (niet bij "cannot reach"). Alle teksten zijn door Claude geschreven: na te lezen.

**2. Wat je unlockt, wordt in dat level tegen je gebruikt.** Regel: wat je als beloning van level N krijgt, zet rood in level N tegen jou in, in de loop van het level (niet in de eerste aanval of golf).
- Level 1 (toren): rood koopt vanaf zijn eerste aanval een belegeringstoren (`extra_soorten.toren`, vanaf 1, max 1). Dus in zijn tweede aanval rolt er een toren tegen je muur (de bestaande melding "Red is rolling a siege tower against your wall!").
- Level 2 (katapult): `extra_soorten.katapult` vanaf 1, max 1. (Kruisboog zat er al in.)
- Level 4 (vlammenwever): de golven om de hut van Gesina krijgen vanaf de derde golf een vlammenwever (`doel.golven.leger.vlammenwever = { aandeel, vanaf }`). doel.js ondersteunt nu `{ aandeel, vanaf }` naast een getal; vanaf telt golven, begint bij 0.
- Level 5 (heler): `rood.leger.heler` vanaf 2.
- Level 6 (steenwachter): `rood.leger.steenwachter` vanaf 2, plus 1 steenwachter in de golven "siege train" en "whole host" van de loodsen.
- Al in orde: level 3 bijlridder, level 4 sluipmoordenaar, level 5 zwaardvechter en banierdrager, de proloog (ram en ladder in het nachtleger).
- rood.js: brood betaalt rood met goud (`heer.broodPrijs` 1), anders kon hij nooit een heler kopen. economie.json: gewicht van de steenwachter van 0 naar 3 (geschat, na te lezen), anders telde hij niet mee voor de sterkte en kocht rood er eindeloos.
- Gebouwen en mijnen in een beloning (kopermijn, magiertoren) doen niet mee.
- Voor volgende levels (7 tot 10): zet nieuwe beloningen meteen ook in het leger van rood. Uitleg staat onderaan `_uitleg` in data/campagne.json. Test siege52 bewaakt dit voor elk speelbaar level.

**3. Aparte barak voor siege gear: de Siege Workshop.**
- Nieuw gebouw `belegeringswerkplaats` (OBJECT 40, `leidtOp: "belegering"`). Hier leid je op: stormram, katapult, belegeringstoren, en alles wat later nog bij siege komt (zet `"kazerne": "belegering"` bij de soldaat in economie.json). De ladderdrager blijft bij de gewone kazerne.
- Kosten 20 planken en 10 steen (geschat, na te lezen). Geeft net als een kazerne 40 legerplekken. Beloning van de proloog, samen met ram en ladder (dus niet in de proloog zelf te bouwen).
- Ontwerp (kunst.js `tekenBelegeringswerkplaats`): niet de stenen kazerne en niet de open zagerij, maar een erf met donkere balken en ijzer, een half afgebouwd belegeringstorenskelet dat boven alles uitsteekt (met valbrug, kruisverbanden en een wimpel in teamkleur), een ram aan kettingen onder een rood afdak, een stapel balken, een los wiel en een ketel pek.
- Het paneel toont bij dit gebouw alleen siege gear; bij de kazerne geen ram, katapult of toren meer. Bericht na opleiden: "... is ready at the siege workshop."
- Ook in brand te steken (houtlijst in strijd.js).

**Tests.** Nieuw: `tests/siege52.mjs` (data, regel per level, werkplaats, paneel, meldingen met echte tikken, rood koopt en gebruikt). Versie op 0.68.0 in config.js, sw.js, test_stap15 en test_stap17.

**Bekend / open.**
- Niet op de iPhone gezien: ontwerp van de werkplaats op het scherm, en of de melding niet over andere berichten heen komt (hooguit twee tegelijk in beeld).
- Balans van de nieuwe aanvallen (toren in level 1 vanaf aanval 2, heler en steenwachter) is niet gespeeld. De steenwachter vanaf aanval 2 in level 6 komt in de praktijk later, omdat rood eerst zijn machines koopt.
- Bestaande bewaarde spellen met een ram, katapult of toren blijven werken; wie er een wil bijmaken, heeft nu de werkplaats nodig.

## 0.70.1 (deel 2): de mystieke kazerne wordt een sjamaanhut
- De Mage Tower is vervangen door de "Mystic Lodge": een ronde hut van huid met kegeldak, gewei met veren en botten, geschilderde tekens, een vuurplaats en een totempaal. Lager en breder dan de torens, zodat hij niet op de Siege Workshop lijkt.
- Alleen het plaatje (js/kunst.js, tekenMagiertoren), de naam en de tip zijn veranderd. Interne sleutels (magiertoren, MAGIERTOREN, leidtOp mystiek) blijven gelijk, dus bestaande opslag en tests werken door.
- De Siege Workshop blijft zoals hij was (besluit na drie rondes ontwerpen).

## 0.70.1 (deel 3): machines van rood slaan niet meer op het hoofdkasteel
- Een stormram of katapult van rood gaat niet meer op jouw hoofdkasteel af. Hij gaat op weg naar de burcht en slaat het eerste wat in de weg staat kapot (muur, poort, toren). Is de weg vrij, dan kiest hij het dichtstbijzijnde andere bouwwerk van jou (kazerne, werken, huizen enz.); is er niets meer, dan wacht hij. Het hoofdkasteel zelf raken alleen soldaten en de koning (strijd.js `kiesBelegerDoel`, `breekDoor` met `doelB` null).
- Nieuwe test: tests/siege53.mjs (machines kiezen het hoofdkasteel nooit, level 1 en 3).
- Let op bij de balans: in een level waar jij nog niets gebouwd hebt, doen rammen en katapulten niets tot er een muur of gebouw staat.

## 0.70.1 (deel 4): sjamaanhut hoger
- De muren van de Mystic Lodge zijn hoger, het dak lager, de deur groter, de tekens hoger op de wand en de rook staat naast het gewei in plaats van erdoorheen.
