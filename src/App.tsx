/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, ScanLine, Sparkles, X } from 'lucide-react';
import {
  BeneficiaryProfile,
  ChannelMode,
  LanguageCode,
  LivelihoodAnalysis
} from './types';
import { SiteHeader, UdaanOneLogo } from './components/shell/SiteHeader';
import { HomePage } from './components/pages/HomePage';
import { SchemesPage } from './components/pages/SchemesPage';
import { SkillsPage } from './components/pages/SkillsPage';
import { LearningHubPage } from './components/pages/LearningHubPage';
import { EnterprisePage } from './components/pages/EnterprisePage';
import { ApplicationsPage } from './components/pages/ApplicationsPage';
import { DocumentsPage } from './components/pages/DocumentsPage';
import { VoiceStudio } from './components/VoiceStudio';
import { KioskMode } from './components/KioskMode';
import { WhatsAppVoiceBot } from './components/WhatsAppVoiceBot';
import { IvrHelpline } from './components/IvrHelpline';
import { DistrictExplorer } from './components/DistrictExplorer';
import { KaushalPatraModal } from './components/KaushalPatraModal';
import { ProfileForm } from './components/ProfileForm';
import { UnifiedJourney } from './components/UnifiedJourney';
import { SmartApplyPage } from './components/smartapply/SmartApplyPage';
import { HelplineResume } from './components/smartapply/HelplineResume';
import { MissingQuestions } from './components/smartapply/MissingQuestions';
import { SUPPORTED_LANGUAGES } from './data/languages';
import { FORM_SCHEMA_MAP } from './data/autofillSchema';
import { getSmartApplyStrings } from './data/smartApplyStrings';
import { aiService } from './services/aiService';
import {
  APPLY_INTENT_EVENT,
  autofillApi,
  toAutofillUpdates,
  toBeneficiaryPartial,
  type ApplyIntentDetail,
  type DraftView,
  type SessionState,
} from './services/autofillApi';
import { LEARN_INTENT_EVENT, type LearningEntry } from './services/learnApi';
import { COURSE_MAP } from './data/learningTracks';

// Clean baseline profile for real citizen data entry
const CLEAN_EMPTY_PROFILE: BeneficiaryProfile = {
  name: '',
  age: '',
  gender: 'Prefer not to say',
  state: '',
  district: '',
  education: '',
  currentOccupation: '',
  traditionalTrade: '',
  existingSkills: '',
  mobilityConstraint: '',
  workPreference: 'Any',
  householdIncome: '',
  hasSmartphone: true,
  disabilityStatus: 'None',
  goal: '',
  socialCategory: '',
  subCaste: '',
  aadhaarNumber: '',
  fatherSpouseName: '',
  dateOfBirth: '',
  residentialAddress: '',
  pincode: '',
  phoneNumber: '',
  bankAccountNumber: '',
  bankIfscCode: '',
  bankName: '',
  annualFamilyIncome: '',
  bplRationCardNumber: '',
  consentGranted: false,
};


// Access modes rendered on the navy immersive surface
const LEGACY_MODES: ChannelMode[] = ['unified_journey', 'kiosk', 'whatsapp', 'ivr', 'district_map'];

const LEGACY_TITLES: Partial<Record<ChannelMode, { title: string; desc: string }>> = {
  unified_journey: { title: 'KaushalFill', desc: 'Guided profile, documents and roadmap journey.' },
  kiosk: { title: 'Kiosk Mode', desc: 'Large, simple screens for shared public devices.' },
  whatsapp: { title: 'WhatsApp Assistant', desc: 'Ask by voice note or text in a familiar chat layout.' },
  ivr: { title: 'IVR Helpline', desc: 'A phone-style voice menu — no smartphone needed.' },
  district_map: { title: 'District Opportunity Map', desc: 'Explore livelihood opportunities by district.' },
};

/** Where profile details come from, for provenance in the shared profile. */
const SOURCE_FOR: Partial<Record<ChannelMode, string>> = {
  home: 'voice',
  voice_studio: 'voice',
  kiosk: 'voice',
  whatsapp: 'chat',
  ivr: 'helpline',
};

