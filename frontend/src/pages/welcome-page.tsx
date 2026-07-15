import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coins,
  Gauge,
  ListChecks,
  PackageCheck,
  ShieldCheck,
  Smartphone,
  WalletCards
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { AppLogo } from "../components/branding/app-logo";
import { ScreenMessage } from "../components/ui/screen-message";
import { useAuth } from "../features/auth/use-auth";
import { APP_HOME_PATH } from "../routes/app-paths";

const features = [
  {
    icon: Clock3,
    title: "Pontaj fara foi si calcule manuale",
    description:
      "Inregistrezi cand ai inceput, cand ai terminat si pauza. Alveryn calculeaza automat minutele lucrate si suma bruta."
  },
  {
    icon: PackageCheck,
    title: "Lucru pe bucata, nu doar pe ora",
    description:
      "Pentru activitati platite pe unitati, adaugi cate camere, curse, comenzi sau produse ai facut si cat valoreaza fiecare."
  },
  {
    icon: WalletCards,
    title: "Rate, metode si perioade salariale",
    description:
      "Pastrezi tarifele pe perioade, tipurile de lucru si regulile de calcul, astfel incat istoricul ramane corect chiar daca tariful se schimba."
  },
  {
    icon: CalendarDays,
    title: "Calendar pentru zile lucrate si absente",
    description:
      "Vezi rapid ce ai lucrat intr-o zi, ce lipseste si unde ai concedii sau alte absente platite."
  },
  {
    icon: BarChart3,
    title: "Statistici pe intelesul tuturor",
    description:
      "Urmaresti ore, bani, zile, medii, diferente intre perioade si evolutia muncii tale fara formule in Excel."
  },
  {
    icon: Smartphone,
    title: "Gandita pentru telefon",
    description:
      "Interfata este rapida pe mobil si poate fi instalata pe ecranul telefonului ca o aplicatie."
  }
];

const examples = [
  "Ai lucrat 08:00-16:30 cu 30 de minute pauza? Alveryn noteaza 8 ore lucrate.",
  "Ai facut 14 unitati la 3,50 EUR fiecare? Aplicatia calculeaza totalul pentru acel tip de lucru.",
  "Vrei sa compari saptamana aceasta cu saptamana trecuta? Statisticile iti arata diferenta pe zile.",
  "Ai schimbat tariful de la 15 EUR la 17 EUR pe ora? Intrarea veche ramane calculata cu tariful vechi."
];

const calculations = [
  "ore si minute lucrate",
  "venit brut estimat",
  "total pe zi, saptamana, luna sau perioada aleasa",
  "lucru pe unitati si conversie in minute",
  "comparatii intre doua perioade",
  "absente si zile fara inregistrari"
];

