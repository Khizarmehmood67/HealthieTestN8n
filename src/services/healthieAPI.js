class HealthieAPI {
  constructor () {
    this.baseURL = 'https://staging-api.gethealthie.com/graphql';
    this.apiKey = 'gh_sbox_v9VbN8qKZrogpy4lN9IK8nFhASH5gJcfBsGFCzhubzv0O1M8dUslz2d2lm9oxWn1';
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

  async createClient(clientData) {
    const mutation = `
        mutation createClient($input: createClientInput) {
            createClient(input: $input) {
                messages {
                    message
                }
                user {
                    id
                    first_name
                    last_name
                    email,
                    phone_number
                }
            }
        }
    `;

    const input = {
      first_name: clientData.first_name,
      last_name: clientData.last_name,
      email: clientData.email,
      phone_number: clientData.phone,
    };

    try {
      const response = await this.graphqlRequest(mutation, { input });

      if (response.data.createClient.messages?.length > 0) {
        throw new Error(response.data.createClient.messages.map(msg => msg.message).join(', '));
      }

      return response.data.createClient.user;
    } catch (error) {
      console.error('Failed to create client:', error);
      throw error;
    }
  }

  async getClient() {
    const mutation = `
       query  {
       users{
           id,
                    first_name,
                    last_name,
                    email,
                    phone_number
  }
  }
    `;

    try {
      const response = await this.graphqlRequest(mutation);
      return response.data.users;
    } catch (error) {
      console.error('Failed to get client:', error);
      throw error;
    }
  }


  async getAppointmentTypes() {
    const query = `
           query {
                appointmentTypes {
                    id
                    name
                }
            }
    `;


    try {
      const response = await this.graphqlRequest(query);
      return response.data.appointmentTypes;
    } catch (error) {
      console.error('Failed to fetch locations:', error);
      // Fallback data in case of failure
      return [];
    }
  }

  async createAppointment(clientData) {
    const createAppointmentMutation = `
          mutation createAppointment(
  $user_id: ID,  # Change String to ID
  $appointment_type_id: ID,  # Change String to ID
  $contact_type: String, 
  $other_party_id: ID,  # Change String to ID
  $datetime: String
) {
  createAppointment(
    input: {
      user_id: $user_id,
      appointment_type_id: $appointment_type_id,
      contact_type: $contact_type,
      other_party_id: $other_party_id,
      datetime: $datetime
    }
  ) {
    appointment {
      id
      # Remove confirmation_code and time if not supported
      date
      provider {
        first_name
        last_name
      }
      confirmed
      requested_payment{
        paid_at,
     }
    }
    messages {
      field
      message
    }
  }
}
        `;


    const appointmentData = {
      user_id: clientData.user_id,  // Get the client ID from the created client
      appointment_type_id: clientData.appointment_type_id, // Use selected appointment type ID
      contact_type: clientData.contact_type, // Use selected contact type (e.g., "video_call")
      other_party_id: clientData.doctor_id, // Provider ID (doctor’s ID)
      datetime: clientData.datetime, // Date and time of the appointment
    };

    try {
      // Create the appointment using the client ID and appointment data
      const response = await this.graphqlRequest(createAppointmentMutation, appointmentData);

      // If the appointment was created successfully, return appointment data
      if (response.data.createAppointment.appointment) {
        return response.data.createAppointment.appointment;
      } else {
        throw new Error('Failed to create appointment');
      }
    } catch (error) {
      console.error('Error creating appointment:', error);
      throw error;
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
  async verifyInsurance({ insurancePlanIds }) {
    const mutation = `
    mutation createAcceptedInsurancePlan($insurance_plan_ids: [ID]) {
      createAcceptedInsurancePlan(input: { insurance_plan_ids: $insurance_plan_ids }) {
        accepted_insurance_plans {
          id
          insurance_plan {
            id
          }
        }
        messages {
          field
          message
        }
      }
    }
  `;

    try {
      const response = await this.graphqlRequest(mutation, { insurance_plan_ids: insurancePlanIds });

      if (response.errors) {
        throw new Error(response.errors.join(', '));
      }

      return response.data.createAcceptedInsurancePlan;
    } catch (error) {
      console.error('Insurance verification failed:', error);
      // Handle error more robustly in production
      throw error;
    }
  }
  // Add this method inside your HealthieAPI class
  async createPaymentIntent(paymentData) {
    const mutation = `
    mutation CreatePaymentIntent($input: createPaymentIntentInput!) {
      createPaymentIntent(input: $input) {

        messages {
          field
          message
        }
      }
    }
  `;

    const input = {
      amount_to_pay: paymentData.amount_to_pay,
      currency: paymentData.currency,
      email: paymentData.email,
      first_name: paymentData.first_name,
      last_name: paymentData.last_name,
      legal_name: paymentData.legal_name || paymentData.first_name,
      offering_id: paymentData.offering_id,
      recipient_id: paymentData.recipient_id,
      payment_method_types: paymentData.payment_method_types,
      phone_number: paymentData.phone_number || null,
      timezone: paymentData.timezone || null,
      stripe_idempotency_key: paymentData.stripe_idempotency_key || crypto.randomUUID(),
      coupon_code: paymentData.coupon_code || null,
    };

    try {
      const response = await this.graphqlRequest(mutation, { input });

      if (response.data.createPaymentIntent.messages?.length > 0) {
        throw new Error(response.data.createPaymentIntent.messages.map(msg => msg.message).join(', '));
      }

      return response.data.createPaymentIntent;
    } catch (error) {
      console.error('Failed to create payment intent:', error);
      throw error;
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
  // Add these methods to your existing HealthieAPI class

  // 1. Get client by email
  async getClientByEmail(email) {
    const query = `
    query GetClientByEmail($email: String!) {
      users(keywords: $email) {
        id
        first_name
        last_name
        email
        phone_number
      }
    }
  `;

    try {
      const response = await this.graphqlRequest(query, { email });
      // Filter to find exact email match since keywords search is fuzzy
      const users = response.data?.users || [];
      return users.find(user => user.email === email) || null;
    } catch (error) {
      console.error('Failed to get client by email:', error);
      return null;
    }
  }

  // 2. Store card in Healthie (creates Stripe customer detail)
  async storeCard(data) {
    const mutation = `
    mutation createStripeCustomerDetail($input: createStripeCustomerDetailInput) {
      createStripeCustomerDetail(input: $input) {
        messages
        stripeError
        stripe_customer_detail
      }
    }
  `;

    const input = {
      user_id: data.client_id,
      stripe_payment_method_id: data.stripe_payment_method_id,
      is_default: data.is_default || false
    };

    try {
      const response = await this.graphqlRequest(mutation, { input });

      // Check for Stripe errors first
      if (response.data?.createStripeCustomerDetail?.stripeError) {
        throw new Error(response.data.createStripeCustomerDetail.stripeError);
      }

      // Check for validation messages
      if (response.data?.createStripeCustomerDetail?.messages?.length > 0) {
        const errors = response.data.createStripeCustomerDetail.messages;
        throw new Error(Array.isArray(errors) ? errors.join(', ') : errors);
      }

      return response.data?.createStripeCustomerDetail?.stripe_customer_detail;
    } catch (error) {
      console.error('Failed to store card:', error);
      throw error;
    }
  }

  // 3. Create requested payment (for tracking payment requests)
  async createRequestedPayment(data) {
    const mutation = `
    mutation CreateRequestedPayment(
      $recipient_id: ID!
      $sender_id: ID
      $invoice_id: ID
      $appointment_id: ID
      $offering_id: ID
      $amount: String!
      $notes: String
      $service_name: String
      $status: String
      $service_date: String
    ) {
      createRequestedPayment(
        input: {
          recipient_id: $recipient_id
          sender_id: $sender_id
          invoice_id: $invoice_id
          appointment_id: $appointment_id
          offering_id: $offering_id
          amount: $amount
          notes: $notes
          service_name: $service_name
          status: $status
          service_date: $service_date
        }
      ) {
        requestedPayment {
          id
          amount
          status
          recipient {
            id
            full_name
          }
          created_at
        }
        messages {
          field
          message
        }
      }
    }
  `;

    const variables = {
      recipient_id: data.recipient_id,
      sender_id: data.sender_id || null,
      invoice_id: data.invoice_id || null,
      appointment_id: data.appointment_id || null,
      offering_id: data.offering_id || null,
      amount: data.amount,
      notes: data.notes || null,
      service_name: data.service_name || null,
      status: data.status || "Pending",
      service_date: data.service_date || null
    };

    try {
      const response = await this.graphqlRequest(mutation, variables);

      if (response.data?.createRequestedPayment?.messages?.length > 0) {
        const errors = response.data.createRequestedPayment.messages;
        throw new Error(errors.map(err => err.message).join(', '));
      }

      return response.data?.createRequestedPayment?.requestedPayment;
    } catch (error) {
      console.error('Failed to create requested payment:', error);
      throw error;
    }
  }

  // 4. Create billing item (charge the patient)
  async createBillingItem(data) {
    const mutation = `
    mutation CreateBillingItem(
      $amount_paid: String!
      $sender_id: ID!
      $requested_payment_id: ID
      $stripe_idempotency_key: String!
      $stripe_customer_detail_id: ID!
      $should_charge: Boolean!
    ) {
      createBillingItem(
        input: {
          amount_paid: $amount_paid
          sender_id: $sender_id
          should_charge: $should_charge
          stripe_customer_detail_id: $stripe_customer_detail_id
          requested_payment_id: $requested_payment_id
          stripe_idempotency_key: $stripe_idempotency_key
        }
      ) {
        billingItem {
          id
          amount_paid
          created_at
          stripe_charge_id
          stripe_transaction_fee_amount
          status
        }
        messages {
          field
          message
        }
      }
    }
  `;

    const variables = {
      amount_paid: data.amount_paid,
      sender_id: data.sender_id,
      requested_payment_id: data.requested_payment_id || null,
      stripe_idempotency_key: data.stripe_idempotency_key,
      stripe_customer_detail_id: data.stripe_customer_detail_id,
      should_charge: data.should_charge !== false // default to true
    };

    try {
      const response = await this.graphqlRequest(mutation, variables);

      if (response.data?.createBillingItem?.messages?.length > 0) {
        const errors = response.data.createBillingItem.messages;
        throw new Error(errors.map(err => err.message).join(', '));
      }

      if (!response.data?.createBillingItem?.billingItem) {
        throw new Error('Failed to create billing item');
      }

      return response.data.createBillingItem;
    } catch (error) {
      console.error('Failed to create billing item:', error);
      throw error;
    }
  }

  // 5. Get stripe customer details for a user (to check existing cards)
  async getStripeCustomerDetails(userId) {
    const query = `
    query GetStripeCustomerDetails($user_id: ID!) {
      user(id: $user_id) {
        id
        stripe_customer_details {
          id
          last_four
          card_type
          card_type_label
          expiration
          expiring_next_month
          stripe_id
          source_type
          source_status
          created_at
        }
      }
    }
  `;

    try {
      const response = await this.graphqlRequest(query, { user_id: userId });
      return response.data?.user?.stripe_customer_details || [];
    } catch (error) {
      console.error('Failed to get stripe customer details:', error);
      return [];
    }
  }

  // 6. Update appointment with billing information
  async updateAppointmentWithBilling(appointmentId, billingItemId) {
    const mutation = `
    mutation UpdateAppointment(
      $id: ID!
      $billing_item_id: ID
      $payment_status: String
    ) {
      updateAppointment(
        input: {
          id: $id
          billing_item_id: $billing_item_id
          payment_status: $payment_status
        }
      ) {
        appointment {
          id
          billing_item_id
          payment_status
        }
        messages {
          field
          message
        }
      }
    }
  `;

    const variables = {
      id: appointmentId,
      billing_item_id: billingItemId,
      payment_status: "paid"
    };

    try {
      const response = await this.graphqlRequest(mutation, variables);

      if (response.data?.updateAppointment?.messages?.length > 0) {
        const errors = response.data.updateAppointment.messages;
        console.warn('Update appointment warnings:', errors);
      }

      return response.data?.updateAppointment?.appointment;
    } catch (error) {
      console.error('Failed to update appointment with billing:', error);
      // Don't throw - appointment is already created, just log the error
      return null;
    }
  }

  // 7. Helper method to generate UUID for idempotency key
  generateIdempotencyKey() {
    // Generate a v4 UUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

}


export default new HealthieAPI();

