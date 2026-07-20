import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

type HeaderAction = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
};

type Props = {
  title: string;
  backLabel: string;
  onBack: () => void;
  action?: HeaderAction;
};

export function SettingsNavigationHeader({ title, backLabel, onBack, action }: Props) {
  const backButtonRef = useRef<HTMLButtonElement | null>(null);
  const largeTitleRef = useRef<HTMLHeadingElement | null>(null);
  const [compactTitleVisible, setCompactTitleVisible] = useState(false);

  useEffect(() => {
    let frameId = 0;
    const updateCompactTitle = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const titleRect = largeTitleRef.current?.getBoundingClientRect();
        const buttonRect = backButtonRef.current?.getBoundingClientRect();
        setCompactTitleVisible(Boolean(titleRect && buttonRect && titleRect.top <= buttonRect.top));
      });
    };

    updateCompactTitle();
    window.addEventListener("scroll", updateCompactTitle, { passive: true });
    window.addEventListener("resize", updateCompactTitle);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", updateCompactTitle);
      window.removeEventListener("resize", updateCompactTitle);
    };
  }, []);

  return (
    <>
      <header className="settings-sticky-header fixed inset-x-0 top-0 z-40 mx-auto flex w-full max-w-[560px] items-start px-5 pt-2">
        <button
          ref={backButtonRef}
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className="settings-sticky-header-control flex h-9 items-center gap-1.5 rounded-md px-0 text-[1rem] font-bold leading-none tracking-[-0.035em] text-white transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/24"
        >
          <ArrowLeft className="h-[1.22rem] w-[1.22rem]" aria-hidden="true" />
          <span>{backLabel}</span>
        </button>
        <div
          className={`settings-sticky-header-title pointer-events-none absolute left-1/2 flex h-9 -translate-x-1/2 items-center text-[1rem] font-bold leading-none tracking-[-0.035em] text-white transition duration-300 ${
            compactTitleVisible ? "translate-y-0 opacity-100 delay-100" : "translate-y-1 opacity-0 delay-0"
          }`}
          aria-hidden="true"
        >
          {title}
        </div>
        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            aria-label={action.label}
            className="settings-sticky-header-control ml-auto flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/[0.07] active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/24"
          >
            {action.icon}
          </button>
        ) : null}
      </header>

      <h1
        ref={largeTitleRef}
        className={`text-[2.25rem] font-semibold leading-none tracking-[-0.06em] text-white transition duration-200 ${
          compactTitleVisible ? "-translate-y-1 opacity-0" : "translate-y-0 opacity-100 delay-75"
        }`}
      >
        {title}
      </h1>
    </>
  );
}
