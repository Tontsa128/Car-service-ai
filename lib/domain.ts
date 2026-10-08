export type SupportedLanguage = "fi" | "en";

export type AppRole =
  | "owner"
  | "admin"
  | "manager"
  | "service_advisor"
  | "technician"
  | "accounting"
  | "viewer";

export type WorkOrderStatus =
  | "draft"
  | "awaiting_approval"
  | "approved"
  | "in_progress"
  | "quality_check"
  | "ready"
  | "invoiced"
  | "closed"
  | "cancelled";

export type AppointmentStatus =
  | "requested"
  | "confirmed"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export interface Organization {
  id: string;
  name: string;
  businessId: string | null;
  timezone: string;
  defaultLanguage: SupportedLanguage;
}

export interface VehicleSummary {
  id: string;
  registrationNumber: string | null;
  vin: string | null;
  make: string | null;
  model: string | null;
  modelYear: number | null;
  odometerKm: number | null;
}
