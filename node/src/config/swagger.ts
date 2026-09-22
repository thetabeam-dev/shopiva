import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Deedyte API',
      version: '1.0.0',
      description: 'API documentation for Deedyte e-commerce platform',
      contact: {
        name: 'Akpulu Chinedu Fabian',
        email: 'support@deedyte.com'
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC'
      }
    },
    servers: [
      {
        url: 'http://10.170.100.239:3000',
        description: 'Development server'
      },
      {
        url: 'https://api.deedyte.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token'
        }
      },
      schemas: {
        // ==================== USER SCHEMAS ====================
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: 'Unique user identifier' },
            role: { type: 'string', enum: ['customer', 'entrepreneur', 'admin'], description: 'User role' },
            fname: { type: 'string', description: 'First name' },
            lname: { type: 'string', description: 'Last name' },
            email: { type: 'string', format: 'email', description: 'Email address' },
            phone: { type: 'string', description: 'Phone number' },
            gender: { type: 'string', description: 'Gender' },
            photo: { type: 'string', description: 'Profile photo URL' },
            location: { $ref: '#/components/schemas/UserLocation' },
            dateOfBirth: { type: 'string', format: 'date', description: 'Date of birth' },
            twoFactorEnabled: { type: 'boolean', description: '2FA enabled status' },
            isActive: { type: 'boolean', description: 'Account active status' },
            isVerified: { type: 'boolean', description: 'Verification status' },
            isEmailVerified: { type: 'boolean', description: 'Email verified' },
            isPhoneVerified: { type: 'boolean', description: 'Phone verified' },
            accountStatus: { type: 'string', enum: ['active', 'suspended', 'banned', 'deleted'] },
            notificationPreferences: { $ref: '#/components/schemas/NotificationPreferences' },
            preferredLanguage: { type: 'string', description: 'Preferred language code' },
            timezone: { type: 'string', description: 'User timezone' },
            lastLogin: { type: 'string', format: 'date-time', description: 'Last login timestamp' },
            lastseen: { type: 'string', format: 'date-time', description: 'Last seen timestamp' },
            createdAt: { type: 'string', format: 'date-time', description: 'Account creation date' },
            updatedAt: { type: 'string', format: 'date-time', description: 'Last update date' },
            socialLinks: { $ref: '#/components/schemas/SocialLinks' },
            profileCompletion: { type: 'integer', minimum: 0, maximum: 100, description: 'Profile completion percentage' }
          }
        },
        UserLocation: {
          type: 'object',
          properties: {
            city: { type: 'string', nullable: true },
            state: { type: 'string', nullable: true },
            country: { type: 'string', nullable: true },
            zipcode: { type: 'string', nullable: true }
          }
        },
        NotificationPreferences: {
          type: 'object',
          properties: {
            email: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                marketing: { type: 'boolean' },
                updates: { type: 'boolean' }
              }
            },
            sms: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                critical: { type: 'boolean' }
              }
            },
            push: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                marketing: { type: 'boolean' }
              }
            }
          }
        },
        SocialLinks: {
          type: 'object',
          properties: {
            linkedin: { type: 'string', nullable: true },
            twitter: { type: 'string', nullable: true },
            instagram: { type: 'string', nullable: true }
          }
        },
        SignupRequest: {
          type: 'object',
          required: ['fname', 'lname', 'email', 'phone', 'password'],
          properties: {
            fname: { type: 'string', example: 'John' },
            lname: { type: 'string', example: 'Doe' },
            email: { type: 'string', format: 'email', example: 'john.doe@example.com' },
            phone: { type: 'string', example: '+2348012345678' },
            password: { type: 'string', format: 'password', example: 'securePassword123' },
            gender: { type: 'string', example: 'male' },
            role: { type: 'string', enum: ['customer', 'entrepreneur'], default: 'customer' },
            src: { type: 'string', enum: ['web', 'mobile'], example: 'web' },
            deviceId: { type: 'string', example: 'device-uuid' },
            deviceToken: { type: 'string', example: 'fcm-token' }
          }
        },
        SigninRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'john.doe@example.com' },
            password: { type: 'string', format: 'password', example: 'securePassword123' }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            token: { type: 'string', description: 'JWT token' },
            user: { $ref: '#/components/schemas/User' }
          }
        },

        // ==================== SHOP SCHEMAS ====================
        Shop: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: 'Shop ID' },
            ownerId: { type: 'integer', description: 'Owner user ID' },
            name: { type: 'string', description: 'Shop name' },
            slug: { type: 'string', description: 'URL-friendly slug' },
            description: { type: 'string', description: 'Shop description' },
            logo: { type: 'string', description: 'Logo URL' },
            banner: { type: 'string', description: 'Banner image URL' },
            category: { type: 'string', description: 'Shop category' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Tags for discoverability' },
            contactEmail: { type: 'string', format: 'email' },
            contactPhone: { type: 'string' },
            vendorType: { type: 'string', enum: ['manufacturer', 'reseller', 'dropshipper'] },
            location: { $ref: '#/components/schemas/ShopLocation' },
            socialLinks: { $ref: '#/components/schemas/ShopSocialLinks' },
            isActive: { type: 'boolean' },
            isVerified: { type: 'boolean' },
            status: { type: 'string', enum: ['active', 'suspended', 'closed', 'pending_approval'] },
            verificationDocuments: { $ref: '#/components/schemas/VerificationDocuments' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        ShopLocation: {
          type: 'object',
          properties: {
            address: { type: 'string', nullable: true },
            city: { type: 'string', nullable: true },
            state: { type: 'string', nullable: true },
            country: { type: 'string', nullable: true },
            zipcode: { type: 'string', nullable: true },
            coordinates: {
              type: 'object',
              nullable: true,
              properties: {
                lat: { type: 'number' },
                lng: { type: 'number' }
              }
            }
          }
        },
        ShopSocialLinks: {
          type: 'object',
          properties: {
            facebook: { type: 'string', nullable: true },
            instagram: { type: 'string', nullable: true },
            twitter: { type: 'string', nullable: true },
            website: { type: 'string', nullable: true },
            tiktok: { type: 'string', nullable: true }
          }
        },
        VerificationDocuments: {
          type: 'object',
          properties: {
            businessLicense: { $ref: '#/components/schemas/VerificationDocument' },
            taxId: { $ref: '#/components/schemas/VerificationDocument' },
            identityProof: { $ref: '#/components/schemas/VerificationDocument' }
          }
        },
        VerificationDocument: {
          type: 'object',
          properties: {
            url: { type: 'string', nullable: true },
            verified: { type: 'boolean' },
            submittedAt: { type: 'string', format: 'date-time', nullable: true }
          }
        },
        CreateShopRequest: {
          type: 'object',
          required: ['name', 'slug', 'vendortype'],
          properties: {
            name: { type: 'string', example: 'Cargo Tech Store' },
            slug: { type: 'string', example: 'cargo-tech-store' },
            description: { type: 'string', example: 'Premium tech accessories' },
            logo: { type: 'string', example: 'https://cdn.example.com/logo.png' },
            category: { type: 'string', example: 'Electronics' },
            vendortype: { type: 'string', enum: ['manufacturer', 'reseller', 'dropshipper'], example: 'reseller' }
          }
        },
        UpdateShopRequest: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string' },
            logo: { type: 'string' },
            banner: { type: 'string' },
            category: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            contactEmail: { type: 'string', format: 'email' },
            contactPhone: { type: 'string' },
            vendorType: { type: 'string', enum: ['manufacturer', 'reseller', 'dropshipper'] },
            location: { $ref: '#/components/schemas/ShopLocation' },
            socialLinks: { $ref: '#/components/schemas/ShopSocialLinks' },
            isActive: { type: 'boolean' },
            isVerified: { type: 'boolean' },
            status: { type: 'string', enum: ['active', 'suspended', 'closed', 'pending_approval'] },
            verificationDocuments: { $ref: '#/components/schemas/VerificationDocuments' }
          }
        },

        // ==================== SHOP POLICY SCHEMAS ====================
        DeliveryPolicy: {
          type: 'object',
          properties: {
            processingTime: { type: 'integer', nullable: true, description: 'Processing time in days' },
            shippingMethods: { type: 'array', items: { type: 'string' }, example: ['Standard Delivery', 'Express Delivery'] },
            domesticShipping: {
              type: 'object',
              properties: {
                available: { type: 'boolean' },
                regions: { type: 'array', items: { type: 'string' } }
              }
            },
            interstateShipping: {
              type: 'object',
              properties: {
                available: { type: 'boolean' },
                countries: { type: 'array', items: { type: 'string' } }
              }
            },
            restrictions: { type: 'string', nullable: true },
            trackingProvided: { type: 'boolean' }
          }
        },
        RefundPolicy: {
          type: 'object',
          properties: {
            returnWindow: { type: 'integer', description: 'Return window in days', example: 7 },
            returnConditions: { type: 'string', nullable: true },
            refundMethod: { type: 'string', enum: ['original_payment'], default: 'original_payment' },
            restockingFee: { type: 'number', description: 'Restocking fee percentage', example: 0 },
            damagedItemsPolicy: { type: 'string', nullable: true },
            refundProcessingTime: { type: 'integer', nullable: true, description: 'Processing time in days' }
          }
        },
        CustomPolicy: {
          type: 'object',
          properties: {
            title: { type: 'string', example: 'Order Cancellation Policy' },
            content: { type: 'string', example: 'Orders can be cancelled within 12 hours.' },
            lastUpdated: { type: 'string', format: 'date-time' }
          }
        },
        ShopPoliciesRequest: {
          type: 'object',
          properties: {
            deliveryPolicy: { $ref: '#/components/schemas/DeliveryPolicy' },
            refundPolicy: { $ref: '#/components/schemas/RefundPolicy' },
            customPolicies: { type: 'array', items: { $ref: '#/components/schemas/CustomPolicy' } }
          }
        },

        // ==================== PAYOUT ACCOUNT SCHEMAS ====================
        PayoutAccountRequest: {
          type: 'object',
          required: ['bank_name', 'bank_code', 'account_name', 'account_number'],
          properties: {
            bank_name: { type: 'string', example: 'First Bank of Nigeria' },
            bank_code: { type: 'string', example: '011' },
            account_name: { type: 'string', example: 'John Doe' },
            account_number: { type: 'string', example: '1234567890' }
          }
        },
        PayoutAccount: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            shop_id: { type: 'integer' },
            provider: { type: 'string', enum: ['paystack', 'flutterwave', 'stripe', 'manual'] },
            country_code: { type: 'string', example: 'NG' },
            currency: { type: 'string', example: 'NGN' },
            bank_name: { type: 'string' },
            bank_code: { type: 'string' },
            account_name: { type: 'string' },
            account_number_last4: { type: 'string', description: 'Last 4 digits only' },
            provider_recipient_id: { type: 'string' },
            is_primary: { type: 'boolean' },
            status: { type: 'string', enum: ['pending', 'verified', 'rejected', 'disabled'] },
            verification_method: { type: 'string', enum: ['bank', 'kyc', 'manual'] },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },

        // ==================== REVIEW SCHEMAS ====================
        ShopReview: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            shop_id: { type: 'integer' },
            reviewer_id: { type: 'integer' },
            order_id: { type: 'integer', nullable: true },
            rating: { type: 'integer', minimum: 1, maximum: 5 },
            title: { type: 'string' },
            comment: { type: 'string' },
            is_verified_purchase: { type: 'boolean' },
            is_hidden: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        ShopReviewMetrics: {
          type: 'object',
          properties: {
            shop_id: { type: 'integer' },
            review_count: { type: 'integer' },
            average_rating: { type: 'number', format: 'float' },
            rating_1_count: { type: 'integer' },
            rating_2_count: { type: 'integer' },
            rating_3_count: { type: 'integer' },
            rating_4_count: { type: 'integer' },
            rating_5_count: { type: 'integer' },
            last_reviewed_at: { type: 'string', format: 'date-time', nullable: true },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },

        // ==================== COMMON SCHEMAS ====================
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'Error message' }
          }
        },
        SuccessMessage: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Success message' }
          }
        }
      }
    },
    tags: [
      { name: 'Authentication', description: 'User authentication endpoints' },
      { name: 'Users', description: 'User management endpoints' },
      { name: 'Shops', description: 'Shop management endpoints' },
      { name: 'Shop Policies', description: 'Shop policy management' },
      { name: 'Payout Accounts', description: 'Shop payout account management' },
      { name: 'Reviews', description: 'Shop reviews and metrics' }
    ],
    paths: {
      // ==================== AUTHENTICATION ====================
      '/user/signup': {
        post: {
          tags: ['Authentication'],
          summary: 'Register a new user',
          description: 'Creates a new user account. If the email was previously deleted, it will be recreated.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SignupRequest' }
              }
            }
          },
          responses: {
            '201': {
              description: 'User created successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AuthResponse' }
                }
              }
            },
            '400': {
              description: 'Bad request - Email or phone already registered',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        }
      },
      '/user/signin': {
        post: {
          tags: ['Authentication'],
          summary: 'User login',
          description: 'Authenticates a user and returns a JWT token',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SigninRequest' }
              }
            }
          },
          responses: {
            '200': {
              description: 'Login successful',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AuthResponse' }
                }
              }
            },
            '401': {
              description: 'Invalid credentials',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        }
      },

      // ==================== USER MANAGEMENT ====================
      '/api/account': {
        delete: {
          tags: ['Users'],
          summary: 'Delete own account permanently',
          description: 'Permanently deletes the authenticated user account and removes/anonymizes related personal data. This action cannot be undone.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    password: { type: 'string', description: 'Required for local/password accounts' },
                    oauthProvider: { type: 'string', enum: ['google', 'facebook', 'apple'] },
                    oauthReauthenticated: { type: 'boolean' },
                    oauthReauthenticatedAt: { type: 'string', format: 'date-time' },
                    oauthReauthToken: { type: 'string', description: 'Fresh JWT obtained from OAuth re-authentication flow' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Account deleted successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: true },
                      message: { type: 'string', example: 'Account deleted successfully.' }
                    }
                  }
                }
              }
            },
            '401': { description: 'Unauthorized' },
            '403': { description: 'Forbidden / invalid password' },
            '422': { description: 'Re-authentication required' },
            '500': { description: 'Internal server error' }
          }
        }
      },
      '/user/delete/{id}': {
        delete: {
          deprecated: true,
          tags: ['Users'],
          summary: 'Delete user account',
          description: 'Legacy self-delete endpoint. Prefer DELETE /api/account.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'User ID'
            }
          ],
          responses: {
            '200': {
              description: 'User deleted successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessMessage' }
                }
              }
            },
            '401': { description: 'Unauthorized' },
            '500': { description: 'Internal server error' }
          }
        }
      },
      '/user/role/update/{id}': {
        put: {
          tags: ['Users'],
          summary: 'Update user role',
          description: 'Updates the user role (e.g., customer to entrepreneur)',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'User ID'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['role'],
                  properties: {
                    role: { type: 'string', enum: ['customer', 'entrepreneur', 'admin'] }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Role updated successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      user: { $ref: '#/components/schemas/User' }
                    }
                  }
                }
              }
            },
            '400': { description: 'Bad request' },
            '401': { description: 'Unauthorized' }
          }
        }
      },
      '/user/email/update/{id}': {
        put: {
          tags: ['Users'],
          summary: 'Update user email',
          description: 'Updates the user email address. Email must be unique.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'User ID'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email'],
                  properties: {
                    email: { type: 'string', format: 'email', example: 'new.email@example.com' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Email updated successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      user: { $ref: '#/components/schemas/User' }
                    }
                  }
                }
              }
            },
            '400': { description: 'Email already in use' },
            '401': { description: 'Unauthorized' }
          }
        }
      },
      '/user/phone/update/{id}': {
        put: {
          tags: ['Users'],
          summary: 'Update user phone',
          description: 'Updates the user phone number. Phone must be unique.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'User ID'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['phone'],
                  properties: {
                    phone: { type: 'string', example: '+2348098765432' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Phone updated successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      user: { $ref: '#/components/schemas/User' }
                    }
                  }
                }
              }
            },
            '400': { description: 'Phone already in use' },
            '401': { description: 'Unauthorized' }
          }
        }
      },
      '/user/photo/update/{id}': {
        put: {
          tags: ['Users'],
          summary: 'Update user photo',
          description: 'Updates the user profile photo URL',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'User ID'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['photo'],
                  properties: {
                    photo: { type: 'string', example: 'https://cdn.example.com/photo.jpg' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Photo updated successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      user: { $ref: '#/components/schemas/User' }
                    }
                  }
                }
              }
            },
            '400': { description: 'Bad request' },
            '401': { description: 'Unauthorized' }
          }
        }
      },
      '/user/profile/update/{id}': {
        put: {
          tags: ['Users'],
          summary: 'Update user profile',
          description: 'Updates basic profile information (fname, lname, gender)',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'User ID'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    fname: { type: 'string', example: 'John' },
                    lname: { type: 'string', example: 'Smith' },
                    gender: { type: 'string', example: 'male' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Profile updated successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      user: { $ref: '#/components/schemas/User' }
                    }
                  }
                }
              }
            },
            '400': { description: 'Bad request' },
            '401': { description: 'Unauthorized' }
          }
        }
      },
      '/user/password/update/{id}': {
        put: {
          tags: ['Users'],
          summary: 'Update user password',
          description: 'Updates the user password. Password is hashed before storage.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'User ID'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['password'],
                  properties: {
                    password: { type: 'string', format: 'password', example: 'newSecurePassword456' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Password updated successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessMessage' }
                }
              }
            },
            '400': { description: 'Bad request' },
            '401': { description: 'Unauthorized' }
          }
        }
      },

      // ==================== SHOP MANAGEMENT ====================
      '/shop/create/{id}': {
        post: {
          tags: ['Shops'],
          summary: 'Create a new shop',
          description: 'Creates a new shop for the authenticated user',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'User ID (shop owner)'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateShopRequest' }
              }
            }
          },
          responses: {
            '201': {
              description: 'Shop created successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      result: { type: 'integer' }
                    }
                  }
                }
              }
            },
            '400': { description: 'Bad request' },
            '401': { description: 'Unauthorized' }
          }
        }
      },
      '/shop/update/{shopId}/{id}': {
        post: {
          tags: ['Shops'],
          summary: 'Update shop',
          description: 'Updates an existing shop',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'shopId',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'Shop ID'
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'User ID (owner)'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UpdateShopRequest' }
              }
            }
          },
          responses: {
            '200': {
              description: 'Shop updated successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      result: { $ref: '#/components/schemas/Shop' }
                    }
                  }
                }
              }
            },
            '400': { description: 'Bad request' },
            '401': { description: 'Unauthorized' }
          }
        }
      },
      '/shop/delete/{shopId}/{id}': {
        post: {
          tags: ['Shops'],
          summary: 'Delete shop',
          description: 'Permanently deletes a shop and all associated data',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'shopId',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'Shop ID'
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'User ID (owner)'
            }
          ],
          responses: {
            '200': {
              description: 'Shop deleted successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessMessage' }
                }
              }
            },
            '401': { description: 'Unauthorized' },
            '500': { description: 'Internal server error' }
          }
        }
      },
      '/shop/{shopId}/{id}': {
        get: {
          tags: ['Shops'],
          summary: 'Get shop details',
          description: 'Retrieves shop details by ID',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'shopId',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'Shop ID'
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'User ID'
            }
          ],
          responses: {
            '200': {
              description: 'Shop retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      shop: { $ref: '#/components/schemas/Shop' }
                    }
                  }
                }
              }
            },
            '400': { description: 'Invalid Shop ID' },
            '500': { description: 'Internal server error' }
          }
        }
      },

      // ==================== SHOP POLICIES ====================
      '/shop/policy/create/{shopId}/{id}': {
        post: {
          tags: ['Shop Policies'],
          summary: 'Create shop policies',
          description: 'Creates delivery, refund, and custom policies for a shop',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'shopId',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'Shop ID'
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'User ID'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ShopPoliciesRequest' }
              }
            }
          },
          responses: {
            '201': {
              description: 'Shop policy created successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      result: { type: 'integer' }
                    }
                  }
                }
              }
            },
            '400': { description: 'Bad request' },
            '401': { description: 'Unauthorized' }
          }
        }
      },
      '/shop/policy/update/{policyId}/{id}': {
        post: {
          tags: ['Shop Policies'],
          summary: 'Update shop policies',
          description: 'Updates existing shop policies',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'policyId',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'Policy ID'
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'User ID'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ShopPoliciesRequest' }
              }
            }
          },
          responses: {
            '200': {
              description: 'Shop policy updated successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      result: { type: 'object' }
                    }
                  }
                }
              }
            },
            '400': { description: 'Bad request' },
            '401': { description: 'Unauthorized' }
          }
        }
      },

      // ==================== PAYOUT ACCOUNTS ====================
      '/shop/payment/{shopId}/{id}': {
        post: {
          tags: ['Payout Accounts'],
          summary: 'Create payout account',
          description: 'Creates a payout account for receiving withdrawals. Integrates with Paystack.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'shopId',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'Shop ID'
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'User ID'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PayoutAccountRequest' }
              }
            }
          },
          responses: {
            '201': {
              description: 'Payout account created successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      result: { type: 'integer' }
                    }
                  }
                }
              }
            },
            '400': { description: 'Bad request or Paystack verification failed' },
            '401': { description: 'Unauthorized' }
          }
        },
        put: {
          tags: ['Payout Accounts'],
          summary: 'Update payout account',
          description: 'Updates an existing payout account. Re-verifies with Paystack.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'shopId',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'Shop ID'
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'User ID'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PayoutAccountRequest' }
              }
            }
          },
          responses: {
            '200': {
              description: 'Payout account updated successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      result: { $ref: '#/components/schemas/PayoutAccount' }
                    }
                  }
                }
              }
            },
            '400': { description: 'Bad request' },
            '401': { description: 'Unauthorized' }
          }
        }
      },

      // ==================== REVIEWS & METRICS ====================
      '/shop/reviews/{shopId}/{id}': {
        get: {
          tags: ['Reviews'],
          summary: 'Get shop reviews',
          description: 'Retrieves all reviews for a shop',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'shopId',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'Shop ID'
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'User ID'
            }
          ],
          responses: {
            '200': {
              description: 'Reviews retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      reviews: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/ShopReview' }
                      }
                    }
                  }
                }
              }
            },
            '400': { description: 'Invalid Shop ID' },
            '500': { description: 'Internal server error' }
          }
        }
      },
      '/shop/metrics/{shopId}/{id}': {
        get: {
          tags: ['Reviews'],
          summary: 'Get shop metrics',
          description: 'Retrieves aggregated review metrics for a shop',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'shopId',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'Shop ID'
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'User ID'
            }
          ],
          responses: {
            '200': {
              description: 'Metrics retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      metrics: { $ref: '#/components/schemas/ShopReviewMetrics' }
                    }
                  }
                }
              }
            },
            '400': { description: 'Invalid Shop ID' },
            '500': { description: 'Internal server error' }
          }
        }
      }
    }
  },
  apis: [] // We're defining everything inline, no need to scan files
};

export const swaggerSpec = swaggerJsdoc(options);

