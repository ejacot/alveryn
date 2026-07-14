type Props = {
  children: React.ReactNode;
  routeKey?: string;
};

export function PageTransition({ children }: Props) {
  return <>{children}</>;
}
