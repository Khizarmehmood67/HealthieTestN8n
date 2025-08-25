import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Card, CardContent, TextField, Button, Grid,
    Alert, Stepper, Step, StepLabel, Divider, CircularProgress,
    useTheme, MenuItem, Radio, RadioGroup, FormControlLabel, Dialog,
    DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { Security, Person, CreditCard } from '@mui/icons-material';
import { loadStripe } from '@stripe/stripe-js';
import {
    Elements,
    CardElement,
    useStripe,
    useElements
} from '@stripe/react-stripe-js';
import healthieAPI from '../services/healthieAPI';

// Initialize Stripe with your publishable key
const stripePromise = loadStripe('pk_test_51S03pxPJX74EYF1eiChgHRtZ9BVMHgRGsgpNXOV2ZdZn7x2VC71Twle1OFDYy3zxWucGJcnnY1HLc8gNFyr9fU1w00MgDiE1L9');

// Card Payment Component
const CardPaymentForm = ({ amount, patientData, bookingData, onSuccess, onCancel }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [saveCard, setSaveCard] = useState(true);

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setProcessing(true);
        setError(null);

        try {
            // Step 1: Create a payment method using Stripe
            const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
                type: 'card',
                card: elements.getElement(CardElement),
                billing_details: {
                    name: `${patientData.firstName} ${patientData.lastName}`,
                    email: patientData.email,
                    phone: patientData.phone
                }
            });

            if (stripeError) {
                throw new Error(stripeError.message);
            }

            // Step 2: Create or get the client/patient in Healthie
            let clientId;
            const existingClient = await healthieAPI.getClientByEmail(patientData.email);

            if (!existingClient) {
                const newClient = await healthieAPI.createClient({
                    first_name: patientData.firstName,
                    last_name: patientData.lastName,
                    email: patientData.email,
                    phone: patientData.phone,
                });
                clientId = newClient.id;
            } else {
                clientId = existingClient.id;
            }

            // Step 3: Store the card in Healthie to get stripe_customer_detail_id
            const cardStorageResult = await healthieAPI.storeCard({
                client_id: clientId,
                stripe_payment_method_id: paymentMethod.id,
                is_default: saveCard
            });

            if (!cardStorageResult || !cardStorageResult.id) {
                throw new Error('Failed to store payment method');
            }

            // Step 4: Create a requested payment for tracking
            // Note: You might want to pass provider_id as recipient_id depending on your workflow
            const requestedPayment = await healthieAPI.createRequestedPayment({
                recipient_id: clientId, // or use provider_id if payment goes to provider
                sender_id: clientId,
                amount: amount.toString(),
                service_name: bookingData.service?.name || 'Appointment',
                appointment_id: bookingData.appointment?.id,
                offering_id: bookingData.service?.id,
                status: "Pending"
            });

            const requestedPaymentId = requestedPayment.id;

            // Step 5: Charge the patient using createBillingItem
            const billingResult = await healthieAPI.createBillingItem({
                amount_paid: amount.toString(),
                sender_id: clientId,
                requested_payment_id: requestedPaymentId,
                stripe_idempotency_key: crypto.randomUUID(),
                stripe_customer_detail_id: cardStorageResult.id,
                should_charge: true
            });

            if (billingResult.messages && billingResult.messages.length > 0) {
                // Handle any error messages from the billing item creation
                const errorMessages = billingResult.messages.map(m => m.message).join(', ');
                throw new Error(errorMessages);
            }

            if (!billingResult.billingItem || !billingResult.billingItem.id) {
                throw new Error('Payment processing failed');
            }

            // Success! Payment has been charged
            onSuccess({
                billingItemId: billingResult.billingItem.id,
                stripeCustomerDetailId: cardStorageResult.id,
                paymentMethodId: paymentMethod.id,
                cardSaved: saveCard
            });

        } catch (err) {
            console.error('Payment error:', err);
            setError(err.message || 'Payment failed. Please try again.');
        } finally {
            setProcessing(false);
        }
    };

    const cardElementOptions = {
        style: {
            base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                    color: '#aab7c4',
                },
                fontFamily: 'Roboto, sans-serif',
            },
            invalid: {
                color: '#9e2146',
            },
        },
    };

    return (
        <Box component="form" onSubmit={ handleSubmit }>
            <Typography variant="h6" gutterBottom>
                Payment Details
            </Typography>

            <Box sx={ {
                border: '1px solid #e0e0e0',
                borderRadius: 1,
                p: 2,
                mb: 2,
                backgroundColor: '#fafafa'
            } }>
                <CardElement options={ cardElementOptions } />
            </Box>

            <FormControlLabel
                control={
                    <input
                        type="checkbox"
                        checked={ saveCard }
                        onChange={ (e) => setSaveCard(e.target.checked) }
                    />
                }
                label="Save card for future appointments"
                sx={ { mb: 2 } }
            />

            { error && (
                <Alert severity="error" sx={ { mb: 2 } }>
                    { error }
                </Alert>
            ) }

            <Box sx={ { display: 'flex', gap: 2, mt: 3 } }>
                <Button
                    variant="outlined"
                    onClick={ onCancel }
                    disabled={ processing }
                    fullWidth
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    variant="contained"
                    disabled={ !stripe || processing }
                    fullWidth
                    sx={ { color: 'white' } }
                >
                    { processing ? (
                        <>
                            <CircularProgress size={ 20 } sx={ { mr: 1, color: 'white' } } />
                            Processing...
                        </>
                    ) : (
                        `Pay $${amount}`
                    ) }
                </Button>
            </Box>

            <Typography variant="caption" color="text.secondary" sx={ { display: 'block', textAlign: 'center', mt: 2 } }>
                Your payment information is encrypted and secure
            </Typography>
        </Box>
    );
};

