import { DocumentRecord, BeneficiaryProfile } from '../types';

export interface SampleDocumentTemplate {
  id: string;
  docType: DocumentRecord['docType'];
  sampleTitle: string;
  sampleFileName: string;
  mockExtractedFields: Record<string, string>;
  confidence: number;
  sampleThumbnailText: string;
  description: string;
}

export const getTemplatesForProfile = (profile: BeneficiaryProfile): SampleDocumentTemplate[] => {
  const name = profile.name || 'Applicant';
  const district = profile.district || 'District';
  const state = profile.state || 'State';
  const trade = profile.traditionalTrade || profile.currentOccupation || 'Craft & Enterprise';
  const income = profile.annualFamilyIncome || profile.householdIncome || '₹75,000';
  const aadhaar = profile.aadhaarNumber || 'XXXX-XXXX-4819';
  const fatherName = profile.fatherSpouseName || (profile.name ? `${profile.name.split(' ')[0]}'s Guardian` : 'Guardian');
  const address = profile.residentialAddress || `${district}, ${state}`;

  return [
    {
      id: 'doc-aadhaar',
      docType: 'Aadhaar Card',
      sampleTitle: 'UIDAI Aadhaar Card (Govt of India)',
      sampleFileName: `${name.replace(/\s+/g, '_')}_Aadhaar_KYC.pdf`,
      confidence: 98,
      sampleThumbnailText: `भारत सरकार • GOVT OF INDIA\nAadhaar: ${aadhaar}\nName: ${name}`,
      description: 'Verifies citizen identity, age (DOB), residential address, and UIDAI linkage.',
      mockExtractedFields: {
        'Full Name': name,
        'Aadhaar Number': aadhaar,
        'Date of Birth': profile.dateOfBirth || '14/08/1993',
        'Age Calculated': `${profile.age || '32'} Years`,
        'Gender': profile.gender || 'Male',
        'Father Name': fatherName,
        'Address': address,
        'District & State': `${district}, ${state}`,
      },
    },
    {
      id: 'doc-caste',
      docType: 'Caste Certificate',
      sampleTitle: 'Revenue Dept Community Certificate (SC)',
      sampleFileName: `${name.replace(/\s+/g, '_')}_SC_Community_Cert.pdf`,
      confidence: 96,
      sampleThumbnailText: `REVENUE DEPARTMENT • சாதி சான்றிதழ் / जाति प्रमाण पत्र\nBeneficiary: ${name}\nCommunity: ${profile.socialCategory || 'Scheduled Caste (SC)'}`,
      description: 'Mandatory proof of Scheduled Caste status for PM-AJAY GIA 100% subsidy.',
      mockExtractedFields: {
        'Certificate Number': `SC-CERT-${district.slice(0, 3).toUpperCase()}-2024-8819`,
        'Beneficiary Name': name,
        'Social Category': profile.socialCategory || 'Scheduled Caste (SC)',
        'Sub-Caste': profile.subCaste || 'Scheduled Caste Sub-Group',
        'Issuing Authority': `Tahsildar / Revenue Authority, ${district}`,
        'Issue Date': '18/11/2023',
        'Digital Signature': 'Verified (e-Sign)',
      },
    },
    {
      id: 'doc-income',
      docType: 'Income Certificate',
      sampleTitle: 'Tahsildar Annual Income Certificate',
      sampleFileName: `${name.replace(/\s+/g, '_')}_Income_Certificate.pdf`,
      confidence: 95,
      sampleThumbnailText: `வருமானச் சான்றிதழ் / आय प्रमाण पत्र\nAnnual Income: ${income}\nStatus: Certified BPL (Ceiling < ₹3.0 Lakh)`,
      description: 'Validates family income ceiling (< ₹3.0 Lakh/year) for non-repayable GIA grant.',
      mockExtractedFields: {
        'Income Certificate No': `INC-${district.slice(0, 3).toUpperCase()}-2024-5120`,
        'Annual Family Income': income,
        'Income Status': 'Eligible for PM-AJAY (Ceiling is ₹3,00,000)',
        'Occupation of Household': trade,
        'Issuing Officer': `Zonal Tahsildar, ${district}`,
      },
    },
    {
      id: 'doc-passbook',
      docType: 'Bank Passbook',
      sampleTitle: 'Nationalized Bank Passbook (DBT-Enabled)',
      sampleFileName: `${name.replace(/\s+/g, '_')}_Bank_Passbook.jpg`,
      confidence: 94,
      sampleThumbnailText: `${profile.bankName || 'State Bank of India (SBI)'}\nA/c: ${profile.bankAccountNumber || '38910482910'}\nIFSC: ${profile.bankIfscCode || 'SBIN0001234'}`,
      description: 'Account details for direct capital subsidy disbursement & daily stipend credits.',
      mockExtractedFields: {
        'Bank Name': profile.bankName || 'State Bank of India (SBI)',
        'Account Number': profile.bankAccountNumber || '38910482910',
        'IFSC Code': profile.bankIfscCode || 'SBIN0001234',
        'Account Holder': name,
        'Branch': `${district} Main Branch`,
        'Aadhaar Seeding Status': 'Active (DBT Enabled)',
      },
    },
    {
      id: 'doc-ration',
      docType: 'Ration Card',
      sampleTitle: 'NFSA Smart Family Ration Card (PHH)',
      sampleFileName: `${name.replace(/\s+/g, '_')}_Smart_Ration_Card.pdf`,
      confidence: 92,
      sampleThumbnailText: `குடும்ப அட்டை / राशन कार्ड\nCard No: ${profile.bplRationCardNumber || '33/G/0819241'}\nType: Priority Household (PHH)`,
      description: 'Verifies household economic status and family member count.',
      mockExtractedFields: {
        'Ration Card Number': profile.bplRationCardNumber || '33/G/0819241',
        'Card Category': 'PHH - Priority Household (BPL)',
        'Head of Family': name,
        'District': district,
        'Fair Price Shop Code': `${district.slice(0, 3).toUpperCase()}-FPS-019`,
      },
    },
  ];
};

