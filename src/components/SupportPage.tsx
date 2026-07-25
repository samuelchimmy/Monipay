import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  ArrowLeft, 
  Mail, 
  MessageCircle, 
  HelpCircle, 
  Shield, 
  Wallet, 
  Send,
  CheckCircle2,
  Clock,
  Zap,
  Users,
  MessageSquare,
  Plus,
  ChevronRight,
  Loader2,
  X
} from 'lucide-react';
import { feedback } from '@/lib/feedback';
import { usePayTag } from '@/contexts/PayTagContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { APP_CONFIG, APP_FOOTER_TEXT } from '@/config/app';
interface SupportPageProps {
  onClose: () => void;
}

interface SupportTicket {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_type: 'user' | 'support';
  message: string;
  created_at: string;
}

const faqs = [
  {
    category: 'Getting Started',
    icon: Zap,
    items: [
      {
        question: 'How do I fund my wallet?',
        answer: 'Tap "Fund" on your dashboard to reveal your MoniPay address. Send USDC on Base network from any exchange (Binance, Bybit, Coinbase) to this address. Deposits typically appear within 1-2 minutes.'
      },
      {
        question: 'What is a PayTag?',
        answer: 'Your PayTag is your unique MoniPay username (like @yourname). Others can send you payments using just your PayTag instead of your wallet address.'
      },
      {
        question: 'Is MoniPay free to use?',
        answer: 'Creating an account is free. MoniPay charges a 1% fee on payments received by merchants. Sending payments as a user is completely gasless - we cover all network fees.'
      }
    ]
  },
  {
    category: 'Security',
    icon: Shield,
    items: [
      {
        question: 'Who controls my funds?',
        answer: 'Only you. MoniPay is non-custodial - your private key is encrypted with your PIN and stored locally on your device. We never have access to your funds.'
      },
      {
        question: 'What happens if I lose my device?',
        answer: 'You can restore your wallet using your private key backup. Go to Settings → Backup Wallet to view and securely store your key. Without this backup, lost funds cannot be recovered.'
      },
      {
        question: 'How is my PIN protected?',
        answer: 'Your PIN encrypts your private key using AES-256 encryption. After multiple failed attempts, your wallet will temporarily lock to prevent brute-force attacks.'
      }
    ]
  },
  {
    category: 'Payments',
    icon: Wallet,
    items: [
      {
        question: 'How do gasless payments work?',
        answer: 'When you pay, you sign a message authorizing the transfer. MoniPay relays this to the blockchain and pays the gas fee for you using our Paymaster system.'
      },
      {
        question: 'What currency does MoniPay use?',
        answer: 'MoniPay uses USDC on the Base blockchain. USDC is a stablecoin pegged 1:1 to the US Dollar, so $10 USDC always equals $10 USD.'
      },
      {
        question: 'Why is my balance not updating?',
        answer: 'Balance updates rely on blockchain data. Try pulling down to refresh, or tap the refresh icon. If issues persist, wait a few minutes and try again - network congestion can cause delays.'
      }
    ]
  },
  {
    category: 'Merchants',
    icon: Users,
    items: [
      {
        question: 'How do I receive payments as a merchant?',
        answer: 'Toggle to Merchant mode, then create products or generate payment QR codes. Customers scan to pay, and funds arrive instantly to your wallet minus the 1% platform fee.'
      },
      {
        question: 'Can I withdraw to my bank?',
        answer: 'MoniPay is crypto-native. To convert to fiat, withdraw USDC to an exchange (Binance, Coinbase) and sell it there. We\'re working on direct bank withdrawals for the future.'
      },
      {
        question: 'How do invoices work?',
        answer: 'Create an invoice with items and amounts, then share it via WhatsApp or link. When paid, the invoice automatically updates and funds arrive in your wallet.'
      }
    ]
  }
];

