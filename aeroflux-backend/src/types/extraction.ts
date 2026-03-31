// src/types/extraction.ts
// This is the contract between the AI pipeline and the database.
// The Zod schema in the Python service must match this exactly.

export type ExtractedField = {
  value: string | null;
  confidence: number; // 0.0 – 1.0
  bbox?: [number, number, number, number]; // Tier 2 only: [x, y, width, height]
};

export type ExtractedTourData = {
  travelerNames: ExtractedField[];
  destination: ExtractedField;
  startDate: ExtractedField;
  endDate: ExtractedField;
  hotelName: ExtractedField;
  hotelConfirmNo: ExtractedField;
  flightPnr: ExtractedField;
  flightNumber: ExtractedField;
  pickupTime: ExtractedField;
  pickupLocation: ExtractedField;
  transportDetails: ExtractedField;
  totalAmount: ExtractedField;
  agentNotes: ExtractedField;
};
