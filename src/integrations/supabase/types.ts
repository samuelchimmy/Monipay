export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activation_fundings: {
        Row: {
          amount_wei: string | null
          chain: string
          created_at: string
          funded_at: string | null
          id: string
          profile_id: string | null
          status: string
          tx_hash: string | null
          wallet_address: string
        }
        Insert: {
          amount_wei?: string | null
          chain?: string
          created_at?: string
          funded_at?: string | null
          id?: string
          profile_id?: string | null
          status?: string
          tx_hash?: string | null
          wallet_address: string
        }
        Update: {
          amount_wei?: string | null
          chain?: string
          created_at?: string
          funded_at?: string | null
          id?: string
          profile_id?: string | null
          status?: string
          tx_hash?: string | null
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "activation_fundings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activation_fundings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_peer_feedback_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          peer_agent_id: string
          peer_registry: string
          processed_at: string | null
          processed_tx_hash: string | null
          receipt_uri: string | null
          score: number
          source_endpoint: string | null
          source_request_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          peer_agent_id: string
          peer_registry: string
          processed_at?: string | null
          processed_tx_hash?: string | null
          receipt_uri?: string | null
          score?: number
          source_endpoint?: string | null
          source_request_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          peer_agent_id?: string
          peer_registry?: string
          processed_at?: string | null
          processed_tx_hash?: string | null
          receipt_uri?: string | null
          score?: number
          source_endpoint?: string | null
          source_request_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_used_at: string | null
          profile_id: string
          public_key: string
          secret_key_hash: string
          secret_key_preview: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          profile_id: string
          public_key: string
          secret_key_hash: string
          secret_key_preview: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          profile_id?: string
          public_key?: string
          secret_key_hash?: string
          secret_key_preview?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      app_financials: {
        Row: {
          created_at: string
          id: string
          month: string
          notes: string | null
          overhead: number
          revenue: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          month: string
          notes?: string | null
          overhead?: number
          revenue?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          month?: string
          notes?: string | null
          overhead?: number
          revenue?: number
          updated_at?: string
        }
        Relationships: []
      }
      arc_waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          monitag: string | null
          source: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          monitag?: string | null
          source?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          monitag?: string | null
          source?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      bot_logs: {
        Row: {
          created_at: string
          id: string
          level: string
          message: string
          metadata: Json | null
          service: string
        }
        Insert: {
          created_at?: string
          id?: string
          level?: string
          message: string
          metadata?: Json | null
          service: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
          service?: string
        }
        Relationships: []
      }
      bot_settings: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      campaign_grants: {
        Row: {
          campaign_id: string
          granted_at: string
          id: string
          profile_id: string
        }
        Insert: {
          campaign_id: string
          granted_at?: string
          id?: string
          profile_id: string
        }
        Update: {
          campaign_id?: string
          granted_at?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_grants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_grants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          budget_allocated: number
          budget_spent: number | null
          completed_at: string | null
          created_at: string | null
          current_participants: number | null
          expires_at: string | null
          grant_amount: number
          id: string
          last_checked_id: string | null
          max_participants: number | null
          message: string | null
          network: string
          posted_at: string | null
          status: string
          tweet_id: string | null
          type: string
        }
        Insert: {
          budget_allocated: number
          budget_spent?: number | null
          completed_at?: string | null
          created_at?: string | null
          current_participants?: number | null
          expires_at?: string | null
          grant_amount: number
          id?: string
          last_checked_id?: string | null
          max_participants?: number | null
          message?: string | null
          network?: string
          posted_at?: string | null
          status?: string
          tweet_id?: string | null
          type?: string
        }
        Update: {
          budget_allocated?: number
          budget_spent?: number | null
          completed_at?: string | null
          created_at?: string | null
          current_participants?: number | null
          expires_at?: string | null
          grant_amount?: number
          id?: string
          last_checked_id?: string | null
          max_participants?: number | null
          message?: string | null
          network?: string
          posted_at?: string | null
          status?: string
          tweet_id?: string | null
          type?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          ip_hash: string
          name: string | null
          post_slug: string
          user_agent: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          ip_hash: string
          name?: string | null
          post_slug: string
          user_agent?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          ip_hash?: string
          name?: string | null
          post_slug?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          last_purchase_at: string | null
          name: string | null
          notes: string | null
          pay_tag: string | null
          phone: string | null
          profile_id: string
          tags: string[] | null
          total_orders: number
          total_spent: number
          updated_at: string
          wallet_address: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          last_purchase_at?: string | null
          name?: string | null
          notes?: string | null
          pay_tag?: string | null
          phone?: string | null
          profile_id: string
          tags?: string[] | null
          total_orders?: number
          total_spent?: number
          updated_at?: string
          wallet_address?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          last_purchase_at?: string | null
          name?: string | null
          notes?: string | null
          pay_tag?: string | null
          phone?: string | null
          profile_id?: string
          tags?: string[] | null
          total_orders?: number
          total_spent?: number
          updated_at?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      discord_servers: {
        Row: {
          added_at: string
          default_chain: string | null
          guild_id: string
          guild_name: string | null
          id: string
          is_active: boolean
          member_count: number | null
          owner_id: string | null
          settings: Json
        }
        Insert: {
          added_at?: string
          default_chain?: string | null
          guild_id: string
          guild_name?: string | null
          id?: string
          is_active?: boolean
          member_count?: number | null
          owner_id?: string | null
          settings?: Json
        }
        Update: {
          added_at?: string
          default_chain?: string | null
          guild_id?: string
          guild_name?: string | null
          id?: string
          is_active?: boolean
          member_count?: number | null
          owner_id?: string | null
          settings?: Json
        }
        Relationships: []
      }
      feedback: {
        Row: {
          admin_notes: string | null
          created_at: string
          email: string | null
          id: string
          message: string
          pay_tag: string | null
          profile_id: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message: string
          pay_tag?: string | null
          profile_id?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          pay_tag?: string | null
          profile_id?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_prompts: {
        Row: {
          agent_id: string
          clicked_at: string | null
          created_at: string
          feedback_tx_hash: string | null
          id: string
          platform: string
          platform_user_id: string | null
          prompted_at: string
          registry: string
          score: number | null
          tx_hash: string | null
          user_id: string | null
        }
        Insert: {
          agent_id?: string
          clicked_at?: string | null
          created_at?: string
          feedback_tx_hash?: string | null
          id?: string
          platform: string
          platform_user_id?: string | null
          prompted_at?: string
          registry?: string
          score?: number | null
          tx_hash?: string | null
          user_id?: string | null
        }
        Update: {
          agent_id?: string
          clicked_at?: string | null
          created_at?: string
          feedback_tx_hash?: string | null
          id?: string
          platform?: string
          platform_user_id?: string | null
          prompted_at?: string
          registry?: string
          score?: number | null
          tx_hash?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      gas_spend_snapshots: {
        Row: {
          balance_wei: number
          chain: string
          id: string
          taken_at: string
          wallet_role: string
        }
        Insert: {
          balance_wei?: number
          chain: string
          id?: string
          taken_at?: string
          wallet_role: string
        }
        Update: {
          balance_wei?: number
          chain?: string
          id?: string
          taken_at?: string
          wallet_role?: string
        }
        Relationships: []
      }
      infra_subscriptions: {
        Row: {
          amount: number
          billing_cycle: string
          created_at: string
          currency: string
          id: string
          is_active: boolean
          name: string
          next_due_date: string | null
          notes: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          amount?: number
          billing_cycle?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name: string
          next_due_date?: string | null
          notes?: string | null
          provider: string
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_cycle?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name?: string
          next_due_date?: string | null
          notes?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          expires_at: string | null
          id: string
          items: Json | null
          memo: string | null
          paid_at: string | null
          recipient_pay_tag: string
          recipient_profile_id: string | null
          sender_profile_id: string
          status: string
          tx_hash: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          expires_at?: string | null
          id?: string
          items?: Json | null
          memo?: string | null
          paid_at?: string | null
          recipient_pay_tag: string
          recipient_profile_id?: string | null
          sender_profile_id: string
          status?: string
          tx_hash?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          items?: Json | null
          memo?: string | null
          paid_at?: string | null
          recipient_pay_tag?: string
          recipient_profile_id?: string | null
          sender_profile_id?: string
          status?: string
          tx_hash?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ious: {
        Row: {
          amount: number
          chain: string
          claimed_at: string | null
          created_at: string
          expiry: string
          id: string
          iou_id: string
          platform: string | null
          platform_user_id: string | null
          recipient_id: string
          recipient_identifier: string
          recipient_profile_id: string | null
          sender_handle: string | null
          sender_pay_tag: string
          sender_profile_id: string
          status: Database["public"]["Enums"]["iou_status"]
          token: string
          token_symbol: string
          tx_hash_claim: string | null
          tx_hash_create: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          chain?: string
          claimed_at?: string | null
          created_at?: string
          expiry: string
          id?: string
          iou_id: string
          platform?: string | null
          platform_user_id?: string | null
          recipient_id: string
          recipient_identifier: string
          recipient_profile_id?: string | null
          sender_handle?: string | null
          sender_pay_tag: string
          sender_profile_id: string
          status?: Database["public"]["Enums"]["iou_status"]
          token: string
          token_symbol?: string
          tx_hash_claim?: string | null
          tx_hash_create?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          chain?: string
          claimed_at?: string | null
          created_at?: string
          expiry?: string
          id?: string
          iou_id?: string
          platform?: string | null
          platform_user_id?: string | null
          recipient_id?: string
          recipient_identifier?: string
          recipient_profile_id?: string | null
          sender_handle?: string | null
          sender_pay_tag?: string
          sender_profile_id?: string
          status?: Database["public"]["Enums"]["iou_status"]
          token?: string
          token_symbol?: string
          tx_hash_claim?: string | null
          tx_hash_create?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ious_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ious_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ious_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ious_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_subscriptions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          expires_at: string
          id: string
          plan: string
          profile_id: string
          started_at: string
          status: string
          tx_hash: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          expires_at?: string
          id?: string
          plan?: string
          profile_id: string
          started_at?: string
          status?: string
          tx_hash?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          expires_at?: string
          id?: string
          plan?: string
          profile_id?: string
          started_at?: string
          status?: string
          tx_hash?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      monibot_mission_stats: {
        Row: {
          current_users: number | null
          id: number
          is_onboarded: boolean | null
          last_tweet_at: string | null
          spent_budget: number | null
          target_users: number | null
          total_budget: number | null
        }
        Insert: {
          current_users?: number | null
          id?: number
          is_onboarded?: boolean | null
          last_tweet_at?: string | null
          spent_budget?: number | null
          target_users?: number | null
          total_budget?: number | null
        }
        Update: {
          current_users?: number | null
          id?: number
          is_onboarded?: boolean | null
          last_tweet_at?: string | null
          spent_budget?: number | null
          target_users?: number | null
          total_budget?: number | null
        }
        Relationships: []
      }
      monibot_transactions: {
        Row: {
          amount: number
          campaign_id: string | null
          chain: string
          created_at: string
          error_reason: string | null
          fee: number
          id: string
          language: string | null
          magicpay_claim_mode: string | null
          payer_pay_tag: string | null
          platform: string | null
          receiver_id: string | null
          recipient_pay_tag: string | null
          recipient_username: string | null
          replied: boolean | null
          retry_count: number | null
          sender_id: string
          sender_profile_id: string | null
          sender_source: string | null
          sender_wallet_profile_id: string | null
          status: string
          tweet_id: string | null
          tx_hash: string
          type: string
        }
        Insert: {
          amount: number
          campaign_id?: string | null
          chain?: string
          created_at?: string
          error_reason?: string | null
          fee?: number
          id?: string
          language?: string | null
          magicpay_claim_mode?: string | null
          payer_pay_tag?: string | null
          platform?: string | null
          receiver_id?: string | null
          recipient_pay_tag?: string | null
          recipient_username?: string | null
          replied?: boolean | null
          retry_count?: number | null
          sender_id: string
          sender_profile_id?: string | null
          sender_source?: string | null
          sender_wallet_profile_id?: string | null
          status?: string
          tweet_id?: string | null
          tx_hash: string
          type: string
        }
        Update: {
          amount?: number
          campaign_id?: string | null
          chain?: string
          created_at?: string
          error_reason?: string | null
          fee?: number
          id?: string
          language?: string | null
          magicpay_claim_mode?: string | null
          payer_pay_tag?: string | null
          platform?: string | null
          receiver_id?: string | null
          recipient_pay_tag?: string | null
          recipient_username?: string | null
          replied?: boolean | null
          retry_count?: number | null
          sender_id?: string
          sender_profile_id?: string | null
          sender_source?: string | null
          sender_wallet_profile_id?: string | null
          status?: string
          tweet_id?: string | null
          tx_hash?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "monibot_transactions_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monibot_transactions_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monibot_transactions_sender_wallet_profile_id_fkey"
            columns: ["sender_wallet_profile_id"]
            isOneToOne: false
            referencedRelation: "wallet_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monipay_xyz_tweets: {
        Row: {
          category: string
          created_at: string | null
          hashtags: Json | null
          id: number
          posted: boolean | null
          posted_at: string | null
          text: string
          thread: boolean | null
          thread_id: string | null
          thread_position: number | null
        }
        Insert: {
          category: string
          created_at?: string | null
          hashtags?: Json | null
          id?: number
          posted?: boolean | null
          posted_at?: string | null
          text: string
          thread?: boolean | null
          thread_id?: string | null
          thread_position?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          hashtags?: Json | null
          id?: number
          posted?: boolean | null
          posted_at?: string | null
          text?: string
          thread?: boolean | null
          thread_id?: string | null
          thread_position?: number | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount: number
          callback_url: string | null
          created_at: string
          currency: string
          expires_at: string | null
          fee: number
          id: string
          merchant_profile_id: string
          metadata: Json | null
          order_ref: string
          paid_at: string | null
          payer_pay_tag: string | null
          payer_profile_id: string | null
          payer_wallet: string | null
          payment_link_id: string | null
          source: string
          status: string
          tx_hash: string | null
          webhook_sent_at: string | null
          webhook_url: string | null
        }
        Insert: {
          amount: number
          callback_url?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          fee?: number
          id?: string
          merchant_profile_id: string
          metadata?: Json | null
          order_ref: string
          paid_at?: string | null
          payer_pay_tag?: string | null
          payer_profile_id?: string | null
          payer_wallet?: string | null
          payment_link_id?: string | null
          source: string
          status?: string
          tx_hash?: string | null
          webhook_sent_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          amount?: number
          callback_url?: string | null
          created_at?: string
          currency?: string
          expires_at?: string | null
          fee?: number
          id?: string
          merchant_profile_id?: string
          metadata?: Json | null
          order_ref?: string
          paid_at?: string | null
          payer_pay_tag?: string | null
          payer_profile_id?: string | null
          payer_wallet?: string | null
          payment_link_id?: string | null
          source?: string
          status?: string
          tx_hash?: string | null
          webhook_sent_at?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_links: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          link_code: string
          metadata: Json | null
          name: string
          product_id: string | null
          profile_id: string
          updated_at: string
          usage_count: number
          usage_limit: number | null
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          link_code: string
          metadata?: Json | null
          name: string
          product_id?: string | null
          profile_id: string
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          link_code?: string
          metadata?: Json | null
          name?: string
          product_id?: string | null
          profile_id?: string
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_commands: {
        Row: {
          chain: string
          command_text: string
          command_type: string
          created_at: string
          error_reason: string | null
          id: string
          parsed_amount: number | null
          parsed_recipients: string[] | null
          platform: string
          platform_channel_id: string | null
          platform_message_id: string
          platform_server_id: string | null
          platform_user_id: string
          processed_at: string | null
          profile_id: string | null
          replied_at: string | null
          result_tx_hash: string | null
          status: string
        }
        Insert: {
          chain?: string
          command_text: string
          command_type: string
          created_at?: string
          error_reason?: string | null
          id?: string
          parsed_amount?: number | null
          parsed_recipients?: string[] | null
          platform: string
          platform_channel_id?: string | null
          platform_message_id: string
          platform_server_id?: string | null
          platform_user_id: string
          processed_at?: string | null
          profile_id?: string | null
          replied_at?: string | null
          result_tx_hash?: string | null
          status?: string
        }
        Update: {
          chain?: string
          command_text?: string
          command_type?: string
          created_at?: string
          error_reason?: string | null
          id?: string
          parsed_amount?: number | null
          parsed_recipients?: string[] | null
          platform?: string
          platform_channel_id?: string | null
          platform_message_id?: string
          platform_server_id?: string | null
          platform_user_id?: string
          processed_at?: string | null
          profile_id?: string | null
          replied_at?: string | null
          result_tx_hash?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_commands_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_commands_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          name: string
          pinned: boolean
          price: number
          profile_id: string
          sort_order: number
          stock_quantity: number | null
          updated_at: string
          visible_on_storefront: boolean
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          name: string
          pinned?: boolean
          price: number
          profile_id: string
          sort_order?: number
          stock_quantity?: number | null
          updated_at?: string
          visible_on_storefront?: boolean
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          name?: string
          pinned?: boolean
          price?: number
          profile_id?: string
          sort_order?: number
          stock_quantity?: number | null
          updated_at?: string
          visible_on_storefront?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bluesky_id: string | null
          bluesky_username: string | null
          bot_allowance_amount: number | null
          created_at: string
          deactivated_at: string | null
          discord_id: string | null
          discord_username: string | null
          encrypted_private_key: string
          encrypted_solana_key: string | null
          farcaster_fid: number | null
          farcaster_username: string | null
          google_email: string | null
          google_picture: string | null
          id: string
          pay_tag: string
          preferred_mode: string | null
          preferred_network: string
          solana_address: string | null
          status: string
          telegram_id: string | null
          telegram_username: string | null
          tempo_address: string | null
          updated_at: string
          wallet_address: string
          x_user_id: string | null
          x_username: string | null
          x_verification_code: string | null
          x_verification_expires_at: string | null
          x_verified: boolean | null
        }
        Insert: {
          bluesky_id?: string | null
          bluesky_username?: string | null
          bot_allowance_amount?: number | null
          created_at?: string
          deactivated_at?: string | null
          discord_id?: string | null
          discord_username?: string | null
          encrypted_private_key: string
          encrypted_solana_key?: string | null
          farcaster_fid?: number | null
          farcaster_username?: string | null
          google_email?: string | null
          google_picture?: string | null
          id?: string
          pay_tag: string
          preferred_mode?: string | null
          preferred_network?: string
          solana_address?: string | null
          status?: string
          telegram_id?: string | null
          telegram_username?: string | null
          tempo_address?: string | null
          updated_at?: string
          wallet_address: string
          x_user_id?: string | null
          x_username?: string | null
          x_verification_code?: string | null
          x_verification_expires_at?: string | null
          x_verified?: boolean | null
        }
        Update: {
          bluesky_id?: string | null
          bluesky_username?: string | null
          bot_allowance_amount?: number | null
          created_at?: string
          deactivated_at?: string | null
          discord_id?: string | null
          discord_username?: string | null
          encrypted_private_key?: string
          encrypted_solana_key?: string | null
          farcaster_fid?: number | null
          farcaster_username?: string | null
          google_email?: string | null
          google_picture?: string | null
          id?: string
          pay_tag?: string
          preferred_mode?: string | null
          preferred_network?: string
          solana_address?: string | null
          status?: string
          telegram_id?: string | null
          telegram_username?: string | null
          tempo_address?: string | null
          updated_at?: string
          wallet_address?: string
          x_user_id?: string | null
          x_username?: string | null
          x_verification_code?: string | null
          x_verification_expires_at?: string | null
          x_verified?: boolean | null
        }
        Relationships: []
      }
      promo_broadcasts: {
        Row: {
          chat_id: string
          chat_type: string | null
          id: string
          promo_id: string
          sent_at: string | null
        }
        Insert: {
          chat_id: string
          chat_type?: string | null
          id?: string
          promo_id: string
          sent_at?: string | null
        }
        Update: {
          chat_id?: string
          chat_type?: string | null
          id?: string
          promo_id?: string
          sent_at?: string | null
        }
        Relationships: []
      }
      scheduled_jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          max_attempts: number
          payload: Json
          result: Json | null
          scheduled_at: string
          source_author_id: string | null
          source_author_username: string | null
          source_tweet_id: string | null
          started_at: string | null
          status: string
          type: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          payload?: Json
          result?: Json | null
          scheduled_at: string
          source_author_id?: string | null
          source_author_username?: string | null
          source_tweet_id?: string | null
          started_at?: string | null
          status?: string
          type: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          payload?: Json
          result?: Json | null
          scheduled_at?: string
          source_author_id?: string | null
          source_author_username?: string | null
          source_tweet_id?: string | null
          started_at?: string | null
          status?: string
          type?: string
        }
        Relationships: []
      }
      sports_match_results: {
        Row: {
          api_raw: Json | null
          away_score: number | null
          away_team: string
          completed_at: string | null
          created_at: string
          finished: boolean
          group_name: string | null
          home_score: number | null
          home_team: string
          id: string
          last_synced_at: string
          match_datetime: string | null
          outcome: string | null
          round: string | null
          stability_at: string | null
          status: string
          venue: string | null
          winner_team: string | null
        }
        Insert: {
          api_raw?: Json | null
          away_score?: number | null
          away_team: string
          completed_at?: string | null
          created_at?: string
          finished?: boolean
          group_name?: string | null
          home_score?: number | null
          home_team: string
          id: string
          last_synced_at?: string
          match_datetime?: string | null
          outcome?: string | null
          round?: string | null
          stability_at?: string | null
          status?: string
          venue?: string | null
          winner_team?: string | null
        }
        Update: {
          api_raw?: Json | null
          away_score?: number | null
          away_team?: string
          completed_at?: string | null
          created_at?: string
          finished?: boolean
          group_name?: string | null
          home_score?: number | null
          home_team?: string
          id?: string
          last_synced_at?: string
          match_datetime?: string | null
          outcome?: string | null
          round?: string | null
          stability_at?: string | null
          status?: string
          venue?: string | null
          winner_team?: string | null
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          accent_color: string | null
          banner_url: string | null
          created_at: string
          id: string
          logo_url: string | null
          profile_id: string
          show_branding: boolean
          social_instagram: string | null
          social_telegram: string | null
          social_twitter: string | null
          social_website: string | null
          tagline: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          banner_url?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          profile_id: string
          show_branding?: boolean
          social_instagram?: string | null
          social_telegram?: string | null
          social_twitter?: string | null
          social_website?: string | null
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          banner_url?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          profile_id?: string
          show_branding?: boolean
          social_instagram?: string | null
          social_telegram?: string | null
          social_twitter?: string | null
          social_website?: string | null
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          sender_type: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender_type: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string
          id: string
          pay_tag: string
          priority: string
          profile_id: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          pay_tag: string
          priority?: string
          profile_id?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          pay_tag?: string
          priority?: string
          profile_id?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_user_cache: {
        Row: {
          first_name: string | null
          last_name: string | null
          last_seen_at: string | null
          telegram_id: string
          username: string | null
        }
        Insert: {
          first_name?: string | null
          last_name?: string | null
          last_seen_at?: string | null
          telegram_id: string
          username?: string | null
        }
        Update: {
          first_name?: string | null
          last_name?: string | null
          last_seen_at?: string | null
          telegram_id?: string
          username?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          counterparty: string
          created_at: string
          fee: number
          id: string
          invoice_id: string | null
          items: Json | null
          metadata: Json | null
          payer_pay_tag: string | null
          profile_id: string
          source: string | null
          status: string | null
          tx_hash: string | null
          type: string
        }
        Insert: {
          amount: number
          counterparty: string
          created_at?: string
          fee?: number
          id?: string
          invoice_id?: string | null
          items?: Json | null
          metadata?: Json | null
          payer_pay_tag?: string | null
          profile_id: string
          source?: string | null
          status?: string | null
          tx_hash?: string | null
          type: string
        }
        Update: {
          amount?: number
          counterparty?: string
          created_at?: string
          fee?: number
          id?: string
          invoice_id?: string | null
          items?: Json | null
          metadata?: Json | null
          payer_pay_tag?: string | null
          profile_id?: string
          source?: string | null
          status?: string | null
          tx_hash?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_profiles: {
        Row: {
          bluesky_id: string | null
          bluesky_username: string | null
          bot_allowance_amount: number | null
          created_at: string
          discord_id: string | null
          discord_username: string | null
          farcaster_fid: number | null
          farcaster_username: string | null
          id: string
          pay_tag: string | null
          preferred_name: string | null
          preferred_network: string
          source: string
          telegram_id: string | null
          telegram_username: string | null
          updated_at: string
          wallet_address: string
          x_user_id: string | null
          x_username: string | null
          x_verification_code: string | null
          x_verification_expires_at: string | null
          x_verified: boolean | null
        }
        Insert: {
          bluesky_id?: string | null
          bluesky_username?: string | null
          bot_allowance_amount?: number | null
          created_at?: string
          discord_id?: string | null
          discord_username?: string | null
          farcaster_fid?: number | null
          farcaster_username?: string | null
          id?: string
          pay_tag?: string | null
          preferred_name?: string | null
          preferred_network?: string
          source?: string
          telegram_id?: string | null
          telegram_username?: string | null
          updated_at?: string
          wallet_address: string
          x_user_id?: string | null
          x_username?: string | null
          x_verification_code?: string | null
          x_verification_expires_at?: string | null
          x_verified?: boolean | null
        }
        Update: {
          bluesky_id?: string | null
          bluesky_username?: string | null
          bot_allowance_amount?: number | null
          created_at?: string
          discord_id?: string | null
          discord_username?: string | null
          farcaster_fid?: number | null
          farcaster_username?: string | null
          id?: string
          pay_tag?: string | null
          preferred_name?: string | null
          preferred_network?: string
          source?: string
          telegram_id?: string | null
          telegram_username?: string | null
          updated_at?: string
          wallet_address?: string
          x_user_id?: string | null
          x_username?: string | null
          x_verification_code?: string | null
          x_verification_expires_at?: string | null
          x_verified?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      comments_public: {
        Row: {
          content: string | null
          created_at: string | null
          id: string | null
          name: string | null
          post_slug: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          post_slug?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          post_slug?: string | null
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          created_at: string | null
          id: string | null
          pay_tag: string | null
          preferred_mode: string | null
          preferred_network: string | null
          updated_at: string | null
          wallet_address: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          pay_tag?: string | null
          preferred_mode?: string | null
          preferred_network?: string | null
          updated_at?: string | null
          wallet_address?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          pay_tag?: string | null
          preferred_mode?: string | null
          preferred_network?: string | null
          updated_at?: string | null
          wallet_address?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      normalize_wc_team: { Args: { raw_name: string }; Returns: string }
    }
    Enums: {
      iou_status: "pending" | "claimed" | "expired" | "refunded"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      iou_status: ["pending", "claimed", "expired", "refunded"],
    },
  },
} as const
