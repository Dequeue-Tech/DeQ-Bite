import axios from 'axios';
import { logger } from '@/utils/logger';

type SMSProviderName = 'fast2sms' | 'disabled';
/**
 * Shorten URL using TinyURL service
 */
const shortenUrl = async (longUrl: string): Promise<string> => {
  try {
    const response = await axios.get('https://tinyurl.com/api/create.php', {
      params: { url: longUrl },
      timeout: 5000,
    });
    return typeof response.data === 'string' && response.data.trim() ? response.data : longUrl;
  } catch (error) {
    logger.warn('Failed to shorten URL, using original', { url: longUrl, error: error instanceof Error ? error.message : 'Unknown error' });
    return longUrl;
  }
};


interface SMSProvider {
  name: SMSProviderName;
  getMissingConfig: () => string[];
  send: (options: SMSOptions) => Promise<boolean>;
}

const isValidE164 = (value: string) => /^\+\d{10,15}$/.test(value);
const normalizePhone = (value: string) => {
  // 1. Strip absolutely everything that is NOT a digit or a plus sign 
  // (This instantly fixes any hidden invisible Unicode characters from copy-pasting)
  let cleaned = value.replace(/[^\d+]/g, '');
  
  // 2. QoL fix: If the customer just typed a 10-digit number, automatically append +91
  if (cleaned.length === 10 && !cleaned.startsWith('+')) {
    cleaned = '+91' + cleaned;
  } 
  // 3. If they typed the country code but forgot the plus (e.g., 918700203952)
  else if (cleaned.length > 10 && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  
  return cleaned;
};
const getConfiguredSMSProvider = (): SMSProviderName => {
  const configured = (process.env['SMS_PROVIDER'] || 'fast2sms').trim().toLowerCase();
  if (configured !== 'fast2sms') {
    logger.warn('Overriding SMS_PROVIDER to fast2sms', { configured });
  }
  return 'fast2sms';
};
const toFast2SMSNumber = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return null;
};

