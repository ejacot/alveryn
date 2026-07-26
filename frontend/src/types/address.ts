export type Address = {
  id: string;
  street?: string | null;
  street2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  formatted: string;
};

export type AddressPayload = {
  street?: string | null;
  street2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
};
