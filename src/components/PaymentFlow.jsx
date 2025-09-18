import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Card, CardContent, Button, Grid,
    Alert, CircularProgress, Divider, useTheme, TextField,
    FormControlLabel, Checkbox, MenuItem, Stepper, Step, StepLabel,
    RadioGroup, Radio,
    InputLabel
} from '@mui/material';
import { CreditCard, Lock, Security, HealthAndSafety, Label } from '@mui/icons-material';
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
import { logDOM } from '@testing-library/dom';

// Initialize Stripe with Healthie's official keys
const HEALTHIE_STRIPE_KEY = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;

const stripePromise = loadStripe(HEALTHIE_STRIPE_KEY);

// Card Payment Form Component - Enhanced for Insurance
const CardPaymentForm = ({ bookingData, totalAmount, insuranceData, isOhioLocation, onSuccess, onError, appointment_type }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [processing, setProcessing] = useState(false);
    const [cardholderName, setCardholderName] = useState('');
    const [saveCard, setSaveCard] = useState(false);
    const theme = useTheme();
    console.log("totalAmount", totalAmount);

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
            // Step 1: Use existing client or create if needed
            let client;
            if (insuranceData.clientId) {
                // Client already created during eligibility check
                client = { id: insuranceData.clientId };
            } else {
                // Create or get client
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

            // Step 2: Handle payment based on billing type
            let billingResult = null;
            let appointmentData = {
                user_id: client.id,
                appointment_type_id: bookingData.service.id || null,
                contact_type: bookingData.patient.contact_type || 'In Person',
                other_party_id: bookingData.appointment?.providerId,
                datetime: bookingData.appointment?.date
            };

            if (isOhioLocation && insuranceData?.verified && insuranceData?.billingType === 'insurance') {
                // Create CMS1500 claim for insurance billing
                const variables = {
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
                    amount_paid: bookingData.service.pricing,
                    cms1500_policies: [
                        {
                            policy: {
                                insurance_plan_id: insuranceData.planId,
                                num: insuranceData.memberId,
                                group_num: insuranceData.groupNumber,
                                payer_location: {
                                    state: "OH"
                                },
                                user_id: client.id,
                                holder_relationship: insuranceData.relationshipToInsured || 'self',
                                holder_dob: insuranceData.m_dob || "1998-3-22",
                                eligibility_check_id: insuranceData.eligibilityId // Link to eligibility check
                            }
                        }
                    ],
                    icd_codes_cms1500s: bookingData.icdCodes || [],
                    cpt_codes_cms1500s: bookingData.cptCodes || [],
                    client_sig_on_file: true,
                };

                const cms1500Result = await healthieAPI.createCMS1500(variables);

                if (cms1500Result?.createCms1500?.cms1500) {
                    // If there's a copay, charge it
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
                            notes: 'Insurance copay'
                        });

                        appointmentData.billing_item_id = billingResult.id;
                    }

                    appointmentData.cms1500_id = cms1500Result.createCms1500.cms1500.id;
                }

            } else if (isOhioLocation && insuranceData?.requestSuperbill) {
                // Process payment first, then create superbill
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
                    referrer_npi: null,
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
                    },
                    prov_email: "",
                    prov_phone: "",
                    tax_id: "",
                    npi: "",
                    license_num: "",
                };

                const superbillResult = await healthieAPI.createSuperbill(superbillData);

                // Email superbill to patient
                if (superbillResult?.createSuperBill?.superBill) {
                    await healthieAPI.updateSuperbill(
                        superbillResult.createSuperBill.superBill.id,
                        { status: 'Sent', should_email_to_client: true }
                    );
                    appointmentData.superbill_id = superbillResult.createSuperBill.superBill.id;
                }

            } else {
                // Standard self-pay payment
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
                superbillId: appointmentData.superbill_id,
                amount: totalAmount,
                status: 'succeeded',
                clientId: client.id,
                insuranceClaim: isOhioLocation && insuranceData?.verified && insuranceData?.billingType === 'insurance'
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
                                Processing...
                            </>
                        ) : totalAmount > 0 || !isOhioLocation ? (
                            <>
                                <Lock sx={ { mr: 1, fontSize: 20 } } />
                                Pay ${ totalAmount }
                            </>
                        ) : (
                            <>
                                <HealthAndSafety sx={ { mr: 1, fontSize: 20 } } />
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
                    { totalAmount > 0 && !isOhioLocation ? 'Secured by Stripe' : 'Insurance claim will be processed securely' }
                </Typography>
            </Box>
        </Box>
    );
};

