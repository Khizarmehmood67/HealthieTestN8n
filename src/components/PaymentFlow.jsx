import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Card, CardContent, Button, Grid,
    Alert, CircularProgress, Divider, useTheme, TextField,
    FormControlLabel, Checkbox, MenuItem, Stepper, Step, StepLabel,
    RadioGroup, Radio, InputLabel, Chip, LinearProgress
} from '@mui/material';
// Replace your current MUI icons import with:
import CreditCard from '@mui/icons-material/CreditCard';
import Lock from '@mui/icons-material/Lock';
import Security from '@mui/icons-material/Security';
import HealthAndSafety from '@mui/icons-material/HealthAndSafety';
import Label from '@mui/icons-material/Label';
import CheckCircle from '@mui/icons-material/CheckCircle';
import HourglassEmpty from '@mui/icons-material/HourglassEmpty';
import ErrorIcon from '@mui/icons-material/Error'; // Renamed to avoid conflict
import Send from '@mui/icons-material/Send';
import Info from '@mui/icons-material/Info';
import { loadStripe } from '@stripe/stripe-js';
import {
    Elements,
    CardNumberElement,
    CardExpiryElement,
    CardCvcElement,
    useStripe,
    useElements
} from '@stripe/react-stripe-js';
import healthieAPI from '../services/healthieAPI';

// Initialize Stripe
const HEALTHIE_STRIPE_KEY = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
const stripePromise = loadStripe(HEALTHIE_STRIPE_KEY);

// Enhanced Coverage Calculator with fallback for empty benefits
class CoverageCalculator {
    static calculatePatientResponsibility(serviceAmount, eligibilityData) {
        const amount = parseFloat(serviceAmount.replace(/[^0-9.]/g, ''));

        if (!eligibilityData || !eligibilityData.eligible) {
            return {
                totalDue: amount,
                insuranceCoverage: 0,
                patientResponsibility: amount,
                copay: 0,
                deductible: 0,
                coinsurance: 0,
                coverageDetails: 'Not covered by insurance',
                isEstimated: false
            };
        }

        const response = eligibilityData.eligibilityResponse || {};
        const benefits = response.benefits || [];

        // Find the most relevant benefit
        const primaryBenefit = benefits.find(b =>
            ['97802', '97803', 'Medical Care', 'OUTPATIENT', 'GENERAL'].includes(b.category)
        ) || benefits[0];
        console.log("eligibilityData", primaryBenefit);
        let copay = parseFloat(primaryBenefit?.copay || response.copay || 0);
        let deductible = parseFloat(primaryBenefit?.deductible || response.deductible || 0);
        let coinsurancePercent = parseFloat(primaryBenefit?.coinsurance || response.coinsurance || 0);
        let coveragePercent = parseFloat(primaryBenefit?.coveragePercentage || 0);

        // Fallback logic for empty benefits (common with nutritional codes)
        let isEstimated = false;
        if (benefits.length === 0 || (!copay && !coveragePercent && !deductible)) {
            console.warn('Using estimated coverage for nutritional codes - verify with payer');
            isEstimated = true;

            // Industry standard assumptions for nutritional therapy
            // if (!copay && !coveragePercent) {
            //     // Default to 80% coverage assumption for most commercial plans
            //     coveragePercent = 80;
            //     coinsurancePercent = 20;
            // }
        }

        // Calculate insurance coverage
        let insuranceCoverage = 0;
        let patientResponsibility = amount;

        if (copay > 0) {
            // Copay-based plan
            insuranceCoverage = Math.max(0, amount - copay);
            patientResponsibility = copay;
        } else if (coveragePercent > 0) {
            // Percentage-based coverage
            const coveredAmount = (amount * coveragePercent) / 100;

            if (deductible > 0) {
                // Apply deductible first
                insuranceCoverage = Math.max(0, coveredAmount - deductible);
                patientResponsibility = amount - insuranceCoverage;
            } else if (coinsurancePercent > 0) {
                // Apply coinsurance
                const coinsuranceAmount = (coveredAmount * coinsurancePercent) / 100;
                insuranceCoverage = coveredAmount - coinsuranceAmount;
                patientResponsibility = amount - insuranceCoverage;
            } else {
                // Full coverage at percentage
                insuranceCoverage = coveredAmount;
                patientResponsibility = amount - insuranceCoverage;
            }
        }


        return {
            totalDue: Math.max(0, patientResponsibility),
            insuranceCoverage: Math.max(0, insuranceCoverage),
            patientResponsibility: Math.max(0, patientResponsibility),
            copay,
            deductible,
            coinsurance: coinsurancePercent,
            coveragePercent,
            coverageDetails: this.generateCoverageDescription(primaryBenefit, response, isEstimated),
            isEstimated
        };
    }

    static generateCoverageDescription(benefit, response, isEstimated) {
        let baseDescription = '';

        if (benefit?.copay || response.copay) {
            baseDescription = `Copay plan: ${benefit?.copay || response.copay} per visit`;
        } else if (benefit?.coveragePercentage) {
            baseDescription = `${benefit.coveragePercentage}% coverage`;
            if (benefit.deductible) baseDescription += ` after ${benefit.deductible} deductible`;
            if (benefit.coinsurance) baseDescription += ` with ${benefit.coinsurance}% coinsurance`;
        } else {
            baseDescription = 'Coverage details limited for nutritional codes';
        }

        if (isEstimated) {
            baseDescription += ' (ESTIMATED - please verify with your insurance)';
        }

        return baseDescription;
    }
}

// Enhanced Claim Status Component with ClaimSubmission data
const ClaimStatusIndicator = ({ status, claimId, claimSubmission, pcn, onStatusUpdate }) => {
    const getStatusInfo = (status) => {
        switch (status?.toLowerCase()) {
            case 'preparing':
                return { color: 'default', icon: <HourglassEmpty />, text: 'Preparing Claim' };
            case 'creating':
                return { color: 'info', icon: <HourglassEmpty />, text: 'Creating CMS1500 Form' };
            case 'created':
                return { color: 'info', icon: <CheckCircle />, text: 'CMS1500 Form Created' };
            case 'submitting':
                return { color: 'warning', icon: <Send />, text: 'Submitting to ClaimMD' };
            case 'submitted':
            case 'sent':
                return { color: 'info', icon: <Send />, text: 'Claim Submitted to ClaimMD' };
            case 'transmitted':
                return { color: 'info', icon: <CheckCircle />, text: 'Claim Transmitted to Insurance' };
            case 'processing':
            case 'pending':
                return { color: 'warning', icon: <HourglassEmpty />, text: 'Processing with Insurance' };
            case 'paid':
            case 'approved':
                return { color: 'success', icon: <CheckCircle />, text: 'Claim Approved & Paid' };
            case 'partial_payment':
                return { color: 'warning', icon: <Info />, text: 'Partial Payment Received' };
            case 'rejected':
            case 'denied':
                return { color: 'error', icon: <ErrorIcon />, text: 'Claim Denied - Review Required' };
            case 'failed':
                return { color: 'error', icon: <ErrorIcon />, text: 'Claim Submission Failed' };
            default:
                return { color: 'default', icon: <HourglassEmpty />, text: 'Preparing Claim' };
        }
    };

    const statusInfo = getStatusInfo(status);

    return (
        <Box sx={ { display: 'flex', flexDirection: 'column', gap: 1, p: 2, bgcolor: 'grey.50', borderRadius: 1, mb: 2 } }>
            <Box sx={ { display: 'flex', alignItems: 'center', gap: 1 } }>
                <Chip
                    icon={ statusInfo.icon }
                    label={ statusInfo.text }
                    color={ statusInfo.color }
                    variant="outlined"
                    size="small"
                />
                { ['submitting', 'processing', 'creating', 'transmitted'].includes(status?.toLowerCase()) && (
                    <LinearProgress sx={ { flexGrow: 1, ml: 2 } } />
                ) }
            </Box>

            {/* ClaimSubmission details */ }
            <Box sx={ { display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 } }>
                { claimId && (
                    <Typography variant="caption" color="textSecondary">
                        CMS1500 ID: { claimId }
                    </Typography>
                ) }
                { claimSubmission?.id && (
                    <Typography variant="caption" color="textSecondary">
                        Submission ID: { claimSubmission.id }
                    </Typography>
                ) }
                { pcn && (
                    <Typography variant="caption" color="success.main" sx={ { fontWeight: 600 } }>
                        PCN: { pcn }
                    </Typography>
                ) }
                { claimSubmission?.created_at && (
                    <Typography variant="caption" color="textSecondary">
                        Submitted: { new Date(claimSubmission.created_at).toLocaleString() }
                    </Typography>
                ) }
            </Box>

            {/* Integration details */ }
            { claimSubmission?.integration && (
                <Typography variant="caption" color="textSecondary" sx={ { mt: 0.5 } }>
                    via { claimSubmission.integration.name || 'ClaimMD Integration' }
                </Typography>
            ) }
        </Box>
    );
};

