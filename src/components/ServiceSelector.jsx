import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardContent, Button, CircularProgress, Chip } from '@mui/material';
import { MedicalServices, AccessTime, AttachMoney } from '@mui/icons-material';
import HealthieAPI from '../services/healthieAPI';  // Assuming this is your API service
import { useTheme } from '@mui/material/styles';

const ServiceSelector = ({ location, onNext }) => {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedService, setSelectedService] = useState(null);
    const [error, setError] = useState(null);
    const theme = useTheme();

    // Fetch services using Healthie's offerings API
    useEffect(() => {
        const fetchServices = async () => {
            setLoading(true);
            try {
                // Fetch the offerings from the Healthie API
                const response = await HealthieAPI.getServices(location.id);
                if (response && response.data) {
                    setServices(response.data.offerings);
                }
            } catch (error) {
                console.error('Failed to fetch services:', error);
                setError('Failed to load services');
            } finally {
                setLoading(false);
            }
        };

        if (location) {
            fetchServices();
        }
    }, [location]);

    const handleSelect = (service) => {
        setSelectedService(service);
    };

    const handleNext = () => {
        if (selectedService) {
            onNext(selectedService);
        }
    };

    if (loading) {
        return (
            <Box sx={ { display: 'flex', justifyContent: 'center', py: 8 } }>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return <Typography>Error: { error }</Typography>;
    }
    console.log(services);

    return (
        <Box sx={ { py: 4 } }>
            <Typography
                variant="h6"
                fontWeight={ 600 }
                color="#1a1a1a"
                gutterBottom
                sx={ { fontSize: '1.125rem' } }
            >
                What service are you interested in?
            </Typography>
            <Typography
                variant="body2"
                color="#5f6368"
                sx={ { mb: 3, fontSize: '0.875rem' } }
            >
                Available services in { location.name }
            </Typography>

            <Grid container spacing={ 2 } sx={ { mb: 4 } }>
                { services.map((service) => (
                    <Grid item size={ { xs: 6, md: 3 } } key={ service.id }>
                        <Card
                            sx={ {
                                cursor: 'pointer',
                                border: selectedService?.id === service.id ? `2px solid ${theme.palette.primary.main}` : '1px solid #e8eaed',
                                bgcolor: selectedService?.id === service.id ? '#f8f9ff' : 'white',
                                transition: 'all 0.2s ease',
                                borderRadius: '8px',
                                height: '100%',
                                '&:hover': {
                                    borderColor: theme.palette.primary.main,
                                    boxShadow: '0 2px 8px rgba(66, 133, 244, 0.15)',
                                },
                            } }
                            onClick={ () => handleSelect(service) }
                        >
                            <CardContent sx={ { p: 3 } }>
                                <Box sx={ { display: 'flex', alignItems: 'flex-start', mb: 2 } }>
                                    <MedicalServices
                                        sx={ {
                                            fontSize: 20,
                                            color: selectedService?.id === service.id ? theme.palette.primary.main : '#5f6368',
                                            mr: 1,
                                            mt: 0.5,
                                        } }
                                    />
                                    <Typography
                                        variant="body1"
                                        fontWeight={ 500 }
                                        color="#1a1a1a"
                                        sx={ { fontSize: '0.875rem' } }
                                    >
                                        { service.name }
                                    </Typography>
                                </Box>

                                <Typography
                                    variant="body2"
                                    color="#5f6368"
                                    sx={ { mb: 3, fontSize: '0.75rem', lineHeight: 1.4 } }
                                >
                                    <div dangerouslySetInnerHTML={ { __html: service.description } }></div>
                                </Typography>

                                <Box sx={ { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }>
                                    <Box sx={ { display: 'flex', alignItems: 'center' } }>
                                        <AccessTime sx={ { fontSize: 14, color: '#5f6368', mr: 0.5 } } />
                                        <Typography variant="body2" color="#5f6368" sx={ { fontSize: '0.75rem' } }>
                                            { service.duration } min
                                        </Typography>
                                    </Box>
                                    <Chip
                                        label={ `$${service.price || 'N/A'}` }
                                        size="small"
                                        sx={ {
                                            backgroundColor: '#e8f0fe',
                                            color: theme.palette.primary.main,
                                            fontSize: '0.75rem',
                                            height: '24px',
                                        } }
                                    />
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                )) }
            </Grid>

            <Box sx={ { display: 'flex', justifyContent: 'flex-end', mt: 4 } }>
                <Button
                    variant="contained"
                    onClick={ handleNext }
                    disabled={ !selectedService }
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
                        },
                    } }
                >
                    Next Step
                </Button>
            </Box>
        </Box>
    );
};

export default ServiceSelector;
