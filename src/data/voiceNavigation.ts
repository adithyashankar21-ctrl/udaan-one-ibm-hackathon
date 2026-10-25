import type { ChannelMode } from '../types';

/**
 * "Open the loans page", "मुझे योजनाएँ दिखाओ", "smart apply par le chalo": spoken requests to go to a
 * page of the app, in every supported language (pure: used on the server and in the browser).
 */

/** Words that ask to go somewhere. Order: en/Hinglish, hi, mr, ta, te, kn, ml, bn, gu, pa, or, ur. */
const GO_WORDS =
  /\b(open|go to|go back|take me|navigate|switch to|show me the|bring up|kholo|khol do|le chalo|chalo|jao|dikhao)\b|खोलो|खोल दो|खोलिए|ले चलो|चलो|जाओ|दिखाओ|दिखाइए|उघडा|उघड|दाखवा|घेऊन चल|திற|திறங்கள்|காட்டு|செல்|போ|తెరువు|తెరవండి|చూపించు|వెళ్ళు|ತೆರೆ|ತೆರೆಯಿರಿ|ತೋರಿಸು|ಹೋಗು|തുറക്കൂ|തുറക്കുക|കാണിക്കൂ|പോകൂ|খোলো|খুলুন|দেখাও|যাও|ખોલો|બતાવો|જાઓ|ਖੋਲ੍ਹੋ|ਦਿਖਾਓ|ਚੱਲੋ|ଖୋଲ|ଦେଖାଅ|ଚାଲ|کھولو|دکھاؤ|لے چلو|جاؤ/i;

