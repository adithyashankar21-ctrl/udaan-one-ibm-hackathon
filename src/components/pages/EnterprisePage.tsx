import React from 'react';
import { ArrowRight, Calculator, FileText, Lightbulb, ScanLine, Sparkles } from 'lucide-react';
import { BeneficiaryProfile, ChannelMode, Language } from '../../types';
import { SchemesPage } from './SchemesPage';
import { OpportunityTabs } from './SkillsPage';

interface EnterprisePageProps {
  profile: BeneficiaryProfile;
  langConfig: Language;
  savedIds: string[];
  onToggleSave: (id: string) => void;
  onOpenProfile: () => void;
  onNavigate: (mode: ChannelMode) => void;
  onGenerateRoadmap: () => void;
  isGeneratingRoadmap: boolean;
  onApply?: (schemeId: string) => void;
}

export const EnterprisePage: React.FC<EnterprisePageProps> = ({ onNavigate, onGenerateRoadmap, isGeneratingRoadmap, ...schemeProps }) => {
  const steps = [
    { icon: Lightbulb, title: 'Shape your idea', body: 'Describe your trade and the business you want — by voice or text.' },
    { icon: Calculator, title: 'Plan the costs', body: 'List equipment, raw material and working capital you need.' },
    { icon: FileText, title: 'Prepare documents', body: 'Get your ID, caste, income and bank documents ready.' },
  ];

  return (
    <div className="space-y-14">
      <OpportunityTabs current="enterprise" onNavigate={onNavigate} />
      <section className="surface-dark -mt-8 rounded-[28px] p-7 sm:p-12">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal">Start a business</p>
            <h1 className="mt-3 text-3xl font-extrabold sm:text-[2.6rem] sm:leading-tight">Start or grow your own business</h1>
            <p className="mt-4 text-base leading-relaxed text-slate-300">
              UDAAN ONE helps you turn your skill into a business plan, find loans and grants that may fit, and prepare your application.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={onGenerateRoadmap}
                disabled={isGeneratingRoadmap}
                className="btn btn-accent btn-lg"
              >
                <Sparkles className="h-4 w-4" aria-hidden />
                {isGeneratingRoadmap ? 'Preparing your roadmap…' : 'Create my business roadmap'}
              </button>
              <button onClick={() => onNavigate('smart_apply')} className="btn btn-on-dark btn-lg">
                <ScanLine className="h-4 w-4" aria-hidden /> Fill a loan or grant form <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
          <ol className="space-y-3">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-teal">
                  <s.icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-bold">{i + 1}. {s.title}</span>
                  <span className="block text-sm text-slate-300">{s.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <SchemesPage
        {...schemeProps}
        lockedFilters={['entrepreneurship', 'livelihood']}
        heading="Loans, grants & business support"
        intro="Schemes that can help fund equipment, working capital or a new enterprise. Loan amounts and interest depend on the bank and scheme rules."
      />
    </div>
  );
};
