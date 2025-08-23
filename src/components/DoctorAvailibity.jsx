// src/components/DoctorAvailability.js
import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    Button,
    Avatar,
    Chip,
    CircularProgress,
    TextField,
    Alert,
    Divider
} from '@mui/material';
import { CalendarToday, AccessTime, Star } from '@mui/icons-material';
import { useBooking } from '../contexts/BookingContext';
import healthieAPI from '../services/healthieAPI';

const DoctorAvailability = ({ onNext }) => {
    const {
        location,
        service,
        setDoctor,
        setAppointmentSlot,
        setLoading,
        setError,
        loading,
        error
    } = useBooking();

    const [doctors, setDoctors] = useState([]);
    const [selectedDoctor, setSelectedDoctor] = useState(null);
    const [selectedDate, setSelectedDate] = useState('');
    const [timeSlots, setTimeSlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [slotsLoading, setSlotsLoading] = useState(false);

    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    useEffect(() => {
        const fetchDoctors = async () => {
            if (!location || !service) return;

            setLoading(true);
            try {
                const data = await healthieAPI.getDoctors(location.id, service.id);
                setDoctors(data);
            } catch (err) {
                setError('Failed to load doctors. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchDoctors();
    }, [location, service, setLoading, setError]);

    useEffect(() => {
        if (selectedDoctor && selectedDate) {
            fetchTimeSlots();
        }
    }, [selectedDoctor, selectedDate]);

    const fetchTimeSlots = async () => {
        setSlotsLoading(true);
        try {
            const data = await healthieAPI.getAvailableSlots(selectedDoctor.id, selectedDate);
            setTimeSlots(data);
        } catch (err) {
            setError('Failed to load available times. Please try again.');
        } finally {
            setSlotsLoading(false);
        }
    };

    const handleDoctorSelect = (doctor) => {
        setSelectedDoctor(doctor);
        setDoctor(doctor);
        setSelectedSlot(null);
        setTimeSlots([]);
    };

    const handleSlotSelect = (slot) => {
        setSelectedSlot(slot);
        const appointmentData = {
            doctor: selectedDoctor,
            date: selectedDate,
            startTime: slot.startTime,
            endTime: slot.endTime,
            price: slot.price || service.price
        };
        setAppointmentSlot(appointmentData);
    };

    const handleNext = () => {
        if (selectedDoctor && selectedDate && selectedSlot) {
            onNext();
        }
    };

    if (loading) {
        return (
            <Box sx={ { display: 'flex', justifyContent: 'center', py: 8 } }>
                <CircularProgress size={ 40 } />
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error" sx={ { mb: 4 } }>
                { error }
            </Alert>
        );
    }

    return (
        <Box>
            <Typography variant="h5" fontWeight={ 600 } color="text.primary" gutterBottom>
                Step 3: Select Doctor & Time
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={ { mb: 3 } }>
                { service?.name } in { location?.name }
            </Typography>

            {/* Doctor Selection */ }
            <Typography variant="h6" fontWeight={ 600 } color="text.primary" sx={ { mb: 2 } }>
                Choose Your Doctor
            </Typography>

            <Grid container spacing={ 3 } sx={ { mb: 4 } }>
                { doctors.map((doctor) => (
                    <Grid item xs={ 12 } sm={ 6 } md={ 4 } key={ doctor.id }>
                        <Card
                            sx={ {
                                cursor: 'pointer',
                                border: selectedDoctor?.id === doctor.id ? '2px solid' : '1px solid #e5e7eb',
                                borderColor: selectedDoctor?.id === doctor.id ? 'primary.main' : '#e5e7eb',
                                bgcolor: selectedDoctor?.id === doctor.id ? 'primary.50' : 'white',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    borderColor: 'primary.main',
                                    transform: 'translateY(-2px)',
                                    boxShadow: (theme) => `0 8px 25px ${theme.palette.primary.main}25`,
                                },
                            } }
                            onClick={ () => handleDoctorSelect(doctor) }
                        >
                            <CardContent sx={ { textAlign: 'center', p: 3 } }>
                                <Avatar
                                    sx={ {
                                        width: 64,
                                        height: 64,
                                        mx: 'auto',
                                        mb: 2,
                                        bgcolor: 'primary.main',
                                        fontSize: '1.5rem'
                                    } }
                                >
                                    { doctor.firstName[0] }{ doctor.lastName[0] }
                                </Avatar>
                                <Typography variant="h6" fontWeight={ 600 } color="text.primary">
                                    { doctor.firstName } { doctor.lastName }
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={ { mb: 1 } }>
                                    { doctor.specialties.join(', ') }
                                </Typography>
                                <Box sx={ { display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 1 } }>
                                    <Star sx={ { fontSize: 16, color: '#ffc107', mr: 0.5 } } />
                                    <Typography variant="body2" color="text.secondary">
                                        { doctor.rating } • { doctor.experience }
                                    </Typography>
                                </Box>
                                { doctor.bio && (
                                    <Typography variant="caption" color="text.secondary" sx={ { fontSize: '0.75rem' } }>
                                        { doctor.bio }
                                    </Typography>
                                ) }
                            </CardContent>
                        </Card>
                    </Grid>
                )) }
            </Grid>

            {/* Date & Time Selection */ }
            { selectedDoctor && (
                <Box>
                    <Divider sx={ { mb: 3 } } />
                    <Typography variant="h6" fontWeight={ 600 } color="text.primary" sx={ { mb: 2 } }>
                        Select Date & Time
                    </Typography>

                    <Box sx={ { mb: 3 } }>
                        <TextField
                            type="date"
                            label="Select Date"
                            value={ selectedDate }
                            onChange={ (e) => setSelectedDate(e.target.value) }
                            InputLabelProps={ { shrink: true } }
                            inputProps={ { min: today, max: nextWeek } }
                            fullWidth
                            sx={ { maxWidth: 300 } }
                        />
                    </Box>

                    { selectedDate && (
                        <Box>
                            <Typography variant="subtitle1" fontWeight={ 500 } color="text.primary" sx={ { mb: 2 } }>
                                Available Times for { new Date(selectedDate).toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                }) }
                            </Typography>

                            { slotsLoading ? (
                                <Box sx={ { display: 'flex', justifyContent: 'center', py: 4 } }>
                                    <CircularProgress size={ 24 } />
                                </Box>
                            ) : timeSlots.length > 0 ? (
                                <Grid container spacing={ 2 } sx={ { mb: 4 } }>
                                    { timeSlots.map((slot, index) => (
                                        <Grid item xs={ 6 } sm={ 4 } md={ 3 } key={ index }>
                                            <Button
                                                variant={ selectedSlot === slot ? "contained" : "outlined" }
                                                fullWidth
                                                disabled={ !slot.available }
                                                onClick={ () => handleSlotSelect(slot) }
                                                startIcon={ <AccessTime /> }
                                                sx={ {
                                                    py: 1.5,
                                                    flexDirection: 'column',
                                                    height: 'auto'
                                                } }
                                            >
                                                <Typography variant="body2" fontWeight={ 600 }>
                                                    { slot.startTime } - { slot.endTime }
                                                </Typography>
                                                { slot.price && (
                                                    <Typography variant="caption" color="text.secondary">
                                                        ${ slot.price }
                                                    </Typography>
                                                ) }
                                            </Button>
                                        </Grid>
                                    )) }
                                </Grid>
                            ) : (
                                <Alert severity="info" sx={ { mb: 4 } }>
                                    No available slots for this date. Please select another date.
                                </Alert>
                            ) }
                        </Box>
                    ) }
                </Box>
            ) }

            <Box sx={ { display: 'flex', justifyContent: 'flex-end', mt: 4 } }>
                <Button
                    variant="contained"
                    size="large"
                    onClick={ handleNext }
                    disabled={ !selectedDoctor || !selectedDate || !selectedSlot }
                    sx={ { px: 4 } }
                >
                    Next Step
                </Button>
            </Box>
        </Box>
    );
};

export default DoctorAvailability;

// src/components/PaymentFlow.js
import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    TextField,
    Button,
    Grid,
    Alert,
    CircularProgress,
    Stepper,
    Step,
    StepLabel,
    Divider,
    List,
    ListItem,
    ListItemText
} from '@mui/material';
import { Security, Person, CreditCard, CheckCircle } from '@mui/icons-material';
import { useStripe, useElements, CardElement, CardNumberElement, CardExpiryElement, CardCvcElement } from '@stripe/react-stripe-js';
import { useBooking } from '../contexts/BookingContext';
import stripeAPI from '../services/stripeAPI';
import healthieAPI from '../services/healthieAPI';