export function SupportPage({ onClose }: SupportPageProps) {
  const { profile } = usePayTag();
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'other' | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Ticket system state
  const [showTickets, setShowTickets] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<SupportMessage[]>([]);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketMessage, setNewTicketMessage] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch user's tickets via Edge Function
  const fetchTickets = async () => {
    if (!profile?.payTag) return;
    
    setIsLoadingTickets(true);
    try {
      const { data, error } = await supabase.functions.invoke('support', {
        body: { 
          action: 'listTickets', 
          payTag: profile.payTag,
          profileId: profile.id
        }
      });
      
      if (error) throw error;
      setTickets(data?.tickets || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setIsLoadingTickets(false);
    }
  };

  // Fetch messages for selected ticket via Edge Function
  const fetchMessages = async (ticketId: string) => {
    if (!profile?.payTag) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('support', {
        body: { 
          action: 'getMessages', 
          ticketId,
          payTag: profile.payTag,
          profileId: profile.id
        }
      });
      
      if (error) throw error;
      setTicketMessages((data?.messages || []).map((msg: any) => ({
        ...msg,
        sender_type: msg.sender_type as 'user' | 'support'
      })));
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  // Subscribe to realtime messages
  useEffect(() => {
    if (!selectedTicket) return;

    const channel = supabase
      .channel(`ticket-${selectedTicket.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `ticket_id=eq.${selectedTicket.id}`
        },
        (payload) => {
          setTicketMessages(prev => [...prev, payload.new as SupportMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTicket]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticketMessages]);

  const handleSubmitFeedback = async () => {
    if (!feedbackMessage.trim() || !feedbackType) {
      feedback('error');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('feedback')
        .insert({
          pay_tag: profile?.payTag || null,
          profile_id: null, // We don't have auth-based profiles
          type: feedbackType,
          message: feedbackMessage.trim(),
          email: feedbackEmail.trim() || null
        });

      if (error) throw error;
      
      setSubmitted(true);
      feedback('success');
      
      setTimeout(() => {
        setSubmitted(false);
        setFeedbackType(null);
        setFeedbackMessage('');
        setFeedbackEmail('');
      }, 3000);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      feedback('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!newTicketSubject.trim() || !newTicketMessage.trim() || !profile?.payTag) {
      feedback('error');
      return;
    }

    setIsSendingMessage(true);
    try {
      // Create ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
          pay_tag: profile.payTag,
          subject: newTicketSubject.trim()
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Add first message
      const { error: messageError } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: ticket.id,
          sender_type: 'user',
          message: newTicketMessage.trim()
        });

      if (messageError) throw messageError;

      feedback('success');
      setNewTicketSubject('');
      setNewTicketMessage('');
      setShowNewTicket(false);
      await fetchTickets();
      
      // Open the new ticket
      setSelectedTicket(ticket);
      await fetchMessages(ticket.id);
    } catch (error) {
      console.error('Error creating ticket:', error);
      feedback('error');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim() || !selectedTicket) {
      feedback('error');
      return;
    }

    setIsSendingMessage(true);
    try {
      const { error } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: selectedTicket.id,
          sender_type: 'user',
          message: replyMessage.trim()
        });

      if (error) throw error;

      feedback('success');
      setReplyMessage('');
      await fetchMessages(selectedTicket.id);
    } catch (error) {
      console.error('Error sending reply:', error);
      feedback('error');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleOpenTickets = () => {
    setShowTickets(true);
    fetchTickets();
  };

  const handleSelectTicket = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    await fetchMessages(ticket.id);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-base-blue/20 text-base-blue';
      case 'waiting': return 'bg-amber-500/20 text-amber-600';
      case 'resolved': return 'bg-success/20 text-success';
      case 'closed': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  // Ticket Chat View
  if (selectedTicket) {
    return (
      <motion.div
        initial={{ opacity: 0, x: '100%' }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed inset-0 z-50 bg-background flex flex-col"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border">
          <div className="container px-4 py-3 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedTicket(null)}
              className="rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-foreground truncate">{selectedTicket.subject}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getStatusColor(selectedTicket.status)}`}>
                  {selectedTicket.status}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(selectedTicket.created_at), 'MMM d, yyyy')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {ticketMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  msg.sender_type === 'user'
                    ? 'bg-base-blue text-white rounded-br-md'
                    : 'bg-muted text-foreground rounded-bl-md'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                <p className={`text-[10px] mt-1 ${msg.sender_type === 'user' ? 'text-white/60' : 'text-muted-foreground'}`}>
                  {format(new Date(msg.created_at), 'h:mm a')}
                </p>
              </div>
            </motion.div>
          ))}
          <div ref={messagesEndRef} />
          
          {ticketMessages.length === 0 && (
            <div className="text-center py-8">
              <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No messages yet</p>
            </div>
          )}
        </div>

        {/* Reply Input */}
        <div className="sticky bottom-0 bg-background border-t border-border p-4 safe-bottom">
          <div className="flex gap-2">
            <Textarea
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              placeholder="Type your message..."
              className="min-h-[44px] max-h-[120px] resize-none rounded-xl text-sm"
              rows={1}
            />
            <Button
              onClick={handleSendReply}
              disabled={!replyMessage.trim() || isSendingMessage}
              size="icon"
              className="h-11 w-11 rounded-xl bg-base-blue hover:bg-base-blue/90 flex-shrink-0"
            >
              {isSendingMessage ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Tickets List View
  if (showTickets) {
    return (
      <motion.div
        initial={{ opacity: 0, x: '100%' }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed inset-0 z-50 bg-background overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border">
          <div className="container px-4 py-4 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowTickets(false)}
              className="rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-bold text-foreground flex-1">Support Tickets</h1>
            <Button
              size="sm"
              onClick={() => setShowNewTicket(true)}
              className="h-8 px-3 rounded-lg bg-base-blue hover:bg-base-blue/90"
            >
              <Plus className="w-4 h-4 mr-1" />
              New
            </Button>
          </div>
        </div>

        <div className="container px-4 py-6 space-y-4">
          {isLoadingTickets ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="font-medium text-foreground mb-1">No tickets yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start a conversation with our support team
              </p>
              <Button
                onClick={() => setShowNewTicket(true)}
                className="bg-base-blue hover:bg-base-blue/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Ticket
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {tickets.map((ticket) => (
                <motion.button
                  key={ticket.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => handleSelectTicket(ticket)}
                  className="w-full bg-card border border-border rounded-xl p-4 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{ticket.subject}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getStatusColor(ticket.status)}`}>
                          {ticket.status}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(ticket.updated_at), 'MMM d, h:mm a')}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>

        {/* New Ticket Modal */}
        <AnimatePresence>
          {showNewTicket && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center"
              onClick={() => setShowNewTicket(false)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card rounded-t-3xl p-6 w-full max-w-lg safe-bottom"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-foreground">New Support Ticket</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowNewTicket(false)}
                    className="rounded-full"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Subject</label>
                    <Input
                      value={newTicketSubject}
                      onChange={(e) => setNewTicketSubject(e.target.value)}
                      placeholder="What do you need help with?"
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Message</label>
                    <Textarea
                      value={newTicketMessage}
                      onChange={(e) => setNewTicketMessage(e.target.value)}
                      placeholder="Describe your issue in detail..."
                      className="min-h-[120px] resize-none rounded-xl"
                    />
                  </div>
                  <Button
                    onClick={handleCreateTicket}
                    disabled={!newTicketSubject.trim() || !newTicketMessage.trim() || isSendingMessage}
                    className="w-full h-12 rounded-xl bg-base-blue hover:bg-base-blue/90"
                  >
                    {isSendingMessage ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Submit Ticket
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  // Main Support Page
  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed inset-0 z-50 bg-background overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container px-4 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground flex-1">Help & Support</h1>
        </div>
      </div>

      <div className="container px-4 py-6 space-y-6">
        {/* Support Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center pb-2"
        >
          <div className="w-16 h-16 rounded-2xl bg-base-blue/10 flex items-center justify-center mx-auto mb-4">
            <HelpCircle className="w-8 h-8 text-base-blue" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-1">How can we help?</h2>
          <p className="text-sm font-medium text-muted-foreground">
            Find answers or reach out to our team
          </p>
        </motion.div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onClick={handleOpenTickets}
            className="bg-card border border-border rounded-2xl p-4 text-left hover:bg-muted/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-base-blue/10 flex items-center justify-center mb-3">
              <MessageSquare className="w-5 h-5 text-base-blue" />
            </div>
            <p className="font-semibold text-foreground text-sm">Live Chat</p>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">Chat with support</p>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            onClick={() => setFeedbackType('feature')}
            className="bg-card border border-border rounded-2xl p-4 text-left hover:bg-muted/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center mb-3">
              <MessageCircle className="w-5 h-5 text-success" />
            </div>
            <p className="font-semibold text-foreground text-sm">Send Feedback</p>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">Suggest improvements</p>
          </motion.button>
        </div>

        {/* Email Support */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-muted/50 rounded-xl p-4 flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
            <Mail className="w-5 h-5 text-purple-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Email Support</p>
            <p className="text-xs font-medium text-muted-foreground">{APP_CONFIG.supportEmail}</p>
          </div>
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-[10px] font-semibold text-muted-foreground">24h</span>
        </motion.div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <h3 className="text-sm font-bold text-muted-foreground mb-3 px-1">
            Frequently Asked Questions
          </h3>
          
          <div className="space-y-3">
            {faqs.map((category, idx) => (
              <div key={category.category} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3 border-b border-border bg-muted/30">
                  <category.icon className="w-4 h-4 text-base-blue" />
                  <span className="text-sm font-semibold text-foreground">{category.category}</span>
                </div>
                <Accordion type="single" collapsible className="px-1">
                  {category.items.map((faq, faqIdx) => (
                    <AccordionItem key={faqIdx} value={`${idx}-${faqIdx}`} className="border-b-0">
                      <AccordionTrigger className="px-3 py-3 text-sm text-left hover:no-underline">
                        <span className="text-foreground font-medium pr-2">{faq.question}</span>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3">
                        <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                          {faq.answer}
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Feedback Form */}
        <AnimatePresence>
          {feedbackType && !submitted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-2xl p-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Send Feedback</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFeedbackType(null);
                    setFeedbackMessage('');
                  }}
                  className="text-xs text-muted-foreground"
                >
                  Cancel
                </Button>
              </div>

              {/* Feedback Type Selection */}
              <div className="flex gap-2 mb-4">
                {[
                  { type: 'bug' as const, label: '🐛 Bug' },
                  { type: 'feature' as const, label: '💡 Feature' },
                  { type: 'other' as const, label: '💬 Other' }
                ].map((item) => (
                  <button
                    key={item.type}
                    onClick={() => setFeedbackType(item.type)}
                    className={`
                      flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors
                      ${feedbackType === item.type 
                        ? 'bg-base-blue text-white' 
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }
                    `}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                    Your feedback
                  </label>
                  <Textarea
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    placeholder={
                      feedbackType === 'bug' 
                        ? "Describe the issue you're experiencing..."
                        : feedbackType === 'feature'
                        ? "What feature would you like to see?"
                        : "Tell us what's on your mind..."
                    }
                    className="min-h-[100px] text-sm resize-none rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                    Email <span className="text-muted-foreground/60 font-medium">(optional)</span>
                  </label>
                  <Input
                    type="email"
                    value={feedbackEmail}
                    onChange={(e) => setFeedbackEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="h-10 text-sm rounded-xl"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Add your email if you'd like us to follow up
                  </p>
                </div>

                <Button
                  onClick={handleSubmitFeedback}
                  disabled={!feedbackMessage.trim() || isSubmitting}
                  className="w-full h-11 rounded-xl bg-base-blue hover:bg-base-blue/90"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Submit Feedback
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feedback Success */}
        <AnimatePresence>
          {submitted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-success/10 border border-success/20 rounded-2xl p-6 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-success" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Thank you!</h3>
              <p className="text-xs font-medium text-muted-foreground">
                Your feedback has been received. We appreciate you helping us improve MoniPay.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Additional Resources */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-sm font-bold text-muted-foreground mb-3 px-1">
            More Resources
          </h3>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <a
              href="/how-it-works"
              className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-muted/50 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-purple-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-foreground">How It Works</p>
                <p className="text-xs font-medium text-muted-foreground">Step-by-step guide</p>
              </div>
            </a>
            <div className="border-t border-border" />
            <a
              href="/privacy"
              className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-muted/50 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Shield className="w-4 h-4 text-green-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-foreground">Privacy Policy</p>
                <p className="text-xs font-medium text-muted-foreground">Your data & security</p>
              </div>
            </a>
            <div className="border-t border-border" />
            <a
              href="/terms"
              className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-muted/50 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <HelpCircle className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-foreground">Terms of Service</p>
                <p className="text-xs font-medium text-muted-foreground">Usage agreement</p>
              </div>
            </a>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="text-center py-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Need urgent help? Email us at
          </p>
          <p className="text-sm font-bold text-base-blue">
            {APP_CONFIG.supportEmail}
          </p>
          <p className="text-[10px] font-medium text-muted-foreground pt-2">
            {APP_FOOTER_TEXT}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
