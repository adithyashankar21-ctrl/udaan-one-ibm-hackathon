/**
 * Shared definitions for Smart Apply & Autofill, used by both the server and the UI.
 *
 * Form layouts here are UDAAN ONE preparation schemas: the details these schemes commonly
 * ask for, based on their publicly listed requirements. They are NOT the official forms.
 * Official forms differ by State and change over time, so every schema points to the
 * official portal, and users can upload the official form PDF to have it filled directly.
 */

export type FieldType =
  | 'text'
  | 'date'
  | 'mobile'
  | 'email'
  | 'pincode'
  | 'ifsc'
  | 'account'
  | 'pan'
  | 'aadhaar'
  | 'money'
  | 'number'
  | 'select';

export type ProfileKey =
  | 'fullName'
  | 'dateOfBirth'
  | 'gender'
  | 'fatherSpouseName'
  | 'mobile'
  | 'email'
  | 'addressLine'
  | 'district'
  | 'state'
  | 'pincode'
  | 'aadhaar'
  | 'panNumber'
  | 'socialCategory'
  | 'subCaste'
  | 'casteCertificateNumber'
  | 'annualFamilyIncome'
  | 'incomeCertificateNumber'
  | 'familySize'
  | 'education'
  | 'occupation'
  | 'existingSkills'
  | 'bankAccountNumber'
  | 'bankIfsc'
  | 'bankName'
  | 'bankBranch'
  | 'rationCardNumber'
  | 'disability'
  | 'motherName'
  | 'placeOfBirth'
  | 'maritalStatus'
  | 'passportNumber'
  | 'voterIdNumber'
  | 'drivingLicenceNumber';

export interface ProfileFieldDef {
  key: ProfileKey;
  label: string;
  labelHi: string;
  type: FieldType;
  options?: string[];
  /** Short question asked when the value is missing. */
  question: string;
  questionHi: string;
  /** Never shown in full and never stored in full (Aadhaar). */
  sensitive?: boolean;
}

export const PROFILE_FIELDS: ProfileFieldDef[] = [
  { key: 'fullName', label: 'Full name', labelHi: 'पूरा नाम', type: 'text', question: 'What is your full name, as written on your Aadhaar?', questionHi: 'आपका पूरा नाम क्या है, जैसा आधार पर लिखा है?' },
  { key: 'dateOfBirth', label: 'Date of birth', labelHi: 'जन्म तिथि', type: 'date', question: 'What is your date of birth (DD/MM/YYYY)?', questionHi: 'आपकी जन्म तिथि क्या है (दिन/महीना/साल)?' },
  { key: 'gender', label: 'Gender', labelHi: 'लिंग', type: 'select', options: ['Female', 'Male', 'Transgender'], question: 'What is your gender?', questionHi: 'आपका लिंग क्या है?' },
  { key: 'fatherSpouseName', label: "Father's / spouse's name", labelHi: 'पिता / पति-पत्नी का नाम', type: 'text', question: "What is your father's or spouse's name?", questionHi: 'आपके पिता या पति/पत्नी का नाम क्या है?' },
  { key: 'mobile', label: 'Mobile number', labelHi: 'मोबाइल नंबर', type: 'mobile', question: 'What is your 10-digit mobile number?', questionHi: 'आपका 10 अंकों का मोबाइल नंबर क्या है?' },
  { key: 'email', label: 'Email', labelHi: 'ईमेल', type: 'email', question: 'What is your email address? (Say "none" if you do not have one.)', questionHi: 'आपका ईमेल क्या है? (न हो तो "नहीं" कहें)' },
  { key: 'addressLine', label: 'Address', labelHi: 'पता', type: 'text', question: 'What is your full home address (house, street, village or town)?', questionHi: 'आपका पूरा घर का पता क्या है (मकान, गली, गाँव या शहर)?' },
  { key: 'district', label: 'District', labelHi: 'ज़िला', type: 'text', question: 'Which district do you live in?', questionHi: 'आप किस ज़िले में रहते हैं?' },
  { key: 'state', label: 'State', labelHi: 'राज्य', type: 'text', question: 'Which State do you live in?', questionHi: 'आप किस राज्य में रहते हैं?' },
  { key: 'pincode', label: 'PIN code', labelHi: 'पिन कोड', type: 'pincode', question: 'What is your 6-digit PIN code?', questionHi: 'आपका 6 अंकों का पिन कोड क्या है?' },
  { key: 'aadhaar', label: 'Aadhaar number', labelHi: 'आधार नंबर', type: 'aadhaar', sensitive: true, question: 'Please upload your Aadhaar card, or type the last 4 digits of your Aadhaar.', questionHi: 'कृपया आधार कार्ड अपलोड करें, या आधार के आख़िरी 4 अंक लिखें।' },
  { key: 'panNumber', label: 'PAN', labelHi: 'पैन', type: 'pan', question: 'What is your PAN (10 characters, like ABCDE1234F)?', questionHi: 'आपका पैन नंबर क्या है (जैसे ABCDE1234F)?' },
  { key: 'socialCategory', label: 'Social category', labelHi: 'सामाजिक वर्ग', type: 'select', options: ['SC', 'ST', 'OBC', 'General', 'EWS'], question: 'Which social category do you belong to (SC, ST, OBC, General)?', questionHi: 'आप किस वर्ग से हैं (SC, ST, OBC, सामान्य)?' },
  { key: 'subCaste', label: 'Caste / sub-caste', labelHi: 'जाति / उप-जाति', type: 'text', question: 'What caste is written on your caste certificate?', questionHi: 'आपके जाति प्रमाण पत्र पर कौन-सी जाति लिखी है?' },
  { key: 'casteCertificateNumber', label: 'Caste certificate number', labelHi: 'जाति प्रमाण पत्र संख्या', type: 'text', question: 'What is the number on your caste certificate?', questionHi: 'आपके जाति प्रमाण पत्र की संख्या क्या है?' },
  { key: 'annualFamilyIncome', label: 'Annual family income (₹)', labelHi: 'वार्षिक पारिवारिक आय (₹)', type: 'money', question: 'What is your total annual family income in rupees?', questionHi: 'आपके परिवार की कुल सालाना आय कितने रुपये है?' },
  { key: 'incomeCertificateNumber', label: 'Income certificate number', labelHi: 'आय प्रमाण पत्र संख्या', type: 'text', question: 'What is the number on your income certificate?', questionHi: 'आपके आय प्रमाण पत्र की संख्या क्या है?' },
  { key: 'familySize', label: 'Family members', labelHi: 'परिवार के सदस्य', type: 'number', question: 'How many people are in your family?', questionHi: 'आपके परिवार में कितने लोग हैं?' },
  { key: 'education', label: 'Highest education', labelHi: 'सर्वोच्च शिक्षा', type: 'text', question: 'What is your highest education (for example 10th pass, 12th pass, ITI, graduate)?', questionHi: 'आपकी सबसे ऊँची पढ़ाई क्या है (जैसे 10वीं, 12वीं, ITI, स्नातक)?' },
  { key: 'occupation', label: 'Current occupation', labelHi: 'वर्तमान काम', type: 'text', question: 'What work do you do now?', questionHi: 'आप अभी क्या काम करते हैं?' },
  { key: 'existingSkills', label: 'Skills', labelHi: 'हुनर', type: 'text', question: 'What skills do you have?', questionHi: 'आपके पास कौन-से हुनर हैं?' },
  { key: 'bankAccountNumber', label: 'Bank account number', labelHi: 'बैंक खाता संख्या', type: 'account', question: 'What is your bank account number? (Uploading your passbook is easier.)', questionHi: 'आपका बैंक खाता नंबर क्या है? (पासबुक अपलोड करना आसान है)' },
  { key: 'bankIfsc', label: 'IFSC code', labelHi: 'IFSC कोड', type: 'ifsc', question: 'What is your bank IFSC code (11 characters, on the passbook)?', questionHi: 'आपके बैंक का IFSC कोड क्या है (पासबुक पर 11 अक्षर)?' },
  { key: 'bankName', label: 'Bank name', labelHi: 'बैंक का नाम', type: 'text', question: 'Which bank is your account in?', questionHi: 'आपका खाता किस बैंक में है?' },
  { key: 'bankBranch', label: 'Bank branch', labelHi: 'बैंक शाखा', type: 'text', question: 'Which branch is your account in?', questionHi: 'आपका खाता किस शाखा में है?' },
  { key: 'rationCardNumber', label: 'Ration card number', labelHi: 'राशन कार्ड संख्या', type: 'text', question: 'What is your ration card number? (Say "none" if you do not have one.)', questionHi: 'आपका राशन कार्ड नंबर क्या है? (न हो तो "नहीं" कहें)' },
  { key: 'disability', label: 'Disability (if any)', labelHi: 'दिव्यांगता (यदि हो)', type: 'text', question: 'Do you have any disability? Say "none" if not.', questionHi: 'क्या आपको कोई दिव्यांगता है? न हो तो "नहीं" कहें।' },
  { key: 'motherName', label: "Mother's name", labelHi: 'माता का नाम', type: 'text', question: "What is your mother's name?", questionHi: 'आपकी माता का नाम क्या है?' },
  { key: 'placeOfBirth', label: 'Place of birth (village/town, district)', labelHi: 'जन्म स्थान (गाँव/शहर, ज़िला)', type: 'text', question: 'Where were you born (village or town, and district)?', questionHi: 'आपका जन्म कहाँ हुआ था (गाँव या शहर, और ज़िला)?' },
  { key: 'maritalStatus', label: 'Marital status', labelHi: 'वैवाहिक स्थिति', type: 'select', options: ['Single', 'Married', 'Widowed', 'Divorced', 'Separated'], question: 'What is your marital status?', questionHi: 'आपकी वैवाहिक स्थिति क्या है?' },
  { key: 'passportNumber', label: 'Passport number', labelHi: 'पासपोर्ट नंबर', type: 'text', question: 'What is your passport number? Say "none" if you do not have one.', questionHi: 'आपका पासपोर्ट नंबर क्या है? न हो तो "नहीं" कहें।' },
  { key: 'voterIdNumber', label: 'Voter ID (EPIC) number', labelHi: 'मतदाता पहचान (EPIC) नंबर', type: 'text', question: 'What is your voter ID (EPIC) number? Say "none" if you do not have one.', questionHi: 'आपका मतदाता पहचान पत्र (EPIC) नंबर क्या है? न हो तो "नहीं" कहें।' },
  { key: 'drivingLicenceNumber', label: 'Driving licence number', labelHi: 'ड्राइविंग लाइसेंस नंबर', type: 'text', question: 'What is your driving licence number? Say "none" if you do not have one.', questionHi: 'आपका ड्राइविंग लाइसेंस नंबर क्या है? न हो तो "नहीं" कहें।' },
];

