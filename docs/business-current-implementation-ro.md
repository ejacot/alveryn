# Alveryn Business — documentația implementării curente

> Document tehnic și funcțional pentru analiză externă
> Stare analizată: 13 august 2026
> Repository: `ejacot/alveryn`
> Ramură analizată: `feature/business`
> Commit local analizat: `06a9e55c1197eba1068e78a95314186755392f40`
> Commitul Business păstrat pe remote: `b28943d`

## 1. Scopul documentului

Acest document descrie **ce există efectiv acum în cod**, nu doar direcția dorită pentru produs. El urmărește Business de la baza de date și autorizare până la interfața utilizatorului și enumeră explicit:

- ce funcționează deja;
- cum se leagă Business de contul Personal;
- ce date sunt separate și ce date apar împreună;
- cum sunt create organizațiile, echipele, membrii, rolurile și tipurile de muncă;
- cum se construiește și se publică programul;
- ce vede și ce poate face angajatul;
- cum sunt înregistrate și aprobate rezultatele reale;
- cum funcționează absențele, check-in-ul și istoricul;
- ce endpointuri și tabele susțin sistemul;
- ce este incomplet, riscant sau încă nepotrivit pentru producție.

Concluzia importantă este că arhitectura actuală se află deja aproape de ideea:

```text
un singur cont Alveryn
├── spațiu Personal
└── unul sau mai multe spații Business
```

Totuși, această idee nu este încă prezentată clar în UX, iar implementarea curentă are câteva limite importante înainte să poată fi considerată un produs Business sigur și complet.

---

## 2. Statutul actual al ramurii

Business este dezvoltat pe ramura separată `feature/business`.

Situația Git la momentul analizei:

- `b28943d` este commitul WIP care păstrează implementarea Business și există pe `origin/feature/business`;
- `06a9e55` este un merge local prin care `origin/main` a fost adus în ramura Business, astfel încât Business să aibă și Welcome/Auth/Onboarding recente;
- merge-ul `06a9e55` nu este încă împins pe remote;
- Business nu este integrat în `main` și nu trebuie considerat funcționalitate de producție;
- există două modificări locale necomise pentru bugul tastaturii iPad din Auth, care nu fac parte din Business:
  - `frontend/src/layouts/auth-layout.tsx`;
  - `frontend/e2e/auth.spec.ts`;
- există și fișiere locale neversionate în `marketing/` și câteva scripturi TikTok; acestea nu aparțin Business.

La ultima validare a merge-ului Business au trecut:

- TypeScript;
- ESLint, cu avertismente Welcome deja existente;
- 225 teste frontend;
- 160 teste backend, cu un test opțional omis;
- buildul frontend de producție;
- 9 teste Playwright pentru Welcome/Auth.

Aceste rezultate confirmă că ramura se compilează, dar **nu reprezintă o certificare completă Business**. Testele specifice Business sunt încă puține față de suprafața funcțională implementată.

---

## 3. Modelul conceptual implementat

### 3.1 Identitatea utilizatorului

Autentificarea rămâne comună. Un utilizator are un singur `UserAccount`, cu același email, aceeași parolă/sesiune și aceleași mecanisme Auth.

Business nu introduce o a doua clasă de cont și nu creează o parolă separată.

### 3.2 Organizația Personal

Sistemul definește două tipuri de organizație:

- `PERSONAL`;
- `BUSINESS`.

O organizație Personal are obligatoriu un `personal_owner_user_id`, unic. O organizație Business nu are `personal_owner_user_id`.

Migrarea V61 a creat câte o organizație Personal pentru toate conturile existente la acel moment și a creat un membership `OWNER / ACTIVE` pentru fiecare proprietar.

Pentru utilizatorii noi, `PersonalWorkspaceService.requireOrCreate(user)` creează la nevoie:

1. organizația Personal;
2. membership-ul utilizatorului ca `OWNER`;
3. timezone-ul preluat din preferințe sau `UTC`.

Serviciul este folosit, printre altele, când se creează un Employment sau când este configurat programul Personal. Prin urmare, în modelul actual spațiul Personal este fundația implicită, chiar dacă nu este neapărat creat în aceeași tranzacție cu simpla înregistrare a adresei de email.

### 3.3 Organizațiile Business

Orice utilizator autentificat poate apela `POST /api/organizations` și crea o organizație Business.

La creare:

- se salvează numele;
- se validează timezone-ul IANA;
- creatorul devine membru `OWNER`;
- membership-ul este `ACTIVE`;
- organizația apare în lista de workspace-uri active ale utilizatorului.

Nu există momentan:

- abonament sau plan Business;
- limită de organizații;
- verificare fiscală/juridică a firmei;
- adresă, VAT ID, țară sau date de facturare;
- wizard Business dedicat;
- ștergere, arhivare sau transfer de ownership al organizației;
- editarea numelui/timezone-ului după creare.

### 3.4 Relația reală Personal–Business

Relația existentă este:

```text
UserAccount
├── poate deține un Organization(PERSONAL)
├── are OrganizationMembership OWNER în Personal
├── poate crea Organization(BUSINESS)
├── poate fi OWNER într-un Business
└── poate fi EMPLOYEE sau manager în alte Business-uri
```

Datele Business sunt legate de `organization_id` și/sau `organization_membership_id`, nu direct de Employment-ul Personal.

Aceasta este o bază bună pentru un cont unic cu mai multe spații. Totuși, UI-ul nu are încă un selector global, coerent, de workspace. Business este expus prin intrări suplimentare în navigația aceleiași aplicații.

---

## 4. Componentele principale ale domeniului

### 4.1 `organizations`

