import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Card, CardContent, TextField, Button, Grid,
    Alert, Stepper, Step, StepLabel, Divider, CircularProgress,
    useTheme, MenuItem
} from '@mui/material';
import { Security, Person, CreditCard } from '@mui/icons-material';
import healthieAPI from '../services/healthieAPI';
import { tr } from 'date-fns/locale';

const PaymentFlow = ({ bookingData, onComplete }) => {
    const [currentSubStep, setCurrentSubStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const theme = useTheme()
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
        dateOfBirth: '',
        reason: ''
    });

    const [insuranceResult, setInsuranceResult] = useState(null);

    const subStepLabels = ['Insurance Verification', 'Patient Information', 'Payment Confirmation'];
    const [insurancePlans, setInsurancePlans] = useState([]);

    useEffect(() => {
        const fetchInsurancePlans = async () => {
            const plans = await healthieAPI.getInsurancePlans({ is_accepted: true });
            if (plans.data) {
                setInsurancePlans(plans.data.insurancePlans);
            }
        };
        fetchInsurancePlans();
    }, []);
    // Handle insurance verification using Healthie's system
    const handleInsuranceSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const result = await healthieAPI.verifyInsurance({
                ID: insuranceData.provider,
                // member_id: insuranceData.member_id,
                // group_number: insuranceData.group_number,
                // offering_id: bookingData.service.id
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

    // Handle final booking with Healthie's integrated payment
    const handleFinalBooking = async () => {
        setLoading(true);
        setError(null);

        try {
            // Create appointment with Healthie's payment integration
            const appointmentData = {
                providerId: bookingData.appointment.doctor.id,
                offeringId: bookingData.service.id,
                date: bookingData.appointment.date,
                time: bookingData.appointment.startTime,
                patient: patientData,
                insurance: insuranceResult
            };

            // Healthie handles the entire payment flow internally
            const result = await healthieAPI.createAppointmentWithPayment(appointmentData);

            if (result.appointment) {
                // Payment was processed successfully by Healthie
                onComplete({
                    appointment: result.appointment,
                    payment: result.payment_intent,
                    confirmation: result.appointment.confirmation_code
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
                                label="Date of Birth"
                                type="date"
                                value={ patientData.dateOfBirth }
                                onChange={ (e) => setPatientData(prev => ({ ...prev, dateOfBirth: e.target.value })) }
                                fullWidth
                                required
                            />
                        </Grid>

                        <Grid item size={ { xs: 12, md: 4 } }>
                            <TextField
                                label="Reason for Visit (Optional)"
                                value={ patientData.reason }
                                onChange={ (e) => setPatientData(prev => ({ ...prev, reason: e.target.value })) }
                                fullWidth
                                placeholder="Please describe your symptoms or reason for consultation..."
                            />
                        </Grid>

                        <Grid item size={ { xs: 12, md: 4 } }>
                            <Button
                                type="submit"
                                variant="contained"
                                size="small"
                                fullWidth
                                sx={ { py: 0.5, color: "white" } }
                            >
                                Continue to Booking Confirmation
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
            : bookingData.service.pricing_info?.price || 75;
        console.log(bookingData.appointment?.date);

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
                                { bookingData.appointment?.doctor.first_name } { bookingData.appointment?.doctor.last_name }
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

                    <Alert severity="info" sx={ { mb: 3 } }>
                        Healthie will securely process your payment using Stripe. You'll be redirected to complete the payment process.
                    </Alert>

                    <Button
                        variant="contained"
                        size="large"
                        disabled={ loading }
                        fullWidth
                        onClick={ handleFinalBooking }
                        sx={ { py: 1.5, color: "#fff" } }
                    >
                        { loading ? (
                            <>
                                <CircularProgress size={ 20 } sx={ { mr: 1, color: 'white' } } />
                                Creating Appointment...
                            </>
                        ) : (
                            `Confirm Booking & Pay $${totalAmount}`
                        ) }
                    </Button>

                    <Typography variant="caption" color="text.secondary" sx={ { display: 'block', textAlign: 'center', mt: 2 } }>
                        Payment processed securely by Healthie using Stripe
                    </Typography>
                </CardContent>
            </Card>
        );
    };

    return (
        <Box>
            <Typography variant="h5" fontWeight={ 600 } color="text.primary" gutterBottom>
                Step 4: Payment & Information
            </Typography>

            {/* Sub-step indicator */ }
            <Box sx={ { mb: 4 } }>
                <Stepper activeStep={ currentSubStep } alternativeLabel sx={ {
                    '& .css-1gi9ihl-MuiStepIcon-text': {
                        fill: 'white', // change active color here
                    },

                } } >
                    { subStepLabels.map((label) => (
                        <Step key={ label } >
                            <StepLabel>{ label }</StepLabel>
                        </Step>
                    )) }
                </Stepper>
            </Box>

            {/* Render current sub-step */ }
            { currentSubStep === 0 && renderInsuranceStep() }
            { currentSubStep === 1 && renderPatientStep() }
            { currentSubStep === 2 && renderConfirmationStep() }
        </Box>
    );
};

export default PaymentFlow;