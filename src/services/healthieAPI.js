class HealthieAPI {
  constructor () {
    this.baseURL = '/api/healthie';
    // this.apiKey = process.env.REACT_APP_HEALTHIE_TOKEN;
  }
  // gh_live_xdD0KLeNnMF1OnaApr9CHUp11bYUUKJxnXQZ5F5xK8IaLOn8rzoQ61oEAQVi47hD	   client key


  async graphqlRequest(query, variables = {}) {
    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': `Bearer ${this.apiKey}`,
          // // 'Healthie-GraphQL-API-Version': '2024-08-01',
          // 'Accept': '*/*',
          // 'authorizationsource': 'Web',
          // 'Access-Control-Allow-Origin': 'http://localhost:3000/',
          // 'Origin': 'https://secure.gethealthie.com'
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
  async getProviders(stateCode, serviceId) {
    const query = `
   query organizationMembers(
  $conversation_id: ID
  $keywords: String
  $licensed_in_state: String
  $order_by: UserOrderKeys
  $offset: Int
  $page_size: Int
) {
  organizationMembers(
    conversation_id: $conversation_id
    keywords: $keywords
    licensed_in_state: $licensed_in_state
    order_by: $order_by
    offset: $offset
    page_size: $page_size
  ) {
    id,
    full_name,
    locations{
      id,
      name
    },
    specialties {
      id,
      specialty
    },
    place_of_service{
      id,
      name
    },
    qualifications,
      qualifications,
    location{
      id,
      name
    },
    appointment_locations{
      id,
      location
    },
    policies{
      id,
      name
    },
    stripe_id
  }}
    `;

    try {
      const response = await this.graphqlRequest(query, { licensed_in_state: stateCode });
      return response.data;
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
      dietitian_id: clientData.provider_id
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
                    pricing
                  client_display_name
                  clients_can_book
                  insurance_billing_enabled
                  valid_state_licensing_for
price_and_cpt_price{
  price
  cpt_price
}
              available_contact_types    
                  
                  
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
      other_party_id: clientData.other_party_id, // Provider ID (doctor’s ID)
      datetime: clientData.datetime, // Date and time of the appointment
    };

    try {
      // Create the appointment using the client ID and appointment data
      const response = await this.graphqlRequest(createAppointmentMutation, appointmentData);

      // If the appointment was created successfully, return appointment data
      if (response.data.createAppointment.appointment) {
        return response.data.createAppointment.appointment;
      } else {
        throw new Error("'Failed to create appointment'");
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
              payer_name
            is_accepted
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

  async getLocations() {
    const query = `
  query appointmentLocations($provider_id: ID) {
  provider(id: $provider_id) {
    id
    appointment_setting {
      id
      user_id
      __typename
    }
    can_edit_settings
    appointment_locations {
      location
      clients_can_book
      has_rooms
      rooms {
        id
        name
        limit_to_one
        __typename
      }
      id
      __typename
    }
    __typename
  }
}
    `;


    try {
      const response = await this.graphqlRequest(query, { provider_id: 9589558 });
      return response.data.provider.appointment_locations;
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


  async storeCard(input) {
    const mutation = `
    mutation createStripeCustomerDetail($input: createStripeCustomerDetailInput) {
      createStripeCustomerDetail(input: $input) {
        stripe_customer_detail { id }
        messages { field message }
        stripeError
      }
    }`;

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
  // Fixed createBillingItem method in healthieAPI.js
  // Fixed createBillingItem method in healthieAPI.js
  async createBillingItem(data) {
    const mutation = `
    mutation CreateBillingItem(
      $amount_paid: String!
      $sender_id: ID!
      $stripe_customer_detail_id: ID!
      $stripe_idempotency_key: ID  # Changed from String! to ID
      $should_charge: Boolean!
      $requested_payment_id: ID
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
          state
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
      stripe_customer_detail_id: data.stripe_customer_detail_id,
      stripe_idempotency_key: data.stripe_idempotency_key || crypto.randomUUID(),
      should_charge: data.should_charge !== false,
      requested_payment_id: data.requested_payment_id || null
    };

    try {
      const response = await this.graphqlRequest(mutation, variables);

      if (response.data?.createBillingItem?.messages?.length > 0) {
        const errors = response.data.createBillingItem.messages;
        throw new Error(errors.map(err => err.message).join(', '));
      }

      return response.data?.createBillingItem?.billingItem;
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
  // healthieAPI.js

  // Fixed getAvailabilities method for HealthieAPI class

  // Corrected HealthieAPI methods with proper GraphQL types

  // async getAvailabilities(locationId, appointmentTypeId, startDate, endDate, providerId = null, organizationId = '96198', additionalLocationIds = null) {
  //   const query = `query calendarData(
  //           $appointmentLocationId: ID, 
  //           $appointmentTypeId: ID, 
  //           $appointment_setting_updated_at: ISO8601DateTime, 
  //           $availabilityAppointmentTypeIds: [ID], 
  //           $colorCodeId: String, 
  //           $contactTypeId: ID, 
  //           $endDate: String, 
  //           $filter_by_appointment_location_ids: [ID], 
  //           $filter_by_appointment_statuses: [String], 
  //           $filter_by_appointment_type_ids: [ID], 
  //           $filter_by_client_confirmed: Boolean, 
  //           $filter_by_contact_types: String, 
  //           $filter_by_provider_confirmed: Boolean, 
  //           $filter_synced_appointments: Boolean, 
  //           $includeRepeating: Boolean, 
  //           $include_nil_blockers: Boolean, 
  //           $is_locations_resource: Boolean!, 
  //           $is_org: Boolean, 
  //           $is_repeating: Boolean, 
  //           $known_requires_client_confirmed: Boolean, 
  //           $locationIds: [ID], 
  //           $one_time: Boolean, 
  //           $provider_id: ID, 
  //           $provider_ids: [ID], 
  //           $show_appointments: Boolean, 
  //           $show_availabilities: Boolean!, 
  //           $show_availability: Boolean, 
  //           $startDate: String, 
  //           $tag_ids: [ID], 
  //           $insurance_plan_ids: [ID], 
  //           $timezone: String, 
  //           $state_license: String, 
  //           $organization_id: ID, 
  //           $use_provider_inclusions: Boolean
  //       ) {
  //           availabilities(
  //               appointment_location_id: $appointmentLocationId
  //               appointment_type_id: $appointmentTypeId
  //               appointment_type_ids: $availabilityAppointmentTypeIds
  //               contact_type_id: $contactTypeId
  //               endDate: $endDate
  //               includeRepeating: $includeRepeating
  //               is_org: $is_org
  //               is_repeating: $is_repeating
  //               one_time: $one_time
  //               provider_id: $provider_id
  //               provider_ids: $provider_ids
  //               show_availability: $show_availability
  //               include_suborganizations: false
  //               startDate: $startDate
  //               timezone: $timezone
  //               state_license: $state_license
  //               tag_ids: $tag_ids
  //               insurance_plan_ids: $insurance_plan_ids
  //               organization_id: $organization_id
  //           ) @include(if: $show_availabilities) {
  //               appointment_location_id
  //               appointment_type_id
  //               contact_type_id
  //               day_of_week
  //               end_on
  //               id
  //               is_repeating
  //               origin_start_date
  //               range_end
  //               range_start
  //               repeating_availability_id
  //               resourceId
  //               timezone_abbr
  //               user_id
  //           }

  //           appointments(
  //               colorSchemeId: $colorCodeId
  //               endDate: $endDate
  //               filter_by_appointment_location_ids: $filter_by_appointment_location_ids
  //               filter_by_appointment_statuses: $filter_by_appointment_statuses
  //               filter_by_appointment_type_ids: $filter_by_appointment_type_ids
  //               filter_by_client_confirmed: $filter_by_client_confirmed
  //               filter_by_contact_types: $filter_by_contact_types
  //               filter_by_provider_confirmed: $filter_by_provider_confirmed
  //               filter_synced_appointments: $filter_synced_appointments
  //               include_nil_blockers: $include_nil_blockers
  //               is_org: $is_org
  //               provider_id: $provider_id
  //               provider_ids: $provider_ids
  //               show_appointments: $show_appointments
  //               startDate: $startDate
  //               state_license: $state_license
  //               tag_ids: $tag_ids
  //               insurance_plan_ids: $insurance_plan_ids
  //               organization_id: $organization_id
  //               use_provider_inclusions: $use_provider_inclusions
  //           ) {
  //               appointment_category
  //               appointment_type_id
  //               backgroundColor(appointment_setting_updated_at: $appointment_setting_updated_at)
  //               client_confirmed(known_requires_client_confirmed: $known_requires_client_confirmed)
  //               confirmed
  //               contact_type
  //               default_color
  //               end
  //               external_id_type
  //               id
  //               is_blocker
  //               locationResource @include(if: $is_locations_resource)
  //               pm_status
  //               provider {
  //                   full_name
  //                   id
  //               }
  //               providers(empty_unless_multiple: true) {
  //                   full_name
  //                   id
  //               }
  //               recurring_appointment {
  //                   id
  //               }
  //               resourceId
  //               start
  //               timezone_abbr
  //               title
  //           }

  //           locationResources: locationResources(location_ids: $locationIds) {
  //               resourceId
  //               resourceTitle
  //           }
  //       }
  //   `;

  //   // Prepare location IDs array (NOT a string)
  //   let locationIdsArray = [];
  //   if (locationId) {
  //     locationIdsArray.push(locationId.toString());
  //   }
  //   if (additionalLocationIds && Array.isArray(additionalLocationIds)) {
  //     locationIdsArray = locationIdsArray.concat(additionalLocationIds.map(id => id.toString()));
  //   }

  //   const variables = {
  //     // Date parameters
  //     startDate: startDate,
  //     endDate: endDate,

  //     // Location and appointment type - ID types
  //     appointmentLocationId: locationId?.toString() || null,
  //     appointmentTypeId: appointmentTypeId?.toString() || null,
  //     availabilityAppointmentTypeIds: appointmentTypeId ? [appointmentTypeId.toString()] : [],

  //     // Contact type - ID type
  //     contactTypeId: null,

  //     // Provider IDs
  //     provider_id: providerId?.toString() || null,
  //     provider_ids: providerId ? [providerId.toString()] : null,

  //     // Organization settings
  //     organization_id: '96198' || null,
  //     is_org: true,

  //     // Show flags
  //     show_availabilities: true,
  //     show_availability: true,
  //     show_appointments: true,

  //     // Repeating settings
  //     includeRepeating: true,
  //     is_repeating: true,
  //     one_time: true,

  //     // Location resources - Array of IDs
  //     locationIds: locationIdsArray.length > 0 ? locationIdsArray : null,
  //     is_locations_resource: false,

  //     // Additional settings
  //     timezone: "Asia/Yekaterinburg",
  //     known_requires_client_confirmed: false,
  //     appointment_setting_updated_at: "2025-08-25T15:45:51-06:00", // ISO8601 format
  //     include_nil_blockers: true,
  //     state_license: "none_selected",

  //     // Filter settings
  //     filter_by_appointment_location_ids: locationId ? [locationId.toString()] : [],
  //     filter_by_appointment_statuses: [],
  //     filter_by_appointment_type_ids: [],
  //     filter_by_contact_types: null,
  //     filter_synced_appointments: false,
  //     filter_by_provider_confirmed: null,
  //     filter_by_client_confirmed: null,
  //     use_provider_inclusions: true,

  //     // Optional fields
  //     colorCodeId: null,
  //     tag_ids: [],
  //     insurance_plan_ids: []
  //   };

  //   try {
  //     const result = await this.graphqlRequest(query, variables);
  //     console.log('Calendar data received:', {
  //       availabilities: result.data?.availabilities?.length || 0,
  //       appointments: result.data?.appointments?.length || 0
  //     });
  //     return result.data;
  //   } catch (error) {
  //     console.error('Error in getAvailabilities:', error);
  //     throw error;
  //   }
  // }

  async getAvailabilities(locationId, appointmentTypeId, startDate, endDate, providerId = null, userTimeZone) {
    const query = `
      query availabilities(
     $user_id: ID, 
        $endDate: String, 
        $startDate: String, 
        $one_time: Boolean, 
        $is_repeating: Boolean, 
        $contact_type_id: ID,
        $includeRepeating: Boolean, 
        $appointment_type_id: ID, 
        $appointment_location_id: ID, 
        $timezone: String
      ) {
        availabilities(
          user_id: $user_id
          endDate: $endDate
          one_time: $one_time
          startDate: $startDate
          is_repeating: $is_repeating
          contact_type_id: $contact_type_id
          includeRepeating: $includeRepeating
          appointment_type_id: $appointment_type_id
          appointment_location_id: $appointment_location_id
          timezone: $timezone
        ) {
          id
          user_id
          range_end
          resourceId
          range_start
          day_of_week
          end_on
          user {
  id,
  name
}
          is_repeating
          timezone_abbr
          contact_type_id
          origin_start_date
          appointment_type_id
          appointment_location_id
          repeating_availability_id
        }
      }
    `;

    const variables = {
      user_id: providerId?.toString() || null,
      appointment_location_id: locationId?.toString() || null,
      appointment_type_id: appointmentTypeId?.toString() || null,
      startDate: startDate,
      endDate: endDate,
      timezone: userTimeZone,
      one_time: true,
      is_repeating: true,
      includeRepeating: true,
      contact_type_id: null
    };

    try {
      const result = await this.graphqlRequest(query, variables);
      return result.data.availabilities;
    } catch (error) {
      console.error('Error fetching availabilities:', error);
      throw error;
    }
  }

  // // CORRECTED getProviders method - using 'provider' (singular) not 'providers'
  // async getProviders(locationId, serviceId) {
  //   // First, try to get multiple providers using users query
  //   const query = `
  //       query getUsers(
  //           $keywords: String,
  //           $location_id: ID,
  //           $appointment_type_id: ID,
  //           $page_size: Int,
  //           $offset: Int
  //       ) {
  //           users(
  //               keywords: $keywords,
  //               location_id: $location_id,
  //               appointment_type_id: $appointment_type_id,
  //               page_size: $page_size,
  //               offset: $offset,
  //               include_suborganizations: false
  //           ) {
  //               id
  //               full_name
  //               first_name
  //               last_name
  //               email
  //               phone_number
  //               speciality
  //               years_of_experience
  //               rating
  //               bio
  //               avatar_url
  //               is_provider
  //               active
  //           }
  //       }
  //   `;

  //   const variables = {
  //     location_id: locationId?.toString() || null,
  //     appointment_type_id: serviceId?.toString() || null,
  //     keywords: null,
  //     page_size: 50,
  //     offset: 0
  //   };

  //   try {
  //     const result = await this.graphqlRequest(query, variables);
  //     // Filter to only return providers
  //     const providers = (result.data?.users || []).filter(user =>
  //       user.is_provider !== false && user.active !== false
  //     );

  //     console.log(`Found ${providers.length} providers for location ${locationId} and service ${serviceId}`);
  //     return providers;
  //   } catch (error) {
  //     console.error('Failed to fetch providers:', error);

  //     // Fallback: try alternate query structure if available
  //     try {
  //       const alternateQuery = `
  //               query getReferringPhysicians {
  //                   referringPhysicians {
  //                       id
  //                       full_name
  //                       speciality
  //                       location_id
  //                       accepts_insurance
  //                       phone_number
  //                   }
  //               }
  //           `;

  //       const alternateResult = await this.graphqlRequest(alternateQuery);
  //       const physicians = alternateResult.data?.referringPhysicians || [];

  //       // Filter by location if provided
  //       if (locationId) {
  //         return physicians.filter(p =>
  //           !p.location_id || p.location_id === locationId.toString()
  //         );
  //       }

  //       return physicians;
  //     } catch (alternateError) {
  //       console.error('Alternate provider fetch also failed:', alternateError);
  //       return [];
  //     }
  //   }
  // }

  // Alternative: Get a single provider by ID
  async getProvider(providerId) {
    const query = `
        query getProvider($id: ID!) {
            provider(id: $id) {
                id
                full_name
                first_name
                last_name
                email
                phone_number
                speciality
                years_of_experience
                rating
                bio
                avatar_url
                active
            }
        }
    `;

    const variables = {
      id: providerId.toString()
    };

    try {
      const result = await this.graphqlRequest(query, variables);
      return result.data?.provider || null;
    } catch (error) {
      console.error('Failed to fetch provider:', error);
      return null;
    }
  }
  // Helper method to process the calendar data
  processCalendarData(data) {
    const { availabilities = [], appointments = [] } = data;
    const processedSlots = [];

    // Group appointments by provider for efficient lookup
    const appointmentsByProvider = {};
    appointments.forEach(apt => {
      const providerId = apt.provider?.id;
      if (providerId) {
        if (!appointmentsByProvider[providerId]) {
          appointmentsByProvider[providerId] = [];
        }
        appointmentsByProvider[providerId].push(apt);
      }
    });

    // Process each availability range
    availabilities.forEach(availability => {
      const providerId = availability.user_id;
      const providerAppointments = appointmentsByProvider[providerId] || [];

      // Generate time slots from this availability
      const slots = this.generateTimeSlots(
        availability,
        providerAppointments
      );

      processedSlots.push(...slots);
    });

    return processedSlots;
  }

  // Helper to generate time slots from an availability range
  generateTimeSlots(availability, appointments, slotDuration = 15) {
    const slots = [];
    const start = new Date(availability.range_start);
    const end = new Date(availability.range_end);

    let current = new Date(start);

    while (current < end) {
      const slotEnd = new Date(current);
      slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);

      // Check if this slot overlaps with any appointment
      const isBooked = appointments.some(apt => {
        if (!apt.start || !apt.end) return false;

        const aptStart = new Date(apt.start);
        const aptEnd = new Date(apt.end);

        // Check for overlap
        return (
          (current >= aptStart && current < aptEnd) ||
          (slotEnd > aptStart && slotEnd <= aptEnd) ||
          (current <= aptStart && slotEnd >= aptEnd)
        );
      });

      // Check if appointment is a blocker
      const isBlocked = appointments.some(apt => {
        if (!apt.is_blocker || !apt.start || !apt.end) return false;

        const aptStart = new Date(apt.start);
        const aptEnd = new Date(apt.end);

        return current >= aptStart && current < aptEnd;
      });

      if (!isBooked && !isBlocked) {
        slots.push({
          id: `${availability.id}-${current.toISOString()}`,
          start: new Date(current),
          end: new Date(slotEnd),
          availabilityId: availability.id,
          providerId: availability.user_id,
          locationId: availability.appointment_location_id,
          appointmentTypeId: availability.appointment_type_id
        });
      }

      current = slotEnd;
    }

    return slots;
  }

  // Helper method to parse the timezone from the response
  parseTimezoneFromAbbr(timezoneAbbr) {
    const timezoneMap = {
      'GMT+05:00': 'Asia/Yekaterinburg',
      'EST': 'America/New_York',
      'CST': 'America/Chicago',
      'MST': 'America/Denver',
      'PST': 'America/Los_Angeles',
      // Add more mappings as needed
    };
    return timezoneMap[timezoneAbbr] || 'UTC';
  }



  async getAcceptedInsurancePlans() {
    const query = `
            query insurancePlans($is_accepted: Boolean) {
                insurancePlans(is_accepted: $is_accepted, sort_by: "payer_name_asc") {
                    id
                    name_and_id
                    payer_id
                    payer_name
                    is_accepted
                }
            }
        `;

    const response = await this.graphqlRequest(query, { is_accepted: true });
    return response?.data?.insurancePlans || [];
  }

  /**
   * Get all insurance plans with filters
   */
  // async getInsurancePlans(params = {}) {
  //   const query = `
  //           query insurancePlans($ids: String, $keywords: String, $is_accepted: Boolean, $sort_by: String) {
  //               insurancePlans(ids: $ids, keywords: $keywords, is_accepted: $is_accepted, sort_by: $sort_by) {
  //                   id
  //                   name_and_id
  //                   payer_id
  //                   payer_name
  //                   is_accepted
  //               }
  //           }
  //       `;

  //   return await this.request(query, params);
  // }

  /**
   * Verify insurance eligibility (mock - replace with actual verification API)
   */
  // async verifyInsurance(params) {
  //   // Note: Healthie doesn't have a direct insurance verification API
  //   // You might need to integrate with a third-party service like Eligible or ChangeHealthcare
  //   // This is a mock implementation

  //   try {
  //     // For now, we'll just check if the plan exists
  //     const plans = await this.getInsurancePlans({ ids: params.insurance_plan_id });

  //     if (plans?.data?.insurancePlans?.length > 0) {
  //       return {
  //         verified: true,
  //         copay_amount: 25, // Default copay
  //         coverage_amount: 125, // Default coverage
  //         deductible_met: false,
  //         deductible_remaining: 500
  //       };
  //     }

  //     return { verified: false };
  //   } catch (error) {
  //     console.error('Insurance verification error:', error);
  //     return { verified: false };
  //   }
  // }

  // =============== SUPERBILLS ===============

  /**
   * Create a superbill
   */
  async createSuperbill(superbillData) {
    const mutation = `
          mutation createSuperBill(
      $status: String
      $patient_id: ID
      $patient_name: String
      $dietitian_id: ID
      $service_date: ISO8601DateTime
      $referrer_npi: String
      $referrer_name: String
      $patient_dob: String
      $patient_phone: String
      $tax_id: ID
      $npi: String
      $license_num: String
      $provider_name: String
      $address: String
      $amount_paid: String
      $prov_line1: String
      $prov_line2: String
      $prov_city: String
      $prov_email: String
      $prov_zip: String
      $prov_state: String
      $prov_phone: String
      $place_of_service_id: ID
      $location_id: ID
      $location: LocationInputs
      $patient_location: PatientLocationInputs
      $icd_codes_super_bills: [IcdCodesSuperBillInput]
      $cpt_codes_super_bills: [CptCodesSuperBillInput]
      $receipt_line_items: [ReceiptLineItemInput]
    ) {
      createSuperBill(
        input: {
          status: $status
          patient_id: $patient_id
          patient_name: $patient_name
          dietitian_id: $dietitian_id
          service_date: $service_date
          referrer_npi: $referrer_npi
          referrer_name: $referrer_name
          patient_dob: $patient_dob
          patient_phone: $patient_phone
          tax_id: $tax_id
          npi: $npi
          license_num: $license_num
          provider_name: $provider_name
          address: $address
          amount_paid: $amount_paid
          prov_line1: $prov_line1
          prov_line2: $prov_line2
          prov_city: $prov_city
          prov_email: $prov_email
          prov_zip: $prov_zip
          prov_state: $prov_state
          prov_phone: $prov_phone
          place_of_service_id: $place_of_service_id
          location_id: $location_id
          location: $location
          patient_location: $patient_location
          icd_codes_super_bills: $icd_codes_super_bills
          cpt_codes_super_bills: $cpt_codes_super_bills
          receipt_line_items: $receipt_line_items
        }
      ) {
        newSuperBill: superBill {
          ...SuperBillFragment
          __typename
        }
        messages {
          field
          message
          __typename
        }
        __typename
      }
    }

    fragment SuperBillFragment on SuperBill {
      id
      created_at
      status
      patient_id
      patient_name
      dietitian_id
      service_date
      referrer_name
      referrer_npi
      patient_dob
      patient_phone
      tax_id
      npi
      license_num
      provider_name
      address
      amount_paid
      prov_email
      prov_phone
      place_of_service_id
      location_id
      patient_location_id
      total_fee
      balance_due
      cpt_code_names
      patient {
        id
        full_name
        full_legal_name
        first_name
        last_name
        phone_number
        full_legal_name_with_preferred
        avatar_url
        email
        __typename
      }
      provider {
        id
        qualifications
        brand {
          brand_name
          logo_url
          __typename
        }
        __typename
      }
      location {
        id
        name
        line1
        line2
        city
        state
        zip
        __typename
      }
      patient_location {
        id
        name
        line1
        line2
        city
        state
        zip
        __typename
      }
      place_of_service {
        code_name
        id
        __typename
      }
      receipt_line_items {
        ...ReceiptLineItemFragment
        __typename
      }
      cpt_codes_super_bills {
        ...CptCodesSuperBillFragment
        __typename
      }
      icd_codes_super_bills {
        ...IcdCodesSuperBillFragment
        __typename
      }
      __typename
    }

    fragment ReceiptLineItemFragment on ReceiptLineItem {
      description
      previous_price
      created_at
      id
      price
      __typename
    }

    fragment CptCodesSuperBillFragment on CptCodesSuperBill {
      fee
      units
      cpt_code_id
      service_date
      mod1
      mod2
      mod3
      mod4
      pointers
      cpt_code {
        id
        code
        description
        __typename
      }
      __typename
    }

    fragment IcdCodesSuperBillFragment on IcdCodesSuperBill {
      id
      icd_code_id
      icd_code {
        code
        description
        id
        __typename
      }
      __typename
    }
        `;

    return await this.graphqlRequest(mutation, superbillData);
  }

  /**
   * Update a superbill (to send to patient)
   */
  async updateSuperbill(superbillId, updateData) {
    const mutation = `
            mutation updateSuperBill(
                $id: ID,
                $status: String,
                $should_email_to_client: Boolean
            ) {
                updateSuperBill(input: {
                    id: $id,
                    status: $status,
                    should_email_to_client: $should_email_to_client
                }) {
                    superBill {
                        id
                        name
                        status
                    }
                    messages {
                        field
                        message
                    }
                }
            }
        `;

    return await this.graphqlRequest(mutation, { id: superbillId, ...updateData });
  }

  /**
   * Get superbill details
   */
  async getSuperbill(superbillId) {
    const query = `
            query superBill($id: ID) {
                superBill(id: $id) {
                    id
                    name
                    amount_paid
                    balance_due
                    total_fee
                    status
                    service_date
                    patient {
                        id
                        first_name
                        last_name
                        email
                        dob
                    }
                    provider {
                        id
                        first_name
                        last_name
                        npi
                    }
                    icd_codes_super_bills {
                        id
                        code
                        description
                    }
                    cpt_codes_super_bills {
                        id
                        code
                        description
                        units
                        fee
                    }
                }
            }
        `;

    return await this.graphqlRequest(query, { id: superbillId });
  }

  // =============== CMS1500 CLAIMS ===============

  /**
   * Create a CMS1500 insurance claim
   */
  async createCMS1500(variables) {
    const mutation = `
        mutation createCms1500(
            $patient: PatientInput
            $dietitian: DietitianInput
            $service_location_id: ID  # Changed from String to ID
            $amount_paid: String
            $cms1500_policies: [Cms1500PolicyInput!]
            $icd_codes_cms1500s: [IcdCodesCms1500Input!]
            $cpt_codes_cms1500s: [CptCodesCms1500Input!]
            $client_sig_on_file: Boolean
        ) {
            createCms1500(
                input: {
                    patient: $patient
                    dietitian: $dietitian
                    service_location_id: $service_location_id
                    amount_paid: $amount_paid
                    cms1500_policies: $cms1500_policies
                    icd_codes_cms1500s: $icd_codes_cms1500s
                    cpt_codes_cms1500s: $cpt_codes_cms1500s
                    client_sig_on_file: $client_sig_on_file
                }
            ) {
                cms1500 {
                    id
                    amount_paid
                    patient {
                        id
                        name
                    }
                    status
                }
                messages {
                    field
                    message
                }
            }
        }
    `;

    return await this.graphqlRequest(mutation, variables);
  }

  /**
   * Update CMS1500 claim status
   */
  async updateCMS1500(cms1500Id, updateData) {
    const mutation = `
            mutation updateCms1500(
                $id: ID
                $status: String
                $amount_paid: String
            ) {
                updateCms1500(
                    input: {
                        id: $id
                        status: $status
                        amount_paid: $amount_paid
                    }
                ) {
                    cms1500 {
                        id
                        name
                        status
                    }
                    messages {
                        field
                        message
                    }
                }
            }
        `;

    return await this.graphqlRequest(mutation, { id: cms1500Id, ...updateData });
  }

  /**
   * Get CMS1500 claim details
   */
  async getCMS1500(cms1500Id) {
    const query = `
            query cms1500($id: ID) {
                cms1500(id: $id) {
                    id
                    name
                    status
                    amount_paid
                    amount_reimbursed
                    service_date
                    patient {
                        id
                        first_name
                        last_name
                        dob
                        email
                        phone_number
                    }
                    provider {
                        id
                        first_name
                        last_name
                        npi
                    }
                    icd_codes_cms1500s {
                        id
                        code
                        description
                    }
                    cpt_codes_cms1500s {
                        id
                        code
                        description
                        units
                        fee
                        modifier_1
                        modifier_2
                    }
                }
            }
        `;

    return await this.graphqlRequest(query, { id: cms1500Id });
  }

  /**
   * List CMS1500 claims
   */
  async listCMS1500s(params = {}) {
    const query = `
            query cms1500s($keywords: String, $sort_by: String, $status: String, $client_id: ID, $provider_id: ID) {
                cms1500s(
                    keywords: $keywords, 
                    sort_by: $sort_by, 
                    status: $status, 
                    client_id: $client_id, 
                    provider_id: $provider_id
                ) {
                    id
                    name
                    status
                    amount_paid
                    amount_reimbursed
                    service_date
                    patient {
                        id
                        first_name
                        last_name
                    }
                }
            }
        `;

    return await this.graphqlRequest(query, params);
  }

  // =============== PATIENT/CLIENT METHODS ===============

  /**
   * Get client by email
   */
  // async getClientByEmail(email) {
  //   const query = `
  //           query clients($keywords: String) {
  //               clients(keywords: $keywords) {
  //                   id
  //                   first_name
  //                   last_name
  //                   email
  //                   phone_number
  //                   dob
  //               }
  //           }
  //       `;

  //   const response = await this.graphqlRequest(query, { keywords: email });
  //   return response?.data?.clients?.[0] || null;
  // }

  /**
   * Create a new client/patient
   */
  // async createClient(clientData) {
  //   const mutation = `
  //           mutation createClient(
  //               $first_name: String,
  //               $last_name: String,
  //               $email: String,
  //               $phone: String,
  //               $dob: String
  //           ) {
  //               createClient(input: {
  //                   first_name: $first_name,
  //                   last_name: $last_name,
  //                   email: $email,
  //                   phone_number: $phone,
  //                   dob: $dob,
  //                   skip_email: false
  //               }) {
  //                   user {
  //                       id
  //                       first_name
  //                       last_name
  //                       email
  //                   }
  //                   messages {
  //                       field
  //                       message
  //                   }
  //               }
  //           }
  //       `;

  //   const response = await this.graphqlRequest(mutation, clientData);
  //   return response?.data?.createClient?.user || null;
  // }

  // =============== PAYMENT METHODS ===============

  /**
  //  * Store a card using Stripe token
  //  */
  // async storeCard(cardData) {
  //   const mutation = `
  //           mutation createStripeCustomerDetail(
  //               $user_id: ID,
  //               $token: String,
  //               $card_type_label: String,
  //               $is_default: Boolean
  //           ) {
  //               createStripeCustomerDetail(input: {
  //                   user_id: $user_id,
  //                   token: $token,
  //                   card_type_label: $card_type_label,
  //                   is_default: $is_default
  //               }) {
  //                   stripe_customer_detail {
  //                       id
  //                       last_four
  //                       card_type
  //                       is_default
  //                   }
  //                   messages {
  //                       field
  //                       message
  //                   }
  //               }
  //           }
  //       `;

  //   const response = await this.graphqlRequest(mutation, cardData);
  //   return response?.data?.createStripeCustomerDetail?.stripe_customer_detail || null;
  // }

  /**
   * Create a billing item and charge
   */
  // async createBillingItem(billingData) {
  //   const mutation = `
  //           mutation createBillingItem(
  //               $amount_paid: String,
  //               $sender_id: ID,
  //               $stripe_customer_detail_id: ID,
  //               $stripe_idempotency_key: String,
  //               $should_charge: Boolean,
  //               $notes: String
  //           ) {
  //               createBillingItem(input: {
  //                   amount_paid: $amount_paid,
  //                   sender_id: $sender_id,
  //                   stripe_customer_detail_id: $stripe_customer_detail_id,
  //                   stripe_idempotency_key: $stripe_idempotency_key,
  //                   should_charge: $should_charge,
  //                   notes: $notes
  //               }) {
  //                   billing_item {
  //                       id
  //                       amount_paid
  //                       status
  //                   }
  //                   messages {
  //                       field
  //                       message
  //                   }
  //               }
  //           }
  //       `;

  //   const response = await this.graphqlRequest(mutation, billingData);
  //   return response?.data?.createBillingItem?.billing_item || null;
  // }

}



export default new HealthieAPI();