Reprezintă un workspace.

Câmpuri relevante:

- `id`;
- `personal_owner_user_id`, doar pentru Personal;
- `name`;
- `organization_type`: `PERSONAL` sau `BUSINESS`;
- `timezone`;
- timestamps.

Constrângerea SQL garantează:

- Personal are proprietar;
- Business nu are proprietar Personal;
- un utilizator nu poate avea două organizații Personal.

### 4.2 `organization_memberships`

Leagă o persoană de un workspace.

Câmpuri relevante:

- `organization_id`;
- `user_id`, care poate fi `NULL` pentru un angajat încă neconectat;
- `first_name` și `last_name`;
- `invited_email`;
- rolul legacy: `OWNER`, `ADMIN`, `MANAGER`, `EMPLOYEE`;
- status: `INVITED`, `ACTIVE`, `SUSPENDED`;
- `joined_at` și `ended_at`.

Membership-ul poate exista înainte ca persoana să aibă cont Alveryn. Acest lucru permite planificarea unui angajat doar după nume.

Reguli curente:

- ownerul nu poate fi suspendat;
- un membru suspendat nu mai apare în lista organizațiilor sale active;
- reactivarea produce `ACTIVE` dacă există `user_id`, altfel revine la `INVITED`;
- în aceeași organizație, un cont nu poate avea două membership-uri;
- în aceeași organizație, același email invitat nu poate apărea de două ori cât timp este păstrat în `invited_email`.

### 4.3 `organization_units`

Reprezintă structura internă a firmei.

Tipuri:

- `LOCATION`;
- `DEPARTMENT`;
- `TEAM`;
- `OTHER`.

Unitățile pot avea un părinte, deci formează un arbore precum:

```text
Hotel München (LOCATION)
├── Housekeeping (DEPARTMENT)
│   ├── Rooms (TEAM)
│   └── Public areas (TEAM)
└── Reception (DEPARTMENT)
```

Fiecare unitate are o politică de check-in:

- `DISABLED`;
- `OPTIONAL`;
- `REQUIRED`.

Observație: backendul tratează `OPTIONAL` și `REQUIRED` la fel în endpointul de check-in — ambele permit check-in. `REQUIRED` nu este încă impus ca o condiție obligatorie în toate fluxurile.

Există și tabela `organization_unit_memberships`, introdusă în V80 pentru asocierea membrilor cu unități și perioade, dar implementarea Business curentă nu expune servicii/controller/UI pentru administrarea acestei tabele. Plannerul poate asigna practic orice membru activ la orice nevoie din organizație.

### 4.4 Roluri și permisiuni

Există două niveluri care coexistă:

1. rolul legacy din membership: `OWNER`, `ADMIN`, `MANAGER`, `EMPLOYEE`;
2. roluri configurabile în `organization_roles`, atribuite prin `organization_role_assignments`.

Permisiunile disponibile sunt:

- `VIEW_SCHEDULE`;
- `MANAGE_SCHEDULE`;
- `PUBLISH_SCHEDULE`;
- `VIEW_TEAM_HOURS`;
- `APPROVE_ACTUALS`;
- `MANAGE_ABSENCES`;
- `MANAGE_MEMBERS`;
- `MANAGE_TEAMS`;
- `MANAGE_ROLES`;
- `MANAGE_SETTINGS`.

Rolurile configurabile pot fi aplicate:

- întregii organizații, dacă `unit_id` este `NULL`;
- unei unități precise;
- unei unități și tuturor descendenților, prin `include_descendants=true`.

Exemplu:

```text
Rol: Housekeeping planner
Permisiuni: VIEW_SCHEDULE, MANAGE_SCHEDULE
Scope: Housekeeping
Include descendants: true
```

Acest rol permite planificarea în `Housekeeping` și în echipele copil, dar nu în `Reception`.

#### Particularitate importantă

`OWNER`, `ADMIN` și `MANAGER` din rolul legacy primesc în cod **toate permisiunile**, indiferent de rolurile configurabile. Doar utilizatorii care sunt `EMPLOYEE` depind efectiv de `organization_role_assignments`.

Prin urmare, modelul este hibrid și încă nu este complet normalizat. `VIEW_TEAM_HOURS` și `MANAGE_SETTINGS` există în enum/UI, dar nu au încă fluxuri funcționale distincte care să le folosească efectiv.

### 4.5 Tipurile de muncă Business

Business nu reutilizează direct tabela Personal `work_types`. Folosește `organization_work_types`.

Un tip de muncă Business conține:

- organizație;
- unitate opțională;
- categorie/părinte opțional;
- cod scurt, unic în organizație;
- nume;
- culoare;
- oră implicită de start și end;
- pauză implicită;
- metodă de calcul;
- metodă de compensare;
- unitate și simbol;
- unități pe oră;
- tarif per unitate;
- monedă;
- flaguri pentru teamwork, extra pay și categorie compozită;
- ordine și status activ.

Metodele suportate:

- `TIME_BASED` — durată bazată pe interval și pauză;
- `UNIT_BASED` — cantitate × tarif per unitate;
- `UNITS_PER_HOUR_BASED` — cantitatea este convertită în minute folosind productivitatea configurată;
- `FIXED_PRICE_BASED` — tip fix.

Categorii:

- un work type cu `composite_enabled=true` este categorie și nu poate fi programat direct;
- copiii moștenesc metoda de calcul a categoriei;
- o categorie nu poate fi copilul altei categorii;
- metoda categoriei nu poate fi schimbată cât timp conține work types;
- dezactivarea categoriei dezactivează și copiii.

Validări actuale:

- `UNITS_PER_HOUR_BASED` cere `unitsPerHour > 0`;
- `UNIT_BASED` cere `ratePerUnit > 0`;
- codul este normalizat uppercase;
- un cod dezactivat poate fi reactivat prin creare cu același cod;
- o categorie sau un tip inactiv nu poate fi programat.

Limită actuală: tarifele Business nu sunt încă transformate într-un motor complet de payroll sau earnings. Plannerul și rezultatele păstrează timpul/cantitatea, dar nu calculează și nu agregă în mod complet salariul Business în Calendar/Statistics.

---

## 5. Fluxul de creare și invitare

### 5.1 Crearea organizației

Din `/business`, dacă utilizatorul nu are nicio organizație Business activă, vede formularul „Create your organization”.

Introduce:

- numele organizației.

Frontendul trimite automat timezone-ul browserului. Backendul creează organizația și membership-ul ownerului.

### 5.2 Adăugarea unui membru fără cont

Managerul poate introduce:

- prenume;
- nume;
- email opțional;
- limba curentă a interfeței.

Este necesar cel puțin prenumele sau numele.

Dacă emailul lipsește:

- membrul rămâne `INVITED`;
- nu are `user_id`;
- poate fi folosit în planner ca angajat nominal;
- nu se poate autentifica sau vedea programul.

### 5.3 Adăugarea unui membru care are deja cont

Dacă emailul corespunde unui cont:

- verificat;
- nedezactivat și neșters;

membership-ul este legat imediat prin `claim(user)` și devine `ACTIVE`.

Acesta este un mecanism automat. Nu există un ecran explicit prin care utilizatorul acceptă sau refuză invitația.

### 5.4 Invitarea unei persoane fără cont verificat

Dacă nu există un cont verificat cu acel email:

- membership-ul rămâne `INVITED`;
- se trimite email;
- linkul este `/register?email=...`;
- după ce utilizatorul își verifică emailul și primește sesiunea, `AuthService.claimBusinessInvitations()` caută toate invitațiile `INVITED` cu același email și le leagă automat de cont;
- membership-urile devin `ACTIVE`.

Pentru un cont existent, emailul duce la `/login?email=...`.

### 5.5 Natura invitației

Invitația curentă:

- nu conține token unic;
- nu conține ID-ul organizației;
- nu are expirare;
- nu are accept/refuz;
- nu are deep-link către un ecran de confirmare;
- se bazează pe dovada controlului asupra adresei de email;
- poate fi retrimisă de manager;
- folosește EN, DE, RO sau RU.

Această abordare este simplă și relativ sigură datorită verificării emailului, dar nu oferă consimțământ explicit și nici administrarea invitațiilor expirate.

### 5.6 Suspendare și reactivare

Managerul poate suspenda un membru. Suspendarea:

- păstrează istoricul;
- setează statusul `SUSPENDED`;
- setează `ended_at`;
- elimină Business-ul din lista workspace-urilor active a acelui utilizator;
- nu șterge programările sau rezultatele istorice.

Ownerul nu poate fi suspendat.

Reactivarea păstrează aceeași identitate de membership.

---

## 6. Plannerul Business

### 6.1 Conceptul de „staffing requirement”

Plannerul nu începe direct cu o tură individuală. El creează mai întâi o **nevoie de personal**:

```text
Data: 2026-08-10
Echipă: Rooms
Tip de muncă: Room cleaning
Interval: 08:00–16:30
Necesar: 3 persoane
Cantitate necesară: opțional
Status: DRAFT
```

Aceasta este entitatea `StaffingRequirement`.

Un requirement poate fi creat:

- pentru o singură zi;
- bulk pentru maximum 31 de date într-un request;
- cu interval explicit;
- fără interval, caz în care se folosesc valorile implicite din work type;
- cu număr de persoane obligatoriu pozitiv;
- cu quantity opțional pozitiv.

### 6.2 Asignarea angajaților

Un membru este legat de requirement prin `StaffingAssignment`.

Asignarea poate avea:

- interval propriu, care suprascrie intervalul requirementului;
- status `ASSIGNED` sau `CANCELLED`;
- managerul care a făcut asignarea.

UI-ul permite:

- drag-and-drop al unei nevoi pe celula unui angajat;
- alegerea celulei angajat/zi și selectarea unei nevoi disponibile;
- quick assign prin două dropdown-uri;
- copierea configurației zilei precedente;
- eliminarea unei asignări;
- modificarea intervalului pentru o asignare individuală.

### 6.3 Coverage

Backendul calculează:

```text
coverageDifference = assignedWorkers - requiredWorkers
```

Statusul rezultat:

- negativ: `UNDERSTAFFED`;
- zero: `COVERED`;
- pozitiv: `OVERSTAFFED`.

Acest status este returnat pentru fiecare requirement și folosit în planner pentru avertizări.

### 6.4 Conflicte de program

Pentru fiecare assignment, backendul verifică alte assignment-uri active ale aceluiași membru în aceeași zi.

Un conflict apare când intervalele se suprapun. Sunt returnate:

- `hasConflict`;
- lista `conflictingAssignmentIds`.

Limite:

- conflictul este doar semnalat, nu blochează asignarea;
- dacă intervalul nu are start, conflictul nu poate fi determinat;
- nu există reguli de odihnă minimă între zile;
- nu există verificare pentru maximum de ore, contract, calificare sau apartenență reală la unitate.

### 6.5 Zile speciale administrate de manager

Managerul poate marca pentru un membru și o dată:

- `REST_DAY`;
- `VACATION`;
- `SICK`.

Există o singură astfel de înregistrare per membru/zi.