export const PROFILE_FIELD_MAP: Record<ProfileKey, ProfileFieldDef> = Object.fromEntries(
  PROFILE_FIELDS.map((f) => [f.key, f])
) as Record<ProfileKey, ProfileFieldDef>;

export type DocKind =
  | 'aadhaar'
  | 'pan'
  | 'income'
  | 'caste'
  | 'residence'
  | 'bank'
  | 'education'
  | 'ration'
  | 'passport'
  | 'voter'
  | 'dl'
  | 'birth'
  | 'utility'
  | 'other';

export const DOC_KINDS: Record<DocKind, { label: string; labelHi: string; yields: ProfileKey[] }> = {
  aadhaar: { label: 'Aadhaar card', labelHi: 'आधार कार्ड', yields: ['fullName', 'dateOfBirth', 'gender', 'addressLine', 'district', 'state', 'pincode', 'aadhaar', 'fatherSpouseName'] },
  pan: { label: 'PAN card', labelHi: 'पैन कार्ड', yields: ['fullName', 'fatherSpouseName', 'dateOfBirth', 'panNumber'] },
  income: { label: 'Income certificate', labelHi: 'आय प्रमाण पत्र', yields: ['fullName', 'annualFamilyIncome', 'incomeCertificateNumber', 'addressLine', 'district', 'state'] },
  caste: { label: 'Caste certificate', labelHi: 'जाति प्रमाण पत्र', yields: ['fullName', 'fatherSpouseName', 'socialCategory', 'subCaste', 'casteCertificateNumber', 'district', 'state'] },
  residence: { label: 'Residence / domicile certificate', labelHi: 'निवास प्रमाण पत्र', yields: ['fullName', 'addressLine', 'district', 'state', 'pincode'] },
  bank: { label: 'Bank passbook / cheque', labelHi: 'बैंक पासबुक / चेक', yields: ['fullName', 'bankAccountNumber', 'bankIfsc', 'bankName', 'bankBranch'] },
  education: { label: 'Education certificate / marksheet', labelHi: 'शिक्षा प्रमाण पत्र / अंकपत्र', yields: ['fullName', 'education', 'dateOfBirth', 'fatherSpouseName'] },
  ration: { label: 'Ration card', labelHi: 'राशन कार्ड', yields: ['fullName', 'rationCardNumber', 'familySize', 'addressLine', 'district', 'state'] },
  passport: { label: 'Passport', labelHi: 'पासपोर्ट', yields: ['fullName', 'dateOfBirth', 'gender', 'placeOfBirth', 'passportNumber', 'fatherSpouseName', 'motherName', 'addressLine', 'district', 'state', 'pincode'] },
  voter: { label: 'Voter ID (EPIC)', labelHi: 'मतदाता पहचान पत्र', yields: ['fullName', 'fatherSpouseName', 'gender', 'dateOfBirth', 'voterIdNumber', 'addressLine', 'district', 'state'] },
  dl: { label: 'Driving licence', labelHi: 'ड्राइविंग लाइसेंस', yields: ['fullName', 'dateOfBirth', 'fatherSpouseName', 'drivingLicenceNumber', 'addressLine', 'district', 'state', 'pincode'] },
  birth: { label: 'Birth certificate', labelHi: 'जन्म प्रमाण पत्र', yields: ['fullName', 'dateOfBirth', 'gender', 'placeOfBirth', 'fatherSpouseName', 'motherName'] },
  utility: { label: 'Utility bill (electricity / water / gas / phone)', labelHi: 'बिजली/पानी/गैस/फ़ोन बिल', yields: ['fullName', 'addressLine', 'district', 'state', 'pincode'] },
  other: { label: 'Other document', labelHi: 'अन्य दस्तावेज़', yields: [] },
};

