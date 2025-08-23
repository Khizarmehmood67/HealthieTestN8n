import React from 'react';
import { Box, Typography } from '@mui/material';

const BookingHeader = () => {
    return (
        <Box sx={ { mb: 4 } }>
            <Box sx={ { textAlign: 'center', } }>
                <img
                    src="https://www.recoverydelivered.com/wp-content/uploads/2022/05/rec-del-logo-color.png"
                    alt="Booking Logo"
                    style={ { width: 120, height: 'auto', } }
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