Dacă în aceeași zi există assignment, răspunsul include `hasWorkConflict=true`. Conflictul este vizualizat, dar nu este rezolvat automat.

### 6.6 Editarea unui requirement publicat

Când un requirement este actualizat:

- valorile se schimbă;
- `publication_status` revine la `DRAFT`;
- `published_at` este șters;
- este necesară republicarea.

Asignările existente rămân atașate.

### 6.7 Ștergerea și anularea

- ștergerea requirementului îl elimină și șterge assignment-urile prin cascade;
- „unassign” nu șterge assignment-ul, ci îl marchează `CANCELLED`;
- istoricul schimbărilor păstrează un eveniment sumar, dar nu este un event sourcing complet și nu permite restaurare/undo.

---

## 7. Publicarea programului

Un requirement începe ca `DRAFT`.

Managerul cu `PUBLISH_SCHEDULE` poate publica:

- toate requirement-urile dintr-un interval de maximum 31 zile;
- sau o listă selectată de IDs.

La publicare:

- fiecare requirement devine `PUBLISHED`;
- se setează `published_at`;
- se numără requirement-urile și assignment-urile publicate;
- se scrie evenimentul `SCHEDULE_PUBLISHED`.

Nu există momentan:

- notificări push;
- email de publicare;
- versiune atomică a întregii săptămâni;
- comparație explicită între două versiuni;
- workflow approve înainte de publish;
- anularea programului publicat ca acțiune separată;
- confirmare obligatorie din partea angajatului.

Există `staffing_schedule_receipts`, care urmărește când un membru a citit săptămâna. UI-ul managerului afișează `Eye`/`EyeOff` pentru assignment-uri, în funcție de faptul că receipt-ul săptămânii este mai nou decât ultima publicare.

Important: simpla citire a endpointului `/api/my/business-schedule` marchează săptămâna ca văzută. Nu există confirmare explicită „Am văzut programul”.

---

## 8. Ce vede angajatul

### 8.1 Navigație

Bottom navigation cere lista organizațiilor utilizatorului.

- dacă există cel puțin un Business activ, apare `Schedule`;
- dacă utilizatorul are cel puțin o permisiune managerială într-un Business, apare și `Business`;
- Personal Home, Calendar, Statistics și Settings rămân în aceeași navigație.

Aceasta nu este încă o separare vizuală completă între workspace-uri. Utilizatorul percepe Business mai degrabă ca module adăugate în contul Personal.

### 8.2 Pagina `/schedule`

Pagina arată pe săptămână:

- toate organizațiile Business active ale utilizatorului;
- programul publicat;
- ziua, work type, intervalul și persoanele asignate;
- propriile assignment-uri evidențiate;
- statusurile de zi;
- butoane Check in/Check out când unitatea permite;
- indicator pentru o publicare nouă;
- formular de cerere pentru absență;
- ultimele cereri și statusul lor.

#### Problemă importantă de confidențialitate

Endpointul `personalSchedule()` returnează în prezent **toate requirement-urile publicate din organizație, toate assignment-urile lor și toate day entries din organizație**, nu doar datele utilizatorului curent.

Frontendul `/schedule` desenează toate assignment-urile și doar îl evidențiază pe cel propriu. Asta înseamnă că un angajat activ poate vedea, în forma actuală:

- numele/emailurile altor persoane asignate;
- turele lor;
- statusurile de absență/zi ale altor membri.

Aceasta poate fi intenționată pentru un program de echipă, dar nu este controlată printr-o permisiune sau setare și trebuie decisă explicit înainte de producție. Dacă intenția este „angajatul vede numai propriul program”, endpointul trebuie filtrat în backend, nu doar în UI.

### 8.3 Integrarea cu Dashboard-ul Personal

Dashboard-ul Personal cere și `/api/my/business-schedule` pentru săptămâna curentă.

El filtrează assignment-urile la `currentMembershipId` și afișează pentru ziua selectată:

- work type Business;
- unitatea/echipa;
- organizația;
- intervalul planificat;
- statusul rezultatului: draft, submitted sau approved.

Din această activitate utilizatorul poate deschide un modal și:

- salva rezultatul ca draft;
- trimite rezultatul spre aprobare;
- introduce start/end real;
- introduce pauza;
- introduce cantitatea;
- adăuga note.

Dacă rezultatul Business este `APPROVED`, minutele aprobate sunt adăugate în rezumatul duratei zilei din Dashboard.

Limitări ale integrării:

- activitatea Business nu devine un `WorkRecord` Personal;
- nu apare o sumă estimată Business în cardul respectiv;
- minutele Business nu sunt integrate consecvent în toate totalurile săptămânale/lunare și Statistics;
- Calendarul Personal nu este încă un istoric Business complet;
- nu există o regulă clară pentru evitarea dublei înregistrări dacă utilizatorul creează și un WorkRecord Personal pentru aceeași tură;
- `work_records.shift_assignment_id` aparține sistemului mai vechi `shift_assignments`, nu noului `staffing_assignments`, deci legătura plan–actual nu este unificată.

---

## 9. Rezultatele reale și aprobarea

Fiecare `StaffingAssignment` poate avea un singur `StaffingAssignmentResult`.

Rezultatul păstrează:

- start real;
- end real;
- pauză;
- cantitate completată;
- note;
- status `DRAFT`, `SUBMITTED`, `APPROVED`;
- data trimiterii;
- data și managerul aprobării;
- timestamps check-in/check-out;
- sursa timpului: `MANUAL` sau `CHECK_IN`.

### 9.1 Introducere manuală

Angajatul poate salva:

- draft;
- submit.