/** Each page and the names people use for it (longest names are checked first). */
const PAGES: Array<{ id: ChannelMode; label: string; names: RegExp }> = [
  { id: 'smart_apply', label: 'Smart Apply', names: /smart ?apply|स्मार्ट ?अप्लाई|ஸ்மார்ட் ?அப்ளை|స్మార్ట్ ?అప్లై|ಸ್ಮಾರ್ಟ್ ?ಅಪ್ಲೈ|സ്മാർട്ട് ?അപ്ലൈ|স্মার্ট ?অ্যাপ্লাই|સ્માર્ટ ?એપ્લાય|ਸਮਾਰਟ ?ਅਪਲਾਈ|ସ୍ମାର୍ଟ ?ଆପ୍ଲାଇ|سمارٹ ?اپلائی/i },
  { id: 'applications', label: 'My applications', names: /my applications|my forms|my drafts|meri arzi|मेरे आवेदन|मेरी अर्ज़ी|मेरी अर्जी|माझे अर्ज|என் விண்ணப்பங்கள்|నా దరఖాస్తులు|ನನ್ನ ಅರ್ಜಿಗಳು|എന്റെ അപേക്ഷകൾ|আমার আবেদন|મારી અરજીઓ|ਮੇਰੀਆਂ ਅਰਜ਼ੀਆਂ|ମୋ ଆବେଦନ|میری درخواستیں/i },
  { id: 'learning', label: 'Learning Hub', names: /learning hub|learning|courses|guru|लर्निंग|पाठ्यक्रम|कोर्स|अभ्यासक्रम|கற்றல்|பாடநெறி|నేర్చుకో|కోర్సు|ಕಲಿಕೆ|ಕೋರ್ಸ್|പഠന|കോഴ്സ്|শেখা|কোর্স|શીખ|કોર્સ|ਸਿੱਖਿਆ|ਕੋਰਸ|ଶିକ୍ଷା|କୋର୍ସ|کورس|سیکھنے/i },
  { id: 'whatsapp', label: 'WhatsApp assistant', names: /whats ?app|व्हाट्सएप|व्हाट्सऐप|वॉट्सॲप|வாட்ஸ்அப்|వాట్సాప్|ವಾಟ್ಸಾಪ್|വാട്സ്ആപ്പ്|হোয়াটসঅ্যাপ|વોટ્સએપ|ਵਟਸਐਪ|ହ୍ୱାଟସଆପ|واٹس ایپ/i },
  { id: 'ivr', label: 'Phone helpline', names: /helpline|phone line|ivr|हेल्पलाइन|हेल्पलाईन|ஹெல்ப்லைன்|హెల్ప్‌లైన్|ಹೆಲ್ಪ್‌ಲೈನ್|ഹെൽപ്പ്‌ലൈൻ|হেল্পলাইন|હેલ્પલાઇન|ਹੈਲਪਲਾਈਨ|ହେଲ୍ପଲାଇନ|ہیلپ لائن/i },
  { id: 'kiosk', label: 'Kiosk mode', names: /kiosk|कियोस्क|किओस्क|கியோஸ்க்|కియోస్క్|ಕಿಯೋಸ್ಕ್|കിയോസ്ക്|কিয়স্ক|કિયોસ્ક|ਕਿਓਸਕ|କିଓସ୍କ|کیوسک/i },
  { id: 'district_map', label: 'District map', names: /district map|map|नक्शा|मैप|ज़िला|जिला|नकाशा|வரைபடம்|மாவட்ட|మ్యాప్|జిల్లా|ನಕ್ಷೆ|ಜಿಲ್ಲೆ|ഭൂപടം|ജില്ല|মানচিত্র|জেলা|નકશો|જિલ્લો|ਨਕਸ਼ਾ|ਜ਼ਿਲ੍ਹਾ|ମାନଚିତ୍ର|ଜିଲ୍ଲା|نقشہ|ضلع/i },
  { id: 'voice_studio', label: 'Talk to UDAAN AI', names: /talk to udaan|voice assistant|voice studio|voice agent|वॉइस असिस्टेंट|आवाज़ सहायक|आवाज सहायक/i },
  { id: 'documents', label: 'Documents', names: /documents?|certificates?|दस्तावेज़|दस्तावेज|प्रमाण ?पत्र|कागज़ात|कागजात|कागदपत्र|ஆவணங்கள்|சான்றிதழ்|పత్రాలు|ధ్రువపత్ర|ದಾಖಲೆ|ಪ್ರಮಾಣಪತ್ರ|രേഖകൾ|സർട്ടിഫിക്കറ്റ്|নথি|সার্টিফিকেট|দস্তাবেজ|દસ્તાવેજ|પ્રમાણપત્ર|ਦਸਤਾਵੇਜ਼|ਸਰਟੀਫਿਕੇਟ|ଦଲିଲ|ପ୍ରମାଣପତ୍ର|دستاویز|سرٹیفکیٹ/i },
  { id: 'loans', label: 'Loans', names: /loans?|लोन|ऋण|कर्ज़|कर्ज|கடன்|லோன்|లోన్|రుణ|ಸಾಲ|ಲೋನ್|വായ്പ|ലോൺ|ঋণ|লোন|લોન|ધિરાણ|ਕਰਜ਼ਾ|ਲੋਨ|ଋଣ|ଲୋନ|قرض|لون/i },
  { id: 'skills', label: 'Skills', names: /skills?|training|jobs?|कौशल|स्किल|प्रशिक्षण|नौकरी|कौशल्य|திறன்|பயிற்சி|నైపుణ్య|శిక్షణ|ಕೌಶಲ|ತರಬೇತಿ|നൈപുണ്യ|പരിശീലന|দক্ষতা|প্রশিক্ষণ|કૌશલ|તાલીમ|ਹੁਨਰ|ਸਿਖਲਾਈ|ଦକ୍ଷତା|ତାଲିମ|ہنر|تربیت/i },
  { id: 'schemes', label: 'Schemes', names: /schemes?|yojana|योजना|योजनाएँ|योजनाएं|திட்ட|పథక|ಯೋಜನೆ|പദ്ധതി|প্রকল্প|যোজনা|યોજના|ਯੋਜਨਾ|ଯୋଜନା|اسکیم|منصوبہ/i },
  { id: 'home', label: 'Home', names: /home ?page|home|main page|होम|मुख्य पेज|मुख्यपृष्ठ|முகப்பு|హోమ్|ಮುಖಪುಟ|ഹോം|হোম|હોમ|ਹੋਮ|ହୋମ|ہوم/i },
];

/** Asking about something ("what documents do I need?") is a question, not a request to go there. */
const QUESTION = /\b(what|which|why|when|how much|how many|do i need|need for|kya|kaun|kitna|kitne)\b|क्या|कौन|कितन|क्यों/i;

export const PAGE_LABELS: Partial<Record<ChannelMode, string>> = Object.fromEntries(PAGES.map((p) => [p.id, p.label]));

/** The page a spoken request asks to open, or null. */
export function detectNavIntent(text: string): ChannelMode | null {
  const t = (text || '').trim();
  if (!t || t.split(/\s+/).length > 14 || !GO_WORDS.test(t) || QUESTION.test(t)) return null;
  return PAGES.find((p) => p.names.test(t))?.id || null;
}

/** "Fill it in Smart Apply": the application should be filled on the Smart Apply page, not in the conversation. */
export const wantsSmartApplyPage = (text: string) => PAGES[0].names.test(text || '');
