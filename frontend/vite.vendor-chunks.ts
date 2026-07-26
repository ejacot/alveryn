export function vendorChunkName(id: string): string | undefined {
  if (!id.includes("node_modules")) {
    return undefined;
  }

  if (
    id.includes("/react/") ||
    id.includes("/react-dom/") ||
    id.includes("/scheduler/")
  ) {
    return "vendor-react";
  }

  if (
    id.includes("/@tanstack/") ||
    id.includes("/axios/") ||
    id.includes("/react-router-dom/") ||
    id.includes("/@remix-run/")
  ) {
    return "vendor-app";
  }

  if (
    id.includes("/i18next/") ||
    id.includes("/react-i18next/") ||
    id.includes("/@fontsource/")
  ) {
    return "vendor-i18n";
  }

  if (id.includes("/framer-motion/") || id.includes("/motion-dom/")) {
    return "vendor-motion";
  }

  if (
    id.includes("/zod/") ||
    id.includes("/react-hook-form/") ||
    id.includes("/@hookform/")
  ) {
    return "vendor-forms";
  }

  // PDF export is loaded on demand. Keeping its larger rendering dependencies
  // in separate chunks prevents them from inflating the application bootstrap.
  if (id.includes("/jspdf/")) {
    return "vendor-pdf-core";
  }

  if (id.includes("/html2canvas/")) {
    return "vendor-pdf-canvas";
  }

  if (id.includes("/canvg/")) {
    return "vendor-pdf-svg";
  }

  if (
    id.includes("/dompurify/") ||
    id.includes("/fflate/") ||
    id.includes("/css-line-break/") ||
    id.includes("/text-segmentation/")
  ) {
    return "vendor-pdf-support";
  }

  if (id.includes("/lucide-react/")) {
    return "vendor-icons";
  }

  return "vendor";
}