După ce managerul aprobă rezultatul, angajatul nu îl mai poate modifica.

Managerul poate corecta valorile chiar în momentul aprobării.

### 9.2 Check-in și check-out

Check-in-ul:

- este permis doar pentru propriul assignment;
- cere assignment activ și requirement publicat;
- este blocat doar dacă politica unității este `DISABLED`;
- folosește timezone-ul organizației;
- setează `actualStartTime` și pauza implicită;
- setează sursa `CHECK_IN`;
- lasă rezultatul în `DRAFT`.

Check-out-ul:

- cere check-in anterior;
- setează end real;
- transformă rezultatul în `SUBMITTED`;
- îl trimite implicit în coada managerului.

Nu există momentan:

- geofencing;
- validare GPS;
- QR/NFC;
- limită de cât de devreme/târziu se poate face check-in;
- corecție separată justificată;
- tracking de dispozitiv;
- prevenție tehnică împotriva check-in-ului de la distanță;
- reconciliere automată cu payroll.

### 9.3 Calculul minutelor

Pentru `UNITS_PER_HOUR_BASED`:

```text
calculatedMinutes = completedQuantity × 60 / unitsPerHour
```

Rotunjirea este `HALF_UP` la minute întregi.

Pentru celelalte tipuri, dacă există start și end:

```text
minutes = end - start - break
```

Dacă end este înainte de start, se presupune trecerea peste miezul nopții și se adaugă 24h.

Rezultatul minim este zero.

Nu se calculează încă aici suma brută, extra pay, night shift sau alte sporuri Business.

---

## 10. Absențele Business

Angajatul poate cere:

- `REST_DAY`;
- `VACATION`;
- `SICK`.

Cererea conține:

- organizația;
- interval start/end;
- tip;
- note;
- status `PENDING`, `APPROVED`, `REJECTED`.

Intervalul nu poate depăși un an de la data de început.

Managerul cu `MANAGE_ABSENCES` vede cererile pending și poate aproba sau respinge.

La aprobare:

- pentru fiecare zi din interval se creează sau actualizează un `StaffingMemberDayEntry`;
- programările existente nu sunt eliminate automat;
- poate rezulta `hasWorkConflict=true`;
- conflictul trebuie rezolvat manual de planner.

Limitări:

- nu există documente medicale;
- nu există zile disponibile/consumate;
- nu există politici pe țară;
- nu există half-day;
- nu există anularea cererii de către angajat;
- nu există editarea unei cereri;
- respingerea nu șterge eventuale day entries create anterior prin alte fluxuri;
- nu există sincronizare cu sistemul Personal de absences;
- `REST_DAY` este tratat ca tip de cerere, deși semantic poate fi o preferință de program, nu o absență formală.

---

## 11. Istoric și audit

Tabela `staffing_change_events` salvează evenimente precum:

- requirement creat/actualizat/șters;
- membru asignat/ne-asignat;
- assignment actualizat;
- program publicat;
- rezultat salvat/trimis/aprobat;
- check-in/check-out;
- absență cerută/aprobată/respinsă;
- day entry setat sau eliminat.

Evenimentul păstrează:

- organizația;
- actorul, dacă mai există;
- tipul și entitatea;
- entity ID;
- data de lucru;
- un summary textual;
- timestamp.

UI-ul arată ultimele 12 evenimente în planner. Endpointul permite maximum 100.

Auditul este util, dar incomplet pentru conformitate:

- nu salvează snapshot before/after;
- summary-ul poate conține emailul membrului;
- nu există IP/dispozitiv;
- nu există export de audit;
- nu toate schimbările organizației, rolurilor sau membrilor sunt auditate;
- nu există retenție configurabilă;
- nu există protecție specială împotriva modificării/ștergerii evenimentelor la nivel de aplicație.

---

## 12. Exportul programului

Plannerul poate deschide un layout printabil A4 landscape.

Exportul:

- folosește dialogul de print al browserului;
- poate fi generat în RO, EN, DE sau RU;
- include membrii, zilele, assignment-urile și statusurile de zi;
- este testat la nivel de componentă.

Nu este un PDF generat și stocat de backend. Nu există versiune semnată, ID de document sau istoric al exporturilor.

---

## 13. Interfața managerială actuală

Ruta principală este `/business`.

Taburile sunt afișate pe baza permisiunilor:

- `Planner`;
- `Structure`;
- `People`;
- `Roles`.

### 13.1 Planner

Conține:

- navigare săptămânală;
- warnings pentru understaffing, overlaps, conflicts și drafts;
- grid desktop lat cu angajați × zile;
- daily staffing needs;
- drag-and-drop;
- quick assign;
- setup pentru requirements;
- publicare;
- review rezultate;
- review absențe;
- istoric;
- export print/PDF;
- modale de editare.

Pe mobil, gridul are `min-width: 1050px`, deci funcționează prin scroll orizontal. Este o implementare funcțională pentru desktop/tabletă, nu încă o experiență mobilă finală.

### 13.2 Structure

Permite:

- listarea unităților;
- creare location/department/team/other;
- alegerea părintelui;
- configurarea check-in mode.

Nu permite încă:

- editare;
- dezactivare;
- mutare/reordonare;
- protecție vizuală împotriva ciclurilor mai complexe;
- asignarea membrilor la unități;
- setări specifice location.

### 13.3 People

Permite:

- adăugarea unei persoane;
- email opțional;
- retrimiterea invitației;
- suspendare/reactivare.

Nu permite încă:

- editarea numelui/emailului;
- accept/refuz invitație;
- ștergere definitivă;
- rol implicit ales la invitare;
- alegerea echipelor;
- contract, normă, disponibilitate, calificări sau cost;
- transferul ownershipului.