// Enhanced Card Payment Form Component
const CardPaymentForm = ({
    bookingData,
    totalAmount,
    insuranceData,
    isOhioLocation,
    onSuccess,
    onError,
    appointment_type,
    coverageCalculation
}) => {
    const stripe = useStripe();
    const elements = useElements();
    const [processing, setProcessing] = useState(false);
    const [cardholderName, setCardholderName] = useState('');
    const [saveCard, setSaveCard] = useState(false);
    const [claimStatus, setClaimStatus] = useState('preparing');
    const [claimId, setClaimId] = useState(null);
    const [claimSubmission, setClaimSubmission] = useState(null);
    const [pcn, setPcn] = useState(null);
    const theme = useTheme();

    const elementOptions = {
        style: {
            base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                    color: '#aab7c4',
                },
                fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
            },
            invalid: {
                color: '#9e2146',
                iconColor: '#9e2146'
            },
        },
    };

    // Enhanced claim submission using ClaimSubmission API
    const submitClaimToClaimMD = async (cms1500Data, claimAmount) => {
        try {
            setClaimStatus('submitting');

            // Use the correct uploadCms1500sToIntegrations mutation
            const claimSubmissionResult = await healthieAPI.submitClaim({
                cms1500_id: [cms1500Data.id],
                destination_integration: "claim_md" // or whatever the enum value is for ClaimMD
            });

            if (claimSubmissionResult?.uploadCms1500sToIntegrations?.success_message) {
                const result = claimSubmissionResult.uploadCms1500sToIntegrations;

                // Store the submission data
                setClaimSubmission({
                    id: cms1500Data.id,
                    cms1500_id: cms1500Data.id,
                    created_at: new Date().toISOString(),
                    status: result.cms1500s?.[0]?.status || 'submitted',
                    success_message: result.success_message,
                    messages: result.messages || []
                });

                setClaimStatus('submitted');

                // // Start polling for status updates using CMS1500 ID
                // pollCms1500Status(cms1500Data.id);

                return {
                    id: cms1500Data.id,
                    status: 'submitted',
                    success_message: result.success_message,
                    messages: result.messages
                };
            } else {
                throw new Error('Failed to submit claim to ClaimMD - no success response');
            }
        } catch (error) {
            console.error('ClaimMD submission error:', error);
            setClaimStatus('failed');
            throw error;
        }
    };

    // Enhanced status polling using ClaimSubmission ID
    const pollClaimSubmissionStatus = async (claimSubmissionId, attempts = 0) => {
        try {
            const statusResponse = await healthieAPI.getClaimSubmissionStatus(claimSubmissionId);

            if (statusResponse?.claimSubmission) {
                const submission = statusResponse.claimSubmission;

                // Update ClaimSubmission data
                setClaimSubmission(submission);

                // Update PCN if available
                if (submission.pcn && submission.pcn !== pcn) {
                    setPcn(submission.pcn);
                }

                // Determine status from integration response
                const integrationData = submission.integration_formatted_claim_data;
                let currentStatus = 'processing';

                if (integrationData) {
                    // Parse integration-specific status
                    if (integrationData.status) {
                        currentStatus = integrationData.status.toLowerCase();
                    } else if (integrationData.claim_status) {
                        currentStatus = integrationData.claim_status.toLowerCase();
                    } else if (submission.pcn) {
                        // If we have a PCN, claim was successfully transmitted
                        currentStatus = 'transmitted';
                    }
                }

                setClaimStatus(currentStatus);

                // Continue polling if still processing
                if (['submitted', 'processing', 'pending', 'transmitted'].includes(currentStatus) && attempts < 30) {
                    setTimeout(() => pollClaimSubmissionStatus(claimSubmissionId, attempts + 1), 5000);
                } else if (['partial_payment', 'paid', 'approved'].includes(currentStatus)) {
                    console.log('Claim processed successfully:', currentStatus);
                } else if (['rejected', 'denied', 'failed'].includes(currentStatus)) {
                    console.error('Claim processing failed:', currentStatus, integrationData);
                }
            }
        } catch (error) {
            console.error('Error checking ClaimSubmission status:', error);
            if (attempts < 5) {
                setTimeout(() => pollClaimSubmissionStatus(claimSubmissionId, attempts + 1), 10000);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!stripe || !elements) {
            onError('Please fill in all fields');
            return;
        }

        setProcessing(true);

        try {
            // Step 1: Use existing client or create if needed
            let client;
            if (insuranceData.clientId) {
                client = { id: insuranceData.clientId };
            } else {
                client = await healthieAPI.getClientByEmail(bookingData.patient.email);
                if (!client) {
                    client = await healthieAPI.createClient({
                        first_name: bookingData.patient.firstName,
                        last_name: bookingData.patient.lastName,
                        email: bookingData.patient.email,
                        phone: bookingData.patient.phone,
                        dob: bookingData.patient.dateOfBirth,
                        provider_id: bookingData.appointment.providerId.toString()
                    });
                }
            }

            let billingResult = null;
            let appointmentData = {
                user_id: client.id,
                appointment_type_id: bookingData.service.id || null,
                contact_type: bookingData.patient.contact_type || 'In Person',
                other_party_id: bookingData.appointment?.providerId,
                datetime: bookingData.appointment?.date
            };

            // Step 2: Handle insurance billing with enhanced coverage calculation
            if (isOhioLocation && insuranceData?.verified && insuranceData?.billingType === 'insurance' && coverageCalculation.insuranceCoverage > 0) {
                setClaimStatus('creating');

                // Fixed CMS1500 creation with correct Healthie API schema
                const cms1500Variables = {
                    patient: {
                        id: client.id,
                        full_legal_name_with_preferred: `${bookingData.patient.firstName} ${bookingData.patient.lastName}`,
                        location: {
                            line1: bookingData.patient.address || bookingData.location.location || '',
                            city: bookingData.patient.city || bookingData.location.location || '',
                            state: bookingData.patient.state || 'OH',
                            zip: bookingData.patient.zip || ''
                        },
                    },
                    dietitian: {
                        id: bookingData.appointment?.providerId,
                        qualifications: bookingData.appointment?.doctor?.qualifications || null,
                    },
                    service_location_id: bookingData.location.id,
                    // Use insurance coverage amount for CMS1500
                    amount_paid: coverageCalculation.insuranceCoverage.toString(),
                    service_date: new Date(bookingData.appointment?.date).toISOString().split('T')[0],
                    cms1500_policies: [
                        {
                            policy: {
                                insurance_plan_id: insuranceData.planId,
                                num: insuranceData.memberId,
                                group_num: insuranceData.groupNumber || '',
                                payer_location: {
                                    state: "OH"
                                },
                                user_id: client.id,
                                holder_relationship: insuranceData.relationshipToInsured || 'self',
                                holder_dob: insuranceData.m_dob
                            }
                        }
                    ],
                    // Try different field names for ICD codes based on common API patterns
                    // icd_codes_cms1500s: bookingData.icdCodes || [
                    //     {
                    //         diagnosis_code: 'Z71.3' // Try diagnosis_code instead of icd_code
                    //     }
                    // ],
                    // // Try different field names for CPT codes based on common API patterns
                    // cpt_codes_cms1500s: bookingData.cptCodes || [
                    //     {
                    //         procedure_code: '97802', // Try procedure_code instead of cpt_code
                    //         units: '1'
                    //     }
                    // ],
                    client_sig_on_file: true,
                    assignment_of_benefits: true,
                    release_of_information: true,
                    place_of_service: '11', // Office
                    type_of_service: 'medical',
                    frequency_code: 'original'
                };

                const cms1500Result = await healthieAPI.createCMS1500(cms1500Variables);

                if (cms1500Result?.createCms1500?.cms1500) {
                    const cms1500 = cms1500Result.createCms1500.cms1500;
                    setClaimId(cms1500.id);
                    setClaimStatus('created');

                    // Submit claim to ClaimMD
                    const claimSubmissionResult = await submitClaimToClaimMD(cms1500, coverageCalculation.insuranceCoverage);

                    // Handle patient responsibility payment if any
                    if (totalAmount > 0) {
                        const { token, error: tokenError } = await stripe.createToken(
                            elements.getElement(CardNumberElement),
                            { name: cardholderName }
                        );

                        if (tokenError) throw new Error(tokenError.message);

                        const cardStorageResult = await healthieAPI.storeCard({
                            user_id: client.id,
                            token: token.id,
                            card_type_label: 'personal',
                            is_default: true
                        });

                        billingResult = await healthieAPI.createBillingItem({
                            amount_paid: totalAmount.toString(),
                            sender_id: client.id,
                            stripe_customer_detail_id: cardStorageResult.id,
                            stripe_idempotency_key: crypto.randomUUID(),
                            should_charge: true,
                            notes: `Patient responsibility: ${coverageCalculation.coverageDetails}`
                        });

                        appointmentData.billing_item_id = billingResult.id;
                    }

                    appointmentData.cms1500_id = cms1500.id;
                    appointmentData.claim_submission_id = claimSubmissionResult?.id;
                    appointmentData.claim_submission_data = claimSubmissionResult;
                }

            } else if (isOhioLocation && insuranceData?.requestSuperbill) {
                // Handle superbill case (unchanged)
                const { token, error: tokenError } = await stripe.createToken(
                    elements.getElement(CardNumberElement),
                    { name: cardholderName }
                );

                if (tokenError) throw new Error(tokenError.message);

                const cardStorageResult = await healthieAPI.storeCard({
                    user_id: client.id,
                    token: token.id,
                    card_type_label: 'personal',
                    is_default: true
                });

                billingResult = await healthieAPI.createBillingItem({
                    amount_paid: totalAmount.toString(),
                    sender_id: client.id,
                    stripe_customer_detail_id: cardStorageResult.id,
                    stripe_idempotency_key: crypto.randomUUID(),
                    should_charge: true
                });

                appointmentData.billing_item_id = billingResult.id;

                // Create superbill for reimbursement
                const superbillData = {
                    patient_id: client.id,
                    patient_name: client.name || `${bookingData.patient.firstName} ${bookingData.patient.lastName}`,
                    patient_dob: insuranceData.m_dob || "2001-09-10",
                    dietitian_id: bookingData.appointment?.providerId,
                    provider_name: bookingData.appointment?.doctor || '',
                    service_date: new Date(bookingData.appointment?.date).toISOString().split('T')[0],
                    amount_paid: totalAmount.toString(),
                    status: 'Not Sent',
                    icd_codes_super_bills: bookingData.icdCodes || [],
                    cpt_codes_super_bills: bookingData.cptCodes || [],
                    location: {
                        id: bookingData.location.id,
                        line1: bookingData.location.location || "",
                        state: bookingData.location.location || ""
                    },
                    patient_location: {
                        country: "US",
                        line1: bookingData.patient.address || bookingData.location.location || "",
                        state: bookingData.patient.state || "OH"
                    }
                };

                const superbillResult = await healthieAPI.createSuperbill(superbillData);

                if (superbillResult?.createSuperBill?.superBill) {
                    await healthieAPI.updateSuperbill(
                        superbillResult.createSuperBill.superBill.id,
                        { status: 'Sent', should_email_to_client: true }
                    );
                    appointmentData.superbill_id = superbillResult.createSuperBill.superBill.id;
                }

            } else {
                // Standard self-pay payment (unchanged)
                const { token, error: tokenError } = await stripe.createToken(
                    elements.getElement(CardNumberElement),
                    { name: cardholderName }
                );

                if (tokenError) throw new Error(tokenError.message);

                const cardStorageResult = await healthieAPI.storeCard({
                    user_id: client.id,
                    token: token.id,
                    card_type_label: 'personal',
                    is_default: true
                });

                billingResult = await healthieAPI.createBillingItem({
                    amount_paid: totalAmount.toString(),
                    sender_id: client.id,
                    stripe_customer_detail_id: cardStorageResult.id,
                    stripe_idempotency_key: crypto.randomUUID(),
                    should_charge: true
                });

                appointmentData.billing_item_id = billingResult.id;
            }

            // Step 3: Create appointment
            const appointment = await healthieAPI.createAppointment(appointmentData);

            // Success
            onSuccess({
                appointmentId: appointment?.id || 'pending',
                billingItemId: billingResult?.id,
                cms1500Id: appointmentData.cms1500_id,
                claimSubmissionId: appointmentData.claim_submission_id,
                claimSubmissionData: appointmentData.claim_submission_data,
                superbillId: appointmentData.superbill_id,
                amount: totalAmount,
                status: 'succeeded',
                clientId: client.id,
                claimStatus: claimStatus,
                claimId: claimId,
                claimSubmission: claimSubmission,
                pcn: pcn,
                insuranceClaim: isOhioLocation && insuranceData?.verified && insuranceData?.billingType === 'insurance',
                coverageBreakdown: coverageCalculation
            });

        } catch (error) {
            console.error('Payment error:', error);
            onError(error.message || 'Payment failed');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <Box component="form" onSubmit={ handleSubmit }>
            {/* Show claim status for insurance claims */ }
            { isOhioLocation && insuranceData?.verified && insuranceData?.billingType === 'insurance' && (
                <ClaimStatusIndicator
                    status={ claimStatus }
                    claimId={ claimId }
                    claimSubmission={ claimSubmission }
                    pcn={ pcn }
                    onStatusUpdate={ setClaimStatus }
                />
            ) }

            <Grid container spacing={ 2 }>
                {/* Only show card fields if payment is required */ }
                { totalAmount > 0 && (
                    <>
                        <Grid item size={ { xs: 12 } }>
                            <TextField
                                label="Cardholder Name"
                                value={ cardholderName }
                                onChange={ (e) => setCardholderName(e.target.value) }
                                fullWidth
                                size="small"
                                sx={ { mb: 1 } }
                            />
                        </Grid>
                        {/* Card Number */ }
                        <Grid item size={ { xs: 12 } }>
                            <Typography variant="caption" color="textSecondary" sx={ { mb: 0.5, display: 'block' } }>
                                Card Number
                            </Typography>
                            <Box sx={ {
                                border: '1px solid #d0d0d0',
                                borderRadius: 1,
                                p: 1.5,
                                '&:hover': { borderColor: '#b0b0b0' },
                                '&:focus-within': {
                                    borderColor: theme.palette.primary.main,
                                    borderWidth: '2px',
                                    p: '11px'
                                }
                            } }>
                                <CardNumberElement options={ elementOptions } />
                            </Box>
                        </Grid>

                        {/* Expiry and CVC */ }
                        <Grid item size={ { xs: 6 } }>
                            <Typography variant="caption" color="textSecondary" sx={ { mb: 0.5, display: 'block' } }>
                                Expiry Date
                            </Typography>
                            <Box sx={ {
                                border: '1px solid #d0d0d0',
                                borderRadius: 1,
                                p: 1.5,
                                '&:hover': { borderColor: '#b0b0b0' },
                                '&:focus-within': {
                                    borderColor: theme.palette.primary.main,
                                    borderWidth: '2px',
                                    p: '11px'
                                }
                            } }>
                                <CardExpiryElement options={ elementOptions } />
                            </Box>
                        </Grid>

                        <Grid item size={ { xs: 6 } }>
                            <Typography variant="caption" color="textSecondary" sx={ { mb: 0.5, display: 'block' } }>
                                CVC
                            </Typography>
                            <Box sx={ {
                                border: '1px solid #d0d0d0',
                                borderRadius: 1,
                                p: 1.5,
                                '&:hover': { borderColor: '#b0b0b0' },
                                '&:focus-within': {
                                    borderColor: theme.palette.primary.main,
                                    borderWidth: '2px',
                                    p: '11px'
                                }
                            } }>
                                <CardCvcElement options={ elementOptions } />
                            </Box>
                        </Grid>

                        {/* Save Card Option */ }
                        <Grid item size={ { xs: 12 } }>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={ saveCard }
                                        onChange={ (e) => setSaveCard(e.target.checked) }
                                        size="small"
                                    />
                                }
                                label={ <Typography variant="body2">Save card for future appointments</Typography> }
                            />
                        </Grid>
                    </>
                ) }

                {/* Submit Button */ }
                <Grid item size={ { xs: 12 } }>
                    <Button
                        type="submit"
                        variant="contained"
                        fullWidth
                        disabled={ !stripe || processing }
                        sx={ {
                            py: 1.5,
                            mt: 2,
                            backgroundColor: theme.palette.primary.main,
                            color: 'white',
                            '&:hover': {
                                backgroundColor: theme.palette.primary.dark,
                            }
                        } }
                    >
                        { processing ? (
                            <>
                                <CircularProgress size={ 20 } sx={ { mr: 1, color: 'white' } } />
                                { claimStatus === 'creating' && 'Creating CMS1500 Form...' }
                                { claimStatus === 'submitting' && 'Submitting to ClaimMD...' }
                                { claimStatus === 'processing' && 'Processing Payment...' }
                                { !['creating', 'submitting', 'processing'].includes(claimStatus) && 'Processing...' }
                            </>
                        ) : totalAmount > 0 ? (
                            <>
                                <Lock sx={ { mr: 1, fontSize: 20 } } />
                                { isOhioLocation && insuranceData?.verified && insuranceData?.billingType === 'insurance'
                                    ? `Pay Patient Responsibility $${totalAmount}`
                                    : `Pay $${totalAmount}` }
                            </>
                        ) : (
                            <>
                                <Send sx={ { mr: 1, fontSize: 20 } } />
                                Submit Insurance Claim
                            </>
                        ) }
                    </Button>
                </Grid>
            </Grid>

            {/* Security Badge */ }
            <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 2 } }>
                <Lock sx={ { fontSize: 14, color: 'text.secondary', mr: 0.5 } } />
                <Typography variant="caption" color="text.secondary">
                    { totalAmount > 0
                        ? 'Secured by Stripe & ClaimMD HIPAA-compliant processing'
                        : 'Insurance claim processed securely through ClaimMD'
                    }
                </Typography>
            </Box>
        </Box>
    );
};

