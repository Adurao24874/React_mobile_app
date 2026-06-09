import re
from supabase import create_client

URL = "https://ytmuudbkuhkfqkzchtce.supabase.co"
KEY = "sb_publishable_DF1cQCw9e1eefh2b3y3gtA_OIUyZsem"
supabase = create_client(URL, KEY)

raw_data = """
NORTH GOA DISTRICT
1 PERNEM 
1. Agarwada-Chopdem 2246254
2. Allorna 2205221
3. Arambol 2242966
4. Casarvarnem 2205220
5. Casne-Amere-Poroscodem 2201331
6. Chandel-Hassapur 2205100
7. Corgao 2241189
8. Dhargalim 2240250
9. Ibrampur 2209222
10. Mandrem 2247222
11. Morjim 2244310
12. Ozorim 2207110
13. Paliem 2292128
14. Parcem 2246247
15. Querim-Terekhol 2292161
16. Tamboxem-Mopa-Uguem 2204511
17. Torxem 2204510
18. Tuem 2240585
19. Varcond-Nagzor 2204111
20. Virnoda 2201336
2 BARDEZ 
1. Aldona 2293242
2. Anjuna-Caisua 2273246
3. Arpora-Nagoa 2277147
4. Assagao 2268218
5. Assonora 2215263
6. Bastora 2260003
7. Calangute 2276016
8. Camurlim 2212171
9. Candolim 2489061
10. Colvale 2299817
11. Guirim 2263565
12. Moira 2470344
13. Nachinola 2293500
14. Nadora 2211189
15. Nerul 2401979
16. Oxel 2272272
17. Parra 2472089
18. Penha-de France 2417822/2417213
19. Pilerne-Marra 2407466
20. Pirna 2210101
21. Pomburpa-Olaulim 2295244
22. Reis-Magos 2402332
23. Revora 2299501
24. Saligao 2278374
25. Salvador do Mundo 2417821
26. Sangolda 2417823
27. Siolim-Marna 2272205
28. Siolim-Sodiem 2272278
29. Sirsaim 2298339
30. Socorro 2417304
31. Tivim 2298595
32. Ucassaim-Paliem-Punola 2261825
33. Verla Canca 2472009
3 TISWADI 
1. Azossim-Mandur 2208160
2. Batim 2217453
3. Carambolim 2284964
4. Chimbel 2449790
5. Chodan-Madel 2239340
6. Corlim 2285855
7. Cumbharjua 2287004
8. Curca-Bambolim-Talaulim 2218565
9. Golti-Navelim 2280078
10. Merces 2448058
11. Neura 2208161
12. St. Cruz 2448769
13. Siridao-Pale 2218505
14. St. Andre(Goa Velha) 2218579
15. St. Estevam 2287003
16. St. Lawrence(Agassaim) 2218519
17. Sao Matias 2280079
18. Se Old Goa 2285734
19. Taliegao 2465354
4 BICHOLIM 
1. Advalpale 2215211
2. Amona 2386433
3. Cudnem 2364217
4. Carapur-Sarvan 2364273
5. Latambarcem 2380113
6. Maem-Vaiguinim 2387054
7. Mencrem-Dhumacem 2210279
8. Mulgao 2215261
9. Naroa 2387012
10. Navelim 2386111
11. Ona-Maulingem-Curchirem 2361258
12. Pale-Cothombi 2372226
13. Piligao 2362364
14. Salem 2389270
15. Sirigao 3950398
16. Surla 2353234
17. Velguem 2353249
5 SATTARI 
1. Birondem 2382169
2. Cotorem 2378108
3. Dongurli-Thane 2379274
4. Guleli 2378493
5. Honda 2370222
6. Mauxi 2374279
7. Morlem 2368382
8. Nagargao 2374258
9. Pissurlem 2352089
10. Poriem 6410375
11. Querim 2369277
12. Sanvordem 2358151
6 PONDA 
1. Bandora 2335102
2. Betora-Nirankal-Conxem-Codar 2330030
3. Betki-Candola 2287860
4. Bhoma-Adcolna 2395216
5. Borim 2333233
6. Cundaim 2395344
7. Curti-Khandepar 2313103/2345010
8. Durbhat 2325053
9. Marcaim 2392256
10. Panchawadi 2309680
11. Queula 2313176
12. Querim 2340362
13. Shiroda 2306230
14. Tivre-Orgao 2287734
15. Usgao-Ganjem 2344213/2345139
16. Veling-Priol-Cuncoliem 2343409
17. Verem-Vaghurme 2340234
18. Volvoi 2340810
19. Wadi-Telaulim 2325047
SOUTH GOA DISTRICT
7 SALCETE 
1. Ambelim 2773232
2. Aquem-Baixo 2766343
3. Assolna 2773278
4. Betalbatim 2880036
5. Camurlim 2777019
6. Cana-Banaulim 2770164
7. Carmona 2744692
8. Cavelossim 2871521
9. Chandor-Cavorim 2784250
10. Chinchinim-Deusaua 2863283
11. Colva 2788485
12. Curtorim 2786283
13. Davorlim-Dicarpale 2753084
14. Dramapur-Sirlim 2765060
15. Guirdolim 2784235
16. Loutolim 2777018
17. Macazana 2786269
18. Navelim 2726404
19. Nuvem 2790103
20. Orlim 2745020
21. Paroda 2869511
22. Raia 2776183
23. Rachol 2776020
24. Rumdamol-Davorlim 2752015
25. Sarzora 2864097
26. Seraulim 2788765
27. Sao Jose De Areal 2860372
28. Telaulim 2726403
29. Varca 2745057
30. Velim 2773231
8 MORMUGAO 
1. Cansaulim-Arossim-Cuelim 2754048
2. Chicalim 2540226
3. Chicolna 2538952
4. Cortalim-Quelossim 2550247
5. Majorda-Utorda-Calata 2881435
6. Nagoa 2783736
7. Sancoale 2550221
8. Velsao-Pale-Issorcim 2754066
9. Verna 2782295
9 QUEPEM 
1. Ambaulim 2662270
2. Assolda 2757770
3. Avedem-Cothombi-Chaifi 2663160
4. Balli-Adnem 2670210
5. Barcem-Quedem 2673034
6. Caorem-Pirla 3223457
7. Fatorpa-Quitol 2955331
8. Molcornem 2678230
9. Morpirla 2670452
10. Naqueri-Betul 2676135
11. Xeldem 2662230
10 SANGUEM 
1. Bhati 2607337
2. Calem 2601204
3. Collem 2600245
4. Curdi-Vadem 2609243
5. Dharbandora 2614080
6. Kirlapal-Dabal 2618267
7. Mollem 2612235
8. Neturlim 2608227
9. Rivona 2602227
10. Sancordem 2611120
11. Sanvordem 2605176
12. Uguem 2604213
11 CANACONA 
1. Agonda 2647357
2. Cola 2647213
3. Cotigao 2639166
4. Gaondongrem 2649385
5. Loliem-Polem 2640247
6. Poinguinim 2641205
7. Shristhal 2633380
"""

