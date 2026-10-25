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
  LivelihoodAnalysis,
  SavedRoadmap
} from './types';
import { SiteHeader, UdaanOneLogo } from './components/shell/SiteHeader';
import { HomePage } from './components/pages/HomePage';
import { SchemesPage } from './components/pages/SchemesPage';
import { SkillsPage } from './components/pages/SkillsPage';
import { LearningHubPage } from './components/pages/LearningHubPage';
import { EnterprisePage } from './components/pages/EnterprisePage';
import { ApplicationsPage } from './components/pages/ApplicationsPage';
import { DocumentsPage } from './components/pages/DocumentsPage';
import { LoansPage } from './components/pages/LoansPage';
import { VoiceStudio } from './components/VoiceStudio';
import { KioskMode } from './components/KioskMode';
import { WhatsAppVoiceBot } from './components/WhatsAppVoiceBot';
import { IvrHelpline } from './components/IvrHelpline';
import { DistrictExplorer } from './components/DistrictExplorer';
import { KaushalPatraModal } from './components/KaushalPatraModal';
import { ProfileForm } from './components/ProfileForm';
import { SmartApplyPage } from './components/smartapply/SmartApplyPage';
import { HelplineResume } from './components/smartapply/HelplineResume';
import { SUPPORTED_LANGUAGES } from './data/languages';
import { AutoTranslate } from './components/AutoTranslate';
import { saveLanguage, savedLanguage } from './components/AuthGate';
import { ProfileSetup, profileComplete } from './components/ProfileSetup';
import { FORM_SCHEMA_MAP } from './data/autofillSchema';
import { LOAN_WORDS } from './data/loanCatalog';
import { getSmartApplyStrings } from './data/smartApplyStrings';
import { aiService } from './services/aiService';
import {
  APPLY_INTENT_EVENT,
  NAV_INTENT_EVENT,
  autofillApi,
  toAutofillUpdates,
  toBeneficiaryPartial,
  type ApplyIntentDetail,
  type SessionState,
} from './services/autofillApi';
import { LEARN_INTENT_EVENT, type LearningEntry } from './services/learnApi';
import { COURSE_MAP } from './data/learningTracks';
import { setPrivateValues } from './services/translate';
import { ROADMAP_INTENT_EVENT, loadLocalRoadmaps, mergeRoadmaps, saveLocalRoadmaps, type RoadmapRequest } from './services/roadmaps';
import { ModeShell, isAccessMode } from './components/shell/ModeShell';

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

/** A person's details that must never be sent for translation: names (and their parts), contact, address, ID numbers, references. */
function privateValuesOf(session: SessionState | null, profile?: BeneficiaryProfile): string[] {
  const f = session?.profile?.fields || {};
  const names = [f.fullName?.value, f.fatherSpouseName?.value, f.motherName?.value, profile?.name, profile?.fatherSpouseName];
  return [
    ...names,
    // Parts of a name are shown on their own too ("Asha" in a greeting)
    ...names.flatMap((n) => String(n || '').split(/\s+/).filter((w) => w.length >= 3)),
    ...(['mobile', 'email', 'addressLine', 'pincode', 'aadhaar', 'panNumber', 'casteCertificateNumber', 'incomeCertificateNumber', 'bankAccountNumber', 'bankIfsc', 'rationCardNumber', 'passportNumber', 'voterIdNumber', 'drivingLicenceNumber', 'foreignPassportNumber', 'pioCardNumber'] as const).map((k) => f[k]?.value),
    profile?.phoneNumber,
    profile?.residentialAddress,
    profile?.bankAccountNumber,
    profile?.bplRationCardNumber,
    ...(session?.drafts || []).map((d) => d.reference),
  ].filter((v): v is string => Boolean(v));
}