/**
 * One documentary requirement of an application, e.g. "Proof of address". It is met by ANY
 * of the listed document kinds. `manual` requirements (photo, signature, medical form) cannot
 * be read by OCR — they are shown as a checklist item for the person to bring or upload.
 */
export interface Requirement {
  id: string;
  label: string;
  labelHi?: string;
  anyOf: DocKind[];
  required: boolean;
  manual?: boolean;
  /** Other accepted proofs that UDAAN ONE cannot read automatically (shown as text). */
  alsoAccepted?: string[];
  note?: string;
}

export const PROOF = {
  identity: (required = true): Requirement => ({ id: 'poi', label: 'Proof of identity', labelHi: 'पहचान का प्रमाण', anyOf: ['aadhaar', 'voter', 'pan', 'passport', 'dl'], required }),
  address: (required = true): Requirement => ({
    id: 'poa',
    label: 'Proof of address',
    labelHi: 'पते का प्रमाण',
    anyOf: ['aadhaar', 'voter', 'passport', 'dl', 'bank', 'utility', 'ration', 'residence'],
    required,
  }),
  birth: (required = true): Requirement => ({
    id: 'pob',
    label: 'Proof of date of birth',
    labelHi: 'जन्म तिथि का प्रमाण',
    anyOf: ['birth', 'education', 'passport', 'pan', 'dl', 'aadhaar'],
    required,
  }),
  photo: (note = 'Recent passport-size colour photo'): Requirement => ({ id: 'photo', label: 'Photograph', labelHi: 'फ़ोटो', anyOf: [], required: true, manual: true, note }),
  one: (kind: DocKind, required = true, label?: string): Requirement => ({ id: kind, label: label || '', anyOf: [kind], required }),
};

export interface FormFieldSpec {
  key: string;
  label: string;
  labelHi?: string;
  type: FieldType;
  required: boolean;
  section: string;
  /** Filled from the shared profile when set; otherwise answered for this application only. */
  profileKey?: ProfileKey;
  options?: string[];
  question?: string;
  questionHi?: string;
  help?: string;
}

export interface SchemeFormSchema {
  schemeId: string;
  formTitle: string;
  /** What the field list is based on, shown to the user. */
  basis: string;
  submission: {
    mode: 'portal' | 'office' | 'bank' | 'csc';
    where: string;
    url: string;
    /** Whether UDAAN ONE has an authorised submission integration. None are connected. */
    integration: 'none';
  };
  requiredDocs: DocKind[];
  optionalDocs: DocKind[];
  /** Proof-based requirements; when absent they are derived from requiredDocs/optionalDocs. */
  requirements?: Requirement[];
  /** 'scheme' = benefit/loan/skilling scheme; 'document' = official document or certificate service. */
  kind?: 'scheme' | 'document';
  /** Name of the official form, when it has one (e.g. "Form 49A"). */
  officialForm?: string;
  /** Words that suggest a person wants this scheme (any language). */
  keywords: string[];
  fields: FormFieldSpec[];
}

const p = (profileKey: ProfileKey, section: string, required = true): FormFieldSpec => {
  const def = PROFILE_FIELD_MAP[profileKey];
  return { key: profileKey, label: def.label, labelHi: def.labelHi, type: def.type, options: def.options, required, section, profileKey };
};

const IDENTITY = 'Applicant details';
const ADDRESS = 'Address & contact';
const SOCIAL = 'Category & income';
const BANK = 'Bank account';
const PROPOSAL = 'About this application';

const identity = (): FormFieldSpec[] => [
  p('fullName', IDENTITY),
  p('dateOfBirth', IDENTITY),
  p('gender', IDENTITY),
  p('fatherSpouseName', IDENTITY),
  p('aadhaar', IDENTITY),
];
const address = (emailRequired = false): FormFieldSpec[] => [
  p('mobile', ADDRESS),
  p('email', ADDRESS, emailRequired),
  p('addressLine', ADDRESS),
  p('district', ADDRESS),
  p('state', ADDRESS),
  p('pincode', ADDRESS),
];
const bank = (required = true): FormFieldSpec[] => [
  p('bankAccountNumber', BANK, required),
  p('bankIfsc', BANK, required),
  p('bankName', BANK, required),
  p('bankBranch', BANK, false),
];

const ask = (
  key: string,
  label: string,
  type: FieldType,
  question: string,
  opts: Partial<FormFieldSpec> = {}
): FormFieldSpec => ({ key, label, type, question, required: true, section: PROPOSAL, ...opts });

export const VISHWAKARMA_TRADES = [
  'Carpenter (Suthar)',
  'Boat Maker',
  'Armourer',
  'Blacksmith (Lohar)',
  'Hammer and Tool Kit Maker',
  'Locksmith',
  'Goldsmith (Sonar)',
  'Potter (Kumhaar)',
  'Sculptor / Stone Breaker',
  'Cobbler / Footwear Artisan',
  'Mason (Rajmistri)',
  'Basket / Mat / Broom Maker / Coir Weaver',
  'Doll & Toy Maker (Traditional)',
  'Barber (Naai)',
  'Garland Maker (Malakaar)',
  'Washerman (Dhobi)',
  'Tailor (Darzi)',
  'Fishing Net Maker',
];