// Main PaymentFlow Component - Enhanced with Insurance Eligibility Verification
const PaymentFlow = ({ bookingData, onComplete }) => {
    // Check if Ohio location for insurance
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
        copayAmount: null,
        coverageAmount: null,
        m_dob: null,
        eligibilityId: null,
        benefits: null,
        eligibilityMessages: [],
        clientId: null,           // Store client ID from eligibility check
        deductible: null,         // Store deductible info
        coinsurance: null,        // Store coinsurance info
        coveragePercentage: null, // Store coverage percentage
        eligibilityStatus: null   // Store overall eligibility status
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

    // Enhanced service code mapping for better CPT code accuracy
    const getServiceCodeForAppointment = (appointmentType, serviceType) => {
        const serviceMapping = {
            'nutrition-consultation': '97802',     // Medical nutrition therapy, initial
            'nutrition-followup': '97803',         // Medical nutrition therapy, re-assessment  
            'nutrition': '97802',
            'dietitian': '97802',
            'group-nutrition': '97804',            // Medical nutrition therapy, group
            'therapy-session': '90834',            // Psychotherapy, 45 minutes
            'therapy': '90834',
            'medical-consultation': '99213',        // Office visit, established patient
            'medical': '99213',
            'wellness': '99401',                   // Preventive counseling
            'weight-management': '97802'           // Medical nutrition therapy
        };

        return serviceMapping[appointmentType?.toLowerCase()] ||
            serviceMapping[serviceType?.toLowerCase()] ||
            '97802'; // Default to nutrition therapy
    };

    // Enhanced error handling for eligibility responses
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

        if (!eligibility_check?.eligibilityResponse?.eligible) {
            return {
                eligible: false,
                reason: eligibility_check?.eligibilityResponse?.ineligibilityReason ||
                    'Insurance plan does not cover this service or eligibility could not be verified',
                messages: messages || [],
                eligibility_check
            };
        }

        return {
            eligible: true,
            eligibility_check,
            messages: messages || []
        };
    };

    // UPDATED: Enhanced insurance submission with complete client creation + eligibility flow
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
                holderDob: insuranceData.m_dob,  // This is required!
                holderFirstName: insuranceData.relationshipToInsured === 'self'
                    ? bookingData.patient.firstName
                    : insuranceData.holderFirstName,
                holderLastName: insuranceData.relationshipToInsured === 'self'
                    ? bookingData.patient.lastName
                    : insuranceData.holderLastName,
                holderRelationship: insuranceData.relationshipToInsured,
                holderAddress: insuranceData.holderAddress || bookingData.patient.address,
                isPrimary: true,
                effectiveStart: new Date().toISOString().split('T')[0] // Today's date
            });

            // Step 2: Run eligibility check with client ID and proper service codes
            const serviceCodes = getServiceCodeForAppointment(
                bookingData.service?.type,
                bookingData.service?.name
            );
            const eligibilityResult = await healthieAPI.runEligibilityCheck({
                policyId: policyResult.policies[0]?.id,
                serviceCodes: "claim_md"
            });

            // Step 3: Process eligibility response with enhanced error handling
            const eligibilityResponse = handleEligibilityResponse(eligibilityResult.data);

            console.log("eligibilityResponse", eligibilityResponse);
            if (eligibilityResponse.eligible) {
                const eligibilityCheck = eligibilityResponse.eligibilityCheck;
                const response = eligibilityCheck.eligibilityResponse;

                // Extract comprehensive benefit information
                const benefits = response.benefits || [];
                const primaryBenefit = benefits.find(b =>
                    b.category === serviceCodes ||
                    b.category === 'OUTPATIENT' ||
                    b.category === 'GENERAL'
                ) || benefits[0];

                setInsuranceData(prev => ({
                    ...prev,
                    clientId: client.id,
                    verified: true,
                    eligibilityStatus: eligibilityCheck.status,
                    eligibilityId: eligibilityCheck.id,
                    copayAmount: response.copay || primaryBenefit?.copay || 0,
                    deductible: response.deductible || primaryBenefit?.deductible || 0,
                    coinsurance: response.coinsurance || primaryBenefit?.coinsurance || 0,
                    coveragePercentage: primaryBenefit?.coveragePercentage || null,
                    coverageAmount: bookingData.service?.pricing - (response.copay || primaryBenefit?.copay || 0),
                    benefits: benefits,
                    eligibilityMessages: eligibilityResponse.messages
                }));

                setCurrentSubStep(1); // Move to payment step

            } else {
                // Handle ineligible case
                setError(`${eligibilityResponse.reason}. You can proceed with self-pay or request a superbill for potential reimbursement.`);
                setInsuranceData(prev => ({
                    ...prev,
                    clientId: client.id,
                    verified: false,
                    billingType: 'self-pay',
                    eligibilityMessages: eligibilityResponse.messages,
                    eligibilityId: eligibilityResponse.eligibilityCheck?.id || null
                }));
            }

        } catch (error) {
            console.error('Insurance eligibility check error:', error);

            // Provide more specific error messages
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

    // Calculate total amount based on insurance (Ohio only) - Enhanced calculation
    const calculateTotalAmount = () => {
        let amount;
        if (isOhioLocation && insuranceData.verified && insuranceData.billingType === 'insurance') {
            // For insurance billing, patient pays copay
            amount = insuranceData.copayAmount || 0;
        } else {
            // For self-pay or superbill, patient pays full amount
            amount = bookingData.service?.pricing || 0;
        }
        // Ensure numeric output and handle string prices
        return parseFloat((amount.toString()).replace(/[^0-9.-]/g, '')) || 0;
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

    // UPDATED: Enhanced Insurance Step with comprehensive eligibility feedback
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
                                        <FormControlLabel value="superbill" control={ <Radio /> } label="Pay Now & Get Superbill" />
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

    // UPDATED: Enhanced Payment Step with detailed eligibility results and coverage breakdown
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

                        {/* UPDATED: Comprehensive insurance verification display */ }
                        { isOhioLocation && insuranceData.verified && insuranceData.billingType === 'insurance' && (
                            <Alert severity="success" sx={ { mb: 3 } }>
                                <Typography variant="body2" fontWeight={ 600 }>✓ Insurance Eligibility Verified Successfully!</Typography>
                                <Box sx={ { mt: 1 } }>
                                    <Typography variant="caption" display="block">
                                        <strong>Your copay:</strong> ${ insuranceData.copayAmount || 0 }
                                    </Typography>
                                    { insuranceData.deductible > 0 && (
                                        <Typography variant="caption" display="block">
                                            <strong>Deductible:</strong> ${ insuranceData.deductible }
                                        </Typography>
                                    ) }
                                    { insuranceData.coinsurance > 0 && (
                                        <Typography variant="caption" display="block">
                                            <strong>Coinsurance:</strong> { insuranceData.coinsurance }%
                                        </Typography>
                                    ) }
                                    { insuranceData.benefits?.map((benefit, index) => (
                                        <Typography key={ index } variant="caption" display="block" sx={ { mt: 0.5 } }>
                                            <strong>{ benefit.category }:</strong>
                                            { benefit.coveragePercentage && ` ${benefit.coveragePercentage}% covered` }
                                            { benefit.copay && ` | Copay: $${benefit.copay}` }
                                            { benefit.deductible && ` | Deductible: $${benefit.deductible}` }
                                        </Typography>
                                    )) }
                                    <Typography variant="caption" display="block" sx={ { mt: 1, fontStyle: 'italic' } }>
                                        Claim will be submitted automatically to your insurance.
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
                                        <Typography variant="body2">${ bookingData.service?.pricing || 0 }</Typography>
                                    </Box>
                                    <Box sx={ { display: 'flex', justifyContent: 'space-between', mb: 1 } }>
                                        <Typography variant="body2" color="success.main">Insurance Coverage:</Typography>
                                        <Typography variant="body2" color="success.main">
                                            -${ insuranceData.coverageAmount || (bookingData.service?.pricing - (insuranceData.copayAmount || 0)) }
                                        </Typography>
                                    </Box>
                                    <Divider sx={ { my: 1 } } />
                                </>
                            ) }

                            <Box sx={ { display: 'flex', justifyContent: 'space-between' } }>
                                <Typography variant="h6" fontWeight={ 600 }>
                                    { isOhioLocation && insuranceData.verified && insuranceData.billingType === 'insurance' ? 'Copay Due:' : 'Total Amount:' }
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

    // Sub-step labels - only include insurance step for Ohio
    const subStepLabels = isOhioLocation
        ? ['Insurance Eligibility Verification', 'Payment Confirmation']
        : ['Payment Confirmation'];

    return (
        <Box>
            {/* Sub-step indicator - only show if Ohio */ }
            { isOhioLocation && (
                <Box sx={ { mb: 4 } }>
                    <Stepper activeStep={ currentSubStep } alternativeLabel>
                        { subStepLabels.map((label) => (
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