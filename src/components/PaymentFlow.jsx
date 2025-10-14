import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Card, CardContent, Button, Grid,
    Alert, CircularProgress, Divider, useTheme, TextField,
    FormControlLabel, Checkbox, MenuItem, Stepper, Step, StepLabel,
    RadioGroup, Radio, InputLabel, Chip, LinearProgress
} from '@mui/material';
import CreditCard from '@mui/icons-material/CreditCard';
import Lock from '@mui/icons-material/Lock';
import HealthAndSafety from '@mui/icons-material/HealthAndSafety';
import CheckCircle from '@mui/icons-material/CheckCircle';
import HourglassEmpty from '@mui/icons-material/HourglassEmpty';
import ErrorIcon from '@mui/icons-material/Error';
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

const HEALTHIE_STRIPE_KEY = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
const stripePromise = loadStripe(HEALTHIE_STRIPE_KEY);

const getDoctorName = (doctor) => {
    if (!doctor) return 'Doctor';
    if (typeof doctor === 'string') return doctor;
    if (typeof doctor === 'object' && doctor !== null) {
        return doctor.full_name || doctor.name || (doctor.last_name ? `Dr. ${doctor.last_name}` : 'Doctor');
    }
    return 'Doctor';
};

const ClaimStatusIndicator = ({ status, claimId, claimSubmission, pcn }) => {
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

            { claimSubmission?.integration && (
                <Typography variant="caption" color="textSecondary" sx={ { mt: 0.5 } }>
                    via { claimSubmission.integration.name || 'ClaimMD Integration' }
                </Typography>
            ) }
        </Box>
    );
};

