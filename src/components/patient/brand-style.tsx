import { brandColours, brandStyleRule } from "@/lib/brand-colour";

/**
 * The brand's one colour as the kit's primary on this page, in both themes,
 * when its text reaches 4.5:1 on it (APP4). React puts the rule in the
 * head. Only a checked #rrggbb value reaches the rule, so nothing a brand
 * types can become CSS of its own.
 */
export function BrandStyle({ primaryColour }: { primaryColour: string | null }) {
  const colours = brandColours(primaryColour);
  if (!colours) return null;
  return (
    <style href="medora-brand" precedence="medium">
      {brandStyleRule(colours)}
    </style>
  );
}
