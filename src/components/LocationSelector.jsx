import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardContent, Button, TextField, MenuItem, Autocomplete } from '@mui/material';
import { LocationOn } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import US_STATES from '../data/UsStates';  // Your states array

const LocationSelector = ({ onNext }) => {
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const theme = useTheme();

    // Handle selection change
    const handleSelect = (event, newValue) => {
        setSelectedLocation(newValue);
    };

    const handleNext = () => {
        if (selectedLocation) {
            onNext(selectedLocation);
        }
    };

    if (loading) {
        return <Typography>Loading...</Typography>;
    }

    if (error) {
        return <Typography>Error: { error }</Typography>;
    }

    return (
        <Box sx={ { py: 2 } }>
            <Typography
                variant="h6"
                fontWeight={ 600 }
                sx={ { fontSize: '1.125rem' } }
            >
                Where do you live?
            </Typography>
            <Typography
                variant="h6"
                fontWeight={ 600 }
                gutterBottom
                sx={ { fontSize: '0.75rem' } }
            >
                We’ll use this to match you with the best providers near you.
            </Typography>

            {/* Autocomplete component for searchable states */ }
            <Autocomplete
                value={ selectedLocation }
                onChange={ handleSelect }
                options={ US_STATES } // The array of US states with codes
                getOptionLabel={ (option) => `${option.name}, ${option.code}` } // Display name and code
                renderInput={ (params) => (
                    <TextField
                        { ...params }
                        label="Select Your State"
                        variant="outlined"
                        fullWidth
                        sx={ { my: 2 } }
                    />
                ) }
                isOptionEqualToValue={ (option, value) => option.code === value.code } // Check if selected option matches
                renderOption={ (props, option) => (
                    <MenuItem { ...props } key={ option.code }>
                        <LocationOn sx={ { mr: 1 } } />
                        { option.name } ({ option.code })
                    </MenuItem>
                ) }
            />

            <Box sx={ { display: 'flex', justifyContent: 'flex-end', mt: 4 } }>
                <Button
                    variant="contained"
                    onClick={ handleNext }
                    disabled={ !selectedLocation }
                    sx={ {
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

export default LocationSelector;
