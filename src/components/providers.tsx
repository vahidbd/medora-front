"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { TitleTooltips } from "@/components/shell/title-tooltips";
import { FormValidation } from "@/components/shell/form-validation";

export function Providers({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // Nothing refetches on focus: forms seed from their queries.
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange nonce={nonce}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delay={400}>
          {children}
          <Toaster position="bottom-right" closeButton />
          {/* No browser tooltips or validation bubbles anywhere: the kit's own instead. */}
          <TitleTooltips />
          <FormValidation />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