// Main PaymentFlow Component
const PaymentFlow = ({ bookingData, onComplete }) => {
    const [currentSubStep, setCurrentSubStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showCardDialog, setShowCardDialog] = useState(false);
    const theme = useTheme();

    const [insuranceData, setInsuranceData] = useState({
        provider: '',
        member_id: '',
        group_number: ''
    });

    const [patientData, setPatientData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        appointment_type_id: '',
        contact_type: 'In Person'
    });

    const [insuranceResult, setInsuranceResult] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const subStepLabels = ['Insurance Verification', 'Patient Information', 'Payment Confirmation'];
    const [insurancePlans, setInsurancePlans] = useState([]);
    const [allClients, setAllClients] = useState([]);
    const [appointmentType, setAppointmentType] = useState([]);

    useEffect(() => {
        fetchInsurancePlans();
        fetchAppointmentTypes();
        fetchClient();
    }, []);

    const fetchAppointmentTypes = async () => {
        const types = await healthieAPI.getAppointmentTypes();
        if (types) {
            setAppointmentType(types);
        }
    };

    const fetchInsurancePlans = async () => {
        const plans = await healthieAPI.getInsurancePlans({ is_accepted: true });
        if (plans.data) {
            setInsurancePlans(plans.data.insurancePlans);
        }
    };

    const fetchClient = async () => {
        const client = await healthieAPI.getClient();
        if (client) {
            setAllClients(client);
        }
    };

    // Handle insurance verification
    const handleInsuranceSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const result = await healthieAPI.verifyInsurance({
                insurancePlanIds: [insuranceData.provider],
            });

            if (result.verified) {
                setInsuranceResult(result);
                setCurrentSubStep(1);
            } else {
                setError('Insurance verification failed: ' + result.message);
            }
        } catch (error) {
            setError('Insurance verification failed: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Handle patient information submission
    const handlePatientSubmit = async (e) => {
        e.preventDefault();
        setCurrentSubStep(2);
    };

    // Handle card payment
    const handleCardPayment = () => {
        setShowCardDialog(true);
    };

    // Handle successful card payment
    const handleCardPaymentSuccess = async (paymentData) => {
        setShowCardDialog(false);
        setLoading(true);
        setError(null);

        try {
            // Create the appointment now that payment is confirmed
            const getCLient = allClients.find(client => client.email === patientData.email);
            let createClient = {};

            if (!getCLient) {
                createClient = await healthieAPI.createClient({
                    first_name: patientData.firstName,
                    last_name: patientData.lastName,
                    email: patientData.email,
                    phone: patientData.phone,
                });
            }

            const result = await healthieAPI.createAppointment({
                ...patientData,
                user_id: getCLient ? getCLient.id : createClient.id,
                datetime: bookingData.appointment.date,
                doctor_id: bookingData.appointment?.doctor?.id, // Add the doctor_id
                billing_item_id: paymentData.billingItemId,
                payment_status: 'paid'
            });

            // Optionally update the appointment with billing info
            if (result && result.id && paymentData.billingItemId) {
                await healthieAPI.updateAppointmentWithBilling(result.id, paymentData.billingItemId);
            }

            if (result) {
                onComplete({
                    appointment: result,
                    payment: {
                        method: 'card',
                        billingItemId: paymentData.billingItemId,
                        stripeCustomerDetailId: paymentData.stripeCustomerDetailId,
                        paid: true
                    },
                    confirmation: result.confirmed
                });
            } else {
                throw new Error('Failed to create appointment');
            }

        } catch (error) {
            console.error('Booking failed:', error);
            setError('Booking failed: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Handle cash booking
    const handleCashBooking = async () => {
        setLoading(true);
        setError(null);
        let createClient = {};

        try {
            const getCLient = allClients.find(client => client.email === patientData.email);
            if (!getCLient) {
                createClient = await healthieAPI.createClient({
                    first_name: patientData.firstName,
                    last_name: patientData.lastName,
                    email: patientData.email,
                    phone: patientData.phone,
                });
            }

            const result = await healthieAPI.createAppointment({
                ...patientData,
                user_id: getCLient ? getCLient.id : createClient.id,
                datetime: bookingData.appointment.date,
                doctor_id: bookingData.appointment?.doctor?.id, // Add the doctor_id
                payment_method: 'cash',
                payment_status: 'pending'
            });

            if (result) {
                onComplete({
                    appointment: result,
                    payment: {
                        method: 'cash',
                        paid: false
                    },
                    confirmation: result.confirmed
                });
            } else {
                throw new Error('Failed to create appointment');
            }

        } catch (error) {
            console.error('Booking failed:', error);
            setError('Booking failed: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const renderInsuranceStep = () => (
        <Card>
            <CardContent sx={ { p: 4 } }>
                <Box sx={ { display: 'flex', alignItems: 'center', mb: 3 } }>
                    <Security sx={ { fontSize: 24, color: theme.palette.primary.main, mr: 1 } } />
                    <Typography variant="h6" fontWeight={ 600 }>
                        Insurance Verification
                    </Typography>
                </Box>

                { error && (
                    <Alert severity="error" sx={ { mb: 3 } }>
                        { error }
                    </Alert>
                ) }

                <form onSubmit={ handleInsuranceSubmit }>
                    <Grid container spacing={ 3 }>
                        <Grid item size={ { xs: 12, md: 6 } }>
                            <TextField
                                select
                                value={ insuranceData.provider }
                                onChange={ (e) => setInsuranceData(prev => ({ ...prev, provider: e.target.value })) }
                                fullWidth
                                required
                                label='Provider'
                            >
                                { insurancePlans.map((plan) => (
                                    <MenuItem key={ plan.payer_id } value={ plan.payer_id }>
                                        { plan.payer_name }
                                    </MenuItem>
                                )) }
                            </TextField>
                        </Grid>

                        <Grid item size={ { xs: 12, md: 6 } }>
                            <TextField
                                label="Member ID"
                                value={ insuranceData.member_id }
                                onChange={ (e) => setInsuranceData(prev => ({ ...prev, member_id: e.target.value })) }
                                fullWidth
                                required
                            />
                        </Grid>

                        <Grid item size={ { xs: 12, md: 6 } }>
                            <TextField
                                label="Group Number (Optional)"
                                value={ insuranceData.group_number }
                                onChange={ (e) => setInsuranceData(prev => ({ ...prev, group_number: e.target.value })) }
                                fullWidth
                            />
                        </Grid>

                        <Grid item xs={ 12 }>
                            <Button
                                type="submit"
                                variant="contained"
                                size="large"
                                disabled={ loading }
                                fullWidth
                                sx={ { py: 1.5, color: "white" } }
                            >
                                { loading ? (
                                    <>
                                        <CircularProgress size={ 20 } sx={ { mr: 1, color: 'white' } } />
                                        Verifying Insurance...
                                    </>
                                ) : (
                                    'Verify Insurance'
                                ) }
                            </Button>
                        </Grid>

                        <Grid item xs={ 12 }>
                            <Button
                                variant="text"
                                onClick={ () => setCurrentSubStep(1) }
                                fullWidth
                            >
                                Skip Insurance (Pay Full Amount)
                            </Button>
                        </Grid>
                    </Grid>
                </form>
            </CardContent>
        </Card>
    );

    const renderPatientStep = () => (
        <Card>
            <CardContent sx={ { p: 4 } }>
                <Box sx={ { display: 'flex', alignItems: 'center', mb: 3 } }>
                    <Person sx={ { fontSize: 24, color: theme.palette.primary.main, mr: 1 } } />
                    <Typography variant="h6" fontWeight={ 600 }>
                        Patient Information
                    </Typography>
                </Box>

                { insuranceResult && (
                    <Alert severity="success" sx={ { mb: 3 } }>
                        Insurance verified! Your copay is ${ insuranceResult.copay_amount }
                    </Alert>
                ) }

                <form onSubmit={ handlePatientSubmit }>
                    <Grid container spacing={ 3 }>
                        <Grid item size={ { xs: 12, md: 4 } }>
                            <TextField
                                label="First Name"
                                value={ patientData.firstName }
                                onChange={ (e) => setPatientData(prev => ({ ...prev, firstName: e.target.value })) }
                                fullWidth
                                required
                            />
                        </Grid>

                        <Grid item size={ { xs: 12, md: 4 } }>
                            <TextField
                                label="Last Name"
                                value={ patientData.lastName }
                                onChange={ (e) => setPatientData(prev => ({ ...prev, lastName: e.target.value })) }
                                fullWidth
                                required
                            />
                        </Grid>

                        <Grid item size={ { xs: 12, md: 4 } }>
                            <TextField
                                label="Email"
                                type="email"
                                value={ patientData.email }
                                onChange={ (e) => setPatientData(prev => ({ ...prev, email: e.target.value })) }
                                fullWidth
                                required
                            />
                        </Grid>

                        <Grid item size={ { xs: 12, md: 4 } }>
                            <TextField
                                label="Phone Number"
                                type="tel"
                                value={ patientData.phone }
                                onChange={ (e) => setPatientData(prev => ({ ...prev, phone: e.target.value })) }
                                fullWidth
                                required
                            />
                        </Grid>

                        <Grid item size={ { xs: 12, md: 4 } }>
                            <TextField
                                label="Appointment Type"
                                select
                                value={ patientData.appointment_type_id }
                                onChange={ (e) => setPatientData(prev => ({ ...prev, appointment_type_id: e.target.value })) }
                                fullWidth
                                required
                            >
                                { appointmentType.map((type) => (
                                    <MenuItem key={ type.id } value={ type.id }>
                                        { type.name }
                                    </MenuItem>
                                )) }
                            </TextField>
                        </Grid>

                        <Grid item size={ { xs: 12 } }>
                            <Typography variant="subtitle2" fontWeight={ 600 }>Select Contact Type</Typography>
                            <RadioGroup
                                value={ patientData.contact_type }
                                sx={ { flexDirection: 'row' } }
                                onChange={ (e) => setPatientData(prev => ({ ...prev, contact_type: e.target.value })) }
                            >
                                <FormControlLabel value="Healthie Video Call" control={ <Radio /> } label="Video Call" />
                                <FormControlLabel value="Phone Call" control={ <Radio /> } label="Phone Call" />
                                <FormControlLabel value="In Person" control={ <Radio /> } label="In-Person" />
                            </RadioGroup>
                        </Grid>

                        <Grid item size={ { xs: 12, md: 4 } }>
                            <Button
                                type="submit"
                                variant="contained"
                                size="small"
                                fullWidth
                                sx={ { py: 0.5, color: "white" } }
                            >
                                Continue to Confirmation
                            </Button>
                        </Grid>
                    </Grid>
                </form>
            </CardContent>
        </Card>
    );

    const renderConfirmationStep = () => {
        const totalAmount = insuranceResult
            ? insuranceResult.copay_amount
            : bookingData.service?.price || 75;

        function formatDate(date) {
            return new Date(date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            });
        }

        return (
            <Card>
                <CardContent sx={ { p: 4 } }>
                    <Box sx={ { display: 'flex', alignItems: 'center', mb: 3 } }>
                        <CreditCard sx={ { fontSize: 24, color: theme.palette.primary.main, mr: 1 } } />
                        <Typography variant="h6" fontWeight={ 600 }>
                            Booking Confirmation
                        </Typography>
                    </Box>

                    {/* Payment Method Selection */ }
                    <Grid container spacing={ 2 } sx={ { mb: 4 } }>
                        <Grid item size={ { sx: 6, md: 4.5 } }>
                            <Typography variant="subtitle2" fontWeight={ 600 } sx={ { mb: 2 } }>
                                Select Payment Method
                            </Typography>
                            <Box sx={ { display: 'flex', justifyContent: 'space-around', height: "70px" } }>
                                <Box
                                    sx={ {
                                        width: '48%',
                                        padding: '10px',
                                        backgroundColor: paymentMethod === 'card' ? theme.palette.primary.main : '#f4f6f8',
                                        color: paymentMethod === 'card' ? 'white' : 'text.primary',
                                        textAlign: 'center',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        '&:hover': {
                                            backgroundColor: paymentMethod !== 'card' && '#e0e0e0',
                                        },
                                    } }
                                    onClick={ () => setPaymentMethod('card') }
                                >
                                    <Typography variant="h6" sx={ { fontSize: "15px" } }>Card</Typography>
                                    <Typography variant="body2" sx={ { fontSize: "10px" } }>Pay securely with your card</Typography>
                                </Box>
                                <Box
                                    sx={ {
                                        width: '48%',
                                        padding: '10px',
                                        backgroundColor: paymentMethod === 'cash' ? theme.palette.primary.main : '#f4f6f8',
                                        color: paymentMethod === 'cash' ? 'white' : 'text.primary',
                                        textAlign: 'center',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        '&:hover': {
                                            backgroundColor: paymentMethod !== 'cash' && '#e0e0e0',
                                        },
                                    } }
                                    onClick={ () => setPaymentMethod('cash') }
                                >
                                    <Typography variant="h6" sx={ { fontSize: "15px" } }>Cash</Typography>
                                    <Typography variant="body2" sx={ { fontSize: "10px" } }>Pay in cash at the appointment.</Typography>
                                </Box>
                            </Box>
                        </Grid>
                    </Grid>

                    {/* Booking Summary */ }
                    <Box sx={ { mb: 4, p: 3, bgcolor: '#f8fafc', borderRadius: 2 } }>
                        <Typography variant="subtitle1" fontWeight={ 600 } gutterBottom>
                            Appointment Summary
                        </Typography>
                        <Box sx={ { display: 'flex', justifyContent: 'space-between', mb: 1 } }>
                            <Typography variant="body2">Service:</Typography>
                            <Typography variant="body2">{ bookingData.service?.name }</Typography>
                        </Box>
                        <Box sx={ { display: 'flex', justifyContent: 'space-between', mb: 1 } }>
                            <Typography variant="body2">Doctor:</Typography>
                            <Typography variant="body2">
                                { bookingData.appointment?.doctor.full_name }
                            </Typography>
                        </Box>
                        <Box sx={ { display: 'flex', justifyContent: 'space-between', mb: 1 } }>
                            <Typography variant="body2">Date & Time:</Typography>
                            <Typography variant="body2">
                                { formatDate(bookingData.appointment?.date) } at { bookingData.appointment?.startTime }
                            </Typography>
                        </Box>
                        { insuranceResult && (
                            <Box sx={ { display: 'flex', justifyContent: 'space-between', mb: 1 } }>
                                <Typography variant="body2" color="success.main">Insurance Copay:</Typography>
                                <Typography variant="body2" color="success.main">${ insuranceResult.copay_amount }</Typography>
                            </Box>
                        ) }
                        <Divider sx={ { my: 2 } } />
                        <Box sx={ { display: 'flex', justifyContent: 'space-between' } }>
                            <Typography variant="h6" fontWeight={ 600 }>Total Amount:</Typography>
                            <Typography variant="h6" fontWeight={ 600 }>${ totalAmount }</Typography>
                        </Box>
                    </Box>

                    { error && (
                        <Alert severity="error" sx={ { mb: 3 } }>
                            { error }
                        </Alert>
                    ) }

                    <Button
                        variant="contained"
                        size="large"
                        disabled={ loading }
                        fullWidth
                        onClick={ paymentMethod === "card" ? handleCardPayment : handleCashBooking }
                        sx={ { py: 1.5, color: "#fff" } }
                    >
                        { loading ? (
                            <>
                                <CircularProgress size={ 20 } sx={ { mr: 1, color: 'white' } } />
                                Creating Appointment...
                            </>
                        ) : (
                            `Confirm Booking ${paymentMethod === 'cash' ? '(Pay Later)' : `& Pay $${totalAmount}`}`
                        ) }
                    </Button>

                    <Typography variant="caption" color="text.secondary" sx={ { display: 'block', textAlign: 'center', mt: 2 } }>
                        Payment processed securely by Healthie using Stripe
                    </Typography>
                </CardContent>
            </Card>
        );
    };

    // Calculate total amount for payment
    const totalAmount = insuranceResult
        ? insuranceResult.copay_amount
        : bookingData.service?.price || 75;

    return (
        <Box>
            <Typography variant="h5" fontWeight={ 600 } color="text.primary" gutterBottom>
                Payment & Information
            </Typography>

            {/* Sub-step indicator */ }
            <Box sx={ { mb: 4 } }>
                <Stepper activeStep={ currentSubStep } alternativeLabel sx={ {
                    '& .css-1gi9ihl-MuiStepIcon-text': {
                        fill: 'white',
                    },
                } }>
                    { subStepLabels.map((label) => (
                        <Step key={ label }>
                            <StepLabel>{ label }</StepLabel>
                        </Step>
                    )) }
                </Stepper>
            </Box>

            {/* Render current sub-step */ }
            { currentSubStep === 0 && renderInsuranceStep() }
            { currentSubStep === 1 && renderPatientStep() }
            { currentSubStep === 2 && renderConfirmationStep() }

            {/* Card Payment Dialog */ }
            <Dialog
                open={ showCardDialog }
                onClose={ () => setShowCardDialog(false) }
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    <Box sx={ { display: 'flex', alignItems: 'center' } }>
                        <CreditCard sx={ { mr: 1 } } />
                        Secure Payment
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Elements stripe={ stripePromise }>
                        <CardPaymentForm
                            amount={ totalAmount }
                            patientData={ patientData }
                            bookingData={ bookingData }
                            onSuccess={ handleCardPaymentSuccess }
                            onCancel={ () => setShowCardDialog(false) }
                        />
                    </Elements>
                </DialogContent>
            </Dialog>
        </Box>
    );
};

export default PaymentFlow;