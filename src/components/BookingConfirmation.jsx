import React from 'react';
import {
    Box, Typography, Card, CardContent, Button, Divider,
    List, ListItem, ListItemIcon, ListItemText, Alert
} from '@mui/material';
import {
    CheckCircle, Email, VideoCall, Event, Person, LocationOn, AttachMoney
} from '@mui/icons-material';

const BookingConfirmation = ({ bookingData }) => {
    const handleNewBooking = () => {
        window.location.reload();
    };

    return (
        <Box sx={ { maxWidth: 600, mx: 'auto', py: 4 } }>
            <Box sx={ { textAlign: 'center', mb: 4 } }>
                <CheckCircle sx={ { fontSize: 64, color: '#34a853', mb: 2 } } />
                <Typography variant="h4" fontWeight={ 600 } color="#34a853" gutterBottom>
                    Booking Confirmed!
                </Typography>
                <Typography variant="body1" color="#5f6368">
                    Your appointment has been successfully scheduled
                </Typography>
                { bookingData.payment?.confirmation && (
                    <Typography variant="h6" color="#4285f4" sx={ { mt: 2 } }>
                        Confirmation: { bookingData.payment.confirmation }
                    </Typography>
                ) }
            </Box>

            <Card sx={ { mb: 4, borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' } }>
                <CardContent sx={ { p: 4 } }>
                    <Typography variant="h6" fontWeight={ 600 } gutterBottom>
                        Appointment Details
                    </Typography>
                    <Divider sx={ { mb: 3 } } />

                    <Box sx={ { mb: 3 } }>
                        <Box sx={ { display: 'flex', alignItems: 'center', mb: 2 } }>
                            <Person sx={ { mr: 2, color: '#5f6368' } } />
                            <Box>
                                <Typography variant="body2" color="#5f6368">Doctor</Typography>
                                <Typography variant="body1" fontWeight={ 500 }>
                                    { bookingData.appointment?.doctor.first_name } { bookingData.appointment?.doctor.last_name }
                                </Typography>
                            </Box>
                        </Box>

                        <Box sx={ { display: 'flex', alignItems: 'center', mb: 2 } }>
                            <Event sx={ { mr: 2, color: '#5f6368' } } />
                            <Box>
                                <Typography variant="body2" color="#5f6368">Date & Time</Typography>
                                <Typography variant="body1" fontWeight={ 500 }>
                                    { new Date(bookingData.appointment?.date).toLocaleDateString() } at { bookingData.appointment?.startTime } - { bookingData.appointment?.endTime }
                                </Typography>
                            </Box>
                        </Box>

                        <Box sx={ { display: 'flex', alignItems: 'center', mb: 2 } }>
                            <LocationOn sx={ { mr: 2, color: '#5f6368' } } />
                            <Box>
                                <Typography variant="body2" color="#5f6368">Service & Location</Typography>
                                <Typography variant="body1" fontWeight={ 500 }>
                                    { bookingData.service?.name } in { bookingData.location?.name }
                                </Typography>
                            </Box>
                        </Box>

                        <Box sx={ { display: 'flex', alignItems: 'center' } }>
                            <AttachMoney sx={ { mr: 2, color: '#5f6368' } } />
                            <Box>
                                <Typography variant="body2" color="#5f6368">Amount Paid</Typography>
                                <Typography variant="body1" fontWeight={ 500 }>
                                    ${ bookingData.payment?.amount || bookingData.service?.pricing_info?.price }
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            <Card sx={ { mb: 4, borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' } }>
                <CardContent sx={ { p: 4 } }>
                    <Typography variant="h6" fontWeight={ 600 } gutterBottom>
                        What's Next?
                    </Typography>
                    <List>
                        <ListItem>
                            <ListItemIcon>
                                <Email sx={ { color: '#4285f4' } } />
                            </ListItemIcon>
                            <ListItemText
                                primary="Check your email for confirmation details"
                                secondary="You'll receive a detailed confirmation with all appointment information"
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemIcon>
                                <VideoCall sx={ { color: '#4285f4' } } />
                            </ListItemIcon>
                            <ListItemText
                                primary="Join the video call 15 minutes early"
                                secondary="You'll receive a secure video call link before your appointment"
                            />
                        </ListItem>
                    </List>
                </CardContent>
            </Card>

            <Alert severity="info" sx={ { mb: 4 } }>
                Need to reschedule or cancel? Contact our support team at least 24 hours before your appointment.
            </Alert>

            <Box sx={ { textAlign: 'center' } }>
                <Button
                    variant="contained"
                    size="large"
                    onClick={ handleNewBooking }
                    sx={ {
                        backgroundColor: '#4285f4',
                        color: 'white',
                        textTransform: 'none',
                        fontWeight: 500,
                        px: 4,
                        py: 1.5,
                        borderRadius: '6px',
                        boxShadow: 'none',
                        '&:hover': {
                            backgroundColor: '#3367d6',
                            boxShadow: 'none',
                        }
                    } }
                >
                    Book Another Appointment
                </Button>
            </Box>
        </Box>
    );
};

export default BookingConfirmation;