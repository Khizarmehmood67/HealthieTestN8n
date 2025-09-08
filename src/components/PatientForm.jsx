import React from 'react';
import { useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Person from '@mui/icons-material/Person';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material';

const PatientForm = ({
    onNext,
}) => {
    const theme = useTheme();
    const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/24427250/uhlhnw3/'
    const [patientData, setPatientData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        appointment_type_id: '',
        contact_type: 'In Person'
    });
    const handlePatientSubmit = async () => {
        if (patientData) {
            onNext(patientData)
            const agentPayload = {
                name: `${patientData.firstName} ${patientData.lastName}`,
                firstName: patientData.firstName,
                lastName: patientData.lastName,
                phone: patientData.phone,
                email: patientData.email,
            };
            const response = await fetch('https://edmedsai.app.n8n.cloud/webhook-test/94e99ec8-d834-4693-b5e0-cc389db9fa4f', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                mode: 'no-cors',
                body: JSON.stringify(agentPayload)
            });

        }
    }
    return (
        <Box >

            <Box sx={ { display: 'flex', alignItems: 'center', mb: 2 } }>
                <Person sx={ { fontSize: 24, color: theme.palette.primary.main, mr: 1 } } />
                <Typography variant="h6" fontWeight={ 600 }>
                    Tell us about yourself ?
                </Typography>
            </Box>

            <form onSubmit={ handlePatientSubmit }>
                <Grid container spacing={ 2 }>
                    <Grid item size={ { xs: 12, md: 6 } }>
                        <TextField
                            label="First Name"
                            value={ patientData.firstName }
                            onChange={ (e) => setPatientData(prev => ({ ...prev, firstName: e.target.value })) }
                            fullWidth
                            required
                        />
                    </Grid>

                    <Grid item size={ { xs: 12, md: 6 } }>
                        <TextField
                            label="Last Name"
                            value={ patientData.lastName }
                            onChange={ (e) => setPatientData(prev => ({ ...prev, lastName: e.target.value })) }
                            fullWidth
                            required
                        />
                    </Grid>

                    <Grid item size={ { xs: 12, md: 6 } }>
                        <TextField
                            label="Email"
                            type="email"
                            value={ patientData.email }
                            onChange={ (e) => setPatientData(prev => ({ ...prev, email: e.target.value })) }
                            fullWidth
                            required
                        />
                    </Grid>

                    <Grid item size={ { xs: 12, md: 6 } }>
                        <TextField
                            label="Phone Number"
                            type="tel"
                            value={ patientData.phone }
                            onChange={ (e) => setPatientData(prev => ({ ...prev, phone: e.target.value })) }
                            fullWidth
                            required
                        />
                    </Grid>

                    {/* <Grid item xs={ 12 } md={ 4 }>
                            <TextField
                                label="Appointment Type"
                                select
                                value={ patientData.appointment_type_id }
                                onChange={ (e) => setPatientData(prev => ({ ...prev, appointment_type_id: e.target.value })) }
                                fullWidth
                                required
                            >
                                { appointmentType.map((type) => (
                                    <MenuItem key={ type.id } value={ type.id }>
                                        { type.name }
                                    </MenuItem>
                                )) }
                            </TextField>
                        </Grid> */}
                    {/* 
                        <Grid item xs={ 12 }>
                            <Typography variant="subtitle2" fontWeight={ 600 }>Select Contact Type</Typography>
                            <RadioGroup
                                value={ patientData.contact_type }
                                sx={ { flexDirection: 'row' } }
                                onChange={ (e) => setPatientData(prev => ({ ...prev, contact_type: e.target.value })) }
                            >
                                <FormControlLabel value="Healthie Video Call" control={ <Radio /> } label="Video Call" />
                                <FormControlLabel value="Phone Call" control={ <Radio /> } label="Phone Call" />
                                <FormControlLabel value="In Person" control={ <Radio /> } label="In-Person" />
                            </RadioGroup>
                        </Grid> */}

                </Grid>
                <Box sx={ { display: 'flex', justifyContent: 'flex-end', mt: 4 } }>
                    <Button
                        variant="contained"
                        type="submit"
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
            </form>
        </Box>
    );
}
export default PatientForm;