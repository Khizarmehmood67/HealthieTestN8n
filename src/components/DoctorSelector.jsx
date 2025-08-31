import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Grid, Card, CardContent, Button, Avatar,
    CircularProgress, IconButton, Paper, Chip, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import { AccessTime, Star, ChevronLeft, ChevronRight, Person, Groups } from '@mui/icons-material';
import healthieAPI from '../services/healthieAPI';
import { useTheme } from '@mui/material/styles';
import { format, addDays, startOfWeek, parseISO, isSameDay, startOfDay, endOfDay } from 'date-fns';

const DoctorSelector = ({ location, service, onNext }) => {
    const [currentWeek, setCurrentWeek] = useState(new Date());
    const [availabilities, setAvailabilities] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [selectedDoctor, setSelectedDoctor] = useState(null);
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [timeSlotsByDay, setTimeSlotsByDay] = useState({});
    const [providerMode, setProviderMode] = useState('any'); // 'any' or 'specific'
    const theme = useTheme();

    // Generate week days (7 days for full week view)
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(startOfWeek(currentWeek, { weekStartsOn: 1 }), i);
        return date;
    });

    // Fetch doctors on component mount
    useEffect(() => {
        if (location && service) {
            fetchDoctors();
            // Fetch availabilities for any provider by default
            fetchAvailabilities();
        }
    }, [location, service]);

    // Refetch availabilities when week, provider mode, or selected doctor changes
    useEffect(() => {
        if (location && service) {
            fetchAvailabilities();
        }
    }, [currentWeek, providerMode, selectedDoctor]);

    const fetchAvailabilities = async () => {
        setLoading(true);
        try {
            const startDate = startOfDay(weekDays[0]);
            const endDate = endOfDay(weekDays[weekDays.length - 1]);

            console.log('Fetching availabilities:', {
                mode: providerMode,
                doctorId: providerMode === 'specific' ? selectedDoctor?.id : null,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            });

            const data = await healthieAPI.getAvailabilities(
                location.id,
                service.id,
                startDate.toISOString(),
                endDate.toISOString(),
                providerMode === 'specific' && selectedDoctor ? selectedDoctor.id : null
            );

            if (data) {
                setAvailabilities(data.availabilities || []);
                setAppointments(data.appointments || []);
                processAvailabilitiesIntoSlots(data.availabilities || [], data.appointments || []);
            }
        } catch (error) {
            console.error('Failed to fetch availabilities:', error);
            generateMockTimeSlots();
        } finally {
            setLoading(false);
        }
    };

    const fetchDoctors = async () => {
        try {
            const doctorsData = await healthieAPI.getProviders(location.id, service.id);
            setDoctors(doctorsData || []);
        } catch (error) {
            console.error('Failed to fetch doctors:', error);
            setDoctors([]);
        }
    };

    const processAvailabilitiesIntoSlots = (avails, apts) => {
        const slotsByDay = {};

        weekDays.forEach(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            slotsByDay[dayKey] = [];
        });

        avails.forEach(avail => {
            if (!avail.range_start || !avail.range_end) return;

            const availStart = new Date(avail.range_start);
            const availEnd = new Date(avail.range_end);
            const dayKey = format(availStart, 'yyyy-MM-dd');

            if (!slotsByDay.hasOwnProperty(dayKey)) return;

            let slotStart = new Date(availStart);

            while (slotStart < availEnd && slotsByDay[dayKey].length < 20) {
                const slotEnd = new Date(slotStart);
                slotEnd.setMinutes(slotEnd.getMinutes() + 15);

                if (slotEnd > availEnd) break;

                const isBooked = apts.some(apt => {
                    if (!apt.start || !apt.end) return false;
                    const aptStart = new Date(apt.start);
                    const aptEnd = new Date(apt.end);
                    return (
                        (slotStart >= aptStart && slotStart < aptEnd) ||
                        (slotEnd > aptStart && slotEnd <= aptEnd) ||
                        (slotStart <= aptStart && slotEnd >= aptEnd) ||
                        (aptStart <= slotStart && aptEnd >= slotEnd)
                    );
                });

                const isBlocker = apts.some(apt => {
                    if (!apt.is_blocker || !apt.start || !apt.end) return false;
                    const aptStart = new Date(apt.start);
                    const aptEnd = new Date(apt.end);
                    return slotStart >= aptStart && slotStart < aptEnd;
                });

                if (!isBooked && !isBlocker) {
                    slotsByDay[dayKey].push({
                        id: `${avail.id}-${slotStart.toISOString()}`,
                        time: format(slotStart, 'h:mm a'),
                        datetime: slotStart.toISOString(),
                        available: true,
                        providerId: avail.user_id,
                        availabilityId: avail.id
                    });
                }

                slotStart = new Date(slotEnd);
            }
        });

        Object.keys(slotsByDay).forEach(dayKey => {
            slotsByDay[dayKey].sort((a, b) =>
                new Date(a.datetime) - new Date(b.datetime)
            );
        });

        console.log('Processed slots:', Object.keys(slotsByDay).map(key => ({
            day: key,
            count: slotsByDay[key].length
        })));

        setTimeSlotsByDay(slotsByDay);
    };

    const generateMockTimeSlots = () => {
        const mockSlots = {};
        const mockTimes = [
            '9:00 AM', '9:15 AM', '9:30 AM', '9:45 AM',
            '10:00 AM', '10:15 AM', '10:30 AM', '10:45 AM',
            '11:00 AM', '11:15 AM', '11:30 AM', '11:45 AM',
            '2:00 PM', '2:15 PM', '2:30 PM', '2:45 PM',
            '3:00 PM', '3:15 PM', '3:30 PM', '3:45 PM'
        ];

        weekDays.forEach(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const numSlots = Math.floor(Math.random() * 6) + 5;
            const selectedTimes = mockTimes
                .sort(() => Math.random() - 0.5)
                .slice(0, numSlots)
                .sort();

            mockSlots[dayKey] = selectedTimes.map((time, index) => ({
                id: `mock-${dayKey}-${index}`,
                time: time,
                datetime: new Date(`${dayKey}T${convertTo24Hour(time)}`).toISOString(),
                available: true,
                providerId: 'mock-provider'
            }));
        });

        setTimeSlotsByDay(mockSlots);
    };

    const convertTo24Hour = (time12h) => {
        const [time, modifier] = time12h.split(' ');
        let [hours, minutes] = time.split(':');
        hours = parseInt(hours, 10);

        if (modifier === 'PM' && hours !== 12) {
            hours = hours + 12;
        }
        if (modifier === 'AM' && hours === 12) {
            hours = 0;
        }

        return `${hours.toString().padStart(2, '0')}:${minutes}:00`;
    };

    const handleProviderModeChange = (event, newMode) => {
        if (newMode !== null) {
            setProviderMode(newMode);
            if (newMode === 'any') {
                setSelectedDoctor(null);
            }
            setSelectedSlot(null);
        }
    };

    const handleDoctorSelect = (doctor) => {
        if (selectedDoctor?.id === doctor.id) {
            // Deselect if clicking the same doctor
            setSelectedDoctor(null);
        } else {
            setSelectedDoctor(doctor);
        }
        setSelectedSlot(null);
    };

    const handleSlotSelect = (slot) => {
        setSelectedSlot(slot);

        // If in "any provider" mode and slot has a provider, auto-select that provider
        if (providerMode === 'any' && slot.providerId) {
            const provider = doctors.find(d => d.id === slot.providerId);
            if (provider) {
                setSelectedDoctor(provider);
            }
        }
    };

    const handleNext = () => {
        if (selectedSlot) {
            const appointmentData = {
                doctor: selectedDoctor,
                date: selectedSlot.datetime,
                startTime: selectedSlot.time,
                slotId: selectedSlot.id,
                availabilityId: selectedSlot.availabilityId,
                providerId: selectedSlot.providerId
            };
            onNext(appointmentData);
        }
    };

    const navigateWeek = (direction) => {
        setCurrentWeek(prev => addDays(prev, direction * 7));
        setSelectedSlot(null);
    };

    const getWeeksFromNow = () => {
        const today = new Date();
        const diff = Math.ceil((weekDays[0] - today) / (1000 * 60 * 60 * 24 * 7));
        if (diff === 0) return 'THIS WEEK';
        if (diff === 1) return 'NEXT WEEK';
        if (diff === 2) return 'IN 2 WEEKS';
        if (diff === 3) return 'IN 3 WEEKS';
        return `IN ${diff} WEEKS`;
    };

    return (
        <Box sx={ { py: 4 } }>
            <Typography variant="h5" fontWeight={ 600 } color="#1a1a1a" gutterBottom sx={ { mb: 1 } }>
                Select Your Appointment Time
            </Typography>
            <Typography variant="body2" color="#5f6368" sx={ { mb: 3 } }>
                Choose your preferred provider and available time slot
            </Typography>

            {/* Provider Selection Toggle */ }
            <Box sx={ { mb: 3, display: 'flex', alignItems: 'center', gap: 2 } }>
                <ToggleButtonGroup
                    value={ providerMode }
                    exclusive
                    onChange={ handleProviderModeChange }
                    size="small"
                >
                    <ToggleButton value="any">
                        <Groups sx={ { mr: 1, fontSize: 20 } } />
                        Any Provider
                    </ToggleButton>
                    <ToggleButton value="specific">
                        <Person sx={ { mr: 1, fontSize: 20 } } />
                        Specific Provider
                    </ToggleButton>
                </ToggleButtonGroup>

                { selectedDoctor && (
                    <Chip
                        avatar={ <Avatar sx={ { width: 24, height: 24 } }>{ selectedDoctor.full_name?.charAt(0) }</Avatar> }
                        label={ `Dr. ${selectedDoctor.full_name}` }
                        color="primary"
                        size="small"
                    />
                ) }
            </Box>

            {/* Doctor Selection (shown when specific provider mode is selected) */ }
            { providerMode === 'specific' && (
                <Box sx={ { mb: 3 } }>
                    <Typography variant="subtitle2" fontWeight={ 500 } sx={ { mb: 2 } }>
                        Select a Provider:
                    </Typography>
                    <Grid container spacing={ 1.5 }>
                        { doctors.map((doctor) => (
                            <Grid item size={ { xs: 6, sm: 4, md: 3 } } key={ doctor.id }>
                                <Card
                                    sx={ {
                                        cursor: 'pointer',
                                        border: selectedDoctor?.id === doctor.id ? `2px solid ${theme.palette.primary.main}` : '1px solid #e0e0e0',
                                        bgcolor: selectedDoctor?.id === doctor.id ? '#f8f9ff' : 'white',
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            borderColor: theme.palette.primary.main,
                                            bgcolor: '#f5f5f5',
                                        },
                                    } }
                                    onClick={ () => handleDoctorSelect(doctor) }
                                >
                                    <CardContent sx={ { p: 1.5, textAlign: 'center' } }>
                                        <Avatar
                                            src={ doctor.avatar_url }
                                            sx={ {
                                                width: 40,
                                                height: 40,
                                                mx: 'auto',
                                                mb: 0.5,
                                                bgcolor: theme.palette.primary.main,
                                                fontSize: '1rem'
                                            } }
                                        >
                                            { doctor.full_name?.charAt(0) }
                                        </Avatar>
                                        <Typography variant="body2" fontWeight={ 500 } sx={ { fontSize: '0.875rem' } }>
                                            { doctor.full_name }
                                        </Typography>
                                        <Typography variant="caption" color="textSecondary" sx={ { fontSize: '0.75rem' } }>
                                            { doctor.speciality }
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        )) }
                    </Grid>
                </Box>
            ) }

            {/* Timezone Display */ }
            <Box sx={ { mb: 2, display: 'flex', justifyContent: 'center' } }>
                <Typography variant="caption" color="textSecondary" sx={ { fontWeight: 500 } }>
                    TIME ZONE: Russia - Yekaterinburg (GMT+05:00)
                </Typography>
            </Box>

            {/* Calendar View */ }
            { loading ? (
                <Box sx={ { display: 'flex', justifyContent: 'center', py: 8 } }>
                    <CircularProgress sx={ { color: theme.palette.primary.main } } />
                </Box>
            ) : (
                <Paper elevation={ 0 } sx={ { border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' } }>
                    {/* Week Navigation */ }
                    <Box sx={ {
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: '#f8f9fa',
                        borderBottom: '1px solid #e0e0e0'
                    } }>
                        <IconButton onClick={ () => navigateWeek(-1) } size="small">
                            <ChevronLeft />
                        </IconButton>

                        <Grid container sx={ { flex: 1 } }>
                            { weekDays.map((day, index) => (
                                <Grid item size={ { xs: 12 / 7 } } key={ day.toISOString() }>
                                    <Box sx={ {
                                        textAlign: 'center',
                                        py: { xs: 1, sm: 2 },
                                        borderRight: index < weekDays.length - 1 ? '1px solid #e0e0e0' : 'none',
                                        backgroundColor: isSameDay(day, new Date()) ? '#e8f4fd' : 'transparent'
                                    } }>
                                        <Typography variant="caption" color="textSecondary" sx={ { display: { xs: 'none', sm: 'block' }, mb: 0.5 } }>
                                            { index === Math.floor(weekDays.length / 2) ? getWeeksFromNow() : '\u00A0' }
                                        </Typography>
                                        <Typography variant="subtitle2" fontWeight={ 600 } sx={ { fontSize: { xs: '0.7rem', sm: '0.875rem' } } }>
                                            { format(day, 'EEE') }
                                        </Typography>
                                        <Typography variant="body2" color="textSecondary" sx={ { fontSize: { xs: '0.65rem', sm: '0.875rem' } } }>
                                            { format(day, 'MMM d') }
                                        </Typography>
                                    </Box>
                                </Grid>
                            )) }
                        </Grid>

                        <IconButton onClick={ () => navigateWeek(1) } size="small">
                            <ChevronRight />
                        </IconButton>
                    </Box>

                    {/* Time Slots Grid - Mobile Responsive */ }
                    <Box sx={ { minHeight: { xs: '300px', sm: '400px' }, overflowX: { xs: 'auto', md: 'hidden' } } }>
                        <Box sx={ { display: 'flex', minWidth: { xs: '700px', md: 'auto' } } }>
                            { weekDays.map((day, dayIndex) => {
                                const dayKey = format(day, 'yyyy-MM-dd');
                                const slots = timeSlotsByDay[dayKey] || [];
                                const isPastDay = day < startOfDay(new Date());

                                return (
                                    <Box
                                        key={ day.toISOString() }
                                        sx={ {
                                            flex: 1,
                                            borderRight: dayIndex < weekDays.length - 1 ? '1px solid #e0e0e0' : 'none',
                                            backgroundColor: isPastDay ? '#fafafa' : 'white',
                                            minWidth: { xs: '100px', sm: 'auto' }
                                        } }
                                    >
                                        <Box sx={ { p: { xs: 0.5, sm: 1 }, maxHeight: { xs: '300px', sm: '400px' }, overflowY: 'auto' } }>
                                            { slots.length === 0 ? (
                                                <Typography
                                                    variant="caption"
                                                    color="textSecondary"
                                                    sx={ {
                                                        display: 'block',
                                                        textAlign: 'center',
                                                        mt: 2,
                                                        fontSize: { xs: '0.65rem', sm: '0.75rem' }
                                                    } }
                                                >
                                                    { isPastDay ? 'Past date' : 'No slots' }
                                                </Typography>
                                            ) : (
                                                slots.map((slot) => (
                                                    <Button
                                                        key={ slot.id }
                                                        variant="outlined"
                                                        fullWidth
                                                        size="small"
                                                        onClick={ () => handleSlotSelect(slot) }
                                                        disabled={ !slot.available || isPastDay }
                                                        sx={ {
                                                            mb: 0.5,
                                                            py: { xs: 0.5, sm: 1 },
                                                            px: { xs: 0.5, sm: 1 },
                                                            fontSize: { xs: '0.65rem', sm: '0.75rem' },
                                                            fontWeight: 400,
                                                            minWidth: 0,
                                                            borderColor: selectedSlot?.id === slot.id ? theme.palette.primary.main : '#e0e0e0',
                                                            backgroundColor: selectedSlot?.id === slot.id ? theme.palette.primary.light : 'white',
                                                            color: selectedSlot?.id === slot.id ? theme.palette.primary.main : '#333',
                                                            '&:hover': {
                                                                borderColor: theme.palette.primary.main,
                                                                backgroundColor: '#f0f7ff'
                                                            },
                                                            '&:disabled': {
                                                                backgroundColor: '#f5f5f5',
                                                                color: '#999'
                                                            }
                                                        } }
                                                    >
                                                        { slot.time }
                                                    </Button>
                                                ))
                                            ) }
                                        </Box>
                                    </Box>
                                );
                            }) }
                        </Box>
                    </Box>
                </Paper>
            ) }

            {/* Selected Summary */ }
            { selectedSlot && (
                <Paper
                    elevation={ 0 }
                    sx={ {
                        mt: 4,
                        p: 2,
                        backgroundColor: '#f0f7ff',
                        border: `1px solid ${theme.palette.primary.main}`,
                        borderRadius: '8px'
                    } }
                >
                    <Typography variant="body2" fontWeight={ 500 } color={ theme.palette.primary.main }>
                        Selected Appointment:
                    </Typography>
                    <Typography variant="body2" sx={ { mt: 0.5 } }>
                        { selectedSlot.time } on { format(parseISO(selectedSlot.datetime), 'EEEE, MMMM d, yyyy') }
                        { selectedDoctor && ` with Dr. ${selectedDoctor.full_name}` }
                    </Typography>
                </Paper>
            ) }

            {/* Next Button */ }
            <Box sx={ { display: 'flex', justifyContent: 'flex-end', mt: 4 } }>
                <Button
                    variant="contained"
                    onClick={ handleNext }
                    disabled={ !selectedSlot }
                    sx={ {
                        backgroundColor: theme.palette.primary.main,
                        color: 'white',
                        textTransform: 'none',
                        fontWeight: 500,
                        px: 4,
                        py: 1.5,
                        borderRadius: '8px',
                        boxShadow: 'none',
                        '&:hover': {
                            backgroundColor: theme.palette.primary.dark,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        },
                        '&:disabled': {
                            backgroundColor: '#f1f3f4',
                            color: '#9aa0a6',
                        }
                    } }
                >
                    Continue to Booking
                </Button>
            </Box>
        </Box>
    );
};

export default DoctorSelector;