const sendViaFast2SMS = async (options: SMSOptions): Promise<boolean> => {
  const endpoint = process.env['FAST2SMS_API_URL'] || 'https://www.fast2sms.com/dev/bulkV2';
  const apiKey = process.env['FAST2SMS_API_KEY']!;
  // Switched back to 'q' (Quick Route) now that the wallet is unlocked!
  const route = process.env['FAST2SMS_ROUTE'] || 'q'; 
  const language = process.env['FAST2SMS_LANGUAGE'] || 'english';
  const number = toFast2SMSNumber(options.to);

  if (!number) {
    logger.error('Fast2SMS requires a valid 10-digit Indian mobile number', { to: options.to });
    return false;
  }

  const payload = new URLSearchParams({
    message: options.message,
    language,
    route,
    numbers: number,
  });

  try {
    const response = await axios.post(endpoint, payload.toString(), {
      headers: {
        authorization: apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      timeout: 10000,
    });

    const data = response.data;

    // If Fast2SMS explicitly says return is false, log the ENTIRE object
    if (data.return === false) {
      logger.error('Fast2SMS rejected the message', {
        to: options.to,
        raw_response: data 
      });
      return false;
    }

    logger.info('SMS sent successfully', {
      provider: 'fast2sms',
      to: options.to,
      requestId: data.request_id,
    });

    return true;

  } catch (error: any) {
    logger.error('Fast2SMS API Request Failed', {
      to: options.to,
      status: error.response?.status,
      fast2sms_error: error.response?.data || error.message,
    });
    return false;
  }
};

export interface SMSOptions {
  to: string;
  message: string;
}

const smsProviders: Record<SMSProviderName, SMSProvider> = {
  fast2sms: {
    name: 'fast2sms',
    getMissingConfig: () => {
      const missing: string[] = [];
      if (!process.env['FAST2SMS_API_KEY']) missing.push('FAST2SMS_API_KEY');
      return missing;
    },
    send: sendViaFast2SMS,
  },
  disabled: {
    name: 'disabled',
    getMissingConfig: () => [],
    send: async () => {
      logger.warn('SMS service disabled by configuration');
      return false;
    },
  },
};

const resolveSMSProvider = (): SMSProvider | null => {
  const providerName = getConfiguredSMSProvider();
  if (providerName === 'fast2sms' || providerName === 'disabled') {
    return smsProviders[providerName];
  }

  logger.error('Unsupported SMS provider configured', {
    provider: providerName,
    supportedProviders: Object.keys(smsProviders),
  });
  return null;
};

/**
 * Send SMS message
 */
export async function sendSMS(options: SMSOptions): Promise<boolean> {
  const normalizedTo = normalizePhone(options.to);
  if (!isValidE164(normalizedTo)) {
    logger.error('Invalid destination phone number', { to: options.to, normalizedTo });
    return false;
  }

  const provider = resolveSMSProvider();
  if (!provider) return false;

  const missingConfig = provider.getMissingConfig();
  if (missingConfig.length > 0) {
    logger.error('SMS configuration incomplete', { provider: provider.name, missingConfig });
    return false;
  }

  try {
    const smsPayload = {
      to: normalizedTo,
      message: options.message,
    };
    const retriesRaw = Number(process.env['SMS_RETRY_ATTEMPTS'] || 2);
    const maxRetries = Number.isFinite(retriesRaw) && retriesRaw >= 0 ? Math.min(Math.floor(retriesRaw), 5) : 2;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const delivered = await provider.send(smsPayload);
      if (delivered) {
        if (attempt > 0) {
          logger.info('SMS delivered after retry', {
            provider: provider.name,
            to: normalizedTo,
            attempt: attempt + 1,
          });
        }
        return true;
      }
      if (attempt < maxRetries) {
        logger.warn('SMS send attempt failed, retrying', {
          provider: provider.name,
          to: normalizedTo,
          nextAttempt: attempt + 2,
        });
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
    return false;
  } catch (error) {
    logger.error('Failed to send SMS', {
      provider: provider.name,
      error: error instanceof Error ? error.message : 'Unknown error',
      to: normalizedTo,
    });
    
    return false;
  }
}

/**
 * Generate invoice SMS message
 */
export function generateInvoiceSMSMessage(invoiceData: {
  customerName: string;
  invoiceNumber: string;
  total: number;
  restaurantName: string;
}): string {
  return `Dear ${invoiceData.customerName},

Your invoice #${invoiceData.invoiceNumber} for ₹${invoiceData.total.toFixed(2)} has been generated.

Thank you for dining with ${invoiceData.restaurantName}!

This is an automated message.`;
}

/**
 * Send invoice SMS notification
 */
export async function sendInvoiceSMS(
  phone: string,
  invoiceData: {
    customerName: string;
    invoiceNumber: string;
    total: number;
    restaurantName: string;
  }
): Promise<boolean> {
  const message = generateInvoiceSMSMessage(invoiceData);
  
  return await sendSMS({
    to: phone,
    message,
  });
}

/**
 * Send order confirmation SMS
 */
export async function sendOrderConfirmationSMS(
  phone: string,
  orderData: {
    customerName: string;
    orderId: string;
    total: number;
    tableNumber: number;
    restaurantName: string;
  }
): Promise<boolean> {
  const message = `Dear ${orderData.customerName},

Your order #${orderData.orderId} for ₹${orderData.total.toFixed(2)} has been confirmed for Table ${orderData.tableNumber}.

Thank you for choosing ${orderData.restaurantName}!

This is an automated message.`;
  
  return await sendSMS({
    to: phone,
    message,
  });
}

export async function sendOrderCompletionSMS(
  phone: string,
  data: {
    customerName: string;
    restaurantName: string;
    invoiceNumber: string;
    total: number;
    invoiceUrl: string;
  }
): Promise<boolean> {
  const shortUrl = await shortenUrl(data.invoiceUrl);
  const message = `Hi ${data.customerName}, your order is completed at ${data.restaurantName}. Invoice ${data.invoiceNumber} (Rs.${data.total.toFixed(2)}): ${shortUrl}`;
  return sendSMS({ to: phone, message });
}
