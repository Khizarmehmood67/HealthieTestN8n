import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Grid, Card, CardContent, Button, Avatar,
    CircularProgress, IconButton, Paper, Chip, ToggleButton
} from '@mui/material';
import { Checkbox } from '@mui/material';
import { AccessTime, Star, ChevronLeft, ChevronRight, Person, Groups, Check } from '@mui/icons-material';
import healthieAPI from '../services/healthieAPI';
import { useTheme } from '@mui/material/styles';
import { format, addDays, startOfWeek, parseISO, isSameDay, startOfDay, endOfDay } from 'date-fns';
import US_STATES from '../data/UsStates';
import { formatInTimeZone } from 'date-fns-tz';

const DoctorSelector = ({ location, service, onNext, isInsuranceChecked }) => {
    const [currentWeek, setCurrentWeek] = useState(new Date());
    const [availableSlots, setAvailableSlots] = useState([]);
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

    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Fetch doctors on component mount
    useEffect(() => {
        if (location && service) {
            fetchDoctors();
        }
    }, [location, service]);

    // Refetch availability data when week, provider mode, or selected doctor changes
    useEffect(() => {
        if (location && service && doctors.length > 0) {
            fetchAllData();
        }
    }, [currentWeek, doctors]);

    const fetchDoctors = async () => {
        try {
            const stateCode = US_STATES.find(state => state.name === location.location)?.code;
            const doctorsData = await healthieAPI.getProviders(stateCode, service.id);
            if (doctorsData.organizationMembers) {
                const filteredDoctors = doctorsData.organizationMembers
                    .filter(member => member.appointment_types?.some(type => type.id === service.id))
                    .filter(doctor => !isInsuranceChecked || doctor.id !== "10086000");
                setDoctors(filteredDoctors || []);
            }
        } catch (error) {
            console.error('Failed to fetch doctors:', error);
            setDoctors([]);
        }
    };

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const startDate = startOfDay(weekDays[0]).toISOString();
            const endDate = endOfDay(weekDays[weekDays.length - 1]).toISOString();

            let allSlots = [];
            let providerIds = [];

            if (providerMode === 'specific' && selectedDoctor) {
                // Single provider as array for consistency
                providerIds = [selectedDoctor.id];
            } else if (providerMode === 'any') {
                // All provider IDs
                providerIds = doctors.map(d => d.id);
            }

            if (providerIds.length > 0) {
                // Call API for each provider individually
                const slotPromises = providerIds.map(async (providerId) => {
                    try {
                        const slots = await healthieAPI.getAvailableSlotsForProviders(
                            location.id,
                            service.id,
                            startDate,
                            endDate,
                            providerId, // Pass single provider as array
                            userTimeZone,
                            service.contact_type || null
                        );
                        return slots || [];
                    } catch (error) {
                        console.warn(`Failed to fetch slots for provider ${providerId}:`, error);
                        return [];
                    }
                });

                const slotArrays = await Promise.all(slotPromises);
                allSlots = slotArrays.flat();
            }

            setAvailableSlots(allSlots);
            processAvailableSlotsIntoTimeSlots(allSlots);

        } catch (error) {
            console.error('Failed to fetch data:', error);
            setTimeSlotsByDay({});
            setAvailableSlots([]);
        } finally {
            setLoading(false);
        }
    };