### 13.4 Roles

Permite:

- crearea unui rol custom;
- selectarea permisiunilor;
- asignarea rolului unei persoane;
- scope pe unitate;
- includerea descendenților.

Nu permite încă:

- editarea sau ștergerea rolurilor;
- eliminarea unei atribuiri;
- prevenirea asignărilor duplicate la nivel UI;
- preseturi sigure;
- explicarea efectului fiecărei permisiuni;
- eliminarea modelului legacy OWNER/ADMIN/MANAGER care ocolește rolurile custom.

### 13.5 Work types

Rutele:

- `/business/:organizationId/work-types`;
- `/business/:organizationId/work-types/new`;
- `/business/:organizationId/work-types/:workTypeId`.

Permit:

- creare și editare;
- alegerea metodei;
- categorii;
- copii în categorii;
- unit/rate/productivity;
- teamwork/extra pay flags;
- dezactivare.

UI-ul este momentan stilizat în principal pentru dark mode și folosește multe clase `text-white`/`bg-white/...`. Nu este încă aliniat complet cu noul design system light/dark din Welcome/Auth/Onboarding.

---

## 14. Endpointurile Business existente

Toate endpointurile cer autentificare. Accesul managerial este controlat în service prin membership și permisiuni.

### 14.1 Organizații

| Metodă | Endpoint | Rol |
|---|---|---|
| GET | `/api/organizations` | Listează toate workspace-urile active ale utilizatorului, Personal și Business |
| POST | `/api/organizations` | Creează Business și owner membership |
| GET | `/api/organizations/{id}/access` | Returnează permisiunile efective |

### 14.2 Structură

| Metodă | Endpoint | Permisiune |
|---|---|---|
| GET | `/api/organizations/{id}/units` | management sau schedule access |
| POST | `/api/organizations/{id}/units` | `MANAGE_TEAMS` |

### 14.3 Membri

| Metodă | Endpoint | Permisiune |
|---|---|---|
| GET | `/api/organizations/{id}/members` | management/schedule/roles |
| POST | `/api/organizations/{id}/members` | `MANAGE_MEMBERS` |
| POST | `/api/organizations/{id}/members/{membershipId}/resend-invitation` | `MANAGE_MEMBERS` |
| DELETE | `/api/organizations/{id}/members/{membershipId}` | Suspendare, `MANAGE_MEMBERS` |
| POST | `/api/organizations/{id}/members/{membershipId}/reactivate` | `MANAGE_MEMBERS` |

### 14.4 Roluri

| Metodă | Endpoint | Permisiune |
|---|---|---|
| GET | `/api/organizations/{id}/roles` | `MANAGE_ROLES` |
| POST | `/api/organizations/{id}/roles` | `MANAGE_ROLES` |
| GET | `/api/organizations/{id}/role-assignments` | `MANAGE_ROLES` |
| POST | `/api/organizations/{id}/role-assignments` | `MANAGE_ROLES` |

### 14.5 Work types și planner

Prefix: `/api/organizations/{organizationId}/staffing`

| Metodă | Endpoint | Scop |
|---|---|---|
| GET/POST | `/work-types` | Listare/creare work types |
| GET/PUT/DELETE | `/work-types/{workTypeId}` | Detaliu/editare/dezactivare |
| GET/POST | `/requirements` | Listare/creare nevoie |
| POST | `/requirements/bulk` | Creare în mai multe zile |
| PUT/DELETE | `/requirements/{id}` | Editare/ștergere |
| POST | `/requirements/{id}/assignments` | Asignare membru |
| PUT/DELETE | `/requirements/{id}/assignments/{assignmentId}` | Editare/unassign |
| POST | `/publish` | Publicare program |
| GET | `/day-entries` | Statusuri de zi |
| PUT/DELETE | `/members/{memberId}/days/{date}` | Set/remove status de zi |
| GET | `/history` | Audit recent |
| GET | `/results/pending` | Rezultate trimise |
| PUT | `/results/{resultId}/approve` | Aprobare și corectare |
| GET | `/absence-requests/pending` | Cereri pending |
| PUT | `/absence-requests/{id}/decision` | Aprobare/respingere |

### 14.6 Endpointurile angajatului

Prefix: `/api/my/business-schedule`

| Metodă | Endpoint | Scop |
|---|---|---|
| GET | `/` | Program publicat pentru toate Business-urile active |
| PUT | `/assignments/{id}/result` | Save draft / submit rezultat propriu |
| POST | `/assignments/{id}/check-in` | Check-in propriu |
| POST | `/assignments/{id}/check-out` | Check-out propriu |
| GET | `/absence-requests` | Cererile proprii |
| POST | `/absence-requests` | Cerere nouă |

---

## 15. Două sisteme de scheduling coexistă

Repository-ul are două familii diferite de scheduling.

### 15.1 Sistemul V61–V65

Conține:

- `schedule_templates`;
- `schedule_template_rules`;
- `scheduled_shifts`;
- `shift_breaks`;
- `shift_assignments`;
- `shift_change_requests`.

Este folosit în principal de setarea de program recurent legată de `Employment` și de produsul Personal. Are versiuni, valid_from/valid_to, materializare de ture și `work_records.shift_assignment_id`.

### 15.2 Sistemul Business V82–V90

Conține:

- `staffing_requirements`;
- `staffing_assignments`;
- `staffing_assignment_results`;
- `staffing_member_day_entries`;
- `staffing_absence_requests`;
- receipts și audit;
- `organization_work_types`.

Acesta este sistemul folosit de noul Business Planner.

