import { useCallback, useEffect, useRef, useState } from 'react';
import { BeneficiaryProfile, Language } from '../types';
import { aiService } from '../services/aiService';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'paused';

export interface VoiceMessage {
  role: 'user' | 'assistant';
  content: string;
}

// How long to wait after the user stops before sending what they said. Once the browser
// marks the phrase as finished, a short pause is enough; mid-phrase we wait longer.
const SILENCE_AFTER_FINAL_MS = 900;
const SILENCE_MID_PHRASE_MS = 1800;

/**
 * Shared voice-first conversation loop: listen (waiting for the user to finish),
 * ask the counsellor, speak the full reply, then listen again if in hands-free mode.
 */
export function useVoiceAssistant(
  language: Language,
  profile: BeneficiaryProfile,
  channel: string,
  options: { onUserText?: (text: string) => void; initialMessages?: VoiceMessage[] } = {}
) {
  const [state, setState] = useState<VoiceState>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [messages, setMessages] = useState<VoiceMessage[]>(options.initialMessages || []);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const pendingRef = useRef('');
  const carriedRef = useRef('');
  const messagesRef = useRef<VoiceMessage[]>(options.initialMessages || []);
  const onUserTextRef = useRef(options.onUserText);
  onUserTextRef.current = options.onUserText;
  const stateRef = useRef<VoiceState>('idle');
  const handsFreeRef = useRef(false);
  const askRef = useRef<(text: string) => Promise<void>>(async () => {});

  const supported =
    typeof window !== 'undefined' && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const setVoiceState = (s: VoiceState) => {
    stateRef.current = s;
    setState(s);
  };

  const clearSilence = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const stopRecognition = useCallback(() => {
    clearSilence();
    const rec = recognitionRef.current;
    if (rec) {
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      try {
        rec.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }
  }, []);

  const commit = () => {
    clearSilence();
    const text = pendingRef.current.trim();
    pendingRef.current = '';
    carriedRef.current = '';
    setLiveTranscript('');
    stopRecognition();
    if (text) askRef.current(text);
    else setVoiceState('idle');
  };

  const startRecognition = (keepPending = false) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError('Voice input is not supported in this browser. Please type your question.');
      return;
    }
    if (!keepPending) {
      stopRecognition();
      pendingRef.current = '';
      carriedRef.current = '';
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = language.speechLocale || 'en-IN';

    rec.onresult = (event: any) => {
      let sessionText = '';
      for (let i = 0; i < event.results.length; i++) sessionText += event.results[i][0].transcript + ' ';
      const lastIsFinal = Boolean(event.results[event.results.length - 1]?.isFinal);
      const full = `${carriedRef.current} ${sessionText}`.replace(/\s+/g, ' ').trim();
      if (!full) return;
      pendingRef.current = full;
      setLiveTranscript(full);
      clearSilence();
      silenceTimerRef.current = setTimeout(commit, lastIsFinal ? SILENCE_AFTER_FINAL_MS : SILENCE_MID_PHRASE_MS);
    };
    rec.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('Microphone permission was denied. Allow microphone access or type your question.');
        handsFreeRef.current = false;
        setVoiceState('idle');
      }
    };
    rec.onend = () => {
      // Browser ended the session mid-utterance: keep what was heard and continue
      if (stateRef.current === 'listening') {
        carriedRef.current = pendingRef.current;
        recognitionRef.current = null;
        setTimeout(() => {
          if (stateRef.current === 'listening') startRecognition(true);
        }, 150);
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setError(null);
      setVoiceState('listening');
    } catch (e) {
      // start() throws if already started; ignore
    }
  };

  const ask = async (text: string) => {
    const question = text.trim();
    if (!question) return;
    stopRecognition();
    aiService.stopAudio();

    const history = [...messagesRef.current, { role: 'user' as const, content: question }];
    messagesRef.current = history;
    setMessages(history);
    setVoiceState('processing');
    onUserTextRef.current?.(question);

    const reply = await aiService.chatWithAssistant(history.slice(-8), profile, language.name, channel);
    const withReply = [...history, { role: 'assistant' as const, content: reply }];
    messagesRef.current = withReply;
    setMessages(withReply);

    setVoiceState('speaking');
    await aiService.playSpeech(reply, language.speechLocale);
    if (stateRef.current !== 'speaking') return; // stopped or interrupted
    if (handsFreeRef.current) startRecognition();
    else setVoiceState('idle');
  };
  askRef.current = ask;

  /** Main mic button: start a hands-free conversation, or stop everything. */
  const toggleListening = () => {
    if (stateRef.current === 'idle') {
      handsFreeRef.current = true;
      startRecognition();
    } else {
      stop();
    }
  };

  /** Send what has been heard so far without waiting for the silence timeout. */
  const finishSpeaking = () => {
    if (stateRef.current === 'listening') commit();
  };

  const stop = () => {
    handsFreeRef.current = false;
    stopRecognition();
    aiService.stopAudio();
    pendingRef.current = '';
    carriedRef.current = '';
    setLiveTranscript('');
    setVoiceState('idle');
  };

  const pause = () => {
    if (stateRef.current === 'speaking') {
      aiService.pauseAudio();
      setVoiceState('paused');
    }
  };

  const resume = () => {
    if (stateRef.current === 'paused') {
      aiService.resumeAudio();
      setVoiceState('speaking');
    }
  };

  const repeat = async () => {
    const last = [...messagesRef.current].reverse().find((m) => m.role === 'assistant');
    if (!last) return;
    stopRecognition();
    setVoiceState('speaking');
    await aiService.playSpeech(last.content, language.speechLocale);
    if (stateRef.current === 'speaking') setVoiceState('idle');
  };

  const reset = () => {
    stop();
    messagesRef.current = [];
    setMessages([]);
  };

  // Language change or unmount: stop any audio / listening
  useEffect(() => () => stop(), [language.code]);

  return {
    state,
    supported,
    liveTranscript,
    messages,
    error,
    toggleListening,
    finishSpeaking,
    ask: (text: string) => {
      handsFreeRef.current = false;
      return ask(text);
    },
    stop,
    pause,
    resume,
    repeat,
    reset,
  };
}
