import React from 'react';
import {
    Box, Typography, Card, CardContent, Button, Divider,
    List, ListItem, ListItemIcon, ListItemText, Alert, Stack, Link
} from '@mui/material';
import {
    CheckCircle, Email, Event, Person, LocationOn, AttachMoney
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

const BookingConfirmation = ({ bookingData }) => {
    const handleNewBooking = () => {
        window.location.reload();
    };
    const theme = useTheme();

    // Store Badge URLs (Standard SVGs)
    const googlePlayUrl = "https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg";
    const appStoreUrl = "https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg";

    return (
        <Box sx={{ maxWidth: 600, mx: 'auto', py: 4, px: 2 }}>
            {/* Header Section */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
                <CheckCircle sx={{ fontSize: 64, color: '#34a853', mb: 2 }} />
                <Typography variant="h4" fontWeight={600} color="#34a853" gutterBottom>
                    Thanks, Your Booking Confirmed!
                </Typography>
                <Typography variant="body1" color="#5f6368">
                    Your appointment has been successfully scheduled
                </Typography>
                {bookingData.payment?.confirmationCode && (
                    <Typography variant="h6" color="#4285f4" sx={{ mt: 2 }}>
                        Confirmation: {bookingData.payment.confirmationCode}
                    </Typography>
                )}
            </Box>

            {/* Appointment Details Card */}
            <Card sx={{ mb: 3, borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <CardContent sx={{ p: 4 }}>
                    <Typography variant="h6" fontWeight={600} gutterBottom>
                        Appointment Details
                    </Typography>
                    <Divider sx={{ mb: 3 }} />

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Person sx={{ mr: 2, color: '#5f6368' }} />
                            <Box>
                                <Typography variant="body2" color="#5f6368">Doctor</Typography>
                                <Typography variant="body1" fontWeight={500}>
                                    {bookingData.appointment?.doctorName || bookingData.appointment?.doctor?.full_name || 'N/A'}
                                </Typography>
                            </Box>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Event sx={{ mr: 2, color: '#5f6368' }} />
                            <Box>
                                <Typography variant="body2" color="#5f6368">Date & Time</Typography>
                                <Typography variant="body1" fontWeight={500}>
                                    {new Date(bookingData.appointment?.date).toLocaleDateString()} at {bookingData.appointment?.startTime} - {bookingData.appointment?.endTime}
                                </Typography>
                            </Box>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <LocationOn sx={{ mr: 2, color: '#5f6368' }} />
                            <Box>
                                <Typography variant="body2" color="#5f6368">Service & Location</Typography>
                                <Typography variant="body1" fontWeight={500}>
                                    {bookingData.service?.name} in {bookingData.location?.location}
                                </Typography>
                            </Box>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <AttachMoney sx={{ mr: 2, color: '#5f6368' }} />
                            <Box>
                                <Typography variant="body2" color="#5f6368">Amount Paid</Typography>
                                <Typography variant="body1" fontWeight={500}>
                                    {bookingData.payment?.amount || bookingData.service?.pricing}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            {/* Next Steps Card */}
            <Card sx={{ mb: 3, borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" fontWeight={600} gutterBottom>
                        What's Next?
                    </Typography>
                    <List disablePadding>
                        <ListItem disableGutters>
                            <ListItemIcon sx={{ minWidth: 40 }}>
                                <Email sx={{ color: theme.palette.primary.main }} />
                            </ListItemIcon>
                            <ListItemText
                                primary="Check your email for confirmation"
                                secondary="A detailed summary has been sent to your inbox"
                            />
                        </ListItem>
                    </List>
                </CardContent>
            </Card>

            <Alert severity="info" sx={{ mb: 4 }}>
                Need to reschedule? Contact us at least 24 hours before your appointment.
            </Alert>

            {/* Action Buttons & App Links */}
            <Box sx={{ textAlign: 'center' }}>
                <Button
                    variant="contained"
                    size="large"
                    onClick={handleNewBooking}
                    sx={{
                        backgroundColor: theme.palette.primary.main,
                        textTransform: 'none',
                        fontWeight: 600,
                        px: 6,
                        py: 1.5,
                        borderRadius: '8px',
                        mb: 4
                    }}
                >
                    Book Another Appointment
                </Button>

                <Divider sx={{ mb: 3 }}>
                    <Typography variant="body2" color="textSecondary">
                        GET THE APP
                    </Typography>
                </Divider>

                <Stack
                    direction="row"
                    spacing={2}
                    justifyContent="center"
                    sx={{ mb: 2 }}
                >
                    <Link href="https://play.google.com/store" target="_blank" rel="noopener">
                        <Box
                            component="img"
                            src={googlePlayUrl}
                            alt="Google Play"
                            sx={{ height: 40, '&:hover': { opacity: 0.8 } }}
                        />
                    </Link>
                    <Link href="https://www.apple.com/app-store/" target="_blank" rel="noopener">
                        <Box
                            component="img"
                            src={appStoreUrl}
                            alt="App Store"
                            sx={{ height: 40, '&:hover': { opacity: 0.8 } }}
                        />
                    </Link>
                </Stack>
                <Typography variant="caption" color="textSecondary">
                    Available for iOS and Android
                </Typography>
            </Box>
        </Box>
    );
};

export default BookingConfirmation;