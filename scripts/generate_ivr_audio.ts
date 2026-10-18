import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const cacheDir = path.join(process.cwd(), '.tts_cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

async function fetchGoogleTTSChunk(text: string, lang: string): Promise<Buffer> {
  const url = 'https://translate.google.com/translate_tts?ie=UTF-8&q=' + encodeURIComponent(text) + '&tl=' + lang + '&client=tw-ob';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  if (!res.ok) throw new Error(`Google TTS failed for lang ${lang}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function fetchGoogleTTS(text: string, lang: string): Promise<Buffer> {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).length > 140) {
      if (current) chunks.push(current.trim());
      current = w;
    } else {
      current = current ? current + ' ' + w : w;
    }
  }
  if (current) chunks.push(current.trim());

  const buffers: Buffer[] = [];
  for (const c of chunks) {
    buffers.push(await fetchGoogleTTSChunk(c, lang));
  }
  return Buffer.concat(buffers);
}

function saveAudio(text: string, buffer: Buffer, voiceName = 'Kore') {
  const trimmed = text.trim().slice(0, 400);
  const key = crypto.createHash('md5').update(`${voiceName}:${trimmed}`).digest('hex');
  const fPath = path.join(cacheDir, `${key}.json`);
  fs.writeFileSync(fPath, JSON.stringify({
    audioBase64: buffer.toString('base64'),
    mimeType: 'audio/mpeg',
    text: trimmed,
    voiceName
  }));
  console.log(`Saved audio [${key}] for text: ${trimmed.slice(0, 40)}...`);
}

async function run() {
  console.log('Generating complete IVR studio audio for PM-AJAY...');

  // 1. Multilingual Welcome Announcement (Stitched seamlessly with each language's native pronunciation)
  const welcomeText = 'Welcome to PM-AJAY National Livelihood Helpline 1800-11-2529. For English press 1. हिन्दी के लिए 2 दबाएं. தமிழுக்கு 3-ஐ அழுத்தவும். తెలుగు కోసం 4 నొక్కండి. ಕನ್ನಡಕ್ಕಾಗಿ 5 ಒತ್ತಿರಿ. മലയാളത്തിനായി 6 അമർത്തുക.';
  const welcomeParts = [
    { text: 'Welcome to PM-AJAY National Livelihood Helpline 1800-11-2529. For English press 1.', lang: 'en' },
    { text: 'हिन्दी के लिए 2 दबाएं।', lang: 'hi' },
    { text: 'தமிழுக்கு 3-ஐ அழுத்தவும்.', lang: 'ta' },
    { text: 'తెలుగు కోసం 4 నొక్కండి.', lang: 'te' },
    { text: 'ಕನ್ನಡಕ್ಕಾಗಿ 5 ಒತ್ತಿರಿ.', lang: 'kn' },
    { text: 'മലയാളത്തിനായി 6 അമർത്തുക.', lang: 'ml' }
  ];
  const welcomeBufs: Buffer[] = [];
  for (const p of welcomeParts) {
    welcomeBufs.push(await fetchGoogleTTSChunk(p.text, p.lang));
  }
  saveAudio(welcomeText, Buffer.concat(welcomeBufs));

  // 2. Language Branches (Key 1 to 6)
  const ivrPrompts: Array<{ lang: string; texts: string[] }> = [
    {
      lang: 'en',
      texts: [
        'You have selected English.\n• For Free NSQF Skill Training and daily stipend, press 1.\n• For PM-AJAY 50% Capital Grant Subsidy up to ₹50,000, press 2.\n• To speak with our AI Livelihood Counselor, press 3.',
        'Under PM-AJAY GIA component, certified NSQF Level 3 to 5 courses in garments, leather, solar tech, and mechanics are 100% free with daily stipend and free toolkits. We are mapping your nearest district training center.',
        'Under PM-AJAY Income Generating Schemes, SC beneficiaries receive 50% non-refundable capital subsidy up to ₹50,000 for setting up their own shop, coupled with concessional MUDRA loans.',
        'Connecting to UDAAN ONE AI Voice Counselor. After the tone, please state your name, district, and preferred skill. Beep!',
        'Your PM-AJAY skilling recommendation has been sent via SMS. Thank you for calling.'
      ]
    },
    {
      lang: 'hi',
      texts: [
        'आपने हिन्दी का चयन किया है।\n• निःशुल्क NSQF कौशल प्रशिक्षण एवं दैनिक वजीफे के लिए 1 दबाएं।\n• PM-AJAY ₹50,000 पूंजी अनुदान सब्सिडी के लिए 2 दबाएं।\n• कौशल मित्र AI काउंसलर से बात करने के लिए 3 दबाएं।',
        'PM-AJAY (GIA) के अंतर्गत सिलाई, चमड़ा, सोलर और वाहन मैकेनिक के NSQF कोर्स पूर्णतः मुफ्त हैं। इसमें दैनिक वजीफा और आधुनिक टूलकिट भी दी जाती है। आपके जिले का केंद्र मैप किया जा रहा है।',
        'PM-AJAY आय अर्जक योजना के तहत अनुसूचित जाति लाभार्थियों को अपनी दुकान या उद्यम लगाने के लिए 50% पूंजी अनुदान (अधिकतम ₹50,000) गैर-वापसी सहायता के रूप में दिया जाता है।',
        'उड़ान वन AI काउंसलर से आपका संपर्क कराया जा रहा है। बीप के बाद अपना नाम, जिला और पसंदीदा काम बोलें... बीप!',
        'आपकी PM-AJAY कौशल अनुशंसा एसएमएस द्वारा भेज दी गई है। धन्यवाद।'
      ]
    },
    {
      lang: 'ta',
      texts: [
        'நீங்கள் தமிழைத் தேர்ந்தெடுத்துள்ளீர்கள்.\n• இலவச NSQF திறன் பயிற்சி மற்றும் உதவித்தொகைக்கு 1-ஐ அழுத்தவும்.\n• PM-AJAY ₹50,000 மூலதன மானிய உதவிக்கு 2-ஐ அழுத்தவும்.\n• AI வாழ்வாதார ஆலோசகருடன் பேச 3-ஐ அழுத்தவும்.',
        'PM-AJAY (GIA) திட்டத்தின் கீழ் ஆடை தயாரிப்பு, தோல், சூரிய சக்தி மற்றும் மெக்கானிக் NSQF பயிற்சிகள் 100% இலவசம். தினசரி உதவித்தொகை மற்றும் கருவிப்பெட்டி வழங்கப்படும். உங்கள் மாவட்ட மையம் இணைக்கப்படுகிறது.',
        'PM-AJAY திட்டத்தின் கீழ் சொந்த கடை அல்லது குறுந்தொழில் தொடங்க 50% வரை அதிகபட்சம் ₹50,000 மூலதன மானியம் வழங்கப்படுகிறது. மேலும் குறைந்த வட்டியில் முத்ரா கடன் இணைப்பும் உண்டு.',
        'UDAAN ONE AI ஆலோசகருடன் இணைக்கப்படுகிறீர்கள். பீப் சத்தத்திற்குப் பிறகு உங்கள் பெயர், மாவட்டம் மற்றும் விருப்பமான தொழிலைக் கூறுங்கள்... பீப்!',
        'உங்கள் PM-AJAY திறன் பரிந்துரை SMS மூலம் அனுப்பப்பட்டுள்ளது. நன்றி.'
      ]
    },
    {
      lang: 'te',
      texts: [
        'మీరు తెలుగును ఎంచుకున్నారు.\n• ఉచిత NSQF నైపుణ్య శిక్షణ మరియు రోజువారీ స్టైపెండ్ కోసం 1 నొక్కండి.\n• PM-AJAY ₹50,000 వ్యాపార మూలధన సబ్సిడీ కోసం 2 నొక్కండి.\n• AI నైపుణ్య మిత్రుడితో మాట్లాడటానికి 3 నొక్కండి.',
        'PM-AJAY (GIA) కింద దుస్తుల తయారీ, లెదర్, సోలార్ మరియు మెకానిక్ NSQF కోర్సులు పూర్తిగా ఉచితం. రోజువారీ స్టైపెండ్ మరియు ఉచిత టూల్‌కిట్ ఇవ్వబడుతుంది. మీ సమీప జిల్లా కేంద్రం మ్యాప్ చేయబడుతోంది.',
        'PM-AJAY పథకం కింద స్వంత వ్యాపారం లేదా దుకాణం ఏర్పాటు కోసం 50% వరకు గరిష్టంగా ₹50,000 మూలధన సబ్సిడీ లభిస్తుంది. దీనితో పాటు ముద్రా రుణ సహాయం కూడా ఉంటుంది.',
        'UDAAN ONE AI కౌన్సెలర్‌తో కనెక్ట్ చేయబడుతోంది. బీప్ శబ్దం తర్వాత మీ పేరు, జిల్లా మరియు నైపుణ్యాన్ని మాట్లాడండి... బీప్!',
        'మీ PM-AJAY నైపుణ్య సిఫార్సు SMS ద్వారా పంపబడింది. ధన్యవాదాలు.'
      ]
    },
    {
      lang: 'kn',
      texts: [
        'ನೀವು ಕನ್ನಡವನ್ನು ಆಯ್ಕೆ ಮಾಡಿದ್ದೀರಿ.\n• ಉಚಿತ NSQF ಕೌಶಲ್ಯ ತರಬೇತಿ ಮತ್ತು ದಿನಭತ್ಯೆಗಾಗಿ 1 ಒತ್ತಿರಿ.\n• PM-AJAY ₹50,000 ಬಂಡವಾಳ ಸಬ್ಸಿಡಿ ಸಹಾಯಕ್ಕಾಗಿ 2 ಒತ್ತಿರಿ.\n• AI ಕೌಶಲ್ಯ ಸಲಹೆಗಾರರೊಂದಿಗೆ ಮಾತನಾಡಲು 3 ಒತ್ತಿರಿ.',
        'PM-AJAY (GIA) ಅಡಿಯಲ್ಲಿ ಗಾರ್ಮೆಂಟ್ಸ್, ಚರ್ಮ, ಸೋಲಾರ್ ಮತ್ತು ಮೆಕ್ಯಾನಿಕ್ NSQF ತರಬೇತಿಗಳು ಸಂಪೂರ್ಣ ಉಚಿತ. ದಿನಭತ್ಯೆ ಮತ್ತು ಉಚಿತ ಟೂಲ್‌ಕಿಟ್ ಸಿಗುತ್ತದೆ. ನಿಮ್ಮ ಜಿಲ್ಲಾ ಕೇಂದ್ರವನ್ನು ಜೋಡಿಸಲಾಗುತ್ತಿದೆ.',
        'PM-AJAY ಯೋಜನೆಯಡಿಯಲ್ಲಿ ಸ್ವಂತ ಅಂಗಡಿ ಅಥವಾ ಕಿರು ಉದ್ಯಮ ಪ್ರಾರಂಭಿಸಲು 50% ರವರೆಗೆ ಗರಿಷ್ಠ ₹50,000 ಬಂಡವಾಳ ಸಬ್ಸಿಡಿ ಲಭ್ಯವಿದೆ. ಜೊತೆಗೆ ಮುದ್ರಾ ಸಾಲದ ನೆರವು ಸಿಗುತ್ತದೆ.',
        'UDAAN ONE AI ಸಲಹೆಗಾರರೊಂದಿಗೆ ಸಂಪರ್ಕಿಸಲಾಗುತ್ತಿದೆ. ಬೀಪ್ ಶಬ್ದದ ನಂತರ ನಿಮ್ಮ ಹೆಸರು, ಜಿಲ್ಲೆ ಮತ್ತು ಕಲಿಯಲು ಬಯಸುವ ಕೆಲಸವನ್ನು ಮಾತನಾಡಿ... ಬೀಪ್!',
        'ನಿಮ್ಮ PM-AJAY ಕೌಶಲ್ಯ ಶಿಫಾರಸನ್ನು SMS ಮೂಲಕ ಕಳುಹಿಸಲಾಗಿದೆ. ಧನ್ಯವಾದಗಳು.'
      ]
    },
    {
      lang: 'ml',
      texts: [
        'നിങ്ങൾ മലയാളം തിരഞ്ഞെടുത്തു.\n• സൗജന്യ NSQF നൈപുണ്യ പരിശീലനത്തിനും സ്റ്റൈപ്പൻഡിനുമായി 1 അമർത്തുക.\n• PM-AJAY ₹50,000 മൂലധന സബ്‌സിഡിക്കായി 2 അമർത്തുക.\n• AI ലൈവ്ലിഹുഡ് കൗൺസിലറുമായി സംസാരിക്കാൻ 3 അമർത്തുക.',
        'PM-AJAY (GIA) പ്രകാരം വസ്ത്ര നിർമ്മാണം, തുകൽ, സോളാർ, മെക്കാനിക് NSQF കോഴ്സുകൾ തികച്ചும் സൗജന്യമാണ്. ദിവസേനയുള്ള സ്റ്റൈപ്പൻഡും സൗജന്യ ടൂൾകിറ്റും ലഭിക്കും. നിങ്ങളുടെ ജില്ലാ കേന്ദ്രം ബന്ധിപ്പിക്കുന്നു.',
        'PM-AJAY പദ്ധതി പ്രകാരം സ്വന്തം കട അല്ലെങ്കിൽ സംരംഭം തുടങ്ങാൻ 50% വരെ പരമാവധി ₹50,000 മൂലധന സബ്‌സിഡി ലഭ്യമാണ്. ഒപ്പം മുദ്ര വായ്പാ സൗകര്യവും ലഭിക്കും.',
        'UDAAN ONE AI കൗൺസിലറുമായി ബന്ധിപ്പിക്കുന്നു. ബീപ്പ് ശബ്ദത്തിന് ശേഷം നിങ്ങളുടെ പേര്, ജില്ല, താല്പര്യമുള്ള തൊഴിൽ എന്നിവ സംസാരിക്കൂ... ബീപ്പ്!',
        'നിങ്ങളുടെ PM-AJAY നൈപുണ്യ ശുപാർശ SMS വഴി അയച്ചിട്ടുണ്ട്. നന്ദി.'
      ]
    }
  ];

  for (const branch of ivrPrompts) {
    for (const t of branch.texts) {
      try {
        const buf = await fetchGoogleTTS(t, branch.lang);
        saveAudio(t, buf);
      } catch (e: any) {
        console.error(`Failed ${branch.lang}:`, e?.message || e);
      }
    }
  }

  console.log('All IVR audio successfully pre-cached!');
}

run();
