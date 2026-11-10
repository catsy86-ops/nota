import { MessageCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { daysWaiting, formatPaymentMessage, generateSMSLink, generateWhatsAppLink } from "@/lib/study/paymentReminder";
import { toast } from "sonner";
import type { PaymentReminder, BankAccount } from "@/lib/study/paymentReminder";

interface PaymentReminderButtonProps {
  reminder: PaymentReminder;
  siteName: string;
  account?: BankAccount;
  phone?: string;  // numer klienta do SMS/WhatsApp
  onSent?: () => void;
}

export function PaymentReminderButton({
  reminder,
  siteName,
  account,
  phone,
  onSent,
}: PaymentReminderButtonProps) {
  const days = daysWaiting(reminder.dueDate);
  const message = formatPaymentMessage(siteName, reminder.amount, days, account);

  function sendSMS() {
    if (!phone) {
      toast.error("Brak numeru telefonu klienta");
      return;
    }
    const link = generateSMSLink(message, phone);
    window.location.href = link;
    onSent?.();
  }

  function sendWhatsApp() {
    if (!phone) {
      toast.error("Brak numeru telefonu klienta");
      return;
    }
    const link = generateWhatsAppLink(message, phone);
    window.open(link, "_blank");
    onSent?.();
  }

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={sendSMS}
        disabled={!phone}
        title="Wyślij SMS"
        className="coarse:h-10"
      >
        <MessageSquare className="h-4 w-4" aria-hidden />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={sendWhatsApp}
        disabled={!phone}
        title="Wyślij WhatsApp"
        className="coarse:h-10"
      >
        <MessageCircle className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}
