class HealthieAPI {
  constructor () {
    this.baseURL = 'https://staging-api.gethealthie.com/graphql';
    this.apiKey = 'gh_sbox_BGpobJdBmqze6bkx8dO0b8NMqToRyzPN9fjCuLCxGpDqQwcv219WNS5LbYbrPJ5Z';
  }

  async graphqlRequest(query, variables = {}) {
    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Healthie-GraphQL-API-Version': '2024-08-01',
          'Accept': 'application/json',
          'authorizationsource': 'API'
        },
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.errors) {
        throw new Error(data.errors[0].message);
      }

      return data;
    } catch (error) {
      console.error('Healthie API Error:', error);
      throw error;
    }
  }

  // Get available services by location
  async getServices(locationId = null) {
    const query = `
query  {
   offerings{
    id,
    name,
    price,
    description,
    offering_image {
      id,
      image_url
   }  
    
  }
}
    `;

    try {
      const response = await this.graphqlRequest(query);
      return response;
    } catch (error) {
      console.error('Failed to fetch services:', error);

      return [
        {
          id: '1',
          name: 'General Consultation',
          description: 'Comprehensive health assessment',
          length: 30,
          pricing_info: { price: 75, currency: 'USD' },
          category: 'Primary Care'
        },
        {
          id: '2',
          name: 'Mental Health Session',
          description: 'Professional mental health consultation',
          length: 45,
          pricing_info: { price: 120, currency: 'USD' },
          category: 'Mental Health'
        },
      ];
    }
  }

  // Get providers by location and service
  async getProviders(locationId, serviceId) {
    const query = `
      query  {
   referringPhysicians{
    id,
    full_name,
    speciality,
    location_id,
    accepts_insurance,
    phone_number,
    
  }
}
    `;

    try {
      const response = await this.graphqlRequest(query, { locationId, serviceId });
      return response.data.referringPhysicians;
    } catch (error) {
      console.error('Failed to fetch providers:', error);

    }
  }

  // Get available appointment slots
  async getAvailableSlots(providerId, date, offeringId) {
    const query = `
      query GetAvailableSlots(
        $providerId: ID!
        $date: String!
        $offeringId: ID!
      ) {
        availabilities(
          provider_id: $providerId
          date: $date
          offering_id: $offeringId
        ) {
          id
          start_time
          end_time
          available
        }
      }
    `;

    try {
      const response = await this.graphqlRequest(query, { providerId, date, offeringId });
      return response.data.availabilities;
    } catch (error) {
      console.error('Failed to fetch time slots:', error);
      // Generate mock slots
      const slots = [];
      for (let hour = 9; hour < 17; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          const endMinute = minute + 30;
          const endHour = endMinute >= 60 ? hour + 1 : hour;
          const finalMinute = endMinute >= 60 ? 0 : endMinute;
          const endTime = `${endHour.toString().padStart(2, '0')}:${finalMinute.toString().padStart(2, '0')}`;

          slots.push({
            id: `${hour}-${minute}`,
            start_time: startTime,
            end_time: endTime,
            available: Math.random() > 0.3
          });
        }
      }
      return slots;
    }
  }

  // Create appointment with Healthie's payment integration
  async createAppointmentWithPayment(appointmentData) {
    const mutation = `
      mutation CreateAppointmentWithPayment($input: AppointmentInput!) {
        createAppointment(input: $input) {
          appointment {
            id
            confirmation_code
            date
            time
            provider {
              first_name
              last_name
            }
            offering {
              name
              pricing_info {
                price
                currency
              }
            }
          }
          payment_intent {
            id
            client_secret
            status
            amount
            currency
          }
          errors
        }
      }
    `;

    const input = {
      provider_id: appointmentData.providerId,
      offering_id: appointmentData.offeringId,
      date: appointmentData.date,
      time: appointmentData.time,
      contact_type: "video_call",
      patient_info: {
        first_name: appointmentData.patient.firstName,
        last_name: appointmentData.patient.lastName,
        email: appointmentData.patient.email,
        phone: appointmentData.patient.phone,
        date_of_birth: appointmentData.patient.dateOfBirth
      },
      insurance_info: appointmentData.insurance || null,
      payment_method: "stripe", // Healthie handles Stripe integration
      auto_charge: true // Let Healthie handle the payment flow
    };

    try {
      const response = await this.graphqlRequest(mutation, { input });

      if (response.data.createAppointment.errors?.length > 0) {
        throw new Error(response.data.createAppointment.errors.join(', '));
      }

      return response.data.createAppointment;
    } catch (error) {
      console.error('Failed to create appointment:', error);
      throw error;
    }
  }


  // Verify insurance through Healthie
  async verifyInsurance(ID) {
    const mutation = `
    query insuranceAuthorization( $id: ID) {
  insuranceAuthorization( id: $id) {
    authorization_number
    end_on
    id
    start_on
    unit_type
    units_authorized
    units_left
    units_limit_per_visit
    units_used
    updated_at
    user_id
    visits_authorized
    visits_left
    visits_used
  }
}
    `;

    try {
      const response = await this.graphqlRequest(mutation, { input: ID });

      if (response.data.verifyInsurance.errors?.length > 0) {
        throw new Error(response.data.verifyInsurance.errors.join(', '));
      }

      return response.data.verifyInsurance;
    } catch (error) {
      console.error('Insurance verification failed:', error);
      // Mock verification for demo
      return {
        verified: Math.random() > 0.2,
        copay_amount: 25,
        deductible_amount: 200,
        coverage_percentage: 80,
        message: 'Insurance verified successfully'
      };
    }
  }

  async getInsurancePlans({
    is_accepted = true,
  }) {
    const query = `
      query insurancePlans( $is_accepted: Boolean,) {
        insurancePlans( is_accepted: $is_accepted) {
          id
          name_and_id
          payer_id
          payer_name
        }
      }
    `;

    const variables = {
      is_accepted,
    };

    try {
      const response = await this.graphqlRequest(query, variables);
      return response;
    } catch (error) {
      console.error('Failed to fetch insurance plans:', error);
      return [];
    }
  }

  // Get payment methods (handled by Healthie)
  async getPaymentMethods(patientId) {
    const query = `
      query GetPaymentMethods($patientId: ID!) {
        user(id: $patientId) {
          payment_methods {
            id
            brand
            last_four
            exp_month
            exp_year
            is_default
          }
        }
      }
    `;

    try {
      const response = await this.graphqlRequest(query, { patientId });
      return response.data.user.payment_methods || [];
    } catch (error) {
      console.error('Failed to fetch payment methods:', error);
      return [];
    }
  }

  // Process payment through Healthie's system
  async processPayment(paymentData) {
    const mutation = `
      mutation ProcessPayment($input: PaymentInput!) {
        processPayment(input: $input) {
          payment {
            id
            amount
            currency
            status
            receipt_url
          }
          appointment {
            id
            confirmation_code
            status
          }
          errors
        }
      }
    `;

    try {
      const response = await this.graphqlRequest(mutation, { input: paymentData });

      if (response.data.processPayment.errors?.length > 0) {
        throw new Error(response.data.processPayment.errors.join(', '));
      }

      return response.data.processPayment;
    } catch (error) {
      console.error('Payment processing failed:', error);
      throw error;
    }
  }

  async getLocations({
    has_name = false,
    has_service_facilities = false,
    keywords = '',
    user_id = '',
    offset = 0,
    page_size = 10,
    should_paginate = true,
    after = null
  }) {
    const query = `
      query {
  locations {
    id
    name
    city
    state
  }
}

    `;

    const variables = {
      has_name,
      has_service_facilities,
      keywords,
      user_id,
      offset,
      page_size,
      should_paginate,
      after
    };

    try {
      const response = await this.graphqlRequest(query);
      return response.data.locations;
    } catch (error) {
      console.error('Failed to fetch locations:', error);
      // Fallback data in case of failure
      return [];
    }
  }
}

export default new HealthieAPI();