### 15.3 Consecința

Cele două sisteme nu sunt unificate:

- au entități de assignment diferite;
- Business nu folosește `Employment` pentru fiecare angajat;
- `WorkRecord.shift_assignment_id` nu poate referi direct `StaffingAssignment`;
- programul recurent Personal și plannerul Business pot evolua separat;
- există risc de logică duplicată și inconsistențe.

Aceasta este una dintre cele mai importante decizii arhitecturale care trebuie analizate înainte de extinderea Business.

---

## 16. Separarea datelor și autorizarea

### Ce este bine separat acum

- organizațiile Business au ID propriu;
- majoritatea tabelelor Business au `organization_id` sau ajung la organizație prin requirement;
- serviciile caută resursele împreună cu organization ID;
- un străin primește Not Found/Access Denied și nu poate inspecta structura;
- permisiunile pot fi scoped pe unități;
- endpointurile de rezultat verifică faptul că assignment-ul aparține userului curent;
- suspendarea elimină membership-ul din fluxurile active;
- istoricul poate păstra actorul nullable după ștergere.

### Probleme sau puncte de întărit

1. **Programul angajatului returnează datele întregii firme**, nu numai propriile assignment-uri.
2. **Un membru INVITED fără cont poate fi asignat**, ceea ce este util pentru planificare, dar nu poate vedea/accepta programul.
3. **Un membru INVITED cu status nesuspendat poate primi assignment**; codul blochează doar `SUSPENDED`.
4. **Nu există consimțământ explicit la invitație**.
5. **Owner/Admin/Manager primesc automat toate permisiunile**, ocolind modelul granular.
6. **Rutele frontend nu au toate guard-uri dedicate**; securitatea reală rămâne backendul.
7. **Work type-ul unui requirement este verificat ca organizație, dar nu este verificat să aparțină aceleiași unități alese pentru requirement**.
8. **Day entries returnate angajatului nu sunt filtrate pe membership**.
9. **UI-ul de echipă afișează emailuri drept nume pentru membership-urile conectate**, chiar dacă există first/last name în membership.
10. **Nu există un tenant context global**; organization ID este transmis manual în multe query keys și endpointuri.

---

## 17. Persistență și migrații

Business adaugă migrațiile Flyway V80–V90:

- V80 — unități organizaționale;
- V81 — membri fără cont, roluri și assignments;
- V82 — work types, requirements și staffing assignments;
- V83 — păstrarea istoricului după ștergerea conturilor;
- V84 — statusuri membru/zi;
- V85 — publicare către conturi și receipts;
- V86 — audit;
- V87 — rezultate reale;
- V88 — cereri de absență;
- V89 — check-in/out;
- V90 — configurarea avansată a work types.

Aceste migrații sunt cumulative și destructive doar prin cascadele normale definite. Totuși, înainte de orice merge/deploy trebuie revizuite separat deoarece:

- creează multe tabele și constrângeri noi;
- modifică `organization_memberships.user_id` din obligatoriu în nullable;
- elimină indexul unic vechi și creează indexuri parțiale;
- schimbă modelul organizațional central folosit și de Personal;
- adaugă relații care pot influența ștergerea utilizatorilor.

Ramura Business folosește local o bază de date separată (`alveryn_business_dev`) tocmai pentru a nu aplica accidental aceste migrații peste mediul Personal de lucru.

---

## 18. Testele existente

### Backend

`BusinessOrganizationIntegrationTest` verifică:

- creare Business;
- unități nested;
- izolarea față de alt utilizator;
- conectarea imediată a unui cont verificat;
- claim după verificarea emailului;
- suspendare/reactivare;
- membru fără cont;
- rol custom scoped;
- permisiune pe părinte cu descendenți și blocarea sibling team.

`StaffingPlannerIntegrationTest` verifică într-un scenariu mare:

- under/covered/overstaffed;
- overlap;
- bulk requirements;
- day entry și conflict;
- publish;
- personal business schedule;
- new publication;
- history;
- submit rezultat;
- manager approval;
- check-in/check-out;
- request și approve absence.

`BusinessInvitationEmailServiceTest` verifică emailul de invitație.

### Frontend

- un test pentru crearea workspace-ului fără schimbarea contului Personal;
- teste pentru print schedule;
- teste BottomNav;
- teste Dashboard care acoperă anumite apariții Business.

### Goluri majore de testare

- nu există un E2E complet owner → invite → employee → publish → check-in → approve;
- nu există test de confidențialitate pentru răspunsul angajatului;
- nu există test pentru toate permisiunile;
- nu există test pentru edit/delete roles și units deoarece funcțiile nu există;
- nu există test multi-organization complex;
- nu există test de race/double publish/double assignment;
- nu există test pentru timezone/DST în noul staffing planner;
- nu există test pentru mobile planner;
- nu există test pentru salarii Business;
- nu există test de migrare din date Business reale.

---

## 19. Ce funcționează astăzi, rezumat

Un owner poate:

1. crea o organizație;
2. crea structură location/department/team;
3. configura politica de check-in;
4. adăuga oameni cu sau fără cont;
5. trimite/retrimite invitații;
6. suspenda și reactiva oameni;
7. crea roluri și permisiuni scoped;
8. crea categorii și tipuri de muncă;
9. crea nevoi pentru una sau mai multe zile;
10. asigna angajați;
11. vedea coverage și overlaps;
12. marca rest/vacation/sick;
13. publica programul;
14. vedea cine a deschis săptămâna;
15. exporta programul prin print;
16. vedea rezultate trimise;
17. corecta și aproba rezultate;
18. aproba sau respinge absențe;
19. consulta istoricul recent.

