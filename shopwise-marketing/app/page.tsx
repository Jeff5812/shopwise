import { PageShell } from '@/components/PageShell';
import { Nav } from '@/components/Nav';
import { PricingSection } from '@/components/PricingSection';
import { HeroSection } from '@/components/HeroSection';
import { StatsSection } from '@/components/StatsSection';
import { FeaturesSection } from '@/components/FeaturesSection';
import { WorkflowSection } from '@/components/WorkflowSection';
import { FAQSection } from '@/components/FAQSection';
import { CTASection } from '@/components/CTASection';
import { SiteFooter } from '@/components/SiteFooter';

export default function HomePage() {
  return (
    <main>
      <Nav />
      <PageShell>
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <WorkflowSection />
        <PricingSection />
        <FAQSection />
        <CTASection />
      </PageShell>
      <SiteFooter />
    </main>
  );
}
