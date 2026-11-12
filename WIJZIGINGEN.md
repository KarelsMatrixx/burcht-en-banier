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
