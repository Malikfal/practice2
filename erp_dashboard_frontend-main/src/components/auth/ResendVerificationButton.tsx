import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { api } from '../../api/api';
import Button from '../ui/Button';

const RESEND_COOLDOWN_SECONDS = 60;

// Повторная отправка письма с подтверждением почты: не чаще раза в минуту.
export default function ResendVerificationButton({
  email,
  startWithCooldown = false,
  variant = 'secondary',
  className = '',
}: {
  email: string;
  /** Сразу после регистрации письмо только что ушло, повторить можно через минуту. */
  startWithCooldown?: boolean;
  variant?: 'primary' | 'secondary';
  className?: string;
}) {
  const [secondsLeft, setSecondsLeft] = useState(
    startWithCooldown ? RESEND_COOLDOWN_SECONDS : 0,
  );
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((prev) => prev - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  const resend = async () => {
    if (!email.trim()) {
      toast.error('Укажите почту, на которую регистрировали компанию.');
      return;
    }
    try {
      setIsSending(true);
      await api.resendVerificationEmail(email.trim());
      toast.success(
        `Письмо отправлено повторно на ${email.trim()}. Ссылки из прошлых писем тоже работают.`,
      );
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось отправить письмо.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Button
      type='button'
      variant={variant}
      disabled={isSending || secondsLeft > 0}
      onClick={() => void resend()}
      className={className}
    >
      {isSending
        ? 'Отправляем...'
        : secondsLeft > 0
          ? `Отправить ещё раз через ${secondsLeft} с`
          : 'Отправить письмо ещё раз'}
    </Button>
  );
}
