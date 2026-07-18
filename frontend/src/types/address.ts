export type Address = {
  id: string;
  street: string;
  street2?: string | null;
  postalCode?: string | null;
  city: string;
  region?: string | null;
  country: string;
  formatted: string;
};

export type AddressPayload = {
  street: string;
  street2?: string | null;
  postalCode?: string | null;
  city: string;
  region?: string | null;
  country: string;
};
