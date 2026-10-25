import { Nav } from '@/components/Nav';
import { HeroSection } from '@/components/HeroSection';
import { StatsSection } from '@/components/StatsSection';
import { FeaturesSection } from '@/components/FeaturesSection';
import { ShowcaseSection } from '@/components/landing/ShowcaseSection';
import { WorkflowSection } from '@/components/WorkflowSection';
import { ForSellersSection } from '@/components/landing/ForSellersSection';
import { PricingSection } from '@/components/PricingSection';
import { FAQSection } from '@/components/FAQSection';
import { CTASection } from '@/components/CTASection';
import { SiteFooter } from '@/components/SiteFooter';

// Each section is a full-width band that carries its own background tone and
// inner page shell, so the page alternates cream, paper, dark, sand.
export default function HomePage() {
  return (
    <main>
      <Nav />
      <HeroSection />
      <StatsSection />
      <FeaturesSection />
      <ShowcaseSection />
      <WorkflowSection />
      <ForSellersSection />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <SiteFooter />
    </main>
  );
}
