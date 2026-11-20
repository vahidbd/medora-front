import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BrandProvider } from "@/components/patient/brand-context";
import { BrandStyle } from "@/components/patient/brand-style";
import { PatientClerk } from "@/components/patient/patient-clerk";
import { BRAND_HEADER, brandFromHeader, type Brand } from "@/lib/brand";
import { BRAND_HOST_HEADER, normaliseHost } from "@/lib/surface";

/**
 * A brand's patient app (ADRs 0022, 0035, 0037). Reached only through the
 * proxy's rewrite on a brand's patient host, which also found the brand and
 * handed it over on the request; a request without it is not a patient
 * page. Every page here wears that brand and signs in on the patient Clerk
 * instance.
 */

async function currentBrand(): Promise<{ host: string; brand: Brand }> {
  const headerList = await headers();
  const host = normaliseHost(headerList.get(BRAND_HOST_HEADER));
  const brand = brandFromHeader(headerList.get(BRAND_HEADER));
  if (!host || !brand) notFound();
  return { host, brand };
}

export async function generateMetadata(): Promise<Metadata> {
  const { brand } = await currentBrand();
  return { title: { default: brand.name, template: `%s · ${brand.name}` }, description: `${brand.name}: your care, online` };
}

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const { host, brand } = await currentBrand();
  return (
    <PatientClerk>
      <BrandStyle primaryColour={brand.primaryColour} />
      <BrandProvider
        brand={{
          host,
          name: brand.name,
          status: brand.status,
          supportEmail: brand.supportEmail,
          supportPhone: brand.supportPhone,
          timeZone: brand.timeZone,
        }}
      >
        {children}
      </BrandProvider>
    </PatientClerk>
  );
}
