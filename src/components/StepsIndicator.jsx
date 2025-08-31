import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material';
const StepIndicator = ({ currentStep }) => {
    const theme = useTheme();
    const steps = [
        { number: 1, label: 'Information' },
        { number: 2, label: 'Location' },
        { number: 3, label: 'Service' },
        { number: 4, label: 'Availibilty' },
        { number: 5, label: 'Payment' },
    ];

    return (
        <Box sx={ { mb: 3 } }>
            <Box sx={ {
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative',
            } }>
                { steps.map((step, index) => (
                    <React.Fragment key={ step.number }>
                        <Box sx={ {
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            position: 'relative',
                            zIndex: 2
                        } }>
                            <Box sx={ {
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: currentStep >= step.number ? theme.palette.primary.main : '#fff',
                                color: currentStep >= step.number ? 'white' : '#9aa0a6',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                mb: 1
                            } }>
                                { step.number }
                            </Box>
                            <Typography
                                variant="caption"
                                color={ currentStep >= step.number ? theme.palette.primary.main : '#9aa0a6' }
                                sx={ { fontSize: '0.75rem', fontWeight: 500 } }
                            >
                                { step.label }
                            </Typography>
                        </Box>

                        { index < steps.length - 1 && (
                            <Box sx={ {
                                width: 110,
                                height: 2,
                                backgroundColor: currentStep > step.number ? theme.palette.primary.main : '#fff',
                                mx: 2,
                                mt: -2
                            } } />
                        ) }
                    </React.Fragment>
                )) }
            </Box>
        </Box>
    );
};

export default StepIndicator;