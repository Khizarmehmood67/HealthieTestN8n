import React from 'react';
import { Box, Typography } from '@mui/material';

const BookingHeader = () => {
    return (
        <Box sx={ { mb: 2 } }>
            <Box sx={ { textAlign: 'center', } }>
                <img
                    src="assets/images/logo.png"
                    alt="Booking Logo"
                    style={ { width: 100, height: 'auto', backgroundColor: "#49C7AB", borderRadius: "10%" } }
                />
            </Box>
            <Typography
                variant="h4"
                fontWeight={ 600 }
                color="#1a1a1a"
                gutterBottom
                sx={ { mb: 1 } }
            >
                Let’s Get Started
            </Typography>
            <Typography
                variant="body1"
                color="#6b7280"
                sx={ { fontSize: '0.875rem' } }
            >
                You are taking the first step towards better health.
            </Typography>
        </Box>
    );
};

export default BookingHeader;