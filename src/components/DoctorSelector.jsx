import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Grid, Card, CardContent, Button, Avatar,
    CircularProgress, TextField, Chip
} from '@mui/material';
import { AccessTime, Star } from '@mui/icons-material';
import healthieAPI from '../services/healthieAPI';
import { useTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

const DoctorSelector = ({ location, service, onNext }) => {
    const [doctors, setDoctors] = useState([]);
    const [selectedDoctor, setSelectedDoctor] = useState(null);
    const [selectedDate, setSelectedDate] = useState('');
    const [timeSlots, setTimeSlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [loading, setLoading] = useState(true);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const theme = useTheme();
    const today = new Date();
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    useEffect(() => {
        const fetchDoctors = async () => {
            setLoading(true);
            try {
                // Use Healthie's provider API
                const doctorsData = await healthieAPI.getProviders(location.id, service.id);
                setDoctors(doctorsData);
            } catch (error) {
                console.error('Failed to fetch doctors:', error);
            } finally {
                setLoading(false);
            }
        };

        if (location && service) {
            fetchDoctors();
        }
    }, [location, service]);

    useEffect(() => {
        if (selectedDoctor && selectedDate) {
            fetchTimeSlots();
        }
    }, [selectedDoctor, selectedDate]);

    const fetchTimeSlots = async () => {
        setSlotsLoading(true);
        try {
            // Use Healthie's availability API
            const slots = await healthieAPI.getAvailableSlots(
                selectedDoctor.id,
                selectedDate,
                service.id
            );
            setTimeSlots(slots);
        } catch (error) {
            console.error('Failed to fetch time slots:', error);
        } finally {
            setSlotsLoading(false);
        }
    };

    const handleDoctorSelect = (doctor) => {
        setSelectedDoctor(doctor);
        setSelectedSlot(null);
        setTimeSlots([]);
    };

    const handleSlotSelect = (slot) => {
        setSelectedSlot(slot);
    };

    const handleNext = () => {
        if (selectedDoctor && selectedDate && selectedSlot) {
            const appointmentData = {
                doctor: selectedDoctor,
                date: selectedDate,
                startTime: selectedSlot.start_time,
                endTime: selectedSlot.end_time,
                slotId: selectedSlot.id
            };
            onNext(appointmentData);
        }
    };

    if (loading) {
        return (
            <Box sx={ { display: 'flex', justifyContent: 'center', py: 8 } }>
                <CircularProgress sx={ { color: theme.palette.primary.main } } />
            </Box>
        );
    }

    return (
        <Box sx={ { py: 4 } }>
            <Typography
                variant="h4"
                fontWeight={ 600 }
                color="#1a1a1a"
                gutterBottom
                sx={ { fontSize: '1.125rem' } }
            >
                Select Doctor & Schedule Your Visit
            </Typography>
            <Typography
                variant="body2"
                color="#5f6368"
                sx={ { mb: 3, fontSize: '0.875rem' } }
            >
                Find a time that fits your schedule.
            </Typography>
            {/* Doctor Selection */ }
            <Typography
                variant="subtitle1"
                fontWeight={ 500 }
                color="#1a1a1a"
                sx={ { mb: 2, fontSize: '0.875rem' } }
            >
                Choose Your Doctor
            </Typography>

            <Grid container spacing={ 2 } sx={ { mb: 4 } }>
                { doctors.map((doctor) => (
                    <Grid item size={ { xs: 6, md: 3 } } key={ doctor.id }>
                        <Card
                            sx={ {
                                cursor: 'pointer',
                                border: selectedDoctor?.id === doctor.id ? `2px solid ${theme.palette.primary.main} ` : '1px solid #e8eaed',
                                bgcolor: selectedDoctor?.id === doctor.id ? '#f8f9ff' : 'white',
                                transition: 'all 0.2s ease',
                                borderRadius: '8px',
                                boxShadow: 'none',
                                '&:hover': {
                                    borderColor: theme.palette.primary.main,
                                    boxShadow: '0 2px 8px rgba(66, 133, 244, 0.15)',
                                },
                            } }
                            onClick={ () => handleDoctorSelect(doctor) }
                        >
                            <CardContent sx={ { textAlign: 'center', p: 2, height: "150px" } }>
                                <Avatar
                                    src="assets/images/doctor-avatar.jpg"
                                    sx={ {
                                        width: 52,
                                        height: 52,
                                        mx: 'auto',
                                        mb: 2,
                                        bgcolor: theme.palette.primary.main,
                                        fontSize: '1.25rem'
                                    } }
                                >
                                    { doctor.full_name }
                                </Avatar>
                                <Typography
                                    variant="body1"
                                    fontWeight={ 500 }
                                    color="#1a1a1a"
                                    sx={ { fontSize: '0.875rem' } }
                                >
                                    { doctor.full_name }
                                </Typography>
                                <Typography
                                    variant="body2"
                                    color="#5f6368"
                                    sx={ { mb: 1, fontSize: '0.75rem' } }
                                >
                                    Specialization: { doctor.speciality }
                                </Typography>
                                { doctor.rating && (
                                    <Chip
                                        icon={ <Star sx={ { fontSize: 12 } } /> }
                                        label={ `${doctor.rating} (${doctor.years_of_experience}y)` }
                                        size="small"
                                        sx={ {
                                            fontSize: '0.7rem',
                                            height: '20px',
                                            backgroundColor: '#e8f0fe',
                                            color: theme.palette.primary.main
                                        } }
                                    />
                                ) }
                            </CardContent>
                        </Card>
                    </Grid>
                )) }
            </Grid>

            {/* Date & Time Selection */ }
            { selectedDoctor && (
                <Box>
                    <Typography
                        variant="subtitle1"
                        fontWeight={ 500 }
                        sx={ { mb: 2, fontSize: '0.875rem' } }
                    >
                        Select Date & Time
                    </Typography>

                    <Box sx={ { mb: 3 } }>
                        <LocalizationProvider dateAdapter={ AdapterDateFns }>
                            <DatePicker
                                label="Select Date"
                                value={ selectedDate }
                                onChange={ (newValue) => setSelectedDate(newValue) }
                                minDate={ today }
                                maxDate={ nextWeek }
                                slotProps={ {
                                    textField: {
                                        variant: 'outlined', sx: {
                                            fill: theme.palette.primary.main,
                                            '& .MuiInputLabel-root.Mui-error': {
                                                color: theme.palette.primary.main, // or any other color you want
                                            },
                                            '.css-8k08lt-MuiPickersInputBase-root-MuiPickersOutlinedInput-root.Mui-error .MuiPickersOutlinedInput-notchedOutline': {
                                                borderColor: theme.palette.primary.main, // or any other color you want
                                            },
                                        }
                                    }
                                } }
                            />
                        </LocalizationProvider>
                    </Box>

                    { selectedDate && (
                        <Box>
                            <Typography
                                variant="subtitle2"
                                fontWeight={ 500 }
                                color="#1a1a1a"
                                sx={ { mb: 2, fontSize: '0.8rem' } }
                            >
                                Available Times for { new Date(selectedDate).toLocaleDateString() }
                            </Typography>

                            { slotsLoading ? (
                                <Box sx={ { display: 'flex', justifyContent: 'center', py: 4 } }>
                                    <CircularProgress size={ 24 } sx={ { color: theme.palette.primary.main } } />
                                </Box>
                            ) : (
                                <Grid container spacing={ 1 } sx={ { mb: 4 } }>
                                    { timeSlots.filter(slot => slot.available).map((slot, index) => (
                                        <Grid item size={ { xs: 6, sm: 4, md: 2 } } key={ index }>
                                            <Button
                                                variant={ selectedSlot?.id === slot.id ? "contained" : "outlined" }
                                                fullWidth
                                                onClick={ () => handleSlotSelect(slot) }
                                                sx={ {
                                                    py: 1,
                                                    fontSize: '0.75rem',
                                                    borderRadius: '6px',
                                                    textTransform: 'none',
                                                    borderColor: '#e8eaed',
                                                    color: selectedSlot?.id === slot.id ? 'white' : '#1a1a1a',
                                                    backgroundColor: selectedSlot?.id === slot.id ? theme.palette.primary.main : 'white',
                                                    '&:hover': {
                                                        borderColor: theme.palette.primary.main,
                                                        backgroundColor: selectedSlot?.id === slot.id ? theme.palette.primary.main : '#f8f9ff',
                                                    }
                                                } }
                                            >
                                                { slot.start_time } - { slot.end_time }
                                            </Button>
                                        </Grid>
                                    )) }
                                </Grid>
                            ) }
                        </Box>
                    ) }
                </Box>
            ) }

            <Box sx={ { display: 'flex', justifyContent: 'flex-end', mt: 4 } }>
                <Button
                    variant="contained"
                    onClick={ handleNext }
                    disabled={ !selectedDoctor || !selectedDate || !selectedSlot }
                    sx={ {
                        backgroundColor: theme.palette.primary.main,
                        color: 'white',
                        textTransform: 'none',
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        px: 3,
                        py: 1,
                        borderRadius: '6px',
                        boxShadow: 'none',
                        '&:hover': {
                            backgroundColor: theme.palette.primary.main,
                            boxShadow: 'none',
                        },
                        '&:disabled': {
                            backgroundColor: '#f1f3f4',
                            color: '#9aa0a6',
                        }
                    } }
                >
                    Next Step
                </Button>
            </Box>
        </Box>
    );
};

export default DoctorSelector;