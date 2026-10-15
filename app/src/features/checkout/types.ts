export interface AddressFormValues {
  street: string;
  house: string;
  apartment: string;
  phone: string;
}

export type AddressField = keyof AddressFormValues;

export type AddressErrors = Partial<Record<AddressField, string>>;

export interface DeliveryAddress {
  street: string;
  house: string;
  apartment: string | null;
  /** Формат E.164: +7XXXXXXXXXX */
  phone: string;
}