export const FORM_SCHEMAS: SchemeFormSchema[] = [
  {
    schemeId: 'pm-ajay',
    formTitle: 'PM-AJAY — application for income-generating asset / grant support',
    basis:
      'PM-AJAY is implemented by State governments, so there is no single national form. These are the details district offices commonly ask for, based on the publicly listed documents.',
    submission: { mode: 'office', where: 'District Social Welfare Office or State SC Development Corporation', url: 'https://pmajay.dosje.gov.in', integration: 'none' },
    requiredDocs: ['aadhaar', 'caste', 'income', 'bank'],
    optionalDocs: ['ration', 'residence'],
    keywords: ['pm-ajay', 'pm ajay', 'pmajay', 'abhyuday', 'grant', 'subsidy', 'अनुदान', 'सब्सिडी', 'அனுதான', 'மானியம்', 'సబ్సిడీ', 'ಸಬ್ಸಿಡಿ', 'സബ്സിഡി'],
    fields: [
      ...identity(),
      ...address(),
      p('socialCategory', SOCIAL),
      p('subCaste', SOCIAL, false),
      p('casteCertificateNumber', SOCIAL),
      p('annualFamilyIncome', SOCIAL),
      p('incomeCertificateNumber', SOCIAL, false),
      p('occupation', PROPOSAL),
      ask('proposedActivity', 'Proposed activity / asset', 'text', 'What business or asset do you want support for (for example, a tailoring unit or a goat-rearing unit)?'),
      ask('projectCost', 'Estimated project cost (₹)', 'money', 'Roughly how much will the whole project cost, in rupees? Use the quotation if you have one.'),
      ask('bankLoan', 'Bank loan planned, if any (₹)', 'money', 'Are you also taking a bank loan? If yes, how much? Say "none" if not.', { required: false }),
      ...bank(),
    ],
  },
  {
    schemeId: 'pm-vishwakarma',
    formTitle: 'PM Vishwakarma — artisan registration details',
    basis:
      'Registration is done at a Common Service Centre (CSC) with Aadhaar biometric verification. These are the details the registration asks for, based on the public scheme guidelines.',
    submission: { mode: 'csc', where: 'Nearest Common Service Centre (CSC)', url: 'https://pmvishwakarma.gov.in', integration: 'none' },
    requiredDocs: ['aadhaar', 'bank'],
    optionalDocs: ['ration', 'caste'],
    keywords: ['vishwakarma', 'विश्वकर्मा', 'artisan', 'कारीगर', 'கைவினை', 'విశ్వకర్మ', 'ವಿಶ್ವಕರ್ಮ', 'വിശ്വകർമ'],
    fields: [
      ...identity(),
      ...address(),
      p('socialCategory', SOCIAL),
      p('rationCardNumber', SOCIAL, false),
      ask('trade', 'Traditional trade', 'select', 'Which traditional trade do you practise?', { options: VISHWAKARMA_TRADES, help: 'Only the 18 notified trades are covered.' }),
      ask('yearsInTrade', 'Years working in this trade', 'number', 'How many years have you worked in this trade?'),
      ...bank(),
    ],
  },
  {
    schemeId: 'pmkvy',
    formTitle: 'PMKVY / Skill India — candidate registration details',
    basis: 'Candidates register on the Skill India Digital Hub or at a training centre. These are the registration details commonly requested.',
    submission: { mode: 'portal', where: 'Skill India Digital Hub or a PMKVY training centre', url: 'https://www.skillindiadigital.gov.in', integration: 'none' },
    requiredDocs: ['aadhaar', 'education'],
    optionalDocs: ['bank'],
    keywords: ['pmkvy', 'kaushal vikas', 'skill india', 'training', 'course', 'प्रशिक्षण', 'कोर्स', 'பயிற்சி', 'శిక్షణ', 'ತರಬೇತಿ', 'പരിശീലനം'],
    fields: [
      ...identity(),
      ...address(),
      p('education', SOCIAL),
      p('existingSkills', PROPOSAL, false),
      ask('preferredCourse', 'Course / job role wanted', 'text', 'Which course or job role do you want training for?'),
      ask('rpl', 'Already experienced? (Recognition of Prior Learning)', 'select', 'Do you already have work experience in this skill and want it certified (RPL)?', { options: ['Yes', 'No'], required: false }),
      ...bank(false),
    ],
  },
  {
    schemeId: 'pm-daksh',
    formTitle: 'PM-DAKSH — skill training application details',
    basis: 'Candidates apply on the PM-DAKSH portal. These are the details commonly requested, based on the public scheme information.',
    submission: { mode: 'portal', where: 'PM-DAKSH portal', url: 'https://pmdaksh.dosje.gov.in', integration: 'none' },
    requiredDocs: ['aadhaar', 'caste', 'income', 'education'],
    optionalDocs: ['bank'],
    keywords: ['daksh', 'दक्ष'],
    fields: [
      ...identity(),
      ...address(),
      p('socialCategory', SOCIAL),
      p('annualFamilyIncome', SOCIAL),
      p('education', SOCIAL),
      ask('preferredCourse', 'Course wanted', 'text', 'Which skill course would you like to join?'),
      ...bank(false),
    ],
  },
  {
    schemeId: 'mudra',
    formTitle: 'PM MUDRA Yojana — loan application details',
    basis: 'MUDRA loans are applied for at a bank, NBFC or MFI (or online via JanSamarth). These are the details lenders commonly ask for.',
    submission: { mode: 'bank', where: 'Any bank branch, NBFC or MFI — or the JanSamarth portal', url: 'https://www.mudra.org.in', integration: 'none' },
    requiredDocs: ['aadhaar', 'pan', 'bank'],
    optionalDocs: ['residence', 'caste'],
    keywords: ['mudra', 'मुद्रा', 'loan', 'लोन', 'ऋण', 'கடன்', 'రుణం', 'ಸಾಲ', 'വായ്പ'],
    fields: [
      ...identity(),
      ...address(),
      p('panNumber', IDENTITY),
      p('socialCategory', SOCIAL, false),
      p('occupation', PROPOSAL),
      ask('businessActivity', 'Business activity', 'text', 'What business is the loan for?'),
      ask('businessStatus', 'New or existing business', 'select', 'Is this a new business or one you already run?', { options: ['New business', 'Existing business'] }),
      ask('loanCategory', 'MUDRA category', 'select', 'Which loan size: Shishu (small), Kishore (medium) or Tarun (larger)?', { options: ['Shishu', 'Kishore', 'Tarun', 'Tarun Plus'] }),
      ask('loanAmount', 'Loan amount needed (₹)', 'money', 'How much loan do you need, in rupees?'),
      ...bank(),
    ],
  },
  {
    schemeId: 'nsfdc',
    formTitle: 'NSFDC — concessional loan application details',
    basis: 'NSFDC loans are applied for through the State Channelising Agency. These are the details commonly requested.',
    submission: { mode: 'office', where: 'State Channelising Agency (State SC Development Corporation)', url: 'https://nsfdc.nic.in', integration: 'none' },
    requiredDocs: ['aadhaar', 'caste', 'income', 'bank'],
    optionalDocs: ['residence'],
    keywords: ['nsfdc', 'channelising', 'concessional'],
    fields: [
      ...identity(),
      ...address(),
      p('socialCategory', SOCIAL),
      p('casteCertificateNumber', SOCIAL),
      p('annualFamilyIncome', SOCIAL),
      ask('proposedActivity', 'Proposed activity', 'text', 'What activity or business do you want the loan for?'),
      ask('projectCost', 'Estimated project cost (₹)', 'money', 'Roughly how much will the project cost, in rupees?'),
      ask('loanAmount', 'Loan amount needed (₹)', 'money', 'How much loan do you need, in rupees?'),
      ...bank(),
    ],
  },
  {
    schemeId: 'stand-up-india',
    formTitle: 'Stand-Up India — loan application details',
    basis: 'Applications go to a bank branch or the Stand-Up India portal. These are the details commonly requested.',
    submission: { mode: 'portal', where: 'Stand-Up India portal or any scheduled commercial bank branch', url: 'https://www.standupmitra.in', integration: 'none' },
    requiredDocs: ['aadhaar', 'pan', 'bank'],
    optionalDocs: ['caste', 'residence'],
    keywords: ['stand-up', 'stand up india', 'standup', 'स्टैंड अप'],
    fields: [
      ...identity(),
      ...address(true),
      p('panNumber', IDENTITY),
      p('socialCategory', SOCIAL),
      ask('enterpriseActivity', 'New enterprise activity', 'text', 'What new enterprise do you want to start (manufacturing, services, trading or agri-allied)?'),
      ask('projectCost', 'Estimated project cost (₹)', 'money', 'Roughly how much will the project cost, in rupees?'),
      ask('loanAmount', 'Loan amount needed (₹)', 'money', 'How much loan do you need, in rupees?'),
      ...bank(),
    ],
  },
  {
    schemeId: 'post-matric-sc',
    formTitle: 'Post-Matric Scholarship for SC students — application details',
    basis: 'Applications go through the National Scholarship Portal or the State scholarship portal. These are the details commonly requested.',
    submission: { mode: 'portal', where: 'National Scholarship Portal or your State scholarship portal', url: 'https://scholarships.gov.in', integration: 'none' },
    requiredDocs: ['aadhaar', 'caste', 'income', 'education', 'bank'],
    optionalDocs: [],
    keywords: ['scholarship', 'छात्रवृत्ति', 'post matric', 'post-matric', 'உதவித்தொகை', 'స్కాలర్‌షిప్', 'ವಿದ್ಯಾರ್ಥಿ ವೇತನ', 'സ്കോളർഷിപ്പ്'],
    fields: [
      ...identity(),
      ...address(),
      p('socialCategory', SOCIAL),
      p('casteCertificateNumber', SOCIAL),
      p('annualFamilyIncome', SOCIAL),
      p('incomeCertificateNumber', SOCIAL),
      p('education', PROPOSAL),
      ask('institution', 'College / institution name', 'text', 'Which college or institution are you studying in?'),
      ask('course', 'Course', 'text', 'Which course are you studying?'),
      ask('courseYear', 'Year of study', 'number', 'Which year of the course are you in?'),
      ...bank(),
    ],
  },
  {
    schemeId: 'ncs',
    formTitle: 'National Career Service — jobseeker registration details',
    basis: 'Jobseekers register on the NCS portal. These are the registration details commonly requested.',
    submission: { mode: 'portal', where: 'National Career Service portal', url: 'https://www.ncs.gov.in', integration: 'none' },
    requiredDocs: ['aadhaar', 'education'],
    optionalDocs: [],
    keywords: ['ncs', 'career service', 'job', 'naukri', 'नौकरी', 'रोज़गार', 'வேலை', 'ఉద్యోగం', 'ಉದ್ಯೋಗ', 'ജോലി'],
    fields: [
      ...identity(),
      ...address(true),
      p('education', SOCIAL),
      p('occupation', PROPOSAL, false),
      p('existingSkills', PROPOSAL),
      ask('jobPreference', 'Kind of job wanted', 'text', 'What kind of job are you looking for?'),
      ask('preferredLocation', 'Preferred work location', 'text', 'Where would you like to work?', { required: false }),
    ],
  },
];