// Insurance Claim Submission Component (No Card Required)
const InsuranceClaimSubmission = ({
    bookingData,
    totalAmount,
    insuranceData,
    onSuccess,
    onError
}) => {
    const [processing, setProcessing] = useState(false);
    const [claimStatus, setClaimStatus] = useState('preparing');
    const [claimId, setClaimId] = useState(null);
    const [claimSubmission, setClaimSubmission] = useState(null);
    const [pcn, setPcn] = useState(null);

    const submitClaimToClaimMD = async (cms1500Data) => {
        try {
            setClaimStatus('submitting');

            const claimSubmissionResult = await healthieAPI.submitClaim({
                cms1500_id: [cms1500Data.id],
                destination_integration: "claim_md"
            });

            if (claimSubmissionResult?.uploadCms1500sToIntegrations?.success_message) {
                const result = claimSubmissionResult.uploadCms1500sToIntegrations;

                setClaimSubmission({
                    id: cms1500Data.id,
                    cms1500_id: cms1500Data.id,
                    created_at: new Date().toISOString(),
                    status: result.cms1500s?.[0]?.status || 'submitted',
                    success_message: result.success_message,
                    messages: result.messages || []
                });

                setClaimStatus('submitted');

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setProcessing(true);

        try {
            // Use existing client
            const client = { id: insuranceData.clientId };

            let appointmentData = {
                user_id: client.id,
                appointment_type_id: bookingData.service.id || null,
                contact_type: bookingData.patient.contact_type || 'In Person',
                other_party_id: bookingData.appointment?.providerId,
                datetime: bookingData.appointment?.date
            };

            // Create CMS1500 and submit claim
            setClaimStatus('creating');

            const cms1500Variables = {
                patient: {
                    id: client.id,
                    full_legal_name_with_preferred: `${bookingData.patient.firstName} ${bookingData.patient.lastName}`,
                    location: {
                        line1: bookingData.patient.address || bookingData.location?.location || '',
                        city: bookingData.patient.city || bookingData.location?.location || '',
                        state: bookingData.patient.state || 'OH',
                        zip: bookingData.patient.zip || ''
                    },
                },
                dietitian: {
                    id: bookingData.appointment?.providerId,
                    qualifications: bookingData.appointment?.doctor?.qualifications || null,
                },
                service_location_id: bookingData.location?.id,
                amount_paid: totalAmount.toString(),
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
                client_sig_on_file: true,
                assignment_of_benefits: true,
                release_of_information: true,
                place_of_service: '11',
                type_of_service: 'medical',
                frequency_code: 'original'
            };

            const cms1500Result = await healthieAPI.createCMS1500(cms1500Variables);

            if (cms1500Result?.createCms1500?.cms1500) {
                const cms1500 = cms1500Result.createCms1500.cms1500;
                setClaimId(cms1500.id);
                setClaimStatus('created');

                const claimSubmissionResult = await submitClaimToClaimMD(cms1500);

                appointmentData.cms1500_id = cms1500.id;
                appointmentData.claim_submission_id = claimSubmissionResult?.id;
                appointmentData.claim_submission_data = claimSubmissionResult;
            }

            // Create appointment
            const appointment = await healthieAPI.createAppointment(appointmentData);

            // Success
            onSuccess({
                appointmentId: appointment?.id || 'pending',
                billingItemId: null,
                cms1500Id: appointmentData.cms1500_id,
                claimSubmissionId: appointmentData.claim_submission_id,
                claimSubmissionData: appointmentData.claim_submission_data,
                superbillId: null,
                amount: totalAmount,
                status: 'succeeded',
                clientId: client.id,
                claimStatus: claimStatus,
                claimId: claimId,
                claimSubmission: claimSubmission,
                pcn: pcn,
                insuranceClaim: true
            });

        } catch (error) {
            console.error('Insurance claim submission error:', error);
            onError(error.message || 'Claim submission failed');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <Box component="form" onSubmit={ handleSubmit }>
            <ClaimStatusIndicator
                status={ claimStatus }
                claimId={ claimId }
                claimSubmission={ claimSubmission }
                pcn={ pcn }
            />

            <Alert severity="info" sx={ { mb: 3 } }>
                <Typography variant="body2" fontWeight={ 600 }>Insurance Claim Submission</Typography>
                <Typography variant="body2">
                    Your insurance has been verified. Click the button below to create and submit your claim directly to your insurance provider through ClaimMD.
                </Typography>
            </Alert>

            <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={ processing }
                sx={ {
                    py: 1.5,
                    mt: 2,
                    backgroundColor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                        backgroundColor: 'primary.dark',
                    }
                } }
            >
                { processing ? (
                    <>
                        <CircularProgress size={ 20 } sx={ { mr: 1, color: 'white' } } />
                        { claimStatus === 'creating' && 'Creating CMS1500 Form...' }
                        { claimStatus === 'submitting' && 'Submitting to ClaimMD...' }
                        { claimStatus === 'processing' && 'Processing Claim...' }
                        { !['creating', 'submitting', 'processing'].includes(claimStatus) && 'Processing...' }
                    </>
                ) : (
                    <>
                        <Send sx={ { mr: 1, fontSize: 20 } } />
                        Submit Insurance Claim
                    </>
                ) }
            </Button>

            <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 2 } }>
                <Lock sx={ { fontSize: 14, color: 'text.secondary', mr: 0.5 } } />
                <Typography variant="caption" color="text.secondary">
                    Insurance claim processed securely through ClaimMD
                </Typography>
            </Box>
        </Box>
    );
};

