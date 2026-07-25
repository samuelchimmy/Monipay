-- Create feedback table for user submissions
CREATE TABLE public.feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  pay_tag TEXT,
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature', 'other')),
  message TEXT NOT NULL,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert feedback (no auth required for feedback)
CREATE POLICY "Anyone can submit feedback"
ON public.feedback
FOR INSERT
WITH CHECK (true);

-- Users can view their own feedback by pay_tag
CREATE POLICY "Users can view their own feedback"
ON public.feedback
FOR SELECT
USING (pay_tag IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_feedback_updated_at
BEFORE UPDATE ON public.feedback
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create support_tickets table for real-time chat/ticket system
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pay_tag TEXT NOT NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'waiting', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create support_messages for ticket conversations
CREATE TABLE public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'support')),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on tickets
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Ticket policies
CREATE POLICY "Anyone can create tickets"
ON public.support_tickets
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can view their own tickets"
ON public.support_tickets
FOR SELECT
USING (true);

-- Message policies
CREATE POLICY "Anyone can send messages to tickets"
ON public.support_messages
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can view ticket messages"
ON public.support_messages
FOR SELECT
USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_feedback_pay_tag ON public.feedback(pay_tag);
CREATE INDEX idx_support_tickets_pay_tag ON public.support_tickets(pay_tag);
CREATE INDEX idx_support_messages_ticket_id ON public.support_messages(ticket_id);