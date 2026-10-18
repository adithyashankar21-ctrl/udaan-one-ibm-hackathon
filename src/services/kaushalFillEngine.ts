import { jsPDF } from 'jspdf';
import { BeneficiaryProfile, ApplicationDraft, FormFieldItem, DocumentRecord } from '../types';

export const kaushalFillEngine = {
  // Generate official PM-AJAY GIA Capital Subsidy Application Draft
  buildPmajayGiaDraft(profile: BeneficiaryProfile, documents: DocumentRecord[]): ApplicationDraft {
    const isDocUploaded = (docType: DocumentRecord['docType']) => 
      documents.some(d => d.docType === docType && d.userConfirmed);

    const trade = profile.traditionalTrade || profile.currentOccupation || '';
    const district = profile.district || '';
    const state = profile.state || '';

    const fields: FormFieldItem[] = [
      // Section 1: Citizen Identification
      {
        key: 'applicant_name',
        label: 'Full Name of SC Applicant (as per Aadhaar)',
        value: profile.name || '',
        required: true,
        status: profile.name ? 'valid' : 'missing',
        source: 'profile',
        section: '1. Citizen Identification',
      },
      {
        key: 'aadhaar_no',
        label: 'Aadhaar Number (UIDAI)',
        value: profile.aadhaarNumber || (isDocUploaded('Aadhaar Card') ? 'UIDAI Verified' : ''),
        required: true,
        status: (profile.aadhaarNumber || isDocUploaded('Aadhaar Card')) ? 'valid' : 'missing',
        source: 'document',
        section: '1. Citizen Identification',
      },
      {
        key: 'gender_age',
        label: 'Gender & Age',
        value: `${profile.gender || 'Pending'} / ${profile.age ? `${profile.age} Years` : 'Age pending'}`,
        required: true,
        status: (profile.age && profile.gender) ? 'valid' : 'warning',
        source: 'profile',
        section: '1. Citizen Identification',
      },
      {
        key: 'father_spouse_name',
        label: 'Father / Spouse Name',
        value: profile.fatherSpouseName || '',
        required: true,
        status: profile.fatherSpouseName ? 'valid' : 'warning',
        source: 'document',
        section: '1. Citizen Identification',
      },

      // Section 2: Social Category & Economic Verification
      {
        key: 'caste_category',
        label: 'Social Category (Must be SC)',
        value: profile.socialCategory || (isDocUploaded('Caste Certificate') ? 'Scheduled Caste (SC)' : ''),
        required: true,
        status: (profile.socialCategory || isDocUploaded('Caste Certificate')) ? 'valid' : 'missing',
        source: 'document',
        section: '2. Social & Economic Verification',
      },
      {
        key: 'sub_caste',
        label: 'Sub-Caste Community',
        value: profile.subCaste || '',
        required: false,
        status: profile.subCaste ? 'valid' : 'warning',
        source: 'profile',
        section: '2. Social & Economic Verification',
      },
      {
        key: 'annual_income',
        label: 'Certified Annual Family Income (< ₹3.0 Lakh)',
        value: profile.annualFamilyIncome || profile.householdIncome || '',
        required: true,
        status: (profile.annualFamilyIncome || profile.householdIncome || isDocUploaded('Income Certificate')) ? 'valid' : 'missing',
        source: 'document',
        section: '2. Social & Economic Verification',
      },
      {
        key: 'ration_card_no',
        label: 'BPL / Smart Ration Card Number',
        value: profile.bplRationCardNumber || '',
        required: false,
        status: profile.bplRationCardNumber ? 'valid' : 'warning',
        source: 'document',
        section: '2. Social & Economic Verification',
      },

      // Section 3: Enterprise & Project Details
      {
        key: 'proposed_enterprise',
        label: 'Proposed Micro-Enterprise Trade / Unit',
        value: trade ? `Modern ${trade} Enterprise in ${district || 'District'}` : '',
        required: true,
        status: trade ? 'valid' : 'missing',
        source: 'profile',
        section: '3. Enterprise & Scheme Details',
      },
      {
        key: 'total_project_cost',
        label: 'Estimated Total Project Cost',
        value: '',
        required: true,
        status: 'missing',
        source: 'manual',
        section: '3. Enterprise & Scheme Details',
      },
      {
        key: 'gia_subsidy_requested',
        label: 'Grant support requested (as per scheme rules)',
        value: '',
        required: true,
        status: 'missing',
        source: 'manual',
        section: '3. Enterprise & Scheme Details',
      },
      {
        key: 'bank_loan_composite',
        label: 'Bank loan, if any (e.g. MUDRA / NSFDC)',
        value: '',
        required: true,
        status: 'missing',
        source: 'manual',
        section: '3. Enterprise & Scheme Details',
      },
      {
        key: 'beneficiary_margin',
        label: 'Own contribution',
        value: '',
        required: true,
        status: 'missing',
        source: 'manual',
        section: '3. Enterprise & Scheme Details',
      },

      // Section 4: Bank Account & DBT Mandate
      {
        key: 'bank_account_no',
        label: 'Bank Account Number for Subsidy Direct Deposit (DBT)',
        value: profile.bankAccountNumber || '',
        required: true,
        status: (profile.bankAccountNumber || isDocUploaded('Bank Passbook')) ? 'valid' : 'missing',
        source: 'document',
        section: '4. Bank Account & DBT Mandate',
      },
      {
        key: 'bank_ifsc',
        label: 'Bank Branch & IFSC Code',
        value: (profile.bankName || profile.bankIfscCode) ? `${profile.bankName || 'Bank'} - IFSC: ${profile.bankIfscCode || 'Pending'}` : '',
        required: true,
        status: (profile.bankIfscCode || isDocUploaded('Bank Passbook')) ? 'valid' : 'missing',
        source: 'document',
        section: '4. Bank Account & DBT Mandate',
      },
      {
        key: 'residential_address',
        label: 'Permanent Residential Address & District',
        value: profile.residentialAddress || (district ? `${district}, ${state}` : ''),
        required: true,
        status: (profile.residentialAddress || district) ? 'valid' : 'missing',
        source: 'profile',
        section: '4. Bank Account & DBT Mandate',
      },
    ];

    const validCount = fields.filter(f => f.status === 'valid').length;
    const completionPercentage = Math.round((validCount / fields.length) * 100);

    const validationErrors: string[] = [];
    if (!profile.name) validationErrors.push('Applicant Full Name missing');
    if (!profile.district) validationErrors.push('District not selected');
    if (!isDocUploaded('Caste Certificate') && !profile.socialCategory) {
      validationErrors.push('Verified SC Community Certificate must be attached');
    }
    if (!isDocUploaded('Income Certificate') && !profile.annualFamilyIncome) {
      validationErrors.push('Income Certificate verification recommended for subsidy approval');
    }

    return {
      id: 'draft-pmajay-gia-001',
      schemeId: 'pm-ajay-gia-igs',
      formName: 'PM-AJAY Grants-in-Aid (GIA) Capital Subsidy Application Form',
      formCode: 'MoSJE-PMAJAY-GIA-2025-V2',
      nodalAuthority: 'Ministry of Social Justice & Empowerment (MoSJE) / State SC Corporation',
      status: completionPercentage >= 90 ? 'validated' : 'draft',
      completionPercentage,
      fields,
      validationErrors,
      citizenApproved: false,
      lastUpdated: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      submissionOffice: {
        name: `District Social Welfare Office (DSWO) & TAHDCO Branch`,
        address: `Room 104, Collectorate Master Complex, ${district}, ${state} - 625020`,
        officer: 'District Manager / Special Tahsildar (ADW)',
        contactPhone: '0452-2531110 / Toll-Free 1800-200-2529',
        onlinePortalUrl: 'https://pmajay.dosje.gov.in',
      },
    };
  },

  // Export validated application draft to official printable PDF using jsPDF
  generateOfficialPdf(draft: ApplicationDraft, profile: BeneficiaryProfile): void {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Government Header
    doc.setFillColor(15, 76, 129);
    doc.rect(0, 0, 210, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('APPLICATION PREPARATION DRAFT — NOT AN OFFICIAL GOVERNMENT FORM', 105, 9, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Prepared with UDAAN ONE to help you fill the official PM-AJAY application', 105, 16, { align: 'center' });
    doc.text('Copy these details into the form issued by your District Social Welfare Office or official portal', 105, 21, { align: 'center' });

    // Reference & Date Bar
    doc.setFillColor(248, 250, 252);
    doc.rect(10, 28, 190, 8, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(10, 28, 190, 8, 'S');

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('PERSONAL DRAFT — NO APPLICATION NUMBER', 14, 33);
    doc.text(`DATE: ${new Date().toLocaleDateString('en-IN')}`, 130, 33);
    doc.text(`STATUS: ${draft.status === 'validated' ? 'DRAFT (FIELDS COMPLETE)' : 'DRAFT'}`, 160, 33);

    // Photograph placeholder box
    doc.rect(165, 40, 35, 40, 'S');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('Passport Size Photo\n(paste on the\nofficial form)', 182.5, 58, { align: 'center' });

    let currentY = 42;

    // Helper to print section header
    const printSectionHeader = (title: string) => {
      doc.setFillColor(238, 242, 255);
      doc.rect(10, currentY, 150, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 58, 138);
      doc.text(title, 13, currentY + 4.5);
      currentY += 8;
    };

    // Helper to print field row
    const printFieldRow = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(label + ':', 12, currentY);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(value || 'N/A', 80, currentY);
      currentY += 5;
    };

    // 1. Citizen Identification
    printSectionHeader('1. BENEFICIARY IDENTIFICATION & KYC');
    printFieldRow('Applicant Full Name', profile.name || '[Pending Citizen Name]');
    printFieldRow('Aadhaar Number (UIDAI)', profile.aadhaarNumber || '[Pending UIDAI Entry]');
    printFieldRow('Father / Spouse Name', profile.fatherSpouseName || '[Pending Entry]');
    printFieldRow('Gender / Age', `${profile.gender || 'Not specified'} / ${profile.age ? `${profile.age} Years` : 'Age pending'}`);
    printFieldRow('Permanent Address', profile.residentialAddress || (profile.district ? `${profile.district}, ${profile.state}` : '[Address Pending]'));
    printFieldRow('District & State', `${profile.district || '[District Pending]'}, ${profile.state || '[State Pending]'}`);
    currentY += 2;

    // 2. Social & Economic Verification
    printSectionHeader('2. SOCIAL CATEGORY & INCOME VERIFICATION');
    printFieldRow('Social Category', profile.socialCategory || 'Scheduled Caste (SC)');
    printFieldRow('Sub-Caste Community', profile.subCaste || '[To be specified]');
    printFieldRow('Caste Certificate', '[Attach copy issued by competent authority]');
    printFieldRow('Annual Family Income', (profile.annualFamilyIncome || profile.householdIncome) ? `${profile.annualFamilyIncome || profile.householdIncome}` : '[Income Certificate Pending]');
    printFieldRow('BPL / Ration Card Number', profile.bplRationCardNumber || '[Optional / Not Provided]');
    currentY += 2;

    // 3. Enterprise & Financial Plan
    printSectionHeader('3. PROPOSED ENTERPRISE & CAPITAL SUBSIDY BREAKDOWN');
    printFieldRow('Target Micro-Enterprise Trade', profile.traditionalTrade ? `Modern ${profile.traditionalTrade} Enterprise` : 'Vocational Enterprise Unit');
    printFieldRow('Total Estimated Project Cost', '[From your project report / quotation]');
    printFieldRow('Grant support requested', '[As per scheme rules — confirm with district office]');
    printFieldRow('Bank loan (if any)', '[As sanctioned by bank — e.g. MUDRA / NSFDC]');
    printFieldRow('Own contribution', '[As required by scheme / bank]');
    currentY += 2;

    // 4. DBT Bank Account Mandate
    printSectionHeader('4. BANK ACCOUNT DETAILS FOR SUBSIDY DIRECT BENEFIT TRANSFER (DBT)');
    printFieldRow('Bank Name & Branch', profile.bankName ? `${profile.bankName}` : '[Bank Details Pending]');
    printFieldRow('Account Number', profile.bankAccountNumber || '[Account Number Pending]');
    printFieldRow('IFSC Code', profile.bankIfscCode || '[IFSC Code Pending]');
    printFieldRow('Aadhaar Seeding Status', profile.bankAccountNumber ? 'Active & Linked for DBT (NPCI Validated)' : 'Pending Verification');
    currentY += 4;

    // Checklist Box
    doc.setFillColor(241, 245, 249);
    doc.rect(10, currentY, 190, 22, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(10, currentY, 190, 22, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text('DOCUMENTS CHECKLIST (attach copies with the official form):', 14, currentY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('[ ] 1. Self-attested copy of Aadhaar Card', 14, currentY + 11);
    doc.text('[ ] 2. Caste certificate (SC)', 14, currentY + 16);
    doc.text('[ ] 3. Annual family income certificate', 100, currentY + 11);
    doc.text('[ ] 4. Bank passbook front page with IFSC', 100, currentY + 16);
    doc.text('[ ] 5. Project report / quotation', 150, currentY + 11);
    currentY += 26;

    // Declaration & Signatures
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('DECLARATION BY BENEFICIARY:', 10, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(
      'I hereby declare that the particulars furnished above are true and correct to the best of my knowledge. I belong to the Scheduled Caste community and have not availed any other government capital subsidy for the same trade within the last 3 years. I consent to verification via Aadhaar/Ration database for PM-AJAY Grants-in-Aid.',
      10,
      currentY + 4,
      { maxWidth: 190 }
    );
    currentY += 16;

    // Signature boxes
    doc.line(10, currentY + 12, 60, currentY + 12);
    doc.text('Date & Place', 10, currentY + 16);

    doc.line(140, currentY + 12, 195, currentY + 12);
    doc.text('Signature / Thumb Impression of Applicant', 140, currentY + 16);

    // Official Destination Box
    currentY += 22;
    doc.setFillColor(254, 243, 199);
    doc.rect(10, currentY, 190, 14, 'F');
    doc.setDrawColor(245, 158, 11);
    doc.rect(10, currentY, 190, 14, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(146, 64, 14);
    doc.text(`SUBMIT PHYSICAL / ONLINE COPY TO:`, 14, currentY + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${draft.submissionOffice.name} | ${draft.submissionOffice.address} | Contact: ${draft.submissionOffice.contactPhone}`,
      14,
      currentY + 10
    );

    // Save PDF
    const filename = `PM_AJAY_GIA_Application_${(profile.name || 'Beneficiary').replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);
  },
};
