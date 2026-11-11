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
    window.open(link, "_blank", "noopener,noreferrer");
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
        aria-label="Przypomnij SMS-em"
        className="coarse:h-11 coarse:w-11"
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
        aria-label="Przypomnij na WhatsAppie"
        className="coarse:h-11 coarse:w-11"
      >
        <MessageCircle className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}
