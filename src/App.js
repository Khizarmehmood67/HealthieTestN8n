// src/App.js - Simplified without custom Stripe Elements
import React, { useState } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { BookingProvider } from './context/BookingContext';

// Components
import BookingHeader from './components/BookingHeader';
import StepIndicator from './components/StepsIndicator';
import LocationSelector from './components/LocationSelector';
import ServiceSelector from './components/ServiceSelector';
import DoctorSelector from './components/DoctorSelector';
import PaymentFlow from './components/PaymentFlow';
import BookingConfirmation from './components/BookingConfirmation';

const theme = createTheme({
  palette: {
    primary: { main: '#49C7AB' },
    background: { default: 'rgb(236 239 241)' },
    text: { primary: '#000000', secondary: '#141e1fcc' },
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
  },
});

const STEPS = {
  LOCATION: 'location',
  AVAILABILITY: 'availability',
  DOCTOR: 'doctor',
  PAYMENT: 'payment',
  CONFIRMATION: 'confirmation'
};

function App() {
  const [currentStep, setCurrentStep] = useState(STEPS.LOCATION);
  const [bookingData, setBookingData] = useState({
    location: null,
    service: null,
    doctor: null,
    appointment: null,
    patient: null,
    payment: null,
  });

  const updateBookingData = (key, value) => {
    setBookingData(prev => ({ ...prev, [key]: value }));
  };

  const nextStep = () => {
    const stepOrder = Object.values(STEPS);
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case STEPS.LOCATION:
        return (
          <LocationSelector
            onNext={ (location) => {
              updateBookingData('location', location);
              nextStep();
            } }
          />
        );
      case STEPS.AVAILABILITY:
        return (
          <ServiceSelector
            location={ bookingData.location }
            onNext={ (service) => {
              updateBookingData('service', service);
              nextStep();
            } }
          />
        );
      case STEPS.DOCTOR:
        return (
          <DoctorSelector
            location={ bookingData.location }
            service={ bookingData.service }
            onNext={ (appointment) => {
              updateBookingData('appointment', appointment);
              nextStep();
            } }
          />
        );
      case STEPS.PAYMENT:
        return (
          <PaymentFlow
            bookingData={ bookingData }
            onComplete={ (paymentData) => {
              updateBookingData('payment', paymentData);
              nextStep();
            } }
          />
        );
      case STEPS.CONFIRMATION:
        return <BookingConfirmation bookingData={ bookingData } />;
      default:
        return <LocationSelector onNext={ nextStep } />;
    }
  };

  return (
    <ThemeProvider theme={ theme }>
      <CssBaseline />
      <BookingProvider>
        <div style={ {
          minHeight: '100vh'
        } }>
          <div style={ {
            maxWidth: '800px',
            margin: '0 auto',
            padding: '10px 24px',
            minHeight: '100vh'
          } }>
            <BookingHeader />
            <StepIndicator currentStep={ Object.values(STEPS).indexOf(currentStep) + 1 } />
            { renderCurrentStep() }
          </div>
        </div>
      </BookingProvider>
    </ThemeProvider >
  );
}

export default App;