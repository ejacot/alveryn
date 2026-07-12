import { AnimatePresence, motion } from "framer-motion";

type Props = {
  children: React.ReactNode;
  routeKey: string;
};

export function PageTransition({ children, routeKey }: Props) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={routeKey}
        initial={{ opacity: 0.96, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0.98, y: -4 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