export function WelcomePage() {
  const { isAuthenticated, isHydrating, user } = useAuth();

  if (isHydrating) {
    return <ScreenMessage title="Se incarca Alveryn..." />;
  }

  if (isAuthenticated) {
    return <Navigate to={user?.preferences?.onboardingCompleted ? APP_HOME_PATH : "/onboarding"} replace />;
  }

  return (
    <main className="min-h-screen overflow-x-clip bg-[#050608] text-white">
      <section className="relative border-b border-white/[0.08]">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent_42%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto flex min-h-[92svh] w-full max-w-6xl flex-col px-5 py-5 sm:px-8 lg:px-10">
          <nav className="flex items-center justify-between gap-4">
            <AppLogo className="justify-start" />
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="inline-flex min-h-10 items-center justify-center rounded-full px-4 text-sm font-semibold text-white/72 transition hover:text-white"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="inline-flex min-h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-black shadow-soft transition hover:bg-white/90"
              >
                Creeaza cont
              </Link>
            </div>
          </nav>

          <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1fr_0.86fr] lg:py-16">
            <div className="max-w-3xl space-y-7">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.06] px-4 py-2 text-sm font-medium text-white/74">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Pentru oameni care vor sa stie clar cat au muncit si cat au castigat
              </p>
              <div className="space-y-5">
                <h1 className="max-w-4xl text-balance text-5xl font-semibold leading-[0.98] tracking-normal text-white sm:text-6xl lg:text-7xl">
                  Alveryn transforma munca zilnica in cifre clare.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-white/68 sm:text-xl">
                  Notezi orele, unitatile lucrate, tarifele si absentele. Aplicatia iti arata automat
                  totaluri, venit brut estimat, statistici si comparatii, fara tabele complicate.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/register"
                  className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-soft transition hover:bg-white/90"
                >
                  Incepe gratuit
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.06] px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
                >
                  Am deja cont
                </Link>
              </div>
            </div>

            <div className="mx-auto w-full max-w-[420px] rounded-[32px] border border-white/[0.1] bg-white/[0.06] p-4 shadow-[0_30px_100px_rgba(0,0,0,0.48)] backdrop-blur-xl">
              <div className="rounded-[26px] border border-white/[0.08] bg-black/70 p-4">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/52">Astazi</p>
                    <p className="text-2xl font-semibold text-white">8h 00m</p>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-2 text-right text-black">
                    <p className="text-xs font-medium">Brut estimat</p>
                    <p className="text-lg font-semibold">136 EUR</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.06] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">Schimb dimineata</p>
                        <p className="text-sm text-white/52">08:00-16:30 · pauza 30m</p>
                      </div>
                      <p className="text-sm font-semibold text-white">8h</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.06] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">Comenzi finalizate</p>
                        <p className="text-sm text-white/52">14 unitati · 3,50 EUR</p>
                      </div>
                      <p className="text-sm font-semibold text-white">49 EUR</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white/[0.08] p-4">
                      <Gauge className="mb-3 h-5 w-5 text-white/72" aria-hidden="true" />
                      <p className="text-sm text-white/54">Media zilnica</p>
                      <p className="text-lg font-semibold">7h 35m</p>
                    </div>
                    <div className="rounded-2xl bg-white/[0.08] p-4">
                      <Coins className="mb-3 h-5 w-5 text-white/72" aria-hidden="true" />
                      <p className="text-sm text-white/54">Luna aceasta</p>
                      <p className="text-lg font-semibold">1.842 EUR</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:px-10">
        <div className="mb-8 max-w-3xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/42">Ce face aplicatia</p>
          <h2 className="text-3xl font-semibold tracking-normal text-white sm:text-4xl">
            Tot ce notezi in Alveryn devine informatie utila.
          </h2>
          <p className="text-base leading-7 text-white/62">
            Ideea este simpla: introduci munca asa cum se intampla in realitate, iar aplicatia se ocupa de calcule.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <article key={title} className="rounded-[26px] border border-white/[0.08] bg-white/[0.045] p-5">
              <Icon className="mb-5 h-6 w-6 text-white" aria-hidden="true" />
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/58">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-white/[0.08] bg-white/[0.035]">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:px-10">
          <div className="space-y-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/42">Exemple concrete</p>
            <h2 className="text-3xl font-semibold tracking-normal text-white sm:text-4xl">
              Nu trebuie sa fii contabil ca sa intelegi cifrele.
            </h2>
            <div className="space-y-3">
              {examples.map((example) => (
                <div key={example} className="flex gap-3 rounded-2xl bg-black/28 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-white" aria-hidden="true" />
                  <p className="text-sm leading-6 text-white/66">{example}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/[0.1] bg-black/36 p-5">
            <div className="mb-5 flex items-center gap-3">
              <ListChecks className="h-6 w-6 text-white" aria-hidden="true" />
              <h3 className="text-xl font-semibold text-white">Ce poate calcula</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {calculations.map((item) => (
                <div key={item} className="rounded-2xl border border-white/[0.08] bg-white/[0.05] p-4">
                  <p className="text-sm leading-6 text-white/68">{item}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm leading-6 text-white/48">
              Rezultatele sunt estimari pentru organizarea personala. Pentru plata finala conteaza intotdeauna
              contractul, fluturasul de salariu si regulile angajatorului.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 lg:px-10">
        <div className="rounded-[32px] border border-white/[0.1] bg-white/[0.06] p-6 text-center sm:p-10">
          <h2 className="mx-auto max-w-3xl text-3xl font-semibold tracking-normal text-white sm:text-4xl">
            Daca vrei sa stii unde se duc orele tale si ce valoreaza munca ta, incepe cu prima inregistrare.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/62">
            Creezi contul, setezi profilul si tariful, apoi adaugi tipurile de lucru pe care le folosesti in fiecare zi.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/register"
              className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black shadow-soft transition hover:bg-white/90"
            >
              Creeaza cont
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/login"
              className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.06] px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
            >
              Intra in cont
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
