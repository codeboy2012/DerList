import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';

export const ContactForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    // Placeholder: replace with real API call
    await new Promise((res) => setTimeout(res, 1000));
    setStatus('sent');
    setEmail('');
    setMessage('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border p-2"
        />
      </label>
      <label className="flex flex-col">
        Message
        <textarea
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="rounded border p-2"
        />
      </label>
      <Button type="submit" disabled={status !== 'idle'}>
        {status === 'sending' ? 'Sending...' : 'Send Message'}
      </Button>
      {status === 'sent' && <p className="text-green-600">Message sent!</p>}
    </form>
  );
};