const PatientDetailsForm = ({ patientDetails, setPatientDetails, onNext }) => {
    const handleChange = (field, value) => {
        setPatientDetails(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onNext();
    };

    return (
        <Card>
            <CardContent sx={ { p: 4 } }>
                <Box sx={ { display: 'flex', alignItems: 'center', mb: 3 } }>
                    <Person sx={ { fontSize: 24, color: 'primary.main', mr: 1 } } />
                    <Typography variant="h6" fontWeight={ 600 }>
                        Patient Information
                    </Typography>
                </Box>

                <form onSubmit={ handleSubmit }>
                    <Grid container spacing={ 3 }>
                        <Grid item xs={ 12 } sm={ 6 }>
                            <TextField
                                label="First Name"
                                value={ patientDetails.firstName }
                                onChange={ (e) => handleChange('firstName', e.target.value) }
                                fullWidth
                                required
                            />
                        </Grid>

                        <Grid item xs={ 12 } sm={ 6 }>
                            <TextField
                                label="Last Name"
                                value={ patientDetails.lastName }
                                onChange={ (e) => handleChange('lastName', e.target.value) }
                                fullWidth
                                required
                            />
                        </Grid>

                        <Grid item xs={ 12 } sm={ 6 }>
                            <TextField
                                label="Email"
                                type="email"
                                value={ patientDetails.email }
                                onChange={ (e) => handleChange('email', e.target.value) }
                                fullWidth
                                required
                            />
                        </Grid>

                        <Grid item xs={ 12 } sm={ 6 }>
                            <TextField
                                label="Phone Number"
                                type="tel"
                                value={ patientDetails.phone }
                                onChange={ (e) => handleChange('phone', e.target.value) }
                                fullWidth
                                required
                            />
                        </Grid>

                        <Grid item xs={ 12 } sm={ 6 }>
                            <TextField
                                label="Date of Birth"
                                type="date"
                                value={ patientDetails.dateOfBirth }
                                onChange={ (e) => handleChange('dateOfBirth', e.target.value) }
                                InputLabelProps={ { shrink: true } }
                                fullWidth
                                required
                            />
                        </Grid>

                        <Grid item xs={ 12 }>
                            <TextField
                                label="Reason for Visit (Optional)"
                                value={ patientDetails.reason }
                                onChange={ (e) => handleChange('reason', e.target.value) }
                                multiline
                                rows={ 3 }
                                fullWidth
                                placeholder="Please describe your symptoms or reason for consultation..."
                            />
                        </Grid>

                        <Grid item xs={ 12 }>
                            <Button
                                type="submit"
                                variant="contained"
                                size="large"
                                fullWidth
                                sx={ { py: 1.5 } }
                            >
                                Continue to Payment
                            </Button>
                        </Grid>
                    </Grid>
                </form>
            </CardContent>
        </Card>
    );
};

const PaymentForm = ({ amount, onPaymentSuccess, loading }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [error, setError] = useState(null);
    const [processing, setProcessing] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setProcessing(true);
        setError(null);

        try {
            const cardElement = elements.getElement(CardNumberElement);

            const { error, paymentMethod } = await stripe.createPaymentMethod({
                type: 'card',
                card: cardElement,
            });

            if (error) {
                setError(error.message);
                setProcessing(false);
                return;
            }

            // Simulate payment success for demo
            setTimeout(() => {
                onPaymentSuccess({
                    id: `pm_${Math.random().toString(36).substr(2, 24)}`,
                    status: 'succeeded'
                });
                setProcessing(false);
            }, 2000);

        } catch (err) {
            setError(err.message);
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
            },
        },
    };

    return (
        <Card>
            <CardContent sx={ { p: 4 } }>
                <Box sx={ { display: 'flex', alignItems: 'center', mb: 3 } }>
                    <CreditCard sx={ { fontSize: 24, color: 'primary.main', mr: 1 } } />
                    <Typography variant="h6" fontWeight={ 600 }>
                        Payment Information
                    </Typography>
                </Box>

                <Box sx={ { mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 } }>
                    <Typography variant="h6" color="primary.main" gutterBottom>
                        Total: ${ amount }
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Secure payment processed by Stripe
                    </Typography>
                </Box>

                <form onSubmit={ handleSubmit }>
                    <Grid container spacing={ 3 }>
                        <Grid item xs={ 12 }>
                            <Box sx={ { p: 2, border: '1px solid #e0e0e0', borderRadius: 1 } }>
                                <Typography variant="body2" color="text.secondary" sx={ { mb: 1 } }>
                                    Card Number
                                </Typography>
                                <CardNumberElement options={ cardElementOptions } />
                            </Box>
                        </Grid>

                        <Grid item xs={ 12 } sm={ 6 }>
                            <Box sx={ { p: 2, border: '1px solid #e0e0e0', borderRadius: 1 } }>
                                <Typography variant="body2" color="text.secondary" sx={ { mb: 1 } }>
                                    Expiry Date
                                </Typography>
                                <CardExpiryElement options={ cardElementOptions } />
                            </Box>
                        </Grid>

                        <Grid item xs={ 12 } sm={ 6 }>
                            <Box sx={ { p: 2, border: '1px solid #e0e0e0', borderRadius: 1 } }>
                                <Typography variant="body2" color="text.secondary" sx={ { mb: 1 } }>
                                    CVC
                                </Typography>
                                <CardCvcElement options={ cardElementOptions } />
                            </Box>
                        </Grid>

                        { error && (
                            <Grid item xs={ 12 }>
                                <Alert severity="error">{ error }</Alert>
                            </Grid>
                        ) }

                        <Grid item xs={ 12 }>
                            <Button
                                type="submit"
                                variant="contained"
                                size="large"
                                fullWidth
                                disabled={ !stripe || processing || loading }
                                sx={ { py: 1.5 } }
                            >
                                { processing ? (
                                    <>
                                        <CircularProgress size={ 20 } sx={ { mr: 1 } } />
                                        Processing Payment...
                                    </>
                                ) : (
                                    `Pay $${amount}`
                                ) }
                            </Button>
                        </Grid>
                    </Grid>
                </form>

                <Box sx={ { mt: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
                    <Security sx={ { fontSize: 16, color: 'text.secondary', mr: 1 } } />
                    <Typography variant="caption" color="text.secondary">
                        Your payment information is secure and encrypted
                    </Typography>
                </Box>
            </CardContent>
        </Card>
    );
};

const PaymentFlow = ({ onNext }) => {
    const {
        appointmentSlot,
        service,
        setPatientDetails,
        setBooking,
        setLoading,
        setError,
        loading
    } = useBooking();

    const [currentSubStep, setCurrentSubStep] = useState(0);
    const [patientDetails, setPatientDetailsState] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        dateOfBirth: '',
        reason: ''
    });

    const subStepLabels = ['Patient Information', 'Payment'];
    const amount = appointmentSlot?.price || service?.price || 75;

    const handlePatientDetailsNext = () => {
        setPatientDetails(patientDetails);
        setCurrentSubStep(1);
    };

    const handlePaymentSuccess = async (paymentResult) => {
        setLoading(true);
        try {
            // Create appointment in Healthie
            const appointmentData = {
                doctorId: appointmentSlot.doctor.id,
                serviceId: service.id,
                startTime: appointmentSlot.startTime,
                endTime: appointmentSlot.endTime,
                date: appointmentSlot.date,
                patientDetails,
                paymentId: paymentResult.id
            };

            const booking = await healthieAPI.createAppointment(appointmentData);
            setBooking(booking);
            onNext();
        } catch (err) {
            setError('Failed to create appointment. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box>
            <Typography variant="h5" fontWeight={ 600 } color="text.primary" gutterBottom>
                Step 4: Patient Details & Payment
            </Typography>

            {/* Sub-step indicator */ }
            <Box sx={ { mb: 4 } }>
                <Stepper activeStep={ currentSubStep } alternativeLabel>
                    { subStepLabels.map((label) => (
                        <Step key={ label }>
                            <StepLabel>{ label }</StepLabel>
                        </Step>
                    )) }
                </Stepper>
            </Box>

            {/* Appointment Summary */ }
            <Card sx={ { mb: 4 } }>
                <CardContent>
                    <Typography variant="h6" fontWeight={ 600 } gutterBottom>
                        Appointment Summary
                    </Typography>
                    <List dense>
                        <ListItem>
                            <ListItemText
                                primary="Doctor"
                                secondary={ `${appointmentSlot?.doctor?.firstName} ${appointmentSlot?.doctor?.lastName}` }
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemText
                                primary="Service"
                                secondary={ service?.name }
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemText
                                primary="Date & Time"
                                secondary={ `${new Date(appointmentSlot?.date).toLocaleDateString()} at ${appointmentSlot?.startTime} - ${appointmentSlot?.endTime}` }
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemText
                                primary="Total Cost"
                                secondary={ `$${amount}` }
                            />
                        </ListItem>
                    </List>
                </CardContent>
            </Card>

            { currentSubStep === 0 ? (
                <PatientDetailsForm
                    patientDetails={ patientDetails }
                    setPatientDetails={ setPatientDetailsState }
                    onNext={ handlePatientDetailsNext }
                />
            ) : (
                <PaymentForm
                    amount={ amount }
                    onPaymentSuccess={ handlePaymentSuccess }
                    loading={ loading }
                />
            ) }
        </Box>
    );
};

export { PaymentFlow };