export default function App() {
  const [currentChannel, setCurrentChannel] = useState<ChannelMode>('home');
  // The language chosen last time on this device (also on the sign-in screen)
  const [currentLanguage, setLanguageState] = useState<LanguageCode>(savedLanguage);
  const setCurrentLanguage = useCallback((code: LanguageCode) => {
    setLanguageState(code);
    saveLanguage(code);
  }, []);
  /** An application for the voice assistant to take in its conversation (handed over from the home orb). */
  const [deskEntry, setDeskEntry] = useState<{ schemeId: string } | null>(null);
  /** Decided once when the app loads: shown to people without a profile, until they finish it. */
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const profileChecked = useRef(false);
  const [userProfile, setUserProfile] = useState<BeneficiaryProfile>(CLEAN_EMPTY_PROFILE);
  // Career roadmaps are kept (this browser, and the account once there is one); the newest is shown
  const [roadmaps, setRoadmaps] = useState<SavedRoadmap[]>(loadLocalRoadmaps);
  const [roadmapId, setRoadmapId] = useState<string | null>(() => loadLocalRoadmaps()[0]?.id || null);
  const roadmap: LivelihoodAnalysis | null = roadmaps.find((r) => r.id === roadmapId)?.roadmap || roadmaps[0]?.roadmap || null;
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
  const [smartApplyEntry, setSmartApplyEntry] = useState<{ schemeId?: string | null; draftId?: string | null; channel?: string; values?: Record<string, string> } | null>(null);
  const channelRef = useRef(currentChannel);
  channelRef.current = currentChannel;

  /** Saved schemes are kept with the account once there is one (this browser keeps a copy too). */
  const accountSaves = useRef(false);
  const storeSavedSchemes = (next: string[]) => {
    try {
      localStorage.setItem('kv-saved-schemes', JSON.stringify(next));
    } catch {}
    if (accountSaves.current) autofillApi.saveSavedSchemes(next).catch(() => {});
  };
  const toggleSavedScheme = (id: string) => {
    setSavedSchemeIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      storeSavedSchemes(next);
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
    setPrivateValues(privateValuesOf(s));
    setAutofillSession(s);
    if (!profileChecked.current) {
      profileChecked.current = true;
      if (!profileComplete(s)) setShowProfileSetup(true);
    }
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

  // With an account, saved schemes follow the person to any device: merge this browser's with the account's once
  const hasConsent = Boolean(autofillSession?.consent);
  useEffect(() => {
    if (!hasConsent || accountSaves.current) return;
    autofillApi
      .savedSchemes()
      .then((ids) => {
        accountSaves.current = true;
        setSavedSchemeIds((local) => {
          const merged = [...new Set([...ids, ...local])];
          storeSavedSchemes(merged);
          return merged;
        });
      })
      .catch(() => {});
  }, [hasConsent]); // eslint-disable-line react-hooks/exhaustive-deps

  // The person's own details are never sent for translation (translations are shared by everyone).
  // Also set the moment a session arrives (handleAutofillSession), before the name is on screen.
  useEffect(() => {
    setPrivateValues(privateValuesOf(autofillSession, userProfile));
  }, [autofillSession, userProfile]);

  // Every page change starts at the top of the new page
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [currentChannel]);

  // Any channel (voice, chat, helpline, kiosk) can hand an "I want to apply" request to Smart Apply
  useEffect(() => {
    const onIntent = (e: Event) => {
      const detail = (e as CustomEvent<ApplyIntentDetail>).detail;
      // "Fill it in Smart Apply": open Smart Apply, which fills it by voice
      if (detail.target === 'smart_apply' && detail.schemeId) {
        aiService.whenSilent().then(() => openSmartApply({ schemeId: detail.schemeId, channel: 'voice' }));
        return;
      }
      // The helpline call takes the application itself, in the call
      if (detail.channel === 'helpline' && channelRef.current === 'ivr' && detail.schemeId) return setApplyIntent(null);
      // The voice agent fills the application itself, in its own conversation
      if (detail.channel === 'voice' && channelRef.current === 'voice_studio' && detail.schemeId) return setApplyIntent(null);
      // From the home orb: carry on in the full voice assistant, which takes the application
      if (detail.channel === 'voice' && channelRef.current === 'home' && detail.schemeId) {
        setApplyIntent(null);
        aiService.whenSilent().then(() => {
          setDeskEntry({ schemeId: detail.schemeId! });
          setCurrentChannel('voice_studio');
        });
        return;
      }
      // The WhatsApp bot takes the application in its chat
      if (detail.channel === 'chat' && channelRef.current === 'whatsapp' && detail.schemeId) return setApplyIntent(null);
      setApplyIntent(detail);
    };
    window.addEventListener(APPLY_INTENT_EVENT, onIntent);
    return () => window.removeEventListener(APPLY_INTENT_EVENT, onIntent);
  }, []);

  // A voice assistant that hears "open the loans page" goes there once its reply has been spoken
  useEffect(() => {
    const onNav = (e: Event) => {
      const page = (e as CustomEvent<{ page: ChannelMode }>).detail?.page;
      if (!page) return;
      setApplyIntent(null);
      setLearnIntent(null);
      aiService.whenSilent().then(() => {
        if (page === 'smart_apply') openSmartApply({ channel: 'voice' });
        else setCurrentChannel(page);
      });
    };
    window.addEventListener(NAV_INTENT_EVENT, onNav);
    return () => window.removeEventListener(NAV_INTENT_EVENT, onNav);
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

  // Any assistant channel that hears "make me a career roadmap…" / "how do I become…" makes one
  useEffect(() => {
    const onRoadmap = (e: Event) => {
      setApplyIntent(null);
      setLearnIntent(null);
      makeRoadmapRef.current((e as CustomEvent<RoadmapRequest>).detail?.request);
    };
    window.addEventListener(ROADMAP_INTENT_EVENT, onRoadmap);
    return () => window.removeEventListener(ROADMAP_INTENT_EVENT, onRoadmap);
  }, []);

  // With an account, roadmaps follow the person to any device: merge this browser's with the account's once
  const roadmapsSynced = useRef(false);
  useEffect(() => {
    if (!autofillSession?.consent || roadmapsSynced.current) return;
    roadmapsSynced.current = true;
    autofillApi
      .roadmaps()
      .then((fromAccount) => {
        const local = loadLocalRoadmaps();
        local.filter((r) => !fromAccount.some((a) => a.id === r.id)).forEach((r) => autofillApi.saveRoadmap(r).catch(() => {}));
        const merged = mergeRoadmaps(fromAccount, local);
        saveLocalRoadmaps(merged);
        setRoadmaps(merged);
        setRoadmapId((id) => (id && merged.some((r) => r.id === id) ? id : merged[0]?.id || null));
      })
      .catch(() => {
        roadmapsSynced.current = false;
      });
  }, [autofillSession?.consent]);

  /** Opens the Learning Hub at a course, a custom topic or a doubt. */
  const openLearning = (entry: Omit<LearningEntry, 'nonce'>) => {
    setLearnIntent(null);
    setLearningEntry({ ...entry, nonce: Date.now() });
    setCurrentChannel('learning');
  };

  /** Share details the person gives in any channel with the Smart Apply profile (after consent). */
  /** `confirm`: the person typed these into their profile themselves, so they replace what was there. */
  const syncToAutofill = (partial: Partial<BeneficiaryProfile>, source: string, confirm = false) => {
    if (!autofillSession?.consent) return;
    const updates = toAutofillUpdates(partial);
    if (Object.keys(updates).length === 0) return;
    autofillApi
      .updateProfile(updates, source, confirm)
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

  const openSmartApply = (entry: { schemeId?: string | null; draftId?: string | null; channel?: string; values?: Record<string, string> } = {}) => {
    setSmartApplyEntry(entry);
    setApplyIntent(null);
    setCurrentChannel('smart_apply');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // The newest unfinished draft, so chat channels can answer its questions in place
  const openDraftSummary = (autofillSession?.drafts || []).filter((d) => d.status.code === 'collecting').sort((a, b) => b.updatedAt - a.updatedAt)[0];

  const keepRoadmap = (saved: SavedRoadmap) => {
    setRoadmaps((list) => {
      const next = mergeRoadmaps([saved], list);
      saveLocalRoadmaps(next);
      return next;
    });
    setRoadmapId(saved.id);
    if (autofillSession?.consent) autofillApi.saveRoadmap(saved).catch(() => {});
  };

  /**
   * Makes a career roadmap. `request` is the goal in the person's own words (typed, spoken, or
   * heard by the chat, WhatsApp or voice assistant); without one it is made from the profile.
   */
  const makeRoadmap = async (request?: string) => {
    const goal = (request || '').trim();
    if (!goal && !userProfile.name) {
      setIsProfileModalOpen(true);
      showNotification('Tell us your goal, or add your name and work to your profile first.');
      return;
    }
    setIsGeneratingRoadmap(true);
    showNotification(goal ? `Making your roadmap: “${goal.slice(0, 60)}”…` : `Mapping NSQF skills & PM-AJAY grants in ${langConfig.name}...`);
    try {
      const result = await aiService.generateLivelihoodMapping(userProfile, langConfig.name, goal || undefined);
      keepRoadmap({ id: `rm-${Date.now().toString(36)}`, createdAt: Date.now(), roadmap: result });
      showNotification(result.fallback ? 'Roadmap prepared with general guidance' : 'Your career roadmap is ready');
    } catch (err: any) {
      console.error('Roadmap generation error:', err);
      showNotification('Could not make the roadmap just now. Please try again.');
    } finally {
      setIsGeneratingRoadmap(false);
      setIsKaushalPatraOpen(true);
    }
  };
  /** For buttons that make a roadmap from the profile (they pass a click event, not a goal). */
  const handleGenerateRoadmap = () => makeRoadmap();
  const makeRoadmapRef = useRef(makeRoadmap);
  makeRoadmapRef.current = makeRoadmap;

  const intentScheme = applyIntent?.schemeId ? FORM_SCHEMA_MAP[applyIntent.schemeId] : null;

  return (
    <div className="flex min-h-screen flex-col">
      <AutoTranslate language={currentLanguage} />
      {/* First visit: create the profile before entering the app */}
      {showProfileSetup && autofillSession && (
        <ProfileSetup
          language={currentLanguage}
          onLanguageChange={setCurrentLanguage}
          session={autofillSession}
          onSession={handleAutofillSession}
          onDone={() => setShowProfileSetup(false)}
        />
      )}
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
              {/* "I need a loan" without naming one: compare loans first */}
              {!applyIntent.schemeId && LOAN_WORDS.test(applyIntent.text || '') && (
                <button
                  onClick={() => {
                    setApplyIntent(null);
                    setCurrentChannel('loans');
                  }}
                  className="btn btn-on-dark flex-1 sm:flex-none"
                >
                  Compare loans
                </button>
              )}
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
            onApply={(schemeId, byVoice?: boolean) => openSmartApply({ schemeId, channel: byVoice ? 'voice' : undefined })}
            onNavigate={setCurrentChannel}
          />
        )}

        {currentChannel === 'documents' && (
          <DocumentsPage
            profile={userProfile}
            langConfig={langConfig}
            session={autofillSession}
            onApply={(schemeId, byVoice?: boolean) => openSmartApply({ schemeId, channel: byVoice ? 'voice' : undefined })}
            onNavigate={setCurrentChannel}
          />
        )}

        {currentChannel === 'loans' && (
          <LoansPage
            profile={userProfile}
            langConfig={langConfig}
            onApply={(schemeId, byVoice?: boolean) => openSmartApply({ schemeId, channel: byVoice ? 'voice' : undefined })}
            onApplyWith={(schemeId, values, byVoice) => openSmartApply({ schemeId, values, channel: byVoice ? 'voice' : undefined })}
            onLearn={(topic) => openLearning({ topic })}
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
            onApply={(schemeId, byVoice?: boolean) => openSmartApply({ schemeId, channel: byVoice ? 'voice' : undefined })}
            onNavigate={setCurrentChannel}
            onLearn={(topic, context) => openLearning({ topic, context })}
            onAskRoadmap={makeRoadmap}
            isGeneratingRoadmap={isGeneratingRoadmap}
          />
        )}

        {currentChannel === 'learning' && <LearningHubPage langConfig={langConfig} profile={userProfile} onNavigate={setCurrentChannel} entry={learningEntry} onEntryHandled={() => setLearningEntry(null)} />}

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
            onApply={(schemeId, byVoice?: boolean) => openSmartApply({ schemeId, channel: byVoice ? 'voice' : undefined })}
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
            onApply={(schemeId, byVoice?: boolean) => openSmartApply({ schemeId, channel: byVoice ? 'voice' : undefined })}
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
            initialValues={smartApplyEntry?.values}
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
            onSession={handleAutofillSession}
            deskEntry={deskEntry}
            onDeskEntryUsed={() => setDeskEntry(null)}
          />
        )}

        {isAccessMode(currentChannel) && (
          <ModeShell
            mode={currentChannel}
            onNavigate={setCurrentChannel}
            after={
              // The phone helpline is the in-browser prototype for now; the real Twilio line
              // (CallMeCard, server/voice) stays in the code but is not offered
              currentChannel === 'ivr' ? <HelplineResume language={currentLanguage} langConfig={langConfig} /> : undefined
            }
          >
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
              <WhatsAppVoiceBot
                currentLanguage={currentLanguage}
                userProfile={userProfile}
                onUpdateProfile={handleUpdateProfile}
                onGenerateRoadmap={handleGenerateRoadmap}
                roadmap={roadmap}
                onOpenKaushalPatra={() => setIsKaushalPatraOpen(true)}
                onSession={handleAutofillSession}
                openDraft={openDraftSummary ? { id: openDraftSummary.id, name: openDraftSummary.schemeName } : null}
              />
            )}

            {currentChannel === 'ivr' && (
              <IvrHelpline
                currentLanguage={currentLanguage}
                userProfile={userProfile}
                onUpdateProfile={handleUpdateProfile}
                onGenerateRoadmap={handleGenerateRoadmap}
                roadmap={roadmap}
                onOpenKaushalPatra={() => setIsKaushalPatraOpen(true)}
              />
            )}

            {currentChannel === 'district_map' && (
              <DistrictExplorer userProfile={userProfile} onSelectDistrict={handleSelectDistrict} onGenerateRoadmap={handleGenerateRoadmap} />
            )}
          </ModeShell>
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
                ['loans', 'Loans'],
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
          history={roadmaps}
          activeId={roadmapId || roadmaps[0]?.id}
          onPick={setRoadmapId}
          onAsk={makeRoadmap}
          busy={isGeneratingRoadmap}
        />

        <ProfileForm
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          profile={userProfile}
          onSaveProfile={(updated) => {
            // Only what the person changed is sent, as their own confirmed correction: it replaces a
            // value read from a document or said earlier (and settles any open conflict for it)
            const changed = Object.fromEntries(
              Object.entries(updated).filter(([k, v]) => String(v ?? '') !== String((userProfile as any)[k] ?? ''))
            ) as Partial<BeneficiaryProfile>;
            setUserProfile(updated);
            syncToAutofill(changed, 'typed', true);
            showNotification(`Profile updated for ${updated.name || 'you'}`);
          }}
        />
      </div>
    </div>
  );
}