function readSavedSchemes(): string[] {
  try {
    return JSON.parse(localStorage.getItem('kv-saved-schemes') || '[]');
  } catch {
    return [];
  }
}

export default function App() {
  const [currentChannel, setCurrentChannel] = useState<ChannelMode>('home');
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>('en');
  const [userProfile, setUserProfile] = useState<BeneficiaryProfile>(CLEAN_EMPTY_PROFILE);
  const [roadmap, setRoadmap] = useState<LivelihoodAnalysis | null>(null);
  const [isGeneratingRoadmap, setIsGeneratingRoadmap] = useState(false);
  const [isKaushalPatraOpen, setIsKaushalPatraOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [savedSchemeIds, setSavedSchemeIds] = useState<string[]>(readSavedSchemes);

  // Smart Apply: shared server-side session (consent, unified profile, documents, drafts)
  const [autofillSession, setAutofillSession] = useState<SessionState | null>(null);
  const [applyIntent, setApplyIntent] = useState<ApplyIntentDetail | null>(null);
  const [learnIntent, setLearnIntent] = useState<LearningEntry | null>(null);
  const [learningEntry, setLearningEntry] = useState<LearningEntry | null>(null);
  const [smartApplyEntry, setSmartApplyEntry] = useState<{ schemeId?: string | null; draftId?: string | null; channel?: string } | null>(null);
  const [chatDraft, setChatDraft] = useState<DraftView | null>(null);
  const channelRef = useRef(currentChannel);
  channelRef.current = currentChannel;

  const toggleSavedScheme = (id: string) => {
    setSavedSchemeIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem('kv-saved-schemes', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const langConfig = SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage) || SUPPORTED_LANGUAGES[0];
  const sa = getSmartApplyStrings(currentLanguage);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  /** Keep the app's profile in step with the shared Smart Apply profile. */
  const handleAutofillSession = useCallback((s: SessionState) => {
    setAutofillSession(s);
    if (s.consent && s.profile) {
      const partial = toBeneficiaryPartial(s.profile.fields);
      if (Object.keys(partial).length) setUserProfile((prev) => ({ ...prev, ...partial }));
    }
  }, []);

  useEffect(() => {
    autofillApi
      .session()
      .then(handleAutofillSession)
      .catch(() => setAutofillSession({ hasSession: false, consent: null, consentVersion: '', retentionDays: 7 }));
  }, [handleAutofillSession]);

  // Every page change starts at the top of the new page
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [currentChannel]);

  // Any channel (voice, chat, helpline, kiosk) can hand an "I want to apply" request to Smart Apply
  useEffect(() => {
    const onIntent = (e: Event) => setApplyIntent((e as CustomEvent<ApplyIntentDetail>).detail);
    window.addEventListener(APPLY_INTENT_EVENT, onIntent);
    return () => window.removeEventListener(APPLY_INTENT_EVENT, onIntent);
  }, []);

  // Any assistant channel that hears "teach me…" offers the matching Learning Hub course
  useEffect(() => {
    const onLearn = (e: Event) => {
      setApplyIntent(null);
      setLearnIntent((e as CustomEvent<LearningEntry>).detail);
    };
    window.addEventListener(LEARN_INTENT_EVENT, onLearn);
    return () => window.removeEventListener(LEARN_INTENT_EVENT, onLearn);
  }, []);

  /** Opens the Learning Hub at a course, a custom topic or a doubt. */
  const openLearning = (entry: Omit<LearningEntry, 'nonce'>) => {
    setLearnIntent(null);
    setLearningEntry({ ...entry, nonce: Date.now() });
    setCurrentChannel('learning');
  };

  /** Share details the person gives in any channel with the Smart Apply profile (after consent). */
  const syncToAutofill = (partial: Partial<BeneficiaryProfile>, source: string) => {
    if (!autofillSession?.consent) return;
    const updates = toAutofillUpdates(partial);
    if (Object.keys(updates).length === 0) return;
    autofillApi
      .updateProfile(updates, source)
      .then(handleAutofillSession)
      .catch(() => {});
  };

  const handleUpdateProfile = (partial: Partial<BeneficiaryProfile>) => {
    setUserProfile((prev) => ({ ...prev, ...partial }));
    syncToAutofill(partial, SOURCE_FOR[channelRef.current] || 'typed');
    showNotification('Profile updated');
  };

  const handleSelectDistrict = (district: string, state: string) => {
    setUserProfile((prev) => ({ ...prev, district, state }));
    showNotification(`District switched to ${district}, ${state}`);
  };

  const openSmartApply = (entry: { schemeId?: string | null; draftId?: string | null; channel?: string } = {}) => {
    setSmartApplyEntry(entry);
    setApplyIntent(null);
    setCurrentChannel('smart_apply');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // The newest unfinished draft, so chat channels can answer its questions in place
  const openDraftSummary = (autofillSession?.drafts || []).filter((d) => d.status.code === 'collecting').sort((a, b) => b.updatedAt - a.updatedAt)[0];
  useEffect(() => {
    if (!openDraftSummary || currentChannel !== 'whatsapp') return;
    autofillApi
      .getDraft(openDraftSummary.id)
      .then((r) => setChatDraft(r.draft))
      .catch(() => setChatDraft(null));
  }, [openDraftSummary?.id, openDraftSummary?.updatedAt, currentChannel]);

  const handleGenerateRoadmap = async () => {
    if (!userProfile.name) {
      setIsProfileModalOpen(true);
      showNotification('Please provide candidate name and trade first.');
      return;
    }

    setIsGeneratingRoadmap(true);
    showNotification(`Mapping NSQF skills & PM-AJAY grants in ${langConfig.name}...`);

    try {
      const result = await aiService.generateLivelihoodMapping(userProfile, langConfig.name);
      setRoadmap(result);
      setIsGeneratingRoadmap(false);
      showNotification('Kaushal Patra roadmap ready');
      setIsKaushalPatraOpen(true);
    } catch (err: any) {
      console.error('Roadmap generation error:', err);
      setIsGeneratingRoadmap(false);
      showNotification('Roadmap prepared with general guidance');
      setIsKaushalPatraOpen(true);
    }
  };

  const isLegacyMode = LEGACY_MODES.includes(currentChannel);
  const legacyTitle = LEGACY_TITLES[currentChannel];
  const intentScheme = applyIntent?.schemeId ? FORM_SCHEMA_MAP[applyIntent.schemeId] : null;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        current={currentChannel}
        onNavigate={setCurrentChannel}
        language={currentLanguage}
        onLanguageChange={setCurrentLanguage}
        profileName={userProfile.name}
        onOpenProfile={() => setIsProfileModalOpen(true)}
      />

      {/* Toast */}
      {notification && (
        <div role="status" className="fixed bottom-24 right-4 z-50 flex items-center gap-2 rounded-2xl bg-navy px-4 py-3 text-sm font-semibold text-white shadow-lift animate-fade-up lg:bottom-6 lg:right-6">
          <Sparkles className="h-4 w-4 text-saffron" aria-hidden />
          {notification}
        </div>
      )}

      {/* Hand-off from any channel to the shared Smart Apply workflow */}
      {/* Hand-off from any assistant channel to the Learning Hub */}
      {learnIntent && !applyIntent && currentChannel !== 'learning' && (
        <div role="status" className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-xl animate-fade-up lg:bottom-6">
          <div className="surface-dark flex flex-col gap-3 rounded-2xl p-4 shadow-lift sm:flex-row sm:items-center">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-saffron/20 text-saffron">
              <BookOpen className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">Keep learning with Guru</span>
              <span className="block truncate text-xs text-slate-300">
                {learnIntent.courseId && COURSE_MAP[learnIntent.courseId]
                  ? `${COURSE_MAP[learnIntent.courseId].title} — lessons, practice & quizzes`
                  : learnIntent.topic
                    ? `A full course on “${learnIntent.topic}”, with training requirements`
                    : 'Lessons, practice and step-by-step doubt solving'}
              </span>
            </span>
            <span className="flex gap-2">
              <button onClick={() => openLearning(learnIntent)} className="btn btn-accent flex-1 sm:flex-none">
                Open in Learning Hub <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
              <button onClick={() => setLearnIntent(null)} className="btn btn-on-dark w-11 p-0" aria-label="Dismiss">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </span>
          </div>
        </div>
      )}

      {applyIntent && currentChannel !== 'smart_apply' && (
        <div role="status" className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-xl animate-fade-up lg:bottom-6">
          <div className="surface-dark flex flex-col gap-3 rounded-2xl p-4 shadow-lift sm:flex-row sm:items-center">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal/20 text-teal">
              <ScanLine className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{sa.continueBanner}</span>
              <span className="block truncate text-xs text-slate-300">
                {intentScheme ? intentScheme.formTitle.split(' — ')[0] : 'We will help you pick the right form'}
              </span>
            </span>
            <span className="flex gap-2">
              <button onClick={() => openSmartApply({ schemeId: applyIntent.schemeId, channel: applyIntent.channel })} className="btn btn-accent flex-1 sm:flex-none">
                {sa.continueToSmartApply} <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
              <button onClick={() => setApplyIntent(null)} className="btn btn-on-dark w-11 p-0" aria-label={sa.dismiss}>
                <X className="h-4 w-4" aria-hidden />
              </button>
            </span>
          </div>
        </div>
      )}

      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-6 sm:pt-8 lg:pb-12">
        {currentChannel === 'home' && (
          <HomePage
            language={currentLanguage}
            langConfig={langConfig}
            profile={userProfile}
            onNavigate={setCurrentChannel}
            onOpenProfile={() => setIsProfileModalOpen(true)}
            drafts={autofillSession?.drafts || []}
            onOpenDraft={(id) => openSmartApply({ draftId: id })}
          />
        )}

        {currentChannel === 'schemes' && (
          <SchemesPage
            profile={userProfile}
            langConfig={langConfig}
            savedIds={savedSchemeIds}
            onToggleSave={toggleSavedScheme}
            onOpenProfile={() => setIsProfileModalOpen(true)}
            onApply={(schemeId) => openSmartApply({ schemeId })}
            onNavigate={setCurrentChannel}
          />
        )}

        {currentChannel === 'documents' && (
          <DocumentsPage
            profile={userProfile}
            langConfig={langConfig}
            session={autofillSession}
            onApply={(schemeId) => openSmartApply({ schemeId })}
            onNavigate={setCurrentChannel}
          />
        )}

        {currentChannel === 'skills' && (
          <SkillsPage
            profile={userProfile}
            langConfig={langConfig}
            savedIds={savedSchemeIds}
            onToggleSave={toggleSavedScheme}
            onOpenProfile={() => setIsProfileModalOpen(true)}
            onApply={(schemeId) => openSmartApply({ schemeId })}
            onNavigate={setCurrentChannel}
            onLearn={(topic, context) => openLearning({ topic, context })}
          />
        )}

        {currentChannel === 'learning' && <LearningHubPage langConfig={langConfig} onNavigate={setCurrentChannel} entry={learningEntry} onEntryHandled={() => setLearningEntry(null)} />}

        {currentChannel === 'enterprise' && (
          <EnterprisePage
            profile={userProfile}
            langConfig={langConfig}
            savedIds={savedSchemeIds}
            onToggleSave={toggleSavedScheme}
            onOpenProfile={() => setIsProfileModalOpen(true)}
            onNavigate={setCurrentChannel}
            onGenerateRoadmap={handleGenerateRoadmap}
            isGeneratingRoadmap={isGeneratingRoadmap}
            onApply={(schemeId) => openSmartApply({ schemeId })}
          />
        )}

        {currentChannel === 'applications' && (
          <ApplicationsPage
            language={currentLanguage}
            profile={userProfile}
            roadmap={roadmap}
            savedIds={savedSchemeIds}
            onToggleSave={toggleSavedScheme}
            onNavigate={setCurrentChannel}
            onOpenProfile={() => setIsProfileModalOpen(true)}
            onGenerateRoadmap={handleGenerateRoadmap}
            onOpenKaushalPatra={() => setIsKaushalPatraOpen(true)}
            isGeneratingRoadmap={isGeneratingRoadmap}
            session={autofillSession}
            onOpenDraft={(id) => openSmartApply({ draftId: id })}
            onApply={(schemeId) => openSmartApply({ schemeId })}
          />
        )}

        {currentChannel === 'smart_apply' && (
          <SmartApplyPage
            language={currentLanguage}
            langConfig={langConfig}
            session={autofillSession}
            onSession={handleAutofillSession}
            initialSchemeId={smartApplyEntry?.schemeId}
            initialDraftId={smartApplyEntry?.draftId}
            entryChannel={smartApplyEntry?.channel || 'web'}
            onEntryConsumed={() => setSmartApplyEntry(null)}
          />
        )}

        {currentChannel === 'voice_studio' && (
          <VoiceStudio
            currentLanguage={currentLanguage}
            onLanguageChange={setCurrentLanguage}
            userProfile={userProfile}
            onUpdateProfile={handleUpdateProfile}
            onGenerateRoadmap={handleGenerateRoadmap}
            onOpenKaushalPatra={() => setIsKaushalPatraOpen(true)}
            isGeneratingRoadmap={isGeneratingRoadmap}
            roadmap={roadmap}
            onApply={(schemeId) => openSmartApply({ schemeId, channel: 'voice' })}
            onOpenSmartApply={() => openSmartApply({})}
          />
        )}

        {isLegacyMode && (
          <>
            {legacyTitle && (
              <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">Access mode</p>
                  <h1 className="mt-2 text-3xl font-extrabold text-navy">{legacyTitle.title}</h1>
                  <p className="mt-1 text-muted">{legacyTitle.desc}</p>
                </div>
                <button onClick={() => setCurrentChannel('home')} className="btn btn-outline">
                  Back to home
                </button>
              </header>
            )}
            <div className="immersive space-y-6">
              {currentChannel === 'unified_journey' && (
                <UnifiedJourney
                  currentLanguage={currentLanguage}
                  langConfig={langConfig}
                  userProfile={userProfile}
                  onUpdateProfile={handleUpdateProfile}
                  roadmap={roadmap}
                  onGenerateRoadmap={handleGenerateRoadmap}
                  isGeneratingRoadmap={isGeneratingRoadmap}
                  onOpenKaushalPatraModal={() => setIsKaushalPatraOpen(true)}
                />
              )}

              {currentChannel === 'kiosk' && (
                <KioskMode
                  currentLanguage={currentLanguage}
                  userProfile={userProfile}
                  onUpdateProfile={handleUpdateProfile}
                  onGenerateRoadmap={handleGenerateRoadmap}
                  isGeneratingRoadmap={isGeneratingRoadmap}
                  roadmap={roadmap}
                  onOpenKaushalPatra={() => setIsKaushalPatraOpen(true)}
                />
              )}

              {currentChannel === 'whatsapp' && (
                <>
                  <WhatsAppVoiceBot
                    currentLanguage={currentLanguage}
                    userProfile={userProfile}
                    onUpdateProfile={handleUpdateProfile}
                    onGenerateRoadmap={handleGenerateRoadmap}
                    roadmap={roadmap}
                    onOpenKaushalPatra={() => setIsKaushalPatraOpen(true)}
                  />
                  {/* Cross-channel continuity: answer the open application's questions right here */}
                  {chatDraft && chatDraft.missing.length > 0 && (
                    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5" aria-labelledby="chat-apply-h">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-teal">{sa.inProgress}</p>
                          <h2 id="chat-apply-h" className="mt-1 text-lg font-extrabold text-white">{chatDraft.scheme.name}</h2>
                          <p className="text-sm text-slate-300">
                            {chatDraft.missing.length} {sa.questionsLeft} · {sa.answerHere}
                          </p>
                        </div>
                        <button onClick={() => openSmartApply({ draftId: chatDraft.id })} className="btn btn-on-dark btn-sm">
                          Open in Smart Apply <ArrowRight className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                      <div className="mt-4">
                        <MissingQuestions
                          t={sa}
                          language={currentLanguage}
                          speechLocale={langConfig.speechLocale}
                          questions={chatDraft.missing}
                          dark
                          compact
                          onAnswer={async (key, text, via) => {
                            try {
                              const res = await autofillApi.answer(chatDraft.id, key, text, via === 'voice' ? 'voice' : 'chat');
                              setChatDraft(res.draft);
                              handleAutofillSession(await autofillApi.session());
                              return res.result.ok ? res.result.error || null : res.result.error || 'Not understood — please try again.';
                            } catch (err: any) {
                              return err.message;
                            }
                          }}
                        />
                      </div>
                    </section>
                  )}
                </>
              )}

              {currentChannel === 'ivr' && (
                <>
                  <IvrHelpline
                    currentLanguage={currentLanguage}
                    userProfile={userProfile}
                    onUpdateProfile={handleUpdateProfile}
                    onGenerateRoadmap={handleGenerateRoadmap}
                    roadmap={roadmap}
                    onOpenKaushalPatra={() => setIsKaushalPatraOpen(true)}
                  />
                  <HelplineResume language={currentLanguage} langConfig={langConfig} />
                </>
              )}

              {currentChannel === 'district_map' && (
                <DistrictExplorer
                  userProfile={userProfile}
                  onSelectDistrict={handleSelectDistrict}
                  onGenerateRoadmap={handleGenerateRoadmap}
                />
              )}
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-line bg-white pb-20 lg:pb-0">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 text-sm md:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <UdaanOneLogo className="h-9 w-9" />
              <span className="text-base font-extrabold text-navy">
                UDAAN <span className="text-teal-600">ONE</span>
              </span>
            </div>
            <p className="mt-3 font-semibold text-navy">AI for Opportunity. Technology for All.</p>
            <p className="mt-1 max-w-xs text-muted">Voice-first, multilingual guidance for schemes, skills, livelihoods and applications.</p>
          </div>
          <nav aria-label="Explore">
            <p className="font-bold text-navy">Explore</p>
            <ul className="mt-3 space-y-2 text-muted">
              {([
                ['schemes', 'Explore Schemes'],
                ['documents', 'Documents & certificates'],
                ['skills', 'Skills & Opportunities'],
                ['learning', 'Learning Hub'],
                ['enterprise', 'Start a business'],
                ['smart_apply', 'Smart Apply'],
                ['applications', 'My Applications'],
              ] as Array<[ChannelMode, string]>).map(([id, label]) => (
                <li key={id}>
                  <button onClick={() => setCurrentChannel(id)} className="hover:text-navy hover:underline">{label}</button>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Other ways to use UDAAN ONE">
            <p className="font-bold text-navy">Other ways</p>
            <ul className="mt-3 space-y-2 text-muted">
              {([
                ['voice_studio', 'Talk to UDAAN AI'],
                ['ivr', 'Phone helpline (demo)'],
                ['whatsapp', 'WhatsApp assistant (demo)'],
                ['kiosk', 'Kiosk mode'],
                ['district_map', 'District map'],
              ] as Array<[ChannelMode, string]>).map(([id, label]) => (
                <li key={id}>
                  <button onClick={() => setCurrentChannel(id)} className="hover:text-navy hover:underline">{label}</button>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <p className="font-bold text-navy">About this information</p>
            <p className="mt-3 text-muted">
              Eligibility shown is a preliminary estimate. Final decisions rest with the responsible government department. UDAAN ONE does not submit applications — always confirm on the official portal.
            </p>
          </div>
        </div>
      </footer>

      <div className="immersive-vars">
      {/* Modals */}
        <KaushalPatraModal
          isOpen={isKaushalPatraOpen}
          onClose={() => setIsKaushalPatraOpen(false)}
          profile={userProfile}
          roadmap={roadmap}
          currentLanguage={currentLanguage}
          savedSchemeIds={savedSchemeIds}
        />

        <ProfileForm
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          profile={userProfile}
          onSaveProfile={(updated) => {
            setUserProfile(updated);
            syncToAutofill(updated, 'typed');
            showNotification(`Profile updated for ${updated.name || 'you'}`);
          }}
        />
      </div>
    </div>
  );
}