const processAvailableSlotsIntoTimeSlots = (slots) => {
        const slotsByDay = {};

        // Initialize all days
        weekDays.forEach(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            slotsByDay[dayKey] = [];
        });


        // Process each slot from the API
        slots.forEach((slot, index) => {
            if (!slot.date) {
                console.warn(`Slot ${index} missing date:`, slot);
                return;
            }

            // Skip fully booked slots or ones with existing appointments
            if (slot.is_fully_booked || slot.appointment_id) {
                return;
            }

            const slotDate = new Date(slot.date);
            const dayKey = format(parseISO(slot.date), 'yyyy-MM-dd');

            if (!slotsByDay.hasOwnProperty(dayKey)) return;

            // Find the doctor for this slot
            const slotDoctor = doctors.find(d => d.id === slot.user_id);

            // 3. Format the time using the user's declared time zone (userTimeZone).
            //    This is the crucial change to fix the display issue.
            const displayTime = formatInTimeZone(
                slotDate,
                userTimeZone, // Variable containing 'America/Los_Angeles' or similar
                'h:mm a'
            );

            // Create the processed slot
            const processedSlot = {
                id: `${slot.user_id}-${slot.date}`,
                time: displayTime, // <-- NOW uses the time formatted in the user's time zone
                datetime: slot.date,
                available: !slot.is_fully_booked && !slot.appointment_id,
                providerId: slot.user_id,
                appointment_id: slot.appointment_id,
                is_fully_booked: slot.is_fully_booked,
                has_waitlist_enabled: slot.has_waitlist_enabled,
                doctor: slotDoctor,
                rawSlot: slot
            };

            // Check for duplicate slots (same time and provider)
            const existingSlot = slotsByDay[dayKey].find(s =>
                s.datetime === processedSlot.datetime && s.providerId === processedSlot.providerId
            );

            if (!existingSlot) {
                slotsByDay[dayKey].push(processedSlot);
            }
        });

        // Sort slots by time and handle deduplication for "any" mode
        Object.keys(slotsByDay).forEach(dayKey => {
            // Sort by time first
            slotsByDay[dayKey].sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
            if (providerMode === 'any') {
                const uniqueSlots = [];
                const seenTimes = new Set();

                slotsByDay[dayKey].forEach(slot => {
                    if (!seenTimes.has(slot.time)) {
                        seenTimes.add(slot.time);
                        uniqueSlots.push(slot);
                    }
                });

                slotsByDay[dayKey] = uniqueSlots;
            }
        });

        setTimeSlotsByDay(slotsByDay);
    };

    const handleSlotSelect = (slot) => {
        setSelectedSlot(slot);

        // Auto-select provider if in "any" mode
        if (providerMode === 'any' && slot.providerId) {
            const provider = doctors.find(d => d.id === slot.providerId);
            if (provider) {
                setSelectedDoctor(provider);
            }
        }
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
            setSelectedDoctor(null);
        } else {
            setSelectedDoctor(doctor);
        }
        setSelectedSlot(null);
    };

    const handleNext = () => {
        if (selectedSlot) {
            const appointmentData = {
                doctor: selectedDoctor || selectedSlot.doctor?.id,
                date: selectedSlot.datetime,
                startTime: selectedSlot.time,
                slotId: selectedSlot.id,
                providerId: selectedSlot.providerId,
                doctorName: selectedSlot.doctor?.full_name || selectedSlot.doctor?.name,
                slotData: selectedSlot.rawSlot // Pass the original slot data
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

    const TEXT_NUMBER = '3035221286';
    const EMAIL_ADDRESS = 'urgent@recoverydelivered.com';

    return (
        <Box sx={ { py: 4 } }>
            <Typography variant="h5" fontWeight={ 600 } color="#1a1a1a" gutterBottom sx={ { mb: 1 } }>
                Select Your Appointment Time
            </Typography>
            <Typography variant="body2" color="#5f6368" sx={ { mb: 3 } }>
                Choose your preferred provider and available time slot
            </Typography>

            {/* Provider Selection Toggle */ }
            {/* <ToggleButtonGroup
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
            </ToggleButtonGroup> */}

            {/* { availableSlots.length === 0 && ( */ }
            <Box sx={ { mb: 1.5, display: { xs: 'block', sm: 'flex' }, alignItems: 'center', gap: 2 } }>
                <Typography variant="body2" color="textSecondary">
                    Don't see a time, Need to see a provider today?
                </Typography>
                <Button
                    variant='contained'
                    component="a" // Use 'a' component to enable the href
                    href={ `mailto:${EMAIL_ADDRESS}` } // Mailto protocol
                    sx={ {
                        color: "#fff",
                        maxWidth: 120,
                        padding: "6px 8px",
                        lineHeight: 1.2,
                        // Hide on small screens (mobile)
                        display: { xs: 'none', sm: 'block' }
                    } }
                >
                    Email us
                </Button>
                <Button
                    variant='contained'
                    component="a" // Use 'a' component to enable the href
                    href={ `tel:${TEXT_NUMBER}` } // Tel protocol
                    sx={ {
                        color: "#fff",
                        maxWidth: 90,
                        mt: 1,
                        // Hide on medium/large screens (web/desktop)
                        display: { xs: 'block', sm: 'none' }
                    } }
                >
                    Text us
                </Button>
            </Box>
            {/* ) } */ }

            {/* Doctor Selection */ }
            { providerMode === 'specific' && (
                <Box sx={ { mb: 3 } }>
                    <Box display="flex" gap="10px">
                        <Typography variant="subtitle2" fontWeight={ 500 } sx={ { mb: 2 } }>
                            Select a Provider:
                        </Typography>

                        { selectedDoctor && (
                            <Chip
                                avatar={ <Avatar sx={ { width: 20, height: 20, ml: 6 } }>{ selectedDoctor.full_name?.charAt(0) }</Avatar> }
                                label={ `Dr. ${selectedDoctor.full_name}` }
                                size="small"
                            />
                        ) }
                    </Box>
                    <Grid container spacing={ 1.5 }>
                        { doctors.map((doctor) => (
                            <Grid item xs={ 6 } sm={ 4 } md={ 3 } size={ { xs: 6, sm: 4, md: 3 } } key={ doctor.id }>
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
                                            src={ "/assets/doctor-avatar.jpg" }
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
                        { doctors.length === 0 && (
                            <Box sx={ { p: 2 } }>
                                <Typography variant="body2" color="textSecondary">
                                    No provider available in selected location & service
                                </Typography>
                            </Box>
                        ) }
                    </Grid>
                </Box>
            ) }

            {/* Calendar View */ }

            <Paper elevation={ 0 } sx={ { border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden', position: "relative" } }>
                {/* Week Navigation */ }
                { loading &&
                    <Box sx={ {
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center'
                    } }>
                        <CircularProgress sx={ { color: theme.palette.primary.main } } />
                    </Box>
                }
                <Box sx={ { display: 'flex', alignItems: 'center', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e0e0e0', position: "relative" } }>
                    <IconButton onClick={ () => navigateWeek(-1) } size="small" sx={ { position: "absolute" } }>
                        <ChevronLeft />
                    </IconButton>

                    <Grid container sx={ { flex: 1 } }>
                        { weekDays.map((day, index) => (
                            <Grid item size={ { xs: 3, md: 1.714 } } key={ day.toISOString() }>
                                <Box
                                    sx={ {
                                        textAlign: 'center',
                                        py: { xs: 1, sm: 2 },
                                        mr: "-1px",
                                        borderRight: index < weekDays.length - 1 ? '1px solid #e0e0e0' : 'none',
                                        backgroundColor: isSameDay(day, new Date()) ? '#e8f4fd' : 'transparent'
                                    } }
                                >
                                    <Typography variant="caption" color="textSecondary" sx={ { display: { xs: 'none', sm: 'block' }, } }>
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

                    <IconButton onClick={ () => navigateWeek(1) } size="small" sx={ { position: "absolute", right: 0 } }>
                        <ChevronRight />
                    </IconButton>
                </Box>

                {/* Time Slots Grid */ }
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
                                        minWidth: { xs: '100px', sm: 'auto' },
                                        minHeight: { xs: 'auto', md: '400px' }
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
                                                        flexDirection: "column",
                                                        color: "#000",
                                                        borderColor: selectedSlot?.id === slot.id ? theme.palette.primary.main : '#e0e0e0',
                                                        backgroundColor: selectedSlot?.id === slot.id ? theme.palette.primary.light : 'white',
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
                                                    { providerMode === 'any' && slot.doctor && (
                                                        <Typography
                                                            variant="caption"
                                                            sx={ {
                                                                display: 'block',
                                                                fontSize: '0.6rem',
                                                                opacity: 0.7
                                                            } }
                                                        >
                                                            { slot.doctor.full_name?.split(' ')[0] }
                                                        </Typography>
                                                    ) }
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