FORM_SCHEMAS.push(...DOCUMENT_FORM_SCHEMAS());

export const FORM_SCHEMA_MAP: Record<string, SchemeFormSchema> = Object.fromEntries(FORM_SCHEMAS.map((s) => [s.schemeId, s]));

/** Requirements for a form: explicit proof categories, or one per listed document. */
export function requirementsFor(schema: SchemeFormSchema): Requirement[] {
  if (schema.requirements) return schema.requirements;
  return [
    ...schema.requiredDocs.map((k) => ({ ...PROOF.one(k, true), label: DOC_KINDS[k].label, labelHi: DOC_KINDS[k].labelHi })),
    ...schema.optionalDocs.map((k) => ({ ...PROOF.one(k, false), label: DOC_KINDS[k].label, labelHi: DOC_KINDS[k].labelHi })),
  ];
}

/** Mask everything but the last four digits of an Aadhaar number. */
export function maskAadhaar(last4: string): string {
  return `XXXX XXXX ${last4}`;
}

/* ── Official documents & certificates ───────────────────────────────
   Preparation schemas for common Indian document services. Field lists follow what the
   official forms ask for; accepted proofs are the commonly accepted ones — the official
   portal's list is always authoritative and can change. */
function DOCUMENT_FORM_SCHEMAS(): SchemeFormSchema[] {
  const doc = (s: Omit<SchemeFormSchema, 'kind' | 'requiredDocs' | 'optionalDocs'> & { requirements: Requirement[] }): SchemeFormSchema => ({
    ...s,
    kind: 'document',
    requiredDocs: [],
    optionalDocs: [],
  });
  const ABOUT = 'About this application';
  const PARENTS = 'Parents & family';

  return [
    doc({
      schemeId: 'doc-pan',
      formTitle: 'PAN card — new application (Form 49A)',
      officialForm: 'Form 49A (Indian citizens)',
      basis: 'Form 49A details as asked on the Protean (NSDL) and UTIITSL portals. If your Aadhaar is linked to your mobile, an instant e-PAN can be generated free on the Income Tax e-filing portal.',
      submission: { mode: 'portal', where: 'Income Tax e-filing portal (instant e-PAN with Aadhaar), or Protean / UTIITSL PAN portals', url: 'https://www.incometax.gov.in', integration: 'none' },
      requirements: [
        { ...PROOF.identity(), note: 'Aadhaar alone can serve as proof of identity, address and date of birth for PAN.' },
        PROOF.address(),
        PROOF.birth(),
        PROOF.photo('Passport-size colour photo and signature (for the physical card application)'),
      ],
      keywords: ['pan card', 'pan number', 'new pan', 'e-pan', 'epan', 'form 49a', 'पैन कार्ड', 'पैन', 'பான் கார்டு', 'పాన్ కార్డ్', 'ಪ್ಯಾನ್ ಕಾರ್ಡ್', 'പാൻ കാർഡ്'],
      fields: [
        ...identity(),
        p('mobile', ADDRESS),
        p('email', ADDRESS, false),
        p('addressLine', ADDRESS),
        p('district', ADDRESS),
        p('state', ADDRESS),
        p('pincode', ADDRESS),
        ask('nameOnCard', 'Name to be printed on the card', 'text', 'What name should be printed on the PAN card? (Usually your full name as on Aadhaar.)', { section: ABOUT }),
        ask('sourceOfIncome', 'Source of income', 'select', 'What is your main source of income?', {
          section: ABOUT,
          options: ['Salary', 'Business / profession', 'House property', 'Capital gains', 'Other sources', 'No income'],
        }),
      ],
    }),
    doc({
      schemeId: 'doc-voter',
      formTitle: 'Voter ID — new registration (Form 6)',
      officialForm: 'Form 6 (new elector) — Form 8 is for corrections or shifting',
      basis: 'Form 6 details as asked on the Voters’ Service Portal and Voter Helpline app of the Election Commission of India.',
      submission: { mode: 'portal', where: 'Voters’ Service Portal or Voter Helpline app, or your Booth Level Officer (BLO)', url: 'https://voters.eci.gov.in', integration: 'none' },
      requirements: [
        { ...PROOF.birth(), label: 'Proof of age', labelHi: 'आयु का प्रमाण' },
        PROOF.address(),
        PROOF.photo(),
      ],
      keywords: ['voter id', 'voter card', 'form 6', 'electoral', 'epic number', 'मतदाता', 'वोटर', 'वोटर आईडी', 'வாக்காளர்', 'ఓటర్', 'ಮತದಾರ', 'വോട്ടർ'],
      fields: [
        p('fullName', IDENTITY),
        p('gender', IDENTITY),
        p('dateOfBirth', IDENTITY),
        p('placeOfBirth', IDENTITY, false),
        p('aadhaar', IDENTITY, false),
        ask('relativeType', 'Relation of the relative named below', 'select', 'Whose name will you give as your relative — father, mother, husband, wife or guardian?', {
          section: PARENTS,
          options: ['Father', 'Mother', 'Husband', 'Wife', 'Guardian'],
        }),
        { ...p('fatherSpouseName', PARENTS), label: "Relative's name" },
        p('mobile', ADDRESS),
        p('email', ADDRESS, false),
        p('addressLine', ADDRESS),
        p('district', ADDRESS),
        p('state', ADDRESS),
        p('pincode', ADDRESS),
        p('disability', ABOUT, false),
      ],
    }),
    doc({
      schemeId: 'doc-passport',
      formTitle: 'Passport — fresh application',
      officialForm: 'Online application on Passport Seva (fresh, normal or Tatkaal)',
      basis: 'Details asked in the Passport Seva online application. After submitting online you book an appointment at a Passport Seva Kendra (PSK) or Post Office PSK; police verification follows.',
      submission: { mode: 'portal', where: 'Passport Seva portal, then appointment at a PSK / POPSK', url: 'https://www.passportindia.gov.in', integration: 'none' },
      requirements: [
        { ...PROOF.address(), label: 'Proof of present address' },
        PROOF.birth(),
        { id: 'old-passport', label: 'Old passport (if you ever had one)', anyOf: ['passport'], required: false },
      ],
      keywords: ['passport', 'पासपोर्ट', 'பாஸ்போர்ட்', 'పాస్‌పోర్ట్', 'ಪಾಸ್‌ಪೋರ್ಟ್', 'പാസ്പോർട്ട്'],
      fields: [
        p('fullName', IDENTITY),
        p('dateOfBirth', IDENTITY),
        p('placeOfBirth', IDENTITY),
        p('gender', IDENTITY),
        p('maritalStatus', IDENTITY),
        p('aadhaar', IDENTITY),
        p('panNumber', IDENTITY, false),
        p('education', IDENTITY),
        p('occupation', IDENTITY),
        { ...p('fatherSpouseName', PARENTS), label: "Father's / legal guardian's name" },
        p('motherName', PARENTS),
        p('mobile', ADDRESS),
        p('email', ADDRESS),
        p('addressLine', ADDRESS),
        p('district', ADDRESS),
        p('state', ADDRESS),
        p('pincode', ADDRESS),
        ask('emergencyContact', 'Emergency contact (name and mobile)', 'text', 'Who should be contacted in an emergency? Give their name and mobile number.', { section: ABOUT }),
        ask('passportType', 'Application type', 'select', 'Do you want Normal or Tatkaal (faster, higher fee) processing?', { section: ABOUT, options: ['Normal', 'Tatkaal'] }),
      ],
    }),
    doc({
      schemeId: 'doc-aadhaar-update',
      formTitle: 'Aadhaar — address / details update',
      officialForm: 'Online address update on myAadhaar, or the Aadhaar Enrolment / Update form at an Aadhaar Seva Kendra',
      basis: 'Address can be updated online on myAadhaar with a valid proof of address and the OTP on your registered mobile. Name, date of birth, gender, mobile and biometrics are updated at an Aadhaar centre.',
      submission: { mode: 'portal', where: 'myAadhaar portal (address) or an Aadhaar Seva Kendra / enrolment centre', url: 'https://myaadhaar.uidai.gov.in', integration: 'none' },
      requirements: [
        { ...PROOF.address(), anyOf: ['passport', 'voter', 'dl', 'bank', 'utility', 'ration', 'residence'], label: 'Proof of the new address' },
        { ...PROOF.identity(false), label: 'Proof of identity (for name changes)', anyOf: ['voter', 'pan', 'passport', 'dl'] },
      ],
      keywords: ['aadhaar update', 'update aadhaar', 'aadhaar address', 'address in aadhaar', 'address in aadhar', 'address on aadhaar', 'aadhaar name change', 'name in aadhaar', 'aadhaar mobile', 'aadhar me address', 'aadhaar me address', 'aadhar update', 'update aadhar', 'aadhaar correction', 'आधार अपडेट', 'आधार में पता', 'आधार सुधार', 'ஆதார் புதுப்பி', 'ఆధార్ అప్‌డేట్', 'ಆಧಾರ್ ಅಪ್‌ಡೇಟ್', 'ആധാർ അപ്ഡേറ്റ്'],
      fields: [
        p('fullName', IDENTITY),
        p('aadhaar', IDENTITY),
        { ...p('mobile', IDENTITY), label: 'Mobile number registered with Aadhaar' },
        ask('updateType', 'What needs updating', 'select', 'What do you want to update in Aadhaar?', {
          section: ABOUT,
          options: ['Address', 'Name', 'Date of birth', 'Gender', 'Mobile number', 'Photo / biometrics'],
        }),
        { ...p('addressLine', ADDRESS), label: 'New address' },
        p('district', ADDRESS),
        p('state', ADDRESS),
        p('pincode', ADDRESS),
      ],
    }),
    doc({
      schemeId: 'doc-income',
      formTitle: 'Income certificate — application',
      officialForm: 'State e-District income certificate application',
      basis: 'Issued by the State Revenue Department (Tahsildar / SDM). Applied for on your State’s e-District portal, at a Common Service Centre (CSC) or the taluk office. Forms vary slightly by State.',
      submission: { mode: 'office', where: 'Your State e-District portal, a CSC, or the Tahsildar / taluk office', url: 'https://services.india.gov.in', integration: 'none' },
      requirements: [
        PROOF.identity(),
        PROOF.address(),
        {
          id: 'income-proof',
          label: 'Proof of income',
          labelHi: 'आय का प्रमाण',
          anyOf: ['income', 'other'],
          required: true,
          alsoAccepted: ['Salary slip', 'Income tax return', 'Self-declaration of income (State format)'],
        },
        { ...PROOF.one('ration', false), label: 'Ration card (if available)' },
      ],
      keywords: ['income certificate', 'आय प्रमाण पत्र', 'आय प्रमाणपत्र', 'income cert', 'வருமான சான்றிதழ்', 'ఆదాయ ధృవీకరణ', 'ಆದಾಯ ಪ್ರಮಾಣ', 'വരുമാന സർട്ടിഫിക്കറ്റ്'],
      fields: [
        ...identity(),
        ...address(),
        p('occupation', SOCIAL),
        p('annualFamilyIncome', SOCIAL),
        p('familySize', SOCIAL, false),
        ask('purpose', 'Purpose of the certificate', 'text', 'Why do you need the income certificate (for example, scholarship, scheme application, admission)?', { section: ABOUT }),
      ],
    }),
    doc({
      schemeId: 'doc-caste',
      formTitle: 'Caste certificate (SC / ST / OBC) — application',
      officialForm: 'State e-District caste / community certificate application',
      basis: 'Issued by the State Revenue Department (Tahsildar / SDM) after verification. Applied for on your State’s e-District portal, at a CSC or the taluk office. Forms vary by State.',
      submission: { mode: 'office', where: 'Your State e-District portal, a CSC, or the Tahsildar / taluk office', url: 'https://services.india.gov.in', integration: 'none' },
      requirements: [
        PROOF.identity(),
        PROOF.address(),
        {
          id: 'caste-proof',
          label: 'Proof of caste',
          labelHi: 'जाति का प्रमाण',
          anyOf: ['caste', 'education', 'other'],
          required: true,
          alsoAccepted: ['Caste certificate of father or a blood relative', 'School record showing caste', 'Self-declaration / affidavit (State format)'],
        },
      ],
      keywords: ['caste certificate', 'community certificate', 'जाति प्रमाण पत्र', 'जाति प्रमाणपत्र', 'சாதி சான்றிதழ்', 'కుల ధృవీకరణ', 'ಜಾತಿ ಪ್ರಮಾಣ', 'ജാതി സർട്ടിഫിക്കറ്റ്'],
      fields: [
        ...identity(),
        ...address(),
        p('socialCategory', SOCIAL),
        p('subCaste', SOCIAL),
        p('motherName', PARENTS, false),
        ask('purpose', 'Purpose of the certificate', 'text', 'Why do you need the caste certificate (for example, scholarship, job, scheme)?', { section: ABOUT }),
      ],
    }),
    doc({
      schemeId: 'doc-domicile',
      formTitle: 'Residence / domicile certificate — application',
      officialForm: 'State e-District residence (domicile / nativity) certificate application',
      basis: 'Issued by the State Revenue Department. Each State sets its own minimum years of residence and form — check your State e-District portal.',
      submission: { mode: 'office', where: 'Your State e-District portal, a CSC, or the Tahsildar / taluk office', url: 'https://services.india.gov.in', integration: 'none' },
      requirements: [
        PROOF.identity(),
        PROOF.address(),
        {
          id: 'residence-period',
          label: 'Proof of how long you have lived here',
          anyOf: ['education', 'ration', 'utility', 'voter', 'other'],
          required: true,
          alsoAccepted: ['Old school certificates', 'Property / rent documents', 'Older utility bills'],
        },
      ],
      keywords: ['domicile', 'residence certificate', 'nativity', 'niwas', 'निवास प्रमाण पत्र', 'मूल निवास', 'இருப்பிடச் சான்றிதழ்', 'నివాస ధృవీకరణ', 'ವಾಸಸ್ಥಳ ಪ್ರಮಾಣ', 'താമസ സർട്ടിഫിക്കറ്റ്'],
      fields: [
        ...identity(),
        ...address(),
        ask('yearsResident', 'Years living at this address / in this State', 'number', 'For how many years have you lived in this State?', { section: ABOUT }),
        ask('purpose', 'Purpose of the certificate', 'text', 'Why do you need the residence certificate?', { section: ABOUT }),
      ],
    }),
    doc({
      schemeId: 'doc-birth',
      formTitle: 'Birth certificate — registration / copy',
      officialForm: 'Birth report (Form 1) under the Registration of Births and Deaths Act',
      basis: 'Births are registered with the local Registrar (municipality or gram panchayat), online on the CRS portal where available. Births should be reported within 21 days; later registration needs extra steps.',
      submission: { mode: 'portal', where: 'Civil Registration System (CRS) portal or your local Registrar of Births & Deaths', url: 'https://crsorgi.gov.in', integration: 'none' },
      requirements: [
        { id: 'birth-proof', label: 'Proof of birth', anyOf: ['other'], required: true, alsoAccepted: ['Hospital discharge summary or birth report', 'Affidavit (for late registration)'] },
        { ...PROOF.identity(), label: "Parents' proof of identity" },
        { ...PROOF.address(), label: "Parents' proof of address" },
      ],
      keywords: ['birth certificate', 'जन्म प्रमाण पत्र', 'जन्म प्रमाणपत्र', 'பிறப்புச் சான்றிதழ்', 'జనన ధృవీకరణ', 'ಜನನ ಪ್ರಮಾಣ', 'ജനന സർട്ടിഫിക്കറ്റ്'],
      fields: [
        ask('childName', "Child's name (if decided)", 'text', "What is the child's name? Say \"not decided\" if the name is not yet given.", { section: ABOUT, required: false }),
        ask('childDob', "Child's date of birth", 'date', "What is the child's date of birth (DD/MM/YYYY)?", { section: ABOUT }),
        ask('childGender', "Child's gender", 'select', "Is the child a girl or a boy?", { section: ABOUT, options: ['Female', 'Male', 'Transgender'] }),
        ask('birthPlace', 'Place of birth (hospital or home address)', 'text', 'Where was the child born — the hospital name or the home address?', { section: ABOUT }),
        { ...p('fatherSpouseName', PARENTS), label: "Father's name" },
        p('motherName', PARENTS),
        { ...p('fullName', PARENTS), label: 'Informant name (person applying)' },
        p('mobile', ADDRESS),
        p('addressLine', ADDRESS),
        p('district', ADDRESS),
        p('state', ADDRESS),
        p('pincode', ADDRESS),
      ],
    }),
    doc({
      schemeId: 'doc-learner-dl',
      formTitle: 'Learner’s driving licence — application',
      officialForm: 'Form 2 (learner’s licence) on Parivahan Sarathi',
      basis: 'Learner’s licence applications are made on the Parivahan Sarathi portal for your State, followed by an online or RTO test. Minimum age is 18, or 16 for a gearless motorcycle up to 50cc with guardian consent.',
      submission: { mode: 'portal', where: 'Parivahan Sarathi portal, then test at the RTO or online', url: 'https://sarathi.parivahan.gov.in', integration: 'none' },
      requirements: [
        { ...PROOF.birth(), label: 'Proof of age' },
        PROOF.address(),
        PROOF.photo('Photo and signature (uploaded on Sarathi)'),
        { id: 'medical', label: 'Medical certificate (Form 1A), when required', anyOf: [], required: false, manual: true, note: 'Needed for transport vehicles and for applicants above a certain age — check Sarathi.' },
      ],
      keywords: ['driving licence', 'driving license', 'learner licence', 'learner license', 'learning licence', 'licence', 'ड्राइविंग लाइसेंस', 'लर्निंग लाइसेंस', 'ஓட்டுநர் உரிமம்', 'డ్రైవింగ్ లైసెన్స్', 'ಡ್ರೈವಿಂಗ್ ಲೈಸೆನ್ಸ್', 'ഡ്രൈവിംഗ് ലൈസൻസ്'],
      fields: [
        p('fullName', IDENTITY),
        p('dateOfBirth', IDENTITY),
        p('gender', IDENTITY),
        p('placeOfBirth', IDENTITY, false),
        { ...p('fatherSpouseName', PARENTS), label: "Father's / husband's name" },
        p('aadhaar', IDENTITY),
        p('education', IDENTITY, false),
        p('mobile', ADDRESS),
        p('email', ADDRESS, false),
        p('addressLine', ADDRESS),
        p('district', ADDRESS),
        p('state', ADDRESS),
        p('pincode', ADDRESS),
        ask('vehicleClass', 'Vehicle class', 'select', 'Which vehicle do you want to learn to drive?', {
          section: ABOUT,
          options: ['Motorcycle without gear', 'Motorcycle with gear', 'Light motor vehicle (car)', 'Transport vehicle'],
        }),
        ask('bloodGroup', 'Blood group', 'select', 'What is your blood group? Choose "Not known" if you are not sure.', {
          section: ABOUT,
          required: false,
          options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Not known'],
        }),
      ],
    }),
    doc({
      schemeId: 'doc-eshram',
      formTitle: 'e-Shram card — unorganised worker registration',
      officialForm: 'Self-registration on the eShram portal (or at a CSC)',
      basis: 'For unorganised workers aged 16–59 who are not members of EPFO/ESIC and do not pay income tax. Register with Aadhaar and the mobile number linked to it.',
      submission: { mode: 'portal', where: 'eShram portal or a Common Service Centre (CSC)', url: 'https://eshram.gov.in', integration: 'none' },
      requirements: [{ ...PROOF.one('aadhaar'), label: 'Aadhaar card' }, { ...PROOF.one('bank'), label: 'Bank account details' }],
      keywords: ['e-shram', 'eshram', 'shram card', 'labour card', 'unorganised worker', 'unorganized worker', 'श्रम कार्ड', 'ई-श्रम', 'ई श्रम'],
      fields: [
        p('fullName', IDENTITY),
        p('dateOfBirth', IDENTITY),
        p('gender', IDENTITY),
        { ...p('fatherSpouseName', PARENTS), label: "Father's name" },
        p('aadhaar', IDENTITY),
        { ...p('mobile', ADDRESS), label: 'Mobile number linked to Aadhaar' },
        p('addressLine', ADDRESS),
        p('district', ADDRESS),
        p('state', ADDRESS),
        p('pincode', ADDRESS),
        p('socialCategory', SOCIAL, false),
        p('education', SOCIAL),
        p('occupation', ABOUT),
        ask('workType', 'Type of work', 'text', 'What kind of work do you do (for example, construction worker, street vendor, domestic worker, farm labourer)?', { section: ABOUT }),
        p('bankAccountNumber', BANK),
        p('bankIfsc', BANK),
      ],
    }),
    doc({
      schemeId: 'doc-udid',
      formTitle: 'UDID card (disability certificate) — application',
      officialForm: 'Online application on the Swavlamban Card (UDID) portal',
      basis: 'Persons with disabilities apply online; the medical authority of the district assesses the disability before the certificate and UDID card are issued.',
      submission: { mode: 'portal', where: 'Swavlamban Card (UDID) portal, then assessment at the district medical authority', url: 'https://www.swavlambancard.gov.in', integration: 'none' },
      requirements: [
        PROOF.identity(),
        PROOF.address(),
        PROOF.photo(),
        { id: 'existing-disability-cert', label: 'Existing disability certificate (if any)', anyOf: ['other'], required: false, alsoAccepted: ['Disability certificate issued earlier by a medical authority'] },
      ],
      keywords: ['udid', 'disability certificate', 'swavlamban', 'divyang', 'दिव्यांग प्रमाण पत्र', 'विकलांग प्रमाण पत्र', 'மாற்றுத்திறனாளி', 'వికలాంగ', 'ಅಂಗವಿಕಲ', 'ഭിന്നശേഷി'],
      fields: [
        ...identity(),
        ...address(),
        { ...p('disability', ABOUT), required: true, label: 'Type of disability' },
        p('education', ABOUT, false),
        p('occupation', ABOUT, false),
      ],
    }),
    doc({
      schemeId: 'doc-ration',
      formTitle: 'Ration card — new application',
      officialForm: 'State Food & Civil Supplies Department ration card application',
      basis: 'Ration cards under the National Food Security Act are issued by State governments; each State has its own portal and form. The NFSA site links to every State’s portal.',
      submission: { mode: 'portal', where: 'Your State Food & Civil Supplies portal, a CSC, or the food supply office', url: 'https://nfsa.gov.in', integration: 'none' },
      requirements: [
        { ...PROOF.one('aadhaar'), label: 'Aadhaar of the head of family (and members)' },
        PROOF.address(),
        { ...PROOF.one('income', false), label: 'Income certificate (for priority categories)' },
        PROOF.photo('Family photograph / photo of the head of family'),
      ],
      keywords: ['ration card', 'राशन कार्ड', 'குடும்ப அட்டை', 'రేషన్ కార్డు', 'ರೇಷನ್ ಕಾರ್ಡ್', 'റേഷൻ കാർഡ്'],
      fields: [
        { ...p('fullName', IDENTITY), label: 'Head of family name' },
        p('dateOfBirth', IDENTITY),
        p('gender', IDENTITY),
        p('fatherSpouseName', IDENTITY),
        p('aadhaar', IDENTITY),
        p('mobile', ADDRESS),
        p('addressLine', ADDRESS),
        p('district', ADDRESS),
        p('state', ADDRESS),
        p('pincode', ADDRESS),
        p('familySize', SOCIAL),
        p('annualFamilyIncome', SOCIAL),
        p('occupation', SOCIAL, false),
        ask('members', 'Family members (name, age, relation)', 'text', 'List the family members to add — each person’s name, age and relation to you.', { section: PARENTS }),
        ...bank(false),
      ],
    }),
  ];
}
