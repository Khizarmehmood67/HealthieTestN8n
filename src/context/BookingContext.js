import React, { createContext, useContext, useReducer, useCallback } from 'react';

const initialState = {
    currentStep: 'location',
    bookingData: {
        location: null,
        service: null,
        doctor: null,
        appointment: null,
        patient: null,
        payment: null,
    },
    loading: false,
    error: null,
};

const ActionTypes = {
    SET_STEP: 'SET_STEP',
    UPDATE_BOOKING_DATA: 'UPDATE_BOOKING_DATA',
    SET_LOADING: 'SET_LOADING',
    SET_ERROR: 'SET_ERROR',
    RESET_BOOKING: 'RESET_BOOKING',
};

const bookingReducer = (state, action) => {
    switch (action.type) {
        case ActionTypes.SET_STEP:
            return { ...state, currentStep: action.payload, error: null };
        case ActionTypes.UPDATE_BOOKING_DATA:
            return {
                ...state,
                bookingData: {
                    ...state.bookingData,
                    [action.payload.key]: action.payload.value,
                },
            };
        case ActionTypes.SET_LOADING:
            return { ...state, loading: action.payload };
        case ActionTypes.SET_ERROR:
            return { ...state, error: action.payload, loading: false };
        case ActionTypes.RESET_BOOKING:
            return initialState;
        default:
            return state;
    }
};

const BookingContext = createContext();

export const BookingProvider = ({ children }) => {
    const [state, dispatch] = useReducer(bookingReducer, initialState);

    const setStep = useCallback((step) => {
        dispatch({ type: ActionTypes.SET_STEP, payload: step });
    }, []);

    const updateBookingData = useCallback((key, value) => {
        dispatch({ type: ActionTypes.UPDATE_BOOKING_DATA, payload: { key, value } });
    }, []);

    const setLoading = useCallback((loading) => {
        dispatch({ type: ActionTypes.SET_LOADING, payload: loading });
    }, []);

    const setError = useCallback((error) => {
        dispatch({ type: ActionTypes.SET_ERROR, payload: error });
    }, []);

    const resetBooking = useCallback(() => {
        dispatch({ type: ActionTypes.RESET_BOOKING });
    }, []);

    const value = {
        ...state,
        setStep,
        updateBookingData,
        setLoading,
        setError,
        resetBooking,
    };

    return (
        <BookingContext.Provider value={ value }>
            { children }
        </BookingContext.Provider>
    );
};

export const useBooking = () => {
    const context = useContext(BookingContext);
    if (!context) {
        throw new Error('useBooking must be used within a BookingProvider');
    }
    return context;
};
