import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { ArrowLeft, Home } from "lucide-react";
import { AppLogo } from "../branding/app-logo";
import { Button } from "./button";

type Props = {
  title?: string;
  description?: string;
};

function getRouteErrorCopy(error: unknown, fallbackTitle?: string, fallbackDescription?: string) {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return {
        title: "Page not found",
        description: "This screen is not available or the link has changed."
      };
    }

    return {
      title: "Something went wrong",
      description: error.statusText || "Alveryn could not open this screen."
    };
  }

  if (error instanceof Error) {
    return {
      title: fallbackTitle ?? "Something went wrong",
      description: fallbackDescription ?? "Refresh the page or return home and try again."
    };
  }

  return {
    title: fallbackTitle ?? "Page not found",
    description: fallbackDescription ?? "This screen is not available or the link has changed."
  };
}

export function RouteErrorPage({ title, description }: Props) {
  const error = useRouteError();
  const copy = getRouteErrorCopy(error, title, description);

  return (
    <main className="screen-shell flex min-h-screen items-center justify-center">
      <section className="glass-panel w-full max-w-sm rounded-[30px] px-6 py-6 text-center">
        <AppLogo />
        <p className="mt-6 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-white/38">
          Alveryn
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-white">{copy.title}</h1>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-white/58">{copy.description}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            className="min-w-0 px-3"
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                window.location.assign("/");
              }
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Back
          </Button>
          <Button className="min-w-0 px-3" onClick={() => window.location.assign("/")}>
            <Home className="mr-2 h-4 w-4" aria-hidden="true" />
            Home
          </Button>
        </div>
      </section>
    </main>
  );
}
