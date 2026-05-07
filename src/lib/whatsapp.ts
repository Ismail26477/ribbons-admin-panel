const normalizeWhatsAppPhone = (phone: string) => {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 ? `91${digits}` : digits;
};

export const buildWhatsAppShareUrl = (phone: string, message: string) => {
  const waPhone = normalizeWhatsAppPhone(phone);
  if (!waPhone) return null;
  return `https://web.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent(message)}`;
};

export const openWhatsAppShare = (
  phone: string,
  message: string,
  popup?: Window | null,
) => {
  const url = buildWhatsAppShareUrl(phone, message);
  if (!url) return false;

  if (popup && !popup.closed) {
    popup.location.href = url;
    popup.opener = null;
    return true;
  }

  const opened = window.open(url, "_blank");
  if (opened) opened.opener = null;
  else window.location.assign(url);
  return true;
};

export const preOpenExternalWindow = () => window.open("about:blank", "_blank");