Un angajat conectat poate:

1. vedea Business-ul în același cont;
2. vedea programul publicat;
3. vedea indicatorul de program nou;
4. vedea activitatea proprie în Dashboard;
5. salva/trimite timpul și cantitatea realizată;
6. face check-in/check-out dacă este permis;
7. cere rest/vacation/sick;
8. vedea statusul cererilor;
9. vedea rezultatul aprobat și minutele aprobate în Dashboard.

---

## 20. Ce nu este încă „firm management” complet

Implementarea este un **nucleu de workforce scheduling și actuals approval**, nu încă un sistem complet de administrare a firmei.

Lipsesc, printre altele:

- billing și subscription;
- date juridice/fiscale;
- contracte și documente angajat;
- payroll complet;
- calcul salariu Business;
- export DATEV/contabilitate;
- pontaj legal configurabil pe țară;
- ore suplimentare, night shift și sporuri Business calculate end-to-end;
- disponibilitate și preferințe angajat;
- schimb de tură/accept/refuz;
- notificări push/email pentru schedule changes;
- locuri de muncă/clients/projects ca domenii Business complete;
- task management;
- inventar;
- invoice;
- reports și KPI;
- integrare cu Personal controlată de utilizator;
- consent și politici GDPR complete;
- administrare avansată a organizației;
- audit de conformitate;
- mobile UX final pentru planner;
- onboarding Business;
- workspace switcher unificat.

---

## 21. Compatibilitatea cu ideea „Personal implicit + Business în același cont”

Ideea propusă este compatibilă cu fundația curentă.

### Ce poate fi păstrat

- `UserAccount` unic;
- `Organization` cu `PERSONAL` și `BUSINESS`;
- membership-uri multiple;
- Business creat de utilizator;
- invitații prin email;
- acces la mai multe Business-uri;
- roluri per organizație;
- date Business cu organization ID;
- date Personal deținute de spațiul Personal.

### Ce trebuie schimbat sau clarificat

1. **Workspace switcher real** — Personal și fiecare firmă trebuie să fie contexte explicite, nu simple taburi amestecate.
2. **Invited user onboarding** — un utilizator invitat este momentan obligat de `ProtectedRoute` să termine setup-ul/onboarding-ul Personal înainte să poată folosi Business. Trebuie decis dacă aceasta este experiența dorită.
3. **Acceptarea invitației** — trebuie decis dacă membership-ul devine automat activ sau cere accept.
4. **Vizibilitatea programului colegilor** — trebuie o regulă de produs și permisiune clară.
5. **Integrarea rezultatelor în Personal** — copiere automată, link read-only sau opt-in explicit.
6. **Unificarea celor două motoare de schedule**.
7. **Separarea navigației și designului** — shell Personal versus shell Business.
8. **Ownership și ștergere** — ce se întâmplă dacă ownerul pleacă sau își șterge contul.
9. **Modelul rolurilor** — eliminarea/limitarea rolurilor legacy cu acces total.
10. **Billing** — cine plătește și ce se întâmplă cu membrii dacă planul expiră.

---

## 22. Întrebări recomandate pentru analiza ChatGPT

Documentul poate fi trimis pentru analiză împreună cu aceste întrebări:

1. Este corect să păstrăm o identitate comună și workspace-uri separate Personal/Business?
2. Angajatul invitat trebuie să primească automat și Personal sau trebuie să poată intra direct în Business?
3. Cum ar trebui modelată acceptarea invitației fără a duplica autentificarea?
4. Angajatul trebuie să vadă întreg programul echipei sau numai programul propriu?
5. Ar trebui rezultatul Business aprobat să devină automat înregistrare Personal sau doar referință read-only?
6. Cum evităm dubla înregistrare a aceleiași ture?
7. Trebuie unificate `scheduled_shifts/shift_assignments` și `staffing_requirements/staffing_assignments`? Dacă da, care model ar trebui să supraviețuiască?
8. Ce model de tenant context este potrivit pentru React Query și API?
9. Cum trebuie simplificat sistemul hibrid de roluri?
10. Ce limite și indici suplimentari sunt necesari pentru scalare?
11. Care sunt riscurile GDPR și de confidențialitate din programul de echipă?
12. Care este cel mai mic MVP Business ce poate fi vândut în siguranță?
13. Ce trebuie separat în servicii/module înainte de producție?
14. Ce migrații trebuie auditate înainte de deploy?
15. Ce teste E2E și security trebuie considerate obligatorii?

---

## 23. Evaluare finală

Alveryn Business nu este doar un mockup. Are deja un backend real, persistență, permisiuni, invitații, planner, publicare, pontaj, check-in, aprobări, absențe, audit și integrare parțială cu Dashboard-ul Personal.

În același timp, este încă o implementare WIP cu trei probleme arhitecturale majore:

1. **cele două sisteme de scheduling coexistă fără o legătură clară**;
2. **spațiile Personal și Business există în model, dar nu sunt încă separate clar în experiența utilizatorului**;
3. **endpointul programului angajatului expune implicit programul complet al organizației**, decizie care trebuie validată sau corectată înainte de producție.

Direcția recomandată este să nu se creeze conturi Auth separate. Fundația actuală susține deja modelul mai bun:

```text
un cont Alveryn
→ Personal implicit și privat
→ Business-uri create sau acceptate
→ rol și date izolate în fiecare Business
→ selector explicit de workspace
```

Înainte de a continua redesignul Business, ar trebui luată o decizie documentată despre tenant context, invitații, vizibilitatea colegilor, integrarea rezultatelor și unificarea scheduling-ului.
