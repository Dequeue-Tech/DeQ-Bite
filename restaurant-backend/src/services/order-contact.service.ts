type PlacementContact = {
  name: string;
  email: string;
  phone: string;
};

const ORDER_CONTACT_MARKER = '[ORDER_CONTACT]';
const DELIVERY_EMAIL_MARKER = '[DELIVERY_EMAIL]';

const trim = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const parseOrderContactMarker = (specialInstructions?: string | null) => {
  if (!specialInstructions) return null;
  const markerIndex = specialInstructions.lastIndexOf(ORDER_CONTACT_MARKER);
  if (markerIndex === -1) return null;

  const rawMarkerPayload = specialInstructions
    .slice(markerIndex + ORDER_CONTACT_MARKER.length)
    .split('\n')[0]
    ?.trim();

  if (!rawMarkerPayload) return null;

  try {
    const parsed = JSON.parse(rawMarkerPayload) as { name?: string; email?: string; phone?: string };
    return {
      name: trim(parsed.name),
      email: trim(parsed.email).toLowerCase(),
      phone: trim(parsed.phone),
    };
  } catch {
    return null;
  }
};

const parseDeliveryEmailMarker = (specialInstructions?: string | null) => {
  if (!specialInstructions) return '';
  const markerIndex = specialInstructions.lastIndexOf(DELIVERY_EMAIL_MARKER);
  if (markerIndex === -1) return '';

  const extracted = specialInstructions
    .slice(markerIndex + DELIVERY_EMAIL_MARKER.length)
    .split(/\s|\||\n/)
    .map((entry) => entry.trim())
    .find(Boolean);

  return extracted ? extracted.toLowerCase() : '';
};

export const resolveOrderPlacementContact = (order: {
  specialInstructions?: string | null;
  deliveryCustomerName?: string | null;
  deliveryCustomerPhone?: string | null;
  user?: { name?: string | null } | null;
}) => {
  const marker = parseOrderContactMarker(order.specialInstructions);
  const deliveryEmail = parseDeliveryEmailMarker(order.specialInstructions);

  const contact: PlacementContact = {
    name:
      trim(order.deliveryCustomerName) ||
      trim(marker?.name) ||
      trim(order.user?.name) ||
      'Guest',
    email: trim(marker?.email) || deliveryEmail || '',
    phone: trim(order.deliveryCustomerPhone) || trim(marker?.phone) || '',
  };

  return contact;
};

export const orderContactMarkers = {
  ORDER_CONTACT_MARKER,
  DELIVERY_EMAIL_MARKER,
};