// Card Payment Form Component (for self-pay and superbill)
const CardPaymentForm = ({
    bookingData,
    totalAmount,
    insuranceData,
    isOhioLocation,
    onSuccess,
    onError
}) => {
    const stripe = useStripe();
    const elements = useElements();
    const [processing, setProcessing] = useState(false);
    const [cardholderName, setCardholderName] = useState('');
    const [saveCard, setSaveCard] = useState(false);
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

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!stripe || !elements) {
            onError('Please fill in all fields');
            return;
        }

        setProcessing(true);

        try {
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

            const billingResult = await healthieAPI.createBillingItem({
                amount_paid: totalAmount.toString(),
                sender_id: client.id,
                stripe_customer_detail_id: cardStorageResult.id,
                stripe_idempotency_key: crypto.randomUUID(),
                should_charge: true
            });

            let appointmentData = {
                user_id: client.id,
                appointment_type_id: bookingData.service.id || null,
                contact_type: bookingData.patient.contact_type || 'In Person',
                other_party_id: bookingData.appointment?.providerId,
                datetime: bookingData.appointment?.date,
                billing_item_id: billingResult.id
            };

            // Handle superbill if requested
            if (isOhioLocation && insuranceData?.requestSuperbill) {
                const superbillData = {
                    patient_id: client.id,
                    patient_name: `${bookingData.patient.firstName} ${bookingData.patient.lastName}`,
                    patient_dob: insuranceData.m_dob || bookingData.patient.dateOfBirth || "2001-09-10",
                    dietitian_id: bookingData.appointment?.providerId,
                    provider_name: getDoctorName(bookingData.appointment?.doctor),
                    service_date: new Date(bookingData.appointment?.date).toISOString().split('T')[0],
                    amount_paid: totalAmount.toString(),
                    status: 'Not Sent',
                    icd_codes_super_bills: bookingData.icdCodes || [],
                    cpt_codes_super_bills: bookingData.cptCodes || [],
                    location: {
                        id: bookingData.location?.id,
                        line1: bookingData.location?.location || "",
                        state: bookingData.location?.state || "OH"
                    },
                    patient_location: {
                        country: "US",
                        line1: bookingData.patient.address || bookingData.location?.location || "",
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
            }

            const appointment = await healthieAPI.createAppointment(appointmentData);

            onSuccess({
                appointmentId: appointment?.id || 'pending',
                billingItemId: billingResult?.id,
                superbillId: appointmentData.superbill_id,
                amount: totalAmount,
                status: 'succeeded',
                clientId: client.id,
                insuranceClaim: false
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
            <Grid container spacing={ 2 }>
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

                <Grid item size={ { xs: 12 } }>
                    <Button
                        type="submit"
                        variant="contained"
                        fullWidth
                        disabled={ !stripe || processing }
                        sx={ {
                            py: 1.5,
                            mt: 2,
                            backgroundColor: 'primary.main',
                            color: 'white',
                            '&:hover': {
                                backgroundColor: 'primary.dark',
                            }
                        } }
                    >
                        { processing ? (
                            <>
                                <CircularProgress size={ 20 } sx={ { mr: 1, color: 'white' } } />
                                Processing Payment...
                            </>
                        ) : (
                            <>
                                <Lock sx={ { mr: 1, fontSize: 20 } } />
                                Pay ${ totalAmount }
                            </>
                        ) }
                    </Button>
                </Grid>
            </Grid>

            <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 2 } }>
                <Lock sx={ { fontSize: 14, color: 'text.secondary', mr: 0.5 } } />
                <Typography variant="caption" color="text.secondary">
                    Secured by Stripe & HIPAA-compliant processing
                </Typography>
            </Box>
        </Box>
    );
};

const PaymentFlow = ({ bookingData, onComplete }) => {
    const isOhioLocation = bookingData.location?.code === "OH" || bookingData.location?.location === "Ohio";

    const [currentSubStep, setCurrentSubStep] = useState(isOhioLocation ? 0 : 1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [appointment_type, setAppointmenttype] = useState([]);
    const [paymentSuccess, setPaymentSuccess] = useState(false);

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
        eligibilityResultMessage: null,
        eligibilityId: null,
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
    }, [bookingData, isOhioLocation]);

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

    const handleEligibilityResponse = (eligibilityResult) => {
        if (!eligibilityResult?.runEligibilityCheck?.eligibility_check) {
            throw new Error('No eligibility check response received from insurance system');
        }

        const { eligibility_check, messages } = eligibilityResult.runEligibilityCheck;

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

        const eligibilityResponse = eligibility_check;
        const isEligible = eligibilityResponse ? true : false;

        return {
            eligible: isEligible,
            eligibility_check,
            eligibilityResponse: eligibilityResponse,
            messages: messages || [],
            reason: !isEligible ? (
                eligibilityResponse?.ineligibilityReason ||
                'Insurance plan does not cover this service or eligibility could not be verified'
            ) : null
        };
    };

    const handleInsuranceSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        let eligibilityResultMessages = null;

        try {
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

            const eligibilityResult = await healthieAPI.runEligibilityCheck({
                policyId: policyResult.policies[policyResult.policies?.length - 1]?.id,
                serviceCodes: "claim_md"
            });

            if (eligibilityResult.data.runEligibilityCheck.messages != null) {
                eligibilityResultMessages = eligibilityResult.data.runEligibilityCheck;
            }

            const eligibilityResponse = handleEligibilityResponse(eligibilityResult.data);

            if (eligibilityResponse.eligible) {
                setInsuranceData(prev => ({
                    ...prev,
                    clientId: client.id,
                    verified: true,
                    eligibilityStatus: eligibilityResponse.eligibility_check.status,
                    eligibilityId: eligibilityResponse.eligibility_check.id,
                    eligibilityResponse: eligibilityResponse.eligibilityResponse,
                    eligibilityMessages: eligibilityResponse.messages
                }));

                setCurrentSubStep(1);

            } else {
                setError(`${eligibilityResponse?.reason || 'Unable to verify insurance eligibility at this time'}. You can proceed with self-pay.`);
                setInsuranceData(prev => ({
                    ...prev,
                    clientId: client.id,
                    verified: false,
                    billingType: 'self-pay',
                    hasInsurance: false,
                    eligibilityMessages: eligibilityResponse.messages,
                    eligibilityId: eligibilityResponse.eligibility_check?.id || null
                }));
            }

        } catch (error) {
            console.error('Insurance eligibility check error:', error);

            let errorMessage = eligibilityResultMessages?.messages[0]?.message || error.message || 'Unable to verify insurance eligibility at this time.';
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

    const calculateTotalAmount = () => {
        return parseFloat((bookingData.service?.pricing || 0).toString().replace(/[^0-9.-]/g, '')) || 0;
    };

    const totalAmount = calculateTotalAmount();

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
            payment: paymentData.payment,
            insurance: insuranceData,
            // claim: paymentData.insuranceClaim ? {
            //     status: paymentData.claimStatus,
            //     cms1500_id: paymentData.claimId,
            //     submission: paymentData.claimSubmission,
            //     submission_id: paymentData.claimSubmissionId,
            //     pcn: paymentData.pcn,
            //     integration_data: paymentData.claimSubmissionData
            // } : null,
            confirmationCode: 'CONF' + Math.random().toString(36).substr(2, 9).toUpperCase()
        };
        console.log("appointmentData", appointmentData);

        setTimeout(() => {
            onComplete({
                appointment: appointmentData,
                payment: paymentData,
                confirmation: appointmentData.confirmationCode
            });
        }, 3000);
    };

    const handlePaymentError = (errorMessage) => {
        setError(errorMessage);
    };

    const renderInsuranceStep = () => (
        <Card>
            <CardContent sx={ { p: 4 } }>
                <Box sx={ { display: 'flex', alignItems: 'center', mb: 3 } }>
                    <HealthAndSafety sx={ { fontSize: 24, color: theme.palette.primary.main, mr: 1 } } />
                    <Typography variant="h6" fontWeight={ 600 }>
                        Insurance Eligibility Verification
                    </Typography>
                </Box>

                { error && (
                    <Alert severity="error" sx={ { mb: 3 } } onClose={ () => setError(null) }>
                        { error }
                    </Alert>
                ) }

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
                                        <FormControlLabel value="self-pay" control={ <Radio /> } label="Self-Pay Only" />
                                    </RadioGroup>
                                </Grid>

                                { insuranceData.billingType === 'insurance' && (
                                    <Grid item xs={ 12 }>
                                        <Alert severity="info">
                                            <Typography variant="body2" fontWeight={ 600 }>Direct Insurance Billing:</Typography>
                                            <Typography variant="body2">
                                                We'll verify your coverage in real-time and bill your insurance directly if your plan is active and covers this service.
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

    const renderPaymentStep = () => (
        <Card sx={ { maxWidth: { xs: '100%', md: 800 }, mx: 'auto' } }>
            <CardContent sx={ { p: { xs: 2, sm: 3, md: 4 } } }>
                { !paymentSuccess ? (
                    <>
                        <Box sx={ { display: 'flex', alignItems: 'center', mb: 3 } }>
                            <CreditCard sx={ { fontSize: 24, color: theme.palette.primary.main, mr: 1 } } />
                            <Typography variant="h6" fontWeight={ 600 }>
                                { isOhioLocation && insuranceData.verified && insuranceData.billingType === 'insurance'
                                    ? 'Booking Confirmation & Insurance Claim'
                                    : 'Booking Confirmation & Payment' }
                            </Typography>
                        </Box>

                        { isOhioLocation && insuranceData.verified && insuranceData.billingType === 'insurance' && (
                            <Alert severity="success" sx={ { mb: 3 } }>
                                <Typography variant="body2" fontWeight={ 600 }>✓ Insurance Verified</Typography>
                                <Typography variant="body2">
                                    Your insurance is active and eligible. The claim will be submitted directly to your insurance provider.
                                </Typography>
                            </Alert>
                        ) }

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
                                        <Typography variant="body2" fontWeight={ 500 }>
                                            { getDoctorName(bookingData.appointment?.doctor) }
                                        </Typography>
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

                            <Box sx={ { display: 'flex', justifyContent: 'space-between' } }>
                                <Typography variant="h6" fontWeight={ 600 }>
                                    Total Amount:
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

                        <Box sx={ { border: '1px solid #e0e0e0', borderRadius: 2, p: { xs: 2, sm: 3 } } }>
                            <Typography variant="subtitle1" fontWeight={ 600 } gutterBottom>
                                { isOhioLocation && insuranceData.verified && insuranceData.billingType === 'insurance'
                                    ? 'Insurance Claim Submission'
                                    : 'Payment Information' }
                            </Typography>

                            { isOhioLocation && insuranceData.verified && insuranceData.billingType === 'insurance' ? (
                                <InsuranceClaimSubmission
                                    bookingData={ bookingData }
                                    totalAmount={ totalAmount }
                                    insuranceData={ insuranceData }
                                    onSuccess={ handlePaymentSuccess }
                                    onError={ handlePaymentError }
                                />
                            ) : (
                                <Elements stripe={ stripePromise }>
                                    <CardPaymentForm
                                        bookingData={ bookingData }
                                        totalAmount={ totalAmount }
                                        insuranceData={ insuranceData }
                                        isOhioLocation={ isOhioLocation }
                                        onSuccess={ handlePaymentSuccess }
                                        onError={ handlePaymentError }
                                    />
                                </Elements>
                            ) }
                        </Box>
                    </>
                ) : (
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
                            { isOhioLocation && insuranceData.verified && insuranceData.billingType === 'insurance'
                                ? 'Appointment Confirmed!'
                                : 'Payment Successful!' }
                        </Typography>
                        <Typography variant="body1" color="textSecondary" sx={ { mb: 2 } }>
                            Your appointment has been confirmed and you'll receive a confirmation email shortly.
                        </Typography>
                        { isOhioLocation && insuranceData.verified && insuranceData.billingType === 'insurance' && (
                            <Typography variant="body2" color="textSecondary" sx={ { mt: 1 } }>
                                ✓ Insurance claim will be processed automatically through our ClaimMD integration.
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
            { isOhioLocation && (
                <Box sx={ { mb: 4 } }>
                    <Stepper activeStep={ currentSubStep } alternativeLabel>
                        { ['Insurance Eligibility Verification',
                            insuranceData.verified && insuranceData.billingType === 'insurance'
                                ? 'Claim Submission'
                                : 'Payment Confirmation'
                        ].map((label) => (
                            <Step key={ label }>
                                <StepLabel>{ label }</StepLabel>
                            </Step>
                        )) }
                    </Stepper>
                </Box>
            ) }

            { currentSubStep === 0 && isOhioLocation ? renderInsuranceStep() : renderPaymentStep() }
        </Box>
    );
};

export default PaymentFlow;