export const SAMPLE_DOCUMENTS: SampleDocumentTemplate[] = getTemplatesForProfile({
  name: 'Applicant',
  age: 32,
  gender: 'Male',
  state: 'Tamil Nadu',
  district: 'Madurai',
  education: '10th Pass',
  currentOccupation: 'Tailor',
  traditionalTrade: 'Tailoring',
  existingSkills: 'Sewing machine',
  mobilityConstraint: 'Local',
  workPreference: 'Self-Employment / Micro-enterprise',
  householdIncome: '₹75,000',
  hasSmartphone: true,
  disabilityStatus: 'None',
});

export const documentIntelligence = {
  // Simulate OCR extraction with field mapping & confidence
  processDocument(sample: SampleDocumentTemplate): DocumentRecord {
    const discrepancies: string[] = [];

    return {
      id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      docType: sample.docType,
      fileName: sample.sampleFileName,
      status: 'needs_review',
      confidence: sample.confidence,
      extractedFields: { ...sample.mockExtractedFields },
      discrepancies,
      userConfirmed: false,
      uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  },

  // Process custom citizen-uploaded document
  processCustomUpload(
    docType: DocumentRecord['docType'],
    fileName: string,
    extractedFields: Record<string, string>,
    confidence: number = 95
  ): DocumentRecord {
    return {
      id: `custom-doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      docType,
      fileName,
      status: 'verified',
      confidence,
      extractedFields,
      discrepancies: [],
      userConfirmed: true,
      uploadedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  },

  // Check discrepancies across documents and citizen profile
  auditDiscrepancies(documents: DocumentRecord[], profile: BeneficiaryProfile): string[] {
    const issues: string[] = [];
    const names = new Set<string>();

    documents.forEach(doc => {
      const name = doc.extractedFields['Full Name'] || doc.extractedFields['Beneficiary Name'] || doc.extractedFields['Account Holder'];
      if (name) names.add(name);
    });

    if (names.size > 1) {
      issues.push(`Slight name spelling variation detected across documents: ${Array.from(names).join(' vs ')}. Verified as matching alias.`);
    }

    const incomeDoc = documents.find(d => d.docType === 'Income Certificate');
    if (incomeDoc && profile.householdIncome) {
      const docIncome = parseInt((incomeDoc.extractedFields['Annual Family Income'] || '').replace(/[^0-9]/g, ''), 10);
      const profIncome = parseInt(profile.householdIncome.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(docIncome) && !isNaN(profIncome) && Math.abs(docIncome - profIncome) > 50000) {
        issues.push(`Income discrepancy: Document states ₹${docIncome.toLocaleString()} while initial profile states ₹${profIncome.toLocaleString()}. Document value will be prioritized.`);
      }
    }

    return issues;
  },

  // Apply user-confirmed document fields to the unified profile
  mergeConfirmedDocumentsToProfile(documents: DocumentRecord[], currentProfile: BeneficiaryProfile): BeneficiaryProfile {
    const updated = { ...currentProfile };

    documents.filter(d => d.userConfirmed).forEach(doc => {
      const f = doc.extractedFields;
      if (f['Full Name'] && !updated.name) updated.name = f['Full Name'];
      if (f['Aadhaar Number']) updated.aadhaarNumber = f['Aadhaar Number'];
      if (f['Social Category']) updated.socialCategory = f['Social Category'];
      if (f['Sub-Caste']) updated.subCaste = f['Sub-Caste'];
      if (f['Date of Birth']) updated.dateOfBirth = f['Date of Birth'];
      if (f['Father Name']) updated.fatherSpouseName = f['Father Name'];
      if (f['Address']) updated.residentialAddress = f['Address'];
      if (f['Pincode']) updated.pincode = f['Pincode'];
      if (f['Bank Name']) updated.bankName = f['Bank Name'];
      if (f['Account Number']) updated.bankAccountNumber = f['Account Number'];
      if (f['IFSC Code']) updated.bankIfscCode = f['IFSC Code'];
      if (f['Annual Family Income']) {
        updated.annualFamilyIncome = f['Annual Family Income'];
        updated.householdIncome = f['Annual Family Income'];
      }
      if (f['Ration Card Number']) updated.bplRationCardNumber = f['Ration Card Number'];
    });

    return updated;
  },
};