// Main PaymentFlow Component continues with enhanced insurance handling...
const PaymentFlow = ({ bookingData, onComplete }) => {
    const isOhioLocation = bookingData.location?.code === "OH" || bookingData.location?.location === "Ohio";

    const [currentSubStep, setCurrentSubStep] = useState(isOhioLocation ? 0 : 1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [appointment_type, setAppointmenttype] = useState([]);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [coverageCalculation, setCoverageCalculation] = useState({
        totalDue: bookingData.service?.pricing || 0,
        insuranceCoverage: 0,
        patientResponsibility: bookingData.service?.pricing || 0,
        copay: 0,
        deductible: 0,
        coinsurance: 0,
        coverageDetails: 'No insurance verification'
    });

    const [insuranceData, setInsuranceData] = useState({
        hasInsurance: false,
        planId: '',
        memberId: '',
        groupNumber: '',
        relationshipToInsured: 'self',
        isPrimary: true,
        billingType: 'self-pay',
        requestSuperbill: false,
        verified: false,
        m_dob: null,
        eligibilityId: null,
        benefits: null,
        eligibilityMessages: [],
        clientId: null,
        eligibilityStatus: null,
        eligibilityResponse: null
    });

    const [insurancePlans, setInsurancePlans] = useState([]);
    const theme = useTheme();

    useEffect(() => {
        if (bookingData.patient?.insurance && isOhioLocation) {
            setInsuranceData(prev => ({
                ...prev,
                ...bookingData.patient.insurance,
                hasInsurance: true
            }));
        }
        if (isOhioLocation) {
            fetchInsurancePlans();
        }
    }, [bookingData]);

    useEffect(() => {
        (async () => {
            try {
                const appointmentTypes = await healthieAPI.getAppointmentTypes();
                setAppointmenttype(appointmentTypes)
            } catch (error) {
                console.error('Error fetching appointment types:', error);
            }
        })();
    }, []);

    const fetchInsurancePlans = async () => {
        try {
            const plans = await healthieAPI.getInsurancePlans({ is_accepted: true });
            setInsurancePlans(plans?.data?.insurancePlans || plans || []);
        } catch (error) {
            console.error('Failed to fetch insurance plans:', error);
        }
    };

    // Enhanced HTML benefit parser for Healthie eligibility responses
    class HealthieBenefitParser {
        static parseHTMLResponse(htmlResponse) {
            if (!htmlResponse) return null;

            const benefits = [];
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlResponse, 'text/html');

            // Extract benefit sections
            const sections = doc.querySelectorAll('div > strong');

            sections.forEach(section => {
                const benefitType = section.textContent.trim();
                const parentDiv = section.closest('div');

                if (parentDiv) {
                    const benefit = {
                        category: benefitType,
                        coveragePercentage: null,
                        copay: null,
                        coinsurance: null,
                        deductible: null,
                        active: false,
                        details: []
                    };

                    // Look for coverage indicators
                    const listItems = parentDiv.querySelectorAll('li');
                    listItems.forEach(item => {
                        const text = item.textContent.trim();

                        // Check for active coverage
                        if (text.includes('Active Coverage')) {
                            benefit.active = true;
                        }

                        // Extract copayment
                        const copayMatch = text.match(/Co-Payment:\s*\$(\d+(?:\.\d{2})?)/i);
                        if (copayMatch) {
                            benefit.copay = parseFloat(copayMatch[1]);
                        }

                        // Extract coinsurance
                        const coinsuranceMatch = text.match(/Co-Insurance:\s*(\d+)%/i);
                        if (coinsuranceMatch) {
                            benefit.coinsurance = parseFloat(coinsuranceMatch[1]);
                            // If coinsurance is 0%, that means 100% coverage
                            if (benefit.coinsurance === 0) {
                                benefit.coveragePercentage = 100;
                            }
                        }

                        // Extract limitations/coverage percentages
                        const limitationMatch = text.match(/Limitations:\s*(\d+)%/i);
                        if (limitationMatch) {
                            benefit.coveragePercentage = parseFloat(limitationMatch[1]);
                        }

                        // Store additional details
                        if (text && text !== 'Active Coverage') {
                            benefit.details.push(text);
                        }
                    });

                    // Only add benefits that are active or have coverage data
                    if (benefit.active || benefit.copay !== null || benefit.coinsurance !== null || benefit.coveragePercentage !== null) {
                        benefits.push(benefit);
                    }
                }
            });

            return benefits;
        }

        static findRelevantBenefit(benefits, serviceType = 'nutritional') {
            // Priority order for nutritional services
            const priorities = [
                'Professional (Physician) Visit - Office',
                'Medical Care',
                'Hospital - Outpatient',
                'Outpatient',
                'General'
            ];

            for (const priority of priorities) {
                const benefit = benefits.find(b =>
                    b.category.toLowerCase().includes(priority.toLowerCase())
                );
                if (benefit && benefit.active) {
                    return benefit;
                }
            }

            // Return first active benefit as fallback
            return benefits.find(b => b.active) || benefits[0];
        }
    }

    // Enhanced eligibility response handling with HTML parsing
    const handleEligibilityResponse = (eligibilityResult) => {
        if (!eligibilityResult?.runEligibilityCheck?.eligibility_check) {
            throw new Error('No eligibility check response received from insurance system');
        }

        const { eligibility_check, messages } = eligibilityResult.runEligibilityCheck;

        // Check for error messages
        if (messages && messages.length > 0) {
            const errorMessages = messages.filter(m =>
                m.message && (
                    m.message.toLowerCase().includes('error') ||
                    m.message.toLowerCase().includes('invalid') ||
                    m.message.toLowerCase().includes('not found')
                )
            );
            if (errorMessages.length > 0) {
                throw new Error(errorMessages.map(m => m.message).join(', '));
            }
        }

        const eligibilityResponse = eligibility_check?.eligibilityResponse;
        let isEligible = eligibilityResponse?.eligible || false;

        // Handle benefits array - may be empty but HTML response contains data
        let benefits = eligibilityResponse?.benefits || [];

        // NEW: Parse HTML response if benefits array is empty
        if (benefits.length === 0 && eligibility_check?.policy?.latest_eligibility_check?.response_as_html) {
            console.log('Parsing HTML eligibility response for benefit details');
            const parsedBenefits = HealthieBenefitParser.parseHTMLResponse(
                eligibility_check.policy.latest_eligibility_check.response_as_html
            );

            if (parsedBenefits && parsedBenefits.length > 0) {
                benefits = parsedBenefits;

                // If we found active benefits, consider eligible
                const activeBenefits = benefits.filter(b => b.active);
                if (activeBenefits.length > 0) {
                    isEligible = true;
                }
            }
        }

        // If still no benefits but we have active coverage indicators, create default
        if (isEligible && benefits.length === 0) {
            console.warn('Benefits array empty but eligible - using default structure');
            benefits = [{
                category: 'OUTPATIENT',
                coveragePercentage: 80,
                copay: eligibilityResponse?.copay || 0,
                deductible: eligibilityResponse?.deductible || 0,
                coinsurance: eligibilityResponse?.coinsurance || 20,
                description: 'Default coverage structure'
            }];
        }

        return {
            eligible: isEligible,
            eligibility_check,
            eligibilityResponse: {
                ...eligibilityResponse,
                benefits: benefits
            },
            messages: messages || [],
            reason: !isEligible ? (
                eligibilityResponse?.ineligibilityReason ||
                'Insurance plan does not cover this service or eligibility could not be verified'
            ) : null,
            hasLimitedBenefitData: benefits.length === 0,
            parsedFromHTML: benefits.length > 0 && !eligibilityResponse?.benefits?.length
        };
    };

    // Enhanced insurance submission with coverage calculation
    const handleInsuranceSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Step 1: Create or get client first
            let client = await healthieAPI.getClientByEmail(bookingData.patient.email);

            if (!client) {
                client = await healthieAPI.createClient({
                    first_name: bookingData.patient.firstName,
                    last_name: bookingData.patient.lastName,
                    email: bookingData.patient.email,
                    phone: bookingData.patient.phone,
                    dob: bookingData.patient.dateOfBirth,
                    provider_id: bookingData.appointment.providerId.toString()
                });
            }

            const policyResult = await healthieAPI.createPolicy({
                userId: client.id,
                insurancePlanId: insuranceData.planId,
                memberId: insuranceData.memberId,
                groupNumber: insuranceData.groupNumber,
                holderDob: insuranceData.m_dob,
                holderFirstName: insuranceData.relationshipToInsured === 'self'
                    ? bookingData.patient.firstName
                    : insuranceData.holderFirstName,
                holderLastName: insuranceData.relationshipToInsured === 'self'
                    ? bookingData.patient.lastName
                    : insuranceData.holderLastName,
                holderRelationship: insuranceData.relationshipToInsured,
                holderAddress: insuranceData.holderAddress || bookingData.patient.address,
                isPrimary: true,
                effectiveStart: new Date().toISOString().split('T')[0]
            });

            // Step 2: Run eligibility check
            const eligibilityResult = await healthieAPI.runEligibilityCheck({
                policyId: policyResult.policies[0]?.id,
                serviceCodes: "claim_md"
            });

            // Step 3: Process eligibility response with enhanced error handling
            const eligibilityResponse = handleEligibilityResponse(eligibilityResult.data);

            if (eligibilityResponse.eligible) {
                // Calculate coverage using the enhanced calculator
                const coverage = CoverageCalculator.calculatePatientResponsibility(
                    bookingData.service?.pricing,
                    eligibilityResponse
                );

                setCoverageCalculation(coverage);

                // DEBUG: Log coverage calculation
                console.log('Coverage Calculation Results:', {
                    serviceAmount: bookingData.service?.pricing,
                    coverage: coverage,
                    eligibilityResponse: eligibilityResponse,
                    parsedFromHTML: eligibilityResponse.parsedFromHTML
                });

                setInsuranceData(prev => ({
                    ...prev,
                    clientId: client.id,
                    verified: true,
                    eligibilityStatus: eligibilityResponse.eligibility_check.status,
                    eligibilityId: eligibilityResponse.eligibility_check.id,
                    eligibilityResponse: eligibilityResponse.eligibilityResponse,
                    benefits: eligibilityResponse.eligibilityResponse?.benefits || [],
                    eligibilityMessages: eligibilityResponse.messages
                }));

                setCurrentSubStep(1); // Move to payment step

            } else {
                // Handle ineligible case
                setError(`${eligibilityResponse.messages}. You can proceed with self-pay or request a superbill for potential reimbursement.`);
                setInsuranceData(prev => ({
                    ...prev,
                    clientId: client.id,
                    verified: false,
                    billingType: 'self-pay',
                    eligibilityMessages: eligibilityResponse.messages,
                    eligibilityId: eligibilityResponse.eligibility_check?.id || null
                }));

                // Reset coverage calculation to self-pay
                setCoverageCalculation({
                    totalDue: bookingData.service?.pricing || 0,
                    insuranceCoverage: 0,
                    patientResponsibility: bookingData.service?.pricing || 0,
                    copay: 0,
                    deductible: 0,
                    coinsurance: 0,
                    coverageDetails: 'Not covered by insurance'
                });
            }

        } catch (error) {
            console.error('Insurance eligibility check error:', error);

            let errorMessage = 'Unable to verify insurance eligibility at this time.';
            if (error.message.includes('not found')) {
                errorMessage = 'Insurance plan or member information not found. Please verify your details.';
            } else if (error.message.includes('invalid')) {
                errorMessage = 'Invalid insurance information provided. Please check your details.';
            } else if (error.message.includes('network')) {
                errorMessage = 'Network error while verifying insurance. Please check your connection and try again.';
            }

            setError(`${errorMessage} You can proceed with self-pay or try again later.`);
            setInsuranceData(prev => ({
                ...prev,
                verified: false,
                billingType: 'self-pay'
            }));
        } finally {
            setLoading(false);
        }
    };

    // Calculate total amount based on coverage calculation
    const calculateTotalAmount = () => {
        if (isOhioLocation && insuranceData.verified && insuranceData.billingType === 'insurance') {
            return coverageCalculation.patientResponsibility;
        } else {
            return parseFloat((bookingData.service?.pricing || 0).toString().replace(/[^0-9.-]/g, '')) || 0;
        }
    };

    const totalAmount = calculateTotalAmount();

    // Format date helper
    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const handlePaymentSuccess = (paymentData) => {
        setPaymentSuccess(true);

        const appointmentData = {
            id: paymentData.appointmentId,
            patient: bookingData.patient,
            appointment: bookingData.appointment,
            service: bookingData.service,
            location: bookingData.location.location,
            payment: paymentData,
            insurance: insuranceData,
            coverage: coverageCalculation,
            claim: {
                status: paymentData.claimStatus,
                cms1500_id: paymentData.claimId,
                submission: paymentData.claimSubmission,
                submission_id: paymentData.claimSubmissionId,
                pcn: paymentData.pcn,
                integration_data: paymentData.claimSubmissionData
            },
            confirmationCode: 'CONF' + Math.random().toString(36).substr(2, 9).toUpperCase()
        };

        setTimeout(() => {
            onComplete({
                appointment: appointmentData,
                payment: paymentData,
                confirmation: appointmentData.confirmationCode
            });
        }, 5000);
    };

    const handlePaymentError = (errorMessage) => {
        setError(errorMessage);
    };

    // Enhanced Insurance Step
    const renderInsuranceStep = () => (
        <Card>
            <CardContent sx={ { p: 4 } }>
                <Box sx={ { display: 'flex', alignItems: 'center', mb: 3 } }>
                    <HealthAndSafety sx={ { fontSize: 24, color: theme.palette.primary.main, mr: 1 } } />
                    <Typography variant="h6" fontWeight={ 600 }>
                        Insurance Information & Real-Time Eligibility Verification
                    </Typography>
                </Box>

                { error && (
                    <Alert severity="error" sx={ { mb: 3 } } onClose={ () => setError(null) }>
                        { error }
                    </Alert>
                ) }

                {/* Show detailed eligibility messages if available */ }
                { insuranceData.eligibilityMessages?.length > 0 && (
                    <Alert severity="info" sx={ { mb: 3 } }>
                        <Typography variant="body2" fontWeight={ 600 }>Eligibility Verification Details:</Typography>
                        { insuranceData.eligibilityMessages.map((msg, index) => (
                            <Typography key={ index } variant="body2" sx={ { mt: 0.5 } }>
                                • { msg.field ? `${msg.field}: ` : '' }{ msg.message }
                            </Typography>
                        )) }
                    </Alert>
                ) }

                <form onSubmit={ handleInsuranceSubmit }>
                    <Grid container spacing={ 3 }>
                        <Grid item size={ { xs: 12 } }>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={ insuranceData.hasInsurance }
                                        onChange={ (e) => setInsuranceData(prev => ({
                                            ...prev,
                                            hasInsurance: e.target.checked,
                                            billingType: e.target.checked ? 'insurance' : 'self-pay'
                                        })) }
                                    />
                                }
                                label="I have insurance coverage"
                            />
                        </Grid>

                        { insuranceData.hasInsurance && (
                            <>
                                <Grid item size={ { xs: 12, md: 6 } }>
                                    <TextField
                                        select
                                        value={ insuranceData.planId }
                                        onChange={ (e) => setInsuranceData(prev => ({ ...prev, planId: e.target.value })) }
                                        fullWidth
                                        required
                                        label='Insurance Provider'
                                        size="small"
                                        helperText="Select your insurance plan from accepted providers"
                                    >
                                        { insurancePlans.map((plan) => (
                                            <MenuItem key={ plan.id } value={ plan.id }>
                                                { plan.name_and_id || plan.payer_name }
                                            </MenuItem>
                                        )) }
                                    </TextField>
                                </Grid>

                                <Grid item size={ { xs: 12, md: 6 } }>
                                    <TextField
                                        label="Member ID"
                                        value={ insuranceData.memberId }
                                        onChange={ (e) => setInsuranceData(prev => ({ ...prev, memberId: e.target.value })) }
                                        fullWidth
                                        required
                                        size="small"
                                        helperText="Found on your insurance card"
                                    />
                                </Grid>

                                <Grid item size={ { xs: 12, md: 6 } }>
                                    <TextField
                                        label="Group Number (Optional)"
                                        value={ insuranceData.groupNumber }
                                        onChange={ (e) => setInsuranceData(prev => ({ ...prev, groupNumber: e.target.value })) }
                                        fullWidth
                                        size="small"
                                        helperText="If applicable, found on your insurance card"
                                    />
                                </Grid>

                                <Grid item size={ { xs: 12, md: 6 } }>
                                    <TextField
                                        select
                                        label="Relationship to Insured"
                                        value={ insuranceData.relationshipToInsured }
                                        onChange={ (e) => setInsuranceData(prev => ({ ...prev, relationshipToInsured: e.target.value })) }
                                        fullWidth
                                        required
                                        size="small"
                                    >
                                        <MenuItem value="self">Self</MenuItem>
                                        <MenuItem value="spouse">Spouse</MenuItem>
                                        <MenuItem value="child">Child</MenuItem>
                                        <MenuItem value="other">Other</MenuItem>
                                    </TextField>
                                </Grid>

                                <Grid item size={ { xs: 12, md: 6 } } sx={ { alignContent: "center" } }>
                                    <InputLabel>Member Date of Birth:</InputLabel>
                                </Grid>
                                <Grid item size={ { xs: 12, md: 6 } }>
                                    <TextField
                                        type='date'
                                        placeholder='Date of Birth'
                                        value={ insuranceData.m_dob }
                                        onChange={ (e) => setInsuranceData(prev => ({ ...prev, m_dob: e.target.value })) }
                                        fullWidth
                                        required
                                        size="small"
                                        helperText="Member's date of birth as on insurance card"
                                    />
                                </Grid>

                                <Grid item xs={ 12 }>
                                    <Typography variant="subtitle2" fontWeight={ 600 } sx={ { mb: 1 } }>Billing Preference</Typography>
                                    <RadioGroup
                                        value={ insuranceData.billingType }
                                        onChange={ (e) => setInsuranceData(prev => ({
                                            ...prev,
                                            billingType: e.target.value,
                                            requestSuperbill: e.target.value === 'superbill'
                                        })) }
                                        row
                                    >
                                        <FormControlLabel value="insurance" control={ <Radio /> } label="Bill Insurance Directly" />
                                        {/* <FormControlLabel value="superbill" control={ <Radio /> } label="Pay Now & Get Superbill" /> */ }
                                        <FormControlLabel value="self-pay" control={ <Radio /> } label="Self-Pay Only" />
                                    </RadioGroup>
                                </Grid>

                                { insuranceData.billingType === 'superbill' && (
                                    <Grid item xs={ 12 }>
                                        <Alert severity="info">
                                            <Typography variant="body2" fontWeight={ 600 }>Superbill Option:</Typography>
                                            <Typography variant="body2">
                                                You'll pay the full amount now and receive a detailed Superbill via email to submit to your insurance for reimbursement.
                                                This option works well if you have out-of-network benefits or prefer to handle reimbursement yourself.
                                            </Typography>
                                        </Alert>
                                    </Grid>
                                ) }

                                { insuranceData.billingType === 'insurance' && (
                                    <Grid item xs={ 12 }>
                                        <Alert severity="info">
                                            <Typography variant="body2" fontWeight={ 600 }>Direct Insurance Billing:</Typography>
                                            <Typography variant="body2">
                                                We'll verify your coverage in real-time and bill your insurance directly. You'll only pay your copay amount if your plan is active and covers this service.
                                            </Typography>
                                        </Alert>
                                    </Grid>
                                ) }

                                <Grid item size={ { xs: 12 } }>
                                    <Button
                                        type="submit"
                                        variant="contained"
                                        size="large"
                                        disabled={ loading || !insuranceData.planId || !insuranceData.memberId || !insuranceData.m_dob }
                                        fullWidth
                                        sx={ { py: 1.5, color: "white" } }
                                    >
                                        { loading ? (
                                            <>
                                                <CircularProgress size={ 20 } sx={ { mr: 1, color: 'white' } } />
                                                Verifying Insurance Eligibility...
                                            </>
                                        ) : (
                                            <>
                                                <HealthAndSafety sx={ { mr: 1, fontSize: 20 } } />
                                                Verify Insurance Eligibility & Continue
                                            </>
                                        ) }
                                    </Button>
                                </Grid>
                            </>
                        ) }

                        { !insuranceData.hasInsurance && (
                            <Grid item size={ { xs: 12 } }>
                                <Button
                                    variant="contained"
                                    onClick={ () => setCurrentSubStep(1) }
                                    fullWidth
                                    sx={ { py: 1.5, color: "white" } }
                                >
                                    Continue to Payment
                                </Button>
                            </Grid>
                        ) }
                    </Grid>
                </form>
            </CardContent>
        </Card>
    );

    // Enhanced Payment Step
    const renderPaymentStep = () => (
        <Card sx={ { maxWidth: { xs: '100%', md: 800 }, mx: 'auto' } }>
            <CardContent sx={ { p: { xs: 2, sm: 3, md: 4 } } }>
                { !paymentSuccess ? (
                    <>
                        <Box sx={ { display: 'flex', alignItems: 'center', mb: 3 } }>
                            <CreditCard sx={ { fontSize: 24, color: theme.palette.primary.main, mr: 1 } } />
                            <Typography variant="h6" fontWeight={ 600 }>
                                Booking Confirmation & Payment
                            </Typography>
                        </Box>

                        {/* Enhanced insurance verification display */ }
                        { isOhioLocation && insuranceData.verified && insuranceData.billingType === 'insurance' && (
                            <Alert severity="success" sx={ { mb: 3 } }>
                                <Typography variant="body2" fontWeight={ 600 }>✓ Insurance Coverage Breakdown</Typography>
                                <Box sx={ { mt: 1 } }>
                                    <Typography variant="caption" display="block">
                                        <strong>Service Amount:</strong> { bookingData.service?.pricing || 0 }
                                    </Typography>
                                    <Typography variant="caption" display="block" color="success.main">
                                        <strong>Insurance Coverage:</strong> ${ coverageCalculation.insuranceCoverage }
                                    </Typography>
                                    <Typography variant="caption" display="block" color="primary.main">
                                        <strong>Your Responsibility:</strong> ${ coverageCalculation.patientResponsibility }
                                    </Typography>
                                    <Typography variant="caption" display="block" sx={ { mt: 0.5, fontStyle: 'italic' } }>
                                        { coverageCalculation.coverageDetails }
                                    </Typography>
                                    { coverageCalculation.source === 'html_parsed' && (
                                        <Typography variant="caption" display="block" sx={ { mt: 0.5, color: 'info.main' } }>
                                            ✓ Detailed benefits extracted from { insuranceData.eligibilityResponse?.benefits?.length || 0 } coverage categories
                                        </Typography>
                                    ) }
                                    { coverageCalculation.benefitCategory && (
                                        <Typography variant="caption" display="block" sx={ { mt: 0.5 } }>
                                            <strong>Primary Benefit:</strong> { coverageCalculation.benefitCategory }
                                        </Typography>
                                    ) }
                                    <Typography variant="caption" display="block" sx={ { mt: 1, fontStyle: 'italic' } }>
                                        { totalAmount === 0 ? 'No payment required - Claim will be submitted directly to your insurance.' : 'Claim will be submitted automatically to your insurance.' }
                                    </Typography>
                                </Box>
                            </Alert>
                        ) }


                        { isOhioLocation && insuranceData.requestSuperbill && (
                            <Alert severity="info" sx={ { mb: 3 } }>
                                <Typography variant="body2" fontWeight={ 600 }>Superbill Reimbursement</Typography>
                                <Typography variant="body2">
                                    A detailed Superbill will be emailed to you after payment for insurance reimbursement.
                                    This includes all necessary codes and provider information for your claim submission.
                                </Typography>
                            </Alert>
                        ) }

                        {/* Booking Summary */ }
                        <Box sx={ { mb: 3, p: { xs: 2, sm: 3 }, bgcolor: '#f8fafc', borderRadius: 2 } }>
                            <Typography variant="subtitle1" fontWeight={ 600 } gutterBottom>
                                Appointment Summary
                            </Typography>

                            <Grid container spacing={ 1 }>
                                <Grid item size={ { xs: 12, sm: 6 } }>
                                    <Typography variant="body2" color="textSecondary">Service:</Typography>
                                    <Typography variant="body2" fontWeight={ 500 }>{ bookingData.service?.name }</Typography>
                                </Grid>

                                { bookingData.appointment?.doctor && (
                                    <Grid item size={ { xs: 12, sm: 6 } }>
                                        <Typography variant="body2" color="textSecondary">Doctor:</Typography>
                                        <Typography variant="body2" fontWeight={ 500 }>{ bookingData.appointment.doctor }</Typography>
                                    </Grid>
                                ) }

                                <Grid item size={ { xs: 12, sm: 6 } }>
                                    <Typography variant="body2" color="textSecondary">Date & Time:</Typography>
                                    <Typography variant="body2" fontWeight={ 500 }>
                                        { formatDate(bookingData.appointment?.date) } at { bookingData.appointment?.startTime }
                                    </Typography>
                                </Grid>

                                <Grid item size={ { xs: 12, sm: 6 } }>
                                    <Typography variant="body2" color="textSecondary">Location:</Typography>
                                    <Typography variant="body2" fontWeight={ 500 }>{ bookingData.location?.location }</Typography>
                                </Grid>

                                <Grid item size={ { xs: 12, sm: 6 } }>
                                    <Typography variant="body2" color="textSecondary">Patient:</Typography>
                                    <Typography variant="body2" fontWeight={ 500 }>
                                        { bookingData.patient.firstName } { bookingData.patient.lastName }
                                    </Typography>
                                </Grid>

                                <Grid item size={ { xs: 12, sm: 6 } }>
                                    <Typography variant="body2" color="textSecondary">Email:</Typography>
                                    <Typography variant="body2" fontWeight={ 500 }>{ bookingData.patient.email }</Typography>
                                </Grid>

                                { isOhioLocation && insuranceData.hasInsurance && (
                                    <>
                                        <Grid item size={ { xs: 12, sm: 6 } }>
                                            <Typography variant="body2" color="textSecondary">Insurance:</Typography>
                                            <Typography variant="body2" fontWeight={ 500 }>
                                                { insurancePlans.find(p => p.id === insuranceData.planId)?.name_and_id || 'Selected' }
                                            </Typography>
                                        </Grid>
                                        <Grid item size={ { xs: 12, sm: 6 } }>
                                            <Typography variant="body2" color="textSecondary">Member ID:</Typography>
                                            <Typography variant="body2" fontWeight={ 500 }>
                                                { insuranceData.memberId }
                                            </Typography>
                                        </Grid>
                                    </>
                                ) }
                            </Grid>

                            <Divider sx={ { my: 2 } } />

                            { isOhioLocation && insuranceData.verified && insuranceData.billingType === 'insurance' && (
                                <>
                                    <Box sx={ { display: 'flex', justifyContent: 'space-between', mb: 1 } }>
                                        <Typography variant="body2">Service Fee:</Typography>
                                        <Typography variant="body2">{ bookingData.service?.pricing || 0 }</Typography>
                                    </Box>
                                    <Box sx={ { display: 'flex', justifyContent: 'space-between', mb: 1 } }>
                                        <Typography variant="body2" color="success.main">Insurance Coverage:</Typography>
                                        <Typography variant="body2" color="success.main">
                                            -${ coverageCalculation.insuranceCoverage }
                                        </Typography>
                                    </Box>
                                    <Divider sx={ { my: 1 } } />
                                </>
                            ) }

                            <Box sx={ { display: 'flex', justifyContent: 'space-between' } }>
                                <Typography variant="h6" fontWeight={ 600 }>
                                    { isOhioLocation && insuranceData.verified && insuranceData.billingType === 'insurance' ? 'Patient Responsibility:' : 'Total Amount:' }
                                </Typography>
                                <Typography variant="h6" fontWeight={ 600 } color="primary">
                                    ${ totalAmount }
                                </Typography>
                            </Box>
                        </Box>

                        { error && (
                            <Alert severity="error" sx={ { mb: 3 } } onClose={ () => setError(null) }>
                                { error }
                            </Alert>
                        ) }

                        {/* Payment Form */ }
                        <Box sx={ { border: '1px solid #e0e0e0', borderRadius: 2, p: { xs: 2, sm: 3 } } }>
                            <Typography variant="subtitle1" fontWeight={ 600 } gutterBottom>
                                { totalAmount > 0 || !isOhioLocation ? 'Payment Information' : 'Confirm Insurance Claim Submission' }
                            </Typography>

                            <Elements stripe={ stripePromise }>
                                <CardPaymentForm
                                    bookingData={ bookingData }
                                    totalAmount={ totalAmount }
                                    insuranceData={ insuranceData }
                                    isOhioLocation={ isOhioLocation }
                                    onSuccess={ handlePaymentSuccess }
                                    onError={ handlePaymentError }
                                    appointment_type={ appointment_type }
                                    coverageCalculation={ coverageCalculation }
                                />
                            </Elements>
                        </Box>
                    </>
                ) : (
                    // Enhanced Success State
                    <Box sx={ { textAlign: 'center', py: 4 } }>
                        <Box sx={ {
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            backgroundColor: 'success.light',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mx: 'auto',
                            mb: 3
                        } }>
                            <Typography variant="h4" color="success.main">✓</Typography>
                        </Box>
                        <Typography variant="h5" fontWeight={ 600 } color="success.main" gutterBottom>
                            { totalAmount > 0 ? 'Payment Successful!' : 'Appointment Confirmed!' }
                        </Typography>
                        <Typography variant="body1" color="textSecondary" sx={ { mb: 2 } }>
                            Your appointment has been confirmed and you'll receive a confirmation email shortly.
                        </Typography>
                        { isOhioLocation && insuranceData.verified && insuranceData.billingType === 'insurance' && (
                            <Typography variant="body2" color="textSecondary" sx={ { mt: 1 } }>
                                ✓ Insurance claim will be processed automatically through our ClaimMD integration.
                            </Typography>
                        ) }
                        { isOhioLocation && insuranceData.requestSuperbill && (
                            <Typography variant="body2" color="textSecondary" sx={ { mt: 1 } }>
                                ✓ Superbill has been emailed to you for insurance reimbursement.
                            </Typography>
                        ) }
                        <CircularProgress sx={ { mt: 2 } } size={ 24 } />
                        <Typography variant="caption" display="block" sx={ { mt: 1 } }>
                            Redirecting to confirmation...
                        </Typography>
                    </Box>
                ) }
            </CardContent>
        </Card>
    );

    return (
        <Box>
            {/* Sub-step indicator - only show if Ohio */ }
            { isOhioLocation && (
                <Box sx={ { mb: 4 } }>
                    <Stepper activeStep={ currentSubStep } alternativeLabel>
                        { ['Insurance Eligibility Verification', 'Payment Confirmation'].map((label) => (
                            <Step key={ label }>
                                <StepLabel>{ label }</StepLabel>
                            </Step>
                        )) }
                    </Stepper>
                </Box>
            ) }

            {/* Render current sub-step */ }
            { currentSubStep === 0 && isOhioLocation ? renderInsuranceStep() : renderPaymentStep() }
        </Box>
    );
};

export default PaymentFlow;