# Fetch existing departments
res = supabase.table('departments').select('department_name').execute()
existing = {row['department_name'] for row in res.data}

current_taluka = None
panchayats_to_insert = []

for line in raw_data.split('\n'):
    line = line.strip()
    if not line: continue
    if "DISTRICT" in line: continue
    
    # Check if taluka header e.g. "1 PERNEM"
    m_taluka = re.match(r'^\d+\s+([A-Z]+)$', line)
    if m_taluka:
        current_taluka = m_taluka.group(1).title()
        continue
        
    # Check if panchayat e.g. "1. Agarwada-Chopdem 2246254"
    m_panch = re.match(r'^\d+\.\s+([A-Za-z\s\-\(\)\.]+)(?:\s+\d[\d\/]+)?$', line)
    if m_panch and current_taluka:
        panchayat_name = m_panch.group(1).strip()
        dept_name = f"Village Panchayat {panchayat_name}"
        
        if dept_name not in existing:
            # Generate email
            clean_name = re.sub(r'[^a-zA-Z0-9]', '', panchayat_name.lower())
            email = f"admin.{clean_name}@grip-goa.online"
            
            panchayats_to_insert.append({
                'department_name': dept_name,
                'department_type': 'Panchayat',
                'taluka_name': current_taluka,
                'contact_email': email
            })

print(f"Found {len(panchayats_to_insert)} new Panchayats to insert.")
if panchayats_to_insert:
    res = supabase.table('departments').insert(panchayats_to_insert).execute()
    print("Inserted successfully.")
else:
    print("No new Panchayats to insert.")
