import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthGate, savedLanguage } from './components/AuthGate';
import { AutoTranslate } from './components/AutoTranslate';
import { VerifyCertificate } from './components/learning/Certificates';
import './index.css';

// A certificate check link (?verify=UO-XXXX-XXXX) opens without signing in
const verifyId = new URLSearchParams(window.location.search).get('verify');

createRoot(document.getElementById('root')!).render(
  verifyId ? (
    <>
      <AutoTranslate language={savedLanguage()} />
      <VerifyCertificate id={verifyId.toUpperCase()} />
    </>
  ) : (
    <AuthGate>
      <App />
    </AuthGate>
  )
);
